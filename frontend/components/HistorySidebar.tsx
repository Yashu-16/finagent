"use client";
import { useState, useEffect } from "react";

interface SessionSummary {
  session_id: string;
  scenario: string;
  verdict: string;
  confidence: number;
  saved_at: string;
}

interface Props {
  currentSessionId: string | null;
  onLoad: (session: SessionSummary & { full: unknown }) => void;
}

const VERDICT_COLOR: Record<string, string> = {
  "Approved":             "#2dd4a0",
  "Conditional Approval": "#e8a830",
  "Rejected":             "#e85555",
};

const VERDICT_ICON: Record<string, string> = {
  "Approved":             "✓",
  "Conditional Approval": "◈",
  "Rejected":             "✕",
};

export default function HistorySidebar({ currentSessionId, onLoad }: Props) {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function fetchSessions() {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/logs");
      const data = await res.json();
      const ids: string[] = data.sessions || [];

      const summaries = await Promise.all(
        ids.slice(-20).reverse().map(async (id) => {
          try {
            const r = await fetch(`http://localhost:8000/logs/${id}`);
            const d = await r.json();
            return {
              session_id: id,
              scenario: d.scenario || "Unknown scenario",
              verdict: d.final_decision?.verdict || "Unknown",
              confidence: d.final_decision?.confidence || 0,
              saved_at: d.saved_at || "",
              full: d,
            };
          } catch {
            return null;
          }
        })
      );

      setSessions(summaries.filter(Boolean) as SessionSummary[]);
    } catch (e) {
      console.error("Failed to load sessions", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) fetchSessions();
  }, [open]);

  async function handleLoad(id: string) {
    setLoadingId(id);
    try {
      const res = await fetch(`http://localhost:8000/logs/${id}`);
      const full = await res.json();
      const summary = sessions.find(s => s.session_id === id);
      if (summary) onLoad({ ...summary, full });
    } catch (e) {
      console.error("Failed to load session", e);
    } finally {
      setLoadingId(null);
    }
  }

  function formatDate(iso: string) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString("en-US", {
        month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch { return ""; }
  }

  function truncate(text: string, n = 72) {
    return text.length > n ? text.slice(0, n) + "…" : text;
  }

  return (
    <>
      {/* Toggle tab */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          position: "fixed", left: open ? 300 : 0, top: "50%",
          transform: "translateY(-50%)",
          zIndex: 100,
          width: 22, height: 64,
          background: open ? "#1a2235" : "rgba(201,168,76,0.15)",
          border: `1px solid ${open ? "rgba(255,255,255,0.08)" : "rgba(201,168,76,0.3)"}`,
          borderLeft: open ? "none" : undefined,
          borderRadius: open ? "0 8px 8px 0" : "0 8px 8px 0",
          color: "#c9a84c",
          fontSize: 10, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          writingMode: "vertical-rl",
          letterSpacing: "0.1em",
          transition: "left 0.3s ease",
          fontFamily: "DM Sans, sans-serif",
        }}
        title="Session History"
      >
        {open ? "◀" : "▶"}
      </button>

      {/* Sidebar panel */}
      <div style={{
        position: "fixed", left: open ? 0 : -300, top: 46, bottom: 0,
        width: 300, zIndex: 99,
        background: "#0a0f1a",
        borderRight: "1px solid rgba(255,255,255,0.07)",
        display: "flex", flexDirection: "column",
        transition: "left 0.3s ease",
        boxShadow: open ? "4px 0 24px rgba(0,0,0,0.5)" : "none",
      }}>
        {/* Header */}
        <div style={{
          padding: "14px 16px 10px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", gap: 8,
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: "Playfair Display, serif",
            fontSize: 13, color: "#c9a84c",
          }}>
            Session History
          </span>
          <span style={{
            fontSize: 10, color: "#4a566e",
            background: "rgba(255,255,255,0.04)",
            padding: "1px 7px", borderRadius: 99,
          }}>
            {sessions.length} sessions
          </span>
          <button
            onClick={fetchSessions}
            style={{
              marginLeft: "auto", fontSize: 10, padding: "3px 8px", borderRadius: 5,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#4a566e", cursor: "pointer",
              fontFamily: "DM Sans, sans-serif",
            }}
            title="Refresh"
          >
            ↻
          </button>
        </div>

        {/* Sessions list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 10px 16px" }}>
          {loading && (
            <div style={{ textAlign: "center", padding: 32, color: "#4a566e", fontSize: 12 }}>
              Loading sessions…
            </div>
          )}

          {!loading && sessions.length === 0 && (
            <div style={{ textAlign: "center", padding: 32 }}>
              <div style={{ fontSize: 28, opacity: 0.2, marginBottom: 10 }}>🗂</div>
              <div style={{ fontSize: 12, color: "#4a566e" }}>No past sessions yet.</div>
              <div style={{ fontSize: 10, color: "#4a566e", marginTop: 4 }}>
                Run a simulation to save it here.
              </div>
            </div>
          )}

          {!loading && sessions.map((s) => {
            const vc = VERDICT_COLOR[s.verdict] || "#4a566e";
            const vi = VERDICT_ICON[s.verdict] || "?";
            const isCurrent = s.session_id === currentSessionId;
            const pct = Math.round(s.confidence * 100);

            return (
              <div
                key={s.session_id}
                style={{
                  marginBottom: 8,
                  padding: "10px 12px",
                  background: isCurrent ? "rgba(201,168,76,0.08)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${isCurrent ? "rgba(201,168,76,0.25)" : "rgba(255,255,255,0.05)"}`,
                  borderRadius: 10,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={e => {
                  if (!isCurrent) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)";
                }}
                onMouseLeave={e => {
                  if (!isCurrent) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)";
                }}
              >
                {/* Top row */}
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
                  {/* Verdict badge */}
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%",
                    background: vc + "20", border: `1.5px solid ${vc}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, color: vc, fontWeight: 700, flexShrink: 0,
                  }}>
                    {vi}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: vc }}>
                      {s.verdict}
                    </div>
                    <div style={{ fontSize: 8, color: "#4a566e", fontFamily: "DM Mono, monospace" }}>
                      {s.session_id}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: vc, fontFamily: "DM Mono, monospace" }}>
                      {pct}%
                    </div>
                    <div style={{ fontSize: 8, color: "#4a566e" }}>confidence</div>
                  </div>
                </div>

                {/* Scenario text */}
                <p style={{
                  fontSize: 10.5, color: "#8892a4", lineHeight: 1.5,
                  margin: "0 0 8px",
                }}>
                  {truncate(s.scenario)}
                </p>

                {/* Confidence bar */}
                <div style={{
                  height: 3, background: "rgba(255,255,255,0.05)",
                  borderRadius: 99, overflow: "hidden", marginBottom: 8,
                }}>
                  <div style={{
                    height: "100%", width: `${pct}%`,
                    background: vc, borderRadius: 99,
                  }} />
                </div>

                {/* Footer row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 9, color: "#4a566e" }}>
                    {formatDate(s.saved_at)}
                  </span>
                  {isCurrent ? (
                    <span style={{
                      fontSize: 9, color: "#c9a84c",
                      background: "rgba(201,168,76,0.1)",
                      padding: "2px 7px", borderRadius: 99,
                      border: "1px solid rgba(201,168,76,0.2)",
                    }}>
                      Current
                    </span>
                  ) : (
                    <button
                      onClick={() => handleLoad(s.session_id)}
                      disabled={loadingId === s.session_id}
                      style={{
                        fontSize: 9, padding: "3px 10px", borderRadius: 5,
                        background: "rgba(124,158,232,0.12)",
                        border: "1px solid rgba(124,158,232,0.25)",
                        color: "#7c9ee8",
                        cursor: loadingId === s.session_id ? "not-allowed" : "pointer",
                        fontFamily: "DM Sans, sans-serif",
                      }}
                    >
                      {loadingId === s.session_id ? "Loading…" : "Load →"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Stats footer */}
        {sessions.length > 0 && (
          <div style={{
            borderTop: "1px solid rgba(255,255,255,0.06)",
            padding: "10px 14px",
            flexShrink: 0,
            display: "flex", gap: 10,
          }}>
            {[
              { label: "Approved", color: "#2dd4a0" },
              { label: "Conditional", color: "#e8a830" },
              { label: "Rejected", color: "#e85555" },
            ].map(({ label, color }) => {
              const key = label === "Conditional" ? "Conditional Approval" : label;
              const count = sessions.filter(s => s.verdict === key).length;
              return (
                <div key={label} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color, fontFamily: "DM Mono, monospace" }}>
                    {count}
                  </div>
                  <div style={{ fontSize: 8, color: "#4a566e", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {label}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}