"use client";
import { useState, useEffect } from "react";

interface Session {
  session_id: string;
  scenario: string;
  final_decision: {
    verdict: string;
    confidence: number;
    supporting_arguments: string[];
    disagreements: string[];
    rationale: string;
  };
  initial_positions: {
    agent: string;
    stance: string;
    reasoning: string;
    key_concern: string;
  }[];
  saved_at: string;
}

interface Props {
  onClose: () => void;
}

const VERDICT_COLOR: Record<string, string> = {
  "Approved":             "#2dd4a0",
  "Conditional Approval": "#e8a830",
  "Rejected":             "#e85555",
};

const AGENT_META: Record<string, { realName: string; emoji: string; color: string }> = {
  CEO:  { realName: "Elon Musk",    emoji: "🚀", color: "#7c9ee8" },
  CFO:  { realName: "Sachin Mehra", emoji: "💳", color: "#2dd4a0" },
  CMO:  { realName: "Julia White",  emoji: "📊", color: "#e87c4a" },
  Risk: { realName: "Ashley Bacon", emoji: "🏦", color: "#c47ce8" },
};

const STANCE_COLOR: Record<string, string> = {
  approve:     "#2dd4a0",
  conditional: "#e8a830",
  reject:      "#e85555",
};

function safeStr(val: unknown): string {
  if (typeof val === "string") return val;
  if (val && typeof val === "object") {
    const v = val as Record<string, unknown>;
    return (v.argument || v.text || v.content || JSON.stringify(val)) as string;
  }
  return String(val ?? "");
}

function truncate(s: string, n = 80) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return ""; }
}

export default function CompareView({ onClose }: Props) {
  const [allSessions, setAllSessions] = useState<{ id: string; scenario: string; verdict: string; confidence: number; saved_at: string }[]>([]);
  const [leftId, setLeftId] = useState<string>("");
  const [rightId, setRightId] = useState<string>("");
  const [leftData, setLeftData] = useState<Session | null>(null);
  const [rightData, setRightData] = useState<Session | null>(null);
  const [loadingLeft, setLoadingLeft] = useState(false);
  const [loadingRight, setLoadingRight] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("http://localhost:8000/logs");
        const data = await res.json();
        const ids: string[] = data.sessions || [];
        const summaries = await Promise.all(
          ids.slice(-30).reverse().map(async (id) => {
            try {
              const r = await fetch(`http://localhost:8000/logs/${id}`);
              const d = await r.json();
              return {
                id,
                scenario: d.scenario || "",
                verdict: d.final_decision?.verdict || "",
                confidence: d.final_decision?.confidence || 0,
                saved_at: d.saved_at || "",
              };
            } catch { return null; }
          })
        );
        const valid = summaries.filter(Boolean) as typeof allSessions;
        setAllSessions(valid);
        if (valid.length >= 2) {
          setLeftId(valid[0].id);
          setRightId(valid[1].id);
        }
      } catch (e) { console.error(e); }
    }
    load();
  }, []);

  useEffect(() => {
    if (!leftId) return;
    setLoadingLeft(true);
    fetch(`http://localhost:8000/logs/${leftId}`)
      .then(r => r.json())
      .then(d => setLeftData(d))
      .finally(() => setLoadingLeft(false));
  }, [leftId]);

  useEffect(() => {
    if (!rightId) return;
    setLoadingRight(true);
    fetch(`http://localhost:8000/logs/${rightId}`)
      .then(r => r.json())
      .then(d => setRightData(d))
      .finally(() => setLoadingRight(false));
  }, [rightId]);

  function SessionColumn({
    data, loading, sessionId, onSelect,
  }: {
    data: Session | null;
    loading: boolean;
    sessionId: string;
    onSelect: (id: string) => void;
  }) {
    if (!data && !loading) return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#4a566e", fontSize: 13 }}>
        Select a session above
      </div>
    );

    const vc = VERDICT_COLOR[data?.final_decision?.verdict || ""] || "#4a566e";
    const pct = Math.round((data?.final_decision?.confidence || 0) * 100);

    return (
      <div style={{ flex: 1, overflowY: "auto", padding: "0 2px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#4a566e" }}>Loading…</div>
        ) : data ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Verdict card */}
            <div style={{
              padding: "16px",
              background: vc + "0e",
              border: `1px solid ${vc}35`,
              borderRadius: 12,
            }}>
              <div style={{ fontSize: 9, color: "#4a566e", letterSpacing: "0.15em", marginBottom: 6 }}>VERDICT</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontFamily: "Playfair Display, serif", fontSize: 18, fontWeight: 700, color: vc }}>
                  {data.final_decision.verdict}
                </div>
                <div style={{ fontFamily: "DM Mono, monospace", fontSize: 28, fontWeight: 700, color: vc }}>
                  {pct}%
                </div>
              </div>
              {/* Confidence bar */}
              <div style={{ marginTop: 10, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: vc, borderRadius: 99, transition: "width 0.8s ease" }} />
              </div>
              <div style={{ fontSize: 9, color: "#4a566e", marginTop: 4 }}>{formatDate(data.saved_at)}</div>
            </div>

            {/* Scenario */}
            <div style={{
              padding: "12px 14px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderLeft: "3px solid #c9a84c",
              borderRadius: "0 8px 8px 0",
            }}>
              <div style={{ fontSize: 9, color: "#c9a84c", letterSpacing: "0.12em", marginBottom: 5 }}>SCENARIO</div>
              <p style={{ fontSize: 11, color: "#d8dce8", lineHeight: 1.6 }}>{data.scenario}</p>
            </div>

            {/* Agent stances */}
            <div style={{
              padding: "12px 14px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 10,
            }}>
              <div style={{ fontSize: 9, color: "#4a566e", letterSpacing: "0.12em", marginBottom: 10 }}>EXECUTIVE STANCES</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(data.initial_positions || []).map(p => {
                  const meta = AGENT_META[p.agent];
                  const sc = STANCE_COLOR[p.stance] || "#4a566e";
                  return (
                    <div key={p.agent} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <span style={{ fontSize: 13, flexShrink: 0 }}>{meta?.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: meta?.color }}>{meta?.realName || p.agent}</span>
                          <span style={{
                            fontSize: 9, fontWeight: 700, color: sc,
                            background: sc + "18", padding: "1px 7px", borderRadius: 99,
                            textTransform: "uppercase" as const,
                          }}>{p.stance}</span>
                        </div>
                        <p style={{ fontSize: 10, color: "#6b7280", lineHeight: 1.5 }}>{truncate(p.reasoning, 100)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rationale */}
            <div style={{
              padding: "12px 14px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 10,
            }}>
              <div style={{ fontSize: 9, color: "#4a566e", letterSpacing: "0.12em", marginBottom: 6 }}>RATIONALE</div>
              <p style={{ fontSize: 11, color: "#8892a4", lineHeight: 1.65 }}>{safeStr(data.final_decision.rationale)}</p>
            </div>

            {/* Supporting arguments */}
            <div style={{
              padding: "12px 14px",
              background: "rgba(45,212,160,0.04)",
              border: "1px solid rgba(45,212,160,0.15)",
              borderRadius: 10,
            }}>
              <div style={{ fontSize: 9, color: "#2dd4a0", letterSpacing: "0.12em", marginBottom: 8 }}>SUPPORTING</div>
              {(data.final_decision.supporting_arguments || []).slice(0, 3).map((a, i) => (
                <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <span style={{ color: "#2dd4a0", flexShrink: 0, fontSize: 10 }}>✓</span>
                  <span style={{ fontSize: 10, color: "#8892a4", lineHeight: 1.5 }}>{safeStr(a)}</span>
                </div>
              ))}
            </div>

            {/* Disagreements */}
            <div style={{
              padding: "12px 14px",
              background: "rgba(232,85,85,0.04)",
              border: "1px solid rgba(232,85,85,0.15)",
              borderRadius: 10,
            }}>
              <div style={{ fontSize: 9, color: "#e85555", letterSpacing: "0.12em", marginBottom: 8 }}>DISAGREEMENTS</div>
              {(data.final_decision.disagreements || []).slice(0, 2).map((d, i) => (
                <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <span style={{ color: "#e85555", flexShrink: 0, fontSize: 10 }}>↔</span>
                  <span style={{ fontSize: 10, color: "#8892a4", lineHeight: 1.5 }}>{safeStr(d)}</span>
                </div>
              ))}
            </div>

          </div>
        ) : null}
      </div>
    );
  }

  // Stance comparison: for each agent, show both stances side by side
  const agentKeys = ["CEO", "CFO", "CMO", "Risk"];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 700,
      background: "rgba(0,0,0,0.92)",
      backdropFilter: "blur(10px)",
      display: "flex", flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        height: 52, flexShrink: 0,
        background: "#0a0f1a",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        display: "flex", alignItems: "center", gap: 14, padding: "0 20px",
      }}>
        <span style={{ fontFamily: "Playfair Display, serif", fontSize: 15, color: "#c9a84c" }}>
          ⚖ Scenario Comparison
        </span>
        <span style={{ fontSize: 10, color: "#4a566e" }}>
          Select two sessions to compare side by side
        </span>
        <div style={{ marginLeft: "auto" }}>
          <button onClick={onClose} style={{
            fontSize: 11, padding: "5px 14px", borderRadius: 7,
            background: "rgba(232,85,85,0.1)", border: "1px solid rgba(232,85,85,0.25)",
            color: "#e85555", cursor: "pointer", fontFamily: "DM Sans, sans-serif",
          }}>
            ✕ Close
          </button>
        </div>
      </div>

      {/* Session selectors */}
      <div style={{
        display: "flex", gap: 0,
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        background: "#0d1520",
        flexShrink: 0,
      }}>
        {/* Left selector */}
        <div style={{
          flex: 1, padding: "10px 16px",
          borderRight: "1px solid rgba(255,255,255,0.07)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 10, color: "#c9a84c", whiteSpace: "nowrap" }}>Session A</span>
          <select
            value={leftId}
            onChange={e => setLeftId(e.target.value)}
            style={{
              flex: 1, background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#d8dce8", borderRadius: 7, padding: "6px 10px",
              fontSize: 11, fontFamily: "DM Sans, sans-serif", outline: "none",
            }}
          >
            <option value="">— Select session —</option>
            {allSessions.map(s => (
              <option key={s.id} value={s.id}>
                [{s.verdict} {Math.round(s.confidence * 100)}%] {truncate(s.scenario, 55)} · {formatDate(s.saved_at)}
              </option>
            ))}
          </select>
        </div>

        {/* VS divider */}
        <div style={{
          width: 48, display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
          fontFamily: "Playfair Display, serif",
          fontSize: 14, color: "#c9a84c",
        }}>
          VS
        </div>

        {/* Right selector */}
        <div style={{
          flex: 1, padding: "10px 16px",
          borderLeft: "1px solid rgba(255,255,255,0.07)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 10, color: "#7c9ee8", whiteSpace: "nowrap" }}>Session B</span>
          <select
            value={rightId}
            onChange={e => setRightId(e.target.value)}
            style={{
              flex: 1, background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#d8dce8", borderRadius: 7, padding: "6px 10px",
              fontSize: 11, fontFamily: "DM Sans, sans-serif", outline: "none",
            }}
          >
            <option value="">— Select session —</option>
            {allSessions.map(s => (
              <option key={s.id} value={s.id}>
                [{s.verdict} {Math.round(s.confidence * 100)}%] {truncate(s.scenario, 55)} · {formatDate(s.saved_at)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stance quick-compare bar */}
      {leftData && rightData && (
        <div style={{
          display: "flex", flexShrink: 0,
          background: "#0a0f1a",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "8px 20px", gap: 6, alignItems: "center",
        }}>
          <span style={{ fontSize: 9, color: "#4a566e", marginRight: 4, whiteSpace: "nowrap" }}>STANCE DELTA</span>
          {agentKeys.map(key => {
            const meta = AGENT_META[key];
            const lPos = leftData.initial_positions?.find(p => p.agent === key);
            const rPos = rightData.initial_positions?.find(p => p.agent === key);
            const lStance = lPos?.stance || "—";
            const rStance = rPos?.stance || "—";
            const changed = lStance !== rStance;
            const lc = STANCE_COLOR[lStance] || "#4a566e";
            const rc = STANCE_COLOR[rStance] || "#4a566e";
            return (
              <div key={key} style={{
                flex: 1,
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 8px",
                background: changed ? "rgba(201,168,76,0.07)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${changed ? "rgba(201,168,76,0.2)" : "rgba(255,255,255,0.05)"}`,
                borderRadius: 8,
              }}>
                <span style={{ fontSize: 11 }}>{meta.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 8, color: meta.color, fontWeight: 600 }}>{key}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 8, color: lc, fontWeight: 700, textTransform: "uppercase" as const }}>{lStance}</span>
                    {changed && <span style={{ fontSize: 8, color: "#c9a84c" }}>≠</span>}
                    {!changed && <span style={{ fontSize: 8, color: "#4a566e" }}>=</span>}
                    <span style={{ fontSize: 8, color: rc, fontWeight: 700, textTransform: "uppercase" as const }}>{rStance}</span>
                  </div>
                </div>
                {changed && (
                  <span style={{
                    fontSize: 7, color: "#c9a84c",
                    background: "rgba(201,168,76,0.15)",
                    padding: "1px 4px", borderRadius: 4,
                  }}>DIFF</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Main comparison columns */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Left column */}
        <div style={{
          flex: 1, overflow: "hidden",
          borderRight: "1px solid rgba(255,255,255,0.07)",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{
            padding: "8px 16px", flexShrink: 0,
            background: "rgba(201,168,76,0.05)",
            borderBottom: "1px solid rgba(201,168,76,0.1)",
            fontSize: 10, color: "#c9a84c", letterSpacing: "0.1em",
          }}>
            SESSION A · {leftId ? leftId.slice(0, 8) : "—"}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
            <SessionColumn
              data={leftData}
              loading={loadingLeft}
              sessionId={leftId}
              onSelect={setLeftId}
            />
          </div>
        </div>

        {/* VS center strip */}
        <div style={{
          width: 48, flexShrink: 0,
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", gap: 16,
          background: "#080c14",
        }}>
          <div style={{
            fontFamily: "Playfair Display, serif",
            fontSize: 13, color: "#c9a84c",
            writingMode: "vertical-rl",
            letterSpacing: "0.2em",
          }}>
            VS
          </div>
          {leftData && rightData && (() => {
            const lPct = Math.round((leftData.final_decision?.confidence || 0) * 100);
            const rPct = Math.round((rightData.final_decision?.confidence || 0) * 100);
            const diff = lPct - rPct;
            return (
              <div style={{
                padding: "6px 4px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 8,
                textAlign: "center",
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, fontFamily: "DM Mono, monospace",
                  color: diff > 0 ? "#2dd4a0" : diff < 0 ? "#e85555" : "#4a566e",
                }}>
                  {diff > 0 ? "+" : ""}{diff}%
                </div>
                <div style={{ fontSize: 7, color: "#4a566e", marginTop: 2 }}>DIFF</div>
              </div>
            );
          })()}
        </div>

        {/* Right column */}
        <div style={{
          flex: 1, overflow: "hidden",
          borderLeft: "1px solid rgba(255,255,255,0.07)",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{
            padding: "8px 16px", flexShrink: 0,
            background: "rgba(124,158,232,0.05)",
            borderBottom: "1px solid rgba(124,158,232,0.1)",
            fontSize: 10, color: "#7c9ee8", letterSpacing: "0.1em",
          }}>
            SESSION B · {rightId ? rightId.slice(0, 8) : "—"}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
            <SessionColumn
              data={rightData}
              loading={loadingRight}
              sessionId={rightId}
              onSelect={setRightId}
            />
          </div>
        </div>
      </div>
    </div>
  );
}