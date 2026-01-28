# Product Specification: Written Resolution Processor

**Version**: 1.0.0-draft  
**Last Updated**: 2026-01-28  
**Status**: Planning Phase

---

## Table of Contents

1. [Overview](#1-overview)
2. [Target Users](#2-target-users)
3. [User Stories](#3-user-stories)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Technical Architecture](#6-technical-architecture)
7. [Data Model](#7-data-model)
8. [AI Compliance](#8-ai-compliance)
9. [Privacy and Security](#9-privacy-and-security)
10. [Gemini Prompt Engineering](#10-gemini-prompt-engineering)
11. [UI/UX Flow](#11-uiux-flow)
12. [Error Handling](#12-error-handling)
13. [Out of Scope](#13-out-of-scope)
14. [Future Considerations](#14-future-considerations)

---

## 1. Overview

### 1.1 Problem Statement

Processing written resolutions (서면결의서) from association meetings is a manual, error-prone task:

- **Time-consuming**: Transcribing 100-200 handwritten documents per meeting
- **Error-prone**: Misreading handwritten names, numbers, and vote indicators
- **Repetitive**: Same fields extracted from each document
- **Verification burden**: Manual cross-checking of vote tallies

### 1.2 Solution

A web application that:

1. Accepts scanned images or PDFs of written resolutions
2. Uses Google Gemini AI to extract structured data
3. Flags uncertain extractions for human review
4. Exports results as an Excel file for analysis

### 1.3 Key Value Propositions

| For | Value |
|-----|-------|
| **Association admins** | 80%+ time reduction in document processing |
| **Accuracy** | AI + human review catches errors that pure manual processing misses |
| **Auditability** | Structured data with confidence flags provides clear audit trail |

---

## 2. Target Users

### 2.1 Primary Persona: Association Administrator

**Profile**:
- Works at 관리단 (building management), 재개발/재건축 조합 (urban rearrangement union), or similar organization
- Processes 50-200 written resolutions per meeting
- Moderate technical proficiency (can use Excel, web apps)
- Korean language primary

**Pain Points**:
- Spends 4-8 hours manually transcribing resolution documents
- Makes occasional transcription errors
- Struggles with illegible handwriting
- Needs to verify vote counts multiple times

**Goals**:
- Reduce processing time to under 1 hour
- Maintain or improve accuracy
- Generate audit-ready Excel reports

### 2.2 Secondary Persona: Corporate Secretary

**Profile**:
- Handles stockholder meeting resolutions
- Higher volume, more formal requirements
- May have existing document management systems

---

## 3. User Stories

### 3.1 Core User Stories

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| US-01 | Admin | Upload multiple scanned documents at once | I can process an entire meeting's resolutions in one session | HIGH |
| US-02 | Admin | See extraction progress per document | I know the system is working and can estimate completion time | HIGH |
| US-03 | Admin | Review flagged items before export | I can correct AI errors before generating final report | HIGH |
| US-04 | Admin | Export results as XLSX | I can use Excel for further analysis and reporting | HIGH |
| US-05 | Admin | Store my API key locally | I don't have to re-enter it every session | MEDIUM |
| US-06 | Admin | See which fields were uncertain | I can focus my review on problem areas | HIGH |
| US-07 | Admin | Edit extracted data before export | I can fix errors without re-processing | MEDIUM |

### 3.2 Acceptance Criteria Examples

**US-01: Upload multiple documents**
```gherkin
Given I am on the upload page
When I drag and drop 10 JPEG files onto the upload zone
Then I should see 10 files listed with thumbnails
And I should see a "Process" button enabled
And each file should show its size and name
```

**US-03: Review flagged items**
```gherkin
Given processing is complete
When I view the results table
Then rows with confidence="low" should be highlighted in yellow
And I should see a filter to show "needs review" items only
And I should be able to click a row to see the source image
```

---

## 4. Functional Requirements

### 4.1 File Upload

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | Support JPEG, PNG image upload | HIGH |
| FR-02 | Support single-page PDF upload | HIGH |
| FR-03 | Support multi-page PDF upload (each page = one resolution) | HIGH |
| FR-04 | Drag-and-drop upload interface | HIGH |
| FR-05 | File browser fallback for upload | HIGH |
| FR-06 | Show thumbnail preview of uploaded files | MEDIUM |
| FR-07 | Allow removing files before processing | MEDIUM |
| FR-08 | Validate file type before upload | HIGH |
| FR-09 | Warn if file size exceeds 10MB | MEDIUM |

### 4.2 AI Processing

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-10 | Send files to Gemini API in batches of 5-10 | HIGH |
| FR-11 | Extract all fields defined in data model | HIGH |
| FR-12 | Include confidence level for each extraction | HIGH |
| FR-13 | Flag items requiring human review | HIGH |
| FR-14 | Show per-file processing status | HIGH |
| FR-15 | Handle API rate limits with retry logic | HIGH |
| FR-16 | Support cancellation of in-progress processing | MEDIUM |

### 4.3 Review Interface

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-17 | Display extracted data in table format | HIGH |
| FR-18 | Highlight rows with low confidence | HIGH |
| FR-19 | Filter to show only items needing review | HIGH |
| FR-20 | Click row to view source image | HIGH |
| FR-21 | Edit extracted values inline | MEDIUM |
| FR-22 | Show extraction notes (e.g., "blurry", "handwritten") | MEDIUM |
| FR-23 | Bulk approve reviewed items | LOW |

### 4.4 Export

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-24 | Export all data as XLSX file | HIGH |
| FR-25 | Include summary sheet with vote tallies | HIGH |
| FR-26 | Include detail sheet with all extracted fields | HIGH |
| FR-27 | Mark reviewed vs unreviewed items in export | MEDIUM |
| FR-28 | Include source filename in export | HIGH |

### 4.5 Settings

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-29 | Store Gemini API key in localStorage | HIGH |
| FR-30 | Allow clearing stored API key | HIGH |
| FR-31 | Validate API key before saving | HIGH |
| FR-32 | Show AI usage consent on first use | HIGH |

---

## 5. Non-Functional Requirements

### 5.1 Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-01 | Time to process single document | < 5 seconds |
| NFR-02 | Time to process batch of 10 documents | < 30 seconds |
| NFR-03 | Maximum supported documents per session | 200 |
| NFR-04 | Maximum file size per document | 10 MB |
| NFR-05 | UI responsiveness during processing | No blocking |

### 5.2 Reliability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-06 | Extraction accuracy (clear printed text) | > 95% |
| NFR-07 | Extraction accuracy (handwritten text) | > 85% |
| NFR-08 | Uncertain item detection rate | > 90% of actual errors flagged |
| NFR-09 | API error recovery | Automatic retry with exponential backoff |

### 5.3 Usability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-10 | Time to complete first successful export | < 10 minutes (new user) |
| NFR-11 | Mobile responsiveness | Functional on tablet, viewable on phone |
| NFR-12 | Language support | Korean primary, English secondary |
| NFR-13 | Accessibility | WCAG 2.1 AA compliance |

### 5.4 Security

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-14 | API key storage | localStorage only, never transmitted to our servers |
| NFR-15 | Document storage | Client-side only, no server persistence |
| NFR-16 | HTTPS | Required for production |

---

## 6. Technical Architecture

### 6.1 System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User's Browser                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │   Upload    │───▶│  Processing │───▶│   Review & Export   │ │
│  │  Component  │    │   Service   │    │     Component       │ │
│  └─────────────┘    └──────┬──────┘    └─────────────────────┘ │
│                            │                                    │
│                            ▼                                    │
│                    ┌──────────────┐                             │
│                    │ localStorage │                             │
│                    │  (API Key)   │                             │
│                    └──────────────┘                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                             │
                             │ HTTPS
                             ▼
                    ┌──────────────────┐
                    │  Google Gemini   │
                    │       API        │
                    └──────────────────┘
```

### 6.2 Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Framework** | React 18 | Component-based, large ecosystem |
| **Language** | TypeScript | Type safety, better DX |
| **Build** | Vite | Fast dev server, optimized builds |
| **AI SDK** | `@google/generative-ai` | Official Gemini SDK |
| **Excel** | `xlsx` (SheetJS) | Industry standard, no dependencies |
| **PDF** | `pdf-lib` or `pdfjs-dist` | Client-side PDF processing |
| **Styling** | CSS Modules | Scoped styles, no runtime overhead |
| **Deployment** | Vercel | Easy deployment, good DX |

### 6.3 Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Architecture** | Client-only SPA | Privacy (no server stores data), simplicity |
| **API Key** | User provides own | No backend cost, user controls usage |
| **Batch Size** | 5-10 files per request | Balance between throughput and API limits |
| **State Management** | React useState/useReducer | App complexity doesn't warrant Redux |
| **Image Preprocessing** | Optional (future) | Start simple, add if accuracy issues |

---

## 7. Data Model

### 7.1 Core Types

```typescript
/**
 * Represents a single extracted resolution document
 */
interface ResolutionDocument {
  /** Meeting/document title, e.g., "OOO 관리단 임시총회 서면결의서" */
  document_title: string;
  
  /** Property/unit identifier, e.g., "101호" */
  property_number: string;
  
  /** Information about the individual who submitted the resolution */
  individual: {
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
  };
  
  /** Array of votes for each agenda item */
  votes: VoteItem[];
}

/**
 * Represents a single vote on an agenda item
 */
interface VoteItem {
  /** Full text of the agenda item */
  agenda: string;
  
  /** Available voting options, e.g., ["찬성", "반대"] */
  options: string[];
  
  /** Selected option(s) - usually single selection */
  voted: string[];
}

/**
 * Metadata added by the system during extraction
 */
interface ExtractionMetadata {
  /** Overall confidence level for this extraction */
  confidence: 'high' | 'medium' | 'low';
  
  /** Whether this item should be flagged for human review */
  requires_review: boolean;
  
  /** Specific notes about extraction issues */
  extraction_notes?: string[];
  
  /** Original source filename */
  source_file: string;
  
  /** Processing timestamp */
  processed_at: string;
}

/**
 * Complete extraction result with metadata
 */
interface ExtractedResolution extends ResolutionDocument {
  _meta: ExtractionMetadata;
}

/**
 * Full processing result for API response
 */
interface ProcessingResult {
  data: ExtractedResolution[];
  summary: {
    total_documents: number;
    successful: number;
    failed: number;
    needs_review: number;
  };
}
```

### 7.2 Gemini Response Schema

```typescript
/**
 * Schema for Gemini API structured output
 */
const geminiResponseSchema = {
  type: "object",
  properties: {
    document_title: { type: "string" },
    property_number: { type: "string" },
    individual: {
      type: "object",
      properties: {
        name: { type: "string" },
        is_lessee: { type: "boolean" },
        birth_string: { type: "string" },
        residential_address: { type: "string" },
        contact_number: { type: "string" }
      },
      required: ["name"]
    },
    votes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          agenda: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          voted: { type: "array", items: { type: "string" } }
        },
        required: ["agenda", "voted"]
      }
    },
    _meta: {
      type: "object",
      properties: {
        confidence: { type: "string", enum: ["high", "medium", "low"] },
        requires_review: { type: "boolean" },
        extraction_notes: { type: "array", items: { type: "string" } }
      },
      required: ["confidence", "requires_review"]
    }
  },
  required: ["document_title", "individual", "votes", "_meta"]
};
```

### 7.3 Export Schema (XLSX)

**Sheet 1: Summary**
| Column | Description |
|--------|-------------|
| Agenda | Agenda item text |
| 찬성 (Approve) | Count of approve votes |
| 반대 (Reject) | Count of reject votes |
| 기권 (Abstain) | Count of abstain votes |
| Total | Total votes for this agenda |

**Sheet 2: Detail**
| Column | Description |
|--------|-------------|
| Source File | Original filename |
| Property Number | 호수 |
| Name | 성명 |
| Is Lessee | 임차인 여부 |
| Birth Date | 생년월일 |
| Address | 주소 |
| Phone | 연락처 |
| Agenda 1 | Vote for first agenda |
| Agenda 2 | Vote for second agenda |
| ... | Additional agendas |
| Confidence | Extraction confidence |
| Needs Review | Whether flagged for review |

---

## 8. AI Compliance

### 8.1 Regulatory Background

The **인공지능 발전과 신뢰 기반 조성 등에 관한 법률** (AI Basic Act, effective January 2026) requires:

1. **Transparency**: Users must be informed when AI is being used
2. **User Consent**: Explicit acknowledgment before AI processing
3. **Human Oversight**: AI decisions should be reviewable by humans

### 8.2 Compliance Implementation

| Requirement | Implementation |
|-------------|----------------|
| **AI Disclosure** | Prominent notice on landing page and before processing |
| **Consent** | Checkbox/button acknowledgment required before first use |
| **Transparency** | Clear explanation of what AI does and its limitations |
| **Human Review** | Mandatory review interface before export |
| **Data Rights** | User controls all data (client-only architecture) |

### 8.3 Disclosure UI

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│     ⚠️ AI 활용 고지 (AI Usage Notice)                           │
│                                                                 │
│     본 서비스는 Google Gemini AI를 활용하여 서면결의서의         │
│     내용을 자동으로 인식합니다.                                  │
│                                                                 │
│     This service uses Google Gemini AI to automatically         │
│     recognize content from written resolution documents.        │
│                                                                 │
│     ┌─────────────────────────────────────────────────────┐    │
│     │ ✓ AI가 추출한 정보는 반드시 검토 후 사용해야 합니다    │    │
│     │ ✓ 최종 결과의 정확성 책임은 사용자에게 있습니다        │    │
│     │ ✓ 개인정보는 브라우저에서만 처리됩니다                 │    │
│     └─────────────────────────────────────────────────────┘    │
│                                                                 │
│     [ ] 위 내용을 이해했으며 동의합니다                         │
│                                                                 │
│                    [계속하기 / Continue]                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Privacy and Security

### 9.1 Data Classification

| Data Field | Sensitivity | Handling |
|------------|-------------|----------|
| `name` | HIGH (PII) | Never log, mask in UI if needed |
| `birth_string` | HIGH (PII) | Never log |
| `residential_address` | HIGH (PII) | Never log |
| `contact_number` | HIGH (PII) | Never log |
| `property_number` | MEDIUM | OK to log for debugging |
| `votes` | LOW | OK to log |
| `document_title` | LOW | OK to log |

### 9.2 Data Flow

```
User's Device                          External
─────────────────────────────────────────────────────────
                                       
 [Scanned Files] ──┐                   
                   │                   
                   ▼                   
            ┌─────────────┐            
            │   Browser   │            
            │   Memory    │────────────▶ [Gemini API]
            │             │◀────────────   (Google)
            └─────────────┘            
                   │                   
                   ▼                   
            ┌─────────────┐            
            │ localStorage│            
            │  (API Key)  │            
            └─────────────┘            
                   │                   
                   ▼                   
            ┌─────────────┐            
            │  Download   │            
            │   (XLSX)    │            
            └─────────────┘            
```

### 9.3 Security Measures

| Threat | Mitigation |
|--------|------------|
| API key exposure | Store in localStorage, never transmit to our servers |
| Data breach | No server storage, all processing client-side |
| Man-in-the-middle | HTTPS required, Gemini API uses TLS |
| XSS | React's built-in escaping, CSP headers |
| Malicious files | Validate file types, process in sandboxed context |

### 9.4 Third-Party Data Sharing

| Third Party | Data Shared | Purpose | User Control |
|-------------|-------------|---------|--------------|
| Google Gemini API | Document images, extracted text | AI processing | User provides own API key |
| Vercel Analytics | Page views, anonymized usage | Analytics | Can be disabled |
| Google Analytics | Page views, anonymized usage | Analytics | Can be disabled |

---

## 10. Gemini Prompt Engineering

### 10.1 System Prompt

```
You are a document extraction assistant specialized in processing Korean written resolutions (서면결의서) from association meetings.

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
   - Never guess - mark as uncertain and flag for review
```

### 10.2 Extraction Prompt

```
이 서면결의서 이미지에서 다음 정보를 추출해주세요:

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
- 불확실한 부분은 반드시 requires_review=true로 표시하세요
```

### 10.3 Prompt Optimization Notes

| Factor | Current Approach | Potential Improvement |
|--------|------------------|----------------------|
| **Batch processing** | Send 5-10 images per request | Test optimal batch size for accuracy vs speed |
| **Image resolution** | Accept as-is | Add client-side preprocessing if needed |
| **Language** | Korean prompt | Test bilingual prompt for edge cases |
| **Few-shot examples** | None currently | Add 2-3 examples if accuracy issues |

---

## 11. UI/UX Flow

### 11.1 Main Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        1. LANDING                               │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │              서면결의서 처리기                             │  │
│   │         Written Resolution Processor                     │  │
│   │                                                          │  │
│   │   ⚠️ AI 활용 고지 (required acknowledgment)               │  │
│   │                                                          │  │
│   │            [시작하기 / Get Started]                       │  │
│   └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      2. API KEY SETUP                           │
│                        (first time only)                        │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │   Gemini API 키 입력                                     │  │
│   │   ┌───────────────────────────────────────────────────┐ │  │
│   │   │ AIza...                                           │ │  │
│   │   └───────────────────────────────────────────────────┘ │  │
│   │   [키 저장 및 계속]                                      │  │
│   └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       3. FILE UPLOAD                            │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │   ┌─────────────────────────────────────────────────┐   │  │
│   │   │                                                 │   │  │
│   │   │     📁 파일을 여기에 드래그하거나 클릭하세요      │   │  │
│   │   │        Drag files here or click to browse       │   │  │
│   │   │                                                 │   │  │
│   │   │        JPEG, PNG, PDF 지원 (최대 10MB)          │   │  │
│   │   └─────────────────────────────────────────────────┘   │  │
│   │                                                          │  │
│   │   업로드된 파일 (12개):                                   │  │
│   │   ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐      │  │
│   │   │ 📄  │ │ 📄  │ │ 📄  │ │ 📄  │ │ 📄  │ │ 📄  │      │  │
│   │   │001  │ │002  │ │003  │ │004  │ │005  │ │006  │      │  │
│   │   └──×──┘ └──×──┘ └──×──┘ └──×──┘ └──×──┘ └──×──┘      │  │
│   │                                                          │  │
│   │            [처리 시작 / Start Processing]                │  │
│   └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      4. PROCESSING                              │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │   처리 중... (Processing...)                             │  │
│   │                                                          │  │
│   │   전체 진행률: ████████████░░░░░░░░ 60% (12/20)          │  │
│   │                                                          │  │
│   │   ┌────────────────────────────────────────────────┐    │  │
│   │   │ 파일명           상태              결과         │    │  │
│   │   ├────────────────────────────────────────────────┤    │  │
│   │   │ resolution_001   ✅ 완료           김OO - 찬성  │    │  │
│   │   │ resolution_002   ✅ 완료           이OO - 반대  │    │  │
│   │   │ resolution_003   ⚠️ 검토 필요      박OO - ???   │    │  │
│   │   │ resolution_004   🔄 처리 중...                  │    │  │
│   │   │ resolution_005   ⏳ 대기 중                     │    │  │
│   │   └────────────────────────────────────────────────┘    │  │
│   │                                                          │  │
│   │            [취소 / Cancel]                               │  │
│   └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        5. REVIEW                                │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │   처리 완료 - 20개 중 3개 검토 필요                       │  │
│   │                                                          │  │
│   │   [전체 보기] [검토 필요 항목만 ▼]                        │  │
│   │                                                          │  │
│   │   ┌────────────────────────────────────────────────┐    │  │
│   │   │ # │ 호수  │ 성명  │ 안건1 │ 안건2 │ 신뢰도    │    │  │
│   │   ├────────────────────────────────────────────────┤    │  │
│   │   │ 1 │ 101호 │ 김OO  │ 찬성  │ 반대  │ ● 높음    │    │  │
│   │   │ 2 │ 102호 │ 이OO  │ 찬성  │ 찬성  │ ● 높음    │    │  │
│   │   │ 3 │ 103호 │ 박OO  │ ???   │ 찬성  │ ○ 낮음 ⚠️ │ ◀──── 클릭하여 상세 보기
│   │   │...                                             │    │  │
│   │   └────────────────────────────────────────────────┘    │  │
│   │                                                          │  │
│   │   [XLSX 내보내기 / Export to Excel]                      │  │
│   └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    5a. DETAIL VIEW (Modal)                      │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │   ┌───────────────────┐  ┌───────────────────────────┐  │  │
│   │   │                   │  │ 호수: 103호               │  │  │
│   │   │   [원본 이미지]    │  │ 성명: [박OO        ] ✏️   │  │  │
│   │   │                   │  │ 임차인: [ ] 예 [✓] 아니오 │  │  │
│   │   │                   │  │ 생년월일: [1985-03-15]    │  │  │
│   │   │                   │  │                           │  │  │
│   │   │                   │  │ 안건 1: [??? ▼] ⚠️        │  │  │
│   │   │                   │  │   → "필기체로 불명확"      │  │  │
│   │   │                   │  │ 안건 2: [찬성 ▼]          │  │  │
│   │   └───────────────────┘  └───────────────────────────┘  │  │
│   │                                                          │  │
│   │         [변경사항 저장]          [닫기]                   │  │
│   └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 11.2 State Management

```typescript
type AppState = 
  | { step: 'landing' }
  | { step: 'api-key-setup' }
  | { step: 'upload', files: File[] }
  | { step: 'processing', files: File[], progress: ProcessingProgress }
  | { step: 'review', results: ExtractedResolution[] }
  | { step: 'detail', results: ExtractedResolution[], selectedIndex: number };

interface ProcessingProgress {
  total: number;
  completed: number;
  current: string | null;
  statuses: Map<string, 'pending' | 'processing' | 'done' | 'error' | 'review'>;
}
```

---

## 12. Error Handling

### 12.1 Error Categories

| Category | Example | User Message | Recovery |
|----------|---------|--------------|----------|
| **API Key Invalid** | 401 Unauthorized | "API 키가 유효하지 않습니다" | Re-enter key |
| **Rate Limited** | 429 Too Many Requests | "요청 한도 초과. 잠시 후 재시도..." | Auto-retry with backoff |
| **Network Error** | Connection timeout | "네트워크 오류. 인터넷 연결 확인" | Retry button |
| **File Error** | Corrupt PDF | "파일을 읽을 수 없습니다: [filename]" | Skip file, continue others |
| **Extraction Failed** | Gemini returns invalid JSON | "추출 실패: [filename]" | Flag for manual entry |

### 12.2 Retry Strategy

```typescript
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryableErrors: [429, 500, 502, 503, 504]
};

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: Error;
  for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRetryable(error)) throw error;
      const delay = Math.min(
        RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt),
        RETRY_CONFIG.maxDelayMs
      );
      await sleep(delay);
    }
  }
  throw lastError;
}
```

---

## 13. Out of Scope

The following features are explicitly **not included** in v1.0:

| Feature | Reason | Future Consideration |
|---------|--------|----------------------|
| **Backend server** | Privacy, complexity | If rate limits become issue |
| **User accounts** | Not needed for client-only | If collaboration needed |
| **Document storage** | Privacy concern | If users request |
| **Multi-language OCR** | Focus on Korean | If international expansion |
| **Real-time collaboration** | Complexity | v2.0 if requested |
| **Template customization** | Scope creep | v2.0 |
| **Audit logging** | No backend | If compliance requires |
| **Image preprocessing** | Start simple | If accuracy issues |
| **Batch scheduling** | Complexity | If volume increases |

---

## 14. Future Considerations

### 14.1 Potential v2.0 Features

| Feature | Value | Effort | Priority |
|---------|-------|--------|----------|
| **Image preprocessing** | +5-10% accuracy | MEDIUM | HIGH if accuracy issues |
| **Template learning** | Faster processing | HIGH | MEDIUM |
| **Hybrid OCR+LLM** | +10-15% accuracy | HIGH | HIGH if accuracy issues |
| **Offline mode** | Use without internet | HIGH | LOW |
| **Mobile app** | Better field capture | HIGH | MEDIUM |

### 14.2 Monitoring & Analytics

Track (anonymized):
- Documents processed per session
- Confidence distribution
- Error rates by type
- Processing time metrics
- Feature usage patterns

### 14.3 Cost Optimization

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| Gemini Flash vs Pro | ~50% | Slightly lower accuracy |
| Batch optimization | ~20% | Slightly slower |
| Image compression | ~15% | Potential quality loss |
| Caching similar docs | ~30% | Complexity |

---

## Appendix A: Glossary

| Term | Korean | Definition |
|------|--------|------------|
| Written Resolution | 서면결의서 | Document allowing voting without attending meeting in person |
| Management Association | 관리단 | Building management organization |
| Urban Rearrangement Union | 재개발/재건축 조합 | Organization managing urban redevelopment |
| Lessee | 임차인 | Tenant/renter (as opposed to owner) |
| Agenda | 안건 | Item to be voted on |
| Approve | 찬성 | Vote in favor |
| Reject | 반대 | Vote against |
| Abstain | 기권 | Neither approve nor reject |

---

## Appendix B: Reference Documents

- [Google Gemini API Documentation](https://ai.google.dev/gemini-api/docs)
- [Gemini Structured Output](https://ai.google.dev/gemini-api/docs/structured-output)
- [SheetJS Documentation](https://docs.sheetjs.com/)
- [Korean AI Basic Act (인공지능기본법)](https://www.law.go.kr/)

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0-draft | 2026-01-28 | AI Assistant | Initial specification |
