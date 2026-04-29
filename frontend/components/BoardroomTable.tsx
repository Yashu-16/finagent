import { AgentPosition } from "@/lib/api";

const AGENTS = [
  { key: "CEO",  label: "CEO",  title: "Chief Executive Officer",  color: "#7c9ee8", emoji: "👔", pos: "top" },
  { key: "CFO",  label: "CFO",  title: "Chief Financial Officer",  color: "#2dd4a0", emoji: "💰", pos: "left" },
  { key: "CMO",  label: "CMO",  title: "Chief Marketing Officer",  color: "#e87c4a", emoji: "📣", pos: "right" },
  { key: "Risk", label: "Risk", title: "Risk Analyst",             color: "#c47ce8", emoji: "🛡️", pos: "bottom" },
];

const STANCE_LABEL: Record<string, { text: string; color: string }> = {
  approve:     { text: "Approve",     color: "#2dd4a0" },
  conditional: { text: "Conditional", color: "#e8a830" },
  reject:      { text: "Reject",      color: "#e85555" },
};

interface Props {
  positions: AgentPosition[];
  activeAgent?: string;
  loading?: boolean;
}

export default function BoardroomTable({ positions, activeAgent, loading }: Props) {
  const getPos = (key: string) => positions.find(p => p.agent === key);

  return (
    <div className="relative flex items-center justify-center" style={{ height: 480 }}>

      {/* Ambient glow behind table */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(201,168,76,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Oval table */}
      <div style={{
        width: 340, height: 200,
        background: "linear-gradient(160deg, #141f30 0%, #0d1720 100%)",
        borderRadius: "50%",
        border: "1px solid rgba(201,168,76,0.2)",
        boxShadow: "0 0 60px rgba(0,0,0,0.8), inset 0 1px 0 rgba(201,168,76,0.1)",
        position: "relative",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {/* Table surface detail */}
        <div style={{
          width: 200, height: 110,
          borderRadius: "50%",
          border: "1px solid rgba(201,168,76,0.08)",
        }} />
        {/* Center logo */}
        <div style={{
          position: "absolute",
          fontFamily: "Playfair Display, serif",
          fontSize: 11,
          color: "rgba(201,168,76,0.3)",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
        }}>
          FinAgent
        </div>
      </div>

      {/* Seats */}
      {AGENTS.map((agent) => {
        const pos = getPos(agent.key);
        const isActive = activeAgent === agent.key;
        const stance = pos ? STANCE_LABEL[pos.stance] : null;

        const seatPos: Record<string, React.CSSProperties> = {
          top:    { top: 10,  left: "50%", transform: "translateX(-50%)" },
          bottom: { bottom: 10, left: "50%", transform: "translateX(-50%)" },
          left:   { left: 20,  top: "50%", transform: "translateY(-50%)" },
          right:  { right: 20, top: "50%", transform: "translateY(-50%)" },
        };

        return (
          <div key={agent.key} style={{ position: "absolute", ...seatPos[agent.pos] }}>
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
              animation: pos ? "fadeUp 0.5s ease both" : undefined,
            }}>
              {/* Avatar */}
              <div style={{ position: "relative" }}>
                {/* Ripple when active */}
                {isActive && (
                  <>
                    <div style={{
                      position: "absolute", inset: -4,
                      borderRadius: "50%",
                      border: `2px solid ${agent.color}`,
                      animation: "ripple 1.2s ease-out infinite",
                      color: agent.color,
                    }} />
                    <div style={{
                      position: "absolute", inset: -4,
                      borderRadius: "50%",
                      border: `2px solid ${agent.color}`,
                      animation: "ripple 1.2s ease-out 0.4s infinite",
                      color: agent.color,
                    }} />
                  </>
                )}
                <div style={{
                  width: 56, height: 56,
                  borderRadius: "50%",
                  background: `radial-gradient(circle at 35% 35%, ${agent.color}30, ${agent.color}10)`,
                  border: `2px solid ${isActive ? agent.color : agent.color + "40"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22,
                  transition: "border-color 0.3s",
                  boxShadow: isActive ? `0 0 20px ${agent.color}50` : "none",
                }}>
                  {agent.emoji}
                </div>

                {/* Stance dot */}
                {stance && (
                  <div style={{
                    position: "absolute", bottom: 0, right: 0,
                    width: 14, height: 14,
                    borderRadius: "50%",
                    background: stance.color,
                    border: "2px solid var(--bg)",
                    boxShadow: `0 0 8px ${stance.color}`,
                  }} />
                )}

                {/* Loading pulse */}
                {loading && !pos && (
                  <div style={{
                    position: "absolute", inset: 0,
                    borderRadius: "50%",
                    background: agent.color + "20",
                    animation: "pulse 1.5s ease infinite",
                  }} />
                )}
              </div>

              {/* Name plate */}
              <div style={{
                background: "rgba(13,20,32,0.95)",
                border: `1px solid ${isActive ? agent.color + "60" : "rgba(255,255,255,0.07)"}`,
                borderRadius: 8,
                padding: "4px 10px",
                textAlign: "center",
                transition: "border-color 0.3s",
                minWidth: 80,
              }}>
                <div style={{
                  fontFamily: "Playfair Display, serif",
                  fontSize: 13,
                  fontWeight: 600,
                  color: agent.color,
                }}>
                  {agent.label}
                </div>
                <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.05em" }}>
                  {agent.title.split(" ").slice(-1)[0].toUpperCase()}
                </div>
                {stance && (
                  <div style={{
                    fontSize: 9, marginTop: 2,
                    color: stance.color,
                    fontWeight: 500,
                  }}>
                    {stance.text}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}