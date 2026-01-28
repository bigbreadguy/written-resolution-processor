import * as XLSX from "xlsx";
import type { ExtractedResolution } from "@/types";

interface VoteTally {
  agenda: string;
  approve: number;
  reject: number;
  abstain: number;
  other: number;
  total: number;
}

function generateSummaryData(results: ExtractedResolution[]): VoteTally[] {
  const tallyMap = new Map<string, VoteTally>();

  for (const result of results) {
    for (const vote of result.votes) {
      let tally = tallyMap.get(vote.agenda);
      if (!tally) {
        tally = {
          agenda: vote.agenda,
          approve: 0,
          reject: 0,
          abstain: 0,
          other: 0,
          total: 0,
        };
        tallyMap.set(vote.agenda, tally);
      }

      const votedLower = vote.voted
        .map((v) => v.toLowerCase())
        .join(" ");

      if (votedLower.includes("찬성") || votedLower.includes("approve") || votedLower.includes("yes")) {
        tally.approve++;
      } else if (votedLower.includes("반대") || votedLower.includes("reject") || votedLower.includes("no")) {
        tally.reject++;
      } else if (votedLower.includes("기권") || votedLower.includes("abstain")) {
        tally.abstain++;
      } else {
        tally.other++;
      }
      tally.total++;
    }
  }

  return Array.from(tallyMap.values());
}

interface DetailRow {
  "원본파일": string;
  "페이지": number | string;
  "호수": string;
  "성명": string;
  "임차인여부": string;
  "생년월일": string;
  "주소": string;
  "연락처": string;
  "신뢰도": string;
  "검토필요": string;
  "비고": string;
  [key: string]: string | number;
}

function generateDetailData(results: ExtractedResolution[]): DetailRow[] {
  // Collect all unique agendas
  const allAgendas = new Set<string>();
  for (const result of results) {
    for (const vote of result.votes) {
      allAgendas.add(vote.agenda);
    }
  }
  const agendaList = Array.from(allAgendas);

  return results.map((result) => {
    const row: DetailRow = {
      "원본파일": result._meta.source_file,
      "페이지": result._meta.page_number ?? "-",
      "호수": result.property_number,
      "성명": result.individual.name,
      "임차인여부": result.individual.is_lessee ? "예" : "아니오",
      "생년월일": result.individual.birth_string,
      "주소": result.individual.residential_address,
      "연락처": result.individual.contact_number,
      "신뢰도": result._meta.confidence,
      "검토필요": result._meta.requires_review ? "예" : "아니오",
      "비고": result._meta.extraction_notes.join("; "),
    };

    // Add vote columns for each agenda
    for (const agenda of agendaList) {
      const vote = result.votes.find((v) => v.agenda === agenda);
      row[`안건: ${agenda}`] = vote ? vote.voted.join(", ") : "-";
    }

    return row;
  });
}

export interface ExportOptions {
  results: ExtractedResolution[];
  filename?: string;
}

export function exportToXlsx({
  results,
  filename = "서면결의서_결과.xlsx",
}: ExportOptions): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary (vote tallies)
  const summaryData = generateSummaryData(results);
  const summaryForExcel = summaryData.map((row) => ({
    "안건": row.agenda,
    "찬성": row.approve,
    "반대": row.reject,
    "기권": row.abstain,
    "기타": row.other,
    "합계": row.total,
  }));
  const summaryWs = XLSX.utils.json_to_sheet(summaryForExcel);

  // Set column widths for summary
  summaryWs["!cols"] = [
    { wch: 50 }, // 안건
    { wch: 10 }, // 찬성
    { wch: 10 }, // 반대
    { wch: 10 }, // 기권
    { wch: 10 }, // 기타
    { wch: 10 }, // 합계
  ];

  XLSX.utils.book_append_sheet(wb, summaryWs, "요약");

  // Sheet 2: Detail (all extracted data)
  const detailData = generateDetailData(results);
  const detailWs = XLSX.utils.json_to_sheet(detailData);

  // Set column widths for detail
  detailWs["!cols"] = [
    { wch: 20 }, // 원본파일
    { wch: 8 },  // 페이지
    { wch: 10 }, // 호수
    { wch: 12 }, // 성명
    { wch: 10 }, // 임차인여부
    { wch: 12 }, // 생년월일
    { wch: 40 }, // 주소
    { wch: 15 }, // 연락처
    { wch: 10 }, // 신뢰도
    { wch: 10 }, // 검토필요
    { wch: 30 }, // 비고
  ];

  XLSX.utils.book_append_sheet(wb, detailWs, "상세");

  // Download file
  XLSX.writeFile(wb, filename);
}

export function generateExportSummary(results: ExtractedResolution[]): {
  total: number;
  needsReview: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
} {
  return {
    total: results.length,
    needsReview: results.filter((r) => r._meta.requires_review).length,
    highConfidence: results.filter((r) => r._meta.confidence === "high").length,
    mediumConfidence: results.filter((r) => r._meta.confidence === "medium").length,
    lowConfidence: results.filter((r) => r._meta.confidence === "low").length,
  };
}
