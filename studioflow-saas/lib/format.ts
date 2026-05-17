import type { DeadlineState } from "@/types";

export function formatDate(value?: Date | string | null) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

export function formatDateTime(value?: Date | string | null) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatMoney(cents: number) {
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
    maximumFractionDigits: 0
  }).format(cents / 100);
}

export function deadlineState(deadline?: Date | string | null): DeadlineState {
  if (!deadline) return "none";
  const today = new Date();
  const date = new Date(deadline);
  const diffMs = date.getTime() - today.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 3) return "soon";
  return "normal";
}

export function safeJsonList(value: string | null | undefined, fallback: string[] = []) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : fallback;
  } catch {
    return fallback;
  }
}

export function parsePriceToCents(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "0").replace(",", "."));
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

export function studioCode(name: string) {
  const words = name
    .split(/\s+/)
    .map((part) => part.replace(/[^a-zA-Z]/g, ""))
    .filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .slice(0, 3)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}
