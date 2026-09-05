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

const STORAGE_KEY = "meetcalc.session.v1";

type Status = "idle" | "running" | "stopped";

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

export function MeetingApp({ initialRates }: { initialRates: Rate[] }) {
  const [rates] = useState<Rate[]>(initialRates);
  const [selectedRateId, setSelectedRateId] = useState<string>(initialRates[0]?.id ?? "");
  const [session, setSession] = useState<Session>(DEFAULT_SESSION);
  const [now, setNow] = useState(() => Date.now());
  const [persistEnabled, setPersistEnabled] = useState(false);

  const { az, status, accumulatedMs, startedAt, lineCounts, plannedMinutes } = session;

  // The initial render always uses DEFAULT_SESSION so it matches the
  // server-rendered markup (localStorage isn't available during SSR). Once
  // mounted in the browser we synchronize from that external store here —
  // there's no way to read it earlier without risking a hydration mismatch.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-time sync from
       localStorage, a client-only external store unavailable during SSR/hydration. */
    const stored = readStoredSession();
    if (stored) setSession(stored);
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

  const participantCount = lines.reduce((sum, l) => sum + l.count, 0);

  function setPlannedMinutes(value: number | null) {
    setSession((prev) => ({ ...prev, plannedMinutes: value }));
  }

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

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-ink-700 px-6 py-6 sm:px-10">
        <div className="mx-auto flex max-w-6xl items-end justify-between gap-4">
          <div>
            <p className="font-mono-num text-[11px] uppercase tracking-[0.25em] text-brass-bright">
              Bundesbehörden · Kostenrechner
            </p>
            <h1 className="font-display text-4xl font-semibold italic tracking-tight text-text-on-ink sm:text-5xl">
              MeetCalc
            </h1>
          </div>
          <div className="flex flex-col items-end gap-2 text-right">
            {az && (
              <p className="font-mono-num text-xs text-text-on-ink-muted">
                AZ&nbsp;{az}
              </p>
            )}
            <Link
              href="/raten"
              className="text-sm text-brass-bright underline decoration-brass/50 underline-offset-4 hover:text-brass-bright/80"
            >
              Sätze verwalten →
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:px-10">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
          {/* Ledger / Teilnehmer-Formular */}
          <section className="paper-card rounded-sm p-6 sm:p-8">
            <div className="rule-double pb-3">
              <h2 className="font-display text-2xl font-semibold">Teilnehmende</h2>
              <p className="mt-1 text-sm text-text-on-paper-muted">
                Wählen Sie Personen nach Gehalts- bzw. Kostengruppe aus.
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <select
                value={selectedRateId}
                onChange={(e) => setSelectedRateId(e.target.value)}
                className="flex-1 rounded-sm border border-paper-line bg-white/60 px-3 py-2 text-sm text-text-on-paper focus:border-stamp focus:outline-none focus-visible:ring-2 focus-visible:ring-stamp"
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
                onClick={addParticipant}
                disabled={!selectedRateId}
                className="rounded-sm bg-stamp px-4 py-2 text-sm font-medium text-paper transition hover:bg-stamp-dark disabled:opacity-40"
              >
                + Hinzufügen
              </button>
            </div>

            <ul className="mt-6 divide-y divide-paper-line border-t border-paper-line">
              {lines.length === 0 && (
                <li className="py-6 text-sm text-text-on-paper-muted">
                  Noch niemand eingetragen. Fügen Sie oben die erste Person hinzu.
                </li>
              )}
              {lines.map((line) => (
                <li key={line.rateId} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{line.rate.name}</p>
                    <p className="font-mono-num text-xs text-text-on-paper-muted">
                      {formatEuro(line.rate.hourlyRate)}/h · Quelle: {line.rate.source ?? "Eigene Angabe"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      aria-label="Anzahl verringern"
                      onClick={() => changeCount(line.rateId, -1)}
                      className="h-7 w-7 rounded-full border border-paper-line text-sm leading-none hover:bg-paper-dim"
                    >
                      −
                    </button>
                    <span className="w-6 text-center font-mono-num text-sm">{line.count}</span>
                    <button
                      aria-label="Anzahl erhöhen"
                      onClick={() => changeCount(line.rateId, 1)}
                      className="h-7 w-7 rounded-full border border-paper-line text-sm leading-none hover:bg-paper-dim"
                    >
                      +
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex items-center justify-between border-t border-paper-line pt-4 text-sm">
              <span className="text-text-on-paper-muted">
                {participantCount} {participantCount === 1 ? "Person" : "Personen"}
              </span>
              <span className="font-mono-num font-semibold">
                {formatEuro(hourlySum)}&nbsp;/&nbsp;Std.
              </span>
            </div>

            <div className="mt-4 border-t border-paper-line pt-4">
              <label className="text-sm font-medium text-text-on-paper" htmlFor="planned-minutes">
                Geplante Dauer <span className="font-normal text-text-on-paper-muted">(optional)</span>
              </label>
              <p className="mt-1 text-xs text-text-on-paper-muted">
                Damit zeigt der Zähler live an, wie viel Sie sparen, wenn Sie früher fertig sind.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  id="planned-minutes"
                  type="number"
                  min={1}
                  step={5}
                  value={plannedMinutes ?? ""}
                  onChange={(e) => {
                    const value = e.target.value === "" ? null : Number(e.target.value);
                    setPlannedMinutes(value !== null && Number.isFinite(value) && value > 0 ? value : null);
                  }}
                  placeholder="z. B. 30"
                  className="w-24 rounded-sm border border-paper-line bg-white/60 px-3 py-2 text-sm text-text-on-paper focus:border-stamp focus:outline-none"
                />
                <span className="text-sm text-text-on-paper-muted">Min.</span>
                <div className="ml-2 flex flex-wrap gap-2">
                  {DURATION_PRESETS.map((m) => (
                    <button
                      key={m}
                      onClick={() => setPlannedMinutes(m)}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        plannedMinutes === m
                          ? "border-stamp bg-stamp text-paper"
                          : "border-paper-line text-text-on-paper-muted hover:border-stamp hover:text-stamp"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                  {plannedMinutes !== null && (
                    <button
                      onClick={() => setPlannedMinutes(null)}
                      className="rounded-full px-3 py-1 text-xs text-text-on-paper-muted underline decoration-text-on-paper-muted/40 underline-offset-4 hover:text-alert"
                    >
                      Entfernen
                    </button>
                  )}
                </div>
              </div>
              {plannedBudget !== null && (
                <p className="mt-3 font-mono-num text-sm text-text-on-paper-muted">
                  Geplantes Budget: <span className="font-semibold text-text-on-paper">{formatEuro(plannedBudget)}</span>
                </p>
              )}
            </div>

            <details className="mt-6 rounded-sm border border-paper-line bg-paper-dim/50 px-4 py-3 text-xs text-text-on-paper-muted open:pb-4">
              <summary className="cursor-pointer select-none font-medium text-text-on-paper">
                Kalkulationsgrundlage
              </summary>
              <p className="mt-2 leading-relaxed">
                Die hinterlegten Sätze sind Vollkosten-Stundensätze (Gehalt, Versorgung/Nebenkosten,
                anteilige Sachkosten und Gemeinkostenzuschlag) auf Basis des BMF-Rundschreibens
                „Personal- und Sachkosten in der Bundesverwaltung für Wirtschaftlichkeitsuntersuchungen
                und Kostenberechnungen&rdquo; (PSK), Datenstand 2025. Es handelt sich um gerundete
                Näherungswerte für Orientierungszwecke, keine verbindliche Kosten- und
                Leistungsrechnung.
              </p>
            </details>
          </section>

          {/* Kosten-Stage */}
          <section className="flex flex-col items-center justify-between gap-8 rounded-sm border border-ink-700 bg-ink-900 p-6 sm:p-8">
            <div className="flex w-full items-center justify-between">
              <StatusStamp status={status} />
              <span className="font-mono-num text-xs text-text-on-ink-muted">
                {formatDuration(elapsedSeconds)}
              </span>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
              <p className="font-mono-num text-[11px] uppercase tracking-[0.3em] text-text-on-ink-muted">
                Sitzungskosten bisher
              </p>
              <CostReadout amount={cost} />
              <p className="mt-3 text-xs text-text-on-ink-muted">
                bei {formatEuro(hourlySum)} / Std. für {participantCount}{" "}
                {participantCount === 1 ? "Teilnehmer" : "Teilnehmende"}
              </p>
              {savings !== null && status !== "idle" && (
                <SavingsReadout savings={savings} plannedMinutes={plannedMinutes!} />
              )}
            </div>

            <div className="flex items-center gap-6">
              {status !== "running" ? (
                <button
                  onClick={start}
                  disabled={hourlySum === 0}
                  className="seal-button flex h-28 w-28 flex-col items-center justify-center bg-ink-800 font-display text-sm font-semibold uppercase tracking-wide text-brass-bright disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {status === "stopped" ? (
                    <>
                      Fort-
                      <br />
                      setzen
                    </>
                  ) : (
                    "Start"
                  )}
                </button>
              ) : (
                <button
                  onClick={stop}
                  className="seal-button seal-button--stop flex h-28 w-28 flex-col items-center justify-center bg-ink-800 font-display text-sm font-semibold uppercase tracking-wide text-alert"
                >
                  Stopp
                </button>
              )}
              {status === "stopped" && (
                <button
                  onClick={reset}
                  className="text-sm text-text-on-ink-muted underline decoration-text-on-ink-muted/40 underline-offset-4 hover:text-text-on-ink"
                >
                  Neues Meeting
                </button>
              )}
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-ink-700 px-6 py-6 text-center text-xs text-text-on-ink-muted sm:px-10">
        Datengrundlage: BMF-Rundschreiben „Personal- und Sachkosten in der Bundesverwaltung&rdquo; (PSK),
        Datenstand 2025 · Näherungswerte ohne rechtliche Bindungswirkung.
      </footer>
    </div>
  );
}

function StatusStamp({ status }: { status: Status }) {
  if (status === "running") {
    return (
      <span className="stamp-badge flex items-center gap-2 rounded-sm px-3 py-1 font-display text-xs font-semibold uppercase tracking-wider">
        <span className="pulse-dot h-2 w-2 rounded-full bg-stamp" />
        In Betrieb
      </span>
    );
  }
  if (status === "stopped") {
    return (
      <span className="stamp-badge rounded-sm px-3 py-1 font-display text-xs font-semibold uppercase tracking-wider opacity-70">
        Angehalten
      </span>
    );
  }
  return (
    <span className="rounded-sm border-2 border-text-on-ink-muted/40 px-3 py-1 font-display text-xs font-semibold uppercase tracking-wider text-text-on-ink-muted">
      Bereit
    </span>
  );
}

function SavingsReadout({ savings, plannedMinutes }: { savings: number; plannedMinutes: number }) {
  const isOverrun = savings < 0;
  return (
    <p
      className={`mt-4 rounded-sm border px-4 py-2 font-mono-num text-sm ${
        isOverrun ? "border-alert/50 text-alert" : "border-savings/50 text-savings"
      }`}
    >
      {isOverrun ? "Bereits überzogen um " : "Ersparnis bei Stopp jetzt: "}
      <span className="font-semibold">{formatEuro(Math.abs(savings))}</span>
      <span className="ml-1 text-text-on-ink-muted">(geplant: {plannedMinutes} Min.)</span>
    </p>
  );
}

function CostReadout({ amount }: { amount: number }) {
  const euros = Math.floor(amount);
  const cents = Math.floor((amount - euros) * 100);
  const euroStr = new Intl.NumberFormat("de-DE").format(euros);
  return (
    <p className="font-mono-num leading-none text-text-on-ink">
      <span className="text-6xl font-semibold sm:text-7xl">{euroStr}</span>
      <span className="text-2xl text-text-on-ink-muted sm:text-3xl">,{cents.toString().padStart(2, "0")}&nbsp;€</span>
    </p>
  );
}
