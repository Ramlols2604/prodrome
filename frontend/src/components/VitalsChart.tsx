import { useState } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
} from "recharts"
import type { ExtendedSeries } from "../types"
import { generateTimeline, extendedProfiles } from "../data/patients"
import { severityDim } from "../lib/colors"

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: number }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ backgroundColor: "#1e2730", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "10px 14px" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "rgba(255,255,255,0.4)", marginBottom: "6px" }}>
        Hour {label}
      </div>
      {payload.map((p) => (
        <div key={p.name} style={{ display: "flex", justifyContent: "space-between", gap: "16px", fontSize: "12px" }}>
          <span style={{ color: p.color, fontWeight: 500 }}>{p.name}</span>
          <span style={{ fontFamily: "var(--font-mono)", color: "#e8edf2", fontWeight: 600 }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

type VitalsSeries = "hr" | "map" | "lactate" | "sbp" | "dbp" | "resp" | "temp" | "o2sat" | "etco2"

const SERIES_META: Record<VitalsSeries, { label: string; color: string; yAxis: "left" | "right" | "pct" | "temp"; dashed?: boolean; unit: string }> = {
  hr:      { label: "HR",      color: "#f59e0b", yAxis: "left",  unit: "bpm" },
  map:     { label: "MAP",     color: "#06b6d4", yAxis: "left",  unit: "mmHg" },
  sbp:     { label: "SBP",     color: "#7dd3fc", yAxis: "left",  unit: "mmHg", dashed: true },
  dbp:     { label: "DBP",     color: "#38bdf8", yAxis: "left",  unit: "mmHg", dashed: true },
  lactate: { label: "Lactate", color: "#ef4444", yAxis: "right", unit: "mmol/L", dashed: true },
  resp:    { label: "Resp",    color: "#a78bfa", yAxis: "right", unit: "/min" },
  temp:    { label: "Temp",    color: "#fb923c", yAxis: "temp",  unit: "°C" },
  o2sat:   { label: "O₂Sat",  color: "#34d399", yAxis: "pct",   unit: "%" },
  etco2:   { label: "EtCO₂",  color: "#60a5fa", yAxis: "right", unit: "mmHg" },
}

function mergeExtended(base: ReturnType<typeof generateTimeline>, ext: ExtendedSeries | undefined): Array<Record<string, number>> {
  return base.map((pt, i) => ({
    ...pt,
    sbp:   ext?.sbp[i]   ?? 0,
    dbp:   ext?.dbp[i]   ?? 0,
    resp:  ext?.resp[i]  ?? 0,
    temp:  ext?.temp[i]  ?? 0,
    o2sat: ext?.o2sat[i] ?? 0,
    etco2: ext?.etco2[i] ?? 0,
  }))
}

export default function VitalsChart({ patientId, icuHour }: { patientId: string; icuHour: number }) {
  const baseData = generateTimeline(patientId, icuHour)
  const ext = extendedProfiles[patientId]
  const data = mergeExtended(baseData, ext)
  const regions = baseData[0]?.regions || []
  const [expanded, setExpanded] = useState(false)
  const [active, setActive] = useState<Set<VitalsSeries>>(new Set(["hr", "map", "lactate"]))

  const toggleSeries = (s: VitalsSeries) => {
    setActive((prev) => {
      const next = new Set(prev)
      if (next.has(s)) { if (next.size > 1) next.delete(s) } else next.add(s)
      return next
    })
  }

  const allSeries: VitalsSeries[] = ["hr", "map", "sbp", "dbp", "lactate", "resp", "temp", "o2sat", "etco2"]
  const visibleSeries = expanded ? allSeries : (["hr", "map", "lactate"] as VitalsSeries[])

  return (
    <div style={{ backgroundColor: "#1a2130", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.07)", padding: "20px", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <div style={{ fontSize: "12px", fontWeight: 500, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Vitals Timeline</div>
          <div style={{ fontSize: "13px", color: "rgba(232,237,242,0.7)", marginTop: "2px" }}>
            ICU hours 0–{icuHour}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "rgba(255,255,255,0.25)", backgroundColor: "rgba(255,255,255,0.04)", padding: "4px 10px", borderRadius: "5px" }}>
            Current: H+{icuHour}
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{ all: "unset", cursor: "pointer", fontSize: "11px", color: expanded ? "#06b6d4" : "rgba(255,255,255,0.35)", backgroundColor: expanded ? "rgba(6,182,212,0.08)" : "rgba(255,255,255,0.04)", border: `1px solid ${expanded ? "rgba(6,182,212,0.3)" : "rgba(255,255,255,0.08)"}`, padding: "4px 10px", borderRadius: "5px", transition: "all 0.15s" }}
          >
            {expanded ? "Collapse" : "All series"}
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" as const, marginBottom: "14px" }}>
          {allSeries.map((s) => {
            const m = SERIES_META[s]
            const on = active.has(s)
            return (
              <button
                key={s}
                onClick={() => toggleSeries(s)}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  fontSize: "11px",
                  padding: "3px 9px",
                  borderRadius: "4px",
                  border: `1px solid ${on ? m.color + "80" : "rgba(255,255,255,0.08)"}`,
                  backgroundColor: on ? m.color + "18" : "transparent",
                  color: on ? m.color : "rgba(255,255,255,0.3)",
                  fontFamily: "var(--font-mono)",
                  transition: "all 0.12s",
                }}
              >
                {m.label}
              </button>
            )
          })}
        </div>
      )}

      <ResponsiveContainer width="100%" height={expanded ? 220 : 180}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
          {regions.map((r, i) => (
            <ReferenceArea key={i} x1={r.start} x2={r.end} fill={severityDim(r.verdict)} fillOpacity={0.6} yAxisId="left" />
          ))}
          <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis dataKey="hour" tick={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "rgba(255,255,255,0.3)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `H+${v}`} />
          <YAxis yAxisId="left" tick={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "rgba(255,255,255,0.3)" }} axisLine={false} tickLine={false} domain={[40, 160]} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "rgba(255,255,255,0.3)" }} axisLine={false} tickLine={false} domain={[0, 40]} />
          <YAxis yAxisId="pct" orientation="right" hide domain={[70, 100]} />
          <YAxis yAxisId="temp" orientation="right" hide domain={[35, 41]} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine x={icuHour} yAxisId="left" stroke="rgba(255,255,255,0.3)" strokeDasharray="4 4" strokeWidth={1.5} />
          {(expanded ? allSeries.filter((s) => active.has(s)) : (["hr", "map", "lactate"] as VitalsSeries[])).map((s) => {
            const m = SERIES_META[s]
            return (
              <Line
                key={s}
                yAxisId={m.yAxis}
                type="monotone"
                dataKey={s}
                name={`${m.label} (${m.unit})`}
                stroke={m.color}
                strokeWidth={2}
                dot={false}
                strokeDasharray={m.dashed ? "3 2" : undefined}
              />
            )
          })}
        </LineChart>
      </ResponsiveContainer>

      <div style={{ display: "flex", gap: "14px", marginTop: "12px", flexWrap: "wrap" as const }}>
        {(expanded ? allSeries.filter((s) => active.has(s)) : (["hr", "map", "lactate"] as VitalsSeries[])).map((s) => {
          const m = SERIES_META[s]
          return (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <div style={{ width: "16px", height: "2px", background: m.dashed ? "none" : m.color, borderTop: m.dashed ? `2px dashed ${m.color}` : undefined, borderRadius: "1px" }} />
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-ui)" }}>{m.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

