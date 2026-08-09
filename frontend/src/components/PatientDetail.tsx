import { useState, useCallback } from "react"
import { Clock, RefreshCw, AlertTriangle } from "lucide-react"
import type { Patient } from "../types"
import { getAnalytics } from "../data/patients"
import { severityColor, severityDim, severityBorder, dissentColor } from "../lib/colors"
import SeverityBadge from "./SeverityBadge"
import DissentGauge from "./DissentGauge"
import AgentCard from "./AgentCard"
import LoadingAgentCard from "./LoadingAgentCard"
import VitalsChart from "./VitalsChart"
import SignalFlagsPanel from "./SignalFlagsPanel"
import LabDrawTimeline from "./LabDrawTimeline"
import TrajectoryPanel from "./TrajectoryPanel"
import SeverityDissentChart from "./SeverityDissentChart"
import DemographicRiskBlock from "./DemographicRiskBlock"
import DissentModal from "./DissentModal"
import ProdromeWordmark from "./ProdromeWordmark"

export default function PatientDetail({
  patient,
  onBack,
  onAbout,
  loading,
}: {
  patient: Patient
  onBack: () => void
  onAbout: () => void
  loading: boolean
}) {
  const [showDissent, setShowDissent] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState(0)
  const [flashHeader, setFlashHeader] = useState(false)
  const dominantVerdict = patient.verdict
  const analytics = getAnalytics(patient)

  const handleRefresh = useCallback(() => {
    if (isRefreshing) return
    setIsRefreshing(true)
    setTimeout(() => {
      setIsRefreshing(false)
      setLastRefreshed(Date.now())
      setFlashHeader(true)
      setTimeout(() => setFlashHeader(false), 600)
    }, 1400)
  }, [isRefreshing])

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0f1419" }}>
      {/* Nav */}
      <nav style={{
        backgroundColor: "#0f1419",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "0 32px",
        height: "60px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <button
            onClick={onBack}
            style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "rgba(255,255,255,0.4)", transition: "color 0.2s" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#e8edf2")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
          >
            ← Patient List
          </button>
          <div style={{ width: "1px", height: "20px", backgroundColor: "rgba(255,255,255,0.1)" }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "rgba(255,255,255,0.5)" }}>
            {patient.id}
          </span>
        </div>
        <ProdromeWordmark small />
        <button
          onClick={onAbout}
          style={{ all: "unset", cursor: "pointer", fontSize: "12px", color: "rgba(255,255,255,0.28)", fontFamily: "var(--font-ui)", transition: "color 0.15s" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#e8edf2")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.28)")}
        >
          About
        </button>
      </nav>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 32px 64px" }}>
        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "32px",
          flexWrap: "wrap" as const,
          gap: "20px",
          transition: "box-shadow 0.3s",
          boxShadow: flashHeader ? `0 0 0 2px ${severityColor(dominantVerdict)}40` : "none",
          borderRadius: "10px",
          padding: flashHeader ? "12px" : "0",
        }}>
          <div>
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>
              Committee Analysis — {patient.age}y · {patient.sex} · ICU H+{patient.icuHour}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" as const }}>
              <h1 style={{ fontFamily: "var(--font-mono)", fontSize: "28px", fontWeight: 700, margin: 0, color: "#e8edf2", letterSpacing: "-0.02em" }}>
                {patient.id}
              </h1>
              {!loading && <SeverityBadge verdict={dominantVerdict} large />}
              {loading && (
                <div style={{ height: "34px", width: "120px", borderRadius: "6px", background: "rgba(255,255,255,0.07)", animation: "pulse 1.8s ease-in-out infinite" }} />
              )}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            {!loading && (
              <button
                onClick={() => setShowDissent(true)}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <DissentGauge score={patient.dissentScore} />
              </button>
            )}
            {loading && (
              <div style={{ width: "88px", height: "88px", borderRadius: "50%", background: "rgba(255,255,255,0.04)", animation: "pulse 1.8s ease-in-out infinite" }} />
            )}

            {!loading && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "11px",
                  color: "rgba(255,255,255,0.2)",
                  fontFamily: "var(--font-ui)",
                }}>
                  <Clock size={12} />
                  <span>H+{patient.icuHour} current</span>
                </div>
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  style={{
                    all: "unset",
                    cursor: isRefreshing ? "default" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    fontSize: "11px",
                    color: isRefreshing ? "#06b6d4" : "rgba(255,255,255,0.35)",
                    backgroundColor: isRefreshing ? "rgba(6,182,212,0.08)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${isRefreshing ? "rgba(6,182,212,0.25)" : "rgba(255,255,255,0.08)"}`,
                    padding: "5px 12px",
                    borderRadius: "6px",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { if (!isRefreshing) { (e.currentTarget as HTMLElement).style.color = "#e8edf2"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.18)" } }}
                  onMouseLeave={(e) => { if (!isRefreshing) { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)" } }}
                >
                  <RefreshCw size={12} style={{ animation: isRefreshing ? "spin 0.9s linear infinite" : "none" }} />
                  {isRefreshing ? "Refreshing…" : lastRefreshed > 0 ? "Refreshed" : "Refresh"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Agent Cards */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "11px", fontWeight: 500, color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "14px" }}>
            Specialist Committee
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
            {loading
              ? [
                  { name: "Vitals", icon: "vitals" as const },
                  { name: "Labs", icon: "labs" as const },
                  { name: "Demographic / Risk", icon: "risk" as const },
                  { name: "Historical Pattern", icon: "history" as const },
                ].map((a) => <LoadingAgentCard key={a.name} {...a} />)
              : patient.agents.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} dominantVerdict={dominantVerdict} />
                ))}
          </div>
        </div>

        {/* Timeline */}
        <div style={{ marginBottom: "24px" }}>
          {loading ? (
            <div style={{ height: "280px", backgroundColor: "#1a2130", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.07)", animation: "pulse 1.8s ease-in-out 0.2s infinite" }} />
          ) : (
            <VitalsChart patientId={patient.id} icuHour={patient.icuHour} />
          )}
        </div>

        {/* Signal Flags + Lab Draw Timeline side by side */}
        {!loading && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
            <SignalFlagsPanel analytics={analytics} />
            <LabDrawTimeline analytics={analytics} icuHour={patient.icuHour} />
          </div>
        )}

        {/* Trajectory Trends */}
        {!loading && (
          <div style={{ marginBottom: "24px" }}>
            <TrajectoryPanel analytics={analytics} />
          </div>
        )}

        {/* Historical State: Severity & Dissent Over Time */}
        {!loading && (
          <div style={{ marginBottom: "24px" }}>
            <SeverityDissentChart analytics={analytics} icuHour={patient.icuHour} />
          </div>
        )}

        {/* Demographic Risk */}
        {!loading && (
          <div style={{ marginBottom: "24px" }}>
            <DemographicRiskBlock patient={patient} analytics={analytics} />
          </div>
        )}

        {/* Judge Synthesis */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "11px", fontWeight: 500, color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "14px" }}>
            Judge Synthesis
          </div>
          {loading ? (
            <div style={{ backgroundColor: "#1a2130", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.07)", padding: "24px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {[100, 90, 80, 70].map((w, i) => (
                <div key={i} style={{ height: "12px", borderRadius: "4px", background: "rgba(255,255,255,0.05)", animation: `pulse 1.8s ease-in-out ${i * 0.1}s infinite`, width: `${w}%` }} />
              ))}
            </div>
          ) : (
            <div style={{
              backgroundColor: "#1a2130",
              borderRadius: "10px",
              border: `1px solid ${severityBorder(dominantVerdict)}`,
              padding: "24px 28px",
              boxShadow: `0 0 30px ${severityDim(dominantVerdict)}, 0 4px 16px rgba(0,0,0,0.4)`,
              position: "relative",
            }}>
              <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "2px",
                backgroundColor: severityColor(dominantVerdict),
                borderRadius: "10px 10px 0 0",
                opacity: 0.6,
              }} />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "7px",
                    backgroundColor: severityDim(dominantVerdict),
                    border: `1px solid ${severityBorder(dominantVerdict)}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "13px",
                  }}>
                    ⚖
                  </div>
                  <div>
                    <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>AI Judge</div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#e8edf2" }}>Synthesis &amp; Verdict</div>
                  </div>
                </div>
                <button
                  onClick={() => setShowDissent(true)}
                  style={{
                    all: "unset",
                    cursor: "pointer",
                    fontSize: "11px",
                    color: dissentColor(patient.dissentScore),
                    backgroundColor: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    padding: "5px 12px",
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontWeight: 500,
                  }}
                >
                  <AlertTriangle size={11} />
                  Dissent {patient.dissentScore}/100 — view detail
                </button>
              </div>

              <p style={{ fontSize: "14px", lineHeight: "1.75", color: "rgba(232,237,242,0.8)", margin: 0 }}>
                {patient.judgeSynthesis}
              </p>
            </div>
          )}
        </div>
      </div>

      {showDissent && !loading && <DissentModal patient={patient} onClose={() => setShowDissent(false)} />}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

