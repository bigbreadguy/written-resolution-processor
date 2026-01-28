/**
 * ApiKeyManager Component
 *
 * UI for managing multiple API keys with tier selection.
 * Shows rate limit status for each key.
 */

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { Button, Input, Modal } from "@/components/ui";
import { TIER_LABELS, TIER_LIMITS } from "@/constants";
import { getRateLimiter, type KeyStatus } from "@/services/rateLimiter";
import type { ApiKeyEntry, ApiTier } from "@/types";
import styles from "./ApiKeyManager.module.css";

export interface ApiKeyManagerProps {
  apiKeys: ApiKeyEntry[];
  isOpen: boolean;
  onClose: () => void;
  onAddKey: (key: string, tier: ApiTier, label?: string) => Promise<boolean>;
  onRemoveKey: (keyId: string) => void;
  onUpdateKey: (keyId: string, updates: { tier?: ApiTier; label?: string }) => void;
  isValidating: boolean;
  error: string | null;
}

const TIERS: ApiTier[] = ["free", "tier1", "tier2"];

export function ApiKeyManager({
  apiKeys,
  isOpen,
  onClose,
  onAddKey,
  onRemoveKey,
  onUpdateKey,
  isValidating,
  error,
}: ApiKeyManagerProps): ReactNode {
  const [newKey, setNewKey] = useState("");
  const [newTier, setNewTier] = useState<ApiTier>("free");
  const [newLabel, setNewLabel] = useState("");
  const [keyStatuses, setKeyStatuses] = useState<KeyStatus[]>([]);

  // Update key statuses periodically
  useEffect(() => {
    if (!isOpen || apiKeys.length === 0) return;

    const updateStatuses = (): void => {
      const rateLimiter = getRateLimiter(apiKeys);
      setKeyStatuses(rateLimiter.getKeyStatuses());
    };

    updateStatuses();
    const interval = setInterval(updateStatuses, 1000);

    return () => clearInterval(interval);
  }, [isOpen, apiKeys]);

  const handleAddKey = useCallback(async () => {
    const success = await onAddKey(newKey, newTier, newLabel || undefined);
    if (success) {
      setNewKey("");
      setNewTier("free");
      setNewLabel("");
    }
  }, [newKey, newTier, newLabel, onAddKey]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && newKey.trim()) {
        void handleAddKey();
      }
    },
    [handleAddKey, newKey]
  );

  const maskKey = (key: string): string => {
    if (key.length <= 12) return key;
    return `${key.slice(0, 8)}...${key.slice(-4)}`;
  };

  const getStatusForKey = (keyId: string): KeyStatus | undefined => {
    return keyStatuses.find((s) => s.keyId === keyId);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="API 키 관리" size="lg">
      <div className={styles.container}>
        {/* Info banner */}
        <div className={styles.infoBanner}>
          <p className={styles.infoText}>
            서로 다른 Google Cloud 프로젝트의 키를 등록하면 한도가 합산됩니다.
          </p>
          <p className={styles.infoTextEn}>
            Keys from different Google Cloud projects have separate quotas.
          </p>
        </div>

        {/* Existing keys */}
        {apiKeys.length > 0 ? (
          <div className={styles.keyList}>
            <h3 className={styles.sectionTitle}>
              등록된 키 ({apiKeys.length}개)
            </h3>
            {apiKeys.map((keyEntry, index) => {
              const status = getStatusForKey(keyEntry.id);
              const limits = TIER_LIMITS[keyEntry.tier];

              return (
                <div key={keyEntry.id} className={styles.keyItem}>
                  <div className={styles.keyHeader}>
                    <span className={styles.keyIndex}>{index + 1}.</span>
                    <span className={styles.keyValue}>
                      {maskKey(keyEntry.key)}
                    </span>
                    {keyEntry.label ? (
                      <span className={styles.keyLabel}>{keyEntry.label}</span>
                    ) : null}
                  </div>

                  <div className={styles.keyDetails}>
                    <select
                      className={styles.tierSelect}
                      value={keyEntry.tier}
                      onChange={(e) =>
                        onUpdateKey(keyEntry.id, {
                          tier: e.target.value as ApiTier,
                        })
                      }
                    >
                      {TIERS.map((tier) => (
                        <option key={tier} value={tier}>
                          {TIER_LABELS[tier].ko}
                        </option>
                      ))}
                    </select>

                    {status ? (
                      <span
                        className={`${styles.keyStatus} ${status.isAvailable ? styles.available : styles.unavailable}`}
                      >
                        {status.availableTokens}/{status.maxTokens} RPM
                        {limits.rpd !== null
                          ? ` · ${status.dailyUsed}/${limits.rpd} 일일`
                          : ""}
                      </span>
                    ) : null}

                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => onRemoveKey(keyEntry.id)}
                      className={styles.removeButton}
                    >
                      삭제
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            등록된 API 키가 없습니다. 아래에서 키를 추가하세요.
          </div>
        )}

        {/* Add new key form */}
        <div className={styles.addSection}>
          <h3 className={styles.sectionTitle}>새 키 추가</h3>

          <div className={styles.addForm}>
            <div className={styles.addInputs}>
              <Input
                placeholder="AIza..."
                type="password"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isValidating}
                className={styles.keyInput}
              />

              <select
                className={styles.tierSelectNew}
                value={newTier}
                onChange={(e) => setNewTier(e.target.value as ApiTier)}
                disabled={isValidating}
              >
                {TIERS.map((tier) => (
                  <option key={tier} value={tier}>
                    {TIER_LABELS[tier].ko}
                  </option>
                ))}
              </select>

              <Input
                placeholder="라벨 (선택)"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isValidating}
                className={styles.labelInput}
              />
            </div>

            <Button
              onClick={handleAddKey}
              disabled={!newKey.trim() || isValidating}
              isLoading={isValidating}
            >
              추가
            </Button>
          </div>

          {error ? (
            <div className={styles.error} role="alert">
              {error}
            </div>
          ) : null}

          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.getKeyLink}
          >
            API 키 발급받기 / Get API Key →
          </a>
        </div>

        {/* Tier info */}
        <div className={styles.tierInfo}>
          <h4 className={styles.tierInfoTitle}>Tier 정보</h4>
          <ul className={styles.tierInfoList}>
            <li>
              <strong>Free:</strong> 15 RPM, 250 요청/일 (무료)
            </li>
            <li>
              <strong>Tier 1:</strong> 1,000 RPM, 10,000 요청/일 (유료)
            </li>
            <li>
              <strong>Tier 2:</strong> 2,000 RPM, 무제한 (기업용)
            </li>
          </ul>
          <p className={styles.tierInfoNote}>
            * 일일 한도는 태평양 시간(PT) 자정에 초기화됩니다.
          </p>
        </div>
      </div>
    </Modal>
  );
}
