/**
 * AppHeader Component
 *
 * Fixed header displaying app title and API key status.
 * Provides access to API key manager from any step.
 */

import { type ReactNode } from "react";
import { Button } from "@/components/ui";
import type { ApiKeyEntry } from "@/types";
import styles from "./AppHeader.module.css";

export interface AppHeaderProps {
  apiKeys: ApiKeyEntry[];
  onManageKeys: () => void;
  showKeyWarning?: boolean;
}

export function AppHeader({
  apiKeys,
  onManageKeys,
  showKeyWarning = false,
}: AppHeaderProps): ReactNode {
  const keyCount = apiKeys.length;

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <div className={styles.brand}>
          <h1 className={styles.title}>서면결의서 처리기</h1>
          <span className={styles.subtitle}>Written Resolution Processor</span>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.keyStatus} ${keyCount === 0 ? styles.noKeys : ""}`}
            onClick={onManageKeys}
          >
            <span className={styles.keyIcon} aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </svg>
            </span>
            <span className={styles.keyCount}>
              {keyCount === 0 ? "키 없음" : `${keyCount}개 키`}
            </span>
          </button>

          <Button
            variant="secondary"
            size="sm"
            onClick={onManageKeys}
          >
            관리
          </Button>
        </div>
      </div>

      {showKeyWarning && keyCount === 0 && (
        <div className={styles.warning}>
          <span className={styles.warningIcon} aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </span>
          <span>처리를 시작하려면 API 키가 필요합니다.</span>
          <button
            type="button"
            className={styles.warningLink}
            onClick={onManageKeys}
          >
            키 추가하기
          </button>
        </div>
      )}
    </header>
  );
}
