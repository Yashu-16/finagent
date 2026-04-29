"use client";
import { useEffect, useState } from "react";

interface AgentState {
  stance: "approve" | "reject" | "conditional" | "idle";
  active: boolean;
  hasSpoken: boolean;
}

interface Props {
  agentStates: Record<string, AgentState>;
  finalConfidence?: number;
  finalVerdict?: string;
  customWeights?: Record<string, number>;
}

const AGENT_META: Record<string, { color: string; emoji: string; realName: string }> = {
  CEO:  { color: "#3b5bdb", emoji: "🚀", realName: "Elon Musk" },
  CFO:  { color: "#0d7a4e", emoji: "💳", realName: "Sachin Mehra" },
  CMO:  { color: "#c2410c", emoji: "📊", realName: "Julia White" },
  Risk: { color: "#6d28d9", emoji: "🏦", realName: "Ashley Bacon" },
};

const STANCE_SCORE: Record<string, number> = {
  approve: 1.0, conditional: 0.5, reject: 0.0, idle: 0.5,
};

const STANCE_STYLE: Record<string, { color: string; bg: string; border: string; label: string }> = {
  approve:     { color: "#0d7a4e", bg: "#e8f8f1", border: "#a8dfc5", label: "Approve" },
  conditional: { color: "#b45309", bg: "#fef9ec", border: "#f0d080", label: "Conditional" },
  reject:      { color: "#c0392b", bg: "#fdf0ee", border: "#f5b8b2", label: "Reject" },
  idle:        { color: "#8a9bb8", bg: "#f4f6fa", border: "#e2e6f0", label: "Pending" },
};

const DEFAULT_WEIGHTS: Record<string, number> = {
  CEO: 0.50, CFO: 0.17, CMO: 0.17, Risk: 0.16,
};

export default function ConfidenceMeter({ agentStates, finalConfidence, finalVerdict, customWeights }: Props) {
  const [displayScore, setDisplayScore] = useState(50);

  // Convert customWeights from percentages (50,17,17,16) to fractions (0.50,0.17,0.17,0.16)
  const weights: Record<string, number> = customWeights
    ? Object.fromEntries(Object.entries(customWeights).map(([k, v]) => [k, v / 100]))
    : DEFAULT_WEIGHTS;

  const liveScore = (() => {
    let totalWeight = 0;
    let weightedSum = 0;
    for (const [agent, state] of Object.entries(agentStates)) {
      if (!state.hasSpoken) continue;
      const w = weights[agent] ?? 0.17;
      const s = STANCE_SCORE[state.stance] ?? 0.5;
      weightedSum += w * s;
      totalWeight += w;
    }
    return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 50;
  })();

  const score = finalConfidence !== undefined
    ? Math.round(finalConfidence * 100)
    : liveScore;

  const anySpoken = Object.values(agentStates).some(s => s.hasSpoken);

  useEffect(() => {
    const diff = score - displayScore;
    const steps = 24;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setDisplayScore(prev => {
        const next = Math.round(prev + diff / steps);
        if (step >= steps) { clearInterval(interval); return score; }
        return next;
      });
    }, 25);
    return () => clearInterval(interval);
  }, [score]);

  const verdict = finalVerdict ||
    (displayScore >= 70 ? "Approve" : displayScore >= 45 ? "Conditional" : "Reject");

  const verdictStyle = verdict === "Approve" || verdict === "Approved"
    ? { color: "#0d7a4e", trackColor: "#0d7a4e" }
    : verdict === "Reject" || verdict === "Rejected"
    ? { color: "#c0392b", trackColor: "#c0392b" }
    : { color: "#b45309", trackColor: "#b45309" };

  // SVG arc helpers
  const R = 52;
  const cx = 68;
  const cy = 72;
  const startAngle = -210;
  const endAngle = 30;
  const totalDeg = endAngle - startAngle;

  function polarToXY(angle: number, r: number) {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function arcPath(from: number, to: number, r: number) {
    const s = polarToXY(from, r);
    const e = polarToXY(to, r);
    const large = to - from > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  const scoreDeg = startAngle + (displayScore / 100) * totalDeg;
  const needle = polarToXY(scoreDeg, R - 8);

  return (
    <div style={{
      background: "#ffffff",
      border: "1px solid #e2e6f0",
      borderRadius: 14,
      padding: "14px 18px",
      boxShadow: "0 1px 4px rgba(30,40,80,0.08)",
    }}>
      {/* Header */}
      <div style={{
        fontSize: 11, fontWeight: 700, color: "#8a9bb8",
        letterSpacing: "0.08em", marginBottom: 12,
        textTransform: "uppercase" as const,
      }}>
        Live Board Confidence
      </div>

      <div style={{ display: "flex", gap: 20, alignItems: "center" }}>

        {/* Gauge */}
        <div style={{ flexShrink: 0 }}>
          <svg width={136} height={92} viewBox="0 0 136 92">
            {/* Background track */}
            <path d={arcPath(startAngle, endAngle, R)} fill="none" stroke="#f0f3f9" strokeWidth={10} strokeLinecap="round" />
            {/* Zone: reject */}
            <path d={arcPath(startAngle, startAngle + totalDeg * 0.45, R)} fill="none" stroke="#fde8e6" strokeWidth={10} strokeLinecap="round" />
            {/* Zone: conditional */}
            <path d={arcPath(startAngle + totalDeg * 0.45, startAngle + totalDeg * 0.70, R)} fill="none" stroke="#fef3d0" strokeWidth={10} strokeLinecap="round" />
            {/* Zone: approve */}
            <path d={arcPath(startAngle + totalDeg * 0.70, endAngle, R)} fill="none" stroke="#d4f4e7" strokeWidth={10} strokeLinecap="round" />

            {/* Active fill */}
            {anySpoken && (
              <path
                d={arcPath(startAngle, scoreDeg, R)}
                fill="none" stroke={verdictStyle.trackColor} strokeWidth={10}
                strokeLinecap="round"
                style={{ transition: "all 0.4s ease" }}
              />
            )}

            {/* Needle dot */}
            {anySpoken && (
              <circle
                cx={needle.x} cy={needle.y} r={5}
                fill={verdictStyle.color} stroke="#ffffff" strokeWidth={2}
                style={{ transition: "all 0.4s ease" }}
              />
            )}

            {/* Center score */}
            <text x={cx} y={cy + 6} textAnchor="middle" style={{
              fontFamily: "Inter, sans-serif",
              fontSize: anySpoken ? 22 : 18,
              fontWeight: 800,
              fill: anySpoken ? verdictStyle.color : "#c0c8d8",
            }}>
              {anySpoken ? `${displayScore}%` : "--"}
            </text>
            <text x={cx} y={cy + 20} textAnchor="middle" style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 9, fontWeight: 600,
              fill: anySpoken ? verdictStyle.color : "#c0c8d8",
              letterSpacing: "0.08em",
            }}>
              {anySpoken ? verdict.toUpperCase() : "PENDING"}
            </text>
          </svg>
        </div>

        {/* Per-agent bars */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          {Object.entries(AGENT_META).map(([key, meta]) => {
            const state = agentStates[key];
            const spoken = state?.hasSpoken;
            const stance = state?.stance || "idle";
            const sc = STANCE_SCORE[stance] ?? 0.5;
            const w = weights[key] ?? 0.17;
            const ss = STANCE_STYLE[stance];
            const wPct = Math.round(w * 100);

            return (
              <div key={key}>
                {/* Label row */}
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", marginBottom: 4,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13 }}>{meta.emoji}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: spoken ? meta.color : "#c0c8d8" }}>
                      {meta.realName.split(" ")[0]}
                    </span>
                    <span style={{
                      fontSize: 11, color: "#8a9bb8", fontFamily: "monospace",
                      background: "#f4f6fa", border: "1px solid #e2e6f0",
                      padding: "1px 5px", borderRadius: 4,
                    }}>
                      {wPct}%
                    </span>
                  </div>
                  {spoken ? (
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      color: ss.color, background: ss.bg,
                      border: `1px solid ${ss.border}`,
                      padding: "1px 8px", borderRadius: 20,
                      textTransform: "uppercase" as const,
                    }}>
                      {ss.label}
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: "#c0c8d8" }}>—</span>
                  )}
                </div>

                {/* Progress bar */}
                <div style={{
                  height: 6, borderRadius: 99,
                  background: "#f0f3f9", overflow: "hidden",
                  border: "1px solid #e2e6f0",
                }}>
                  <div style={{
                    height: "100%",
                    width: spoken ? `${sc * 100}%` : "0%",
                    background: ss.color,
                    borderRadius: 99,
                    transition: "width 0.6s cubic-bezier(0.16,1,0.3,1)",
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}