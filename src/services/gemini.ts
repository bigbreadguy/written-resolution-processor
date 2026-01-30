import {
  GoogleGenerativeAI,
  SchemaType,
  type GenerationConfig,
} from "@google/generative-ai";
import {
  GEMINI_MODEL,
  RATE_LIMIT_CONFIG,
  MAX_DOCS_PER_BATCH,
  TOKENS_PER_IMAGE_PAGE,
  PROMPT_OVERHEAD_TOKENS,
  ESTIMATED_RESPONSE_TOKENS_PER_DOC,
  TOKEN_BUDGET_PER_REQUEST,
  BATCH_QUALITY_THRESHOLD,
} from "@/constants";
import { withRetry } from "@/utils";
import { getRateLimiter, type RateLimiter } from "./rateLimiter";
import type {
  ApiKeyEntry,
  ExtractedResolution,
  GeminiExtractionResponse,
  GeminiBatchExtractionResponse,
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

2. CONFIDENCE RATING (0-100 integer scale)
   - 90-100: All text clearly visible and printed, no ambiguity
   - 70-89: Most text clear, minor handwriting or slight blur
   - 50-69: Some text handwritten or moderately unclear
   - 30-49: Significant portions blurry or hard to read
   - 0-29: Text largely illegible or severely obscured
   - Use the full range — avoid clustering around round numbers

3. REVIEW FLAGS
   - Set requires_review=true if confidence < 90
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
   - For ambiguous vote marks, note which columns might have marks

6. LANGUAGE REQUIREMENT
   - ALL extraction_notes MUST be written in Korean
   - Examples: "서명란 불명확", "제2안건 복수 표시", "손글씨 인식 불확실"
   - Never use English in extraction_notes

7. MULTI-PAGE DOCUMENTS
   - A document may consist of multiple page images
   - All pages belong to ONE resolution — extract ONE unified result
   - Cross-reference information across pages for completeness`;

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
   - confidence: 전체적인 추출 신뢰도 (0-100 정수, 높을수록 신뢰도 높음)
   - requires_review: 사람이 검토해야 하는지 여부
   - extraction_notes: 추출 과정에서 발견된 문제점들 (예: "제2안건 복수 표시", "서명란 불명확")

주의사항:
- 모든 안건을 빠짐없이 추출하세요
- 체크표시(✓,V), 동그라미(○,O), 엑스(X), 진한 점 모두 인식하세요
- 열(column) 위치를 기준으로 찬성/반대/기권 판단하세요
- 어느 열에도 표시가 없으면 voted를 ["기표안함"]으로 설정하세요
- 복수 표시가 있으면 extraction_notes에 기록하고 requires_review=true
- 불확실한 부분은 반드시 requires_review=true로 표시하세요
- extraction_notes는 반드시 한국어로 작성하세요 (예: "서명란 흐림", "손글씨 판독 어려움")
- 여러 페이지가 전달될 수 있습니다. 모든 페이지는 한 건의 서면결의서입니다. 전체 페이지를 종합하여 하나의 결과를 추출하세요.`;

const BATCH_SYSTEM_PROMPT = `You are a document extraction assistant specialized in processing Korean written resolutions (서면결의서) from association meetings.

Your task is to extract structured data from scanned document images with high accuracy.

IMPORTANT GUIDELINES:

1. EXTRACTION ACCURACY
   - Extract text exactly as written
   - For Korean names, watch for common OCR confusions:
     - ㅇ (ieung) vs ㅁ (mieum)
     - ㄱ (giyeok) vs ㄴ (nieun)
   - Dates may appear as "2026년 1월 28일" or "2026-01-28"
   - Phone numbers should be normalized to "010-XXXX-XXXX" format

2. CONFIDENCE RATING (0-100 integer scale)
   - 90-100: All text clearly visible and printed, no ambiguity
   - 70-89: Most text clear, minor handwriting or slight blur
   - 50-69: Some text handwritten or moderately unclear
   - 30-49: Significant portions blurry or hard to read
   - 0-29: Text largely illegible or severely obscured
   - Use the full range — avoid clustering around round numbers

3. REVIEW FLAGS
   - Set requires_review=true if confidence < 90
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
   - For ambiguous vote marks, note which columns might have marks

6. LANGUAGE REQUIREMENT
   - ALL extraction_notes MUST be written in Korean
   - Examples: "서명란 불명확", "제2안건 복수 표시", "손글씨 인식 불확실"
   - Never use English in extraction_notes

7. MULTI-DOCUMENT BATCH PROCESSING
   - This request contains MULTIPLE separate resolutions (서면결의서)
   - Each document is labeled with [문서 N: filename] markers
   - Pages between two markers belong to the SAME document
   - Extract EACH document INDEPENDENTLY — return one result per document
   - Include the source_index (0-based) matching the document label number
   - A single document may still have multiple pages`;

function buildBatchExtractionPrompt(images: readonly ImageInput[]): string {
  const docList = images
    .map((img, idx) => `[문서 ${idx}: ${img.sourceFile}] (${img.pageCount}페이지)`)
    .join("\n");

  return `다음 ${images.length}건의 서면결의서를 각각 독립적으로 추출해주세요.

문서 목록:
${docList}

각 문서에서 다음 정보를 추출해주세요:
1. source_index: 위 목록에서의 문서 번호 (0부터 시작)
2. document_title: 문서 제목 (예: "OOO 관리단 임시총회 서면결의서")
3. property_number: 호수/부동산 번호 (예: "101호")
4. individual:
   - name: 성명
   - is_lessee: 임차인이면 true, 소유자면 false
   - birth_string: 생년월일 (YYYY-MM-DD 형식으로 변환)
   - residential_address: 주소
   - contact_number: 연락처 (010-XXXX-XXXX 형식으로 정규화)
5. votes: 각 안건별 투표 내용
   - agenda: 안건 내용
   - options: 선택 가능한 옵션들 (보통 ["찬성", "반대", "기권"])
   - voted: 실제 선택된 옵션 (표시 없으면 ["기표안함"])
6. _meta:
   - confidence: 전체적인 추출 신뢰도 (0-100 정수, 높을수록 신뢰도 높음)
   - requires_review: 사람이 검토해야 하는지 여부
   - extraction_notes: 추출 과정에서 발견된 문제점들

주의사항:
- 각 [문서 N] 마커 사이의 이미지는 동일 문서에 속합니다
- 문서별로 독립적인 결과를 반환하세요
- source_index가 문서 번호와 정확히 일치해야 합니다
- 모든 안건을 빠짐없이 추출하세요
- 체크표시(✓,V), 동그라미(○,O), 엑스(X), 진한 점 모두 인식하세요
- 열(column) 위치를 기준으로 찬성/반대/기권 판단하세요
- 어느 열에도 표시가 없으면 voted를 ["기표안함"]으로 설정하세요
- 복수 표시가 있으면 extraction_notes에 기록하고 requires_review=true
- 불확실한 부분은 반드시 requires_review=true로 표시하세요
- extraction_notes는 반드시 한국어로 작성하세요`;
}

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
        confidence: { type: SchemaType.INTEGER },
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

const batchResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    documents: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          source_index: { type: SchemaType.INTEGER },
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
              confidence: { type: SchemaType.INTEGER },
              requires_review: { type: SchemaType.BOOLEAN },
              extraction_notes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            },
            required: ["confidence", "requires_review"],
          },
        },
        required: ["source_index", "document_title", "property_number", "individual", "votes", "_meta"],
      },
    },
  },
  required: ["documents"],
};

const batchGenerationConfig: GenerationConfig = {
  responseMimeType: "application/json",
  responseSchema: batchResponseSchema,
};

interface ImageInput {
  id: string;
  sourceFile: string;
  pageCount: number;
  pages: ReadonlyArray<{ mimeType: string; base64Data: string }>;
}

export interface ProcessFilesOptions {
  apiKeys: ApiKeyEntry[];
  images: ImageInput[];
  onProgress: (progress: ProcessingProgressExtended) => void;
  signal?: AbortSignal | undefined;
}

interface ProcessingContext {
  readonly images: readonly ImageInput[];
  readonly results: ExtractedResolution[];
  readonly statuses: Map<string, FileProcessingStatus>;
  readonly processedIds: Set<string>;
  readonly rateLimiter: RateLimiter;
  readonly modelCache: Map<string, ReturnType<GoogleGenerativeAI["getGenerativeModel"]>>;
  readonly onProgress: (progress: ProcessingProgressExtended) => void;
  readonly signal: AbortSignal | undefined;
}

interface BatchInfo {
  readonly batchIndex: number;
  readonly totalBatches: number;
  readonly currentBatchSize: number;
}

function createDynamicBatches(images: readonly ImageInput[]): ImageInput[][] {
  const batches: ImageInput[][] = [];
  let currentBatch: ImageInput[] = [];
  let currentTokens = PROMPT_OVERHEAD_TOKENS;

  for (const image of images) {
    const cost =
      image.pageCount * TOKENS_PER_IMAGE_PAGE + ESTIMATED_RESPONSE_TOKENS_PER_DOC;
    const wouldExceedDocs = currentBatch.length >= MAX_DOCS_PER_BATCH;
    const wouldExceedTokens = currentTokens + cost > TOKEN_BUDGET_PER_REQUEST;

    if (currentBatch.length > 0 && (wouldExceedDocs || wouldExceedTokens)) {
      batches.push(currentBatch);
      currentBatch = [];
      currentTokens = PROMPT_OVERHEAD_TOKENS;
    }
    currentBatch.push(image);
    currentTokens += cost;
  }
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
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
        ...image.pages.map((p) => ({
          inlineData: {
            mimeType: p.mimeType,
            data: p.base64Data,
          },
        })),
        EXTRACTION_PROMPT,
      ]);

      const text = response.response.text();
      return JSON.parse(text) as GeminiExtractionResponse;
    },
    { signal }
  );

  // Clamp confidence score to 0-100 range
  const confidenceScore = Math.round(Math.max(0, Math.min(100, result._meta.confidence)));

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
      confidence: confidenceScore,
      requires_review: result._meta.requires_review,
      extraction_notes: result._meta.extraction_notes,
      source_file: image.sourceFile,
      page_count: image.pageCount,
      processed_at: new Date().toISOString(),
    },
  };

  return extracted;
}

function buildBatchContentParts(
  images: readonly ImageInput[]
): Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> {
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    if (!image) continue;
    parts.push({ text: `[문서 ${i}: ${image.sourceFile}]` });
    for (const page of image.pages) {
      parts.push({
        inlineData: {
          mimeType: page.mimeType,
          data: page.base64Data,
        },
      });
    }
  }

  parts.push({ text: buildBatchExtractionPrompt(images) });
  return parts;
}

interface BatchResultItem {
  readonly result: ExtractedResolution;
  readonly sourceIndex: number;
}

async function processBatch(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  images: readonly ImageInput[],
  signal?: AbortSignal
): Promise<BatchResultItem[]> {
  const result = await withRetry(
    async () => {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const parts = buildBatchContentParts(images);
      const response = await model.generateContent(parts);
      const text = response.response.text();
      return JSON.parse(text) as GeminiBatchExtractionResponse;
    },
    { signal }
  );

  // Validate document count matches input
  if (result.documents.length !== images.length) {
    throw new Error(
      `Batch response mismatch: expected ${images.length} documents but received ${result.documents.length}`
    );
  }

  // Validate source_index coverage
  const expectedIndices = new Set(images.map((_, i) => i));
  const receivedIndices = new Set(result.documents.map((d) => d.source_index));

  for (const expected of expectedIndices) {
    if (!receivedIndices.has(expected)) {
      throw new Error(`Batch response missing source_index ${expected}`);
    }
  }

  // Map each batch item to BatchResultItem
  const extracted: BatchResultItem[] = result.documents.map((doc) => {
    const image = images[doc.source_index];
    if (!image) {
      throw new Error(`Invalid source_index ${doc.source_index}`);
    }

    const confidenceScore = Math.round(Math.max(0, Math.min(100, doc._meta.confidence)));

    return {
      result: {
        document_title: doc.document_title,
        property_number: doc.property_number,
        individual: {
          name: doc.individual.name,
          is_lessee: doc.individual.is_lessee ?? false,
          birth_string: doc.individual.birth_string ?? "",
          residential_address: doc.individual.residential_address ?? "",
          contact_number: doc.individual.contact_number ?? "",
        },
        votes: doc.votes,
        _meta: {
          confidence: confidenceScore,
          requires_review: doc._meta.requires_review,
          extraction_notes: doc._meta.extraction_notes,
          source_file: image.sourceFile,
          page_count: image.pageCount,
          processed_at: new Date().toISOString(),
        },
      },
      sourceIndex: doc.source_index,
    };
  });

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
  ctx: ProcessingContext,
  batch: BatchInfo,
  isWaiting: boolean,
  waitTimeMs: number
): ProcessingProgressExtended {
  return {
    total: ctx.images.length,
    completed: ctx.results.length,
    failed: Array.from(ctx.statuses.values()).filter((s) => s.state === "error").length,
    currentBatch: batch.batchIndex + 1,
    totalBatches: batch.totalBatches,
    statuses: new Map(ctx.statuses),
    keyStatuses: ctx.rateLimiter.getKeyStatuses(),
    isWaitingForKey: isWaiting,
    waitTimeMs,
    currentBatchSize: batch.currentBatchSize,
  };
}

/**
 * Acquire an API key with retry/wait logic.
 * Returns the key entry, or null if all keys are exhausted beyond max wait.
 */
async function acquireKey(
  rateLimiter: RateLimiter,
  signal: AbortSignal | undefined,
  reportWaiting: (waitTimeMs: number) => void
): Promise<ApiKeyEntry | null> {
  let retryCount = 0;
  while (retryCount < RATE_LIMIT_CONFIG.maxRetriesPerImage) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const bestKey = rateLimiter.getBestKey();
    if (bestKey) {
      return bestKey;
    }

    const waitTime = rateLimiter.getWaitTime();
    if (waitTime > RATE_LIMIT_CONFIG.maxWaitTimeMs) {
      return null;
    }

    reportWaiting(waitTime);
    await sleep(Math.min(waitTime, 5000));
    retryCount++;
  }
  return null;
}

/**
 * Process a single image with rate-limited key acquisition, retries, and error handling.
 */
async function processImageWithRateLimit(
  image: ImageInput,
  ctx: ProcessingContext,
  batch: BatchInfo
): Promise<void> {
  if (ctx.processedIds.has(image.id)) return;

  ctx.statuses.set(image.id, { state: "processing" });
  ctx.onProgress(createProgress(ctx, batch, false, 0));

  let retryCount = 0;
  let success = false;

  while (!success && retryCount < RATE_LIMIT_CONFIG.maxRetriesPerImage) {
    if (ctx.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const bestKey = await acquireKey(ctx.rateLimiter, ctx.signal, (waitTimeMs) => {
      ctx.onProgress(createProgress(ctx, batch, true, waitTimeMs));
    });

    if (!bestKey) {
      ctx.statuses.set(image.id, {
        state: "error",
        error: "All API keys exhausted. Please try again later or add more keys.",
      });
      ctx.processedIds.add(image.id);
      return;
    }

    try {
      ctx.rateLimiter.consumeRequest(bestKey.id);
      const model = getSingleModel(ctx.modelCache, bestKey);
      const result = await processImage(model, image, ctx.signal);

      ctx.results.push(result);
      ctx.statuses.set(image.id, { state: "done", result });
      ctx.processedIds.add(image.id);
      success = true;
    } catch (error) {
      if (isRateLimitError(error)) {
        ctx.rateLimiter.markExhausted(bestKey.id);
        retryCount++;
        continue;
      }

      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      ctx.statuses.set(image.id, { state: "error", error: errorMessage });
      ctx.processedIds.add(image.id);
      break;
    }
  }

  if (!success && ctx.statuses.get(image.id)?.state === "processing") {
    ctx.statuses.set(image.id, {
      state: "error",
      error: "Rate limit exceeded. Please try again later.",
    });
    ctx.processedIds.add(image.id);
  }

  ctx.onProgress(createProgress(ctx, batch, false, 0));
}

function getSingleModel(
  cache: Map<string, ReturnType<GoogleGenerativeAI["getGenerativeModel"]>>,
  keyEntry: ApiKeyEntry
): ReturnType<GoogleGenerativeAI["getGenerativeModel"]> {
  const cacheKey = `single_${keyEntry.id}`;
  let model = cache.get(cacheKey);
  if (!model) {
    const genAI = new GoogleGenerativeAI(keyEntry.key);
    model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: SYSTEM_PROMPT,
      generationConfig,
    });
    cache.set(cacheKey, model);
  }
  return model;
}

function getBatchModel(
  cache: Map<string, ReturnType<GoogleGenerativeAI["getGenerativeModel"]>>,
  keyEntry: ApiKeyEntry
): ReturnType<GoogleGenerativeAI["getGenerativeModel"]> {
  const cacheKey = `batch_${keyEntry.id}`;
  let model = cache.get(cacheKey);
  if (!model) {
    const genAI = new GoogleGenerativeAI(keyEntry.key);
    model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: BATCH_SYSTEM_PROMPT,
      generationConfig: batchGenerationConfig,
    });
    cache.set(cacheKey, model);
  }
  return model;
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

  for (const image of images) {
    statuses.set(image.id, { state: "pending" });
  }

  const batches = createDynamicBatches(images);

  // Unified model cache for both single and batch models (keyed by "single_<id>" / "batch_<id>")
  const modelCache = new Map<string, ReturnType<GoogleGenerativeAI["getGenerativeModel"]>>();

  const ctx: ProcessingContext = {
    images,
    results,
    statuses,
    processedIds,
    rateLimiter,
    modelCache,
    onProgress,
    signal,
  };

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const batchDocs = batches[batchIndex];
    if (!batchDocs) continue;

    const batchInfo: BatchInfo = {
      batchIndex,
      totalBatches: batches.length,
      currentBatchSize: batchDocs.length,
    };

    // Mark all docs in this batch as processing
    for (const image of batchDocs) {
      if (!processedIds.has(image.id)) {
        statuses.set(image.id, { state: "processing" });
      }
    }
    onProgress(createProgress(ctx, batchInfo, false, 0));

    // Single-doc batch: use existing single-doc path
    if (batchDocs.length === 1) {
      const image = batchDocs[0];
      if (!image) continue;
      await processImageWithRateLimit(image, ctx, batchInfo);
      continue;
    }

    // Multi-doc batch: try batch processing
    const bestKey = await acquireKey(rateLimiter, signal, (waitTimeMs) => {
      onProgress(createProgress(ctx, batchInfo, true, waitTimeMs));
    });

    if (!bestKey) {
      // No key available — fail all docs in this batch
      for (const image of batchDocs) {
        if (!processedIds.has(image.id)) {
          statuses.set(image.id, {
            state: "error",
            error: "All API keys exhausted. Please try again later or add more keys.",
          });
          processedIds.add(image.id);
        }
      }
      onProgress(createProgress(ctx, batchInfo, false, 0));
      continue;
    }

    let batchSucceeded = false;

    try {
      rateLimiter.consumeRequest(bestKey.id);
      const batchModel = getBatchModel(modelCache, bestKey);
      const batchResults = await processBatch(batchModel, batchDocs, signal);

      // Quality validation: check for low-confidence results that need individual re-processing
      const lowConfidenceIndices: number[] = [];
      for (const item of batchResults) {
        const matchingImage = batchDocs[item.sourceIndex];
        if (!matchingImage) continue;

        if (item.result._meta.confidence < BATCH_QUALITY_THRESHOLD) {
          lowConfidenceIndices.push(item.sourceIndex);
        } else {
          results.push(item.result);
          statuses.set(matchingImage.id, { state: "done", result: item.result });
          processedIds.add(matchingImage.id);
        }
      }

      // Re-process low-confidence docs individually
      for (const idx of lowConfidenceIndices) {
        const image = batchDocs[idx];
        if (!image || processedIds.has(image.id)) continue;
        await processImageWithRateLimit(image, ctx, batchInfo);
      }

      batchSucceeded = true;
    } catch (error) {
      if (isRateLimitError(error)) {
        rateLimiter.markExhausted(bestKey.id);
      }
      // Batch failed — fall through to individual fallback
    }

    // Fallback: process remaining unprocessed docs individually
    if (!batchSucceeded) {
      for (const image of batchDocs) {
        if (processedIds.has(image.id)) continue;
        await processImageWithRateLimit(image, ctx, batchInfo);
      }
    }

    onProgress(createProgress(ctx, batchInfo, false, 0));
  }

  return results;
}
