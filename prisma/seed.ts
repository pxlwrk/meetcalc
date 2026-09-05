import { PrismaClient, RateGroup } from "@prisma/client";

const prisma = new PrismaClient();

const BMF_SOURCE = "BMF PSK 2025 (Rundschreiben v. 08.06.2026)";

// Vollkosten-Stundensätze, berechnet nach der BMF-Zuschlagskalkulation
// (Personaleinzelkosten + Sacheinzelkosten, zzgl. Gemeinkostenzuschlag,
// geteilt durch Jahresarbeitsstunden). Siehe Projekt-Plan für Herleitung.
const bmfRates: { name: string; hourlyRate: number; group: RateGroup }[] = [
  { name: "Einfacher Dienst – oberste Bundesbehörde", hourlyRate: 81.34, group: "BEAMTE" },
  { name: "Einfacher Dienst – nachgeordnete Behörde", hourlyRate: 74.9, group: "BEAMTE" },
  { name: "Mittlerer Dienst – oberste Bundesbehörde", hourlyRate: 91.76, group: "BEAMTE" },
  { name: "Mittlerer Dienst – nachgeordnete Behörde", hourlyRate: 82.51, group: "BEAMTE" },
  { name: "Gehobener Dienst – oberste Bundesbehörde", hourlyRate: 115.87, group: "BEAMTE" },
  { name: "Gehobener Dienst – nachgeordnete Behörde", hourlyRate: 99.26, group: "BEAMTE" },
  { name: "Höherer Dienst (A/B) – oberste Bundesbehörde", hourlyRate: 150.97, group: "BEAMTE" },
  { name: "Höherer Dienst (A/B) – nachgeordnete Behörde", hourlyRate: 130.61, group: "BEAMTE" },
  { name: "TVöD E2–E4 – oberste Bundesbehörde", hourlyRate: 82.21, group: "TARIF" },
  { name: "TVöD E2–E4 – nachgeordnete Behörde", hourlyRate: 74.58, group: "TARIF" },
  { name: "TVöD E5–E9a – oberste Bundesbehörde", hourlyRate: 92.02, group: "TARIF" },
  { name: "TVöD E5–E9a – nachgeordnete Behörde", hourlyRate: 82.34, group: "TARIF" },
  { name: "TVöD E9b–E12 – oberste Bundesbehörde", hourlyRate: 117.03, group: "TARIF" },
  { name: "TVöD E9b–E12 – nachgeordnete Behörde", hourlyRate: 102.61, group: "TARIF" },
  { name: "TVöD E13–E15Ü – oberste Bundesbehörde", hourlyRate: 125.19, group: "TARIF" },
  { name: "TVöD E13–E15Ü – nachgeordnete Behörde", hourlyRate: 113.56, group: "TARIF" },
  { name: "Außertariflich (AT B3–B6) – oberste Bundesbehörde", hourlyRate: 166.57, group: "TARIF" },
  { name: "Außertariflich (AT B3–B6) – nachgeordnete Behörde", hourlyRate: 159.15, group: "TARIF" },
];

async function main() {
  const existing = await prisma.rate.count();
  if (existing > 0) {
    console.log(`Überspringe Seed: ${existing} Sätze bereits vorhanden.`);
    return;
  }

  await prisma.rate.createMany({
    data: bmfRates.map((r) => ({
      name: r.name,
      hourlyRate: r.hourlyRate,
      group: r.group,
      source: BMF_SOURCE,
    })),
  });

  console.log(`${bmfRates.length} BMF-Sätze eingefügt.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
