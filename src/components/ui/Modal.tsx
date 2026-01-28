import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
} from "react";
import styles from "./Modal.module.css";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
}: ModalProps): ReactNode {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      dialog.showModal();
    } else {
      dialog.close();
      previousActiveElement.current?.focus();
    }
  }, [isOpen]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) {
        onClose();
      }
    },
    [onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDialogElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className={`${styles.modal} ${styles[size]}`}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      aria-labelledby={title ? "modal-title" : undefined}
    >
      <div className={styles.content}>
        {title ? (
          <header className={styles.header}>
            <h2 id="modal-title" className={styles.title}>
              {title}
            </h2>
            <button
              type="button"
              className={styles.closeButton}
              onClick={onClose}
              aria-label="닫기"
            >
              &times;
            </button>
          </header>
        ) : null}
        <div className={styles.body}>{children}</div>
      </div>
    </dialog>
  );
}
