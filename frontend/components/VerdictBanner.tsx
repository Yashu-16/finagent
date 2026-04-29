import { FinalDecision } from "@/lib/api";

const STYLE: Record<string, { color: string; glow: string; icon: string }> = {
  "Approved":             { color: "#2dd4a0", glow: "rgba(45,212,160,0.2)",  icon: "✓" },
  "Conditional Approval": { color: "#e8a830", glow: "rgba(232,168,48,0.2)",  icon: "◈" },
  "Rejected":             { color: "#e85555", glow: "rgba(232,85,85,0.2)",   icon: "✕" },
};

export default function VerdictBanner({ decision, sessionId }: { decision: FinalDecision; sessionId: string }) {
  const s = STYLE[decision.verdict] ?? STYLE["Conditional Approval"];
  const pct = Math.round(decision.confidence * 100);

  return (
    <div className="fade-up" style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Verdict */}
      <div style={{
        background: s.glow,
        border: `1px solid ${s.color}40`,
        borderRadius: 12,
        padding: "16px 20px",
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          background: s.color + "20",
          border: `2px solid ${s.color}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, color: s.color, fontWeight: 700,
          flexShrink: 0,
          boxShadow: `0 0 20px ${s.color}40`,
        }}>
          {s.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.15em", marginBottom: 2 }}>
            BOARD VERDICT
          </div>
          <div style={{
            fontFamily: "Playfair Display, serif",
            fontSize: 20, fontWeight: 700,
            color: s.color,
          }}>
            {decision.verdict}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: s.color, fontFamily: "DM Mono, monospace" }}>
            {pct}%
          </div>
          <div style={{ fontSize: 10, color: "var(--muted)" }}>confidence</div>
        </div>
      </div>

      {/* Confidence bar */}
      <div>
        <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${pct}%`,
            background: `linear-gradient(90deg, ${s.color}80, ${s.color})`,
            borderRadius: 99,
            transition: "width 1s ease",
          }} />
        </div>
      </div>

      {/* Rationale */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid var(--border)",
        borderRadius: 10, padding: "12px 14px",
        fontSize: 12, lineHeight: 1.7, color: "#a0aec0",
      }}>
        <div style={{ fontSize: 9, color: "var(--muted)", marginBottom: 6, letterSpacing: "0.12em" }}>
          EXECUTIVE RATIONALE
        </div>
        {decision.rationale}
      </div>

      {/* Arguments + Disagreements */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{
          background: "rgba(45,212,160,0.04)",
          border: "1px solid rgba(45,212,160,0.15)",
          borderRadius: 10, padding: "12px 14px",
        }}>
          <div style={{ fontSize: 9, color: "#2dd4a0", marginBottom: 8, letterSpacing: "0.12em" }}>
            SUPPORTING
          </div>
          {decision.supporting_arguments.map((a, i) => (
            <div key={i} style={{ fontSize: 11, color: "#a0aec0", marginBottom: 6, display: "flex", gap: 6 }}>
              <span style={{ color: "#2dd4a0", flexShrink: 0 }}>✓</span>
              <span>{a}</span>
            </div>
          ))}
        </div>
        <div style={{
          background: "rgba(232,85,85,0.04)",
          border: "1px solid rgba(232,85,85,0.15)",
          borderRadius: 10, padding: "12px 14px",
        }}>
          <div style={{ fontSize: 9, color: "#e85555", marginBottom: 8, letterSpacing: "0.12em" }}>
            DISAGREEMENTS
          </div>
          {decision.disagreements.map((d, i) => (
            <div key={i} style={{ fontSize: 11, color: "#a0aec0", marginBottom: 6, display: "flex", gap: 6 }}>
              <span style={{ color: "#e85555", flexShrink: 0 }}>↔</span>
              <span>{d}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 10, color: "var(--muted)", textAlign: "center" }}>
        Session <span style={{ fontFamily: "DM Mono, monospace", color: "var(--accent)" }}>{sessionId}</span>
      </div>
    </div>
  );
}