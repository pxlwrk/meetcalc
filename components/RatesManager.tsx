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
    <div className="flex min-h-dvh flex-col bg-cream">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-5 pt-6 pb-4 sm:max-w-xl lg:max-w-2xl">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Stammdaten</p>
          <h1 className="font-display text-2xl font-black tracking-tight">Sätze verwalten</h1>
        </div>
        <Link href="/" className="pill-btn pill-btn-ghost px-3 py-1.5 text-xs">
          ← Zurück
        </Link>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-10 sm:max-w-xl lg:max-w-2xl">
        {error && (
          <p className="sticker-card mb-4 border-coral bg-coral/10 px-4 py-3 text-sm font-semibold text-coral">
            {error}
          </p>
        )}

        {GROUP_ORDER.map((group) => {
          const list = grouped.get(group) ?? [];
          if (list.length === 0) return null;
          return (
            <section key={group} className="sticker-card mb-4 p-5">
              <h2 className="font-display text-lg font-black">{GROUP_LABELS[group]}</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {list.map((r) => (
                  <li key={r.id} className="rounded-2xl border-2 border-ink px-4 py-2.5">
                    <input
                      defaultValue={r.name}
                      onBlur={(e) => {
                        if (e.target.value.trim() && e.target.value !== r.name) {
                          updateRate(r.id, { name: e.target.value.trim() });
                        }
                      }}
                      className="w-full rounded-md bg-transparent py-0.5 text-sm font-bold focus:bg-cream-dim focus:outline-none"
                    />
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      <div className="flex items-center gap-1 text-sm font-bold text-ink">
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
                          className="w-20 rounded-full border-2 border-ink bg-paper px-2 py-1 text-right text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-deep"
                        />
                        <span className="text-xs font-normal text-muted">€/h</span>
                      </div>
                      <span>{r.source ?? "Eigene Angabe"}</span>
                      {savingId === r.id && <span>speichert…</span>}
                      <button
                        onClick={() => deleteRate(r.id)}
                        aria-label={`${r.name} löschen`}
                        className="ml-auto font-semibold text-coral underline decoration-coral/40 underline-offset-4"
                      >
                        Löschen
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        <section className="sticker-card p-5">
          <h2 className="font-display text-lg font-black">Neuen Satz anlegen</h2>
          <p className="mt-1 text-sm text-muted">Z. B. für externe Dienstleister oder Berater.</p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs font-semibold text-muted">
              Bezeichnung
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="z. B. Berater XY"
                className="rounded-full border-2 border-ink bg-paper px-4 py-2 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-deep"
              />
            </label>
            <label className="flex w-24 flex-col gap-1 text-xs font-semibold text-muted">
              €/Stunde
              <input
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                placeholder="120"
                inputMode="decimal"
                className="rounded-full border-2 border-ink bg-paper px-4 py-2 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-deep"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
              Gruppe
              <select
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value as RateGroup)}
                className="rounded-full border-2 border-ink bg-paper px-4 py-2 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-deep"
              >
                {GROUP_ORDER.map((g) => (
                  <option key={g} value={g}>
                    {GROUP_LABELS[g]}
                  </option>
                ))}
              </select>
            </label>
            <button onClick={addRate} className="pill-btn pill-btn-primary px-5 py-2 text-sm">
              + Anlegen
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
