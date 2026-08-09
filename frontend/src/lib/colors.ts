import type { Severity } from "../types"

export function severityColor(s: Severity) {
  return {
    STABLE: "#10b981",
    WATCH: "#f59e0b",
    DETERIORATING: "#f97316",
    CRITICAL: "#ef4444",
  }[s]
}

export function severityDim(s: Severity) {
  return {
    STABLE: "rgba(16,185,129,0.12)",
    WATCH: "rgba(245,158,11,0.12)",
    DETERIORATING: "rgba(249,115,22,0.12)",
    CRITICAL: "rgba(239,68,68,0.12)",
  }[s]
}

export function severityBorder(s: Severity) {
  return {
    STABLE: "rgba(16,185,129,0.3)",
    WATCH: "rgba(245,158,11,0.3)",
    DETERIORATING: "rgba(249,115,22,0.3)",
    CRITICAL: "rgba(239,68,68,0.3)",
  }[s]
}

export function dissentColor(score: number) {
  if (score < 20) return "#10b981"
  if (score < 40) return "#f59e0b"
  if (score < 65) return "#f97316"
  return "#ef4444"
}
