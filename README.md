# Written Resolution Processor / 서면결의서 처리기

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5-646cff.svg)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## AI Usage Notice / AI 활용 고지

> **This application uses Google Gemini AI for document processing.**
>
> - AI-extracted information must be verified by the user
> - The user is responsible for the accuracy of final results
> - Personal data is processed only in your browser (no server storage)

> **본 서비스는 Google Gemini AI를 활용합니다.**
>
> - AI가 추출한 정보는 반드시 사용자가 검토해야 합니다
> - 최종 결과의 정확성에 대한 책임은 사용자에게 있습니다
> - 개인정보는 사용자의 브라우저에서만 처리됩니다 (서버 저장 없음)

---

## 한국어 소개

관리단 총회, 재개발/재건축 조합 총회, 주주총회 등의 **서면결의서를 자동으로 처리**하는 웹 애플리케이션입니다.

### 주요 기능

- 스캔된 이미지나 PDF 파일 업로드
- AI가 성명, 연락처, 투표 결과 등 자동 인식
- 불확실한 항목 자동 표시 (사용자 검토 필요)
- 엑셀 파일(.xlsx)로 결과 다운로드

### 대상 사용자

- 아파트/오피스텔 관리단 임원
- 재개발/재건축 조합 사무국
- 법인 주주총회 담당자
- 각종 단체/협회 총회 담당자

---

## Problem

Manually processing written resolutions is **tedious and error-prone**:

- Counting votes across 100+ handwritten documents
- Transcribing names, addresses, phone numbers
- Verifying totals match individual votes
- Re-checking when numbers don't add up

## Solution

Upload scanned documents, let AI extract structured data, review flagged items, and export to Excel.

```
Upload Images/PDFs → AI Extraction → Human Review → XLSX Export
```

---

## Features

- [ ] Multi-format upload (JPEG, PNG, PDF, multi-page PDF)
- [ ] Batch processing (5-10 files per API request)
- [ ] Structured data extraction (name, address, phone, votes)
- [ ] Uncertainty flagging for human review
- [ ] XLSX export with vote tallies
- [ ] Client-only architecture (your API key, your data)

---

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm (`corepack enable pnpm`)
- Google Gemini API key ([Get one here](https://aistudio.google.com/apikey))

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/written-resolution-processor.git
cd written-resolution-processor

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

### Usage

1. Open the app in your browser (default: `http://localhost:5173`)
2. Enter your Gemini API key (stored locally in your browser)
3. Acknowledge the AI usage notice
4. Upload scanned resolution documents
5. Review extracted data (pay attention to flagged items)
6. Export results as XLSX

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | React 18 + TypeScript |
| Build Tool | Vite |
| AI | Google Gemini API (`@google/generative-ai`) |
| Excel Export | SheetJS (`xlsx`) |
| Styling | CSS Modules |
| Deployment | Vercel |

---

## Privacy / 개인정보 처리

### Data Processed / 처리하는 개인정보

| Field | Korean | Sensitivity |
|-------|--------|-------------|
| Name | 성명 | High |
| Date of Birth | 생년월일 | High |
| Address | 주소 | High |
| Phone Number | 연락처 | High |
| Property Number | 호수 | Medium |
| Vote Results | 투표 결과 | Low |

### Data Handling / 데이터 처리 방식

- **Client-only processing**: All data stays in your browser
- **No server storage**: We do not store any uploaded documents or extracted data
- **Gemini API**: Documents are sent to Google's Gemini API for processing
  - Subject to [Google's Privacy Policy](https://policies.google.com/privacy)
  - Your API key = your responsibility
- **Local storage**: API key stored in browser's localStorage (never transmitted to our servers)

---

## Documentation

- [Product Specification](./docs/SPEC.md) - Detailed requirements and architecture
- [Contributing Guide](./AGENTS.md) - For AI-assisted development

---

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Build for production
pnpm build
```

---

## Contributing

See [AGENTS.md](./AGENTS.md) for coding standards and contribution guidelines.

---

## License

MIT License - see [LICENSE](./LICENSE) for details.

---

## Acknowledgments

- Google Gemini API for AI-powered document understanding
- SheetJS for Excel file generation
- The open-source community for React, Vite, and TypeScript
