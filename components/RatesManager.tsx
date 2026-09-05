"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Rate, RateGroup } from "@/lib/timer";
import { GROUP_LABELS } from "@/lib/rates";

const GROUP_ORDER: RateGroup[] = ["BEAMTE", "TARIF", "EXTERN"];

export function RatesManager({ initialRates }: { initialRates: Rate[] }) {
  const [rates, setRates] = useState<Rate[]>(initialRates);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newRate, setNewRate] = useState("");
  const [newGroup, setNewGroup] = useState<RateGroup>("EXTERN");
  const [savingId, setSavingId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<RateGroup, Rate[]>();
    for (const g of GROUP_ORDER) map.set(g, []);
    for (const r of rates) map.get(r.group)?.push(r);
    return map;
  }, [rates]);

  async function updateRate(id: string, patch: { name?: string; hourlyRate?: number }) {
    setSavingId(id);
    setError(null);
    const res = await fetch(`/api/rates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSavingId(null);
    if (!res.ok) {
      setError("Änderung konnte nicht gespeichert werden.");
      return;
    }
    const updated = await res.json();
    setRates((prev) =>
      prev.map((r) => (r.id === id ? { ...r, name: updated.name, hourlyRate: Number(updated.hourlyRate) } : r))
    );
  }

  async function deleteRate(id: string) {
    setError(null);
    const res = await fetch(`/api/rates/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Satz konnte nicht gelöscht werden.");
      return;
    }
    setRates((prev) => prev.filter((r) => r.id !== id));
  }

  async function addRate() {
    setError(null);
    const rate = Number(newRate.replace(",", "."));
    if (!newName.trim() || !Number.isFinite(rate) || rate <= 0) {
      setError("Bitte Name und einen gültigen Stundensatz angeben.");
      return;
    }
    const res = await fetch("/api/rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), hourlyRate: rate, group: newGroup }),
    });
    if (!res.ok) {
      setError("Satz konnte nicht angelegt werden.");
      return;
    }
    const created = await res.json();
    setRates((prev) => [...prev, { ...created, hourlyRate: Number(created.hourlyRate) }]);
    setNewName("");
    setNewRate("");
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-ink-700 px-6 py-6 sm:px-10">
        <div className="mx-auto flex max-w-4xl items-end justify-between gap-4">
          <div>
            <p className="font-mono-num text-[11px] uppercase tracking-[0.25em] text-brass-bright">
              Stammdaten
            </p>
            <h1 className="font-display text-4xl font-semibold italic tracking-tight text-text-on-ink sm:text-5xl">
              Sätze verwalten
            </h1>
          </div>
          <Link
            href="/"
            className="text-sm text-brass-bright underline decoration-brass/50 underline-offset-4 hover:text-brass-bright/80"
          >
            ← Zur Sitzung
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10 sm:px-10">
        {error && (
          <p className="mb-4 rounded-sm border border-alert/50 bg-alert/10 px-4 py-2 text-sm text-alert">
            {error}
          </p>
        )}

        <div className="paper-card rounded-sm p-6 sm:p-8">
          {GROUP_ORDER.map((group) => {
            const list = grouped.get(group) ?? [];
            if (list.length === 0) return null;
            return (
              <div key={group} className="mb-8 last:mb-0">
                <h2 className="rule-double pb-2 font-display text-lg font-semibold">
                  {GROUP_LABELS[group]}
                </h2>
                <ul className="mt-3 divide-y divide-paper-line">
                  {list.map((r) => (
                    <li key={r.id} className="py-3">
                      <input
                        defaultValue={r.name}
                        onBlur={(e) => {
                          if (e.target.value.trim() && e.target.value !== r.name) {
                            updateRate(r.id, { name: e.target.value.trim() });
                          }
                        }}
                        className="w-full rounded-sm border border-transparent bg-transparent px-2 py-1 text-sm font-medium focus:border-paper-line focus:bg-white/60 focus:outline-none"
                      />
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 px-2 text-xs text-text-on-paper-muted">
                        <div className="flex items-center gap-1 font-mono-num text-sm text-text-on-paper">
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={r.hourlyRate}
                            onBlur={(e) => {
                              const value = Number(e.target.value);
                              if (Number.isFinite(value) && value > 0 && value !== r.hourlyRate) {
                                updateRate(r.id, { hourlyRate: value });
                              }
                            }}
                            className="w-24 rounded-sm border border-paper-line bg-white/60 px-2 py-1 text-right focus:border-stamp focus:outline-none"
                          />
                          <span className="text-text-on-paper-muted">€/h</span>
                        </div>
                        <span>{r.source ?? "Eigene Angabe"}</span>
                        {savingId === r.id && <span>speichert…</span>}
                        <button
                          onClick={() => deleteRate(r.id)}
                          aria-label={`${r.name} löschen`}
                          className="ml-auto text-alert underline decoration-alert/40 underline-offset-4 hover:text-alert/80"
                        >
                          Löschen
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          <div className="mt-8 border-t border-paper-line pt-6">
            <h2 className="font-display text-lg font-semibold">Neuen Satz anlegen</h2>
            <p className="mt-1 text-sm text-text-on-paper-muted">
              Zum Beispiel für externe Dienstleister oder Berater mit individuellem Stundensatz.
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="flex flex-1 min-w-[10rem] flex-col gap-1 text-xs text-text-on-paper-muted">
                Bezeichnung
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="z. B. Berater XY"
                  className="rounded-sm border border-paper-line bg-white/60 px-3 py-2 text-sm text-text-on-paper focus:border-stamp focus:outline-none"
                />
              </label>
              <label className="flex w-28 flex-col gap-1 text-xs text-text-on-paper-muted">
                €/Stunde
                <input
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                  placeholder="120"
                  inputMode="decimal"
                  className="rounded-sm border border-paper-line bg-white/60 px-3 py-2 text-sm text-text-on-paper focus:border-stamp focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-text-on-paper-muted">
                Gruppe
                <select
                  value={newGroup}
                  onChange={(e) => setNewGroup(e.target.value as RateGroup)}
                  className="rounded-sm border border-paper-line bg-white/60 px-3 py-2 text-sm text-text-on-paper focus:border-stamp focus:outline-none"
                >
                  {GROUP_ORDER.map((g) => (
                    <option key={g} value={g}>
                      {GROUP_LABELS[g]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                onClick={addRate}
                className="rounded-sm bg-stamp px-4 py-2 text-sm font-medium text-paper transition hover:bg-stamp-dark"
              >
                + Anlegen
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
