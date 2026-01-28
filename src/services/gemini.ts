import {
  GoogleGenerativeAI,
  SchemaType,
  type GenerationConfig,
} from "@google/generative-ai";
import { GEMINI_MODEL, BATCH_SIZE } from "@/constants";
import { withRetry } from "@/utils";
import type {
  ExtractedResolution,
  GeminiExtractionResponse,
  ProcessingProgress,
  FileProcessingStatus,
} from "@/types";

const SYSTEM_PROMPT = `You are a document extraction assistant specialized in processing Korean written resolutions (서면결의서) from association meetings.

Your task is to extract structured data from scanned document images with high accuracy.

IMPORTANT GUIDELINES:

1. EXTRACTION ACCURACY
   - Extract text exactly as written
   - For Korean names, watch for common OCR confusions:
     - ㅇ (ieung) vs ㅁ (mieum)
     - ㄱ (giyeok) vs ㄴ (nieun)
   - Dates may appear as "2026년 1월 28일" or "2026-01-28"
   - Phone numbers should be normalized to "010-XXXX-XXXX" format

2. CONFIDENCE RATING
   - HIGH: All text clearly visible and printed
   - MEDIUM: Some text handwritten or slightly unclear
   - LOW: Text blurry, partially obscured, or inconsistent

3. REVIEW FLAGS
   - Set requires_review=true if confidence is not HIGH
   - Add extraction_notes for specific issues (e.g., "blurry signature area", "handwritten name")

4. VOTE RECOGNITION
   - Look for checkmarks (✓), circles (○), or filled boxes (■)
   - Common options: 찬성 (approve), 반대 (reject), 기권 (abstain)
   - Extract ALL agenda items and their votes

5. HANDLING UNCERTAINTY
   - If a field is completely illegible, set the value to "[불명]" (unclear)
   - Never guess - mark as uncertain and flag for review`;

const EXTRACTION_PROMPT = `이 서면결의서 이미지에서 다음 정보를 추출해주세요:

1. document_title: 문서 제목 (예: "OOO 관리단 임시총회 서면결의서")
2. property_number: 호수/부동산 번호 (예: "101호")
3. individual:
   - name: 성명
   - is_lessee: 임차인이면 true, 소유자면 false
   - birth_string: 생년월일 (YYYY-MM-DD 형식으로 변환)
   - residential_address: 주소
   - contact_number: 연락처 (010-XXXX-XXXX 형식으로 정규화)
4. votes: 각 안건별 투표 내용
   - agenda: 안건 내용
   - options: 선택 가능한 옵션들
   - voted: 실제 선택된 옵션
5. _meta:
   - confidence: 전체적인 추출 신뢰도 (high/medium/low)
   - requires_review: 사람이 검토해야 하는지 여부
   - extraction_notes: 추출 과정에서 발견된 문제점들

주의사항:
- 모든 안건을 빠짐없이 추출하세요
- 체크박스, 동그라미, 손글씨 표시 모두 인식하세요
- 불확실한 부분은 반드시 requires_review=true로 표시하세요`;

const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    document_title: { type: SchemaType.STRING },
    property_number: { type: SchemaType.STRING },
    individual: {
      type: SchemaType.OBJECT,
      properties: {
        name: { type: SchemaType.STRING },
        is_lessee: { type: SchemaType.BOOLEAN },
        birth_string: { type: SchemaType.STRING },
        residential_address: { type: SchemaType.STRING },
        contact_number: { type: SchemaType.STRING },
      },
      required: ["name"],
    },
    votes: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          agenda: { type: SchemaType.STRING },
          options: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          voted: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
        required: ["agenda", "voted"],
      },
    },
    _meta: {
      type: SchemaType.OBJECT,
      properties: {
        confidence: { type: SchemaType.STRING, enum: ["high", "medium", "low"] },
        requires_review: { type: SchemaType.BOOLEAN },
        extraction_notes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      },
      required: ["confidence", "requires_review"],
    },
  },
  required: ["document_title", "property_number", "individual", "votes", "_meta"],
};

const generationConfig: GenerationConfig = {
  responseMimeType: "application/json",
  responseSchema,
};

interface ImageInput {
  id: string;
  sourceFile: string;
  pageNumber?: number | undefined;
  mimeType: string;
  base64Data: string;
}

export interface ProcessFilesOptions {
  apiKey: string;
  images: ImageInput[];
  onProgress: (progress: ProcessingProgress) => void;
  signal?: AbortSignal | undefined;
}

function createBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

async function processImage(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  image: ImageInput,
  signal?: AbortSignal
): Promise<ExtractedResolution> {
  const result = await withRetry(
    async () => {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const response = await model.generateContent([
        {
          inlineData: {
            mimeType: image.mimeType,
            data: image.base64Data,
          },
        },
        EXTRACTION_PROMPT,
      ]);

      const text = response.response.text();
      return JSON.parse(text) as GeminiExtractionResponse;
    },
    { signal }
  );

  // Transform to ExtractedResolution with full metadata
  const extracted: ExtractedResolution = {
    document_title: result.document_title,
    property_number: result.property_number,
    individual: {
      name: result.individual.name,
      is_lessee: result.individual.is_lessee ?? false,
      birth_string: result.individual.birth_string ?? "",
      residential_address: result.individual.residential_address ?? "",
      contact_number: result.individual.contact_number ?? "",
    },
    votes: result.votes,
    _meta: {
      confidence: result._meta.confidence,
      requires_review: result._meta.requires_review,
      extraction_notes: result._meta.extraction_notes ?? [],
      source_file: image.sourceFile,
      page_number: image.pageNumber,
      processed_at: new Date().toISOString(),
    },
  };

  return extracted;
}

export async function processFiles({
  apiKey,
  images,
  onProgress,
  signal,
}: ProcessFilesOptions): Promise<ExtractedResolution[]> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig,
  });

  const results: ExtractedResolution[] = [];
  const statuses = new Map<string, FileProcessingStatus>();

  // Initialize all statuses as pending
  for (const image of images) {
    statuses.set(image.id, { state: "pending" });
  }

  const batches = createBatches(images, BATCH_SIZE);
  const totalBatches = batches.length;

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const batch = batches[batchIndex];
    if (!batch) continue;

    // Process batch sequentially to avoid rate limits
    for (const image of batch) {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      statuses.set(image.id, { state: "processing" });
      onProgress({
        total: images.length,
        completed: results.length,
        failed: Array.from(statuses.values()).filter((s) => s.state === "error").length,
        currentBatch: batchIndex + 1,
        totalBatches,
        statuses: new Map(statuses),
      });

      try {
        const result = await processImage(model, image, signal);
        results.push(result);
        statuses.set(image.id, { state: "done", result });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        statuses.set(image.id, { state: "error", error: errorMessage });
      }

      onProgress({
        total: images.length,
        completed: results.length,
        failed: Array.from(statuses.values()).filter((s) => s.state === "error").length,
        currentBatch: batchIndex + 1,
        totalBatches,
        statuses: new Map(statuses),
      });
    }
  }

  return results;
}
