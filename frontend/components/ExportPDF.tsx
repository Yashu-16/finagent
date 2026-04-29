"use client";

interface AgentPosition {
  agent: string;
  role: string;
  stance: string;
  reasoning: string;
  key_concern: string;
}

interface DebateRound {
  round_number: number;
  exchanges: {
    agent: string;
    target_agent: string;
    argument: string;
    stance: string;
  }[];
}

interface FinalDecision {
  verdict: string;
  confidence: number;
  supporting_arguments: string[];
  disagreements: string[];
  rationale: string;
}

interface Props {
  scenario: string;
  sessionId: string;
  initialPositions: AgentPosition[];
  debateRounds: DebateRound[];
  decision: FinalDecision;
  onClose: () => void;
}

const AGENT_META: Record<string, { realName: string; title: string; color: string }> = {
  CEO:  { realName: "Elon Musk",     title: "Chief Executive Officer · Tesla/SpaceX/X", color: "#7c9ee8" },
  CFO:  { realName: "Sachin Mehra",  title: "Chief Financial Officer · Mastercard",     color: "#2dd4a0" },
  CMO:  { realName: "Julia White",   title: "Chief Marketing Officer · SAP",            color: "#e87c4a" },
  Risk: { realName: "Ashley Bacon",  title: "Chief Risk Officer · JP Morgan Chase",     color: "#c47ce8" },
};

const WEIGHTS: Record<string, number> = { CEO: 50, CFO: 17, CMO: 17, Risk: 16 };

function safeStr(val: unknown): string {
  if (typeof val === "string") return val;
  if (val && typeof val === "object") {
    const v = val as Record<string, unknown>;
    return (v.argument || v.text || v.content || JSON.stringify(val)) as string;
  }
  return String(val ?? "");
}

export default function ExportPDF({ scenario, sessionId, initialPositions, debateRounds, decision, onClose }: Props) {
  const verdictColor = decision.verdict === "Approved" ? "#16a34a"
    : decision.verdict === "Rejected" ? "#dc2626" : "#d97706";
  const pct = Math.round(decision.confidence * 100);
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  function buildHTML(): string {
    const positionsHTML = initialPositions.map(p => {
      const meta = AGENT_META[p.agent];
      const stanceColor = p.stance === "approve" ? "#16a34a" : p.stance === "reject" ? "#dc2626" : "#d97706";
      return `
        <div style="margin-bottom:18px; padding:14px 16px; border:1px solid #e5e7eb; border-radius:8px; border-left:4px solid ${meta?.color || "#999"};">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
            <div>
              <div style="font-size:14px; font-weight:700; color:#111;">${meta?.realName || p.agent}</div>
              <div style="font-size:11px; color:#6b7280;">${meta?.title || p.role}</div>
            </div>
            <span style="font-size:11px; font-weight:700; color:${stanceColor}; background:${stanceColor}15; padding:3px 10px; border-radius:99px; border:1px solid ${stanceColor}40; text-transform:uppercase;">
              ${p.stance}
            </span>
          </div>
          <p style="font-size:12px; color:#374151; line-height:1.6; margin:0 0 8px;">${p.reasoning}</p>
          <div style="background:#f9fafb; border-radius:6px; padding:8px 10px;">
            <span style="font-size:10px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.05em;">Key Concern: </span>
            <span style="font-size:11px; color:#374151;">${p.key_concern}</span>
          </div>
        </div>
      `;
    }).join("");

    const roundsHTML = debateRounds.map(r => {
      const exchanges = r.exchanges.map(ex => {
        const src = AGENT_META[ex.agent];
        const tgt = AGENT_META[ex.target_agent];
        const stanceColor = ex.stance === "approve" ? "#16a34a" : ex.stance === "reject" ? "#dc2626" : "#d97706";
        return `
          <div style="margin-bottom:12px; padding:12px 14px; background:#f9fafb; border-radius:8px; border-left:3px solid ${src?.color || "#999"};">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
              <span style="font-size:12px; font-weight:600; color:${src?.color || "#999"};">${src?.realName || ex.agent}</span>
              <span style="font-size:10px; color:#9ca3af;">→</span>
              <span style="font-size:11px; color:${tgt?.color || "#999"};">${tgt?.realName || ex.target_agent}</span>
              <span style="margin-left:auto; font-size:10px; color:${stanceColor}; font-weight:600; text-transform:uppercase;">${ex.stance}</span>
            </div>
            <p style="font-size:12px; color:#374151; line-height:1.6; margin:0;">${ex.argument}</p>
          </div>
        `;
      }).join("");
      return `
        <div style="margin-bottom:20px;">
          <div style="font-size:11px; font-weight:700; color:#c9a84c; text-transform:uppercase; letter-spacing:0.12em; margin-bottom:10px; padding-bottom:6px; border-bottom:1px solid #f3f4f6;">
            Debate Round ${r.round_number}
          </div>
          ${exchanges}
        </div>
      `;
    }).join("");

    const supportHTML = decision.supporting_arguments.map(a =>
      `<li style="margin-bottom:6px; font-size:12px; color:#374151; line-height:1.6;">${safeStr(a)}</li>`
    ).join("");

    const disagreeHTML = decision.disagreements.map(d =>
      `<li style="margin-bottom:6px; font-size:12px; color:#374151; line-height:1.6;">${safeStr(d)}</li>`
    ).join("");

    const signaturesHTML = initialPositions.map(p => {
      const meta = AGENT_META[p.agent];
      return `
        <div style="flex:1; min-width:180px; text-align:center;">
          <div style="border-top:1px solid #d1d5db; padding-top:8px; margin-top:32px;">
            <div style="font-size:12px; font-weight:600; color:#111;">${meta?.realName || p.agent}</div>
            <div style="font-size:10px; color:#6b7280;">${meta?.title?.split("·")[0].trim()}</div>
            <div style="font-size:10px; color:#6b7280;">${WEIGHTS[p.agent]}% vote weight</div>
          </div>
        </div>
      `;
    }).join("");

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>FinAgent Board Memo — ${sessionId}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; color: #111; background: #fff; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .no-print { display: none !important; }
            .page-break { page-break-before: always; }
          }
        </style>
      </head>
      <body>
        <div style="max-width:800px; margin:0 auto; padding:40px 32px;">

          <!-- Header -->
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px; padding-bottom:20px; border-bottom:3px solid #0e1117;">
            <div>
              <div style="font-size:28px; font-weight:900; color:#0e1117; letter-spacing:-0.02em;">FinAgent</div>
              <div style="font-size:13px; color:#6b7280; margin-top:2px;">AI Boardroom — Executive Decision Memo</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:11px; color:#6b7280;">Session ID</div>
              <div style="font-size:13px; font-family:monospace; color:#111;">${sessionId}</div>
              <div style="font-size:11px; color:#6b7280; margin-top:4px;">${date}</div>
            </div>
          </div>

          <!-- Scenario -->
          <div style="margin-bottom:28px;">
            <div style="font-size:10px; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:0.12em; margin-bottom:8px;">Business Scenario</div>
            <div style="background:#f9fafb; border:1px solid #e5e7eb; border-left:4px solid #c9a84c; border-radius:8px; padding:14px 16px; font-size:14px; color:#111; line-height:1.6; font-style:italic;">
              "${scenario}"
            </div>
          </div>

          <!-- Verdict -->
          <div style="margin-bottom:28px; padding:20px 24px; background:${verdictColor}08; border:2px solid ${verdictColor}30; border-radius:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-size:10px; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:0.15em; margin-bottom:4px;">Board Verdict</div>
                <div style="font-size:28px; font-weight:900; color:${verdictColor};">${decision.verdict}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:40px; font-weight:900; color:${verdictColor}; font-family:monospace;">${pct}%</div>
                <div style="font-size:11px; color:#6b7280;">Weighted Confidence</div>
              </div>
            </div>
            <div style="margin-top:14px; padding-top:14px; border-top:1px solid ${verdictColor}20;">
              <div style="font-size:10px; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:6px;">Executive Rationale</div>
              <p style="font-size:12px; color:#374151; line-height:1.7;">${safeStr(decision.rationale)}</p>
            </div>

            <!-- Vote weight breakdown -->
            <div style="margin-top:14px; display:flex; gap:12px; flex-wrap:wrap;">
              ${initialPositions.map(p => {
                const meta = AGENT_META[p.agent];
                const sc = p.stance === "approve" ? "#16a34a" : p.stance === "reject" ? "#dc2626" : "#d97706";
                return `
                  <div style="flex:1; min-width:140px; padding:8px 12px; background:white; border:1px solid #e5e7eb; border-radius:6px;">
                    <div style="font-size:10px; font-weight:600; color:${meta?.color || "#999"};">${meta?.realName?.split(" ")[0] || p.agent}</div>
                    <div style="font-size:10px; color:${sc}; font-weight:700; text-transform:uppercase;">${p.stance}</div>
                    <div style="font-size:9px; color:#9ca3af;">${WEIGHTS[p.agent]}% weight</div>
                  </div>
                `;
              }).join("")}
            </div>
          </div>

          <!-- Supporting Arguments -->
          <div style="margin-bottom:24px;">
            <div style="font-size:10px; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:0.12em; margin-bottom:10px;">Supporting Arguments</div>
            <ul style="padding-left:18px; list-style:disc;">${supportHTML}</ul>
          </div>

          <!-- Disagreements -->
          <div style="margin-bottom:28px;">
            <div style="font-size:10px; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:0.12em; margin-bottom:10px;">Key Disagreements</div>
            <ul style="padding-left:18px; list-style:disc;">${disagreeHTML}</ul>
          </div>

          <!-- Page break before debate -->
          <div class="page-break"></div>

          <!-- Initial Positions -->
          <div style="margin-bottom:28px; margin-top:20px;">
            <div style="font-size:16px; font-weight:800; color:#111; margin-bottom:16px; padding-bottom:8px; border-bottom:2px solid #f3f4f6;">
              Initial Executive Positions
            </div>
            ${positionsHTML}
          </div>

          <!-- Debate Rounds -->
          <div style="margin-bottom:28px;">
            <div style="font-size:16px; font-weight:800; color:#111; margin-bottom:16px; padding-bottom:8px; border-bottom:2px solid #f3f4f6;">
              Board Debate Transcript
            </div>
            ${roundsHTML}
          </div>

          <!-- Signatures -->
          <div style="margin-top:40px; padding-top:24px; border-top:2px solid #111;">
            <div style="font-size:10px; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:0.12em; margin-bottom:4px;">Board Attestation</div>
            <div style="font-size:11px; color:#6b7280; margin-bottom:24px;">
              This memo reflects the AI-simulated deliberation of the executive panel. Decision carries ${pct}% board confidence.
            </div>
            <div style="display:flex; gap:24px; flex-wrap:wrap;">${signaturesHTML}</div>
          </div>

          <!-- Footer -->
          <div style="margin-top:40px; padding-top:16px; border-top:1px solid #e5e7eb; display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size:10px; color:#9ca3af;">Generated by FinAgent AI Boardroom · ${date}</div>
            <div style="font-size:10px; color:#9ca3af; font-family:monospace;">${sessionId}</div>
          </div>

        </div>
      </body>
      </html>
    `;
  }

  function handlePrint() {
    const html = buildHTML();
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  }

  function handleDownload() {
    const html = buildHTML();
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `FinAgent-BoardMemo-${sessionId}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Preview the memo inline
  const html = buildHTML();

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 600,
      background: "rgba(0,0,0,0.9)",
      backdropFilter: "blur(8px)",
      display: "flex", flexDirection: "column",
    }}>
      {/* Toolbar */}
      <div style={{
        height: 50, flexShrink: 0,
        background: "#0d1520",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        display: "flex", alignItems: "center", gap: 10, padding: "0 18px",
      }}>
        <span style={{ fontFamily: "Playfair Display, serif", fontSize: 14, color: "#c9a84c" }}>
          📄 Board Memo Preview
        </span>
        <span style={{ fontSize: 10, color: "#4a566e", fontFamily: "DM Mono, monospace" }}>
          {sessionId}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={handlePrint} style={{
            fontSize: 11, padding: "6px 16px", borderRadius: 7,
            background: "linear-gradient(135deg, #c9a84c, #e8d070)",
            color: "#000", fontWeight: 700, border: "none",
            cursor: "pointer", fontFamily: "DM Sans, sans-serif",
          }}>
            🖨 Print / Save as PDF
          </button>
          <button onClick={handleDownload} style={{
            fontSize: 11, padding: "6px 16px", borderRadius: 7,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "#d8dce8", cursor: "pointer",
            fontFamily: "DM Sans, sans-serif",
          }}>
            ⬇ Download HTML
          </button>
          <button onClick={onClose} style={{
            fontSize: 11, padding: "6px 14px", borderRadius: 7,
            background: "rgba(232,85,85,0.12)",
            border: "1px solid rgba(232,85,85,0.25)",
            color: "#e85555", cursor: "pointer",
            fontFamily: "DM Sans, sans-serif",
          }}>
            ✕ Close
          </button>
        </div>
      </div>

      {/* Preview iframe */}
      <div style={{ flex: 1, overflow: "hidden", background: "#f3f4f6" }}>
        <iframe
          srcDoc={html}
          style={{ width: "100%", height: "100%", border: "none" }}
          title="Board Memo Preview"
        />
      </div>
    </div>
  );
}