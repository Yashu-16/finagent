import { AgentPosition } from "@/lib/api";

const AGENT_META: Record<string, { emoji: string; color: string; bg: string }> = {
  CEO: { emoji: "👔", color: "#818cf8", bg: "rgba(99,102,241,0.1)" },
  CFO: { emoji: "💰", color: "#34d399", bg: "rgba(52,211,153,0.1)" },
  CMO: { emoji: "📣", color: "#fb923c", bg: "rgba(251,146,60,0.1)" },
  Risk: { emoji: "🛡️", color: "#f87171", bg: "rgba(248,113,113,0.1)" },
};

const STANCE_STYLE: Record<string, { label: string; color: string }> = {
  approve:     { label: "Approve",      color: "#10b981" },
  conditional: { label: "Conditional",  color: "#f59e0b" },
  reject:      { label: "Reject",       color: "#ef4444" },
};

export default function AgentCard({ position, index }: { position: AgentPosition; index: number }) {
  const meta = AGENT_META[position.agent] ?? { emoji: "🤖", color: "#9ca3af", bg: "rgba(156,163,175,0.1)" };
  const stance = STANCE_STYLE[position.stance] ?? STANCE_STYLE.conditional;

  return (
    <div
      className="fade-in-up rounded-xl p-5 border"
      style={{
        background: meta.bg,
        borderColor: meta.color + "40",
        animationDelay: `${index * 0.1}s`,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{meta.emoji}</span>
          <div>
            <div className="font-semibold text-sm" style={{ color: meta.color }}>
              {position.agent}
            </div>
            <div className="text-xs text-gray-400">{position.role}</div>
          </div>
        </div>
        <span
          className="text-xs font-semibold px-2 py-1 rounded-full"
          style={{ background: stance.color + "20", color: stance.color }}
        >
          {stance.label}
        </span>
      </div>

      <p className="text-sm text-gray-300 leading-relaxed mb-3">{position.reasoning}</p>

      <div className="rounded-lg p-3" style={{ background: "rgba(0,0,0,0.2)" }}>
        <div className="text-xs text-gray-400 mb-1">Key concern</div>
        <p className="text-xs text-gray-200">{position.key_concern}</p>
      </div>
    </div>
  );
}