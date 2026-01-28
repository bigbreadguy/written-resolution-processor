/**
 * useApiKeys Hook
 *
 * Manages multiple API keys with tier information.
 * Handles validation, storage, and migration from legacy single-key format.
 */

import { useCallback, useEffect, useState } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { STORAGE_KEYS, GEMINI_MODEL } from "@/constants";
import { getRateLimiter } from "@/services/rateLimiter";
import type { ApiKeyEntry, ApiTier } from "@/types";

// ============================================================
// Validation
// ============================================================

async function validateApiKey(key: string): Promise<boolean> {
  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    await model.generateContent("Hello");
    return true;
  } catch (error) {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (
        message.includes("api key") ||
        message.includes("401") ||
        message.includes("403")
      ) {
        return false;
      }
    }
    // For other errors (network, etc.), assume key might be valid
    return true;
  }
}

function generateKeyId(): string {
  return `key_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================================
// Storage Functions
// ============================================================

function loadApiKeys(): ApiKeyEntry[] {
  try {
    // Try loading new format
    const saved = localStorage.getItem(STORAGE_KEYS.API_KEYS);
    if (saved) {
      const parsed = JSON.parse(saved) as ApiKeyEntry[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }

    // Try migrating from legacy format
    const legacyKey = localStorage.getItem(STORAGE_KEYS.API_KEY_LEGACY);
    if (legacyKey) {
      const migrated: ApiKeyEntry[] = [
        {
          id: generateKeyId(),
          key: legacyKey,
          tier: "free", // Default to free tier for migrated keys
          addedAt: new Date().toISOString(),
        },
      ];
      // Save in new format
      localStorage.setItem(STORAGE_KEYS.API_KEYS, JSON.stringify(migrated));
      // Remove legacy key
      localStorage.removeItem(STORAGE_KEYS.API_KEY_LEGACY);
      return migrated;
    }
  } catch {
    // Ignore storage errors
  }

  return [];
}

function saveApiKeys(keys: ApiKeyEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.API_KEYS, JSON.stringify(keys));
  } catch {
    // Ignore storage errors
  }
}

// ============================================================
// Hook
// ============================================================

export interface UseApiKeysReturn {
  /** All registered API keys */
  apiKeys: ApiKeyEntry[];
  /** Whether any key is currently being validated */
  isValidating: boolean;
  /** Error message from last operation */
  error: string | null;
  /** Add a new API key */
  addApiKey: (key: string, tier: ApiTier, label?: string) => Promise<boolean>;
  /** Remove an API key by ID */
  removeApiKey: (keyId: string) => void;
  /** Update an existing key's tier or label */
  updateApiKey: (keyId: string, updates: { tier?: ApiTier; label?: string }) => void;
  /** Clear all API keys */
  clearApiKeys: () => void;
  /** Check if there's at least one key */
  hasKeys: boolean;
}

export function useApiKeys(): UseApiKeysReturn {
  const [apiKeys, setApiKeys] = useState<ApiKeyEntry[]>(() => loadApiKeys());
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync rate limiter when keys change
  useEffect(() => {
    if (apiKeys.length > 0) {
      getRateLimiter(apiKeys);
    }
  }, [apiKeys]);

  const addApiKey = useCallback(
    async (key: string, tier: ApiTier, label?: string): Promise<boolean> => {
      setError(null);
      setIsValidating(true);

      try {
        const trimmedKey = key.trim();

        // Validation
        if (!trimmedKey) {
          setError("API 키를 입력하세요");
          return false;
        }

        if (!trimmedKey.startsWith("AIza")) {
          setError("유효하지 않은 API 키 형식입니다");
          return false;
        }

        // Check for duplicate
        if (apiKeys.some((k) => k.key === trimmedKey)) {
          setError("이미 등록된 API 키입니다");
          return false;
        }

        // Validate with API
        const isValid = await validateApiKey(trimmedKey);
        if (!isValid) {
          setError("API 키가 유효하지 않습니다. 키를 확인해주세요.");
          return false;
        }

        // Create new entry
        const newEntry: ApiKeyEntry = {
          id: generateKeyId(),
          key: trimmedKey,
          tier,
          label: label?.trim() || undefined,
          addedAt: new Date().toISOString(),
        };

        const newKeys = [...apiKeys, newEntry];
        setApiKeys(newKeys);
        saveApiKeys(newKeys);

        return true;
      } finally {
        setIsValidating(false);
      }
    },
    [apiKeys]
  );

  const removeApiKey = useCallback(
    (keyId: string) => {
      const newKeys = apiKeys.filter((k) => k.id !== keyId);
      setApiKeys(newKeys);
      saveApiKeys(newKeys);

      // Clear rate limiter data for this key
      const rateLimiter = getRateLimiter(newKeys);
      rateLimiter.clearKeyData(keyId);
    },
    [apiKeys]
  );

  const updateApiKey = useCallback(
    (keyId: string, updates: { tier?: ApiTier; label?: string }) => {
      const newKeys = apiKeys.map((k) => {
        if (k.id !== keyId) return k;
        return {
          ...k,
          tier: updates.tier ?? k.tier,
          label: updates.label !== undefined ? updates.label : k.label,
        };
      });
      setApiKeys(newKeys);
      saveApiKeys(newKeys);
    },
    [apiKeys]
  );

  const clearApiKeys = useCallback(() => {
    // Clear rate limiter data for all keys
    for (const key of apiKeys) {
      const rateLimiter = getRateLimiter([]);
      rateLimiter.clearKeyData(key.id);
    }

    setApiKeys([]);
    saveApiKeys([]);
    setError(null);
  }, [apiKeys]);

  return {
    apiKeys,
    isValidating,
    error,
    addApiKey,
    removeApiKey,
    updateApiKey,
    clearApiKeys,
    hasKeys: apiKeys.length > 0,
  };
}
