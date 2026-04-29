export const PERSONALITY_TRAITS: Record<string, { trait: string; color: string; bg: string; border: string; icon: string }> = {
  CEO:  { trait: "First Principles", color: "#3b5bdb", bg: "#eef2ff", border: "#c5d0fa", icon: "⚡" },
  CFO:  { trait: "Data Driven",      color: "#0d7a4e", bg: "#e8f8f1", border: "#a8dfc5", icon: "📈" },
  CMO:  { trait: "Customer Obsessed",color: "#c2410c", bg: "#fff4ee", border: "#fbc99a", icon: "❤️" },
  Risk: { trait: "Fortress Mindset", color: "#6d28d9", bg: "#f5f3ff", border: "#c4b5fd", icon: "🏰" },
};

export default function PersonalityBadge({ agentKey }: { agentKey: string }) {
  const t = PERSONALITY_TRAITS[agentKey];
  if (!t) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 12, fontWeight: 500,
      color: t.color, background: t.bg,
      border: `1px solid ${t.border}`,
      padding: "3px 9px", borderRadius: 20,
      whiteSpace: "nowrap" as const,
    }}>
      {t.icon} {t.trait}
    </span>
  );
}