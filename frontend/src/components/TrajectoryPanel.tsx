import type { PatientAnalytics, TrendDir, TrendInterp } from "../types"

export default function TrajectoryPanel({ analytics }: { analytics: PatientAnalytics }) {
  const arrowColor = (interp: TrendInterp) => interp === "worsening" ? "#ef4444" : interp === "improving" ? "#10b981" : "rgba(255,255,255,0.35)"
  const arrowIcon = (dir: TrendDir, interp: TrendInterp) => {
    const color = arrowColor(interp)
    if (dir === "up") return <span style={{ color, fontSize: "14px", lineHeight: 1 }}>↑</span>
    if (dir === "down") return <span style={{ color, fontSize: "14px", lineHeight: 1 }}>↓</span>
    return <span style={{ color, fontSize: "14px", lineHeight: 1 }}>→</span>
  }

  const overallColors: Record<string, string> = { WORSENING: "#ef4444", IMPROVING: "#10b981", STABLE: "rgba(255,255,255,0.4)", MIXED: "#f59e0b" }
  const overallColor = overallColors[analytics.overallTrend] ?? "rgba(255,255,255,0.4)"

  return (
    <div style={{ backgroundColor: "#1a2130", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.07)", padding: "20px", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div style={{ fontSize: "12px", fontWeight: 500, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Trajectory Trends</div>
        <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: overallColor, backgroundColor: overallColor + "18", border: `1px solid ${overallColor}40`, padding: "2px 9px", borderRadius: "4px", fontWeight: 600, letterSpacing: "0.04em" }}>
          {analytics.overallTrend}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
        {analytics.trends.map((t) => (
          <div key={t.signal} style={{ backgroundColor: "rgba(255,255,255,0.03)", borderRadius: "7px", padding: "10px 12px", border: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: "8px" }}>
            {arrowIcon(t.direction, t.interpretation)}
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>{t.signal}</div>
              <div style={{ fontSize: "10px", color: arrowColor(t.interpretation), marginTop: "1px" }}>{t.interpretation}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

