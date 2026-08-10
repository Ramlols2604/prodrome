import { useEffect, useId, useState } from "react"
import { createPortal } from "react-dom"
import { AlertTriangle, X } from "lucide-react"
import type { Agent, Severity } from "../types"
import { severityColor, severityDim, severityBorder } from "../lib/colors"
import AgentIcon from "./AgentIcon"
import SeverityBadge from "./SeverityBadge"

const NARRATION_EXCERPT_LEN = 180

function parseFinding(raw: string): { signal: string; detail: string } {
  const parts = raw.split(/\s+[—–-]\s+/).map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    return { signal: parts[0], detail: parts.slice(1).join(" — ") }
  }
  return { signal: raw.trim(), detail: "" }
}

function truncateNarration(text: string, max = NARRATION_EXCERPT_LEN): string {
  const cleaned = text.replace(/\s+/g, " ").trim()
  if (cleaned.length <= max) return cleaned
  return `${cleaned.slice(0, max).replace(/\s+\S*$/, "")}…`
}

function FindingRow({
  finding,
  compact,
}: {
  finding: string
  compact?: boolean
}) {
  const { signal, detail } = parseFinding(finding)
  return (
    <div style={{ display: "flex", gap: compact ? "8px" : "10px", alignItems: "flex-start" }}>
      <span
        style={{
          width: "5px",
          height: "5px",
          borderRadius: "50%",
          backgroundColor: "rgba(232,237,242,0.35)",
          marginTop: compact ? "6px" : "7px",
          flexShrink: 0,
        }}
      />
      <div style={{ fontSize: compact ? "12px" : "13.5px", lineHeight: compact ? 1.5 : 1.6, color: "rgba(232,237,242,0.7)" }}>
        <span style={{ fontWeight: 600, color: "#e8edf2" }}>{signal}</span>
        {detail ? (
          <>
            <span style={{ color: "rgba(255,255,255,0.22)" }}> — </span>
            <span>{detail}</span>
          </>
        ) : null}
      </div>
    </div>
  )
}

function AgentAnalysisModal({
  agent,
  onClose,
}: {
  agent: Agent
  onClose: () => void
}) {
  const findings = (agent.findings ?? []).filter(Boolean)
  const hasStructured = findings.length > 0

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener("keydown", onKey)
    }
  }, [onClose])

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${agent.name} full analysis`}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        backdropFilter: "blur(4px)",
        animation: "agentModalFade 0.16s ease-out",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#161c24",
          border: `1px solid ${severityBorder(agent.verdict)}`,
          borderRadius: "14px",
          width: "min(560px, 92vw)",
          maxHeight: "86vh",
          overflowY: "auto",
          padding: "28px 32px 32px",
          boxShadow: `0 24px 60px rgba(0,0,0,0.6), 0 0 30px ${severityDim(agent.verdict)}`,
          animation: "agentModalIn 0.16s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "9px",
                backgroundColor: severityDim(agent.verdict),
                border: `1px solid ${severityBorder(agent.verdict)}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: severityColor(agent.verdict),
                flexShrink: 0,
              }}
            >
              <AgentIcon type={agent.icon} />
            </div>
            <div>
              <div style={{ fontSize: "11px", fontWeight: 500, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Full analysis
              </div>
              <div style={{ fontSize: "18px", fontWeight: 700, color: "#e8edf2" }}>{agent.name}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ all: "unset", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: "4px" }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <SeverityBadge verdict={agent.verdict} />
        </div>

        {hasStructured ? (
          <>
            {agent.summary ? (
              <p style={{ fontSize: "15px", fontWeight: 600, lineHeight: 1.55, color: "#e8edf2", margin: "0 0 20px" }}>
                {agent.summary}
              </p>
            ) : null}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {findings.map((f, i) => {
                const { signal } = parseFinding(f)
                return (
                  <div
                    key={`${agent.id}-modal-${i}-${signal}`}
                    style={{
                      backgroundColor: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: "8px",
                      padding: "12px 14px",
                    }}
                  >
                    <FindingRow finding={f} />
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <p style={{ fontSize: "14px", lineHeight: 1.7, color: "rgba(232,237,242,0.75)", margin: 0, whiteSpace: "pre-wrap" }}>
            {agent.narration}
          </p>
        )}
      </div>
      <style>{`
        @keyframes agentModalFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes agentModalIn {
          from { opacity: 0; transform: translateY(6px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>,
    document.body,
  )
}

export default function AgentCard({
  agent,
  dominantVerdict,
  narrationLoading,
}: {
  agent: Agent
  dominantVerdict: Severity
  narrationLoading?: boolean
}) {
  const listId = useId()
  // Snapshot the agent at open time so parent re-renders (committee fetch)
  // cannot flash different content into an already-open modal.
  const [analysisAgent, setAnalysisAgent] = useState<Agent | null>(null)
  const differs = agent.verdict !== dominantVerdict
  const color = severityColor(agent.verdict)
  const accentBg = severityDim(agent.verdict)
  const accentBorder = severityBorder(agent.verdict)
  const findings = (agent.findings ?? []).filter(Boolean)
  const hasStructured = findings.length > 0
  const hasContent = hasStructured || Boolean(agent.narration)

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

      {/* Summary + findings, or narration fallback */}
      {narrationLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ height: "10px", borderRadius: "4px", background: "rgba(255,255,255,0.05)", animation: "pulse 1.8s ease-in-out 0.1s infinite", width: "100%" }} />
          <div style={{ height: "10px", borderRadius: "4px", background: "rgba(255,255,255,0.05)", animation: "pulse 1.8s ease-in-out 0.2s infinite", width: "85%" }} />
          <div style={{ height: "10px", borderRadius: "4px", background: "rgba(255,255,255,0.05)", animation: "pulse 1.8s ease-in-out 0.3s infinite", width: "70%" }} />
        </div>
      ) : hasStructured ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {agent.summary ? (
            <p style={{ fontSize: "12.5px", fontWeight: 600, lineHeight: 1.55, color: "#e8edf2", margin: 0 }}>
              {agent.summary}
            </p>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
            {findings.map((f, i) => (
              <FindingRow key={`${listId}-f-${i}`} finding={f} compact />
            ))}
          </div>
        </div>
      ) : (
        <p style={{ fontSize: "12.5px", lineHeight: "1.65", color: "rgba(232,237,242,0.65)", margin: 0 }}>
          {truncateNarration(agent.narration)}
        </p>
      )}

      {!narrationLoading && hasContent && (
        <button
          type="button"
          onClick={() => setAnalysisAgent(agent)}
          style={{
            all: "unset",
            cursor: "pointer",
            alignSelf: "flex-start",
            fontSize: "11px",
            fontWeight: 500,
            color: "rgba(255,255,255,0.38)",
            letterSpacing: "0.02em",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#e8edf2" }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.38)" }}
        >
          View full analysis →
        </button>
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

      {analysisAgent && (
        <AgentAnalysisModal agent={analysisAgent} onClose={() => setAnalysisAgent(null)} />
      )}
    </div>
  )
}
