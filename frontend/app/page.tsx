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

const AGENT_META: Record<string, { color: string; emoji: string; title: string; realName: string; company: string }> = {
  CEO:  { color: "#818cf8", emoji: "🚀", title: "Chief Executive Officer", realName: "Elon Musk",     company: "Tesla / SpaceX / X" },
  CFO:  { color: "#34d399", emoji: "💳", title: "Chief Financial Officer", realName: "Sachin Mehra",  company: "Mastercard" },
  CMO:  { color: "#fb923c", emoji: "📊", title: "Chief Marketing Officer", realName: "Julia White",   company: "SAP" },
  Risk: { color: "#c084fc", emoji: "🏦", title: "Chief Risk Officer",      realName: "Ashley Bacon",  company: "JP Morgan Chase" },
};

const WEIGHTS: Record<string, number> = { CEO: 50, CFO: 17, CMO: 17, Risk: 16 };

const STANCE_COLOR: Record<string, string> = {
  approve: "#34d399", conditional: "#fbbf24", reject: "#f87171", idle: "#5a6385",
};

const STANCE_BG: Record<string, string> = {
  approve: "rgba(52,211,153,0.15)", conditional: "rgba(251,191,36,0.15)", reject: "rgba(248,113,113,0.15)", idle: "rgba(90,99,133,0.15)",
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

function StanceChangeBanner({ changes }: { changes: { agent: string; from: string; to: string }[] }) {
  if (changes.length === 0) return null;
  const latest = changes[changes.length - 1];
  const meta = AGENT_META[latest.agent];
  const toColor = STANCE_COLOR[latest.to] || "#5a6385";
  return (
    <div style={{
      position: "fixed", top: 70, left: "50%", transform: "translateX(-50%)",
      zIndex: 999, pointerEvents: "none", animation: "fadeUp 0.3s ease both",
    }}>
      <div style={{
        background: "var(--surface2)",
        border: `1.5px solid ${toColor}`,
        borderRadius: 12, padding: "10px 20px",
        backdropFilter: "blur(12px)",
        textAlign: "center",
        boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 20px ${toColor}30`,
      }}>
        <div style={{ fontSize: 13, color: toColor, fontWeight: 700, letterSpacing: "0.05em" }}>
          ⚡ STANCE CHANGED
        </div>
        <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 3 }}>
          {meta?.realName} ({latest.agent}): {latest.from.toUpperCase()} → {latest.to.toUpperCase()}
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ msg, idx }: { msg: ChatMessage; idx: number }) {
  if (msg.kind === "system") {
    return (
      <div style={{
        textAlign: "center", margin: "20px 0 14px",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        <span style={{ fontSize: 11, color: "var(--gold)", letterSpacing: "0.12em", fontWeight: 600 }}>
          {msg.text}
        </span>
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      </div>
    );
  }
  const meta = AGENT_META[msg.agent];
  const color = meta?.color || "#888";
  const stanceColor = STANCE_COLOR[msg.stance] || "var(--muted)";
  const stanceBg = STANCE_BG[msg.stance] || "rgba(90,99,133,0.15)";

  return (
    <div className="slide-l" style={{ animationDelay: `${Math.min(idx * 0.02, 0.2)}s`, marginBottom: 16 }}>
      {/* Agent header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: color + "20",
          border: `1.5px solid ${color}40`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 15, flexShrink: 0,
        }}>
          {meta?.emoji}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color }}>{meta?.realName || msg.agent}</span>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>·</span>
            <span style={{ fontSize: 11, color: "var(--text3)" }}>{msg.agent}</span>
            {msg.target && (
              <>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>→</span>
                <span style={{ fontSize: 12, color: AGENT_META[msg.target]?.color || "var(--muted)", fontWeight: 500 }}>
                  {AGENT_META[msg.target]?.realName || msg.target}
                </span>
              </>
            )}
            {msg.round && (
              <span style={{
                fontSize: 10, color: "var(--gold)", background: "var(--gold-dim)",
                padding: "1px 6px", borderRadius: 4, fontWeight: 600,
              }}>R{msg.round}</span>
            )}
          </div>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, color: stanceColor,
          background: stanceBg, padding: "3px 10px",
          borderRadius: 20, textTransform: "uppercase" as const,
          border: `1px solid ${stanceColor}30`,
          letterSpacing: "0.05em",
        }}>{msg.stance}</span>
      </div>

      {/* Message bubble */}
      <div style={{
        background: "var(--surface)",
        border: `1px solid ${color}25`,
        borderLeft: `3px solid ${color}`,
        borderRadius: "0 12px 12px 12px",
        padding: "12px 14px",
        fontSize: 13.5,
        lineHeight: 1.65,
        color: "var(--text2)",
      }}>
        {msg.text}
      </div>
    </div>
  );
}

function AgentLegendCard({ agentKey, state }: { agentKey: string; state: AgentState }) {
  const meta = AGENT_META[agentKey];
  const color = meta.color;
  const stanceColor = STANCE_COLOR[state.stance];
  const stanceBg = STANCE_BG[state.stance];
  const isActive = state.active;

  return (
    <div style={{
      background: isActive ? color + "12" : "var(--surface)",
      border: `1.5px solid ${isActive ? color + "60" : "var(--border)"}`,
      borderRadius: 12, padding: "10px 14px",
      transition: "all 0.3s ease",
      boxShadow: isActive ? `0 0 20px ${color}25, var(--shadow-sm)` : "var(--shadow-sm)",
      minWidth: 160,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 8,
          background: color + "18",
          border: `1.5px solid ${isActive ? color : color + "40"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, flexShrink: 0,
          boxShadow: isActive ? `0 0 12px ${color}40` : "none",
          transition: "all 0.3s",
        }}>
          {meta.emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color, lineHeight: 1.2 }}>{meta.realName}</div>
          <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 1 }}>{meta.company}</div>
        </div>
        {state.hasSpoken && (
          <span style={{
            fontSize: 10, fontWeight: 700, color: stanceColor,
            background: stanceBg, padding: "2px 8px",
            borderRadius: 20, textTransform: "uppercase" as const,
            border: `1px solid ${stanceColor}30`, whiteSpace: "nowrap",
          }}>{state.stance}</span>
        )}
      </div>
      <PersonalityBadge agentKey={agentKey} />
    </div>
  );
}

export default function Home() {
  const [scenario, setScenario] = useState("");
  const [rounds, setRounds] = useState(2);
  const [mode, setMode] = useState<"weighted" | "majority">("weighted");
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
    if (!scenario.trim() || loading) return;
    setLoading(true);
    setError(null);
    setMessages([]);
    setDecision(null);
    setShowInput(false);
    setShowReplay(false);
    resetAll();
    setStatusText("Calling the board to order…");
    msgCounter.current = 0;

    try {
      await streamSimulation(scenario, { debate_rounds: rounds, decision_mode: mode }, (event: StreamEvent) => {
        switch (event.type) {
          case "session": setSessionId(event.session_id); break;
          case "status":
            setStatusText(event.text);
            if (event.agent) setAgentStates(prev => ({ ...prev, [event.agent!]: { ...prev[event.agent!], active: true } }));
            break;
          case "round_start":
            setMessages(prev => [...prev, { id: `div-r${event.round}`, agent: "system", text: `── Debate Round ${event.round} ──`, stance: "idle", kind: "system" }]);
            setAgentStates(prev => { const n = { ...prev }; for (const k of Object.keys(n)) n[k] = { ...n[k], active: false }; return n; });
            break;
          case "position": {
            const id = `pos-${msgCounter.current++}`;
            updateAgentStance(event.agent, event.stance as AgentState["stance"], true);
            setMessages(prev => [...prev, { id, agent: event.agent, text: event.reasoning, stance: event.stance, kind: "position" }]);
            break;
          }
          case "exchange": {
            const id = `ex-${msgCounter.current++}`;
            updateAgentStance(event.agent, event.stance as AgentState["stance"], true);
            setMessages(prev => [...prev, { id, agent: event.agent, text: event.argument, stance: event.stance, kind: "debate", round: event.round, target: event.target_agent }]);
            break;
          }
          case "decision":
            setDecision(event as unknown as FinalDecision);
            setStatusText("Board has reached a decision.");
            setAgentStates(prev => { const n = { ...prev }; for (const k of Object.keys(n)) n[k] = { ...n[k], active: false }; return n; });
            break;
          case "done": setLoading(false); setStatusText("Session complete."); break;
          case "error": setError(`${event.agent}: ${event.message}`); break;
        }
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Connection failed. Is the backend running on port 8000?");
      setLoading(false);
    }
  }

  const verdictColor = decision
    ? decision.verdict === "Approved" ? "#34d399"
      : decision.verdict === "Rejected" ? "#f87171" : "#fbbf24"
    : "var(--gold)";

  const verdictBg = decision
    ? decision.verdict === "Approved" ? "rgba(52,211,153,0.08)"
      : decision.verdict === "Rejected" ? "rgba(248,113,113,0.08)" : "rgba(251,191,36,0.08)"
    : "transparent";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "var(--bg)" }}>

      <StanceChangeBanner changes={stanceChanges} />

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
            const rounds2: Record<number, typeof messages> = {};
            messages.filter(m => m.kind === "debate").forEach(m => { const r = m.round || 1; if (!rounds2[r]) rounds2[r] = []; rounds2[r].push(m); });
            return Object.entries(rounds2).map(([r, exs]) => ({
              round_number: Number(r),
              exchanges: exs.map(e => ({ agent: e.agent, target_agent: e.target || "", argument: e.text, stance: e.stance })),
            }));
          })()}
          decision={decision}
          onClose={() => setShowExport(false)}
        />
      )}

      {/* ── HEADER ── */}
      <header style={{
        height: 60, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px",
        background: "var(--bg2)",
        borderBottom: "1px solid var(--border)",
        boxShadow: "0 1px 0 rgba(255,255,255,0.04)",
        zIndex: 50,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, var(--gold), var(--gold2))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 900, color: "#1a1a2e",
            boxShadow: "0 2px 12px rgba(232,200,74,0.4)",
          }}>F</div>
          <div>
            <div style={{ fontFamily: "Playfair Display, serif", fontSize: 20, fontWeight: 700, color: "var(--gold)", lineHeight: 1 }}>
              FinAgent
            </div>
            <div style={{ fontSize: 11, color: "var(--text3)", letterSpacing: "0.06em" }}>
              AI BOARDROOM SIMULATOR
            </div>
          </div>
        </div>

        {/* Status */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {loading && (
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "var(--cond)", boxShadow: "0 0 10px var(--cond)",
              animation: "blink 1s ease infinite", flexShrink: 0,
            }} />
          )}
          <span style={{ fontSize: 13, color: loading ? "var(--cond)" : "var(--text3)", fontWeight: loading ? 500 : 400 }}>
            {statusText}
          </span>
          {sessionId && (
            <span style={{
              fontSize: 11, color: "var(--text3)", fontFamily: "DM Mono, monospace",
              background: "var(--surface)", padding: "3px 10px", borderRadius: 6,
              border: "1px solid var(--border)",
            }}>{sessionId}</span>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setShowCompare(true)} style={{
            fontSize: 12, padding: "7px 14px", borderRadius: 8,
            border: "1px solid var(--border2)",
            background: "var(--surface)", color: "var(--text2)",
            cursor: "pointer", fontFamily: "Inter, sans-serif", fontWeight: 500,
            transition: "all 0.2s",
          }}>⚖ Compare</button>
          {decision && (<>
            <button onClick={() => setShowReplay(true)} style={{
              fontSize: 12, padding: "7px 14px", borderRadius: 8,
              border: "1px solid rgba(232,200,74,0.3)",
              background: "var(--gold-dim)", color: "var(--gold)",
              cursor: "pointer", fontFamily: "Inter, sans-serif", fontWeight: 500,
            }}>📽 Replay</button>
            <button onClick={() => setShowExport(true)} style={{
              fontSize: 12, padding: "7px 14px", borderRadius: 8,
              border: "1px solid rgba(52,211,153,0.3)",
              background: "rgba(52,211,153,0.1)", color: "var(--approve)",
              cursor: "pointer", fontFamily: "Inter, sans-serif", fontWeight: 500,
            }}>📄 Export</button>
          </>)}
          <button onClick={() => setShowInput(v => !v)} style={{
            fontSize: 12, padding: "7px 14px", borderRadius: 8,
            border: "1px solid var(--border)",
            background: "transparent", color: "var(--text3)",
            cursor: "pointer", fontFamily: "Inter, sans-serif",
          }}>{showInput ? "Hide Input" : "New Scenario"}</button>
        </div>
      </header>

      {/* ── BODY ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* History sidebar */}
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
                  id: `loaded-ex-${r.round_number}-${i}`, agent: ex.agent,
                  text: ex.argument, stance: ex.stance, kind: "debate" as const,
                  round: r.round_number, target: ex.target_agent,
                }))
              ),
            ]);
            setAgentStates(Object.fromEntries(
              (full.initial_positions || []).map((p: any) => [
                p.agent, { stance: p.stance, active: false, hasSpoken: true, prevStance: "idle" as const },
              ])
            ));
            setStatusText(`Loaded session ${session.session_id}`);
            setShowInput(false);
          }}
        />

        {/* ── LEFT: 3D office + meter + verdict ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>

          {/* Agent legend row */}
          <div style={{
            padding: "12px 16px 0",
            display: "flex", gap: 10, flexWrap: "wrap", flexShrink: 0,
          }}>
            {Object.entries(AGENT_META).map(([key]) => (
              <AgentLegendCard key={key} agentKey={key} state={agentStates[key]} />
            ))}
            {/* Vote weight badge */}
            <div style={{
              display: "flex", flexDirection: "column", justifyContent: "center",
              background: "var(--surface)", border: "1px solid var(--gold-dim)",
              borderRadius: 12, padding: "10px 14px", gap: 4,
            }}>
              <div style={{ fontSize: 12, color: "var(--gold)", fontWeight: 600 }}>⚖ Vote Weight</div>
              {Object.entries(WEIGHTS).map(([k, w]) => (
                <div key={k} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: AGENT_META[k]?.color, width: 30 }}>{k}</span>
                  <div style={{ width: 60, height: 4, background: "var(--surface3)", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${w * 2}%`, background: AGENT_META[k]?.color, borderRadius: 99 }} />
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text3)", fontFamily: "DM Mono, monospace" }}>{w}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* 3D canvas */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <Office3D agentStates={agentStates} />
          </div>

          {/* Confidence meter */}
          <div style={{ padding: "0 16px" }}>
            <ConfidenceMeter
              agentStates={agentStates}
              finalConfidence={decision?.confidence}
              finalVerdict={decision?.verdict}
            />
          </div>

          {/* Verdict banner */}
          {decision && (
            <div className="fade-up" style={{
              margin: "0 16px 12px",
              padding: "16px 20px",
              background: verdictBg,
              border: `1.5px solid ${verdictColor}40`,
              borderRadius: 14,
              display: "flex", alignItems: "center", gap: 16,
              flexShrink: 0,
              boxShadow: `0 4px 24px ${verdictColor}15`,
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%",
                background: verdictColor + "20", border: `2px solid ${verdictColor}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, color: verdictColor, flexShrink: 0,
                boxShadow: `0 0 20px ${verdictColor}30`,
              }}>
                {decision.verdict === "Approved" ? "✓" : decision.verdict === "Rejected" ? "✕" : "◈"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "var(--text3)", letterSpacing: "0.12em", marginBottom: 3, fontWeight: 600 }}>
                  BOARD VERDICT
                </div>
                <div style={{ fontFamily: "Playfair Display, serif", fontSize: 22, fontWeight: 700, color: verdictColor, lineHeight: 1.1 }}>
                  {decision.verdict}
                </div>
                <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 5, lineHeight: 1.6 }}>
                  {safeStr(decision.rationale)}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: verdictColor, fontFamily: "DM Mono, monospace", lineHeight: 1 }}>
                  {Math.round(decision.confidence * 100)}%
                </div>
                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>confidence</div>
                <button onClick={() => setShowReplay(true)} style={{
                  marginTop: 6, fontSize: 11, padding: "3px 10px", borderRadius: 6,
                  background: "var(--gold-dim)", border: "1px solid rgba(232,200,74,0.3)",
                  color: "var(--gold)", cursor: "pointer", fontFamily: "Inter, sans-serif",
                }}>📽 Replay</button>
              </div>
            </div>
          )}

          {/* Scenario input */}
          {showInput && (
            <div style={{
              borderTop: "1px solid var(--border)",
              background: "var(--bg2)",
              padding: "14px 16px", flexShrink: 0,
            }}>
              {error && (
                <div style={{
                  marginBottom: 10, padding: "10px 14px", borderRadius: 10,
                  background: "var(--reject-bg)", border: "1px solid rgba(248,113,113,0.3)",
                  fontSize: 13, color: "var(--reject)",
                }}>⚠ {error}</div>
              )}

              {/* Sample pills */}
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "var(--text3)", alignSelf: "center" }}>Try:</span>
                {SAMPLES.map((s, i) => (
                  <button key={i} onClick={() => setScenario(s)} disabled={loading} style={{
                    fontSize: 12, padding: "5px 12px", borderRadius: 20,
                    border: "1px solid var(--border2)",
                    background: "var(--surface)", color: "var(--text2)",
                    cursor: "pointer", fontFamily: "Inter, sans-serif",
                    transition: "all 0.2s",
                  }}>Sample {i + 1}</button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                <textarea
                  value={scenario}
                  onChange={e => setScenario(e.target.value)}
                  disabled={loading}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSimulate(); } }}
                  placeholder="Describe the strategic decision for the board to evaluate… (Enter to submit)"
                  rows={2}
                  style={{
                    flex: 1, resize: "none", outline: "none",
                    background: "var(--surface)", border: "1.5px solid var(--border2)",
                    borderRadius: 10, padding: "12px 14px",
                    fontSize: 14, color: "var(--text)", lineHeight: 1.5,
                    fontFamily: "Inter, sans-serif",
                    transition: "border-color 0.2s",
                  }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <select value={rounds} onChange={e => setRounds(+e.target.value)} disabled={loading} style={{
                      background: "var(--surface)", border: "1px solid var(--border2)",
                      color: "var(--text2)", borderRadius: 8, padding: "7px 8px",
                      fontSize: 12, fontFamily: "Inter, sans-serif", outline: "none", cursor: "pointer",
                    }}>
                      {[1,2,3].map(n => <option key={n} value={n}>{n} rounds</option>)}
                    </select>
                    <select value={mode} onChange={e => setMode(e.target.value as "weighted"|"majority")} disabled={loading} style={{
                      background: "var(--surface)", border: "1px solid var(--border2)",
                      color: "var(--text2)", borderRadius: 8, padding: "7px 8px",
                      fontSize: 12, fontFamily: "Inter, sans-serif", outline: "none", cursor: "pointer",
                    }}>
                      <option value="weighted">Weighted</option>
                      <option value="majority">Majority</option>
                    </select>
                  </div>
                  <button onClick={handleSimulate} disabled={loading || !scenario.trim()} style={{
                    padding: "11px 20px", borderRadius: 10,
                    background: loading || !scenario.trim()
                      ? "var(--surface2)"
                      : "linear-gradient(135deg, var(--gold), var(--gold2))",
                    color: loading || !scenario.trim() ? "var(--muted)" : "#1a1a2e",
                    fontWeight: 700, fontSize: 13,
                    border: "none", cursor: loading || !scenario.trim() ? "not-allowed" : "pointer",
                    fontFamily: "Inter, sans-serif",
                    boxShadow: loading || !scenario.trim() ? "none" : "0 2px 12px rgba(232,200,74,0.35)",
                    transition: "all 0.2s",
                    whiteSpace: "nowrap",
                  }}>
                    {loading ? "In session…" : "Convene Board"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Live chat ── */}
        <div style={{
          width: 380, flexShrink: 0,
          display: "flex", flexDirection: "column",
          borderLeft: "1px solid var(--border)",
          background: "var(--bg2)",
          overflow: "hidden",
        }}>
          {/* Chat header */}
          <div style={{
            padding: "16px 18px",
            borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: "50%",
              background: loading ? "var(--cond)" : messages.length ? "var(--approve)" : "var(--muted)",
              boxShadow: loading ? "0 0 10px var(--cond)" : messages.length ? "0 0 8px var(--approve)" : "none",
              animation: loading ? "blink 1s ease infinite" : "none",
              flexShrink: 0,
            }} />
            <span style={{ fontFamily: "Playfair Display, serif", fontSize: 16, color: "var(--gold)", fontWeight: 600 }}>
              Live Discussion
            </span>
            {messages.length > 0 && (
              <span style={{
                marginLeft: "auto", fontSize: 12, color: "var(--text3)",
                background: "var(--surface)", padding: "2px 10px", borderRadius: 20,
                border: "1px solid var(--border)",
              }}>
                {messages.filter(m => m.kind !== "system").length} messages
              </span>
            )}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>

            {/* Empty state */}
            {messages.length === 0 && !loading && (
              <div style={{ textAlign: "center", paddingTop: 32 }}>
                <div style={{ fontSize: 40, marginBottom: 14, opacity: 0.25 }}>🏛️</div>
                <div style={{ fontSize: 15, color: "var(--text2)", fontWeight: 500, marginBottom: 6 }}>
                  The boardroom is quiet.
                </div>
                <div style={{ fontSize: 13, color: "var(--text3)", marginBottom: 24 }}>
                  Submit a scenario to convene the executives.
                </div>

                {/* Executive roster */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, textAlign: "left" }}>
                  {Object.entries(AGENT_META).map(([key, meta]) => (
                    <div key={key} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 14px", borderRadius: 10,
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                    }}>
                      <span style={{ fontSize: 18 }}>{meta.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: meta.color, fontWeight: 600 }}>{meta.realName}</div>
                        <div style={{ fontSize: 11, color: "var(--text3)" }}>{meta.title} · {meta.company}</div>
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: key === "CEO" ? "var(--gold)" : "var(--text3)",
                        background: key === "CEO" ? "var(--gold-dim)" : "var(--surface2)",
                        padding: "3px 9px", borderRadius: 20,
                        border: key === "CEO" ? "1px solid rgba(232,200,74,0.3)" : "1px solid var(--border)",
                      }}>
                        {WEIGHTS[key]}% vote
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => <ChatBubble key={msg.id} msg={msg} idx={i} />)}

            {/* Typing indicator */}
            {loading && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 6 }}>{statusText}</div>
                <div style={{
                  background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: "4px 12px 12px 12px", padding: "12px 16px",
                  display: "flex", gap: 6, alignItems: "center",
                }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{
                      width: 7, height: 7, borderRadius: "50%", background: "var(--muted)",
                      animation: `blink 1.2s ease ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Key points footer */}
          {decision && (
            <div style={{ borderTop: "1px solid var(--border)", padding: "14px 16px", flexShrink: 0 }}>
              <div style={{ fontSize: 11, color: "var(--text3)", letterSpacing: "0.1em", marginBottom: 10, fontWeight: 600 }}>
                KEY POINTS
              </div>
              {decision.supporting_arguments.slice(0, 2).map((a, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <span style={{ color: "var(--approve)", flexShrink: 0, fontSize: 13, marginTop: 1 }}>✓</span>
                  <span style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.55 }}>{safeStr(a)}</span>
                </div>
              ))}
              {decision.disagreements.slice(0, 1).map((d, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <span style={{ color: "var(--reject)", flexShrink: 0, fontSize: 13, marginTop: 1 }}>↔</span>
                  <span style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.55 }}>{safeStr(d)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}