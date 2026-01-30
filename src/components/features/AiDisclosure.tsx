import { type ReactNode, useCallback, useState } from "react";
import { Button } from "@/components/ui";
import { AI_DISCLOSURE_TEXT } from "@/constants";
import styles from "./AiDisclosure.module.css";

export interface AiDisclosureProps {
  onAcknowledge: () => void;
}

export function AiDisclosure({ onAcknowledge }: AiDisclosureProps): ReactNode {
  const [isChecked, setIsChecked] = useState(false);

  const handleCheckboxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setIsChecked(e.target.checked);
    },
    []
  );

  const handleContinue = useCallback(() => {
    if (isChecked) {
      onAcknowledge();
    }
  }, [isChecked, onAcknowledge]);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.iconWrapper}>
          <span className={styles.icon} aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </span>
        </div>

        <h1 className={styles.title}>
          {AI_DISCLOSURE_TEXT.ko.title}
          <span className={styles.titleEn}>{AI_DISCLOSURE_TEXT.en.title}</span>
        </h1>

        <p className={styles.description}>{AI_DISCLOSURE_TEXT.ko.description}</p>
        <p className={styles.descriptionEn}>
          {AI_DISCLOSURE_TEXT.en.description}
        </p>

        <ul className={styles.points}>
          {AI_DISCLOSURE_TEXT.ko.points.map((point, index) => (
            <li key={index} className={styles.point}>
              <span className={styles.checkmark} aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </span>
              <span>
                {point}
                <span className={styles.pointEn}>
                  {AI_DISCLOSURE_TEXT.en.points[index]}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <label className={styles.consentLabel}>
          <input
            type="checkbox"
            checked={isChecked}
            onChange={handleCheckboxChange}
            className={styles.checkbox}
          />
          <span className={styles.consentText}>
            {AI_DISCLOSURE_TEXT.ko.consent}
            <span className={styles.consentTextEn}>
              {AI_DISCLOSURE_TEXT.en.consent}
            </span>
          </span>
        </label>

        <Button
          onClick={handleContinue}
          disabled={!isChecked}
          size="lg"
          className={styles.continueButton}
        >
          {AI_DISCLOSURE_TEXT.ko.continue} / {AI_DISCLOSURE_TEXT.en.continue}
        </Button>
      </div>
    </div>
  );
}
