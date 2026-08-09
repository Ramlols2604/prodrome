import type { Agent } from "../types"
import AgentIcon from "./AgentIcon"

export default function LoadingAgentCard({ name, icon }: { name: string; icon: Agent["icon"] }) {
  return (
    <div
      style={{
        backgroundColor: "#1a2130",
        borderRadius: "10px",
        border: "1px solid rgba(255,255,255,0.07)",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            backgroundColor: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(255,255,255,0.2)",
          }}
        >
          <AgentIcon type={icon} />
        </div>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 500, color: "rgba(255,255,255,0.25)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Agent</div>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "rgba(232,237,242,0.4)" }}>{name}</div>
        </div>
      </div>

      {/* Shimmer badge */}
      <div style={{ height: "26px", width: "90px", borderRadius: "6px", background: "rgba(255,255,255,0.06)", animation: "pulse 1.8s ease-in-out infinite" }} />

      {/* Shimmer lines */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <div style={{ height: "10px", borderRadius: "4px", background: "rgba(255,255,255,0.05)", animation: "pulse 1.8s ease-in-out 0.1s infinite", width: "100%" }} />
        <div style={{ height: "10px", borderRadius: "4px", background: "rgba(255,255,255,0.05)", animation: "pulse 1.8s ease-in-out 0.2s infinite", width: "85%" }} />
        <div style={{ height: "10px", borderRadius: "4px", background: "rgba(255,255,255,0.05)", animation: "pulse 1.8s ease-in-out 0.3s infinite", width: "70%" }} />
      </div>

      <div style={{ display: "flex", gap: "3px" }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ width: "18px", height: "4px", borderRadius: "2px", backgroundColor: "rgba(255,255,255,0.08)" }} />
        ))}
      </div>
    </div>
  )
}

