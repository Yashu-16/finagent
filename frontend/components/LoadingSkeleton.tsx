export default function LoadingSkeleton() {
  const pulse = {
    background: "rgba(255,255,255,0.05)",
    borderRadius: "8px",
    animation: "pulse 1.5s ease-in-out infinite",
  } as React.CSSProperties;

  return (
    <div className="space-y-6">
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 0.9; }
        }
      `}</style>

      {/* Status banner */}
      <div
        className="rounded-xl p-4 border text-center"
        style={{ borderColor: "rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.05)" }}
      >
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-5 h-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
          <span className="text-sm font-medium text-indigo-300">Boardroom in session…</span>
        </div>
        <p className="text-xs text-gray-500">Agents are reading the scenario, forming positions, and debating.</p>
      </div>

      {/* Agent card skeletons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {["CEO", "CFO", "CMO", "Risk"].map((agent, i) => (
          <div
            key={agent}
            className="rounded-xl p-5 border"
            style={{
              borderColor: "rgba(55,65,81,0.5)",
              background: "rgba(17,24,39,0.6)",
              animationDelay: `${i * 0.15}s`,
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div style={{ ...pulse, width: 32, height: 32, borderRadius: "50%" }} />
                <div>
                  <div style={{ ...pulse, width: 48, height: 12, marginBottom: 6 }} />
                  <div style={{ ...pulse, width: 120, height: 10 }} />
                </div>
              </div>
              <div style={{ ...pulse, width: 72, height: 22, borderRadius: 99 }} />
            </div>
            <div style={{ ...pulse, width: "100%", height: 12, marginBottom: 8 }} />
            <div style={{ ...pulse, width: "90%", height: 12, marginBottom: 8 }} />
            <div style={{ ...pulse, width: "80%", height: 12, marginBottom: 16 }} />
            <div style={{ ...pulse, width: "100%", height: 48, borderRadius: 8 }} />
          </div>
        ))}
      </div>
    </div>
  );
}