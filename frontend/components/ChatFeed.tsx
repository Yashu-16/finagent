"use client";
import { useEffect, useRef } from "react";
import { AgentPosition, DebateRound } from "@/lib/api";

const AGENT_COLOR: Record<string, string> = {
  CEO:  "#7c9ee8",
  CFO:  "#2dd4a0",
  CMO:  "#e87c4a",
  Risk: "#c47ce8",
};

const AGENT_EMOJI: Record<string, string> = {
  CEO: "👔", CFO: "💰", CMO: "📣", Risk: "🛡️",
};

interface Message {
  id: string;
  agent: string;
  role: string;
  text: string;
  type: "position" | "debate";
  round?: number;
  target?: string;
  stance: string;
}

interface Props {
  positions: AgentPosition[];
  rounds: DebateRound[];
  loading?: boolean;
  loadingStep?: string;
}

const STANCE_COLOR: Record<string, string> = {
  approve: "#2dd4a0",
  conditional: "#e8a830",
  reject: "#e85555",
};

export default function ChatFeed({ positions, rounds, loading, loadingStep }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages: Message[] = [
    ...positions.map((p, i) => ({
      id: `pos-${i}`,
      agent: p.agent,
      role: p.role,
      text: p.reasoning,
      type: "position" as const,
      stance: p.stance,
    })),
    ...rounds.flatMap((r) =>
      r.exchanges.map((ex, i) => ({
        id: `r${r.round_number}-${i}`,
        agent: ex.agent,
        role: ex.agent,
        text: ex.argument,
        type: "debate" as const,
        round: r.round_number,
        target: ex.target_agent,
        stance: ex.stance,
      }))
    ),
  ];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, loading]);

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "var(--surface)", borderLeft: "1px solid var(--border)",
    }}>
      {/* Panel header */}
      <div style={{
        padding: "16px 20px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: loading ? "#e8a830" : messages.length > 0 ? "#2dd4a0" : "var(--muted)",
          boxShadow: loading ? "0 0 8px #e8a830" : messages.length > 0 ? "0 0 8px #2dd4a0" : "none",
          animation: loading ? "pulse 1s ease infinite" : "none",
        }} />
        <span style={{ fontFamily: "Playfair Display, serif", fontSize: 14, color: "var(--accent)" }}>
          Board Discussion
        </span>
        {messages.length > 0 && (
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)" }}>
            {messages.length} messages
          </span>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>
        {messages.length === 0 && !loading && (
          <div style={{ textAlign: "center", marginTop: 60, color: "var(--muted)" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🏛️</div>
            <div style={{ fontSize: 13 }}>The boardroom is quiet.</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>Submit a scenario to begin.</div>
          </div>
        )}

        {/* Round dividers + messages */}
        {(() => {
          const items: React.ReactNode[] = [];
          let lastRound = -1;

          // Initial positions header
          if (positions.length > 0) {
            items.push(
              <div key="header-pos" style={{
                textAlign: "center", margin: "8px 0 12px",
                fontSize: 10, color: "var(--muted)",
                letterSpacing: "0.15em", textTransform: "uppercase",
              }}>
                ── Initial Positions ──
              </div>
            );
          }

          messages.forEach((msg) => {
            if (msg.type === "debate" && msg.round !== lastRound) {
              lastRound = msg.round!;
              items.push(
                <div key={`round-${msg.round}`} style={{
                  textAlign: "center", margin: "16px 0 12px",
                  fontSize: 10, color: "var(--accent)",
                  letterSpacing: "0.15em", textTransform: "uppercase",
                }}>
                  ── Debate Round {msg.round} ──
                </div>
              );
            }

            const color = AGENT_COLOR[msg.agent] || "#888";
            const emoji = AGENT_EMOJI[msg.agent] || "🤖";
            const stanceColor = STANCE_COLOR[msg.stance] || "var(--muted)";

            items.push(
              <div key={msg.id} className="slide-in" style={{
                marginBottom: 14,
                animationDelay: `${items.length * 0.04}s`,
              }}>
                {/* Agent header */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 6, marginBottom: 5,
                }}>
                  <span style={{ fontSize: 14 }}>{emoji}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color }}>{msg.agent}</span>
                  {msg.target && (
                    <>
                      <span style={{ fontSize: 10, color: "var(--muted)" }}>→</span>
                      <span style={{ fontSize: 11, color: AGENT_COLOR[msg.target] || "var(--muted)" }}>
                        {msg.target}
                      </span>
                    </>
                  )}
                  <span style={{
                    marginLeft: "auto",
                    fontSize: 9, fontWeight: 500,
                    color: stanceColor,
                    background: stanceColor + "18",
                    padding: "2px 7px", borderRadius: 99,
                  }}>
                    {msg.stance}
                  </span>
                </div>

                {/* Bubble */}
                <div style={{
                  background: color + "0d",
                  border: `1px solid ${color}22`,
                  borderRadius: "4px 12px 12px 12px",
                  padding: "10px 12px",
                  fontSize: 12,
                  lineHeight: 1.65,
                  color: "var(--text)",
                }}>
                  {msg.text}
                </div>
              </div>
            );
          });

          return items;
        })()}

        {/* Loading typing indicator */}
        {loading && (
          <div className="fade-in" style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
              <span style={{ fontSize: 10, color: "var(--muted)" }}>{loadingStep}</span>
            </div>
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--border)",
              borderRadius: "4px 12px 12px 12px",
              padding: "12px 16px",
              display: "flex", gap: 5, alignItems: "center",
            }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: "var(--muted)",
                  animation: `pulse 1.2s ease ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}