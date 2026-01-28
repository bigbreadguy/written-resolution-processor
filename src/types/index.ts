/**
 * Represents a single vote on an agenda item
 */
export interface VoteItem {
  /** Full text of the agenda item */
  agenda: string;
  /** Available voting options, e.g., ["찬성", "반대", "기권"] */
  options: string[];
  /** Selected option(s) - usually single selection */
  voted: string[];
}

/**
 * Information about the individual who submitted the resolution
 */
export interface Individual {
  /** Full name in Korean, e.g., "김OO" */
  name: string;
  /** True if lessee (임차인), false if owner (소유자) */
  is_lessee: boolean;
  /** Date of birth in ISO format, e.g., "1990-01-15" */
  birth_string: string;
  /** Full residential address */
  residential_address: string;
  /** Contact phone number, e.g., "010-1234-5678" */
  contact_number: string;
}

/**
 * Metadata added by the system during extraction
 */
export interface ExtractionMetadata {
  /** Overall confidence level for this extraction */
  confidence: "high" | "medium" | "low";
  /** Whether this item should be flagged for human review */
  requires_review: boolean;
  /** Specific notes about extraction issues */
  extraction_notes: string[];
  /** Original source filename */
  source_file: string;
  /** Page number (for multi-page PDFs) */
  page_number?: number | undefined;
  /** Processing timestamp */
  processed_at: string;
}

/**
 * Represents a single extracted resolution document
 */
export interface ResolutionDocument {
  /** Meeting/document title, e.g., "OOO 관리단 임시총회 서면결의서" */
  document_title: string;
  /** Property/unit identifier, e.g., "101호" */
  property_number: string;
  /** Information about the individual who submitted the resolution */
  individual: Individual;
  /** Array of votes for each agenda item */
  votes: VoteItem[];
}

/**
 * Complete extraction result with metadata
 */
export interface ExtractedResolution extends ResolutionDocument {
  _meta: ExtractionMetadata;
}

/**
 * Gemini API response schema (before adding source_file metadata)
 */
export interface GeminiExtractionResponse {
  document_title: string;
  property_number: string;
  individual: Partial<Individual> & { name: string };
  votes: VoteItem[];
  _meta: {
    confidence: "high" | "medium" | "low";
    requires_review: boolean;
    extraction_notes: string[];
  };
}

/**
 * Represents a file ready for processing
 */
export interface ProcessableFile {
  id: string;
  originalFile: File;
  /** base64 data URL for thumbnail */
  thumbnail: string | null;
  /** 1 for images, n for multi-page PDFs */
  pageCount: number;
  /** Individual page blobs for PDFs */
  pageBlobs: Blob[];
  status: "pending" | "ready" | "error";
  errorMessage?: string;
}

/**
 * Status of a single file during processing
 */
export type FileProcessingStatus =
  | { state: "pending" }
  | { state: "processing" }
  | { state: "done"; result: ExtractedResolution }
  | { state: "error"; error: string };

/**
 * Progress information during batch processing
 */
export interface ProcessingProgress {
  total: number;
  completed: number;
  failed: number;
  currentBatch: number;
  totalBatches: number;
  statuses: Map<string, FileProcessingStatus>;
}

/**
 * Full processing result
 */
export interface ProcessingResult {
  data: ExtractedResolution[];
  summary: {
    total_documents: number;
    successful: number;
    failed: number;
    needs_review: number;
  };
}

/**
 * Application step/screen
 */
export type AppStep =
  | "landing"
  | "api-key-setup"
  | "upload"
  | "processing"
  | "review";

/**
 * Application state
 */
export interface AppState {
  step: AppStep;
  /** Multiple API keys with tier information */
  apiKeys: ApiKeyEntry[];
  hasAcknowledgedAI: boolean;
  files: ProcessableFile[];
  processingProgress: ProcessingProgressExtended | null;
  results: ExtractedResolution[];
  selectedResultIndex: number | null;
}

/**
 * Application actions for reducer
 */
export type AppAction =
  | { type: "ACKNOWLEDGE_AI" }
  | { type: "SET_API_KEYS"; payload: ApiKeyEntry[] }
  | { type: "CLEAR_API_KEYS" }
  | { type: "GO_TO_STEP"; payload: AppStep }
  | { type: "ADD_FILES"; payload: ProcessableFile[] }
  | { type: "REMOVE_FILE"; payload: string }
  | { type: "CLEAR_FILES" }
  | { type: "START_PROCESSING" }
  | { type: "UPDATE_PROGRESS"; payload: ProcessingProgressExtended }
  | { type: "PROCESSING_COMPLETE"; payload: ExtractedResolution[] }
  | { type: "PROCESSING_ERROR"; payload: string }
  | { type: "UPDATE_RESULT"; payload: { index: number; data: Partial<ExtractedResolution> } }
  | { type: "SELECT_RESULT"; payload: number | null }
  | { type: "RESET" };

/**
 * API error types
 */
export type ApiErrorType =
  | "INVALID_API_KEY"
  | "QUOTA_EXCEEDED"
  | "NETWORK_ERROR"
  | "EXTRACTION_FAILED"
  | "UNKNOWN";

export interface ApiError {
  type: ApiErrorType;
  message: string;
  retryable: boolean;
}

// ============================================================
// Multi-Key Rate Limiting Types
// ============================================================

/**
 * Gemini API tier levels
 * - free: 15 RPM, 250K TPM, 250 RPD
 * - tier1: 1,000 RPM, 4M TPM, 10,000 RPD
 * - tier2: 2,000 RPM, 4M TPM, unlimited RPD
 */
export type ApiTier = "free" | "tier1" | "tier2";

/**
 * Rate limits for each tier
 * RPM = Requests Per Minute
 * TPM = Tokens Per Minute
 * RPD = Requests Per Day (null = unlimited)
 */
export interface TierLimits {
  rpm: number;
  tpm: number;
  rpd: number | null;
}

/**
 * API key entry with tier information
 */
export interface ApiKeyEntry {
  /** Unique identifier for this key entry */
  id: string;
  /** The actual API key (AIza...) */
  key: string;
  /** User-selected tier for rate limiting */
  tier: ApiTier;
  /** Optional user-friendly label */
  label?: string | undefined;
  /** Timestamp when the key was added */
  addedAt: string;
}

/**
 * Token bucket state for rate limiting
 */
export interface TokenBucketState {
  /** Current available tokens */
  tokens: number;
  /** Maximum bucket capacity (= RPM limit) */
  maxTokens: number;
  /** Timestamp of last refill calculation */
  lastRefill: number;
}

/**
 * Daily usage tracking (resets at midnight PT)
 */
export interface DailyUsage {
  /** Number of requests made today */
  count: number;
  /** Unix timestamp when the count resets (next midnight PT) */
  resetAt: number;
}

/**
 * Status of a single API key for UI display
 * (Re-exported from services/rateLimiter for convenience)
 */
export interface KeyStatusInfo {
  keyId: string;
  label?: string | undefined;
  tier: ApiTier;
  availableTokens: number;
  maxTokens: number;
  dailyUsed: number;
  dailyLimit: number | null;
  isAvailable: boolean;
  isExhausted: boolean;
}

/**
 * Extended processing progress with rate limit info
 */
export interface ProcessingProgressExtended extends ProcessingProgress {
  /** Status of all API keys */
  keyStatuses: KeyStatusInfo[];
  /** Currently waiting for a key to become available */
  isWaitingForKey: boolean;
  /** Estimated wait time in milliseconds */
  waitTimeMs: number;
}
