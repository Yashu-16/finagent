"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { streamSimulation, StreamEvent, FinalDecision } from "@/lib/api";
import ConfidenceMeter from "@/components/ConfidenceMeter";
import PersonalityBadge from "@/components/PersonalityBadge";
import ReplayTimeline from "@/components/ReplayTimeline";
import ExportPDF from "@/components/ExportPDF";
import CompareView from "@/components/CompareView";
import HistorySidebar from "@/components/HistorySidebar";

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
  prevStance: "approve" | "reject" | "conditional" | "idle";
}

const AGENT_META: Record<string, {
  color: string; bg: string; border: string;
  emoji: string; title: string; realName: string; company: string;
}> = {
  CEO:  { color: "#3b5bdb", bg: "#eef2ff", border: "#c5d0fa", emoji: "🚀", title: "Chief Executive Officer", realName: "Elon Musk",    company: "Tesla · SpaceX · X" },
  CFO:  { color: "#0d7a4e", bg: "#e8f8f1", border: "#a8dfc5", emoji: "💳", title: "Chief Financial Officer", realName: "Sachin Mehra", company: "Mastercard" },
  CMO:  { color: "#c2410c", bg: "#fff4ee", border: "#fbc99a", emoji: "📊", title: "Chief Marketing Officer", realName: "Julia White",  company: "SAP" },
  Risk: { color: "#6d28d9", bg: "#f5f3ff", border: "#c4b5fd", emoji: "🏦", title: "Chief Risk Officer",      realName: "Ashley Bacon", company: "JP Morgan" },
};

const DEFAULT_WEIGHTS: Record<string, number> = { CEO: 50, CFO: 17, CMO: 17, Risk: 16 };

const STANCE_STYLE: Record<string, { color: string; bg: string; border: string; label: string }> = {
  approve:     { color: "#0d7a4e", bg: "#e8f8f1", border: "#a8dfc5", label: "Approve" },
  conditional: { color: "#b45309", bg: "#fef9ec", border: "#f0d080", label: "Conditional" },
  reject:      { color: "#c0392b", bg: "#fdf0ee", border: "#f5b8b2", label: "Reject" },
  idle:        { color: "#8a9bb8", bg: "#f4f6fa", border: "#e2e6f0", label: "Pending" },
};

const SAMPLES = [
  "Should we launch a buy-now-pay-later product targeting millennials in Southeast Asia next quarter?",
  "Should we acquire a fintech startup specialising in AI-driven credit scoring for $120M?",
  "Should we shut down our physical branch network and go fully digital within 18 months?",
];

function safeStr(val: unknown): string {
  if (typeof val === "string") return val;
  if (val && typeof val === "object") {
    const v = val as Record<string, unknown>;
    return (v.argument || v.text || v.content || JSON.stringify(val)) as string;
  }
  return String(val ?? "");
}

function StanceBadge({ stance }: { stance: string }) {
  const s = STANCE_STYLE[stance] || STANCE_STYLE.idle;
  return (
    <span style={{
      fontSize: 11, fontWeight: 600,
      color: s.color, background: s.bg,
      border: `1px solid ${s.border}`,
      padding: "2px 8px", borderRadius: 20,
      letterSpacing: "0.02em", whiteSpace: "nowrap" as const,
    }}>
      {s.label}
    </span>
  );
}

function StanceToast({ changes }: { changes: { agent: string; from: string; to: string }[] }) {
  if (!changes.length) return null;
  const latest = changes[changes.length - 1];
  const meta = AGENT_META[latest.agent];
  const toStyle = STANCE_STYLE[latest.to] || STANCE_STYLE.idle;
  return (
    <div style={{
      position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)",
      zIndex: 999, pointerEvents: "none", animation: "fadeUp 0.3s ease both",
    }}>
      <div style={{
        background: "var(--surface)", border: `1.5px solid ${toStyle.border}`,
        borderRadius: 12, padding: "10px 20px",
        boxShadow: "0 8px 32px rgba(30,40,80,0.15)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ fontSize: 18 }}>{meta?.emoji}</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
            Stance Changed — {meta?.realName}
          </div>
          <div style={{ fontSize: 12, color: "var(--text3)" }}>
            {latest.from.toUpperCase()} → {latest.to.toUpperCase()}
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentCard({ agentKey, state }: { agentKey: string; state: AgentState }) {
  const meta = AGENT_META[agentKey];
  const isActive = state.active;

  // Short titles that fit in card
  const shortTitle: Record<string, string> = {
    CEO: "CEO", CFO: "CFO", CMO: "CMO", Risk: "CRO",
  };

  return (
    <div style={{
      background: isActive ? meta.bg : "var(--surface2)",
      border: `1.5px solid ${isActive ? meta.border : "var(--border)"}`,
      borderRadius: 10, padding: "8px 10px",
      boxShadow: isActive ? `0 0 0 3px ${meta.bg}` : "none",
      transition: "all 0.25s ease",
      minWidth: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: meta.bg, border: `1.5px solid ${meta.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, flexShrink: 0,
        }}>{meta.emoji}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: meta.color, lineHeight: 1.2,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const,
          }}>
            {meta.realName}
          </div>
          <div style={{
            fontSize: 10, color: "var(--text3)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const,
          }}>
            {meta.company} · {shortTitle[agentKey]}
          </div>
        </div>
        {state.hasSpoken && (
          <div style={{ flexShrink: 0 }}>
            <StanceBadge stance={state.stance} />
          </div>
        )}
      </div>
      <PersonalityBadge agentKey={agentKey} />
    </div>
  );
}

function ChatBubble({ msg, idx }: { msg: ChatMessage; idx: number }) {
  if (msg.kind === "system") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0 16px" }}>
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        <span style={{
          fontSize: 12, fontWeight: 600, color: "var(--gold)",
          letterSpacing: "0.08em", whiteSpace: "nowrap" as const,
        }}>{msg.text}</span>
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      </div>
    );
  }
  const meta = AGENT_META[msg.agent];
  return (
    <div className="slide-l" style={{ animationDelay: `${Math.min(idx * 0.02, 0.2)}s`, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 8,
          background: meta?.bg || "#f4f6fa",
          border: `1.5px solid ${meta?.border || "var(--border)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, flexShrink: 0,
        }}>{meta?.emoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: meta?.color || "var(--text)" }}>
              {meta?.realName || msg.agent}
            </span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{meta?.title}</span>
            {msg.target && (
              <>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>→</span>
                <span style={{ fontSize: 13, color: AGENT_META[msg.target]?.color, fontWeight: 600 }}>
                  {AGENT_META[msg.target]?.realName || msg.target}
                </span>
              </>
            )}
            {msg.round && (
              <span style={{
                fontSize: 11, fontWeight: 600, color: "var(--gold)",
                background: "var(--gold-light)", border: "1px solid var(--gold-border)",
                padding: "1px 7px", borderRadius: 4,
              }}>Round {msg.round}</span>
            )}
          </div>
        </div>
        <StanceBadge stance={msg.stance} />
      </div>
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderLeft: `3px solid ${meta?.color || "var(--border2)"}`,
        borderRadius: "0 10px 10px 10px",
        padding: "14px 16px", fontSize: 14, lineHeight: 1.7,
        color: "var(--text2)", boxShadow: "0 1px 3px var(--shadow)",
      }}>{msg.text}</div>
    </div>
  );
}

export default function Home() {
  const [scenario, setScenario] = useState("");
  const [rounds, setRounds] = useState(2);
  const [mode, setMode] = useState<"weighted" | "majority">("weighted");
  const [customWeights, setCustomWeights] = useState<Record<string, number>>({ ...DEFAULT_WEIGHTS });
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState("Ready to convene");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [agentStates, setAgentStates] = useState<Record<string, AgentState>>({
    CEO:  { stance: "idle", active: false, hasSpoken: false, prevStance: "idle" },
    CFO:  { stance: "idle", active: false, hasSpoken: false, prevStance: "idle" },
    CMO:  { stance: "idle", active: false, hasSpoken: false, prevStance: "idle" },
    Risk: { stance: "idle", active: false, hasSpoken: false, prevStance: "idle" },
  });
  const [stanceChanges, setStanceChanges] = useState<{ agent: string; from: string; to: string }[]>([]);
  const [decision, setDecision] = useState<FinalDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInput, setShowInput] = useState(true);
  const [showReplay, setShowReplay] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const msgCounter = useRef(0);
  const stanceFlashTimer = useRef<NodeJS.Timeout | null>(null);

  const totalWeight = Object.values(customWeights).reduce((a, b) => a + b, 0);

  function handleWeightChange(agent: string, value: number) {
    setCustomWeights(prev => ({ ...prev, [agent]: value }));
  }

  function resetWeights() {
    setCustomWeights({ ...DEFAULT_WEIGHTS });
  }

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function resetAll() {
    setAgentStates({
      CEO:  { stance: "idle", active: false, hasSpoken: false, prevStance: "idle" },
      CFO:  { stance: "idle", active: false, hasSpoken: false, prevStance: "idle" },
      CMO:  { stance: "idle", active: false, hasSpoken: false, prevStance: "idle" },
      Risk: { stance: "idle", active: false, hasSpoken: false, prevStance: "idle" },
    });
    setStanceChanges([]);
  }

  function updateAgentStance(agent: string, newStance: AgentState["stance"], active: boolean) {
    setAgentStates(prev => {
      const current = prev[agent];
      const changed = current.hasSpoken && current.stance !== newStance && newStance !== "idle";
      if (changed) {
        setStanceChanges(sc => [...sc, { agent, from: current.stance, to: newStance }]);
        if (stanceFlashTimer.current) clearTimeout(stanceFlashTimer.current);
        stanceFlashTimer.current = setTimeout(() => setStanceChanges([]), 3000);
      }
      const n = { ...prev };
      for (const k of Object.keys(n)) n[k] = { ...n[k], active: false };
      n[agent] = { stance: newStance, active, hasSpoken: true, prevStance: current.stance };
      return n;
    });
  }

  async function handleSimulate() {
    if (!scenario.trim() || loading || totalWeight !== 100) return;
    setLoading(true);
    setError(null);
    setMessages([]);
    setDecision(null);
    setShowInput(false);
    resetAll();
    setStatusText("Calling the board to order…");
    msgCounter.current = 0;

    try {
      await streamSimulation(
        scenario,
        { debate_rounds: rounds, decision_mode: mode, agent_weights: customWeights },
        (event: StreamEvent) => {
          switch (event.type) {
            case "session": setSessionId(event.session_id); break;
            case "status":
              setStatusText(event.text);
              if (event.agent) setAgentStates(prev => ({
                ...prev,
                [event.agent!]: { ...prev[event.agent!], active: true },
              }));
              break;
            case "round_start":
              setMessages(prev => [...prev, {
                id: `div-r${event.round}`, agent: "system",
                text: `── Debate Round ${event.round} ──`,
                stance: "idle", kind: "system",
              }]);
              setAgentStates(prev => {
                const n = { ...prev };
                for (const k of Object.keys(n)) n[k] = { ...n[k], active: false };
                return n;
              });
              break;
            case "position": {
              const id = `pos-${msgCounter.current++}`;
              updateAgentStance(event.agent, event.stance as AgentState["stance"], true);
              setMessages(prev => [...prev, {
                id, agent: event.agent, text: event.reasoning,
                stance: event.stance, kind: "position",
              }]);
              break;
            }
            case "exchange": {
              const id = `ex-${msgCounter.current++}`;
              updateAgentStance(event.agent, event.stance as AgentState["stance"], true);
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
        }
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Connection failed. Is the backend running on port 8000?");
      setLoading(false);
    }
  }

  const verdictStyle = decision
    ? decision.verdict === "Approved"
      ? { color: "var(--approve)", bg: "var(--approve-bg)", border: "var(--approve-bd)", icon: "✓" }
      : decision.verdict === "Rejected"
      ? { color: "var(--reject)",  bg: "var(--reject-bg)",  border: "var(--reject-bd)",  icon: "✕" }
      : { color: "var(--cond)",    bg: "var(--cond-bg)",    border: "var(--cond-bd)",    icon: "◈" }
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "var(--bg)" }}>

      <StanceToast changes={stanceChanges} />
      {showReplay && <ReplayTimeline messages={messages} onClose={() => setShowReplay(false)} />}
      {showCompare && <CompareView onClose={() => setShowCompare(false)} />}
      {showExport && decision && (
        <ExportPDF
          scenario={scenario}
          sessionId={sessionId || "unknown"}
          initialPositions={messages.filter(m => m.kind === "position").map(m => ({
            agent: m.agent, role: AGENT_META[m.agent]?.title || m.agent,
            stance: m.stance, reasoning: m.text, key_concern: "",
          }))}
          debateRounds={(() => {
            const r2: Record<number, typeof messages> = {};
            messages.filter(m => m.kind === "debate").forEach(m => {
              const r = m.round || 1;
              if (!r2[r]) r2[r] = [];
              r2[r].push(m);
            });
            return Object.entries(r2).map(([r, exs]) => ({
              round_number: Number(r),
              exchanges: exs.map(e => ({
                agent: e.agent, target_agent: e.target || "",
                argument: e.text, stance: e.stance,
              })),
            }));
          })()}
          decision={decision}
          onClose={() => setShowExport(false)}
        />
      )}

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <header style={{
        height: 60, background: "var(--navy)",
        display: "flex", alignItems: "center",
        padding: "0 24px", gap: 20, flexShrink: 0,
        boxShadow: "0 2px 12px rgba(0,0,0,0.2)", zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: "linear-gradient(135deg, #e8c84a, #f5d96a)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 17, fontWeight: 900, color: "#1a2744",
            boxShadow: "0 2px 8px rgba(232,200,74,0.4)",
          }}>F</div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.01em", lineHeight: 1.1 }}>
              FinAgent
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: "0.1em" }}>
              AI BOARDROOM
            </div>
          </div>
        </div>

        <div style={{ width: 1, height: 30, background: "rgba(255,255,255,0.12)", flexShrink: 0 }} />

        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
          {loading && (
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "#fbbf24", boxShadow: "0 0 8px #fbbf24",
              animation: "blink 1s ease infinite", flexShrink: 0,
            }} />
          )}
          <span style={{
            fontSize: 14, fontWeight: loading ? 500 : 400,
            color: loading ? "#fbbf24" : "rgba(255,255,255,0.55)",
          }}>{statusText}</span>
          {sessionId && (
            <span style={{
              fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "monospace",
              background: "rgba(255,255,255,0.07)", padding: "3px 10px",
              borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)",
            }}>{sessionId}</span>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <button onClick={() => setShowCompare(true)} style={{
            fontSize: 13, padding: "7px 14px", borderRadius: 8, fontWeight: 500,
            background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)",
            color: "rgba(255,255,255,0.85)", cursor: "pointer", fontFamily: "Inter, sans-serif",
          }}>⚖ Compare</button>
          {decision && (
            <>
              <button onClick={() => setShowReplay(true)} style={{
                fontSize: 13, padding: "7px 14px", borderRadius: 8, fontWeight: 500,
                background: "rgba(232,200,74,0.18)", border: "1px solid rgba(232,200,74,0.35)",
                color: "#e8c84a", cursor: "pointer", fontFamily: "Inter, sans-serif",
              }}>📽 Replay</button>
              <button onClick={() => setShowExport(true)} style={{
                fontSize: 13, padding: "7px 14px", borderRadius: 8, fontWeight: 500,
                background: "rgba(13,122,78,0.2)", border: "1px solid rgba(13,122,78,0.4)",
                color: "#34d399", cursor: "pointer", fontFamily: "Inter, sans-serif",
              }}>📄 Export</button>
            </>
          )}
          <button onClick={() => setShowInput(v => !v)} style={{
            fontSize: 13, padding: "7px 14px", borderRadius: 8, fontWeight: 500,
            background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.13)",
            color: "rgba(255,255,255,0.6)", cursor: "pointer", fontFamily: "Inter, sans-serif",
          }}>{showInput ? "Hide Input" : "New Scenario"}</button>
        </div>
      </header>

      {/* ══ BODY ════════════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        <HistorySidebar
          currentSessionId={sessionId}
          onLoad={(session) => {
            const full = session.full as any;
            setSessionId(session.session_id);
            setScenario(session.scenario);
            setDecision(full.final_decision);
            setMessages([
              ...(full.initial_positions || []).map((p: any, i: number) => ({
                id: `loaded-pos-${i}`, agent: p.agent, text: p.reasoning,
                stance: p.stance, kind: "position" as const,
              })),
              ...(full.debate_rounds || []).flatMap((r: any) =>
                (r.exchanges || []).map((ex: any, i: number) => ({
                  id: `loaded-ex-${r.round_number}-${i}`,
                  agent: ex.agent, text: ex.argument,
                  stance: ex.stance, kind: "debate" as const,
                  round: r.round_number, target: ex.target_agent,
                }))
              ),
            ]);
            setAgentStates(Object.fromEntries(
              (full.initial_positions || []).map((p: any) => [
                p.agent,
                { stance: p.stance, active: false, hasSpoken: true, prevStance: "idle" as const },
              ])
            ));
            setStatusText(`Loaded session ${session.session_id}`);
            setShowInput(false);
          }}
        />

        {/* ── LEFT PANEL ───────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto", minWidth: 0 }}>

          {/* ── Agent cards + vote weights ── */}
          <div style={{
            background: "var(--surface)",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
            padding: "10px 16px",
          }}>
            {/* Row 1: Agent cards — equal columns */}
            {/* Row 1: Agent cards — equal columns */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
              {Object.keys(AGENT_META).map(key => (
                <AgentCard key={key} agentKey={key} state={agentStates[key]} />
              ))}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "var(--border)", marginBottom: 10 }} />

            {/* Row 2: Vote weight sliders — same flex proportions */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>

              {/* Label */}
              <span style={{
                fontSize: 10, fontWeight: 700, color: "var(--gold)",
                letterSpacing: "0.05em", whiteSpace: "nowrap" as const,
                flexShrink: 0, marginRight: 2,
              }}>⚖ WEIGHTS</span>

              {/* 4 sliders — flex:1 each, matching agent cards */}
              {Object.entries(customWeights).map(([k, w]) => {
                const meta = AGENT_META[k];
                return (
                  <div key={k} style={{
                    flex: 1, display: "flex", alignItems: "center", gap: 5, minWidth: 0,
                  }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: meta.color,
                      whiteSpace: "nowrap" as const, flexShrink: 0,
                    }}>{k}</span>
                    <input
                      type="range"
                      min={0} max={100} step={1}
                      value={w}
                      onChange={e => handleWeightChange(k, Number(e.target.value))}
                      style={{
                        flex: 1, minWidth: 0, height: 4,
                        accentColor: meta.color, cursor: "pointer",
                      }}
                    />
                    <span style={{
                      fontSize: 10, fontWeight: 700, fontFamily: "monospace",
                      color: "var(--text2)", background: "var(--surface2)",
                      border: "1px solid var(--border)",
                      padding: "1px 4px", borderRadius: 4,
                      minWidth: 30, textAlign: "center" as const, flexShrink: 0,
                    }}>{w}%</span>
                  </div>
                );
              })}

              {/* Separator */}
              <div style={{ width: 1, height: 16, background: "var(--border)", flexShrink: 0 }} />

              {/* Total badge */}
              <span style={{
                fontSize: 11, fontWeight: 700, flexShrink: 0,
                color: totalWeight === 100 ? "var(--approve)" : "var(--reject)",
                background: totalWeight === 100 ? "var(--approve-bg)" : "var(--reject-bg)",
                border: `1px solid ${totalWeight === 100 ? "var(--approve-bd)" : "var(--reject-bd)"}`,
                padding: "2px 8px", borderRadius: 20,
                whiteSpace: "nowrap" as const,
              }}>
                {totalWeight === 100 ? "✓ 100%" : `${totalWeight}%`}
              </span>

              {/* Reset button */}
              <button onClick={resetWeights} style={{
                fontSize: 11, padding: "3px 8px", borderRadius: 6, flexShrink: 0,
                background: "var(--surface2)", border: "1px solid var(--border)",
                color: "var(--text3)", cursor: "pointer",
                fontFamily: "Inter, sans-serif", fontWeight: 500,
                whiteSpace: "nowrap" as const,
              }}>↺ Reset</button>
            </div>
          </div>

          {/* 3D office */}
          <div style={{ height: 380, flexShrink: 0, position: "relative", background: "#1a2035" }}>
            <Office3D agentStates={agentStates} />
          </div>

          {/* Confidence meter */}
          <div style={{ padding: "8px 16px 4px", flexShrink: 0 }}>
            <ConfidenceMeter
              agentStates={agentStates}
              finalConfidence={decision?.confidence}
              finalVerdict={decision?.verdict}
            />
          </div>

          {/* Verdict banner */}
          {decision && verdictStyle && (
            <div className="fade-up" style={{
              margin: "4px 16px 8px",
              background: verdictStyle.bg,
              border: `1.5px solid ${verdictStyle.border}`,
              borderRadius: 14, padding: "14px 18px",
              display: "flex", alignItems: "flex-start", gap: 14,
              flexShrink: 0, boxShadow: "0 2px 12px var(--shadow)",
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: verdictStyle.color + "18",
                border: `2px solid ${verdictStyle.color}40`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, color: verdictStyle.color, flexShrink: 0, fontWeight: 700,
              }}>{verdictStyle.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: verdictStyle.color,
                  letterSpacing: "0.1em", marginBottom: 2,
                }}>BOARD VERDICT</div>
                <div style={{
                  fontSize: 20, fontWeight: 800, color: verdictStyle.color,
                  lineHeight: 1.2, marginBottom: 6,
                }}>{decision.verdict}</div>
                <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6 }}>
                  {safeStr(decision.rationale)}
                </div>
              </div>
              <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: verdictStyle.color, lineHeight: 1 }}>
                  {Math.round(decision.confidence * 100)}%
                </div>
                <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>confidence</div>
                <button onClick={() => setShowReplay(true)} style={{
                  marginTop: 6, fontSize: 11, padding: "4px 10px", borderRadius: 6,
                  background: "var(--gold-light)", border: "1px solid var(--gold-border)",
                  color: "var(--gold)", cursor: "pointer",
                  fontFamily: "Inter, sans-serif", fontWeight: 500,
                }}>📽 Replay</button>
              </div>
            </div>
          )}

          {/* Scenario input */}
          {showInput && (
            <div style={{
              borderTop: "1px solid var(--border)",
              background: "var(--surface)",
              padding: "12px 16px", flexShrink: 0,
            }}>
              {error && (
                <div style={{
                  marginBottom: 10, padding: "10px 14px", borderRadius: 8,
                  background: "var(--reject-bg)", border: "1px solid var(--reject-bd)",
                  fontSize: 13, color: "var(--reject)",
                }}>⚠ {error}</div>
              )}

              <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" as const, alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text3)" }}>Try:</span>
                {SAMPLES.map((s, i) => (
                  <button key={i} onClick={() => setScenario(s)} disabled={loading} style={{
                    fontSize: 12, padding: "4px 12px", borderRadius: 20,
                    border: "1px solid var(--border2)",
                    background: "var(--surface2)", color: "var(--text2)",
                    cursor: "pointer", fontFamily: "Inter, sans-serif", fontWeight: 500,
                  }}>Sample {i + 1}</button>
                ))}
                {totalWeight !== 100 && (
                  <span style={{ fontSize: 11, color: "var(--reject)", fontWeight: 500 }}>
                    ⚠ Weights must total 100% ({totalWeight > 100 ? `remove ${totalWeight - 100}%` : `add ${100 - totalWeight}%`})
                  </span>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                <textarea
                  value={scenario}
                  onChange={e => setScenario(e.target.value)}
                  disabled={loading}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSimulate(); }
                  }}
                  placeholder="Describe the strategic decision for the board… (Enter to submit)"
                  rows={2}
                  style={{
                    flex: 1, resize: "none", outline: "none",
                    background: "var(--surface2)", border: "1.5px solid var(--border2)",
                    borderRadius: 10, padding: "10px 13px",
                    fontSize: 14, color: "var(--text)", lineHeight: 1.55,
                    fontFamily: "Inter, sans-serif",
                  }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <select value={rounds} onChange={e => setRounds(+e.target.value)} disabled={loading} style={{
                      background: "var(--surface2)", border: "1.5px solid var(--border2)",
                      color: "var(--text)", borderRadius: 8, padding: "7px 8px",
                      fontSize: 13, fontFamily: "Inter, sans-serif", outline: "none",
                      cursor: "pointer", fontWeight: 500,
                    }}>
                      {[1,2,3].map(n => <option key={n} value={n}>{n} rounds</option>)}
                    </select>
                    <select value={mode} onChange={e => setMode(e.target.value as "weighted"|"majority")} disabled={loading} style={{
                      background: "var(--surface2)", border: "1.5px solid var(--border2)",
                      color: "var(--text)", borderRadius: 8, padding: "7px 8px",
                      fontSize: 13, fontFamily: "Inter, sans-serif", outline: "none",
                      cursor: "pointer", fontWeight: 500,
                    }}>
                      <option value="weighted">Weighted</option>
                      <option value="majority">Majority</option>
                    </select>
                  </div>
                  <button
                    onClick={handleSimulate}
                    disabled={loading || !scenario.trim() || totalWeight !== 100}
                    style={{
                      padding: "10px 20px", borderRadius: 10, fontWeight: 700, fontSize: 14,
                      background: loading || !scenario.trim() || totalWeight !== 100
                        ? "var(--surface3)" : "var(--navy)",
                      color: loading || !scenario.trim() || totalWeight !== 100
                        ? "var(--muted)" : "#ffffff",
                      border: "none",
                      cursor: loading || !scenario.trim() || totalWeight !== 100
                        ? "not-allowed" : "pointer",
                      fontFamily: "Inter, sans-serif",
                      boxShadow: loading || !scenario.trim() || totalWeight !== 100
                        ? "none" : "0 2px 8px rgba(26,39,68,0.25)",
                      whiteSpace: "nowrap" as const,
                    }}
                  >
                    {loading ? "In Session…" : "Convene Board →"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL ───────────────────────────────────────────────── */}
        <div style={{
          width: 420, flexShrink: 0,
          display: "flex", flexDirection: "column",
          borderLeft: "1px solid var(--border)",
          background: "var(--surface)", overflow: "hidden",
        }}>
          <div style={{
            padding: "16px 20px", borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: "50%",
              background: loading ? "#fbbf24" : messages.length ? "#0d7a4e" : "var(--muted)",
              boxShadow: loading ? "0 0 8px #fbbf2480" : messages.length ? "0 0 6px #0d7a4e40" : "none",
              animation: loading ? "blink 1s ease infinite" : "none", flexShrink: 0,
            }} />
            <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
              Live Discussion
            </span>
            {messages.length > 0 && (
              <span style={{
                marginLeft: "auto", fontSize: 13, color: "var(--text3)",
                background: "var(--surface2)", padding: "3px 10px",
                borderRadius: 20, border: "1px solid var(--border)", fontWeight: 500,
              }}>
                {messages.filter(m => m.kind !== "system").length} messages
              </span>
            )}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 8px" }}>
            {messages.length === 0 && !loading && (
              <div style={{ paddingTop: 20 }}>
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                  <div style={{ fontSize: 40, marginBottom: 10, opacity: 0.12 }}>🏛️</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text2)", marginBottom: 6 }}>
                    The boardroom is quiet.
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text3)" }}>
                    Submit a scenario to convene the executives.
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {Object.entries(AGENT_META).map(([key, meta]) => (
                    <div key={key} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 14px", borderRadius: 10,
                      background: "var(--surface2)", border: "1px solid var(--border)",
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 8,
                        background: meta.bg, border: `1.5px solid ${meta.border}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 17, flexShrink: 0,
                      }}>{meta.emoji}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: meta.color }}>
                          {meta.realName}
                        </div>
                        <div style={{
            fontSize: 10, color: "var(--text3)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const,
          }}>
            {meta.company}
          </div>
                      </div>
                      <span style={{
                        fontSize: 12, fontWeight: 700,
                        color: key === "CEO" ? "var(--gold)" : "var(--text3)",
                        background: key === "CEO" ? "var(--gold-light)" : "var(--surface3)",
                        padding: "3px 10px", borderRadius: 20,
                        border: key === "CEO" ? "1px solid var(--gold-border)" : "1px solid var(--border)",
                      }}>
                        {customWeights[key]}% vote
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => <ChatBubble key={msg.id} msg={msg} idx={i} />)}

            {loading && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: "var(--text3)", marginBottom: 8 }}>{statusText}</div>
                <div style={{
                  background: "var(--surface2)", border: "1px solid var(--border)",
                  borderRadius: "4px 12px 12px 12px", padding: "14px 16px",
                  display: "flex", gap: 6, alignItems: "center",
                }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{
                      width: 8, height: 8, borderRadius: "50%", background: "var(--muted)",
                      animation: `blink 1.2s ease ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {decision && (
            <div style={{
              borderTop: "1px solid var(--border)",
              padding: "16px 18px", flexShrink: 0,
              background: "var(--surface2)",
            }}>
              <div style={{
                fontSize: 12, fontWeight: 700, color: "var(--text3)",
                letterSpacing: "0.08em", marginBottom: 12,
              }}>KEY POINTS</div>
              {decision.supporting_arguments.slice(0, 2).map((a, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: "50%",
                    background: "var(--approve-bg)", border: "1px solid var(--approve-bd)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, color: "var(--approve)", flexShrink: 0, marginTop: 2, fontWeight: 700,
                  }}>✓</span>
                  <span style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.55 }}>
                    {safeStr(a)}
                  </span>
                </div>
              ))}
              {decision.disagreements.slice(0, 1).map((d, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: "50%",
                    background: "var(--reject-bg)", border: "1px solid var(--reject-bd)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, color: "var(--reject)", flexShrink: 0, marginTop: 2, fontWeight: 700,
                  }}>↔</span>
                  <span style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.55 }}>
                    {safeStr(d)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}