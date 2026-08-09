import type { PatientAnalytics, FlagStatus, SignalFlag } from "../types"

export default function SignalFlagsPanel({ analytics }: { analytics: PatientAnalytics }) {
  const vitals = analytics.signalFlags.filter((f) => f.category === "vitals")
  const labs = analytics.signalFlags.filter((f) => f.category === "labs")
  const flagColor = (s: FlagStatus) => s === "normal" ? "#10b981" : s === "abnormal" ? "#ef4444" : "rgba(255,255,255,0.2)"
  const flagBg = (s: FlagStatus) => s === "normal" ? "rgba(16,185,129,0.1)" : s === "abnormal" ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.04)"

  const FlagRow = ({ f }: { f: SignalFlag }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: flagColor(f.status), flexShrink: 0 }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "rgba(255,255,255,0.7)", width: "72px" }}>{f.signal}</span>
        {f.flag && (
          <span style={{ fontSize: "10px", color: flagColor(f.status), backgroundColor: flagBg(f.status), padding: "1px 6px", borderRadius: "3px", fontFamily: "var(--font-ui)" }}>{f.flag}</span>
        )}
      </div>
      {f.value && <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "rgba(255,255,255,0.45)" }}>{f.value}</span>}
    </div>
  )

  return (
    <div style={{ backgroundColor: "#1a2130", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.07)", padding: "20px", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
      <div style={{ fontSize: "12px", fontWeight: 500, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "16px" }}>Signal Flags</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 32px" }}>
        <div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" }}>Vitals</div>
          {vitals.map((f) => <FlagRow key={f.signal} f={f} />)}
        </div>
        <div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" }}>Labs</div>
          {labs.map((f) => <FlagRow key={f.signal} f={f} />)}
        </div>
      </div>
    </div>
  )
}

