"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import dynamic from "next/dynamic";
import { streamSimulation, StreamEvent, FinalDecision } from "@/lib/api";

const Office3D = dynamic(() => import("@/components/Office3D"), { ssr: false });

interface ChatMessage {
  id: string;
  agent: string;
  text: string;
  stance: string;
  kind: "position" | "debate" | "system";
  round?: number;
  target?: string;
}

interface AgentState {
  stance: "approve" | "reject" | "conditional" | "idle";
  active: boolean;
  hasSpoken: boolean;
}

const AGENT_META: Record<string, { color: string; emoji: string; title: string }> = {
  CEO:  { color: "#7c9ee8", emoji: "👔", title: "Chief Executive Officer" },
  CFO:  { color: "#2dd4a0", emoji: "💰", title: "Chief Financial Officer" },
  CMO:  { color: "#e87c4a", emoji: "📣", title: "Chief Marketing Officer" },
  Risk: { color: "#c47ce8", emoji: "🛡️", title: "Chief Risk Officer" },
};

const STANCE_COLOR: Record<string, string> = {
  approve: "#2dd4a0", conditional: "#e8a830", reject: "#e85555", idle: "#4a566e",
};

const SAMPLES = [
  "Should we launch a buy-now-pay-later product targeting millennials in Southeast Asia next quarter?",
  "Should we acquire a fintech startup specialising in AI-driven credit scoring for $120M?",
  "Should we shut down our physical branch network and go fully digital within 18 months?",
];

function ChatBubble({ msg, idx }: { msg: ChatMessage; idx: number }) {
  if (msg.kind === "system") {
    return (
      <div style={{
        textAlign: "center", margin: "14px 0 10px",
        fontSize: 9, color: "#c9a84c", letterSpacing: "0.15em", opacity: 0.8,
      }}>{msg.text}</div>
    );
  }
  const meta = AGENT_META[msg.agent];
  const color = meta?.color || "#888";
  const stanceColor = STANCE_COLOR[msg.stance] || "var(--muted)";
  return (
    <div className="slide-r" style={{ animationDelay: `${Math.min(idx * 0.02, 0.25)}s`, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
        <span style={{ fontSize: 12 }}>{meta?.emoji}</span>
        <span style={{ fontSize: 11, fontWeight: 500, color }}>{msg.agent}</span>
        {msg.target && (
          <>
            <span style={{ fontSize: 9, color: "var(--muted)" }}>→</span>
            <span style={{ fontSize: 10, color: AGENT_META[msg.target]?.color || "var(--muted)" }}>{msg.target}</span>
          </>
        )}
        {msg.round && <span style={{ fontSize: 9, color: "var(--muted)" }}>R{msg.round}</span>}
        <span style={{
          marginLeft: "auto", fontSize: 9, fontWeight: 600,
          color: stanceColor, background: stanceColor + "18",
          padding: "2px 6px", borderRadius: 99, textTransform: "uppercase" as const,
        }}>{msg.stance}</span>
      </div>
      <div style={{
        background: color + "0d", border: `1px solid ${color}22`,
        borderRadius: "4px 10px 10px 10px",
        padding: "8px 11px", fontSize: 11.5, lineHeight: 1.65, color: "var(--text)",
      }}>{msg.text}</div>
    </div>
  );
}

export default function Home() {
  const [scenario, setScenario] = useState("");
  const [rounds, setRounds] = useState(2);
  const [mode, setMode] = useState<"weighted" | "majority">("weighted");
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState("Ready");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [agentStates, setAgentStates] = useState<Record<string, AgentState>>({
    CEO:  { stance: "idle", active: false, hasSpoken: false },
    CFO:  { stance: "idle", active: false, hasSpoken: false },
    CMO:  { stance: "idle", active: false, hasSpoken: false },
    Risk: { stance: "idle", active: false, hasSpoken: false },
  });
  const [decision, setDecision] = useState<FinalDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInput, setShowInput] = useState(true);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const msgCounter = useRef(0);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function resetAll() {
    setAgentStates({
      CEO:  { stance: "idle", active: false, hasSpoken: false },
      CFO:  { stance: "idle", active: false, hasSpoken: false },
      CMO:  { stance: "idle", active: false, hasSpoken: false },
      Risk: { stance: "idle", active: false, hasSpoken: false },
    });
  }

  async function handleSimulate() {
    if (!scenario.trim() || loading) return;
    setLoading(true);
    setError(null);
    setMessages([]);
    setDecision(null);
    setShowInput(false);
    resetAll();
    setStatusText("Calling the board to order…");
    msgCounter.current = 0;

    try {
      await streamSimulation(scenario, { debate_rounds: rounds, decision_mode: mode }, (event: StreamEvent) => {
        switch (event.type) {
          case "session":
            setSessionId(event.session_id);
            break;
          case "status":
            setStatusText(event.text);
            if (event.agent) {
              setAgentStates(prev => ({
                ...prev,
                [event.agent!]: { ...prev[event.agent!], active: true },
              }));
            }
            break;
          case "round_start":
            setMessages(prev => [...prev, {
              id: `div-r${event.round}`, agent: "system",
              text: `── Debate Round ${event.round} ──`,
              stance: "idle", kind: "system",
            }]);
            // Deactivate all
            setAgentStates(prev => {
              const n = { ...prev };
              for (const k of Object.keys(n)) n[k] = { ...n[k], active: false };
              return n;
            });
            break;
          case "position": {
            const id = `pos-${msgCounter.current++}`;
            setAgentStates(prev => ({
              ...prev,
              [event.agent]: {
                stance: event.stance as AgentState["stance"],
                active: true, hasSpoken: true,
              },
            }));
            setMessages(prev => [...prev, {
              id, agent: event.agent, text: event.reasoning,
              stance: event.stance, kind: "position",
            }]);
            break;
          }
          case "exchange": {
            const id = `ex-${msgCounter.current++}`;
            setAgentStates(prev => {
              const n = { ...prev };
              for (const k of Object.keys(n)) n[k] = { ...n[k], active: false };
              n[event.agent] = { stance: event.stance as AgentState["stance"], active: true, hasSpoken: true };
              return n;
            });
            setMessages(prev => [...prev, {
              id, agent: event.agent, text: event.argument,
              stance: event.stance, kind: "debate",
              round: event.round, target: event.target_agent,
            }]);
            break;
          }
          case "decision":
            setDecision(event as unknown as FinalDecision);
            setStatusText("Board has reached a decision.");
            setAgentStates(prev => {
              const n = { ...prev };
              for (const k of Object.keys(n)) n[k] = { ...n[k], active: false };
              return n;
            });
            break;
          case "done":
            setLoading(false);
            setStatusText("Session complete.");
            break;
          case "error":
            setError(`${event.agent}: ${event.message}`);
            break;
        }
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Connection failed. Is the backend running on port 8000?");
      setLoading(false);
    }
  }

  const verdictColor = decision
    ? decision.verdict === "Approved" ? "#2dd4a0"
      : decision.verdict === "Rejected" ? "#e85555" : "#e8a830"
    : "#c9a84c";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      {/* Header */}
      <header style={{
        height: 46, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 18px",
        background: "rgba(10,13,20,0.97)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        zIndex: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 6,
            background: "linear-gradient(135deg, #c9a84c, #e8d070)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, color: "#000",
          }}>F</div>
          <span style={{ fontFamily: "Playfair Display, serif", fontSize: 14, color: "#c9a84c" }}>FinAgent</span>
          <span style={{ fontSize: 10, color: "#4a566e" }}>AI Boardroom</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {loading && (
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "#e8a830", boxShadow: "0 0 8px #e8a830",
              animation: "blink 1s ease infinite",
            }} />
          )}
          <span style={{ fontSize: 11, color: loading ? "#e8a830" : "#4a566e" }}>{statusText}</span>
          {sessionId && (
            <span style={{
              fontSize: 10, color: "#4a566e", fontFamily: "DM Mono, monospace",
              background: "rgba(255,255,255,0.04)", padding: "2px 8px", borderRadius: 4,
            }}>{sessionId}</span>
          )}
        </div>

        <button onClick={() => setShowInput(v => !v)} style={{
          fontSize: 10, padding: "4px 12px", borderRadius: 6,
          border: "1px solid rgba(255,255,255,0.1)",
          background: "transparent", color: "#4a566e",
          cursor: "pointer", fontFamily: "DM Sans, sans-serif",
        }}>
          {showInput ? "Hide" : "New scenario"}
        </button>
      </header>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Left: 3D office */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>

          {/* Agent legend overlay */}
          <div style={{
            position: "absolute", top: 10, left: 12, zIndex: 10,
            display: "flex", gap: 6, flexWrap: "wrap",
          }}>
            {Object.entries(AGENT_META).map(([key, meta]) => {
              const state = agentStates[key];
              return (
                <div key={key} style={{
                  display: "flex", alignItems: "center", gap: 5,
                  background: "rgba(10,13,20,0.85)",
                  border: `1px solid ${state?.active ? meta.color + "80" : "rgba(255,255,255,0.07)"}`,
                  borderRadius: 8, padding: "4px 9px",
                  transition: "border-color 0.3s",
                  boxShadow: state?.active ? `0 0 10px ${meta.color}30` : "none",
                }}>
                  <span style={{ fontSize: 12 }}>{meta.emoji}</span>
                  <span style={{ fontSize: 10, fontWeight: 500, color: meta.color }}>{key}</span>
                  {state?.hasSpoken && (
                    <span style={{
                      fontSize: 8, color: STANCE_COLOR[state.stance],
                      background: STANCE_COLOR[state.stance] + "20",
                      padding: "1px 5px", borderRadius: 99,
                    }}>{state.stance}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* 3D canvas */}
          <div style={{ flex: 1 }}>
            <Office3D agentStates={agentStates} />
          </div>

          {/* Decision banner */}
          {decision && (
            <div className="fade-up" style={{
              margin: "0 12px 10px",
              padding: "12px 16px",
              background: verdictColor + "10",
              border: `1px solid ${verdictColor}40`,
              borderRadius: 12,
              display: "flex", alignItems: "center", gap: 14,
              flexShrink: 0,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: "50%",
                background: verdictColor + "20", border: `2px solid ${verdictColor}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, color: verdictColor, flexShrink: 0,
              }}>
                {decision.verdict === "Approved" ? "✓" : decision.verdict === "Rejected" ? "✕" : "◈"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, color: "#4a566e", letterSpacing: "0.12em", marginBottom: 2 }}>BOARD VERDICT</div>
                <div style={{ fontFamily: "Playfair Display, serif", fontSize: 17, fontWeight: 700, color: verdictColor }}>
                  {decision.verdict}
                </div>
                <div style={{ fontSize: 10, color: "#8892a4", marginTop: 3, lineHeight: 1.5 }}>
                  {decision.rationale}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: verdictColor, fontFamily: "DM Mono, monospace" }}>
                  {Math.round(decision.confidence * 100)}%
                </div>
                <div style={{ fontSize: 9, color: "#4a566e" }}>confidence</div>
              </div>
            </div>
          )}

          {/* Scenario input */}
          {showInput && (
            <div style={{
              borderTop: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(10,13,20,0.98)",
              padding: "10px 14px", flexShrink: 0,
            }}>
              {error && (
                <div style={{
                  marginBottom: 8, padding: "6px 10px", borderRadius: 7,
                  background: "rgba(232,85,85,0.1)", border: "1px solid rgba(232,85,85,0.25)",
                  fontSize: 11, color: "#e85555",
                }}>⚠ {error}</div>
              )}
              <div style={{ display: "flex", gap: 5, marginBottom: 7, flexWrap: "wrap" }}>
                {SAMPLES.map((s, i) => (
                  <button key={i} onClick={() => setScenario(s)} disabled={loading} style={{
                    fontSize: 10, padding: "3px 9px", borderRadius: 99,
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "transparent", color: "#4a566e",
                    cursor: "pointer", fontFamily: "DM Sans, sans-serif",
                  }}>Sample {i + 1}</button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 7, alignItems: "flex-end" }}>
                <textarea
                  value={scenario}
                  onChange={e => setScenario(e.target.value)}
                  disabled={loading}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSimulate(); }}}
                  placeholder="Describe the strategic decision for the board… (Enter to submit)"
                  rows={2}
                  style={{
                    flex: 1, resize: "none", outline: "none",
                    background: "rgba(20,28,42,0.9)", border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8, padding: "8px 11px",
                    fontSize: 12, color: "#d8dce8",
                    fontFamily: "DM Sans, sans-serif", lineHeight: 1.6,
                  }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    <select value={rounds} onChange={e => setRounds(+e.target.value)} disabled={loading}
                      style={{
                        background: "rgba(20,28,42,0.9)", border: "1px solid rgba(255,255,255,0.08)",
                        color: "#4a566e", borderRadius: 5, padding: "4px 5px",
                        fontSize: 10, fontFamily: "DM Sans, sans-serif", outline: "none",
                      }}>
                      {[1,2,3].map(n => <option key={n} value={n}>{n}r</option>)}
                    </select>
                    <select value={mode} onChange={e => setMode(e.target.value as "weighted"|"majority")} disabled={loading}
                      style={{
                        background: "rgba(20,28,42,0.9)", border: "1px solid rgba(255,255,255,0.08)",
                        color: "#4a566e", borderRadius: 5, padding: "4px 5px",
                        fontSize: 10, fontFamily: "DM Sans, sans-serif", outline: "none",
                      }}>
                      <option value="weighted">Wt</option>
                      <option value="majority">Maj</option>
                    </select>
                  </div>
                  <button onClick={handleSimulate} disabled={loading || !scenario.trim()} style={{
                    padding: "8px 14px", borderRadius: 7,
                    background: loading || !scenario.trim()
                      ? "rgba(201,168,76,0.12)"
                      : "linear-gradient(135deg, #c9a84c, #e8d070)",
                    color: loading || !scenario.trim() ? "#4a566e" : "#000",
                    fontWeight: 600, fontSize: 11,
                    border: "none", cursor: loading || !scenario.trim() ? "not-allowed" : "pointer",
                    fontFamily: "DM Sans, sans-serif", whiteSpace: "nowrap",
                  }}>
                    {loading ? "In session…" : "Convene"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Live chat */}
        <div style={{
          width: 330, flexShrink: 0,
          display: "flex", flexDirection: "column",
          borderLeft: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(13,18,25,0.98)",
          overflow: "hidden",
        }}>
          <div style={{
            padding: "11px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: "50%",
              background: loading ? "#e8a830" : messages.length ? "#2dd4a0" : "#4a566e",
              boxShadow: loading ? "0 0 8px #e8a830" : messages.length ? "0 0 6px #2dd4a0" : "none",
              animation: loading ? "blink 1s ease infinite" : "none",
            }} />
            <span style={{ fontFamily: "Playfair Display, serif", fontSize: 13, color: "#c9a84c" }}>
              Live Discussion
            </span>
            {messages.length > 0 && (
              <span style={{ marginLeft: "auto", fontSize: 10, color: "#4a566e" }}>
                {messages.filter(m => m.kind !== "system").length} msgs
              </span>
            )}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "12px 13px 8px" }}>
            {messages.length === 0 && !loading && (
              <div style={{ textAlign: "center", marginTop: 80 }}>
                <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.2 }}>🏛️</div>
                <div style={{ fontSize: 12, color: "#4a566e" }}>The boardroom is quiet.</div>
                <div style={{ fontSize: 10, color: "#4a566e", marginTop: 4 }}>Submit a scenario to begin.</div>
              </div>
            )}
            {messages.map((msg, i) => <ChatBubble key={msg.id} msg={msg} idx={i} />)}
            {loading && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: "#4a566e", marginBottom: 4 }}>{statusText}</div>
                <div style={{
                  background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "4px 10px 10px 10px", padding: "9px 13px",
                  display: "flex", gap: 4, alignItems: "center",
                }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{
                      width: 5, height: 5, borderRadius: "50%", background: "#4a566e",
                      animation: `blink 1.2s ease ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {decision && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "11px 13px", flexShrink: 0 }}>
              <div style={{ fontSize: 9, color: "#4a566e", letterSpacing: "0.1em", marginBottom: 7 }}>KEY POINTS</div>
              {decision.supporting_arguments.slice(0, 2).map((a, i) => (
                <div key={i} style={{ fontSize: 10, color: "#8892a4", marginBottom: 5, display: "flex", gap: 5 }}>
                  <span style={{ color: "#2dd4a0", flexShrink: 0 }}>✓</span><span>{a}</span>
                </div>
              ))}
              {decision.disagreements.slice(0, 1).map((d, i) => (
                <div key={i} style={{ fontSize: 10, color: "#8892a4", marginBottom: 5, display: "flex", gap: 5 }}>
                  <span style={{ color: "#e85555", flexShrink: 0 }}>↔</span><span>{d}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}