"use client";
import { useState, useEffect, useRef } from "react";

interface Message {
  id: string;
  agent: string;
  text: string;
  stance: string;
  kind: "position" | "debate" | "system";
  round?: number;
  target?: string;
}

interface Props {
  messages: Message[];
  onClose: () => void;
}

const AGENT_META: Record<string, { color: string; emoji: string; realName: string }> = {
  CEO:  { color: "#7c9ee8", emoji: "🚀", realName: "Elon Musk" },
  CFO:  { color: "#2dd4a0", emoji: "💳", realName: "Sachin Mehra" },
  CMO:  { color: "#e87c4a", emoji: "📊", realName: "Julia White" },
  Risk: { color: "#c47ce8", emoji: "🏦", realName: "Ashley Bacon" },
};

const STANCE_COLOR: Record<string, string> = {
  approve: "#2dd4a0", conditional: "#e8a830", reject: "#e85555",
};

export default function ReplayTimeline({ messages, onClose }: Props) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1200);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!playing) return;
    if (visibleCount >= messages.length) { setPlaying(false); return; }
    const t = setTimeout(() => setVisibleCount(v => v + 1), speed);
    return () => clearTimeout(t);
  }, [playing, visibleCount, speed]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleCount]);

  const visible = messages.slice(0, visibleCount);
  const progress = messages.length > 0 ? (visibleCount / messages.length) * 100 : 0;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500,
      background: "rgba(0,0,0,0.85)",
      backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    }}>
      <div style={{
        width: "100%", maxWidth: 680,
        maxHeight: "90vh",
        background: "#0d1520",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "14px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
        }}>
          <span style={{ fontFamily: "Playfair Display, serif", fontSize: 15, color: "#c9a84c" }}>
            📽 Debate Replay
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${progress}%`,
                background: "linear-gradient(90deg, #c9a84c, #e8d070)",
                borderRadius: 99, transition: "width 0.4s ease",
              }} />
            </div>
          </div>
          <span style={{ fontSize: 10, color: "#4a566e", fontFamily: "DM Mono, monospace" }}>
            {visibleCount}/{messages.length}
          </span>

          {/* Controls */}
          <div style={{ display: "flex", gap: 5 }}>
            <button onClick={() => setPlaying(v => !v)} style={{
              fontSize: 10, padding: "3px 10px", borderRadius: 6,
              background: "rgba(201,168,76,0.15)", border: "1px solid rgba(201,168,76,0.3)",
              color: "#c9a84c", cursor: "pointer", fontFamily: "DM Sans, sans-serif",
            }}>
              {playing ? "⏸ Pause" : "▶ Play"}
            </button>
            <select value={speed} onChange={e => setSpeed(+e.target.value)} style={{
              fontSize: 10, padding: "3px 6px", borderRadius: 6,
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
              color: "#4a566e", cursor: "pointer", outline: "none",
              fontFamily: "DM Sans, sans-serif",
            }}>
              <option value={2000}>0.5x</option>
              <option value={1200}>1x</option>
              <option value={600}>2x</option>
              <option value={200}>5x</option>
            </select>
            <button onClick={() => { setVisibleCount(0); setPlaying(true); }} style={{
              fontSize: 10, padding: "3px 10px", borderRadius: 6,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              color: "#4a566e", cursor: "pointer", fontFamily: "DM Sans, sans-serif",
            }}>
              ↩ Restart
            </button>
            <button onClick={onClose} style={{
              fontSize: 10, padding: "3px 10px", borderRadius: 6,
              background: "rgba(232,85,85,0.1)", border: "1px solid rgba(232,85,85,0.25)",
              color: "#e85555", cursor: "pointer", fontFamily: "DM Sans, sans-serif",
            }}>
              ✕ Close
            </button>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 8px" }}>
          {visible.map((msg, i) => {
            if (msg.kind === "system") {
              return (
                <div key={msg.id} className="fade-in" style={{
                  textAlign: "center", margin: "16px 0 12px",
                  fontSize: 10, color: "#c9a84c",
                  letterSpacing: "0.15em", opacity: 0.8,
                }}>{msg.text}</div>
              );
            }
            const meta = AGENT_META[msg.agent];
            const color = meta?.color || "#888";
            const stanceColor = STANCE_COLOR[msg.stance] || "#4a566e";
            return (
              <div key={msg.id} className="fade-up" style={{
                marginBottom: 14,
                animationDelay: "0s",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                  <span style={{ fontSize: 14 }}>{meta?.emoji}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color }}>{meta?.realName}</span>
                  <span style={{ fontSize: 9, color: "#4a566e" }}>({msg.agent})</span>
                  {msg.target && (
                    <>
                      <span style={{ fontSize: 10, color: "#4a566e" }}>→</span>
                      <span style={{ fontSize: 11, color: AGENT_META[msg.target]?.color || "#4a566e" }}>
                        {AGENT_META[msg.target]?.realName}
                      </span>
                    </>
                  )}
                  {msg.round && (
                    <span style={{ fontSize: 9, color: "#4a566e" }}>Round {msg.round}</span>
                  )}
                  <span style={{
                    marginLeft: "auto", fontSize: 9, fontWeight: 600,
                    color: stanceColor, background: stanceColor + "18",
                    padding: "2px 8px", borderRadius: 99,
                    textTransform: "uppercase" as const,
                    border: `1px solid ${stanceColor}30`,
                  }}>{msg.stance}</span>
                </div>
                <div style={{
                  background: color + "0d",
                  border: `1px solid ${color}22`,
                  borderRadius: "4px 12px 12px 12px",
                  padding: "10px 14px",
                  fontSize: 12, lineHeight: 1.7, color: "#d8dce8",
                }}>
                  {msg.text}
                </div>
                {/* Timeline dot */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, marginTop: 6,
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: color, flexShrink: 0,
                    boxShadow: `0 0 6px ${color}`,
                  }} />
                  <div style={{
                    flex: 1, height: 1,
                    background: `linear-gradient(90deg, ${color}30, transparent)`,
                  }} />
                  <span style={{ fontSize: 8, color: "#2a3040" }}>
                    {msg.kind === "position" ? "Initial position" : `Debate R${msg.round}`}
                  </span>
                </div>
              </div>
            );
          })}
          {playing && visibleCount < messages.length && (
            <div style={{ display: "flex", gap: 5, padding: "4px 0 8px", alignItems: "center" }}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width: 5, height: 5, borderRadius: "50%", background: "#4a566e",
                  animation: `blink 1.2s ease ${i*0.2}s infinite`,
                }} />
              ))}
            </div>
          )}
          {!playing && visibleCount >= messages.length && (
            <div style={{
              textAlign: "center", padding: "20px 0",
              fontSize: 12, color: "#4a566e",
            }}>
              ── End of debate ──
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}