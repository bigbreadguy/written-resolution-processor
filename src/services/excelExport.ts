import * as XLSX from "xlsx";
import type { ExtractedResolution } from "@/types";
import { getConfidenceTag, getConfidenceTagKorean } from "@/utils";
import type { InspectionReport } from "./inspection";

interface VoteTally {
  agenda: string;
  approve: number;
  reject: number;
  abstain: number;
  unmarked: number;
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
          unmarked: 0,
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
      } else if (votedLower.includes("기표안함") || votedLower.includes("unmarked")) {
        tally.unmarked++;
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
  "페이지 수": number;
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

function generateDetailData(
  results: ExtractedResolution[],
  inspectionReport?: InspectionReport
): DetailRow[] {
  // Collect all unique agendas
  const allAgendas = new Set<string>();
  for (const result of results) {
    for (const vote of result.votes) {
      allAgendas.add(vote.agenda);
    }
  }
  const agendaList = Array.from(allAgendas);

  return results.map((result, index) => {
    // Combine extraction notes with inspection notes
    const extractionNotes = result._meta.extraction_notes;
    const inspectionNotes = inspectionReport?.documentNotes.get(index) ?? [];
    const allNotes = [...extractionNotes, ...inspectionNotes];

    const row: DetailRow = {
      "원본파일": result._meta.source_file,
      "페이지 수": result._meta.page_count,
      "호수": result.property_number,
      "성명": result.individual.name,
      "임차인여부": result.individual.is_lessee ? "예" : "아니오",
      "생년월일": result.individual.birth_string,
      "주소": result.individual.residential_address,
      "연락처": result.individual.contact_number,
      "신뢰도": `${result._meta.confidence} (${getConfidenceTagKorean(getConfidenceTag(result._meta.confidence))})`,
      "검토필요": result._meta.requires_review ? "예" : "아니오",
      "비고": allNotes.join("; "),
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
  inspectionReport?: InspectionReport;
  filename?: string;
}

export function exportToXlsx({
  results,
  inspectionReport,
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
    "기표안함": row.unmarked,
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
    { wch: 10 }, // 기표안함
    { wch: 10 }, // 기타
    { wch: 10 }, // 합계
  ];

  XLSX.utils.book_append_sheet(wb, summaryWs, "요약");

  // Sheet 2: Detail (all extracted data with inspection notes in 비고)
  const detailData = generateDetailData(results, inspectionReport);
  const detailWs = XLSX.utils.json_to_sheet(detailData);

  // Set column widths for detail
  detailWs["!cols"] = [
    { wch: 20 }, // 원본파일
    { wch: 10 }, // 페이지 수
    { wch: 10 }, // 호수
    { wch: 12 }, // 성명
    { wch: 10 }, // 임차인여부
    { wch: 12 }, // 생년월일
    { wch: 40 }, // 주소
    { wch: 15 }, // 연락처
    { wch: 10 }, // 신뢰도
    { wch: 10 }, // 검토필요
    { wch: 40 }, // 비고 (wider for inspection notes)
  ];

  XLSX.utils.book_append_sheet(wb, detailWs, "상세");

  // Sheet 3: Inspection Report (검증보고서)
  if (inspectionReport) {
    const inspectionData: Record<string, string | number>[] = [];

    // Summary section
    inspectionData.push({
      "구분": "=== 검증 요약 ===",
      "내용": "",
    });
    inspectionData.push({
      "구분": "총 문서",
      "내용": inspectionReport.summary.totalDocuments,
    });
    inspectionData.push({
      "구분": "정상 문서",
      "내용": inspectionReport.summary.validDocuments,
    });
    inspectionData.push({
      "구분": "이슈 발견",
      "내용": inspectionReport.summary.documentsWithIssues,
    });
    inspectionData.push({
      "구분": "오류",
      "내용": inspectionReport.summary.errorCount,
    });
    inspectionData.push({
      "구분": "경고",
      "내용": inspectionReport.summary.warningCount,
    });
    inspectionData.push({
      "구분": "",
      "내용": "",
    });

    // Findings section
    if (inspectionReport.findings.length > 0) {
      inspectionData.push({
        "구분": "=== 발견 사항 ===",
        "내용": "",
      });

      for (const finding of inspectionReport.findings) {
        const severityLabel =
          finding.severity === "error" ? "[오류]" :
          finding.severity === "warning" ? "[경고]" : "[참고]";
        inspectionData.push({
          "구분": severityLabel,
          "내용": finding.message,
        });
      }
    } else {
      inspectionData.push({
        "구분": "검증 결과",
        "내용": "문제가 발견되지 않았습니다.",
      });
    }

    const inspectionWs = XLSX.utils.json_to_sheet(inspectionData);
    inspectionWs["!cols"] = [
      { wch: 15 }, // 구분
      { wch: 60 }, // 내용
    ];

    XLSX.utils.book_append_sheet(wb, inspectionWs, "검증보고서");
  }

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
    highConfidence: results.filter((r) => getConfidenceTag(r._meta.confidence) === "HIGH").length,
    mediumConfidence: results.filter((r) => getConfidenceTag(r._meta.confidence) === "MEDIUM").length,
    lowConfidence: results.filter((r) => getConfidenceTag(r._meta.confidence) === "LOW").length,
  };
}
