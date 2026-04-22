import { DebateRound } from "@/lib/api";

const AGENT_COLOR: Record<string, string> = {
  CEO:  "#818cf8",
  CFO:  "#34d399",
  CMO:  "#fb923c",
  Risk: "#f87171",
};

const STANCE_COLOR: Record<string, string> = {
  approve:     "#10b981",
  conditional: "#f59e0b",
  reject:      "#ef4444",
};

export default function DebateTimeline({ rounds }: { rounds: DebateRound[] }) {
  return (
    <div className="space-y-6">
      {rounds.map((round) => (
        <div key={round.round_number}>
          <div className="flex items-center gap-3 mb-4">
            <div
              className="text-xs font-bold px-3 py-1 rounded-full"
              style={{ background: "rgba(99,102,241,0.2)", color: "#818cf8" }}
            >
              Round {round.round_number}
            </div>
            <div className="flex-1 h-px" style={{ background: "rgba(55,65,81,0.8)" }} />
          </div>

          <div className="space-y-3">
            {round.exchanges.map((ex, i) => (
              <div
                key={i}
                className="fade-in-up rounded-xl p-4 border"
                style={{
                  borderColor: AGENT_COLOR[ex.agent] + "30",
                  background: "rgba(17,24,39,0.8)",
                  animationDelay: `${i * 0.08}s`,
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded"
                    style={{ background: AGENT_COLOR[ex.agent] + "20", color: AGENT_COLOR[ex.agent] }}
                  >
                    {ex.agent}
                  </span>
                  <span className="text-gray-500 text-xs">→</span>
                  <span
                    className="text-xs px-2 py-0.5 rounded"
                    style={{ background: AGENT_COLOR[ex.target_agent] + "15", color: AGENT_COLOR[ex.target_agent] }}
                  >
                    {ex.target_agent}
                  </span>
                  <div className="ml-auto">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: STANCE_COLOR[ex.stance] + "20", color: STANCE_COLOR[ex.stance] }}
                    >
                      {ex.stance}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">{ex.argument}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}