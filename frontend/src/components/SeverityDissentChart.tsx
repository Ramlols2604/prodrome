import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts"
import type { PatientAnalytics } from "../types"

export default function SeverityDissentChart({ analytics, icuHour }: { analytics: PatientAnalytics; icuHour: number }) {
  const data = analytics.hourlyHistory
  const SEV_COLORS = ["#10b981", "#f59e0b", "#f97316", "#ef4444"]

  const CustomSevTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const pt = data.find((d) => d.hour === label)
    return (
      <div style={{ backgroundColor: "#1e2730", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", padding: "8px 12px", fontFamily: "var(--font-mono)", fontSize: "11px" }}>
        <div style={{ color: "rgba(255,255,255,0.4)", marginBottom: "4px" }}>H+{label}</div>
        {pt && <div style={{ color: SEV_COLORS[pt.severity] }}>{pt.severityLabel}</div>}
        {payload.map((p: any) => (
          <div key={p.dataKey} style={{ color: p.dataKey === "dissent" ? "#a78bfa" : "rgba(255,255,255,0.7)" }}>
            {p.dataKey === "dissent" ? `Dissent: ${p.value}` : ""}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: "#1a2130", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.07)", padding: "20px", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
        <div>
          <div style={{ fontSize: "12px", fontWeight: 500, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Historical State</div>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", marginTop: "2px" }}>Observed severity + committee dissent — ICU H+0–H+{icuHour}</div>
        </div>
        <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", backgroundColor: "rgba(255,255,255,0.04)", padding: "3px 8px", borderRadius: "4px", letterSpacing: "0.05em" }}>
          HISTORICAL · NOT A PREDICTION
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        {/* Severity step chart */}
        <div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginBottom: "6px", letterSpacing: "0.05em", textTransform: "uppercase" }}>Severity Over Time</div>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontFamily: "var(--font-mono)", fontSize: 9, fill: "rgba(255,255,255,0.25)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `H+${v}`} interval={Math.floor(data.length / 4)} />
              <YAxis domain={[-0.2, 3.2]} tick={false} axisLine={false} tickLine={false} ticks={[0, 1, 2, 3]} />
              <Tooltip content={<CustomSevTooltip />} />
              {[0, 1, 2, 3].map((level) => (
                <ReferenceLine key={level} y={level} stroke={SEV_COLORS[level] + "30"} strokeDasharray="3 3" />
              ))}
              <Line
                type="stepAfter"
                dataKey="severity"
                stroke="#06b6d4"
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", padding: "0 4px" }}>
            {["STABLE", "WATCH", "DETR.", "CRIT."].map((l, i) => (
              <span key={l} style={{ fontSize: "9px", color: SEV_COLORS[i] + "80", fontFamily: "var(--font-mono)" }}>{l}</span>
            ))}
          </div>
        </div>

        {/* Dissent step chart */}
        <div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginBottom: "6px", letterSpacing: "0.05em", textTransform: "uppercase" }}>Dissent Over Time</div>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontFamily: "var(--font-mono)", fontSize: 9, fill: "rgba(255,255,255,0.25)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `H+${v}`} interval={Math.floor(data.length / 4)} />
              <YAxis domain={[0, 100]} tick={{ fontFamily: "var(--font-mono)", fontSize: 9, fill: "rgba(255,255,255,0.25)" }} axisLine={false} tickLine={false} ticks={[0, 25, 50, 75, 100]} />
              <Tooltip content={<CustomSevTooltip />} />
              <ReferenceLine y={65} stroke="rgba(239,68,68,0.2)" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="dissent" stroke="#a78bfa" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

