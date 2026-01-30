export type ConfidenceTag = "LOW" | "MEDIUM" | "HIGH";

export const CONFIDENCE_THRESHOLDS = {
  MEDIUM: 50,
  HIGH: 90,
} as const;

export function getConfidenceTag(score: number): ConfidenceTag {
  if (score >= CONFIDENCE_THRESHOLDS.HIGH) return "HIGH";
  if (score >= CONFIDENCE_THRESHOLDS.MEDIUM) return "MEDIUM";
  return "LOW";
}

export function getConfidenceClassName(score: number): "High" | "Medium" | "Low" {
  const tag = getConfidenceTag(score);
  switch (tag) {
    case "HIGH":
      return "High";
    case "MEDIUM":
      return "Medium";
    case "LOW":
      return "Low";
  }
}

export function getConfidenceTagKorean(tag: ConfidenceTag): string {
  switch (tag) {
    case "HIGH":
      return "높음";
    case "MEDIUM":
      return "보통";
    case "LOW":
      return "낮음";
  }
}

export function isLowConfidence(score: number): boolean {
  return score < CONFIDENCE_THRESHOLDS.MEDIUM;
}
