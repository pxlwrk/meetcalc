import { Rate } from "./timer";

const STORAGE_KEY = "meetcalc.customRates.v1";

/**
 * Custom rates for external participants (consultants, contractors) live
 * only in this browser's localStorage — they are never sent to the shared
 * database, unlike the official BMF presets.
 */
export function readCustomRates(): Rate[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeCustomRates(rates: Rate[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rates));
}

export function makeLocalRateId(): string {
  return `local-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export function isLocalRateId(id: string): boolean {
  return id.startsWith("local-");
}
