# Implementation Plan: MVP Features

**Version**: 1.0.0
**Created**: 2026-01-28
**Status**: Approved for Implementation

---

## Overview

Implement core MVP features: API key management, multi-file upload, Gemini processing, XLSX export.

**Overall Confidence**: 90%

---

## Technology Decisions

| Decision | Choice | Confidence |
|----------|--------|------------|
| Gemini Model | `gemini-3-flash-preview` | 92% |
| Media Resolution | `medium` (560 tokens/image) | 90% |
| Batch Size | 10 images per request | 90% |
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
│   │   └── Modal.tsx
│   └── features/
│       ├── AiDisclosure.tsx
│       ├── ApiKeySetup.tsx
│       ├── FileUpload.tsx
│       ├── ProcessingView.tsx
│       ├── ReviewTable.tsx
│       └── DetailModal.tsx
├── services/
│   ├── gemini.ts
│   ├── pdfParser.ts
│   └── excelExport.ts
├── hooks/
│   ├── useApiKey.ts
│   ├── useFileUpload.ts
│   └── useProcessing.ts
├── types/
│   └── index.ts
├── constants/
│   └── index.ts
├── utils/
│   ├── retry.ts
│   └── fileValidation.ts
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

- Model: `gemini-3-flash-preview`
- Batch size: 10 images
- Media resolution: `medium` (560 tokens)
- Structured output with JSON schema
- Retry with exponential backoff (429, 5xx errors)
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

- Sheet 1: Summary (vote tallies per agenda)
- Sheet 2: Detail (all extracted fields)
- Include source filename, confidence, review status

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
