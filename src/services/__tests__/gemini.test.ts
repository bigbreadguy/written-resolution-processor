import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ApiKeyEntry } from "@/types";

// ── Hoisted mocks ──

const { mockGenerateContent, mockGetRateLimiter } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
  mockGetRateLimiter: vi.fn(),
}));

vi.mock("@google/generative-ai", () => {
  class MockGoogleGenerativeAI {
    getGenerativeModel(): { generateContent: typeof mockGenerateContent } {
      return { generateContent: mockGenerateContent };
    }
  }
  return {
    GoogleGenerativeAI: MockGoogleGenerativeAI,
    SchemaType: {
      OBJECT: "object",
      STRING: "string",
      BOOLEAN: "boolean",
      INTEGER: "integer",
      ARRAY: "array",
    },
  };
});

vi.mock("@/utils", () => ({
  withRetry: async function withRetry(fn: () => Promise<unknown>): Promise<unknown> {
    return fn();
  },
}));

vi.mock("../rateLimiter", () => ({
  getRateLimiter: mockGetRateLimiter,
}));

import { processFiles } from "../gemini";

// ── Helpers ──

function makeApiKey(id = "key-1"): ApiKeyEntry {
  return {
    id,
    key: "AIzaFakeKey",
    tier: "free",
    label: "test",
    addedAt: new Date().toISOString(),
  };
}

function makeImage(id: string, sourceFile: string): {
  id: string;
  sourceFile: string;
  pageCount: number;
  pages: ReadonlyArray<{ mimeType: string; base64Data: string }>;
} {
  return {
    id,
    sourceFile,
    pageCount: 1,
    pages: [{ mimeType: "image/png", base64Data: "fakeBase64" }],
  };
}

function makeSingleDocResponse(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    document_title: "테스트 서면결의서",
    property_number: "101호",
    individual: { name: "김테스트" },
    votes: [
      {
        agenda: "제1호 안건",
        options: ["찬성", "반대", "기권"],
        voted: ["찬성"],
      },
    ],
    _meta: {
      confidence: 95,
      requires_review: false,
      extraction_notes: [],
    },
    ...overrides,
  };
}

function makeBatchResponse(
  documents: Array<Record<string, unknown>>
): { documents: Array<Record<string, unknown>> } {
  return { documents };
}

function wrapAsGeminiResponse(data: unknown): {
  response: { text: () => string };
} {
  return {
    response: {
      text: () => JSON.stringify(data),
    },
  };
}

function createMockRateLimiter(keys: ApiKeyEntry[]): {
  getBestKey: ReturnType<typeof vi.fn>;
  consumeRequest: ReturnType<typeof vi.fn>;
  markExhausted: ReturnType<typeof vi.fn>;
  getWaitTime: ReturnType<typeof vi.fn>;
  getKeyStatuses: ReturnType<typeof vi.fn>;
} {
  return {
    getBestKey: vi.fn().mockImplementation(() => keys[0] ?? null),
    consumeRequest: vi.fn().mockReturnValue(true),
    markExhausted: vi.fn(),
    getWaitTime: vi.fn().mockReturnValue(0),
    getKeyStatuses: vi.fn().mockReturnValue([]),
  };
}

// ── Tests ──

describe("gemini processing pipeline", () => {
  const apiKey = makeApiKey();
  const onProgress = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRateLimiter.mockImplementation((keys: ApiKeyEntry[]) =>
      createMockRateLimiter(keys)
    );
  });

  describe("processBatch count validation", () => {
    it("falls back to individual processing when batch returns wrong document count", async () => {
      const images = [
        makeImage("img-1", "doc1.png"),
        makeImage("img-2", "doc2.png"),
      ];

      // First call: batch returns only 1 doc for 2 images (count mismatch)
      // Subsequent calls: individual processing succeeds
      mockGenerateContent
        .mockResolvedValueOnce(
          wrapAsGeminiResponse(
            makeBatchResponse([
              { ...makeSingleDocResponse(), source_index: 0 },
            ])
          )
        )
        .mockResolvedValue(
          wrapAsGeminiResponse(makeSingleDocResponse())
        );

      const results = await processFiles({
        apiKeys: [apiKey],
        images,
        onProgress,
      });

      expect(results).toHaveLength(2);
    });
  });

  describe("processBatch index validation", () => {
    it("falls back to individual processing when batch has missing source_index", async () => {
      const images = [
        makeImage("img-1", "doc1.png"),
        makeImage("img-2", "doc2.png"),
      ];

      // Batch returns 2 docs but both with source_index 1 (missing 0)
      // Count check passes (2 === 2) but index coverage fails
      mockGenerateContent
        .mockResolvedValueOnce(
          wrapAsGeminiResponse(
            makeBatchResponse([
              { ...makeSingleDocResponse(), source_index: 1 },
              { ...makeSingleDocResponse(), source_index: 1 },
            ])
          )
        )
        .mockResolvedValue(
          wrapAsGeminiResponse(makeSingleDocResponse())
        );

      const results = await processFiles({
        apiKeys: [apiKey],
        images,
        onProgress,
      });

      expect(results).toHaveLength(2);
    });
  });

  describe("processFiles single-doc path", () => {
    it("processes a single image successfully", async () => {
      const images = [makeImage("img-1", "doc1.png")];

      mockGenerateContent.mockResolvedValue(
        wrapAsGeminiResponse(makeSingleDocResponse())
      );

      const results = await processFiles({
        apiKeys: [apiKey],
        images,
        onProgress,
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.document_title).toBe("테스트 서면결의서");
      expect(results[0]?.property_number).toBe("101호");
      expect(results[0]?.individual.name).toBe("김테스트");
      expect(results[0]?._meta.confidence).toBe(95);
      expect(results[0]?._meta.source_file).toBe("doc1.png");
    });
  });

  describe("processFiles batch fallback", () => {
    it("falls back to individual processing when batch fails", async () => {
      const images = [
        makeImage("img-1", "doc1.png"),
        makeImage("img-2", "doc2.png"),
      ];

      // First call: batch throws error
      // Subsequent calls: individual processing succeeds
      mockGenerateContent
        .mockRejectedValueOnce(new Error("batch processing failed"))
        .mockResolvedValue(
          wrapAsGeminiResponse(makeSingleDocResponse())
        );

      const results = await processFiles({
        apiKeys: [apiKey],
        images,
        onProgress,
      });

      expect(results).toHaveLength(2);
      for (const result of results) {
        expect(result.document_title).toBe("테스트 서면결의서");
        expect(result._meta.confidence).toBe(95);
      }
    });
  });
});
