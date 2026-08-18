export type Severity = "STABLE" | "WATCH" | "DETERIORATING" | "CRITICAL"

export const SEVERITY_ORDER: Record<Severity, number> = {
  STABLE: 0,
  WATCH: 1,
  DETERIORATING: 2,
  CRITICAL: 3,
}

export interface Agent {
  id: string
  name: string
  icon: "vitals" | "labs" | "risk" | "history"
  verdict: Severity
  narration: string
  summary?: string | null
  findings?: string[]
  weight: number // 0-3
}

export interface Patient {
  id: string
  age: number
  sex: string
  icuHour: number
  verdict: Severity
  dissentScore: number
  committeeStatus: "Consensus" | "Majority" | "Contested" | "Split"
  primaryDriver: string
  agents: Agent[]
  judgeSynthesis: string
  archetypal?: "stable" | "critical" | "contested"
  baselineRisk?: string
  labsDrawnCount?: number
  hoursRequested?: number
  verdictHistory?: Array<{ hour: number; verdict: Severity; dissent_score?: number }>
}

export type ExtendedSeries = { sbp: number[]; dbp: number[]; resp: number[]; temp: number[]; o2sat: number[]; etco2: number[] }

export type FlagStatus = "normal" | "abnormal" | "unknown"
export type TrendDir = "up" | "down" | "flat"
export type TrendInterp = "worsening" | "improving" | "stable"

export interface SignalFlag { signal: string; category: "vitals" | "labs"; status: FlagStatus; flag?: string; value?: string }
export interface LabDraw { hour: number; status: "normal" | "abnormal" }
export interface TrendItem { signal: string; direction: TrendDir; interpretation: TrendInterp }
export interface HourlyPoint { hour: number; severity: number; severityLabel: Severity; dissent: number }

export interface PatientAnalytics {
  signalFlags: SignalFlag[]
  labDraws: Record<string, LabDraw[]>
  trends: TrendItem[]
  overallTrend: "WORSENING" | "IMPROVING" | "STABLE" | "MIXED"
  hourlyHistory: HourlyPoint[]
  ageRisk: string
  baselineRisk: string
  labsDrawnCount: number
}

