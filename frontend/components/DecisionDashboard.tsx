import { FinalDecision } from "@/lib/api";

const VERDICT_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  "Approved":             { color: "#10b981", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.3)"  },
  "Conditional Approval": { color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.3)"  },
  "Rejected":             { color: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.3)"   },
};

export default function DecisionDashboard({ decision, sessionId }: { decision: FinalDecision; sessionId: string }) {
  const style = VERDICT_STYLE[decision.verdict] ?? VERDICT_STYLE["Conditional Approval"];
  const pct = Math.round(decision.confidence * 100);

  return (
    <div className="fade-in-up space-y-5">
      {/* Verdict header */}
      <div
        className="rounded-2xl p-6 border text-center"
        style={{ background: style.bg, borderColor: style.border }}
      >
        <div className="text-xs text-gray-400 mb-1 uppercase tracking-widest">Board Decision</div>
        <div className="text-3xl font-bold mb-4" style={{ color: style.color }}>
          {decision.verdict}
        </div>

        {/* Confidence bar */}
        <div className="max-w-xs mx-auto">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Confidence</span>
            <span style={{ color: style.color }}>{pct}%</span>
          </div>
          <div className="h-2 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }}>
            <div
              className="h-2 rounded-full transition-all duration-1000"
              style={{ width: `${pct}%`, background: style.color }}
            />
          </div>
        </div>

        <div className="mt-3 text-xs text-gray-500">Session: {sessionId}</div>
      </div>

      {/* Rationale */}
      <div className="rounded-xl p-5 border" style={{ background: "rgba(17,24,39,0.9)", borderColor: "#374151" }}>
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Executive Rationale</div>
        <p className="text-sm text-gray-200 leading-relaxed">{decision.rationale}</p>
      </div>

      {/* Supporting arguments */}
      <div className="rounded-xl p-5 border" style={{ background: "rgba(16,185,129,0.05)", borderColor: "rgba(16,185,129,0.2)" }}>
        <div className="text-xs font-semibold mb-3" style={{ color: "#10b981" }}>
          Supporting Arguments
        </div>
        <ul className="space-y-2">
          {decision.supporting_arguments.map((arg, i) => (
            <li key={i} className="flex gap-2 text-sm text-gray-300">
              <span style={{ color: "#10b981" }}>✓</span>
              <span>{arg}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Disagreements */}
      <div className="rounded-xl p-5 border" style={{ background: "rgba(239,68,68,0.05)", borderColor: "rgba(239,68,68,0.2)" }}>
        <div className="text-xs font-semibold mb-3" style={{ color: "#f87171" }}>
          Key Disagreements
        </div>
        <ul className="space-y-2">
          {decision.disagreements.map((d, i) => (
            <li key={i} className="flex gap-2 text-sm text-gray-300">
              <span style={{ color: "#f87171" }}>↔</span>
              <span>{d}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}