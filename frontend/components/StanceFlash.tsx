"use client";
import { useEffect, useState } from "react";

interface Props {
  agentKey: string;
  stance: string;
  prevStance: string;
  color: string;
}

const STANCE_COLOR: Record<string, string> = {
  approve: "#2dd4a0", conditional: "#e8a830", reject: "#e85555", idle: "transparent",
};

export default function StanceFlash({ agentKey, stance, prevStance, color }: Props) {
  const [flashing, setFlashing] = useState(false);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    if (prevStance !== "idle" && prevStance !== stance) {
      setFlashing(true);
      setChanged(true);
      const t1 = setTimeout(() => setFlashing(false), 1200);
      const t2 = setTimeout(() => setChanged(false), 4000);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [stance]);

  if (!changed && !flashing) return null;

  const sc = STANCE_COLOR[stance] || color;

  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      pointerEvents: "none",
      zIndex: 999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      {flashing && (
        <div style={{
          background: sc + "18",
          border: `2px solid ${sc}`,
          borderRadius: 16,
          padding: "12px 24px",
          animation: "fadeUp 0.3s ease both",
          backdropFilter: "blur(4px)",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 11, color: sc, fontWeight: 700, letterSpacing: "0.1em" }}>
            STANCE CHANGED
          </div>
          <div style={{ fontSize: 9, color: "#8892a4", marginTop: 3 }}>
            {agentKey}: {prevStance.toUpperCase()} → {stance.toUpperCase()}
          </div>
        </div>
      )}
    </div>
  );
}