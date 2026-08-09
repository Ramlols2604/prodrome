import type { PatientAnalytics } from "../types"

export default function LabDrawTimeline({ analytics, icuHour }: { analytics: PatientAnalytics; icuHour: number }) {
  const labs = Object.keys(analytics.labDraws)
  return (
    <div style={{ backgroundColor: "#1a2130", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.07)", padding: "20px", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div style={{ fontSize: "12px", fontWeight: 500, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Lab Draw Timeline</div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "rgba(255,255,255,0.25)" }}>{analytics.labsDrawnCount} draws · H+0–H+{icuHour}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {labs.map((lab) => {
          const draws = analytics.labDraws[lab]
          return (
            <div key={lab} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "rgba(255,255,255,0.4)", width: "88px", flexShrink: 0 }}>{lab}</div>
              <div style={{ flex: 1, position: "relative", height: "20px" }}>
                {/* Track */}
                <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: "1px", backgroundColor: "rgba(255,255,255,0.07)", transform: "translateY(-50%)" }} />
                {/* Dots */}
                {draws.map((d) => {
                  const pct = icuHour > 0 ? (d.hour / icuHour) * 100 : 0
                  const color = d.status === "abnormal" ? "#ef4444" : "#10b981"
                  return (
                    <div
                      key={d.hour}
                      title={`H+${d.hour}: ${d.status}`}
                      style={{
                        position: "absolute",
                        left: `${pct}%`,
                        top: "50%",
                        transform: "translate(-50%, -50%)",
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: color,
                        border: `1.5px solid ${color}40`,
                        boxShadow: `0 0 4px ${color}60`,
                      }}
                    />
                  )
                })}
                {/* H axis ticks */}
                {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
                  <div key={frac} style={{ position: "absolute", left: `${frac * 100}%`, top: "100%", transform: "translateX(-50%)", fontSize: "9px", color: "rgba(255,255,255,0.18)", fontFamily: "var(--font-mono)", marginTop: "2px" }}>
                    H+{Math.round(frac * icuHour)}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ display: "flex", gap: "14px", marginTop: "22px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}><div style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "#10b981" }} /><span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>Normal</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}><div style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "#ef4444" }} /><span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>Abnormal</span></div>
      </div>
    </div>
  )
}

