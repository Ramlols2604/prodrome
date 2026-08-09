import type { Severity } from "../types"
import { severityColor, severityDim, severityBorder } from "../lib/colors"

export default function SeverityBadge({ verdict, large }: { verdict: Severity; large?: boolean }) {
  const color = severityColor(verdict)
  const bg = severityDim(verdict)
  const border = severityBorder(verdict)
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: large ? "8px" : "5px",
        backgroundColor: bg,
        border: `1px solid ${border}`,
        borderRadius: "6px",
        padding: large ? "6px 14px" : "3px 9px",
        fontFamily: "var(--font-ui)",
        fontSize: large ? "15px" : "11px",
        fontWeight: 600,
        letterSpacing: "0.08em",
        color: color,
        whiteSpace: "nowrap" as const,
      }}
    >
      {large && (
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}`,
          }}
        />
      )}
      {verdict}
    </span>
  )
}

