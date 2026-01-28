export const GEMINI_MODEL = "gemini-2.5-flash";

export const BATCH_SIZE = 10;

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export const ACCEPTED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

export const ACCEPTED_FILE_EXTENSIONS = ".jpg,.jpeg,.png,.webp,.pdf";

export const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryableStatusCodes: [429, 500, 502, 503, 504],
};

export const STORAGE_KEYS = {
  API_KEY: "gemini_api_key",
  AI_ACKNOWLEDGED: "ai_disclosure_acknowledged",
} as const;

export const MEDIA_RESOLUTION = "medium" as const; // 560 tokens per image

export const AI_DISCLOSURE_TEXT = {
  ko: {
    title: "AI 활용 고지",
    description: "본 서비스는 Google Gemini AI를 활용하여 서면결의서의 내용을 자동으로 인식합니다.",
    points: [
      "AI가 추출한 정보는 반드시 사용자가 검토해야 합니다",
      "최종 결과의 정확성에 대한 책임은 사용자에게 있습니다",
      "개인정보는 브라우저에서만 처리됩니다 (서버 저장 없음)",
    ],
    consent: "위 내용을 이해했으며 동의합니다",
    continue: "계속하기",
  },
  en: {
    title: "AI Usage Notice",
    description: "This service uses Google Gemini AI to automatically recognize content from written resolution documents.",
    points: [
      "AI-extracted information must be verified by the user",
      "The user is responsible for the accuracy of final results",
      "Personal data is processed only in your browser (no server storage)",
    ],
    consent: "I understand and agree to the above",
    continue: "Continue",
  },
} as const;

export const API_KEY_WARNING = {
  ko: {
    title: "API 키 보안 안내",
    points: [
      "API 키는 브라우저의 localStorage에 저장됩니다",
      "공용 컴퓨터에서는 사용 후 키를 삭제하세요",
      "API 키 사용량은 본인 계정에 청구됩니다",
    ],
  },
  en: {
    title: "API Key Security Notice",
    points: [
      "API key is stored in browser's localStorage",
      "Delete the key after use on shared computers",
      "API usage will be billed to your account",
    ],
  },
} as const;

export const ERROR_MESSAGES = {
  INVALID_API_KEY: {
    ko: "API 키가 유효하지 않습니다",
    en: "Invalid API key",
  },
  QUOTA_EXCEEDED: {
    ko: "API 요청 한도를 초과했습니다. 다른 API 키를 입력하거나 나중에 다시 시도하세요.",
    en: "API quota exceeded. Please enter a different API key or try again later.",
  },
  NETWORK_ERROR: {
    ko: "네트워크 오류가 발생했습니다. 인터넷 연결을 확인하세요.",
    en: "Network error. Please check your internet connection.",
  },
  FILE_TOO_LARGE: {
    ko: "파일 크기가 10MB를 초과합니다",
    en: "File size exceeds 10MB",
  },
  UNSUPPORTED_FILE_TYPE: {
    ko: "지원하지 않는 파일 형식입니다",
    en: "Unsupported file type",
  },
} as const;
