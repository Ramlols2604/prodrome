import { useState, useEffect } from "react"

export default function LiveStatusBar() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const dataAge = 12 + (tick % 30)
  const aiAge = 8 + (tick % 24)
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
      {/* Pulse dot */}
      <div style={{ position: "relative", width: "8px", height: "8px", flexShrink: 0 }}>
        <div style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          backgroundColor: "#10b981",
          animation: "livePulse 2s ease-in-out infinite",
        }} />
        <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#10b981", position: "relative" }} />
      </div>
      <span style={{ fontSize: "11px", color: "#10b981", fontWeight: 600, letterSpacing: "0.04em" }}>Live</span>
      <div style={{ width: "1px", height: "14px", backgroundColor: "rgba(255,255,255,0.08)" }} />
      <div style={{ display: "flex", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.28)" }}>Patient data:</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "rgba(255,255,255,0.55)" }}> {dataAge}s ago</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.28)" }}>AI assessment:</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "rgba(255,255,255,0.55)" }}> {aiAge}s ago</span>
        </div>
      </div>
      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.5); }
        }
      `}</style>
    </div>
  )
}

