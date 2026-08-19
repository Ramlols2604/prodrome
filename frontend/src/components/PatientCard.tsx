import { useState } from "react"
import { Bookmark } from "lucide-react"
import type { Patient, Severity } from "../types"
import { SEVERITY_ORDER } from "../types"
import { severityColor, severityBorder, dissentColor } from "../lib/colors"
import SeverityBadge from "./SeverityBadge"

function VerdictSparkline({
  history,
  color,
}: {
  history: Array<{ hour: number; verdict: Severity }>
  color: string
}) {
  if (!history.length) return null
  const w = 60
  const h = 18
  const pad = 1
  const maxSev = 3
  const n = history.length
  const xOf = (i: number) => pad + (n === 1 ? (w - pad * 2) / 2 : (i / (n - 1)) * (w - pad * 2))
  const yOf = (verdict: Severity) => pad + (1 - SEVERITY_ORDER[verdict] / maxSev) * (h - pad * 2)
  const pts: string[] = []
  history.forEach((p, i) => {
    const x = xOf(i).toFixed(1)
    const y = yOf(p.verdict).toFixed(1)
    if (i === 0) {
      pts.push(`${x},${y}`)
      return
    }
    pts.push(`${x},${yOf(history[i - 1].verdict).toFixed(1)}`)
    pts.push(`${x},${y}`)
  })
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label="Severity over recent hours" style={{ display: "block", flexShrink: 0 }}>
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="miter"
        strokeLinecap="butt"
      />
    </svg>
  )
}

export default function PatientCard({
  patient,
  flagged,
  onToggleFlag,
  onClick,
}: {
  patient: Patient
  flagged?: boolean
  onToggleFlag?: () => void
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const color = severityColor(patient.verdict)
  const dColor = dissentColor(patient.dissentScore)

  const committeeColors: Record<string, string> = {
    Consensus: "rgba(255,255,255,0.35)",
    Majority: "rgba(255,255,255,0.35)",
    Contested: "#f97316",
    Split: "#f59e0b",
  }
  const statusColor = committeeColors[patient.committeeStatus] ?? "rgba(255,255,255,0.35)"
  const urgent = patient.verdict === "CRITICAL" || patient.verdict === "DETERIORATING"
  const barW = urgent ? 5 : 3

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        all: "unset",
        cursor: "pointer",
        display: "block",
        width: "100%",
        background: hovered
          ? urgent
            ? `linear-gradient(90deg, ${color}2e 0%, #1d2840 88px)`
            : "#1d2840"
          : urgent
            ? `linear-gradient(90deg, ${color}22 0%, #161e2a 96px)`
            : "#161e2a",
        borderRadius: "10px",
        border: hovered
          ? `1px solid ${severityBorder(patient.verdict)}`
          : urgent
            ? `1px solid ${color}55`
            : "1px solid rgba(255,255,255,0.06)",
        padding: "0",
        textAlign: "left" as const,
        transition: "background-color 0.15s, border-color 0.15s, box-shadow 0.15s",
        boxShadow: urgent
          ? hovered
            ? `0 4px 22px ${color}33, 0 0 0 1px ${color}30`
            : `0 2px 14px ${color}1f, 0 0 0 1px ${color}18`
          : hovered
            ? "0 4px 20px rgba(0,0,0,0.45)"
            : "0 1px 4px rgba(0,0,0,0.25)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: `${barW}px`,
          backgroundColor: color,
          borderRadius: "10px 0 0 10px",
          boxShadow: urgent ? `0 0 10px ${color}` : "none",
          opacity: hovered || urgent ? 1 : 0.8,
          transition: "opacity 0.15s",
        }}
      />

      <div style={{
        padding: urgent ? "16px 18px 16px 18px" : "14px 16px 14px 16px",
        paddingLeft: urgent ? "20px" : "16px",
        marginLeft: `${barW}px`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span
              title={`Dissent ${patient.dissentScore}/100`}
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: dColor,
                boxShadow: patient.dissentScore > 33.3 ? `0 0 7px ${dColor}` : "none",
                flexShrink: 0,
              }}
            />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "14px", fontWeight: 600, color: "#e8edf2", letterSpacing: "0.02em" }}>
              {patient.id}
            </span>
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>
              {patient.age}y {patient.sex} · H+{patient.icuHour}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {onToggleFlag && (
              <span
                role="button"
                aria-label={flagged ? "Remove from worklist" : "Add to worklist"}
                title={flagged ? "Remove from worklist" : "Flag for review"}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onToggleFlag()
                }}
                style={{
                  display: "inline-flex",
                  color: flagged ? "#f59e0b" : "rgba(255,255,255,0.22)",
                  padding: "2px",
                }}
              >
                <Bookmark size={14} fill={flagged ? "#f59e0b" : "none"} />
              </span>
            )}
            <SeverityBadge verdict={patient.verdict} />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.28)", fontWeight: 500 }}>AI committee:</span>
            <span style={{ fontSize: "11px", color: statusColor, fontWeight: 600 }}>{patient.committeeStatus}</span>
          </div>
          <div style={{ width: "1px", height: "12px", backgroundColor: "rgba(255,255,255,0.1)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.28)", fontWeight: 500 }}>Dissent:</span>
            <div style={{ width: "48px", height: "3px", backgroundColor: "rgba(255,255,255,0.07)", borderRadius: "2px" }}>
              <div style={{ width: `${patient.dissentScore}%`, height: "100%", backgroundColor: dColor, borderRadius: "2px" }} />
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: dColor, fontWeight: 500 }}>
              {patient.dissentScore}%
            </span>
          </div>
          {patient.verdictHistory && patient.verdictHistory.length > 1 && (
            <>
              <div style={{ width: "1px", height: "12px", backgroundColor: "rgba(255,255,255,0.1)" }} />
              <VerdictSparkline history={patient.verdictHistory} color={color} />
            </>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px" }}>
          <div style={{ display: "flex", gap: "6px", alignItems: "flex-start", flex: 1 }}>
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.28)", fontWeight: 500, whiteSpace: "nowrap" as const, paddingTop: "1px" }}>
              Primary concern:
            </span>
            <span style={{ fontSize: "12px", color: "rgba(232,237,242,0.6)", lineHeight: 1.5 }}>
              {patient.primaryDriver}
            </span>
          </div>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 500,
              color: hovered ? color : "rgba(255,255,255,0.2)",
              whiteSpace: "nowrap" as const,
              transition: "color 0.15s",
              flexShrink: 0,
            }}
          >
            View details →
          </span>
        </div>
      </div>
    </button>
  )
}
