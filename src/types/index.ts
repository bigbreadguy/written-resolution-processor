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
  apiKey: string | null;
  hasAcknowledgedAI: boolean;
  files: ProcessableFile[];
  processingProgress: ProcessingProgress | null;
  results: ExtractedResolution[];
  selectedResultIndex: number | null;
}

/**
 * Application actions for reducer
 */
export type AppAction =
  | { type: "ACKNOWLEDGE_AI" }
  | { type: "SET_API_KEY"; payload: string }
  | { type: "CLEAR_API_KEY" }
  | { type: "GO_TO_STEP"; payload: AppStep }
  | { type: "ADD_FILES"; payload: ProcessableFile[] }
  | { type: "REMOVE_FILE"; payload: string }
  | { type: "CLEAR_FILES" }
  | { type: "START_PROCESSING" }
  | { type: "UPDATE_PROGRESS"; payload: ProcessingProgress }
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
