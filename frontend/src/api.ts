import type { Agent, FlagStatus, Patient, PatientAnalytics, Severity, TrendDir, TrendInterp } from "./types"
import { SEVERITY_ORDER } from "./types"

export const DATA_SERVICE = "http://localhost:8000"
export const ORCHESTRATOR = "http://localhost:8002"

export interface PatientSummary {
  patient_id: string
  age: number
  sex: string
  icu_hour: number
  verdict: Severity
  dissent_score: number
  committee_status: Patient["committeeStatus"]
  primary_driver: string
  vitals_verdict: Severity
  labs_verdict: Severity
  historical_trajectory: string
  baseline_risk: string
}

export interface HourlyVitals {
  icu_hour: number
  hr: number | null
  o2sat: number | null
  temp: number | null
  sbp: number | null
  map: number | null
  dbp: number | null
  resp: number | null
  etco2: number | null
  flags: Record<string, string>
}

export interface HourlyLabs {
  icu_hour: number
  lactate: number | null
  wbc: number | null
  creatinine: number | null
  platelets: number | null
  bun: number | null
  flags: Record<string, string>
  [key: string]: unknown
}

export interface PatientSnapshot extends PatientSummary {
  vitals_window: HourlyVitals[]
  labs_window: HourlyLabs[]
  trajectory: Array<{ icu_hour: number; hr: number | null; resp: number | null; lactate: number | null; wbc: number | null }>
  trend_analysis: {
    hr_trend: string
    resp_trend: string
    lactate_trend: string
    wbc_trend: string
    hours_in_encounter: number
    overall_trajectory: string
  }
  risk_assessment: { age_risk_category: string; baseline_risk_level: string }
}

export interface CommitteeResponse {
  patient_id: string
  committee_verdict: Severity
  dissent_score: number
  synthesis: string
  cached?: boolean
  agent_results: {
    vitals: { verdict: Severity; narration: string }
    labs: { verdict: Severity; narration: string }
    risk: { baseline_risk: string; narration: string }
    historical: { overall_trajectory: string; narration: string }
  }
}

export type ChartPoint = Record<string, number> & { hour: number }

const TRAJ_TO_SEVERITY: Record<string, Severity> = {
  STABLE: "STABLE",
  IMPROVING: "STABLE",
  MIXED: "WATCH",
  WORSENING: "DETERIORATING",
}

const RISK_TO_SEVERITY: Record<string, Severity> = {
  LOW: "STABLE",
  MODERATE: "WATCH",
  ELEVATED: "DETERIORATING",
  HIGH: "CRITICAL",
}

function flagStatus(status: string): FlagStatus {
  if (status === "normal") return "normal"
  if (status === "unknown" || status === "not_drawn") return "unknown"
  return "abnormal"
}

function trendDir(trend: string): TrendDir {
  if (trend === "worsening") return "up"
  if (trend === "improving") return "down"
  return "flat"
}

function trendInterp(trend: string): TrendInterp {
  if (trend === "worsening") return "worsening"
  if (trend === "improving") return "improving"
  return "stable"
}

function agent(
  id: Agent["id"],
  name: string,
  icon: Agent["icon"],
  verdict: Severity,
  narration = "",
): Agent {
  return { id, name, icon, verdict, narration, weight: SEVERITY_ORDER[verdict] }
}

export function summaryToPatient(s: PatientSummary): Patient {
  return {
    id: s.patient_id,
    age: Math.round(s.age),
    sex: s.sex,
    icuHour: s.icu_hour,
    verdict: s.verdict,
    dissentScore: s.dissent_score,
    committeeStatus: s.committee_status,
    primaryDriver: s.primary_driver,
    agents: [
      agent("vitals", "Vitals", "vitals", s.vitals_verdict),
      agent("labs", "Labs", "labs", s.labs_verdict),
      agent("risk", "Demographic / Risk", "risk", RISK_TO_SEVERITY[s.baseline_risk] ?? "WATCH"),
      agent("history", "Historical Pattern", "history", TRAJ_TO_SEVERITY[s.historical_trajectory] ?? "STABLE"),
    ],
    judgeSynthesis: "",
  }
}

export function snapshotToAnalytics(s: PatientSnapshot): PatientAnalytics {
  const lastV = s.vitals_window[s.vitals_window.length - 1]
  const drawnLabs = s.labs_window.filter((h) => h.flags && Object.values(h.flags).some((v) => v !== "not_drawn"))
  const lastL = drawnLabs[drawnLabs.length - 1]
  const vFlag = (key: string) => flagStatus(lastV?.flags?.[key] ?? "unknown")
  const lFlag = (key: string) => flagStatus(lastL?.flags?.[key] ?? "unknown")
  const vVal = (key: keyof HourlyVitals, unit: string) =>
    lastV?.[key] == null ? undefined : `${lastV[key]}${unit}`
  const lVal = (key: keyof HourlyLabs, unit: string) =>
    lastL?.[key] == null ? undefined : `${lastL[key]}${unit}`

  const sevNum = SEVERITY_ORDER[s.verdict]
  const hourlyHistory = s.trajectory.map((h) => ({
    hour: h.icu_hour,
    severity: sevNum,
    severityLabel: s.verdict,
    dissent: s.dissent_score,
  }))

  const labDraws: PatientAnalytics["labDraws"] = {}
  for (const name of ["Lactate", "WBC", "Creatinine", "Platelets", "BUN"] as const) {
    const key = name.toLowerCase() as "lactate" | "wbc" | "creatinine" | "platelets" | "bun"
    const flagKey = `${key}_status`
    labDraws[name] = s.labs_window
      .filter((h) => h.flags?.[flagKey] && h.flags[flagKey] !== "not_drawn")
      .map((h) => ({
        hour: h.icu_hour,
        status: flagStatus(h.flags[flagKey]) === "abnormal" ? "abnormal" as const : "normal" as const,
      }))
  }

  const t = s.trend_analysis
  return {
    signalFlags: [
      { signal: "HR", category: "vitals", status: vFlag("hr_status"), flag: lastV?.flags?.hr_status !== "normal" ? lastV?.flags?.hr_status : undefined, value: vVal("hr", " bpm") },
      { signal: "MAP", category: "vitals", status: vFlag("map_status"), flag: lastV?.flags?.map_status !== "normal" ? lastV?.flags?.map_status : undefined, value: vVal("map", " mmHg") },
      { signal: "SBP", category: "vitals", status: vFlag("sbp_status"), flag: lastV?.flags?.sbp_status !== "normal" ? lastV?.flags?.sbp_status : undefined, value: vVal("sbp", " mmHg") },
      { signal: "Resp", category: "vitals", status: vFlag("resp_status"), flag: lastV?.flags?.resp_status !== "normal" ? lastV?.flags?.resp_status : undefined, value: vVal("resp", "/min") },
      { signal: "Temp", category: "vitals", status: vFlag("temp_status"), flag: lastV?.flags?.temp_status !== "normal" ? lastV?.flags?.temp_status : undefined, value: vVal("temp", "°C") },
      { signal: "O2Sat", category: "vitals", status: lastV?.o2sat == null ? "unknown" : "normal", value: vVal("o2sat", "%") },
      { signal: "Lactate", category: "labs", status: lFlag("lactate_status"), flag: lastL?.flags?.lactate_status !== "normal" && lastL?.flags?.lactate_status !== "not_drawn" ? lastL?.flags?.lactate_status : undefined, value: lVal("lactate", " mmol/L") },
      { signal: "WBC", category: "labs", status: lFlag("wbc_status"), flag: lastL?.flags?.wbc_status !== "normal" && lastL?.flags?.wbc_status !== "not_drawn" ? lastL?.flags?.wbc_status : undefined, value: lVal("wbc", " k/μL") },
      { signal: "Creatinine", category: "labs", status: lFlag("creatinine_status"), flag: lastL?.flags?.creatinine_status !== "normal" && lastL?.flags?.creatinine_status !== "not_drawn" ? lastL?.flags?.creatinine_status : undefined, value: lVal("creatinine", " mg/dL") },
      { signal: "Platelets", category: "labs", status: lFlag("platelets_status"), flag: lastL?.flags?.platelets_status !== "normal" && lastL?.flags?.platelets_status !== "not_drawn" ? lastL?.flags?.platelets_status : undefined, value: lVal("platelets", " k/μL") },
      { signal: "BUN", category: "labs", status: lFlag("bun_status"), flag: lastL?.flags?.bun_status !== "normal" && lastL?.flags?.bun_status !== "not_drawn" ? lastL?.flags?.bun_status : undefined, value: lVal("bun", " mg/dL") },
    ],
    labDraws,
    trends: [
      { signal: "HR", direction: trendDir(t.hr_trend), interpretation: trendInterp(t.hr_trend) },
      { signal: "Resp", direction: trendDir(t.resp_trend), interpretation: trendInterp(t.resp_trend) },
      { signal: "Lactate", direction: trendDir(t.lactate_trend), interpretation: trendInterp(t.lactate_trend) },
      { signal: "WBC", direction: trendDir(t.wbc_trend), interpretation: trendInterp(t.wbc_trend) },
    ],
    overallTrend: (["WORSENING", "IMPROVING", "STABLE", "MIXED"].includes(t.overall_trajectory)
      ? t.overall_trajectory
      : "STABLE") as PatientAnalytics["overallTrend"],
    hourlyHistory,
    ageRisk: `${s.risk_assessment.age_risk_category} (${Math.round(s.age)}y)`,
    baselineRisk: s.baseline_risk,
    labsDrawnCount: drawnLabs.length,
  }
}

export function snapshotToChart(s: PatientSnapshot): ChartPoint[] {
  const lactateByHour = new Map(s.labs_window.map((h) => [h.icu_hour, h.lactate]))
  return s.vitals_window.map((h) => ({
    hour: h.icu_hour,
    hr: h.hr ?? 0,
    map: h.map ?? 0,
    sbp: h.sbp ?? 0,
    dbp: h.dbp ?? 0,
    resp: h.resp ?? 0,
    temp: h.temp ?? 0,
    o2sat: h.o2sat ?? 0,
    etco2: h.etco2 ?? 0,
    lactate: lactateByHour.get(h.icu_hour) ?? 0,
  }))
}

export function applyCommitteeNarration(patient: Patient, c: CommitteeResponse): Patient {
  const n = {
    vitals: c.agent_results.vitals.narration,
    labs: c.agent_results.labs.narration,
    risk: c.agent_results.risk.narration,
    history: c.agent_results.historical.narration,
  }
  return {
    ...patient,
    judgeSynthesis: c.synthesis,
    agents: patient.agents.map((a) => ({
      ...a,
      narration: n[a.id as keyof typeof n] ?? a.narration,
    })),
  }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status} ${text}`)
  }
  return res.json() as Promise<T>
}

export function fetchSummaries() {
  return getJson<PatientSummary[]>(`${DATA_SERVICE}/patients/summary`)
}

export function fetchSnapshot(patientId: string) {
  return getJson<PatientSnapshot>(`${DATA_SERVICE}/patients/${patientId}/snapshot`)
}

export function fetchCommittee(patientId: string, refresh = false) {
  const q = refresh ? "?refresh=true" : ""
  return getJson<CommitteeResponse>(`${ORCHESTRATOR}/patients/${patientId}/committee${q}`)
}
