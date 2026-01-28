import { type ReactNode, useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui";
import { exportToXlsx, generateExportSummary, inspectResults } from "@/services";
import type { ExtractedResolution } from "@/types";
import styles from "./ReviewTable.module.css";

export interface ReviewTableProps {
  results: ExtractedResolution[];
  onSelectResult: (index: number) => void;
  onReset: () => void;
}

type FilterType = "all" | "needs-review" | "low-confidence";

export function ReviewTable({
  results,
  onSelectResult,
  onReset,
}: ReviewTableProps): ReactNode {
  const [filter, setFilter] = useState<FilterType>("all");

  const summary = useMemo(() => generateExportSummary(results), [results]);

  // Run inspection on results
  const inspectionReport = useMemo(() => inspectResults(results), [results]);

  const filteredResults = useMemo(() => {
    switch (filter) {
      case "needs-review":
        return results.filter((r) => r._meta.requires_review);
      case "low-confidence":
        return results.filter((r) => r._meta.confidence === "low");
      default:
        return results;
    }
  }, [results, filter]);

  const handleExport = useCallback(() => {
    exportToXlsx({ results, inspectionReport });
  }, [results, inspectionReport]);

  const getConfidenceClass = (confidence: string): string => {
    switch (confidence) {
      case "high":
        return styles.confidenceHigh ?? "";
      case "medium":
        return styles.confidenceMedium ?? "";
      case "low":
        return styles.confidenceLow ?? "";
      default:
        return "";
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>
            처리 완료
            <span className={styles.titleEn}>Processing Complete</span>
          </h1>
          <p className={styles.summary}>
            전체 {summary.total}개 중 {summary.needsReview}개 검토 필요
          </p>
        </div>
        <div className={styles.headerRight}>
          <Button variant="secondary" onClick={onReset}>
            새 파일 업로드
          </Button>
          <Button onClick={handleExport}>XLSX 내보내기</Button>
        </div>
      </div>

      <div className={styles.stats}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{summary.total}</span>
          <span className={styles.statLabel}>전체</span>
        </div>
        <div className={`${styles.statCard} ${styles.statCardSuccess}`}>
          <span className={styles.statValue}>{summary.highConfidence}</span>
          <span className={styles.statLabel}>높음</span>
        </div>
        <div className={`${styles.statCard} ${styles.statCardWarning}`}>
          <span className={styles.statValue}>{summary.mediumConfidence}</span>
          <span className={styles.statLabel}>보통</span>
        </div>
        <div className={`${styles.statCard} ${styles.statCardError}`}>
          <span className={styles.statValue}>{summary.lowConfidence}</span>
          <span className={styles.statLabel}>낮음</span>
        </div>
      </div>

      {/* Inspection summary */}
      {inspectionReport.findings.length > 0 && (
        <div className={styles.inspectionSummary}>
          <div className={styles.inspectionHeader}>
            <span className={styles.inspectionIcon}>🔍</span>
            <span className={styles.inspectionTitle}>검증 결과</span>
            <span className={styles.inspectionCount}>
              {inspectionReport.summary.errorCount > 0 && (
                <span className={styles.errorCount}>오류 {inspectionReport.summary.errorCount}</span>
              )}
              {inspectionReport.summary.warningCount > 0 && (
                <span className={styles.warningCount}>경고 {inspectionReport.summary.warningCount}</span>
              )}
            </span>
          </div>
          <ul className={styles.inspectionList}>
            {inspectionReport.findings.slice(0, 5).map((finding, idx) => (
              <li key={idx} className={styles[`finding${finding.severity.charAt(0).toUpperCase() + finding.severity.slice(1)}`] ?? ""}>
                {finding.message}
              </li>
            ))}
            {inspectionReport.findings.length > 5 && (
              <li className={styles.findingMore}>
                외 {inspectionReport.findings.length - 5}건 (XLSX에서 전체 확인)
              </li>
            )}
          </ul>
        </div>
      )}

      <div className={styles.filters}>
        <button
          type="button"
          className={`${styles.filterButton} ${filter === "all" ? styles.filterButtonActive : ""}`}
          onClick={() => setFilter("all")}
        >
          전체 ({results.length})
        </button>
        <button
          type="button"
          className={`${styles.filterButton} ${filter === "needs-review" ? styles.filterButtonActive : ""}`}
          onClick={() => setFilter("needs-review")}
        >
          검토 필요 ({summary.needsReview})
        </button>
        <button
          type="button"
          className={`${styles.filterButton} ${filter === "low-confidence" ? styles.filterButtonActive : ""}`}
          onClick={() => setFilter("low-confidence")}
        >
          낮은 신뢰도 ({summary.lowConfidence})
        </button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>원본파일</th>
              <th>호수</th>
              <th>성명</th>
              <th>연락처</th>
              <th>신뢰도</th>
              <th>검토</th>
            </tr>
          </thead>
          <tbody>
            {filteredResults.map((result, index) => {
              const originalIndex = results.indexOf(result);
              return (
                <tr
                  key={`${result._meta.source_file}-${result._meta.page_number ?? index}`}
                  className={result._meta.requires_review ? styles.rowNeedsReview : ""}
                  onClick={() => onSelectResult(originalIndex)}
                >
                  <td>{originalIndex + 1}</td>
                  <td className={styles.cellFileName}>
                    {result._meta.source_file}
                    {result._meta.page_number ? ` (p.${result._meta.page_number})` : ""}
                  </td>
                  <td>{result.property_number}</td>
                  <td>{result.individual.name}</td>
                  <td>{result.individual.contact_number || "-"}</td>
                  <td>
                    <span
                      className={`${styles.confidenceBadge} ${getConfidenceClass(result._meta.confidence)}`}
                    >
                      {result._meta.confidence}
                    </span>
                  </td>
                  <td>
                    {result._meta.requires_review ? (
                      <span className={styles.reviewBadge}>필요</span>
                    ) : (
                      <span className={styles.okBadge}>-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredResults.length === 0 ? (
        <div className={styles.emptyState}>
          해당 조건에 맞는 결과가 없습니다.
        </div>
      ) : null}
    </div>
  );
}
