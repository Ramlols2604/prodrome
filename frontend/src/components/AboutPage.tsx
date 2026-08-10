import type React from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { Agent, Severity } from "../types"
import { SEVERITY_ORDER } from "../types"
import { severityColor, severityDim, severityBorder, dissentColor } from "../lib/colors"
import ProdromeWordmark from "./ProdromeWordmark"
import SeverityBadge from "./SeverityBadge"
import AgentIcon from "./AgentIcon"

export default function AboutPage({ onBack }: { onBack: () => void }) { // v2 — spec update
  const mono = "var(--font-mono)"
  const ui = "var(--font-ui)"
  const border = "rgba(255,255,255,0.08)"
  const muted = "rgba(255,255,255,0.28)"
  const body = "rgba(232,237,242,0.72)"
  const heading = "#e8edf2"

  function Section({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return (
      <section style={{ borderTop: `1px solid ${border}`, paddingTop: "52px", paddingBottom: "8px", ...style }}>
        {children}
      </section>
    )
  }

  function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
      <div style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.22)", fontFamily: ui, marginBottom: "18px" }}>
        {children}
      </div>
    )
  }

  function H2({ children }: { children: React.ReactNode }) {
    return (
      <h2 style={{ fontSize: "21px", fontWeight: 700, color: heading, margin: "0 0 18px", letterSpacing: "-0.02em", fontFamily: ui, lineHeight: 1.3 }}>
        {children}
      </h2>
    )
  }

  function P({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return (
      <p style={{ fontSize: "14px", lineHeight: "1.8", color: body, margin: "0 0 14px", fontFamily: ui, ...style }}>
        {children}
      </p>
    )
  }

  function Mono({ children }: { children: React.ReactNode }) {
    return (
      <code style={{ fontFamily: mono, fontSize: "12px", backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "4px", padding: "1px 6px", color: "#a8c4d8" }}>
        {children}
      </code>
    )
  }

  function Stat({ value, label, note }: { value: string; label: string; note?: string }) {
    return (
      <div style={{ backgroundColor: "#161e2a", border: `1px solid ${border}`, borderRadius: "10px", padding: "18px 20px" }}>
        <div style={{ fontFamily: mono, fontSize: "24px", fontWeight: 600, color: heading, lineHeight: 1, marginBottom: "5px" }}>{value}</div>
        <div style={{ fontSize: "12px", fontWeight: 500, color: muted, marginBottom: note ? "3px" : 0 }}>{label}</div>
        {note && <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.18)", lineHeight: 1.4 }}>{note}</div>}
      </div>
    )
  }

  // Solid-border card: validated findings
  function FindingCard({ title, children, caveat }: { title: string; children: React.ReactNode; caveat?: string }) {
    return (
      <div style={{ backgroundColor: "#161e2a", border: `1px solid ${border}`, borderRadius: "10px", padding: "18px 20px", display: "flex", flexDirection: "column" as const, gap: "10px" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: heading, fontFamily: ui }}>{title}</div>
        <div style={{ fontSize: "13px", lineHeight: "1.75", color: body, fontFamily: ui }}>{children}</div>
        {caveat && (
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "10px", fontSize: "11.5px", lineHeight: "1.6", color: "rgba(255,255,255,0.3)", fontFamily: ui }}>
            {caveat}
          </div>
        )}
      </div>
    )
  }

  // Same card structure, same visual weight — matched pair with FindingCard
  function LimitationCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div style={{ backgroundColor: "#161e2a", border: `1px solid ${border}`, borderRadius: "10px", padding: "18px 20px", display: "flex", flexDirection: "column" as const, gap: "10px" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: heading, fontFamily: ui }}>{title}</div>
        <div style={{ fontSize: "13px", lineHeight: "1.75", color: body, fontFamily: ui }}>{children}</div>
      </div>
    )
  }

  // Dashed-border card: future roadmap (not built)
  function RoadmapCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div style={{ backgroundColor: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.14)", borderRadius: "10px", padding: "18px 20px", display: "flex", flexDirection: "column" as const, gap: "8px" }}>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "rgba(232,237,242,0.55)", fontFamily: ui }}>{title}</div>
        <div style={{ fontSize: "13px", lineHeight: "1.75", color: "rgba(232,237,242,0.4)", fontFamily: ui }}>{children}</div>
      </div>
    )
  }

  // Horizontal architecture diagram — solid = Python, dashed = LLM-involved
  function ArchDiagram() {
    const solidBox = (content: React.ReactNode): React.CSSProperties => ({
      backgroundColor: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.18)",
      borderRadius: "8px",
      padding: "10px 14px",
      textAlign: "center" as const,
    })
    const dashedBox: React.CSSProperties = {
      backgroundColor: "rgba(6,182,212,0.04)",
      border: "1px dashed rgba(6,182,212,0.35)",
      borderRadius: "8px",
      padding: "10px 14px",
      textAlign: "center" as const,
    }
    const hArrow = (
      <div style={{ display: "flex", alignItems: "center", flexShrink: 0, padding: "0 6px" }}>
        <svg width="24" height="10" viewBox="0 0 24 10" fill="none">
          <line x1="0" y1="5" x2="18" y2="5" stroke="rgba(255,255,255,0.2)" strokeWidth="1.4"/>
          <polyline points="13,1 19,5 13,9" stroke="rgba(255,255,255,0.2)" strokeWidth="1.4" fill="none" strokeLinejoin="round"/>
        </svg>
      </div>
    )
    const downArrowSm = (
      <div style={{ display: "flex", justifyContent: "center", padding: "3px 0" }}>
        <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
          <line x1="5" y1="0" x2="5" y2="11" stroke="rgba(255,255,255,0.18)" strokeWidth="1.4"/>
          <polyline points="1,7 5,12 9,7" stroke="rgba(255,255,255,0.18)" strokeWidth="1.4" fill="none" strokeLinejoin="round"/>
        </svg>
      </div>
    )

    return (
      <div style={{ backgroundColor: "#111820", border: `1px solid ${border}`, borderRadius: "12px", padding: "28px", overflowX: "auto" as const }}>
        {/* Horizontal main flow: Data → agents (stacked) → Judge → Output */}
        <div style={{ display: "flex", alignItems: "center", gap: "0", minWidth: "680px" }}>

          {/* Data source */}
          <div style={{ flexShrink: 0, minWidth: "120px" }}>
            <div style={solidBox(<></>)}>
              <div style={{ fontFamily: mono, fontSize: "11px", fontWeight: 600, color: heading }}>PhysioNet</div>
              <div style={{ fontFamily: mono, fontSize: "10px", color: muted, marginTop: "2px" }}>CinC 2019</div>
              <div style={{ marginTop: "6px", fontSize: "9px", fontWeight: 600, letterSpacing: "0.08em", color: "rgba(255,255,255,0.3)", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: "3px", padding: "1px 5px", display: "inline-block" }}>DATA</div>
            </div>
          </div>

          {hArrow}

          {/* FastAPI */}
          <div style={{ flexShrink: 0, minWidth: "110px" }}>
            <div style={solidBox(<></>)}>
              <div style={{ fontFamily: mono, fontSize: "11px", fontWeight: 600, color: heading }}>FastAPI</div>
              <div style={{ fontFamily: mono, fontSize: "10px", color: muted, marginTop: "2px" }}>+ SQLite</div>
              <div style={{ marginTop: "6px", fontSize: "9px", fontWeight: 600, letterSpacing: "0.08em", color: "rgba(168,196,216,0.7)", backgroundColor: "rgba(168,196,216,0.07)", border: "1px solid rgba(168,196,216,0.15)", borderRadius: "3px", padding: "1px 5px", display: "inline-block", fontFamily: mono }}>Python</div>
            </div>
          </div>

          {hArrow}

          {/* Four agents stacked */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column" as const, gap: "5px" }}>
            <div style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.18)", textAlign: "center", fontFamily: ui, marginBottom: "2px" }}>asyncio.gather — parallel</div>
            {["Vitals", "Labs", "Demographic-Risk", "Historical Pattern"].map((name) => (
              <div key={name} style={{ backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: "6px", padding: "6px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: mono, fontSize: "10px", fontWeight: 500, color: heading }}>{name}</span>
                <span style={{ fontSize: "8px", fontWeight: 600, letterSpacing: "0.06em", color: "rgba(168,196,216,0.7)", backgroundColor: "rgba(168,196,216,0.07)", border: "1px solid rgba(168,196,216,0.15)", borderRadius: "3px", padding: "1px 5px", fontFamily: mono }}>Python</span>
              </div>
            ))}
          </div>

          {hArrow}

          {/* Judge */}
          <div style={{ flexShrink: 0, minWidth: "128px" }}>
            <div style={dashedBox}>
              <div style={{ fontFamily: mono, fontSize: "11px", fontWeight: 600, color: heading }}>Judge</div>
              <div style={{ fontSize: "9px", color: muted, marginTop: "3px", fontFamily: ui, lineHeight: 1.4 }}>dissent score</div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: "3px", marginTop: "6px" }}>
                <div style={{ fontSize: "8px", color: "rgba(168,196,216,0.7)", backgroundColor: "rgba(168,196,216,0.07)", border: "1px solid rgba(168,196,216,0.15)", borderRadius: "3px", padding: "1px 5px", fontFamily: mono }}>score: Python</div>
                <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.28)", backgroundColor: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.12)", borderRadius: "3px", padding: "1px 5px", fontFamily: mono }}>narration: LLM</div>
              </div>
            </div>
          </div>

          {hArrow}

          {/* Output */}
          <div style={{ flexShrink: 0, minWidth: "110px" }}>
            <div style={solidBox(<></>)}>
              <div style={{ fontFamily: mono, fontSize: "10px", fontWeight: 600, color: heading }}>Verdict</div>
              <div style={{ fontSize: "9px", color: muted, marginTop: "2px", fontFamily: ui, lineHeight: 1.4 }}>+ dissent score</div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: "20px", marginTop: "20px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            <div style={{ width: "20px", height: "0", border: "1px solid rgba(255,255,255,0.3)" }} />
            <span style={{ fontSize: "11px", color: muted, fontFamily: ui }}>Solid border = deterministic Python</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            <div style={{ width: "20px", height: "0", border: "1px dashed rgba(6,182,212,0.5)" }} />
            <span style={{ fontSize: "11px", color: muted, fontFamily: ui }}>Dashed border = LLM-involved</span>
          </div>
        </div>
      </div>
    )
  }

  const stackRows: Array<{ layer: string; items: Array<{ name: string; detail: string; note?: string }> }> = [
    {
      layer: "Data",
      items: [
        { name: "FastAPI", detail: "REST backend, per-patient hourly endpoints" },
        { name: "SQLite", detail: "Lightweight persistence for ICU encounter records" },
        { name: "PhysioNet CinC 2019", detail: "40,336 real ICU encounters, open-access ground-truth labels", note: "Dataset" },
      ],
    },
    {
      layer: "Agent Orchestration",
      items: [
        { name: "Python asyncio", detail: "True parallel agent execution via asyncio.gather" },
        { name: "Groq", detail: "LLM inference (Llama models) — narration only, not verdict" },
        { name: "n8n", detail: "Used to validate agent prompt designs before Python port", note: "Prototyping only — not in production architecture" },
      ],
    },
    {
      layer: "Evaluation",
      items: [
        { name: "scikit-learn", detail: "AUROC, sensitivity/specificity, ROC curve analysis" },
        { name: "statsmodels", detail: "Statistical association testing" },
        { name: "pandas", detail: "Cohort feature extraction and time-series windowing" },
        { name: "LightGBM", detail: "Gradient boosting for forecasting investigation" },
      ],
    },
    {
      layer: "Testing",
      items: [
        { name: "pytest", detail: "30+ unit tests covering deterministic classification logic" },
      ],
    },
    {
      layer: "Frontend",
      items: [
        { name: "React 19 + Vite", detail: "Component-based UI with hot-reload development" },
        { name: "Tailwind CSS v4", detail: "Utility-first styling via @tailwindcss/vite plugin" },
        { name: "Recharts", detail: "Vitals timeline chart with severity-banded background regions" },
      ],
    },
  ]

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0f1419", fontFamily: ui }}>
      {/* Nav */}
      <nav style={{ backgroundColor: "#0f1419", borderBottom: `1px solid ${border}`, padding: "0 40px", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky" as const, top: 0, zIndex: 50 }}>
        <button
          onClick={onBack}
          style={{ all: "unset", cursor: "pointer", fontSize: "13px", color: muted, transition: "color 0.2s", fontFamily: ui }}
          onMouseEnter={(e) => (e.currentTarget.style.color = heading)}
          onMouseLeave={(e) => (e.currentTarget.style.color = muted)}
        >
          ← Patient Monitor
        </button>
        <ProdromeWordmark small />
        <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.18)", fontFamily: ui }}>About</span>
      </nav>

      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "64px 40px 120px" }}>

        {/* ── 1. HERO ───────────────────────────────────────────────── */}
        <div style={{ marginBottom: "64px", textAlign: "center" as const }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
            <ProdromeWordmark />
          </div>
          <p style={{ fontSize: "16px", lineHeight: "1.8", color: "rgba(232,237,242,0.78)", maxWidth: "640px", margin: "0 auto 18px", fontFamily: ui }}>
            A multi-agent deterioration-detection system for ICU patients, built to test whether structured disagreement between independent evidence channels contains outcome-relevant information beyond a single risk score.
          </p>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "7px", backgroundColor: "rgba(255,255,255,0.04)", border: `1px solid ${border}`, borderRadius: "6px", padding: "5px 12px" }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="5" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2"/>
              <line x1="6" y1="4" x2="6" y2="7" stroke="rgba(255,255,255,0.25)" strokeWidth="1.4" strokeLinecap="round"/>
              <circle cx="6" cy="9" r="0.8" fill="rgba(255,255,255,0.25)"/>
            </svg>
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.32)", fontFamily: ui }}>Research / portfolio project — not a validated clinical tool</span>
          </div>
        </div>

        {/* ── 2. PROBLEM STATEMENT ──────────────────────────────────── */}
        <Section>
          <SectionLabel>Problem Statement</SectionLabel>
          <H2>Single-score deterioration alerts are widely distrusted — and for good reason.</H2>
          <P>
            Existing clinical deterioration alert tools are criticized for high false-positive rates and opaque scoring, causing alert fatigue: clinicians learn to ignore alerts that fire on nearly every patient. When the reasoning behind a score is hidden, a clinician cannot make a principled decision about whether to act — they can only dismiss the alarm or order redundant workups.
          </P>
          <P>
            Prodrome's approach: four independent specialist agents — covering vitals, labs, demographic risk, and historical trajectory — assess a patient separately and submit individual verdicts. Disagreement between them is surfaced explicitly, labeled, and scored. Rather than averaging ambiguity into one opaque number, the system treats it as a clinically meaningful signal.
          </P>
        </Section>

        {/* ── 3 & 6. WHAT IS SOLVED / WHAT IS NOT SOLVED — two-column mirrored pair ── */}
        <Section style={{ marginTop: "52px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px" }}>

            {/* LEFT: What Is Solved */}
            <div>
              <SectionLabel>What Is Solved</SectionLabel>
              <H2>Validated findings.</H2>
              <P style={{ marginBottom: "16px" }}>Numbers from 300 PhysioNet ground-truth patients. Exploratory, single-cohort — stated with the precision they warrant.</P>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "14px" }}>
                <Stat value="40,336" label="ICU encounters" note="PhysioNet CinC 2019" />
                <Stat value="300" label="Eval patients" note="Ground-truth cohort" />
                <Stat value="30+" label="pytest tests" note="Deterministic logic" />
                <Stat value="0.583" label="Dissent AUROC" note="vs 0.536 severity alone" />
              </div>

              <div style={{ display: "flex", flexDirection: "column" as const, gap: "10px" }}>
                <FindingCard title="Deterministic, auditable classification">
                  Python rules evaluate vitals, labs, and demographic risk — not LLM judgment. Testing showed LLMs unreliably compare raw numeric thresholds even when given correct data. The LLM only generates narration.
                </FindingCard>
                <FindingCard title="Validated against 300 real ICU encounters" caveat="WATCH+: any patient at WATCH or above classified as positive. 2.7% specificity = 97.3% of true-negative patients still alert.">
                  Naive severity thresholds alone cause alert fatigue: <Mono>100%</Mono> sensitivity, <Mono>2.7%</Mono> specificity. A persistence filter (2-of-3 consecutive abnormal hours) improved specificity to <Mono>12.7%</Mono>, with 81% of affected cases delayed rather than missed.
                </FindingCard>
                <FindingCard title="Committee disagreement is a validated signal" caveat="AUROC 0.583 on a single cohort. Directional signal worth investigating — not a calibrated clinical predictor.">
                  Dissent score is empirically associated with septic outcome and outperforms raw severity as a predictor. AUROC: severity alone <Mono>0.536</Mono>, dissent alone <Mono>0.583</Mono>, combined <Mono>0.585</Mono>.
                </FindingCard>
                <FindingCard title="True parallel agent execution">
                  Four agents run concurrently via <Mono>asyncio.gather</Mono>. LLM narration is strictly downstream of verdict computation — Python decides, the LLM explains. The LLM result has no path to affect the classification.
                </FindingCard>
              </div>
            </div>

            {/* RIGHT: What Is Not Solved — same visual weight */}
            <div>
              <SectionLabel>What Is Not Solved</SectionLabel>
              <H2>Current constraints.</H2>
              <P style={{ marginBottom: "16px" }}>These define what this system is and is not. Not edge cases — structural limitations.</P>

              {/* Spacer to align cards with left column's stat grid */}
              <div style={{ height: "121px" }} />

              <div style={{ display: "flex", flexDirection: "column" as const, gap: "10px" }}>
                <LimitationCard title="Not clinically validated">
                  Not FDA-cleared, not intended for real patient use. Prodrome is a research and portfolio instrument. No part of its output should inform clinical decisions about real patients.
                </LimitationCard>
                <LimitationCard title="Dissent is association, not calibration">
                  The AUROC 0.583 finding is from a single cohort with no independent validation. It establishes a directional signal worth investigating — not a reliable clinical predictor.
                </LimitationCard>
                <LimitationCard title="No forecasting capability — investigated directly">
                  The system classifies current state; it does not predict future risk. A multi-stage forecasting investigation was completed — see the dedicated section below for the full result and its negative finding.
                </LimitationCard>
                <LimitationCard title="Sparse-lab persistence gap">
                  A single significant lab abnormality cannot satisfy a multi-observation persistence rule. Labs drawn once in a window may be filtered out rather than surfaced — a known structural gap for sparsely-drawn values.
                </LimitationCard>
              </div>
            </div>

          </div>
        </Section>

        {/* ── EVALUATION RESULTS ────────────────────────────────────── */}
        <Section style={{ marginTop: "52px" }}>
          <SectionLabel>Evaluation Results</SectionLabel>
          <H2>The data, rendered directly.</H2>
          <P style={{ marginBottom: "28px" }}>
            Every number below is from the PhysioNet CinC 2019 evaluation. Values match those stated elsewhere on this page exactly.
          </P>

          {/* 2-column chart grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>

            {/* Chart 1 — Dissent vs Outcome */}
            <div style={{ backgroundColor: "#161e2a", border: `1px solid ${border}`, borderRadius: "10px", padding: "22px 24px" }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: heading, fontFamily: ui, marginBottom: "4px" }}>Dissent vs. Septic Outcome</div>
              <div style={{ fontSize: "11px", color: muted, fontFamily: ui, marginBottom: "18px" }}>% septic by committee disagreement bucket</div>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart
                  data={[
                    { bucket: "Mild disagreement\n(n=224)", pct: 46.0, color: "#f59e0b" },
                    { bucket: "Major disagreement\n(n=72)", pct: 65.3, color: "#f97316" },
                  ]}
                  margin={{ top: 8, right: 12, left: -10, bottom: 8 }}
                >
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis
                    dataKey="bucket"
                    tick={{ fontFamily: mono, fontSize: 10, fill: muted }}
                    axisLine={false}
                    tickLine={false}
                    width={80}
                    interval={0}
                    tickFormatter={(v: string) => v.split("\n")[0]}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontFamily: mono, fontSize: 10, fill: muted }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0]
                      return (
                        <div style={{ backgroundColor: "#1e2730", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "7px", padding: "8px 12px" }}>
                          <div style={{ fontFamily: mono, fontSize: "13px", fontWeight: 600, color: d.payload.color }}>{d.value}%</div>
                          <div style={{ fontSize: "11px", color: muted, fontFamily: ui }}>septic</div>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="pct" radius={[5, 5, 0, 0]} maxBarSize={72}>
                    {[{ color: "#f59e0b" }, { color: "#f97316" }].map((entry, i) => (
                      <Cell key={i} fill={entry.color} fillOpacity={0.85} />
                    ))}
                    <LabelList
                      dataKey="pct"
                      position="top"
                      formatter={(v: number) => `${v}%`}
                      style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, fill: heading }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.28)", fontFamily: ui, lineHeight: 1.5, marginTop: "6px" }}>
                Septic prevalence rises with committee disagreement (n=296 evaluable patients; Consensus bucket n=4 excluded as too small to plot reliably).
              </div>
            </div>

            {/* Chart 2 — AUROC comparison */}
            <div style={{ backgroundColor: "#161e2a", border: `1px solid ${border}`, borderRadius: "10px", padding: "22px 24px" }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: heading, fontFamily: ui, marginBottom: "4px" }}>Model Discrimination (AUROC)</div>
              <div style={{ fontSize: "11px", color: muted, fontFamily: ui, marginBottom: "18px" }}>Severity vs. dissent vs. combined — higher is better</div>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart
                  layout="vertical"
                  data={[
                    { label: "Severity only", auroc: 0.536 },
                    { label: "Dissent only", auroc: 0.583 },
                    { label: "Severity + Dissent", auroc: 0.585 },
                  ]}
                  margin={{ top: 4, right: 48, left: 8, bottom: 4 }}
                >
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0.5, 0.65]}
                    tick={{ fontFamily: mono, fontSize: 10, fill: muted }}
                    axisLine={false}
                    tickLine={false}
                    tickCount={4}
                    tickFormatter={(v: number) => v.toFixed(2)}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{ fontFamily: ui, fontSize: 11, fill: muted }}
                    axisLine={false}
                    tickLine={false}
                    width={108}
                  />
                  <ReferenceLine x={0.5} stroke="rgba(255,255,255,0.18)" strokeDasharray="4 3" label={{ value: "random", position: "insideTopLeft", fill: "rgba(255,255,255,0.2)", fontSize: 9, fontFamily: ui }} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div style={{ backgroundColor: "#1e2730", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "7px", padding: "8px 12px" }}>
                          <div style={{ fontFamily: mono, fontSize: "13px", fontWeight: 600, color: "#a8c4d8" }}>AUROC {payload[0].value}</div>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="auroc" radius={[0, 5, 5, 0]} maxBarSize={40} fill="#a8c4d8" fillOpacity={0.75}>
                    <LabelList
                      dataKey="auroc"
                      position="right"
                      formatter={(v: number) => v.toFixed(3)}
                      style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, fill: heading }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.28)", fontFamily: ui, lineHeight: 1.5, marginTop: "6px" }}>
                Dissent alone nearly matches the combined model — disagreement is the dominant signal, not severity.
              </div>
            </div>

          </div>{/* end row 1 */}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

            {/* Chart 3 — Persistence filtering tradeoff (2×2 stat grid) */}
            <div style={{ backgroundColor: "#161e2a", border: `1px solid ${border}`, borderRadius: "10px", padding: "22px 24px" }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: heading, fontFamily: ui, marginBottom: "4px" }}>Persistence Filtering Tradeoff</div>
              <div style={{ fontSize: "11px", color: muted, fontFamily: ui, marginBottom: "18px" }}>Baseline WATCH+ vs. 2-of-3 consecutive hours filter</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                {[
                  { metric: "Sensitivity", before: "100.0%", after: "92.7%", direction: "down", note: "81% delayed, not missed" },
                  { metric: "Specificity", before: "2.7%", after: "12.7%", direction: "up", note: "Substantial improvement" },
                  { metric: "False positives", before: "146", after: "131", direction: "up", note: "Per 300-patient cohort" },
                  { metric: "Median lead time", before: "17h", after: "20h", direction: "up", note: "Earlier on average" },
                ].map(({ metric, before, after, direction, note }) => (
                  <div key={metric} style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "12px 14px" }}>
                    <div style={{ fontSize: "10px", fontWeight: 500, color: "rgba(255,255,255,0.28)", fontFamily: ui, letterSpacing: "0.06em", marginBottom: "8px", textTransform: "uppercase" as const }}>{metric}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <span style={{ fontFamily: mono, fontSize: "13px", color: "rgba(232,237,242,0.38)", textDecoration: "line-through", textDecorationColor: "rgba(255,255,255,0.15)" }}>{before}</span>
                      <svg width="14" height="10" viewBox="0 0 14 10" fill="none" style={{ flexShrink: 0 }}>
                        <line x1="0" y1="5" x2="10" y2="5" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2"/>
                        <polyline points="7,2 11,5 7,8" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" fill="none"/>
                      </svg>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <span style={{ fontFamily: mono, fontSize: "15px", fontWeight: 600, color: heading }}>{after}</span>
                        {direction === "up" ? (
                          <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
                            <polyline points="5,10 5,2" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round"/>
                            <polyline points="2,5 5,2 8,5" stroke="#10b981" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        ) : (
                          <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
                            <polyline points="5,2 5,10" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round"/>
                            <polyline points="2,7 5,10 8,7" stroke="#f59e0b" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.22)", fontFamily: ui }}>{note}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart 4 — Forecasting ablation */}
            <div style={{ backgroundColor: "#161e2a", border: `1px solid ${border}`, borderRadius: "10px", padding: "22px 24px" }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: heading, fontFamily: ui, marginBottom: "4px" }}>Forecasting Ablation (AUPRC)</div>
              <div style={{ fontSize: "11px", color: muted, fontFamily: ui, marginBottom: "18px" }}>6-hour-ahead sepsis prediction — lower than expected</div>
              <ResponsiveContainer width="100%" height={175}>
                <BarChart
                  layout="vertical"
                  data={[
                    { label: "Full temporal (123 feat.)", auprc: 0.033 },
                    { label: "Hours + age + gender", auprc: 0.033 },
                    { label: "Physiology only", auprc: 0.022 },
                  ]}
                  margin={{ top: 4, right: 52, left: 8, bottom: 4 }}
                >
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, 0.04]}
                    tick={{ fontFamily: mono, fontSize: 10, fill: muted }}
                    axisLine={false}
                    tickLine={false}
                    tickCount={5}
                    tickFormatter={(v: number) => v.toFixed(3)}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{ fontFamily: ui, fontSize: 10, fill: muted }}
                    axisLine={false}
                    tickLine={false}
                    width={130}
                  />
                  <ReferenceLine x={0.015} stroke="rgba(255,255,255,0.18)" strokeDasharray="4 3" label={{ value: "random", position: "insideTopLeft", fill: "rgba(255,255,255,0.2)", fontSize: 9, fontFamily: ui }} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div style={{ backgroundColor: "#1e2730", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "7px", padding: "8px 12px" }}>
                          <div style={{ fontFamily: mono, fontSize: "13px", fontWeight: 600, color: "#a8c4d8" }}>AUPRC {(payload[0].value as number).toFixed(3)}</div>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="auprc" radius={[0, 5, 5, 0]} maxBarSize={36}>
                    {[
                      { color: "rgba(168,196,216,0.7)" },
                      { color: "rgba(168,196,216,0.5)" },
                      { color: "rgba(168,196,216,0.35)" },
                    ].map((e, i) => <Cell key={i} fill={e.color} />)}
                    <LabelList
                      dataKey="auprc"
                      position="right"
                      formatter={(v: number) => v.toFixed(3)}
                      style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, fill: heading }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.28)", fontFamily: ui, lineHeight: 1.5, marginTop: "6px" }}>
                The demographic-only model matches the full 123-feature model — most of the apparent forecasting signal is explained by encounter time, not physiology.
              </div>
            </div>

          </div>{/* end row 2 */}

          {/* Chart 5 — Committee example (P-00089) */}
          <div style={{ marginTop: "16px", backgroundColor: "#161e2a", border: `1px solid ${border}`, borderRadius: "10px", padding: "22px 24px" }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: heading, fontFamily: ui, marginBottom: "4px" }}>Committee in Action — Example Patient P-00089</div>
            <div style={{ fontSize: "11px", color: muted, fontFamily: ui, marginBottom: "20px" }}>Static illustration of how four independent agents vote and how the Judge synthesizes the result</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "16px" }}>
              {[
                { name: "Vitals", verdict: "CRITICAL" as Severity, icon: "vitals" as Agent["icon"], narration: "HR 134, MAP 48 despite 2L crystalloid, SpO₂ 88% on 6L O₂" },
                { name: "Labs", verdict: "CRITICAL" as Severity, icon: "labs" as Agent["icon"], narration: "Lactate 7.2 mmol/L, pH 7.21, troponin 1.8 ng/mL" },
                { name: "Demographic/Risk", verdict: "CRITICAL" as Severity, icon: "risk" as Agent["icon"], narration: "Age 83, CHF EF 30%, COPD, CKD stage 3, frailty 0.42" },
                { name: "Historical Pattern", verdict: "DETERIORATING" as Severity, icon: "history" as Agent["icon"], narration: "Two prior rapid deteriorations, both reversed with intervention" },
              ].map((agent) => {
                const color = severityColor(agent.verdict)
                const bg = severityDim(agent.verdict)
                const bd = severityBorder(agent.verdict)
                const differs = agent.verdict !== "CRITICAL"
                return (
                  <div key={agent.name} style={{ backgroundColor: differs ? "rgba(249,115,22,0.06)" : "rgba(255,255,255,0.02)", border: differs ? `1.5px solid ${bd}` : "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "14px 16px", display: "flex", flexDirection: "column" as const, gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "26px", height: "26px", borderRadius: "6px", backgroundColor: bg, border: `1px solid ${bd}`, display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0 }}>
                        <AgentIcon type={agent.icon} />
                      </div>
                      <div>
                        <div style={{ fontSize: "10px", color: muted, fontFamily: ui }}>Agent</div>
                        <div style={{ fontSize: "12px", fontWeight: 600, color: heading, fontFamily: ui }}>{agent.name}</div>
                      </div>
                    </div>
                    <SeverityBadge verdict={agent.verdict} />
                    <p style={{ fontSize: "11px", lineHeight: "1.6", color: "rgba(232,237,242,0.55)", margin: 0, fontFamily: ui }}>{agent.narration}</p>
                    <div style={{ display: "flex", gap: "3px" }}>
                      {[0,1,2,3].map((i) => (
                        <div key={i} style={{ width: "14px", height: "3px", borderRadius: "2px", backgroundColor: i <= SEVERITY_ORDER[agent.verdict] ? color : "rgba(255,255,255,0.1)" }} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Judge row */}
            <div style={{ backgroundColor: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "7px", backgroundColor: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", flexShrink: 0 }}>⚖</div>
                <div>
                  <div style={{ fontSize: "10px", color: muted, fontFamily: ui, letterSpacing: "0.06em" }}>JUDGE VERDICT</div>
                  <SeverityBadge verdict="CRITICAL" large />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ fontSize: "11px", color: muted, fontFamily: ui }}>Dissent score</div>
                <span style={{ fontFamily: mono, fontSize: "22px", fontWeight: 600, color: dissentColor(19) }}>19</span>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", fontFamily: ui }}>/ 100</div>
              </div>
              <div style={{ fontSize: "12px", color: "rgba(232,237,242,0.5)", fontFamily: ui, maxWidth: "320px", lineHeight: 1.5 }}>
                Near-consensus (3× CRITICAL, 1× DETERIORATING). Vasopressor-refractory hypotension, lactic acidosis, demand ischemia on a high-frailty substrate — immediate review indicated.
              </div>
            </div>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.22)", fontFamily: ui, marginTop: "10px" }}>
              Illustrative — uses P-00089 demo values. The dissenting Historical Pattern agent notes prior successful reversals; the Judge weighs real-time physiology as dominant.
            </div>
          </div>

        </Section>

        {/* ── 4. ARCHITECTURE DIAGRAM ───────────────────────────────── */}
        <Section style={{ marginTop: "52px" }}>
          <SectionLabel>Architecture</SectionLabel>
          <H2>Python decides. LLMs explain. The boundary is structural, not optional.</H2>
          <P style={{ marginBottom: "22px" }}>
            No LLM output can affect a verdict. Narration is strictly downstream of deterministic classification.
          </P>
          <ArchDiagram />
        </Section>

        {/* ── 5. TECH STACK ─────────────────────────────────────────── */}
        <Section style={{ marginTop: "52px" }}>
          <SectionLabel>Tech Stack</SectionLabel>
          <H2>Layered by responsibility.</H2>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: "20px" }}>
            {stackRows.map((row) => (
              <div key={row.layer}>
                <div style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.2)", fontFamily: ui, marginBottom: "7px" }}>{row.layer}</div>
                <div style={{ backgroundColor: "#161e2a", border: `1px solid ${border}`, borderRadius: "10px", overflow: "hidden" }}>
                  {row.items.map((item, i) => (
                    <div key={item.name} style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: "14px", padding: "12px 18px", borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : undefined, alignItems: "start" }}>
                      <span style={{ fontFamily: mono, fontSize: "12px", color: "#a8c4d8", fontWeight: 500 }}>{item.name}</span>
                      <div>
                        <div style={{ fontSize: "13px", color: body, lineHeight: "1.5", fontFamily: ui }}>{item.detail}</div>
                        {item.note && <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", marginTop: "2px", fontFamily: ui, fontStyle: "italic" }}>{item.note}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── 7. FORECASTING INVESTIGATION — distinct "research finding" panel ── */}
        <Section style={{ marginTop: "52px" }}>
          <SectionLabel>Forecasting Investigation</SectionLabel>
          <div style={{
            backgroundColor: "#111c28",
            border: "1px solid rgba(6,182,212,0.22)",
            borderTop: "3px solid rgba(6,182,212,0.45)",
            borderRadius: "10px",
            padding: "28px 32px",
            boxShadow: "0 0 32px rgba(6,182,212,0.06)",
          }}>
            <div style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "rgba(6,182,212,0.5)", fontFamily: ui, marginBottom: "10px" }}>Research Finding</div>
            <h3 style={{ fontSize: "17px", fontWeight: 700, color: heading, margin: "0 0 18px", fontFamily: ui, lineHeight: 1.4 }}>
              Can Prodrome forecast future risk? We investigated — and found a clear answer: not yet, with this data.
            </h3>
            <P style={{ maxWidth: "none" }}>
              A multi-stage investigation into 6-hour-ahead sepsis forecasting progressed from coarse features (<Mono>AUPRC 0.034</Mono>) to 123 engineered temporal features (lags, deltas, slopes, rolling stats), evaluated on 38,838 patients with proper patient-level splits and calibration. Temporal features improved raw discrimination (<Mono>AUROC 0.630 → 0.726</Mono>), but an ablation study showed this was substantially explained by time-in-encounter rather than physiological signal — a 3-feature demographic/time model matched the full model's AUPRC.
            </P>
            <P style={{ maxWidth: "none" }}>
              Hand-engineered deterioration-interaction features still did not beat this baseline in the clinically relevant 2–6 hour pre-onset window (<Mono>0.019</Mono> vs. <Mono>0.028</Mono>). Patient-level evaluation showed a median 46-hour lead time, inconsistent with genuine near-term forecasting.
            </P>
            <div style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "7px", padding: "14px 18px", marginTop: "8px" }}>
              <P style={{ margin: 0, maxWidth: "none", color: "rgba(232,237,242,0.85)", fontStyle: "italic" }}>
                Conclusion: physiological trajectory data did not demonstrate forecasting value beyond baseline demographic/temporal risk with this dataset and feature set. This is a real, evidence-backed negative result — not an unexplored gap.
              </P>
            </div>
          </div>
        </Section>

        {/* ── 8. FUTURE SCOPE — dashed cards, visually distinct from "solved" ── */}
        <Section style={{ marginTop: "52px" }}>
          <SectionLabel>Future Scope — Roadmap, Not Existing Features</SectionLabel>
          <H2>What would be required to extend this honestly.</H2>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: "10px" }}>
            <RoadmapCard title="External validation of the dissent-outcome finding">
              The AUROC results (severity 0.536, dissent 0.583) are from a single cohort. Confirmation requires replication on a held-out or independent dataset with equivalent ground-truth labels. Without this, the finding remains directional evidence.
            </RoadmapCard>
            <RoadmapCard title="Lab-specific persistence rules">
              Replace the uniform 2-of-3 observation window with sampling-aware rules that account for the sparse and irregular nature of lab draws. A single critical lactate result should not be systematically filtered because it wasn't repeated within the hour.
            </RoadmapCard>
            <RoadmapCard title="Higher-resolution and intervention-rich datasets (MIMIC-IV, eICU-CRD, HiRID)">
              These datasets require CITI training and a data use agreement, and would test whether intervention-response data and higher resolution support genuine short-horizon forecasting — a question the PhysioNet CinC 2019 dataset cannot answer. Not pursued in this investigation.
            </RoadmapCard>
            <RoadmapCard title="Baseline model comparison">
              Logistic regression and gradient boosting on the same feature set — to test whether the multi-agent committee architecture produces any advantage over a single well-tuned model. Without this comparison, the architecture's value remains asserted, not demonstrated.
            </RoadmapCard>
            <RoadmapCard title="Full frontend with historical hour scrubbing">
              Per-agent evidence drill-down and the ability to replay the committee's assessment at any past ICU hour — supporting retrospective case review.
            </RoadmapCard>
          </div>
        </Section>

        {/* ── 9. LINKS ──────────────────────────────────────────────── */}
        <Section style={{ marginTop: "52px" }}>
          <SectionLabel>Links</SectionLabel>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" as const }}>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", backgroundColor: "#161e2a", border: `1px solid ${border}`, borderRadius: "8px", padding: "11px 20px", fontSize: "13px", fontWeight: 600, color: "rgba(232,237,242,0.75)", textDecoration: "none", fontFamily: ui, transition: "border-color 0.15s, color 0.15s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(255,255,255,0.2)"; (e.currentTarget as HTMLAnchorElement).style.color = heading }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = border; (e.currentTarget as HTMLAnchorElement).style.color = "rgba(232,237,242,0.75)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              GitHub Repository
            </a>
            <button
              onClick={onBack}
              style={{ all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px", backgroundColor: "#161e2a", border: `1px solid ${border}`, borderRadius: "8px", padding: "11px 20px", fontSize: "13px", fontWeight: 500, color: "rgba(232,237,242,0.75)", fontFamily: ui, transition: "border-color 0.15s, color 0.15s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.2)"; (e.currentTarget as HTMLButtonElement).style.color = heading }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = border; (e.currentTarget as HTMLButtonElement).style.color = "rgba(232,237,242,0.75)" }}
            >
              ← Back to Dashboard
            </button>
          </div>
        </Section>

      </div>
    </div>
  )
}

