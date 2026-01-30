import { type ReactNode, useCallback, useReducer, useRef, useState } from "react";
import {
  AiDisclosure,
  ApiKeyManager,
  AppHeader,
  FileUpload,
  ProcessingView,
  ReviewTable,
  DetailModal,
} from "@/components/features";
import { useApiKeys, useAiAcknowledgment } from "@/hooks";
import { processFiles } from "@/services";
import { blobToBase64, getBase64Data, getMimeTypeFromBase64 } from "@/utils";
import type {
  AppState,
  AppAction,
  ProcessableFile,
  ExtractedResolution,
  ProcessingProgressExtended,
} from "@/types";
import styles from "./App.module.css";

const initialState: AppState = {
  step: "landing",
  apiKeys: [],
  hasAcknowledgedAI: false,
  files: [],
  processingProgress: null,
  results: [],
  selectedResultIndex: null,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "ACKNOWLEDGE_AI":
      return {
        ...state,
        hasAcknowledgedAI: true,
        step: "upload",
      };
    case "SET_API_KEYS":
      return {
        ...state,
        apiKeys: action.payload,
      };
    case "CLEAR_API_KEYS":
      return {
        ...state,
        apiKeys: [],
      };
    case "GO_TO_STEP":
      return {
        ...state,
        step: action.payload,
      };
    case "ADD_FILES":
      return {
        ...state,
        files: [...state.files, ...action.payload],
      };
    case "REMOVE_FILE":
      return {
        ...state,
        files: state.files.filter((f) => f.id !== action.payload),
      };
    case "CLEAR_FILES":
      return {
        ...state,
        files: [],
      };
    case "START_PROCESSING":
      return {
        ...state,
        step: "processing",
        processingProgress: {
          total: 0,
          completed: 0,
          failed: 0,
          currentBatch: 0,
          totalBatches: 0,
          statuses: new Map(),
          keyStatuses: [],
          isWaitingForKey: false,
          waitTimeMs: 0,
        },
      };
    case "UPDATE_PROGRESS":
      return {
        ...state,
        processingProgress: action.payload,
      };
    case "PROCESSING_COMPLETE":
      return {
        ...state,
        step: "review",
        results: action.payload,
        processingProgress: null,
      };
    case "PROCESSING_ERROR":
      return {
        ...state,
        step: "upload",
        processingProgress: null,
      };
    case "UPDATE_RESULT":
      return {
        ...state,
        results: state.results.map((r, i) =>
          i === action.payload.index
            ? { ...r, ...action.payload.data }
            : r
        ),
      };
    case "SELECT_RESULT":
      return {
        ...state,
        selectedResultIndex: action.payload,
      };
    case "RESET":
      return {
        ...initialState,
        hasAcknowledgedAI: state.hasAcknowledgedAI,
        apiKeys: state.apiKeys,
        step: "upload",
      };
    default:
      return state;
  }
}

export function App(): ReactNode {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const {
    apiKeys,
    isValidating,
    error,
    addApiKey,
    removeApiKey,
    updateApiKey,
  } = useApiKeys();
  const { hasAcknowledged, acknowledge } = useAiAcknowledgment();
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isKeyManagerOpen, setIsKeyManagerOpen] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);

  // Sync external state with reducer
  // Non-blocking: users can proceed to upload even without keys
  const effectiveState: AppState = {
    ...state,
    apiKeys,
    hasAcknowledgedAI: hasAcknowledged,
    step: !hasAcknowledged
      ? "landing"
      : state.step === "landing"
        ? "upload"
        : state.step,
  };

  // Determine if we should show key warning (on upload with no keys)
  const showKeyWarning = effectiveState.step === "upload" && apiKeys.length === 0;

  const handleAcknowledge = useCallback(() => {
    acknowledge();
    dispatch({ type: "ACKNOWLEDGE_AI" });
  }, [acknowledge]);

  const handleAddApiKey = useCallback(
    async (key: string, tier: import("@/types").ApiTier, label?: string): Promise<boolean> => {
      const success = await addApiKey(key, tier, label);
      return success;
    },
    [addApiKey]
  );

  const handleFilesChange = useCallback((files: ProcessableFile[]) => {
    setProcessingError(null);
    dispatch({ type: "CLEAR_FILES" });
    dispatch({ type: "ADD_FILES", payload: files });
  }, []);

  const handleStartProcessing = useCallback(async () => {
    if (effectiveState.apiKeys.length === 0) {
      // No keys - open key manager instead
      setIsKeyManagerOpen(true);
      return;
    }

    const readyFiles = effectiveState.files.filter((f) => f.status === "ready");
    if (readyFiles.length === 0) return;

    dispatch({ type: "START_PROCESSING" });

    abortControllerRef.current = new AbortController();

    try {
      // Convert files to image inputs (one ImageInput per file, with all pages)
      const images = await Promise.all(
        readyFiles.map(async (file) => {
          const pages = await Promise.all(
            file.pageBlobs.map(async (blob) => {
              const base64 = await blobToBase64(blob);
              return {
                mimeType: getMimeTypeFromBase64(base64),
                base64Data: getBase64Data(base64),
              };
            })
          );
          return {
            id: file.id,
            sourceFile: file.originalFile.name,
            pageCount: file.pageCount,
            pages,
          };
        })
      );

      const results = await processFiles({
        apiKeys: effectiveState.apiKeys,
        images,
        onProgress: (progress: ProcessingProgressExtended) => {
          dispatch({ type: "UPDATE_PROGRESS", payload: progress });
        },
        signal: abortControllerRef.current.signal,
      });

      dispatch({ type: "PROCESSING_COMPLETE", payload: results });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        // User cancelled
        dispatch({ type: "PROCESSING_ERROR", payload: "Cancelled" });
      } else {
        const errorMessage = e instanceof Error ? e.message : "Unknown error";
        dispatch({ type: "PROCESSING_ERROR", payload: errorMessage });
        setProcessingError(errorMessage);
      }
    } finally {
      abortControllerRef.current = null;
    }
  }, [effectiveState.apiKeys, effectiveState.files]);

  const handleCancelProcessing = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleSelectResult = useCallback((index: number) => {
    dispatch({ type: "SELECT_RESULT", payload: index });
  }, []);

  const handleCloseDetail = useCallback(() => {
    dispatch({ type: "SELECT_RESULT", payload: null });
  }, []);

  const handleUpdateResult = useCallback((updated: ExtractedResolution) => {
    if (effectiveState.selectedResultIndex !== null) {
      dispatch({
        type: "UPDATE_RESULT",
        payload: { index: effectiveState.selectedResultIndex, data: updated },
      });
    }
  }, [effectiveState.selectedResultIndex]);

  const handleReset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  const selectedResult =
    effectiveState.selectedResultIndex !== null
      ? effectiveState.results[effectiveState.selectedResultIndex]
      : null;

  const handleOpenKeyManager = useCallback(() => {
    setIsKeyManagerOpen(true);
  }, []);

  return (
    <div className={styles.app}>
      {effectiveState.step === "landing" && (
        <AiDisclosure onAcknowledge={handleAcknowledge} />
      )}

      {effectiveState.step !== "landing" && (
        <AppHeader
          apiKeys={effectiveState.apiKeys}
          onManageKeys={handleOpenKeyManager}
          showKeyWarning={showKeyWarning}
        />
      )}

      {effectiveState.step === "upload" && (
        <>
          {processingError ? (
            <div className={styles.errorBanner} role="alert">
              <span className={styles.errorIcon} aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </span>
              <span className={styles.errorText}>
                처리 중 오류가 발생했습니다: {processingError}
              </span>
              <button
                type="button"
                className={styles.errorDismiss}
                onClick={() => { setProcessingError(null); }}
                aria-label="오류 메시지 닫기"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ) : null}
          <FileUpload
            files={effectiveState.files}
            onFilesChange={handleFilesChange}
            onStartProcessing={handleStartProcessing}
            isProcessing={false}
          />
        </>
      )}

      {effectiveState.step === "processing" && effectiveState.processingProgress && (
        <ProcessingView
          progress={effectiveState.processingProgress}
          onCancel={handleCancelProcessing}
        />
      )}

      {effectiveState.step === "review" && (
        <ReviewTable
          results={effectiveState.results}
          onSelectResult={handleSelectResult}
          onReset={handleReset}
        />
      )}

      {selectedResult && (
        <DetailModal
          result={selectedResult}
          isOpen={effectiveState.selectedResultIndex !== null}
          onClose={handleCloseDetail}
          onUpdate={handleUpdateResult}
        />
      )}

      <ApiKeyManager
        apiKeys={effectiveState.apiKeys}
        isOpen={isKeyManagerOpen}
        onClose={() => { setIsKeyManagerOpen(false); }}
        onAddKey={handleAddApiKey}
        onRemoveKey={removeApiKey}
        onUpdateKey={updateApiKey}
        isValidating={isValidating}
        error={error}
      />
    </div>
  );
}
