import { type ReactNode, useCallback, useState } from "react";
import { Button, DropZone } from "@/components/ui";
import { ACCEPTED_FILE_EXTENSIONS, MAX_FILE_SIZE_BYTES } from "@/constants";
import {
  validateFile,
  generateFileId,
  isPdf,
  fileToBase64,
} from "@/utils";
import { parsePdf } from "@/services";
import type { ProcessableFile } from "@/types";
import styles from "./FileUpload.module.css";

export interface FileUploadProps {
  files: ProcessableFile[];
  onFilesChange: (files: ProcessableFile[]) => void;
  onStartProcessing: () => void;
  isProcessing: boolean;
}

export function FileUpload({
  files,
  onFilesChange,
  onStartProcessing,
  isProcessing,
}: FileUploadProps): ReactNode {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFilesSelected = useCallback(
    async (selectedFiles: File[]) => {
      setError(null);
      setIsLoading(true);

      try {
        const newFiles: ProcessableFile[] = [];

        for (const file of selectedFiles) {
          const validation = validateFile(file);

          if (!validation.valid) {
            setError(validation.error ?? "Invalid file");
            continue;
          }

          if (isPdf(file)) {
            // Parse PDF into pages
            try {
              const pdfResult = await parsePdf(file);

              newFiles.push({
                id: generateFileId(),
                originalFile: file,
                thumbnail: pdfResult.pages[0]?.thumbnail ?? null,
                pageCount: pdfResult.totalPages,
                pageBlobs: pdfResult.pages.map((p) => p.blob),
                status: "ready",
              });
            } catch (e) {
              newFiles.push({
                id: generateFileId(),
                originalFile: file,
                thumbnail: null,
                pageCount: 1,
                pageBlobs: [],
                status: "error",
                errorMessage: e instanceof Error ? e.message : "PDF parsing failed",
              });
            }
          } else {
            // Image file
            try {
              const thumbnail = await fileToBase64(file);
              newFiles.push({
                id: generateFileId(),
                originalFile: file,
                thumbnail,
                pageCount: 1,
                pageBlobs: [file],
                status: "ready",
              });
            } catch (e) {
              newFiles.push({
                id: generateFileId(),
                originalFile: file,
                thumbnail: null,
                pageCount: 1,
                pageBlobs: [],
                status: "error",
                errorMessage: e instanceof Error ? e.message : "File read failed",
              });
            }
          }
        }

        onFilesChange([...files, ...newFiles]);
      } finally {
        setIsLoading(false);
      }
    },
    [files, onFilesChange]
  );

  const handleRemoveFile = useCallback(
    (id: string) => {
      onFilesChange(files.filter((f) => f.id !== id));
    },
    [files, onFilesChange]
  );

  const handleClearAll = useCallback(() => {
    onFilesChange([]);
    setError(null);
  }, [onFilesChange]);

  const readyFiles = files.filter((f) => f.status === "ready");
  const errorFiles = files.filter((f) => f.status === "error");

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          파일 업로드
          <span className={styles.titleEn}>File Upload</span>
        </h1>
        <p className={styles.description}>
          서면결의서 이미지 또는 PDF 파일을 업로드하세요.
          <span className={styles.descriptionEn}>
            Upload scanned resolution images or PDF files.
          </span>
        </p>
      </div>

      <DropZone
        onFilesSelected={(files) => { void handleFilesSelected(files); }}
        accept={ACCEPTED_FILE_EXTENSIONS}
        disabled={isLoading || isProcessing}
      >
        <div className={styles.dropZoneContent}>
          <span className={styles.dropZoneIcon} aria-hidden="true">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 16 12 12 8 16" />
              <line x1="12" y1="12" x2="12" y2="21" />
              <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
              <polyline points="16 16 12 12 8 16" />
            </svg>
          </span>
          <span className={styles.dropZoneText}>
            {isLoading ? "파일 처리 중..." : "파일을 여기에 드래그하거나 클릭하세요"}
          </span>
          <span className={styles.dropZoneSubtext}>
            JPEG, PNG, PDF 지원 (최대 {MAX_FILE_SIZE_BYTES / 1024 / 1024}MB)
          </span>
          <span className={styles.dropZoneSubtext}>
            한 파일에 한 건의 서면결의서만 포함해 주세요.
            {" "}Each file should contain only one resolution document.
          </span>
        </div>
      </DropZone>

      {error ? (
        <div className={styles.error} role="alert">
          {error}
        </div>
      ) : null}

      {files.length > 0 ? (
        <div className={styles.fileList}>
          <div className={styles.fileListHeader}>
            <span className={styles.fileCount}>
              업로드된 파일: {readyFiles.length}개
              {errorFiles.length > 0 ? ` (오류: ${errorFiles.length}개)` : ""}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleClearAll}
              disabled={isProcessing}
            >
              전체 삭제
            </Button>
          </div>

          <div className={styles.fileGrid}>
            {files.map((file) => (
                <div
                  key={file.id}
                  className={`${styles.fileCard} ${file.status === "error" ? styles.fileCardError : ""}`}
                >
                  {file.thumbnail ? (
                    <img
                      src={file.thumbnail}
                      alt={file.originalFile.name}
                      className={styles.thumbnail}
                    />
                  ) : (
                    <div className={styles.thumbnailPlaceholder}>
                      {file.status === "error" ? "!" : "?"}
                    </div>
                  )}
                  <div className={styles.fileInfo}>
                    <span className={styles.fileName} title={file.originalFile.name}>
                      {file.originalFile.name}
                      {file.pageCount > 1 ? (
                        <span className={styles.pageIndicator}>
                          {" "}({file.pageCount}페이지)
                        </span>
                      ) : null}
                    </span>
                    {file.errorMessage ? (
                      <span className={styles.fileError}>{file.errorMessage}</span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={() => { handleRemoveFile(file.id); }}
                    disabled={isProcessing}
                    aria-label={`${file.originalFile.name} 삭제`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className={styles.actions}>
        <Button
          onClick={onStartProcessing}
          disabled={readyFiles.length === 0 || isLoading || isProcessing}
          size="lg"
          isLoading={isProcessing}
        >
          {isProcessing
            ? "처리 중..."
            : `처리 시작 (${readyFiles.length}개 파일)`}
        </Button>
      </div>
    </div>
  );
}
