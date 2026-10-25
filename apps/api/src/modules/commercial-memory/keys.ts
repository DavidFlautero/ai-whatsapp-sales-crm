import { createHash } from "node:crypto";

export function digest(...parts: unknown[]): string {
  return createHash("sha256")
    .update(JSON.stringify(parts))
    .digest("hex");
}

export function cleanLabel(
  value: unknown,
  max = 120,
): string | null {
  if (typeof value !== "string") return null;

  const result = value
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

  return result || null;
}

export function confidence(value: number): number {
  if (!Number.isFinite(value)) return 0;

  return Math.round(
    Math.max(0, Math.min(1, value)) * 1000,
  ) / 1000;
}
