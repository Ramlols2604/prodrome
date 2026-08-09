import { AlertTriangle } from "lucide-react"
import type { Agent, Severity } from "../types"
import { severityColor, severityDim, severityBorder } from "../lib/colors"
import AgentIcon from "./AgentIcon"
import SeverityBadge from "./SeverityBadge"

export default function AgentCard({
  agent,
  dominantVerdict,
  narrationLoading,
}: {
  agent: Agent
  dominantVerdict: Severity
  narrationLoading?: boolean
}) {
  const differs = agent.verdict !== dominantVerdict
  const color = severityColor(agent.verdict)
  const accentBg = severityDim(agent.verdict)
  const accentBorder = severityBorder(agent.verdict)

  return (
    <div
      style={{
        backgroundColor: "#1a2130",
        borderRadius: "10px",
        border: differs
          ? `1.5px solid ${severityBorder(agent.verdict)}`
          : "1px solid rgba(255,255,255,0.07)",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        position: "relative",
        boxShadow: differs
          ? `0 0 20px ${severityDim(agent.verdict)}, 0 4px 12px rgba(0,0,0,0.4)`
          : "0 4px 12px rgba(0,0,0,0.3)",
        transition: "box-shadow 0.2s",
      }}
    >
      {differs && (
        <div
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            backgroundColor: accentBg,
            border: `1px solid ${accentBorder}`,
            borderRadius: "4px",
            padding: "2px 7px",
            fontSize: "9px",
            fontWeight: 600,
            color: color,
            letterSpacing: "0.08em",
          }}
        >
          <AlertTriangle size={9} />
          DISSENT
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            backgroundColor: accentBg,
            border: `1px solid ${accentBorder}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: color,
            flexShrink: 0,
          }}
        >
          <AgentIcon type={agent.icon} />
        </div>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 500, color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Agent
          </div>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "#e8edf2" }}>{agent.name}</div>
        </div>
      </div>

      {/* Verdict */}
      <SeverityBadge verdict={agent.verdict} />

      {/* Narration */}
      {narrationLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ height: "10px", borderRadius: "4px", background: "rgba(255,255,255,0.05)", animation: "pulse 1.8s ease-in-out 0.1s infinite", width: "100%" }} />
          <div style={{ height: "10px", borderRadius: "4px", background: "rgba(255,255,255,0.05)", animation: "pulse 1.8s ease-in-out 0.2s infinite", width: "85%" }} />
          <div style={{ height: "10px", borderRadius: "4px", background: "rgba(255,255,255,0.05)", animation: "pulse 1.8s ease-in-out 0.3s infinite", width: "70%" }} />
        </div>
      ) : (
        <p style={{ fontSize: "12.5px", lineHeight: "1.65", color: "rgba(232,237,242,0.65)", margin: 0 }}>
          {agent.narration}
        </p>
      )}

      {/* Weight bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", fontWeight: 500, letterSpacing: "0.06em" }}>
          SEVERITY
        </span>
        <div style={{ display: "flex", gap: "3px" }}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                width: "18px",
                height: "4px",
                borderRadius: "2px",
                backgroundColor: i <= agent.weight ? color : "rgba(255,255,255,0.1)",
                transition: "background-color 0.2s",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

