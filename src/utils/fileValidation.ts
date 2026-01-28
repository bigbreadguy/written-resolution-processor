import { ACCEPTED_FILE_TYPES, MAX_FILE_SIZE_BYTES, ERROR_MESSAGES } from "@/constants";

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export function validateFile(file: File): FileValidationResult {
  if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `${ERROR_MESSAGES.UNSUPPORTED_FILE_TYPE.ko}: ${file.name}`,
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `${ERROR_MESSAGES.FILE_TOO_LARGE.ko}: ${file.name}`,
    };
  }

  return { valid: true };
}

export function validateFiles(files: File[]): FileValidationResult[] {
  return files.map(validateFile);
}

export function generateFileId(): string {
  return `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function isPdf(file: File): boolean {
  return file.type === "application/pdf";
}

export function isImage(file: File): boolean {
  return file.type.startsWith("image/");
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
      } else {
        reject(new Error("Failed to read file as base64"));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
      } else {
        reject(new Error("Failed to read blob as base64"));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function getMimeTypeFromBase64(base64: string): string {
  const match = base64.match(/^data:([^;]+);base64,/);
  return match?.[1] ?? "application/octet-stream";
}

export function getBase64Data(base64: string): string {
  const match = base64.match(/^data:[^;]+;base64,(.+)$/);
  return match?.[1] ?? base64;
}
