export const PERSONALITY_TRAITS: Record<string, { trait: string; color: string; icon: string }> = {
  CEO:  { trait: "First Principles", color: "#818cf8", icon: "⚡" },
  CFO:  { trait: "Data Driven",      color: "#34d399", icon: "📈" },
  CMO:  { trait: "Customer Obsessed",color: "#fb923c", icon: "❤️" },
  Risk: { trait: "Fortress Mindset", color: "#c084fc", icon: "🏰" },
};

export default function PersonalityBadge({ agentKey }: { agentKey: string }) {
  const trait = PERSONALITY_TRAITS[agentKey];
  if (!trait) return null;
  return (
    <span style={{
      fontSize: 11,
      color: trait.color,
      background: trait.color + "18",
      border: `1px solid ${trait.color}35`,
      padding: "2px 8px",
      borderRadius: 20,
      whiteSpace: "nowrap" as const,
      fontWeight: 500,
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
    }}>
      {trait.icon} {trait.trait}
    </span>
  );
}