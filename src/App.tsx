import { type ReactNode, useCallback, useReducer, useRef } from "react";
import {
  AiDisclosure,
  ApiKeySetup,
  FileUpload,
  ProcessingView,
  ReviewTable,
  DetailModal,
} from "@/components/features";
import { useApiKey, useAiAcknowledgment } from "@/hooks";
import { processFiles } from "@/services";
import { blobToBase64, getBase64Data, getMimeTypeFromBase64 } from "@/utils";
import type {
  AppState,
  AppAction,
  ProcessableFile,
  ExtractedResolution,
  ProcessingProgress,
} from "@/types";
import styles from "./App.module.css";

const initialState: AppState = {
  step: "landing",
  apiKey: null,
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
        step: state.apiKey ? "upload" : "api-key-setup",
      };
    case "SET_API_KEY":
      return {
        ...state,
        apiKey: action.payload,
        step: "upload",
      };
    case "CLEAR_API_KEY":
      return {
        ...state,
        apiKey: null,
        step: "api-key-setup",
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
        apiKey: state.apiKey,
        step: "upload",
      };
    default:
      return state;
  }
}

export function App(): ReactNode {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const { apiKey, isValidating, error, setApiKey } = useApiKey();
  const { hasAcknowledged, acknowledge } = useAiAcknowledgment();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync external state with reducer
  const effectiveState: AppState = {
    ...state,
    apiKey,
    hasAcknowledgedAI: hasAcknowledged,
    step: !hasAcknowledged
      ? "landing"
      : !apiKey
        ? "api-key-setup"
        : state.step === "landing" || state.step === "api-key-setup"
          ? "upload"
          : state.step,
  };

  const handleAcknowledge = useCallback(() => {
    acknowledge();
    dispatch({ type: "ACKNOWLEDGE_AI" });
  }, [acknowledge]);

  const handleApiKeySubmit = useCallback(
    async (key: string): Promise<boolean> => {
      const success = await setApiKey(key);
      if (success) {
        dispatch({ type: "SET_API_KEY", payload: key });
      }
      return success;
    },
    [setApiKey]
  );

  const handleFilesChange = useCallback((files: ProcessableFile[]) => {
    dispatch({ type: "CLEAR_FILES" });
    dispatch({ type: "ADD_FILES", payload: files });
  }, []);

  const handleStartProcessing = useCallback(async () => {
    if (!effectiveState.apiKey) return;

    const readyFiles = effectiveState.files.filter((f) => f.status === "ready");
    if (readyFiles.length === 0) return;

    dispatch({ type: "START_PROCESSING" });

    abortControllerRef.current = new AbortController();

    try {
      // Convert files to image inputs
      const images = await Promise.all(
        readyFiles.flatMap((file) =>
          file.pageBlobs.map(async (blob, pageIndex) => {
            const base64 = await blobToBase64(blob);
            return {
              id: `${file.id}_${pageIndex}`,
              sourceFile: file.originalFile.name,
              pageNumber: file.pageCount > 1 ? pageIndex + 1 : undefined,
              mimeType: getMimeTypeFromBase64(base64),
              base64Data: getBase64Data(base64),
            };
          })
        )
      );

      const flatImages = images.flat();

      const results = await processFiles({
        apiKey: effectiveState.apiKey,
        images: flatImages,
        onProgress: (progress: ProcessingProgress) => {
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
        // Show error to user - could add a toast notification here
        console.error("Processing error:", errorMessage);
      }
    } finally {
      abortControllerRef.current = null;
    }
  }, [effectiveState.apiKey, effectiveState.files]);

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

  return (
    <div className={styles.app}>
      {effectiveState.step === "landing" && (
        <AiDisclosure onAcknowledge={handleAcknowledge} />
      )}

      {effectiveState.step === "api-key-setup" && (
        <ApiKeySetup
          onSubmit={handleApiKeySubmit}
          isValidating={isValidating}
          error={error}
        />
      )}

      {effectiveState.step === "upload" && (
        <FileUpload
          files={effectiveState.files}
          onFilesChange={handleFilesChange}
          onStartProcessing={handleStartProcessing}
          isProcessing={false}
        />
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
    </div>
  );
}
