import { type ReactNode, useCallback, useState } from "react";
import { Button, Input } from "@/components/ui";
import { API_KEY_WARNING } from "@/constants";
import styles from "./ApiKeySetup.module.css";

export interface ApiKeySetupProps {
  onSubmit: (apiKey: string) => Promise<boolean>;
  isValidating: boolean;
  error: string | null;
}

export function ApiKeySetup({
  onSubmit,
  isValidating,
  error,
}: ApiKeySetupProps): ReactNode {
  const [inputValue, setInputValue] = useState("");

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value);
    },
    []
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      await onSubmit(inputValue);
    },
    [inputValue, onSubmit]
  );

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
          API 키 발급받기 / Get API Key &rarr;
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
