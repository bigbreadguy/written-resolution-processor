import { type ReactNode } from "react";
import { Button, ProgressBar } from "@/components/ui";
import type { ProcessingProgress } from "@/types";
import styles from "./ProcessingView.module.css";

export interface ProcessingViewProps {
  progress: ProcessingProgress;
  onCancel: () => void;
}

export function ProcessingView({
  progress,
  onCancel,
}: ProcessingViewProps): ReactNode {
  const statusCounts = {
    pending: 0,
    processing: 0,
    done: 0,
    error: 0,
  };

  for (const status of progress.statuses.values()) {
    statusCounts[status.state]++;
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>
          처리 중...
          <span className={styles.titleEn}>Processing...</span>
        </h1>

        <div className={styles.progressSection}>
          <ProgressBar
            value={progress.completed}
            max={progress.total}
            label={`${progress.completed} / ${progress.total} 파일 완료`}
            size="lg"
          />
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{statusCounts.done}</span>
            <span className={styles.statLabel}>완료</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{statusCounts.processing}</span>
            <span className={styles.statLabel}>처리 중</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{statusCounts.pending}</span>
            <span className={styles.statLabel}>대기</span>
          </div>
          {statusCounts.error > 0 ? (
            <div className={`${styles.stat} ${styles.statError}`}>
              <span className={styles.statValue}>{statusCounts.error}</span>
              <span className={styles.statLabel}>오류</span>
            </div>
          ) : null}
        </div>

        <div className={styles.batchInfo}>
          배치 {progress.currentBatch} / {progress.totalBatches}
        </div>

        <div className={styles.actions}>
          <Button variant="secondary" onClick={onCancel}>
            취소
          </Button>
        </div>
      </div>
    </div>
  );
}
