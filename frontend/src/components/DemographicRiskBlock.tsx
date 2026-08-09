import type { Patient, PatientAnalytics } from "../types"

export default function DemographicRiskBlock({ patient, analytics }: { patient: Patient; analytics: PatientAnalytics }) {
  const tiles = [
    { label: "Age", value: `${patient.age}y`, sub: patient.sex },
    { label: "Age Risk", value: analytics.ageRisk.split(" ")[0], sub: analytics.ageRisk.includes("(") ? analytics.ageRisk.split("(")[1].replace(")", "") : "" },
    { label: "Baseline Risk", value: analytics.baselineRisk, sub: "cohort context" },
  ]
  return (
    <div style={{ backgroundColor: "#1a2130", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.07)", padding: "20px", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
      <div style={{ fontSize: "12px", fontWeight: 500, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "16px" }}>Demographic Risk Context</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
        {tiles.map((t) => (
          <div key={t.label} style={{ backgroundColor: "rgba(255,255,255,0.03)", borderRadius: "7px", padding: "14px 16px", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "6px" }}>{t.label}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "18px", fontWeight: 600, color: "#e8edf2", letterSpacing: "-0.02em" }}>{t.value}</div>
            {t.sub && <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginTop: "3px" }}>{t.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

