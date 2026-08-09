import { X, Info } from "lucide-react"
import type { Patient } from "../types"
import { SEVERITY_ORDER } from "../data/patients"
import { severityColor, severityDim, dissentColor } from "../lib/colors"

export default function DissentModal({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const sorted = [...patient.agents].sort((a, b) => SEVERITY_ORDER[b.verdict] - SEVERITY_ORDER[a.verdict])

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#161c24",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "14px",
          width: "min(600px, 90vw)",
          padding: "32px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 500, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px" }}>
              Committee Disagreement Analysis
            </div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "#e8edf2" }}>Dissent Score: {" "}
              <span style={{ fontFamily: "var(--font-mono)", color: dissentColor(patient.dissentScore) }}>{patient.dissentScore}/100</span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ all: "unset", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: "4px" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Divergence chart */}
        <div style={{ marginBottom: "28px" }}>
          {sorted.map((agent) => {
            const sev = SEVERITY_ORDER[agent.verdict]
            const color = severityColor(agent.verdict)
            return (
              <div key={agent.id} style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                <div style={{ width: "140px", display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                  <div style={{ color: "rgba(255,255,255,0.3)", display: "flex" }}>
                    <AgentIcon type={agent.icon} />
                  </div>
                  <span style={{ fontSize: "12px", color: "rgba(232,237,242,0.6)", fontWeight: 500 }}>{agent.name}</span>
                </div>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ flex: 1, height: "28px", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: "6px", position: "relative", overflow: "hidden" }}>
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${(sev + 1) * 25}%`,
                        backgroundColor: severityDim(agent.verdict),
                        borderRight: `2px solid ${color}`,
                        transition: "width 0.4s",
                        display: "flex",
                        alignItems: "center",
                        paddingLeft: "10px",
                      }}
                    >
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color, fontWeight: 600 }}>
                        {agent.verdict}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Reference lines */}
        <div style={{ display: "flex", gap: "0", marginBottom: "24px" }}>
          {(["STABLE", "WATCH", "DETERIORATING", "CRITICAL"] as Severity[]).map((s) => (
            <div key={s} style={{ flex: 1, textAlign: "center", fontSize: "9px", color: severityColor(s), fontWeight: 600, letterSpacing: "0.06em", opacity: 0.6 }}>
              {s.slice(0, 4)}
            </div>
          ))}
        </div>

        {/* Microcopy */}
        <div style={{
          backgroundColor: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "8px",
          padding: "14px 16px",
          display: "flex",
          gap: "10px",
          alignItems: "flex-start",
        }}>
          <Info size={14} color="rgba(255,255,255,0.25)" style={{ marginTop: "1px", flexShrink: 0 }} />
          <p style={{ fontSize: "12px", lineHeight: "1.6", color: "rgba(232,237,242,0.45)", margin: 0 }}>
            Disagreement between specialist agents can indicate a clinically ambiguous case worth closer review. A high dissent score does not imply error — it reflects genuine uncertainty in the available data.
          </p>
        </div>
      </div>
    </div>
  )
}

