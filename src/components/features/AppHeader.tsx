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
            <span className={styles.keyIcon}>🔑</span>
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
          <span className={styles.warningIcon}>⚠️</span>
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
