import {
  GoogleGenerativeAI,
  SchemaType,
  type GenerationConfig,
} from "@google/generative-ai";
import { GEMINI_MODEL, BATCH_SIZE, RATE_LIMIT_CONFIG } from "@/constants";
import { withRetry } from "@/utils";
import { getRateLimiter, type RateLimiter } from "./rateLimiter";
import type {
  ApiKeyEntry,
  ExtractedResolution,
  GeminiExtractionResponse,
  ProcessingProgressExtended,
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
   - Look for various mark types: ✓, V, ○, O, ■, X, or heavy ink marks (굵은 점)
   - CRITICAL: Determine vote by column position (찬성/반대/기권 columns)
   - Common vote options:
     - 찬성 (approve/in favor)
     - 반대 (reject/against)
     - 기권 (abstain)
   - Handle "기표안함" (unmarked): If no mark is found in any column, set voted to ["기표안함"]
   - If multiple marks detected, add note and flag for review
   - Extract ALL agenda items and their votes

5. HANDLING UNCERTAINTY
   - If a field is completely illegible, set the value to "[불명]" (unclear)
   - Never guess - mark as uncertain and flag for review
   - For ambiguous vote marks, note which columns might have marks`;

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
   - options: 선택 가능한 옵션들 (보통 ["찬성", "반대", "기권"])
   - voted: 실제 선택된 옵션 (표시 없으면 ["기표안함"])
5. _meta:
   - confidence: 전체적인 추출 신뢰도 (high/medium/low)
   - requires_review: 사람이 검토해야 하는지 여부
   - extraction_notes: 추출 과정에서 발견된 문제점들 (예: "제2안건 복수 표시", "서명란 불명확")

주의사항:
- 모든 안건을 빠짐없이 추출하세요
- 체크표시(✓,V), 동그라미(○,O), 엑스(X), 진한 점 모두 인식하세요
- 열(column) 위치를 기준으로 찬성/반대/기권 판단하세요
- 어느 열에도 표시가 없으면 voted를 ["기표안함"]으로 설정하세요
- 복수 표시가 있으면 extraction_notes에 기록하고 requires_review=true
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
  apiKeys: ApiKeyEntry[];
  images: ImageInput[];
  onProgress: (progress: ProcessingProgressExtended) => void;
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
      extraction_notes: result._meta.extraction_notes,
      source_file: image.sourceFile,
      page_number: image.pageNumber,
      processed_at: new Date().toISOString(),
    },
  };

  return extracted;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("rate limit") ||
      message.includes("quota") ||
      message.includes("429") ||
      message.includes("resource exhausted")
    );
  }
  return false;
}

function createProgress(
  images: ImageInput[],
  results: ExtractedResolution[],
  statuses: Map<string, FileProcessingStatus>,
  batchIndex: number,
  totalBatches: number,
  rateLimiter: RateLimiter,
  isWaiting: boolean,
  waitTimeMs: number
): ProcessingProgressExtended {
  return {
    total: images.length,
    completed: results.length,
    failed: Array.from(statuses.values()).filter((s) => s.state === "error").length,
    currentBatch: batchIndex + 1,
    totalBatches,
    statuses: new Map(statuses),
    keyStatuses: rateLimiter.getKeyStatuses(),
    isWaitingForKey: isWaiting,
    waitTimeMs,
  };
}

export async function processFiles({
  apiKeys,
  images,
  onProgress,
  signal,
}: ProcessFilesOptions): Promise<ExtractedResolution[]> {
  if (apiKeys.length === 0) {
    throw new Error("No API keys provided");
  }

  const rateLimiter = getRateLimiter(apiKeys);
  const results: ExtractedResolution[] = [];
  const statuses = new Map<string, FileProcessingStatus>();
  const processedIds = new Set<string>();

  // Initialize all statuses as pending
  for (const image of images) {
    statuses.set(image.id, { state: "pending" });
  }

  const batches = createBatches(images, BATCH_SIZE);
  const totalBatches = batches.length;

  // Cache for models by key ID to avoid recreating
  const modelCache = new Map<string, ReturnType<GoogleGenerativeAI["getGenerativeModel"]>>();

  const getModelForKey = (keyEntry: ApiKeyEntry): ReturnType<GoogleGenerativeAI["getGenerativeModel"]> => {
    let model = modelCache.get(keyEntry.id);
    if (!model) {
      const genAI = new GoogleGenerativeAI(keyEntry.key);
      model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        systemInstruction: SYSTEM_PROMPT,
        generationConfig,
      });
      modelCache.set(keyEntry.id, model);
    }
    return model;
  };

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const batch = batches[batchIndex];
    if (!batch) continue;

    // Process batch sequentially with rate limiting
    for (const image of batch) {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      // Skip if already processed (deduplication)
      if (processedIds.has(image.id)) {
        continue;
      }

      statuses.set(image.id, { state: "processing" });
      onProgress(createProgress(images, results, statuses, batchIndex, totalBatches, rateLimiter, false, 0));

      let retryCount = 0;
      let success = false;

      while (!success && retryCount < RATE_LIMIT_CONFIG.maxRetriesPerImage) {
        if (signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        // Get best available key
        const bestKey = rateLimiter.getBestKey();

        if (!bestKey) {
          // All keys exhausted, wait for refill
          const waitTime = rateLimiter.getWaitTime();

          if (waitTime > RATE_LIMIT_CONFIG.maxWaitTimeMs) {
            // Wait time too long, fail the remaining items
            statuses.set(image.id, {
              state: "error",
              error: "All API keys exhausted. Please try again later or add more keys."
            });
            break;
          }

          // Report waiting status
          onProgress(createProgress(images, results, statuses, batchIndex, totalBatches, rateLimiter, true, waitTime));

          // Wait for key to become available
          await sleep(Math.min(waitTime, 5000)); // Check every 5 seconds max
          retryCount++;
          continue;
        }

        try {
          // Consume a request token
          rateLimiter.consumeRequest(bestKey.id);

          const model = getModelForKey(bestKey);
          const result = await processImage(model, image, signal);

          results.push(result);
          statuses.set(image.id, { state: "done", result });
          processedIds.add(image.id);
          success = true;
        } catch (error) {
          if (isRateLimitError(error)) {
            // Mark this key as exhausted and retry with another
            rateLimiter.markExhausted(bestKey.id);
            retryCount++;
            continue;
          }

          // Non-rate-limit error
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          statuses.set(image.id, { state: "error", error: errorMessage });
          processedIds.add(image.id);
          break;
        }
      }

      // If we exhausted retries without success
      if (!success && statuses.get(image.id)?.state === "processing") {
        statuses.set(image.id, {
          state: "error",
          error: "Rate limit exceeded. Please try again later."
        });
        processedIds.add(image.id);
      }

      onProgress(createProgress(images, results, statuses, batchIndex, totalBatches, rateLimiter, false, 0));
    }
  }

  return results;
}
