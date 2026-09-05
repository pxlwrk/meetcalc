"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Rate,
  ParticipantLine,
  totalHourlyRate,
  costForElapsedSeconds,
  elapsedMs,
  formatDuration,
  formatEuro,
  RunningMeetingState,
} from "@/lib/timer";
import { GROUP_LABELS } from "@/lib/rates";
import { exitFullscreen, isFullscreenActive, requestFullscreen } from "@/lib/fullscreen";

const STORAGE_KEY = "meetcalc.session.v1";

type Status = "idle" | "running" | "stopped";
type View = "setup" | "live";

interface Session {
  az: string | null;
  status: Status;
  accumulatedMs: number;
  startedAt: number | null;
  lineCounts: Record<string, number>;
  plannedMinutes: number | null;
}

const DEFAULT_SESSION: Session = {
  az: null,
  status: "idle",
  accumulatedMs: 0,
  startedAt: null,
  lineCounts: {},
  plannedMinutes: null,
};

const DURATION_PRESETS = [15, 30, 45, 60];

function makeAktenzeichen(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}`;
  const suffix = Math.floor(Math.random() * 90 + 10);
  return `MC-${date}-${time}/${suffix}`;
}

function readStoredSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_SESSION, ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
}

/**
 * While `enabled`, puts the page into fullscreen as soon as a touch device is
 * rotated into landscape (propping a phone up during a meeting), and drops
 * back out on the way back to portrait. Browsers require a user gesture to
 * *enter* fullscreen, which a rotation event technically isn't everywhere —
 * so this is best-effort, and `toggleFullscreen` is exposed as a manual
 * fallback button for browsers (notably iPhone Safari) where it silently
 * does nothing automatically.
 */
function useLandscapeFullscreen(enabled: boolean) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(isFullscreenActive());
    onChange();
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const mql = window.matchMedia("(orientation: landscape) and (pointer: coarse)");
    const sync = () => {
      if (mql.matches && !isFullscreenActive()) {
        requestFullscreen(document.documentElement);
      } else if (!mql.matches && isFullscreenActive()) {
        exitFullscreen();
      }
    };
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, [enabled]);

  // Leaving the live view entirely (e.g. back to setup) should hand control
  // of the screen back to the browser chrome.
  useEffect(() => {
    if (!enabled && isFullscreenActive()) exitFullscreen();
  }, [enabled]);

  function toggleFullscreen() {
    if (isFullscreenActive()) {
      exitFullscreen();
    } else {
      requestFullscreen(document.documentElement);
    }
  }

  return { isFullscreen, toggleFullscreen };
}

export function MeetingApp({ initialRates }: { initialRates: Rate[] }) {
  const [rates] = useState<Rate[]>(initialRates);
  const [selectedRateId, setSelectedRateId] = useState<string>(initialRates[0]?.id ?? "");
  const [session, setSession] = useState<Session>(DEFAULT_SESSION);
  const [view, setView] = useState<View>("setup");
  const [now, setNow] = useState(() => Date.now());
  const [persistEnabled, setPersistEnabled] = useState(false);
  const { isFullscreen, toggleFullscreen } = useLandscapeFullscreen(view === "live");

  const { status, accumulatedMs, startedAt, lineCounts, plannedMinutes } = session;

  // The initial render always uses DEFAULT_SESSION so it matches the
  // server-rendered markup (localStorage isn't available during SSR). Once
  // mounted in the browser we synchronize from that external store here —
  // there's no way to read it earlier without risking a hydration mismatch.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-time sync from
       localStorage, a client-only external store unavailable during SSR/hydration. */
    const stored = readStoredSession();
    if (stored) {
      setSession(stored);
      setView(stored.status === "idle" ? "setup" : "live");
    }
    setPersistEnabled(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Persist to localStorage on every relevant change.
  useEffect(() => {
    if (!persistEnabled) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, [persistEnabled, session]);

  // Live tick while running.
  useEffect(() => {
    if (status !== "running") return;
    const id = window.setInterval(() => setNow(Date.now()), 87);
    return () => window.clearInterval(id);
  }, [status]);

  const lines: ParticipantLine[] = useMemo(() => {
    return Object.entries(lineCounts)
      .filter(([, count]) => count > 0)
      .map(([rateId, count]) => {
        const rate = rates.find((r) => r.id === rateId);
        return rate ? { rateId, rate, count } : null;
      })
      .filter((l): l is ParticipantLine => l !== null);
  }, [lineCounts, rates]);

  const hourlySum = useMemo(() => totalHourlyRate(lines), [lines]);

  const runningState: RunningMeetingState = { startedAt: startedAt ?? 0, accumulatedMs, isRunning: status === "running" };
  const elapsed = status === "idle" ? 0 : elapsedMs(runningState, now);
  const elapsedSeconds = elapsed / 1000;
  const cost = costForElapsedSeconds(hourlySum, elapsedSeconds);

  const plannedBudget =
    plannedMinutes && plannedMinutes > 0 ? costForElapsedSeconds(hourlySum, plannedMinutes * 60) : null;
  const savings = plannedBudget !== null ? plannedBudget - cost : null;
  const isOverrun = savings !== null && savings < 0;

  const participantCount = lines.reduce((sum, l) => sum + l.count, 0);

  function addParticipant() {
    if (!selectedRateId) return;
    setSession((prev) => ({
      ...prev,
      lineCounts: { ...prev.lineCounts, [selectedRateId]: (prev.lineCounts[selectedRateId] ?? 0) + 1 },
    }));
  }

  function changeCount(rateId: string, delta: number) {
    setSession((prev) => {
      const next = { ...prev.lineCounts };
      const value = (next[rateId] ?? 0) + delta;
      if (value <= 0) {
        delete next[rateId];
      } else {
        next[rateId] = value;
      }
      return { ...prev, lineCounts: next };
    });
  }

  function setPlannedMinutes(value: number | null) {
    setSession((prev) => ({ ...prev, plannedMinutes: value }));
  }

  function start() {
    setSession((prev) => {
      if (prev.status === "idle") {
        return { ...prev, az: makeAktenzeichen(), accumulatedMs: 0, startedAt: Date.now(), status: "running" };
      }
      if (prev.status === "stopped") {
        return { ...prev, startedAt: Date.now(), status: "running" };
      }
      return prev;
    });
    setView("live");
  }

  function stop() {
    setSession((prev) => {
      if (prev.status !== "running") return prev;
      const frozenMs = elapsedMs({ startedAt: prev.startedAt ?? 0, accumulatedMs: prev.accumulatedMs, isRunning: true }, Date.now());
      return { ...prev, accumulatedMs: frozenMs, startedAt: null, status: "stopped" };
    });
  }

  function reset() {
    setSession((prev) => ({ ...prev, status: "idle", accumulatedMs: 0, startedAt: null, az: null }));
    setView("setup");
  }

  const grouped = useMemo(() => {
    const map = new Map<Rate["group"], Rate[]>();
    for (const r of rates) {
      const list = map.get(r.group) ?? [];
      list.push(r);
      map.set(r.group, list);
    }
    return map;
  }, [rates]);

  if (view === "live") {
    return (
      <LiveScreen
        status={status}
        isOverrun={isOverrun}
        cost={cost}
        elapsedSeconds={elapsedSeconds}
        hourlySum={hourlySum}
        participantCount={participantCount}
        savings={savings}
        plannedMinutes={plannedMinutes}
        onEdit={() => setView("setup")}
        onStop={stop}
        onResume={start}
        onReset={reset}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />
    );
  }

  return (
    <SetupScreen
      grouped={grouped}
      selectedRateId={selectedRateId}
      onSelectRate={setSelectedRateId}
      onAddParticipant={addParticipant}
      lines={lines}
      onChangeCount={changeCount}
      participantCount={participantCount}
      hourlySum={hourlySum}
      plannedMinutes={plannedMinutes}
      onSetPlannedMinutes={setPlannedMinutes}
      plannedBudget={plannedBudget}
      status={status}
      cost={cost}
      onPrimaryAction={status === "idle" ? start : () => setView("live")}
      onReset={reset}
    />
  );
}

function SetupScreen({
  grouped,
  selectedRateId,
  onSelectRate,
  onAddParticipant,
  lines,
  onChangeCount,
  participantCount,
  hourlySum,
  plannedMinutes,
  onSetPlannedMinutes,
  plannedBudget,
  status,
  cost,
  onPrimaryAction,
  onReset,
}: {
  grouped: Map<Rate["group"], Rate[]>;
  selectedRateId: string;
  onSelectRate: (id: string) => void;
  onAddParticipant: () => void;
  lines: ParticipantLine[];
  onChangeCount: (rateId: string, delta: number) => void;
  participantCount: number;
  hourlySum: number;
  plannedMinutes: number | null;
  onSetPlannedMinutes: (v: number | null) => void;
  plannedBudget: number | null;
  status: Status;
  cost: number;
  onPrimaryAction: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-cream">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-5 pt-6 pb-4 sm:max-w-lg">
        <div className="flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-full border-2 border-ink bg-pink" />
          <span className="font-display text-2xl font-black tracking-tight">MeetCalc</span>
        </div>
        <Link href="/raten" className="pill-btn pill-btn-ghost px-3 py-1.5 text-xs">
          Sätze
        </Link>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-32 sm:max-w-lg sm:pb-10">
        {status !== "idle" && (
          <button
            onClick={onPrimaryAction}
            className="sticker-card mb-4 flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <span>
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted">
                {status === "running" ? "Sitzung läuft" : "Sitzung pausiert"}
              </span>
              <span className="font-display tnum text-lg font-black">{formatEuro(cost)} bisher</span>
            </span>
            <span className="pill-btn pill-btn-primary px-4 py-2 text-sm">Zähler →</span>
          </button>
        )}

        <section className="sticker-card mb-4 p-5">
          <h1 className="font-display text-xl font-black">Teilnehmende</h1>
          <p className="mb-4 mt-1 text-sm text-muted">Wer sitzt mit im Meeting?</p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={selectedRateId}
              onChange={(e) => onSelectRate(e.target.value)}
              className="flex-1 rounded-full border-2 border-ink bg-paper px-4 py-2.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-deep"
            >
              {Array.from(grouped.entries()).map(([group, list]) => (
                <optgroup key={group} label={GROUP_LABELS[group]}>
                  {list.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} — {formatEuro(r.hourlyRate)}/h
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button
              onClick={onAddParticipant}
              disabled={!selectedRateId}
              className="pill-btn pill-btn-dark px-5 py-2.5 text-sm"
            >
              + Hinzufügen
            </button>
          </div>

          <ul className="mt-4 flex flex-col gap-2">
            {lines.length === 0 && (
              <li className="rounded-2xl border-2 border-dashed border-ink/30 px-4 py-5 text-center text-sm text-muted">
                Noch niemand eingetragen.
              </li>
            )}
            {lines.map((line) => (
              <li
                key={line.rateId}
                className="flex items-center justify-between gap-3 rounded-2xl border-2 border-ink px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{line.rate.name}</p>
                  <p className="text-xs text-muted">
                    {formatEuro(line.rate.hourlyRate)}/h · {line.rate.source ?? "Eigene Angabe"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    aria-label="Anzahl verringern"
                    onClick={() => onChangeCount(line.rateId, -1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink text-base leading-none hover:bg-cream-dim"
                  >
                    −
                  </button>
                  <span className="tnum w-5 text-center text-sm font-bold">{line.count}</span>
                  <button
                    aria-label="Anzahl erhöhen"
                    onClick={() => onChangeCount(line.rateId, 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink text-base leading-none hover:bg-cream-dim"
                  >
                    +
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between border-t-2 border-dashed border-ink/20 pt-4 text-sm">
            <span className="text-muted">
              {participantCount} {participantCount === 1 ? "Person" : "Personen"}
            </span>
            <span className="font-display tnum font-black">{formatEuro(hourlySum)} / Std.</span>
          </div>
        </section>

        <section className="sticker-card mb-4 p-5">
          <h2 className="font-display text-lg font-black">
            Geplante Dauer <span className="font-sans text-sm font-normal text-muted">(optional)</span>
          </h2>
          <p className="mb-3 mt-1 text-sm text-muted">
            Der Zähler zeigt dann live, wie viel du sparst, wenn&apos;s kürzer wird.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {DURATION_PRESETS.map((m) => (
              <button
                key={m}
                onClick={() => onSetPlannedMinutes(m)}
                className={`chip ${plannedMinutes === m ? "chip-active" : "chip-inactive"}`}
              >
                {m} Min.
              </button>
            ))}
            <input
              type="number"
              min={1}
              step={5}
              value={plannedMinutes && !DURATION_PRESETS.includes(plannedMinutes) ? plannedMinutes : ""}
              onChange={(e) => {
                const value = e.target.value === "" ? null : Number(e.target.value);
                onSetPlannedMinutes(value !== null && Number.isFinite(value) && value > 0 ? value : null);
              }}
              placeholder="eigene"
              className="w-20 rounded-full border-2 border-ink bg-paper px-3 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-deep"
            />
            {plannedMinutes !== null && (
              <button
                onClick={() => onSetPlannedMinutes(null)}
                className="text-xs font-semibold text-muted underline decoration-muted/40 underline-offset-4 hover:text-coral"
              >
                Entfernen
              </button>
            )}
          </div>
          {plannedBudget !== null && (
            <p className="mt-3 font-display tnum text-sm font-bold">
              Budget: <span className="text-pink-deep">{formatEuro(plannedBudget)}</span>
            </p>
          )}
        </section>

        <details className="px-1 text-xs text-muted">
          <summary className="cursor-pointer select-none font-semibold text-ink">Kalkulationsgrundlage</summary>
          <p className="mt-2 leading-relaxed">
            Die hinterlegten Sätze sind Vollkosten-Stundensätze (Gehalt, Versorgung/Nebenkosten, anteilige
            Sachkosten und Gemeinkostenzuschlag) auf Basis des BMF-Rundschreibens „Personal- und Sachkosten in
            der Bundesverwaltung für Wirtschaftlichkeitsuntersuchungen und Kostenberechnungen&rdquo; (PSK),
            Datenstand 2025. Gerundete Näherungswerte für Orientierungszwecke, keine verbindliche Kosten- und
            Leistungsrechnung.
          </p>
        </details>
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t-[3px] border-ink bg-cream/95 px-5 py-4 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:px-0 sm:pb-10">
        <div className="mx-auto flex w-full max-w-md items-center gap-3 sm:max-w-lg">
          {status !== "idle" && (
            <button onClick={onReset} className="text-sm font-semibold text-muted underline underline-offset-4">
              Neu
            </button>
          )}
          <button
            onClick={onPrimaryAction}
            disabled={hourlySum === 0}
            className="pill-btn pill-btn-primary flex-1 py-4 text-base"
          >
            {status === "idle" ? "Meeting starten →" : "Zurück zum Zähler →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LiveScreen({
  status,
  isOverrun,
  cost,
  elapsedSeconds,
  hourlySum,
  participantCount,
  savings,
  plannedMinutes,
  onEdit,
  onStop,
  onResume,
  onReset,
  isFullscreen,
  onToggleFullscreen,
}: {
  status: Status;
  isOverrun: boolean;
  cost: number;
  elapsedSeconds: number;
  hourlySum: number;
  participantCount: number;
  savings: number | null;
  plannedMinutes: number | null;
  onEdit: () => void;
  onStop: () => void;
  onResume: () => void;
  onReset: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const stageClass = status === "running" ? (isOverrun ? "stage-overrun" : "stage-running") : "stage-paused";
  const progressPct =
    plannedMinutes && plannedMinutes > 0 ? Math.min(100, (elapsedSeconds / (plannedMinutes * 60)) * 100) : null;

  return (
    <div className={`flex min-h-dvh flex-col transition-colors duration-500 ${stageClass}`}>
      <div className="flex items-center justify-between px-5 pt-6">
        <button onClick={onEdit} className="text-sm font-bold underline underline-offset-4">
          ← Bearbeiten
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleFullscreen}
            className="rounded-full border-2 border-ink bg-paper px-3 py-1 text-xs font-bold"
          >
            {isFullscreen ? "Verkleinern" : "Vollbild"}
          </button>
          <StatusPill status={status} />
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-5 text-center">
        <p className="font-display text-xs font-black uppercase tracking-[0.25em] opacity-70">
          Sitzungskosten
        </p>
        <BigCost amount={cost} />
        <p className="tnum mt-3 text-sm font-bold opacity-80">
          {formatDuration(elapsedSeconds)} · {formatEuro(hourlySum)}/Std · {participantCount}{" "}
          {participantCount === 1 ? "Teilnehmer" : "Teilnehmende"}
        </p>

        {savings !== null && (
          <div className="sticker-card mt-6 inline-flex items-center gap-2 bg-paper px-4 py-2 text-sm font-bold text-ink">
            {isOverrun ? "Überzogen um " : "Sparst gerade "}
            <span className="font-display tnum">{formatEuro(Math.abs(savings))}</span>
          </div>
        )}
      </div>

      {progressPct !== null && (
        <div className="h-3 w-full bg-black/10">
          <div
            className="h-full bg-ink transition-[width] duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      <div className="flex flex-col items-center gap-3 px-5 py-8">
        {status === "running" ? (
          <button
            onClick={onStop}
            className="pill-btn pill-btn-dark w-full max-w-xs py-5 text-lg"
          >
            Stopp
          </button>
        ) : (
          <>
            <button
              onClick={onResume}
              className="pill-btn pill-btn-primary w-full max-w-xs py-5 text-lg"
            >
              Fortsetzen
            </button>
            <button onClick={onReset} className="text-sm font-bold underline underline-offset-4">
              Neues Meeting
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  const label = status === "running" ? "LIVE" : "PAUSIERT";
  return (
    <span className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-ink px-3 py-1 font-display text-xs font-black text-paper">
      <span className={`h-2 w-2 rounded-full bg-paper ${status === "running" ? "pulse-dot" : ""}`} />
      {label}
    </span>
  );
}

function BigCost({ amount }: { amount: number }) {
  const euros = Math.floor(amount);
  const cents = Math.floor((amount - euros) * 100);
  const euroStr = new Intl.NumberFormat("de-DE").format(euros);
  return (
    <p className="font-display tnum leading-none">
      <span className="text-[clamp(3.5rem,18vw,8rem)] font-black">{euroStr}</span>
      <span className="text-[clamp(1.5rem,6vw,2.75rem)] font-black opacity-70">
        ,{cents.toString().padStart(2, "0")}&nbsp;€
      </span>
    </p>
  );
}
