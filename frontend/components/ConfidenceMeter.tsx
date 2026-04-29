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
}

const WEIGHTS: Record<string, number> = {
  CEO: 0.50, CFO: 0.17, CMO: 0.17, Risk: 0.16,
};

const STANCE_SCORE: Record<string, number> = {
  approve: 1.0, conditional: 0.5, reject: 0.0, idle: 0.5,
};

const AGENT_META: Record<string, { color: string; emoji: string; realName: string }> = {
  CEO:  { color: "#7c9ee8", emoji: "🚀", realName: "Elon Musk" },
  CFO:  { color: "#2dd4a0", emoji: "💳", realName: "Sachin Mehra" },
  CMO:  { color: "#e87c4a", emoji: "📊", realName: "Julia White" },
  Risk: { color: "#c47ce8", emoji: "🏦", realName: "Ashley Bacon" },
};

export default function ConfidenceMeter({ agentStates, finalConfidence, finalVerdict }: Props) {
  const [displayScore, setDisplayScore] = useState(50);
  const [prevScore, setPrevScore] = useState(50);

  // Calculate live weighted score from current stances
  const liveScore = (() => {
    let totalWeight = 0;
    let weightedSum = 0;
    for (const [agent, state] of Object.entries(agentStates)) {
      if (!state.hasSpoken) continue;
      const w = WEIGHTS[agent] || 0.17;
      const s = STANCE_SCORE[state.stance] ?? 0.5;
      weightedSum += w * s;
      totalWeight += w;
    }
    return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 50;
  })();

  const score = finalConfidence !== undefined ? Math.round(finalConfidence * 100) : liveScore;
  const anySpoken = Object.values(agentStates).some(s => s.hasSpoken);

  useEffect(() => {
    setPrevScore(displayScore);
    const steps = 20;
    const diff = score - displayScore;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setDisplayScore(prev => {
        const next = Math.round(prev + (diff / steps));
        if (step >= steps) { clearInterval(interval); return score; }
        return next;
      });
    }, 30);
    return () => clearInterval(interval);
  }, [score]);

  const verdict = finalVerdict ||
    (score >= 70 ? "Approve" : score >= 45 ? "Conditional" : "Reject");
  const color = score >= 70 ? "#2dd4a0" : score >= 45 ? "#e8a830" : "#e85555";

  // Arc path for the gauge
  const R = 54;
  const cx = 70;
  const cy = 70;
  const startAngle = -210;
  const endAngle = 30;
  const totalDeg = endAngle - startAngle;
  const scoreDeg = startAngle + (displayScore / 100) * totalDeg;

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

  const needle = polarToXY(scoreDeg, R - 10);

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 14,
      padding: "14px 16px",
      margin: "0 12px 10px",
      flexShrink: 0,
    }}>
      <div style={{
        fontSize: 9, color: "#4a566e",
        letterSpacing: "0.15em", marginBottom: 12,
        textTransform: "uppercase",
      }}>
        Live Board Confidence
      </div>

      {/* Gauge */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <svg width={140} height={90} viewBox="0 0 140 90">
          {/* Background arc */}
          <path
            d={arcPath(startAngle, endAngle, R)}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10}
            strokeLinecap="round"
          />
          {/* Reject zone */}
          <path
            d={arcPath(startAngle, startAngle + totalDeg * 0.45, R)}
            fill="none" stroke="rgba(232,85,85,0.25)" strokeWidth={10}
            strokeLinecap="round"
          />
          {/* Conditional zone */}
          <path
            d={arcPath(startAngle + totalDeg * 0.45, startAngle + totalDeg * 0.70, R)}
            fill="none" stroke="rgba(232,168,48,0.25)" strokeWidth={10}
            strokeLinecap="round"
          />
          {/* Approve zone */}
          <path
            d={arcPath(startAngle + totalDeg * 0.70, endAngle, R)}
            fill="none" stroke="rgba(45,212,160,0.25)" strokeWidth={10}
            strokeLinecap="round"
          />

          {/* Active fill */}
          {anySpoken && (
            <path
              d={arcPath(startAngle, scoreDeg, R)}
              fill="none"
              stroke={color}
              strokeWidth={10}
              strokeLinecap="round"
              style={{ transition: "all 0.3s ease", filter: `drop-shadow(0 0 4px ${color})` }}
            />
          )}

          {/* Needle dot */}
          {anySpoken && (
            <circle
              cx={needle.x} cy={needle.y} r={5}
              fill={color}
              style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: "all 0.3s ease" }}
            />
          )}

          {/* Center score */}
          <text x={cx} y={cy + 8} textAnchor="middle"
            style={{ fontFamily: "DM Mono, monospace", fontSize: 22, fontWeight: 700, fill: anySpoken ? color : "#4a566e" }}>
            {anySpoken ? `${displayScore}%` : "--"}
          </text>
          <text x={cx} y={cy + 22} textAnchor="middle"
            style={{ fontSize: 8, fill: "#4a566e", fontFamily: "DM Sans, sans-serif", letterSpacing: "0.1em" }}>
            {anySpoken ? verdict.toUpperCase() : "PENDING"}
          </text>
        </svg>

        {/* Per-agent mini bars */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          {Object.entries(AGENT_META).map(([key, meta]) => {
            const state = agentStates[key];
            const spoken = state?.hasSpoken;
            const stance = state?.stance || "idle";
            const sc = STANCE_SCORE[stance] ?? 0.5;
            const w = WEIGHTS[key];
            const stanceColor = stance === "approve" ? "#2dd4a0"
              : stance === "reject" ? "#e85555"
              : stance === "conditional" ? "#e8a830"
              : "#2a3040";

            return (
              <div key={key}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 9, color: spoken ? meta.color : "#4a566e" }}>
                    {meta.emoji} {meta.realName.split(" ")[0]}
                  </span>
                  <span style={{ fontSize: 9, color: spoken ? stanceColor : "#2a3040", textTransform: "uppercase" }}>
                    {spoken ? stance : "—"}
                  </span>
                </div>
                <div style={{
                  height: 4, borderRadius: 99,
                  background: "rgba(255,255,255,0.05)",
                  overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%",
                    width: spoken ? `${sc * 100}%` : "0%",
                    background: stanceColor,
                    borderRadius: 99,
                    transition: "width 0.6s ease",
                    boxShadow: spoken ? `0 0 6px ${stanceColor}` : "none",
                  }} />
                </div>
                <div style={{ fontSize: 8, color: "#2a3040", marginTop: 1 }}>
                  {Math.round(w * 100)}% weight
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}