export type RateGroup = "BEAMTE" | "TARIF" | "EXTERN";

export interface Rate {
  id: string;
  name: string;
  hourlyRate: number;
  group: RateGroup;
  source: string | null;
}

export interface ParticipantLine {
  rateId: string;
  rate: Rate;
  count: number;
}

/** Summed cost of all participants, in Euro per hour. */
export function totalHourlyRate(lines: ParticipantLine[]): number {
  return lines.reduce((sum, line) => sum + line.rate.hourlyRate * line.count, 0);
}

/** Euro cost accrued given a combined hourly rate and elapsed seconds. */
export function costForElapsedSeconds(hourlyRateSum: number, elapsedSeconds: number): number {
  return (hourlyRateSum / 3600) * elapsedSeconds;
}

export interface RunningMeetingState {
  startedAt: number; // ms epoch of the current run segment
  accumulatedMs: number; // ms accumulated from previous run segments (pause/resume)
  isRunning: boolean;
}

/** Total elapsed ms across all run segments, computed from wall-clock time to avoid drift. */
export function elapsedMs(state: RunningMeetingState, now: number = Date.now()): number {
  if (!state.isRunning) return state.accumulatedMs;
  return state.accumulatedMs + Math.max(0, now - state.startedAt);
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function formatEuro(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
