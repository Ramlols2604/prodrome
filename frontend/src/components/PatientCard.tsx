import { useState } from "react"
import type { Patient } from "../types"
import { severityColor, severityBorder, dissentColor } from "../lib/colors"
import SeverityBadge from "./SeverityBadge"

export default function PatientCard({ patient, onClick }: { patient: Patient; onClick: () => void }) {
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
        backgroundColor: hovered ? "#1d2840" : "#161e2a",
        borderRadius: "10px",
        border: hovered
          ? `1px solid ${severityBorder(patient.verdict)}`
          : "1px solid rgba(255,255,255,0.06)",
        padding: "0",
        textAlign: "left" as const,
        transition: "background-color 0.15s, border-color 0.15s, box-shadow 0.15s",
        boxShadow: hovered
          ? `0 4px 20px rgba(0,0,0,0.45), 0 0 0 0 ${color}00`
          : "0 1px 4px rgba(0,0,0,0.25)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Layer 1: Colored left edge = severity signal */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: "3px",
          backgroundColor: color,
          borderRadius: "10px 0 0 10px",
          opacity: hovered ? 1 : 0.8,
          transition: "opacity 0.15s",
        }}
      />

      <div style={{ padding: "18px 20px 18px 20px", paddingLeft: "20px", marginLeft: "3px" }}>
        {/* Row 1: ID + meta left, severity badge right */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "14px", fontWeight: 600, color: "#e8edf2", letterSpacing: "0.02em" }}>
              {patient.id}
            </span>
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>
              {patient.age}y {patient.sex} · H+{patient.icuHour}
            </span>
          </div>
          {/* Layer 2: Severity badge = headline status */}
          <SeverityBadge verdict={patient.verdict} />
        </div>

        {/* Layer 3: AI committee line + dissent — clearly labeled, neutral weight */}
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
        </div>

        {/* Layer 4: Primary clinical driver */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px" }}>
          <div style={{ display: "flex", gap: "6px", alignItems: "flex-start", flex: 1 }}>
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.28)", fontWeight: 500, whiteSpace: "nowrap" as const, paddingTop: "1px" }}>
              Primary concern:
            </span>
            <span style={{ fontSize: "12px", color: "rgba(232,237,242,0.6)", lineHeight: 1.5 }}>
              {patient.primaryDriver}
            </span>
          </div>
          {/* View details affordance */}
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

