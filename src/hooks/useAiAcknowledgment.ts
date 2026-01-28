import { useCallback, useState } from "react";
import { STORAGE_KEYS } from "@/constants";

interface UseAiAcknowledgmentReturn {
  hasAcknowledged: boolean;
  acknowledge: () => void;
  reset: () => void;
}

export function useAiAcknowledgment(): UseAiAcknowledgmentReturn {
  const [hasAcknowledged, setHasAcknowledged] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.AI_ACKNOWLEDGED) === "true";
    } catch {
      return false;
    }
  });

  const acknowledge = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.AI_ACKNOWLEDGED, "true");
    } catch {
      // Ignore localStorage errors
    }
    setHasAcknowledged(true);
  }, []);

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEYS.AI_ACKNOWLEDGED);
    } catch {
      // Ignore localStorage errors
    }
    setHasAcknowledged(false);
  }, []);

  return {
    hasAcknowledged,
    acknowledge,
    reset,
  };
}
