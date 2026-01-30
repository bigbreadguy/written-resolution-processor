# Implementation Plan: MVP Features

**Version**: 1.1.0
**Created**: 2026-01-28
**Status**: MVP Complete - Post-MVP Enhancements Implemented

---

## Overview

Implement core MVP features: API key management, multi-file upload, Gemini processing, XLSX export.

**Overall Confidence**: 90%

---

## Technology Decisions

| Decision | Choice | Confidence |
|----------|--------|------------|
| Gemini Model | `gemini-2.5-flash` | 92% |
| Media Resolution | `medium` (560 tokens/image) | 90% |
| Batch Size | Dynamic: max 3 docs, 25K token budget | 90% |
| PDF Library | `pdfjs-dist` with `?url` worker import | 88% |
| API Key Storage | localStorage with CSP + user warning | 78% |
| State Management | React useReducer | 90% |

---

## Phase 0: Project Initialization

### Dependencies

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@google/generative-ai": "^0.21.0",
    "xlsx": "^0.18.5",
    "pdfjs-dist": "^4.9.155"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vitest": "^4.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "eslint": "^9.0.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0"
  }
}
```

### File Structure

```
src/
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── DropZone.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── Modal.tsx
│   │   └── index.ts
│   └── features/
│       ├── AiDisclosure.tsx
│       ├── ApiKeyManager.tsx
│       ├── ApiKeySetup.tsx
│       ├── AppHeader.tsx
│       ├── DetailModal.tsx
│       ├── FileUpload.tsx
│       ├── ProcessingView.tsx
│       ├── ReviewTable.tsx
│       └── index.ts
├── services/
│   ├── __tests__/
│   │   └── gemini.test.ts
│   ├── gemini.ts
│   ├── pdfParser.ts
│   ├── excelExport.ts
│   ├── rateLimiter.ts
│   ├── inspection.ts
│   └── index.ts
├── hooks/
│   ├── useApiKeys.ts
│   ├── useAiAcknowledgment.ts
│   └── index.ts
├── types/
│   └── index.ts
├── constants/
│   └── index.ts
├── utils/
│   ├── retry.ts
│   ├── fileValidation.ts
│   ├── confidence.ts
│   ├── string.ts
│   └── index.ts
├── App.tsx
├── App.module.css
├── main.tsx
└── vite-env.d.ts
```

---

## Phase 1: API Key Management

- Store in localStorage after validation
- Validate by making minimal Gemini API call
- Show security warning to user
- Allow clearing/changing key

---

## Phase 2: Multi-File Upload

- Support JPEG, PNG, single/multi-page PDF
- Drag-and-drop + file browser
- Show thumbnails
- Validate file type and size (max 10MB)
- PDF pages extracted as separate images

---

## Phase 3: Gemini Processing

- Model: `gemini-2.5-flash`
- Dynamic batching: max 3 docs per batch, 25K token budget per request
- Media resolution: `medium` (560 tokens per image page)
- Structured output with JSON schema (single-doc and batch response schemas)
- Retry with exponential backoff (429, 5xx errors)
- Quality validation: reject batch if any item confidence < threshold (30); fallback to individual processing
- Progress tracking per file
- Cancellation support via AbortController

---

## Phase 4: Review Interface

- Table view with all extracted data
- Highlight rows with low confidence
- Filter: "needs review" items only
- Click row to view source image + edit values
- Inline editing support

---

## Phase 5: XLSX Export

- Sheet 1: Summary (vote tallies per agenda, including 기표안함 and 기타 columns)
- Sheet 2: Detail (all extracted fields, page count, numeric confidence, notes)
- Sheet 3: Verification Report (검증보고서 — inspection findings from post-extraction validation)
- Include source filename, confidence, review status

---

## Phase 6: Multi-Key Support

- Support adding, removing, and updating multiple API keys
- Each key has a user-selected tier (free, tier1, tier2) and optional label
- ApiKeyManager component for key CRUD operations
- AppHeader component with key count display and manage button
- Migration from legacy single-key localStorage format

---

## Phase 7: Rate Limiting

- Token bucket algorithm per key (RPM-based capacity)
- Daily request tracking per key (resets at midnight PT)
- Automatic key rotation: select key with most available tokens
- Key status display in UI (available tokens, daily usage, exhaustion state)
- localStorage persistence for bucket and daily state

---

## Phase 8: Confidence Refactoring

- Confidence changed from string enum (high/medium/low) to numeric (0-100)
- Utility functions: isLowConfidence, getConfidenceTag, getConfidenceClassName, getConfidenceTagKorean
- Thresholds: LOW < 50, MEDIUM 50-89, HIGH >= 90

---

## Phase 9: Inspection Service

- Post-extraction validation: detect duplicates, missing votes, name inconsistencies, low confidence, ambiguous votes
- Generate structured InspectionReport with typed findings
- Human-readable report formatting for UI display
- Per-document inspection notes for Excel export integration

---

## Phase 10: Dynamic Batching

- Max 3 documents per batch, 25K token budget per request
- Dynamic sizing based on per-document page count and estimated token cost
- Quality validation: reject batch if any item confidence < 30
- Fallback to individual processing on batch quality failure
- Batch response schema with source_index for result mapping

---

## Phase 11: Test Infrastructure

- Test runner: vitest (integrates with vite config for alias resolution)
- Smoke tests for Gemini processing pipeline (batch count/index validation, single-doc path, batch fallback)
- Mocks: `@google/generative-ai`, `@/utils`, `../rateLimiter`
- Scripts: `pnpm test` (single run), `pnpm test:watch` (watch mode)

---

## Error Handling

| Error | User Message | Action |
|-------|--------------|--------|
| 401 Invalid API Key | "API 키가 유효하지 않습니다" | Re-enter key |
| 429 Rate Limited | "API 한도 초과. 다른 키를 입력하거나 나중에 다시 시도하세요" | Retry/change key |
| Network Error | "네트워크 오류. 인터넷 연결을 확인하세요" | Retry button |
| File Error | "파일을 읽을 수 없습니다: [filename]" | Skip file |
| Extraction Failed | "추출 실패: [filename]" | Flag for manual entry |

---

## Implementation Order

1. Project setup (package.json, configs)
2. Type definitions
3. UI primitives (Button, Input, DropZone, ProgressBar, Modal)
4. API key flow (useApiKey + ApiKeySetup)
5. AI disclosure component
6. File upload (images only first)
7. Gemini integration (single file)
8. Batch processing with progress
9. Review table
10. Detail modal with editing
11. XLSX export
12. PDF support (pdfjs-dist)
13. Polish & error handling
