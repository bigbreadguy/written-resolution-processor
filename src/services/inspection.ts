/**
 * Inspection Service
 *
 * Validates extracted data for data integrity and quality issues.
 * Generates inspection report for review.
 */

import type { ExtractedResolution } from "@/types";
import { isLowConfidence } from "@/utils";

/**
 * Single inspection finding
 */
export interface InspectionFinding {
  /** Severity level */
  severity: "error" | "warning" | "info";
  /** Category of the finding */
  category: "duplicate" | "missing" | "inconsistent" | "quality" | "ambiguous";
  /** Human-readable message in Korean */
  message: string;
  /** Affected property numbers or document indices */
  affectedItems: string[];
}

/**
 * Per-document inspection result
 */
export interface DocumentInspection {
  /** Index in the results array */
  index: number;
  /** Property number */
  propertyNumber: string;
  /** Findings for this document */
  findings: string[];
}

/**
 * Full inspection report
 */
export interface InspectionReport {
  /** Overall inspection summary */
  summary: {
    totalDocuments: number;
    validDocuments: number;
    documentsWithIssues: number;
    errorCount: number;
    warningCount: number;
  };
  /** List of findings */
  findings: InspectionFinding[];
  /** Per-document inspection notes (for Excel 비고 column) */
  documentNotes: Map<number, string[]>;
}

/**
 * Inspect extracted data for issues
 */
export function inspectResults(results: ExtractedResolution[]): InspectionReport {
  const findings: InspectionFinding[] = [];
  const documentNotes = new Map<number, string[]>();

  // Initialize document notes
  results.forEach((_, index) => {
    documentNotes.set(index, []);
  });

  // 1. Check for duplicate property numbers
  const propertyMap = new Map<string, number[]>();
  results.forEach((result, index) => {
    const prop = result.property_number.trim().toLowerCase();
    if (!propertyMap.has(prop)) {
      propertyMap.set(prop, []);
    }
    propertyMap.get(prop)!.push(index);
  });

  for (const [prop, indices] of propertyMap) {
    if (indices.length > 1) {
      const affectedItems = indices.map((i) => results[i]?.property_number ?? `문서 ${i + 1}`);
      findings.push({
        severity: "error",
        category: "duplicate",
        message: `중복 호수 발견: ${prop} (${indices.length}개 문서)`,
        affectedItems,
      });

      // Add to each document's notes
      for (const idx of indices) {
        const notes = documentNotes.get(idx);
        if (notes) {
          notes.push(`중복: ${prop}`);
        }
      }
    }
  }

  // 2. Check for missing votes
  results.forEach((result, index) => {
    const hasNoVotes = result.votes.length === 0;
    const hasAllUnmarked = result.votes.every((v) =>
      v.voted.some((vote) => vote.includes("기표안함") || vote.includes("unmarked"))
    );

    if (hasNoVotes) {
      findings.push({
        severity: "warning",
        category: "missing",
        message: `투표 내용 없음: ${result.property_number}`,
        affectedItems: [result.property_number],
      });
      documentNotes.get(index)?.push("투표 내용 없음");
    } else if (hasAllUnmarked) {
      findings.push({
        severity: "info",
        category: "missing",
        message: `모든 안건 기표안함: ${result.property_number}`,
        affectedItems: [result.property_number],
      });
      documentNotes.get(index)?.push("모든 안건 기표안함");
    }
  });

  // 3. Check for inconsistent names (same property, different names)
  const propertyNameMap = new Map<string, Set<string>>();
  results.forEach((result) => {
    const prop = result.property_number.trim().toLowerCase();
    if (!propertyNameMap.has(prop)) {
      propertyNameMap.set(prop, new Set());
    }
    propertyNameMap.get(prop)!.add(result.individual.name.trim());
  });

  for (const [prop, names] of propertyNameMap) {
    if (names.size > 1) {
      findings.push({
        severity: "warning",
        category: "inconsistent",
        message: `동일 호수 다른 이름: ${prop} (${Array.from(names).join(", ")})`,
        affectedItems: Array.from(names),
      });

      // Add to relevant documents
      results.forEach((result, index) => {
        if (result.property_number.trim().toLowerCase() === prop) {
          documentNotes.get(index)?.push(`이름 불일치: ${Array.from(names).join("/")}`);
        }
      });
    }
  }

  // 4. Check for low confidence items
  results.forEach((result, index) => {
    if (isLowConfidence(result._meta.confidence)) {
      findings.push({
        severity: "warning",
        category: "quality",
        message: `낮은 신뢰도 (${result._meta.confidence}점): ${result.property_number}`,
        affectedItems: [result.property_number],
      });
      documentNotes.get(index)?.push(`낮은 신뢰도 (${result._meta.confidence}점)`);
    }
  });

  // 5. Check for ambiguous votes (multiple marks mentioned in notes)
  results.forEach((result, index) => {
    const notes = result._meta.extraction_notes.join(" ").toLowerCase();
    if (notes.includes("복수") || notes.includes("multiple") || notes.includes("ambiguous")) {
      findings.push({
        severity: "warning",
        category: "ambiguous",
        message: `복수 표시 감지: ${result.property_number}`,
        affectedItems: [result.property_number],
      });
      documentNotes.get(index)?.push("복수 표시 의심");
    }
  });

  // 6. Check for required review items
  const needsReviewCount = results.filter((r) => r._meta.requires_review).length;
  if (needsReviewCount > 0) {
    findings.push({
      severity: "info",
      category: "quality",
      message: `검토 필요 항목: ${needsReviewCount}개`,
      affectedItems: results
        .filter((r) => r._meta.requires_review)
        .map((r) => r.property_number),
    });
  }

  // 7. Check for unclear/illegible fields marked as [불명]
  const UNCLEAR_MARKER = "[불명]";
  results.forEach((result, index) => {
    const fieldsToCheck = [
      result.document_title,
      result.property_number,
      result.individual.name,
      result.individual.birth_string,
      result.individual.residential_address,
      result.individual.contact_number,
      ...result.votes.flatMap((v) => v.voted),
    ];

    const hasUnclearFields = fieldsToCheck.some((field) =>
      field.includes(UNCLEAR_MARKER)
    );

    if (hasUnclearFields) {
      findings.push({
        severity: "warning",
        category: "quality",
        message: `판독 불가 항목 발견: ${result.property_number}`,
        affectedItems: [result.property_number],
      });
      documentNotes.get(index)?.push("판독 불가 항목");
    }
  });

  // Calculate summary
  const documentsWithIssues = new Set<number>();
  for (const [index, notes] of documentNotes) {
    if (notes.length > 0) {
      documentsWithIssues.add(index);
    }
  }

  const errorCount = findings.filter((f) => f.severity === "error").length;
  const warningCount = findings.filter((f) => f.severity === "warning").length;

  return {
    summary: {
      totalDocuments: results.length,
      validDocuments: results.length - documentsWithIssues.size,
      documentsWithIssues: documentsWithIssues.size,
      errorCount,
      warningCount,
    },
    findings,
    documentNotes,
  };
}

/**
 * Format inspection findings for display
 */
export function formatFindingsForDisplay(report: InspectionReport): string[] {
  const lines: string[] = [];

  lines.push(`=== 검증 보고서 ===`);
  lines.push(`총 문서: ${report.summary.totalDocuments}개`);
  lines.push(`정상: ${report.summary.validDocuments}개`);
  lines.push(`이슈 발견: ${report.summary.documentsWithIssues}개`);
  lines.push(``);

  if (report.findings.length === 0) {
    lines.push(`문제가 발견되지 않았습니다.`);
  } else {
    const errors = report.findings.filter((f) => f.severity === "error");
    const warnings = report.findings.filter((f) => f.severity === "warning");
    const infos = report.findings.filter((f) => f.severity === "info");

    if (errors.length > 0) {
      lines.push(`[오류] (${errors.length}건)`);
      errors.forEach((f) => lines.push(`  - ${f.message}`));
      lines.push(``);
    }

    if (warnings.length > 0) {
      lines.push(`[경고] (${warnings.length}건)`);
      warnings.forEach((f) => lines.push(`  - ${f.message}`));
      lines.push(``);
    }

    if (infos.length > 0) {
      lines.push(`[참고] (${infos.length}건)`);
      infos.forEach((f) => lines.push(`  - ${f.message}`));
    }
  }

  return lines;
}

/**
 * Get inspection note for a specific document (for Excel 비고 column)
 */
export function getDocumentInspectionNote(
  report: InspectionReport,
  index: number,
  existingNotes: string[]
): string {
  const inspectionNotes = report.documentNotes.get(index) ?? [];
  const allNotes = [...existingNotes, ...inspectionNotes];
  return allNotes.join("; ");
}
