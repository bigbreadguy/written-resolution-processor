/**
 * ApiKeySetup Component
 *
 * Initial setup screen for adding the first API key.
 * Supports adding multiple keys with tier selection.
 */

import { type ReactNode, useCallback, useState } from "react";
import { Button, Input } from "@/components/ui";
import { API_KEY_WARNING, TIER_LABELS } from "@/constants";
import { maskKey } from "@/utils";
import type { ApiKeyEntry, ApiTier } from "@/types";
import styles from "./ApiKeySetup.module.css";

export interface ApiKeySetupProps {
  apiKeys: ApiKeyEntry[];
  onAddKey: (key: string, tier: ApiTier, label?: string) => Promise<boolean>;
  onContinue: () => void;
  isValidating: boolean;
  error: string | null;
}

const TIERS: ApiTier[] = ["free", "tier1", "tier2"];

export function ApiKeySetup({
  apiKeys,
  onAddKey,
  onContinue,
  isValidating,
  error,
}: ApiKeySetupProps): ReactNode {
  const [inputValue, setInputValue] = useState("");
  const [selectedTier, setSelectedTier] = useState<ApiTier>("free");
  const [showAddMore, setShowAddMore] = useState(false);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value);
    },
    []
  );

  const handleTierChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedTier(e.target.value as ApiTier);
    },
    []
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const success = await onAddKey(inputValue, selectedTier);
      if (success) {
        setInputValue("");
        setShowAddMore(true);
      }
    },
    [inputValue, selectedTier, onAddKey]
  );

  const handleAddAnother = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const success = await onAddKey(inputValue, selectedTier);
      if (success) {
        setInputValue("");
      }
    },
    [inputValue, selectedTier, onAddKey]
  );

  // If we have keys, show the "add more" or "continue" state
  if (apiKeys.length > 0 && showAddMore) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.title}>
            API 키 등록 완료
            <span className={styles.titleEn}>API Key Registered</span>
          </h1>

          <div className={styles.registeredKeys}>
            <p className={styles.registeredLabel}>등록된 키:</p>
            {apiKeys.map((key, index) => (
              <div key={key.id} className={styles.registeredKey}>
                <span>{index + 1}. {maskKey(key.key)}</span>
                <span className={styles.tierBadge}>
                  {TIER_LABELS[key.tier].ko}
                </span>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddAnother} className={styles.addMoreForm}>
            <p className={styles.addMoreLabel}>추가 키 등록 (선택사항):</p>
            <div className={styles.inputRow}>
              <Input
                type="password"
                value={inputValue}
                onChange={handleInputChange}
                placeholder="AIza..."
                error={error ?? undefined}
                disabled={isValidating}
                autoComplete="off"
              />
              <select
                className={styles.tierSelect}
                value={selectedTier}
                onChange={handleTierChange}
                disabled={isValidating}
              >
                {TIERS.map((tier) => (
                  <option key={tier} value={tier}>
                    {TIER_LABELS[tier].ko}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.addMoreActions}>
              <Button
                type="submit"
                variant="secondary"
                isLoading={isValidating}
                disabled={!inputValue.trim()}
              >
                키 추가
              </Button>
              <Button type="button" onClick={onContinue} size="lg">
                계속하기 ({apiKeys.length}개 키로 시작)
              </Button>
            </div>
          </form>

          <p className={styles.addMoreHint}>
            여러 키를 등록하면 한도 초과 시 자동으로 전환됩니다.
          </p>
        </div>
      </div>
    );
  }

  // Initial key setup form
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>
          Gemini API 키 입력
          <span className={styles.titleEn}>Enter Gemini API Key</span>
        </h1>

        <p className={styles.description}>
          서면결의서 처리를 위해 Google Gemini API 키가 필요합니다.
        </p>
        <p className={styles.descriptionEn}>
          A Google Gemini API key is required to process written resolutions.
        </p>

        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.getKeyLink}
        >
          API 키 발급받기 / Get API Key →
        </a>

        <form onSubmit={handleSubmit} className={styles.form}>
          <Input
            label="API Key"
            type="password"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="AIza..."
            error={error ?? undefined}
            disabled={isValidating}
            autoComplete="off"
          />

          <div className={styles.tierSection}>
            <label className={styles.tierLabel}>
              Tier 선택
              <span className={styles.tierLabelHint}>(요금제에 맞게 선택)</span>
            </label>
            <select
              className={styles.tierSelect}
              value={selectedTier}
              onChange={handleTierChange}
              disabled={isValidating}
            >
              {TIERS.map((tier) => (
                <option key={tier} value={tier}>
                  {TIER_LABELS[tier].ko} - {TIER_LABELS[tier].en}
                </option>
              ))}
            </select>
            <p className={styles.tierHint}>
              무료 계정은 Free, 유료 결제 시 Tier 1/2를 선택하세요.
            </p>
          </div>

          <Button
            type="submit"
            isLoading={isValidating}
            disabled={!inputValue.trim()}
            size="lg"
            className={styles.submitButton}
          >
            {isValidating ? "확인 중..." : "키 저장 및 계속"}
          </Button>
        </form>

        <div className={styles.warning}>
          <h3 className={styles.warningTitle}>
            {API_KEY_WARNING.ko.title}
            <span className={styles.warningTitleEn}>
              {API_KEY_WARNING.en.title}
            </span>
          </h3>
          <ul className={styles.warningPoints}>
            {API_KEY_WARNING.ko.points.map((point, index) => (
              <li key={index} className={styles.warningPoint}>
                {point}
                <span className={styles.warningPointEn}>
                  {API_KEY_WARNING.en.points[index]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
