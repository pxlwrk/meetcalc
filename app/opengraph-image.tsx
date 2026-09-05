import { ImageResponse } from "next/og";

export const alt = "MeetCalc — Meetingkostenrechner";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#000000";
const PAPER = "#ffffff";
const PINK = "#ff90e8";
const MUTED = "#3a2e37";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: PINK,
          padding: 64,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: PAPER,
              border: `4px solid ${INK}`,
            }}
          />
          <div style={{ fontSize: 40, fontWeight: 900, color: INK, letterSpacing: -1 }}>
            MeetCalc
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: MUTED, letterSpacing: 6, textTransform: "uppercase" }}>
            Meetingkosten
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", marginTop: 8 }}>
            <div style={{ fontSize: 220, fontWeight: 900, color: INK, lineHeight: 1, letterSpacing: -6 }}>
              127
            </div>
            <div style={{ fontSize: 90, fontWeight: 900, color: MUTED, lineHeight: 1, paddingBottom: 18 }}>
              ,43&nbsp;€
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: INK, maxWidth: 760, lineHeight: 1.25 }}>
            Sekundengenau sehen, was ein Meeting wirklich kostet.
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {["BMF-Sätze", "Kostenlos"].map((label) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  padding: "10px 22px",
                  borderRadius: 999,
                  border: `3px solid ${INK}`,
                  background: PAPER,
                  fontSize: 22,
                  fontWeight: 800,
                  color: INK,
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
