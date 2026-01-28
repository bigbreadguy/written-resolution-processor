import { type ReactNode, useCallback, useEffect, useState } from "react";
import { Button, Input, Modal } from "@/components/ui";
import type { ExtractedResolution } from "@/types";
import styles from "./DetailModal.module.css";

export interface DetailModalProps {
  result: ExtractedResolution;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedResult: ExtractedResolution) => void;
}

export function DetailModal({
  result,
  isOpen,
  onClose,
  onUpdate,
}: DetailModalProps): ReactNode {
  const [editedResult, setEditedResult] = useState(result);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync state with prop when result changes (e.g., switching between items)
  useEffect(() => {
    setEditedResult(result);
    setHasChanges(false);
  }, [result]);

  const handleFieldChange = useCallback(
    (field: string, value: string | boolean) => {
      setHasChanges(true);
      setEditedResult((prev) => {
        if (field.startsWith("individual.")) {
          const individualField = field.replace("individual.", "");
          return {
            ...prev,
            individual: {
              ...prev.individual,
              [individualField]: value,
            },
          };
        }
        return {
          ...prev,
          [field]: value,
        };
      });
    },
    []
  );

  const handleVoteChange = useCallback(
    (voteIndex: number, newVoted: string[]) => {
      setHasChanges(true);
      setEditedResult((prev) => ({
        ...prev,
        votes: prev.votes.map((vote, i) =>
          i === voteIndex ? { ...vote, voted: newVoted } : vote
        ),
      }));
    },
    []
  );

  const handleSave = useCallback(() => {
    onUpdate({
      ...editedResult,
      _meta: {
        ...editedResult._meta,
        // After manual review, mark as reviewed
        requires_review: false,
      },
    });
    setHasChanges(false);
    onClose();
  }, [editedResult, onUpdate, onClose]);

  const handleCancel = useCallback(() => {
    setEditedResult(result);
    setHasChanges(false);
    onClose();
  }, [result, onClose]);

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} title="상세 보기" size="lg">
      <div className={styles.content}>
        <div className={styles.metaInfo}>
          <span className={styles.metaItem}>
            원본: {result._meta.source_file}
            {result._meta.page_number ? ` (p.${result._meta.page_number})` : ""}
          </span>
          <span
            className={`${styles.confidenceBadge} ${styles[`confidence${result._meta.confidence.charAt(0).toUpperCase()}${result._meta.confidence.slice(1)}`]}`}
          >
            신뢰도: {result._meta.confidence}
          </span>
        </div>

        {result._meta.extraction_notes.length > 0 ? (
          <div className={styles.notes}>
            <strong>추출 메모:</strong>
            <ul>
              {result._meta.extraction_notes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>기본 정보</h3>
          <div className={styles.fieldGrid}>
            <Input
              label="문서 제목"
              value={editedResult.document_title}
              onChange={(e) =>
                handleFieldChange("document_title", e.target.value)
              }
            />
            <Input
              label="호수"
              value={editedResult.property_number}
              onChange={(e) =>
                handleFieldChange("property_number", e.target.value)
              }
            />
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>개인 정보</h3>
          <div className={styles.fieldGrid}>
            <Input
              label="성명"
              value={editedResult.individual.name}
              onChange={(e) =>
                handleFieldChange("individual.name", e.target.value)
              }
            />
            <Input
              label="생년월일"
              value={editedResult.individual.birth_string}
              onChange={(e) =>
                handleFieldChange("individual.birth_string", e.target.value)
              }
            />
            <Input
              label="연락처"
              value={editedResult.individual.contact_number}
              onChange={(e) =>
                handleFieldChange("individual.contact_number", e.target.value)
              }
            />
            <div className={styles.checkboxField}>
              <label>
                <input
                  type="checkbox"
                  checked={editedResult.individual.is_lessee}
                  onChange={(e) =>
                    handleFieldChange("individual.is_lessee", e.target.checked)
                  }
                />
                임차인 여부
              </label>
            </div>
          </div>
          <Input
            label="주소"
            value={editedResult.individual.residential_address}
            onChange={(e) =>
              handleFieldChange("individual.residential_address", e.target.value)
            }
          />
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>투표 내용</h3>
          {editedResult.votes.map((vote, index) => (
            <div key={index} className={styles.voteItem}>
              <div className={styles.voteAgenda}>
                <strong>안건 {index + 1}:</strong> {vote.agenda}
              </div>
              <div className={styles.voteOptions}>
                {vote.options.length > 0 ? (
                  vote.options.map((option) => (
                    <label key={option} className={styles.voteOption}>
                      <input
                        type="checkbox"
                        checked={vote.voted.includes(option)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            handleVoteChange(index, [...vote.voted, option]);
                          } else {
                            handleVoteChange(
                              index,
                              vote.voted.filter((v) => v !== option)
                            );
                          }
                        }}
                      />
                      {option}
                    </label>
                  ))
                ) : (
                  <Input
                    label="투표 결과"
                    value={vote.voted.join(", ")}
                    onChange={(e) =>
                      handleVoteChange(
                        index,
                        e.target.value.split(",").map((v) => v.trim())
                      )
                    }
                  />
                )}
              </div>
              <div className={styles.voteResult}>
                현재 선택: <strong>{vote.voted.join(", ") || "(없음)"}</strong>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.actions}>
          <Button variant="secondary" onClick={handleCancel}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges}>
            {hasChanges ? "변경사항 저장" : "저장됨"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
