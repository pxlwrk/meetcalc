# MeetCalc — Sitzungskostenrechner

Zeigt die Kosten eines Meetings sekundengenau live an, auf Basis offizieller
Personalkostensätze des Bundes (BMF-Rundschreiben „Personal- und Sachkosten in
der Bundesverwaltung für Wirtschaftlichkeitsuntersuchungen und
Kostenberechnungen", PSK, Datenstand 2025) sowie frei definierbarer Sätze für
externe Teilnehmer (Dienstleister, Berater).

## Lokale Entwicklung

1. Postgres-Datenbank starten (Docker):

   ```bash
   docker run -d --name meetcalc-postgres \
     -e POSTGRES_USER=meetcalc -e POSTGRES_PASSWORD=meetcalc -e POSTGRES_DB=meetcalc \
     -p 55432:5432 postgres:16-alpine
   ```

2. `.env` anlegen (siehe `.env.example`) mit der `DATABASE_URL`.

3. Abhängigkeiten installieren, Datenbankschema anwenden und BMF-Sätze einspielen:

   ```bash
   npm install
   npx prisma migrate dev
   npx prisma db seed
   ```

4. Dev-Server starten:

   ```bash
   npm run dev
   ```

   Die App läuft dann unter [http://localhost:3000](http://localhost:3000),
   die Sätze-Verwaltung unter `/raten`.

## Datengrundlage

Die 18 vorbefüllten Stundensätze (Beamte nach Laufbahngruppe, Tarifbeschäftigte
nach TVöD-Entgeltgruppe, jeweils für oberste und nachgeordnete
Bundesbehörden) sind Vollkosten-Stundensätze: Gehalt/Bezüge, Versorgung bzw.
Personalnebenkosten, anteilige Sachkosten (Büro, IT, Investitionen) und
Gemeinkostenzuschlag, berechnet nach der BMF-Zuschlagskalkulation. Sie sind
gerundete Näherungswerte für Orientierungszwecke, keine verbindliche Kosten-
und Leistungsrechnung. Herleitung siehe `prisma/seed.ts` und der Projektplan.

Externe Sätze (Dienstleister, Berater) haben keine amtliche Quelle und werden
frei über die Sätze-Verwaltung (`/raten`) gepflegt.

## Deployment

Für ein Deployment auf Vercel wird ein Vercel-Projekt sowie eine
Postgres-Datenbank (z. B. Vercel Postgres oder Neon) benötigt; `DATABASE_URL`
muss als Umgebungsvariable gesetzt und `npx prisma migrate deploy` sowie
`npx prisma db seed` beim ersten Rollout ausgeführt werden.
