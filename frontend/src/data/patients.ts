import type {
  Severity,
  Patient,
  PatientAnalytics,
  HourlyPoint,
  ExtendedSeries,
} from "../types"
import { SEVERITY_ORDER } from "../types"

export { SEVERITY_ORDER }

export const patients: Patient[] = [
  {
    id: "P-00031",
    age: 67,
    sex: "M",
    icuHour: 12,
    verdict: "STABLE",
    dissentScore: 8,
    committeeStatus: "Consensus",
    primaryDriver: "HR 74, MAP 88, SpO₂ 98% — all parameters within normal range for 12 h",
    archetypal: "stable",
    agents: [
      {
        id: "vitals",
        name: "Vitals",
        icon: "vitals",
        verdict: "STABLE",
        narration: "HR 74 bpm, MAP 88 mmHg, SpO₂ 98%. All values within normal parameters for the past 6 hours.",
        weight: 0,
      },
      {
        id: "labs",
        name: "Labs",
        icon: "labs",
        verdict: "STABLE",
        narration: "Lactate 1.1 mmol/L, WBC 8.4 k/μL, creatinine stable at 1.0 mg/dL. No acute metabolic derangement.",
        weight: 0,
      },
      {
        id: "risk",
        name: "Demographic / Risk",
        icon: "risk",
        verdict: "STABLE",
        narration: "Age 67, no active comorbidity flags. APACHE II score 11 — below high-risk threshold.",
        weight: 0,
      },
      {
        id: "history",
        name: "Historical Pattern",
        icon: "history",
        verdict: "STABLE",
        narration: "Trajectory over the past 12 hours is uniformly improving. No prior deterioration episodes flagged.",
        weight: 0,
      },
    ],
    judgeSynthesis:
      "All four specialist agents return STABLE verdicts with high concordance (dissent score 8/100). Vitals, labs, and trajectory indicators are uniformly reassuring. No immediate escalation is indicated. Continue monitoring at standard interval.",
  },
  {
    id: "P-00047",
    age: 54,
    sex: "F",
    icuHour: 7,
    verdict: "WATCH",
    dissentScore: 22,
    committeeStatus: "Majority",
    primaryDriver: "Rising lactate 1.4 → 1.8 mmol/L over 4 h; WBC mildly elevated at 11.2 k/μL",
    agents: [
      {
        id: "vitals",
        name: "Vitals",
        icon: "vitals",
        verdict: "STABLE",
        narration: "HR 82 bpm, MAP 78 mmHg, SpO₂ 97%. Mild tachycardia borderline, otherwise unremarkable.",
        weight: 0,
      },
      {
        id: "labs",
        name: "Labs",
        icon: "labs",
        verdict: "WATCH",
        narration: "Lactate trending upward: 1.4 → 1.8 mmol/L over 4 hours. WBC mildly elevated at 11.2 k/μL.",
        weight: 1,
      },
      {
        id: "risk",
        name: "Demographic / Risk",
        icon: "risk",
        verdict: "WATCH",
        narration: "Age 54, hypertension and type 2 diabetes noted. Elevated baseline risk for sepsis cascade.",
        weight: 1,
      },
      {
        id: "history",
        name: "Historical Pattern",
        icon: "history",
        verdict: "STABLE",
        narration: "No prior deterioration pattern. Trajectory mildly mixed but not yet concerning at the population level.",
        weight: 0,
      },
    ],
    judgeSynthesis:
      "Mild disagreement between agents (dissent score 22/100). Labs and Risk both flag WATCH while Vitals and Historical remain STABLE. The rising lactate trend warrants heightened surveillance. Reassess in 2 hours.",
  },
  {
    id: "P-00062",
    age: 71,
    sex: "F",
    icuHour: 18,
    verdict: "DETERIORATING",
    dissentScore: 64,
    committeeStatus: "Contested",
    primaryDriver: "Sustained hypotension MAP 58 + tachycardia HR 118 + fever 39.1°C × 90 min",
    archetypal: "contested",
    agents: [
      {
        id: "vitals",
        name: "Vitals",
        icon: "vitals",
        verdict: "CRITICAL",
        narration: "HR 118 bpm, MAP 58 mmHg sustained for 90 min. Fever 39.1°C. Physiologic profile consistent with septic shock.",
        weight: 3,
      },
      {
        id: "labs",
        name: "Labs",
        icon: "labs",
        verdict: "DETERIORATING",
        narration: "Lactate 3.8 mmol/L, rising from 2.1 over 6 hours. Creatinine 2.4 mg/dL — acute kidney injury stage 2.",
        weight: 2,
      },
      {
        id: "risk",
        name: "Demographic / Risk",
        icon: "risk",
        verdict: "WATCH",
        narration: "Age 71, mild immunocompromise but no active malignancy. APACHE II 17. Risk profile moderately elevated.",
        weight: 1,
      },
      {
        id: "history",
        name: "Historical Pattern",
        icon: "history",
        verdict: "STABLE",
        narration: "Prior ICU encounter 14 months ago resolved without complication. This deterioration pattern is atypical relative to historical baseline.",
        weight: 0,
      },
    ],
    judgeSynthesis:
      "High disagreement between agents (dissent score 64/100) signals clinical ambiguity requiring attention. Vitals returns CRITICAL while Historical returns STABLE, a four-severity span. The physiologic data (tachycardia, hypotension, fever) is compelling, but the Historical agent notes this is an atypical pattern. The synthesis favors the real-time physiologic evidence: DETERIORATING verdict is appropriate, with CRITICAL escalation contingent on MAP response to initial resuscitation over the next 30 minutes.",
  },
  {
    id: "P-00089",
    age: 83,
    sex: "M",
    icuHour: 31,
    verdict: "CRITICAL",
    dissentScore: 19,
    committeeStatus: "Consensus",
    primaryDriver: "Vasopressor-refractory hypotension MAP 48, lactate 7.2 mmol/L, SpO₂ 88% on 6L O₂",
    archetypal: "critical",
    agents: [
      {
        id: "vitals",
        name: "Vitals",
        icon: "vitals",
        verdict: "CRITICAL",
        narration: "HR 134 bpm, MAP 48 mmHg despite 2L crystalloid, SpO₂ 88% on 6L O₂. Respiratory rate 32/min.",
        weight: 3,
      },
      {
        id: "labs",
        name: "Labs",
        icon: "labs",
        verdict: "CRITICAL",
        narration: "Lactate 7.2 mmol/L, metabolic acidosis pH 7.21, troponin elevated at 1.8 ng/mL suggesting demand ischemia.",
        weight: 3,
      },
      {
        id: "risk",
        name: "Demographic / Risk",
        icon: "risk",
        verdict: "CRITICAL",
        narration: "Age 83, CHF (EF 30%), COPD, CKD stage 3. Frailty index 0.42. Highest risk decile for in-hospital mortality.",
        weight: 3,
      },
      {
        id: "history",
        name: "Historical Pattern",
        icon: "history",
        verdict: "DETERIORATING",
        narration: "Two prior rapid deterioration episodes, both reversed with aggressive intervention. Pattern consistent with current presentation.",
        weight: 2,
      },
    ],
    judgeSynthesis:
      "Near-consensus across specialist agents (dissent score 19/100). Three agents return CRITICAL; the Historical Pattern agent returns DETERIORATING, noting prior successful reversals. The combined physiologic and metabolic picture is severe: vasopressor-refractory hypotension, lactic acidosis, and demand ischemia on a high-frailty substrate. Immediate intensivist review and goals-of-care alignment are indicated.",
  },
  {
    id: "P-00104",
    age: 45,
    sex: "F",
    icuHour: 4,
    verdict: "STABLE",
    dissentScore: 5,
    committeeStatus: "Consensus",
    primaryDriver: "Post-operative day 1; Hgb 9.8 g/dL expected, hemodynamics stable, lactate 0.9",
    agents: [
      {
        id: "vitals",
        name: "Vitals",
        icon: "vitals",
        verdict: "STABLE",
        narration: "HR 68 bpm, MAP 91 mmHg, SpO₂ 99%. Hemodynamics stable post-operatively.",
        weight: 0,
      },
      {
        id: "labs",
        name: "Labs",
        icon: "labs",
        verdict: "STABLE",
        narration: "Hgb 9.8 g/dL (expected post-op), electrolytes balanced, lactate 0.9 mmol/L.",
        weight: 0,
      },
      {
        id: "risk",
        name: "Demographic / Risk",
        icon: "risk",
        verdict: "STABLE",
        narration: "Age 45, no significant comorbidities. Elective surgery context. APACHE II 6.",
        weight: 0,
      },
      {
        id: "history",
        name: "Historical Pattern",
        icon: "history",
        verdict: "STABLE",
        narration: "No prior ICU admissions. This is a planned post-operative stay with expected trajectory.",
        weight: 0,
      },
    ],
    judgeSynthesis:
      "Full committee consensus at STABLE (dissent score 5/100). Post-operative physiologic values are within expected range for this patient profile. No interventional indicators are present.",
  },
  {
    id: "P-00118",
    age: 58,
    sex: "M",
    icuHour: 22,
    verdict: "WATCH",
    dissentScore: 31,
    committeeStatus: "Majority",
    primaryDriver: "SpO₂ 94% on 3L NC, PaO₂/FiO₂ ratio 210 — mild ARDS threshold met; CRP 148 mg/L",
    agents: [
      {
        id: "vitals",
        name: "Vitals",
        icon: "vitals",
        verdict: "WATCH",
        narration: "RR 22/min, SpO₂ 94% on 3L nasal cannula. HR 91, MAP 82. Mild respiratory distress.",
        weight: 1,
      },
      {
        id: "labs",
        name: "Labs",
        icon: "labs",
        verdict: "DETERIORATING",
        narration: "PaO₂/FiO₂ ratio 210 — mild ARDS criteria met. CRP 148 mg/L, procalcitonin 4.2 ng/mL.",
        weight: 2,
      },
      {
        id: "risk",
        name: "Demographic / Risk",
        icon: "risk",
        verdict: "WATCH",
        narration: "Age 58, obesity BMI 34, former smoker. Elevated risk for respiratory failure progression.",
        weight: 1,
      },
      {
        id: "history",
        name: "Historical Pattern",
        icon: "history",
        verdict: "WATCH",
        narration: "Slow, linear decline in oxygenation over 8 hours. Pattern does not match rapid deterioration archetype.",
        weight: 1,
      },
    ],
    judgeSynthesis:
      "Moderate disagreement (dissent score 31/100). Labs flags DETERIORATING on ARDS criteria while the other three agents sit at WATCH. The inflammatory markers are concerning. Pulmonary consultation and consideration of escalating oxygen delivery to high-flow nasal cannula are warranted.",
  },
  {
    id: "P-00133",
    age: 76,
    sex: "F",
    icuHour: 9,
    verdict: "DETERIORATING",
    dissentScore: 42,
    committeeStatus: "Split",
    primaryDriver: "MAP dropped 78 → 61 over 2 h; lactate 5.1 mmol/L (confounded by hepatic cirrhosis)",
    agents: [
      {
        id: "vitals",
        name: "Vitals",
        icon: "vitals",
        verdict: "DETERIORATING",
        narration: "MAP dropped from 78 to 61 over 2 hours. HR 106 bpm. Temperature 38.7°C — early sepsis physiology.",
        weight: 2,
      },
      {
        id: "labs",
        name: "Labs",
        icon: "labs",
        verdict: "CRITICAL",
        narration: "Lactate 5.1 mmol/L (up from 2.2), creatinine doubling from baseline. Coagulation: PT 18.2s.",
        weight: 3,
      },
      {
        id: "risk",
        name: "Demographic / Risk",
        icon: "risk",
        verdict: "DETERIORATING",
        narration: "Age 76, hepatic cirrhosis Child-Pugh B. Impaired lactate clearance confounds severity interpretation.",
        weight: 2,
      },
      {
        id: "history",
        name: "Historical Pattern",
        icon: "history",
        verdict: "WATCH",
        narration: "Prior lactate elevations in this patient have been hepatic in origin rather than septic. Historical context urges caution in over-interpreting current lactate.",
        weight: 1,
      },
    ],
    judgeSynthesis:
      "Meaningful disagreement (dissent score 42/100). Labs returns CRITICAL on the rising lactate, but the Risk and Historical agents appropriately note that this patient's cirrhosis impairs lactate clearance, making it a less reliable shock marker here. The committee's disagreement reflects genuine clinical ambiguity. Verdict is DETERIORATING with a recommendation to weight MAP trend and urine output over lactate kinetics specifically in this patient.",
  },
]

export function generateTimeline(patientId: string, icuHour: number) {
  const profiles: Record<string, { hr: number[]; map: number[]; lactate: number[]; regions: Array<{ start: number; end: number; verdict: Severity }> }> = {
    "P-00062": {
      hr: [78, 80, 82, 85, 88, 92, 98, 104, 110, 114, 116, 118, 118, 116, 115, 118, 118],
      map: [88, 86, 84, 82, 79, 76, 72, 68, 64, 61, 60, 58, 57, 58, 59, 58, 58],
      lactate: [1.1, 1.2, 1.4, 1.6, 1.8, 2.0, 2.3, 2.7, 3.1, 3.4, 3.6, 3.8, 3.8, 3.9, 3.8, 3.8, 3.8],
      regions: [
        { start: 0, end: 6, verdict: "STABLE" },
        { start: 6, end: 11, verdict: "WATCH" },
        { start: 11, end: 18, verdict: "DETERIORATING" },
      ],
    },
    "P-00089": {
      hr: [95, 100, 106, 112, 118, 122, 126, 130, 132, 133, 134, 134, 134, 134, 134, 134, 134, 134, 134, 134, 134, 134, 134, 134, 134, 134, 134, 134, 134, 134, 134],
      map: [72, 70, 67, 63, 59, 56, 53, 51, 50, 49, 48, 48, 48, 47, 47, 48, 48, 47, 47, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48],
      lactate: [2.1, 2.5, 3.1, 3.8, 4.4, 5.0, 5.5, 6.0, 6.4, 6.7, 7.0, 7.1, 7.2, 7.2, 7.2, 7.2, 7.2, 7.2, 7.2, 7.2, 7.2, 7.2, 7.2, 7.2, 7.2, 7.2, 7.2, 7.2, 7.2, 7.2, 7.2],
      regions: [
        { start: 0, end: 4, verdict: "WATCH" },
        { start: 4, end: 10, verdict: "DETERIORATING" },
        { start: 10, end: 31, verdict: "CRITICAL" },
      ],
    },
  }

  const profile = profiles[patientId] || {
    hr: Array.from({ length: icuHour + 1 }, (_, i) => 72 + Math.round(Math.sin(i * 0.4) * 5)),
    map: Array.from({ length: icuHour + 1 }, (_, i) => 85 + Math.round(Math.cos(i * 0.3) * 4)),
    lactate: Array.from({ length: icuHour + 1 }, () => 1.0 + Math.random() * 0.4),
    regions: [{ start: 0, end: icuHour, verdict: "STABLE" as Severity }],
  }

  return Array.from({ length: Math.min(icuHour + 1, profile.hr.length) }, (_, i) => ({
    hour: i,
    hr: profile.hr[i] ?? 72,
    map: profile.map[i] ?? 85,
    lactate: parseFloat((profile.lactate[i] ?? 1.0).toFixed(1)),
    regions: profile.regions,
  }))
}

export const extendedProfiles: Record<string, ExtendedSeries> = {
  "P-00062": {
    sbp:   [118,116,114,112,108,104,100,96,92,90,89,88,88,88,87,88,88,88],
    dbp:   [76,74,72,70,68,65,62,60,58,56,55,54,54,55,55,54,54,54],
    resp:  [16,17,17,18,18,19,20,21,22,22,23,24,25,25,26,26,26,26],
    temp:  [37.1,37.2,37.3,37.4,37.5,37.7,37.9,38.1,38.3,38.5,38.7,38.9,39.0,39.1,39.1,39.1,39.1,39.1],
    o2sat: [98,98,98,97,97,97,96,96,95,95,95,94,94,94,94,94,94,94],
    etco2: [35,35,34,34,34,33,33,33,32,32,32,32,32,31,31,31,31,31],
  },
  "P-00089": {
    sbp:   [92,90,88,84,80,76,72,70,68,66,64,62,62,62,62,62,62,62,62,62,62,62,62,62,62,62,62,62,62,62,62],
    dbp:   [58,56,54,50,46,42,40,38,36,35,35,34,34,34,34,34,34,34,34,34,34,34,34,34,34,34,34,34,34,34,34],
    resp:  [22,24,26,28,28,29,30,30,31,31,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32,32],
    temp:  [38.2,38.3,38.4,38.5,38.5,38.6,38.6,38.7,38.7,38.7,38.7,38.7,38.7,38.7,38.7,38.7,38.7,38.7,38.7,38.7,38.7,38.7,38.7,38.7,38.7,38.7,38.7,38.7,38.7,38.7,38.8],
    o2sat: [93,92,91,90,90,89,89,88,88,88,88,88,88,88,88,88,88,88,88,88,88,88,88,88,88,88,88,88,88,88,88],
    etco2: [30,29,29,28,28,28,27,27,27,27,27,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26],
  },
}

const SEV_NUM: Record<Severity, number> = { STABLE: 0, WATCH: 1, DETERIORATING: 2, CRITICAL: 3 }
const SEV_LABEL: Severity[] = ["STABLE", "WATCH", "DETERIORATING", "CRITICAL"]

function buildHourlyHistory(
  regions: Array<{ start: number; end: number; verdict: Severity }>,
  icuHour: number,
  dissentBase: number,
  dissentPeak: number
): HourlyPoint[] {
  return Array.from({ length: icuHour + 1 }, (_, h) => {
    const region = regions.find((r) => h >= r.start && h <= r.end) ?? regions[regions.length - 1]
    const sev = SEV_NUM[region.verdict]
    const progress = icuHour > 0 ? h / icuHour : 0
    const dissent = Math.round(dissentBase + (dissentPeak - dissentBase) * Math.pow(progress, 1.5) + Math.sin(h * 0.8) * 3)
    return { hour: h, severity: sev, severityLabel: region.verdict, dissent: Math.max(0, Math.min(100, dissent)) }
  })
}

const analyticsMap: Record<string, PatientAnalytics> = {
  "P-00062": {
    signalFlags: [
      { signal: "HR", category: "vitals", status: "abnormal", flag: "tachycardia", value: "118 bpm" },
      { signal: "MAP", category: "vitals", status: "abnormal", flag: "hypotension", value: "58 mmHg" },
      { signal: "SBP", category: "vitals", status: "abnormal", flag: "low", value: "88 mmHg" },
      { signal: "Resp", category: "vitals", status: "abnormal", flag: "elevated", value: "26/min" },
      { signal: "Temp", category: "vitals", status: "abnormal", flag: "fever", value: "39.1°C" },
      { signal: "O2Sat", category: "vitals", status: "normal", value: "94%" },
      { signal: "Lactate", category: "labs", status: "abnormal", flag: "critical", value: "3.8 mmol/L" },
      { signal: "WBC", category: "labs", status: "normal", value: "10.8 k/μL" },
      { signal: "Creatinine", category: "labs", status: "abnormal", flag: "AKI stage 2", value: "2.4 mg/dL" },
      { signal: "Platelets", category: "labs", status: "normal", value: "182 k/μL" },
      { signal: "BUN", category: "labs", status: "abnormal", flag: "elevated", value: "28 mg/dL" },
    ],
    labDraws: {
      Lactate:    [1,4,8,12,15,18].map((h) => ({ hour: h, status: h < 4 ? "normal" : "abnormal" })),
      WBC:        [2,8,14].map((h) => ({ hour: h, status: "normal" })),
      Creatinine: [2,8,14].map((h) => ({ hour: h, status: h >= 8 ? "abnormal" : "normal" })),
      Platelets:  [2,10].map((h) => ({ hour: h, status: "normal" })),
      BUN:        [2,10,16].map((h) => ({ hour: h, status: h >= 10 ? "abnormal" : "normal" })),
    },
    trends: [
      { signal: "HR", direction: "up", interpretation: "worsening" },
      { signal: "MAP", direction: "down", interpretation: "worsening" },
      { signal: "Lactate", direction: "up", interpretation: "worsening" },
      { signal: "Resp", direction: "up", interpretation: "worsening" },
      { signal: "Temp", direction: "up", interpretation: "worsening" },
      { signal: "WBC", direction: "flat", interpretation: "stable" },
    ],
    overallTrend: "WORSENING",
    hourlyHistory: buildHourlyHistory(
      [{ start: 0, end: 5, verdict: "STABLE" }, { start: 6, end: 10, verdict: "WATCH" }, { start: 11, end: 18, verdict: "DETERIORATING" }],
      18, 6, 64
    ),
    ageRisk: "Elevated (71y)", baselineRisk: "Moderate-High", labsDrawnCount: 10,
  },
  "P-00089": {
    signalFlags: [
      { signal: "HR", category: "vitals", status: "abnormal", flag: "critical tachycardia", value: "134 bpm" },
      { signal: "MAP", category: "vitals", status: "abnormal", flag: "shock-range", value: "48 mmHg" },
      { signal: "SBP", category: "vitals", status: "abnormal", flag: "critical", value: "78 mmHg" },
      { signal: "Resp", category: "vitals", status: "abnormal", flag: "critical", value: "32/min" },
      { signal: "Temp", category: "vitals", status: "abnormal", flag: "fever", value: "38.7°C" },
      { signal: "O2Sat", category: "vitals", status: "abnormal", flag: "critical", value: "88%" },
      { signal: "Lactate", category: "labs", status: "abnormal", flag: "severe", value: "7.2 mmol/L" },
      { signal: "WBC", category: "labs", status: "abnormal", flag: "elevated", value: "14.2 k/μL" },
      { signal: "Creatinine", category: "labs", status: "abnormal", flag: "AKI", value: "2.8 mg/dL" },
      { signal: "Platelets", category: "labs", status: "abnormal", flag: "low", value: "88 k/μL" },
      { signal: "BUN", category: "labs", status: "abnormal", flag: "elevated", value: "42 mg/dL" },
    ],
    labDraws: {
      Lactate:    [1,3,6,9,12,15,18,21,24,27,30].map((h) => ({ hour: h, status: h < 2 ? "normal" : "abnormal" })),
      WBC:        [2,8,14,20,26].map((h) => ({ hour: h, status: "abnormal" })),
      Creatinine: [2,8,14,20,26].map((h) => ({ hour: h, status: "abnormal" })),
      Platelets:  [4,12,20,28].map((h) => ({ hour: h, status: h >= 12 ? "abnormal" : "normal" })),
      BUN:        [4,12,20,28].map((h) => ({ hour: h, status: "abnormal" })),
    },
    trends: [
      { signal: "HR", direction: "up", interpretation: "worsening" },
      { signal: "MAP", direction: "down", interpretation: "worsening" },
      { signal: "Lactate", direction: "up", interpretation: "worsening" },
      { signal: "Resp", direction: "up", interpretation: "worsening" },
      { signal: "O2Sat", direction: "down", interpretation: "worsening" },
      { signal: "Platelets", direction: "down", interpretation: "worsening" },
    ],
    overallTrend: "WORSENING",
    hourlyHistory: buildHourlyHistory(
      [{ start: 0, end: 3, verdict: "WATCH" }, { start: 4, end: 9, verdict: "DETERIORATING" }, { start: 10, end: 31, verdict: "CRITICAL" }],
      31, 8, 19
    ),
    ageRisk: "High (83y)", baselineRisk: "Very High", labsDrawnCount: 22,
  },
  "P-00047": {
    signalFlags: [
      { signal: "HR", category: "vitals", status: "normal", value: "82 bpm" },
      { signal: "MAP", category: "vitals", status: "normal", value: "78 mmHg" },
      { signal: "SBP", category: "vitals", status: "normal", value: "112 mmHg" },
      { signal: "Resp", category: "vitals", status: "normal", value: "18/min" },
      { signal: "Temp", category: "vitals", status: "normal", value: "37.6°C" },
      { signal: "O2Sat", category: "vitals", status: "normal", value: "97%" },
      { signal: "Lactate", category: "labs", status: "abnormal", flag: "rising", value: "1.8 mmol/L" },
      { signal: "WBC", category: "labs", status: "abnormal", flag: "mild elevation", value: "11.2 k/μL" },
      { signal: "Creatinine", category: "labs", status: "normal", value: "1.1 mg/dL" },
      { signal: "Platelets", category: "labs", status: "normal", value: "210 k/μL" },
      { signal: "BUN", category: "labs", status: "normal", value: "14 mg/dL" },
    ],
    labDraws: {
      Lactate:    [1,4,7].map((h) => ({ hour: h, status: h >= 4 ? "abnormal" : "normal" })),
      WBC:        [2,6].map((h) => ({ hour: h, status: h >= 6 ? "abnormal" : "normal" })),
      Creatinine: [2].map((h) => ({ hour: h, status: "normal" })),
      Platelets:  [2].map((h) => ({ hour: h, status: "normal" })),
      BUN:        [2].map((h) => ({ hour: h, status: "normal" })),
    },
    trends: [
      { signal: "Lactate", direction: "up", interpretation: "worsening" },
      { signal: "WBC", direction: "up", interpretation: "worsening" },
      { signal: "HR", direction: "flat", interpretation: "stable" },
      { signal: "MAP", direction: "flat", interpretation: "stable" },
    ],
    overallTrend: "MIXED",
    hourlyHistory: buildHourlyHistory([{ start: 0, end: 4, verdict: "STABLE" }, { start: 5, end: 7, verdict: "WATCH" }], 7, 5, 22),
    ageRisk: "Moderate (54y)", baselineRisk: "Moderate", labsDrawnCount: 5,
  },
  "P-00133": {
    signalFlags: [
      { signal: "HR", category: "vitals", status: "abnormal", flag: "tachycardia", value: "106 bpm" },
      { signal: "MAP", category: "vitals", status: "abnormal", flag: "hypotension", value: "61 mmHg" },
      { signal: "SBP", category: "vitals", status: "abnormal", flag: "low", value: "96 mmHg" },
      { signal: "Resp", category: "vitals", status: "normal", value: "20/min" },
      { signal: "Temp", category: "vitals", status: "abnormal", flag: "fever", value: "38.7°C" },
      { signal: "O2Sat", category: "vitals", status: "normal", value: "96%" },
      { signal: "Lactate", category: "labs", status: "abnormal", flag: "elevated (hepatic)", value: "5.1 mmol/L" },
      { signal: "WBC", category: "labs", status: "normal", value: "9.8 k/μL" },
      { signal: "Creatinine", category: "labs", status: "abnormal", flag: "rising", value: "1.8 mg/dL" },
      { signal: "Platelets", category: "labs", status: "abnormal", flag: "low (cirrhosis)", value: "94 k/μL" },
      { signal: "BUN", category: "labs", status: "abnormal", flag: "elevated", value: "32 mg/dL" },
    ],
    labDraws: {
      Lactate:    [1,4,7,9].map((h) => ({ hour: h, status: h >= 4 ? "abnormal" : "normal" })),
      WBC:        [2,6].map((h) => ({ hour: h, status: "normal" })),
      Creatinine: [2,8].map((h) => ({ hour: h, status: h >= 8 ? "abnormal" : "normal" })),
      Platelets:  [2,8].map((h) => ({ hour: h, status: h >= 8 ? "abnormal" : "normal" })),
      BUN:        [3,8].map((h) => ({ hour: h, status: h >= 8 ? "abnormal" : "normal" })),
    },
    trends: [
      { signal: "MAP", direction: "down", interpretation: "worsening" },
      { signal: "Lactate", direction: "up", interpretation: "worsening" },
      { signal: "HR", direction: "up", interpretation: "worsening" },
      { signal: "Creatinine", direction: "up", interpretation: "worsening" },
    ],
    overallTrend: "WORSENING",
    hourlyHistory: buildHourlyHistory([{ start: 0, end: 4, verdict: "STABLE" }, { start: 5, end: 7, verdict: "WATCH" }, { start: 8, end: 9, verdict: "DETERIORATING" }], 9, 10, 42),
    ageRisk: "High (76y)", baselineRisk: "High (cirrhosis)", labsDrawnCount: 6,
  },
}

export function getAnalytics(patient: Patient): PatientAnalytics {
  if (analyticsMap[patient.id]) return analyticsMap[patient.id]
  // Generic fallback for STABLE patients
  const isStable = patient.verdict === "STABLE"
  return {
    signalFlags: [
      { signal: "HR", category: "vitals", status: isStable ? "normal" : "abnormal", flag: isStable ? undefined : "elevated", value: isStable ? "72 bpm" : "94 bpm" },
      { signal: "MAP", category: "vitals", status: "normal", value: "86 mmHg" },
      { signal: "SBP", category: "vitals", status: "normal", value: "118 mmHg" },
      { signal: "Resp", category: "vitals", status: "normal", value: "16/min" },
      { signal: "Temp", category: "vitals", status: "normal", value: "37.2°C" },
      { signal: "O2Sat", category: "vitals", status: "normal", value: "98%" },
      { signal: "Lactate", category: "labs", status: "normal", value: "1.0 mmol/L" },
      { signal: "WBC", category: "labs", status: "normal", value: "8.2 k/μL" },
      { signal: "Creatinine", category: "labs", status: "normal", value: "1.0 mg/dL" },
      { signal: "Platelets", category: "labs", status: "normal", value: "220 k/μL" },
      { signal: "BUN", category: "labs", status: "normal", value: "12 mg/dL" },
    ],
    labDraws: {
      Lactate:    [1, Math.min(4, patient.icuHour)].filter((h) => h <= patient.icuHour).map((h) => ({ hour: h, status: "normal" as const })),
      WBC:        [2].filter((h) => h <= patient.icuHour).map((h) => ({ hour: h, status: "normal" as const })),
      Creatinine: [2].filter((h) => h <= patient.icuHour).map((h) => ({ hour: h, status: "normal" as const })),
      Platelets:  [2].filter((h) => h <= patient.icuHour).map((h) => ({ hour: h, status: "normal" as const })),
      BUN:        [2].filter((h) => h <= patient.icuHour).map((h) => ({ hour: h, status: "normal" as const })),
    },
    trends: [{ signal: "HR", direction: "flat", interpretation: "stable" }, { signal: "MAP", direction: "flat", interpretation: "stable" }],
    overallTrend: "STABLE",
    hourlyHistory: buildHourlyHistory([{ start: 0, end: patient.icuHour, verdict: patient.verdict }], patient.icuHour, patient.dissentScore - 5, patient.dissentScore),
    ageRisk: patient.age >= 75 ? `High (${patient.age}y)` : patient.age >= 60 ? `Elevated (${patient.age}y)` : `Standard (${patient.age}y)`,
    baselineRisk: patient.verdict === "STABLE" ? "Low" : patient.verdict === "WATCH" ? "Moderate" : "High",
    labsDrawnCount: Math.min(patient.icuHour, 5),
  }
}
