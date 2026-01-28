import { useCallback, useEffect, useState } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { STORAGE_KEYS, GEMINI_MODEL } from "@/constants";

interface UseApiKeyReturn {
  apiKey: string | null;
  isValidating: boolean;
  error: string | null;
  setApiKey: (key: string) => Promise<boolean>;
  clearApiKey: () => void;
}

async function validateApiKey(key: string): Promise<boolean> {
  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    // Make a minimal request to verify the key works
    await model.generateContent("Hello");
    return true;
  } catch (error) {
    // Check if it's an auth error vs other errors
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes("api key") || message.includes("401") || message.includes("403")) {
        return false;
      }
    }
    // For other errors (network, etc.), assume key might be valid
    // Let the actual processing handle those errors
    return true;
  }
}

export function useApiKey(): UseApiKeyReturn {
  const [apiKey, setApiKeyState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.API_KEY_LEGACY);
    } catch {
      return null;
    }
  });
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync with localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.API_KEY_LEGACY);
      if (stored !== apiKey) {
        setApiKeyState(stored);
      }
    } catch {
      // localStorage not available
    }
  }, [apiKey]);

  const setApiKey = useCallback(async (key: string): Promise<boolean> => {
    setError(null);
    setIsValidating(true);

    try {
      const trimmedKey = key.trim();

      if (!trimmedKey) {
        setError("API 키를 입력하세요");
        return false;
      }

      if (!trimmedKey.startsWith("AIza")) {
        setError("유효하지 않은 API 키 형식입니다");
        return false;
      }

      const isValid = await validateApiKey(trimmedKey);

      if (!isValid) {
        setError("API 키가 유효하지 않습니다. 키를 확인해주세요.");
        return false;
      }

      try {
        localStorage.setItem(STORAGE_KEYS.API_KEY_LEGACY, trimmedKey);
      } catch {
        setError("API 키를 저장할 수 없습니다. 브라우저 설정을 확인하세요.");
        return false;
      }

      setApiKeyState(trimmedKey);
      return true;
    } finally {
      setIsValidating(false);
    }
  }, []);

  const clearApiKey = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEYS.API_KEY_LEGACY);
    } catch {
      // Ignore localStorage errors
    }
    setApiKeyState(null);
    setError(null);
  }, []);

  return {
    apiKey,
    isValidating,
    error,
    setApiKey,
    clearApiKey,
  };
}
