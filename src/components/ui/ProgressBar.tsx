import { type ReactNode } from "react";
import styles from "./ProgressBar.module.css";

export interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showPercentage?: boolean;
  size?: "sm" | "md" | "lg";
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showPercentage = true,
  size = "md",
}: ProgressBarProps): ReactNode {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={styles.wrapper}>
      {label || showPercentage ? (
        <div className={styles.header}>
          {label ? <span className={styles.label}>{label}</span> : null}
          {showPercentage ? (
            <span className={styles.percentage}>{Math.round(percentage)}%</span>
          ) : null}
        </div>
      ) : null}
      <div
        className={`${styles.track} ${styles[size]}`}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        <div
          className={styles.fill}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
