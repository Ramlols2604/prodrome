import { useEffect, useMemo, useRef, useState } from "react"
import { Search, ArrowUpDown, Download, ChevronDown } from "lucide-react"
import { useVirtualizer } from "@tanstack/react-virtual"
import type { Patient, Severity } from "../types"
import { SEVERITY_ORDER } from "../types"
import { fetchNarrationConsistency, fetchSummaries, summaryToPatient, type NarrationConsistency } from "../api"
import { severityColor } from "../lib/colors"
import PatientCard from "./PatientCard"
import ProdromeWordmark from "./ProdromeWordmark"
import LiveStatusBar from "./LiveStatusBar"

type SortKey = "severity" | "dissent" | "recent"

const MAJOR_DISSENT = 33.3
const SEVERITY_MIX: Severity[] = ["STABLE", "WATCH", "DETERIORATING", "CRITICAL"]
const RISK_LEVELS = ["LOW", "MODERATE", "ELEVATED", "HIGH"] as const
const WORKLIST_KEY = "prodrome.worklist"

function loadWorklist(): Set<string> {
  try {
    const raw = localStorage.getItem(WORKLIST_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(arr) ? arr.map(String) : [])
  } catch {
    return new Set()
  }
}

function saveWorklist(ids: Set<string>) {
  localStorage.setItem(WORKLIST_KEY, JSON.stringify([...ids]))
}

function meanSeverity(rows: Patient[]): number {
  if (!rows.length) return 0
  return rows.reduce((s, p) => s + SEVERITY_ORDER[p.verdict], 0) / rows.length
}

function StatCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div style={{ backgroundColor: "#161e2a", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "12px 14px" }}>
      <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.32)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "6px" }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "20px", fontWeight: 600, color: "#e8edf2", lineHeight: 1 }}>
        {value}
      </div>
      {note ? <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.28)", marginTop: "4px" }}>{note}</div> : null}
    </div>
  )
}

export default function Dashboard({ onSelect, onAbout }: { onSelect: (p: Patient) => void; onAbout: () => void }) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [filterVerdict, setFilterVerdict] = useState<Severity | "ALL">("ALL")
  const [highDissentOnly, setHighDissentOnly] = useState(false)
  const [worklistOnly, setWorklistOnly] = useState(false)
  const [flagged, setFlagged] = useState<Set<string>>(() => loadWorklist())
  const [sortKey, setSortKey] = useState<SortKey>("severity")
  const [sortOpen, setSortOpen] = useState(false)
  const [loadedAt, setLoadedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [recentOpen, setRecentOpen] = useState(true)
  const [consistency, setConsistency] = useState<NarrationConsistency | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    fetchSummaries()
      .then((rows) => {
        if (!cancelled) {
          setPatients(rows.map(summaryToPatient))
          setLoadedAt(Date.now())
          setListLoading(false)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setListError(err.message || "Failed to load patients")
          setListLoading(false)
        }
      })
    fetchNarrationConsistency()
      .then((c) => { if (!cancelled) setConsistency(c) })
      .catch(() => { /* panel shows empty-cache note */ })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (loadedAt == null) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [loadedAt])

  const sortLabels: Record<SortKey, string> = {
    severity: "Severity",
    dissent: "Dissent",
    recent: "Most Recent",
  }

  const stats = useMemo(() => {
    const n = patients.length
    const meanDissent = n ? patients.reduce((s, p) => s + p.dissentScore, 0) / n : 0
    const majorDissent = patients.filter((p) => p.dissentScore > MAJOR_DISSENT).length
    const urgent = patients.filter((p) => p.verdict === "DETERIORATING" || p.verdict === "CRITICAL").length
    const mix = Object.fromEntries(SEVERITY_MIX.map((s) => [s, patients.filter((p) => p.verdict === s).length])) as Record<Severity, number>
    const mild = patients.filter((p) => p.dissentScore <= MAJOR_DISSENT)
    const major = patients.filter((p) => p.dissentScore > MAJOR_DISSENT)
    const hoursReq = (p: Patient) => p.hoursRequested || 12
    const lowCoverage = patients.filter((p) => (p.labsDrawnCount ?? 0) / hoursReq(p) < 0.5).length
    const risk = Object.fromEntries(RISK_LEVELS.map((r) => [r, patients.filter((p) => p.baselineRisk === r).length])) as Record<(typeof RISK_LEVELS)[number], number>
    return {
      n,
      meanDissent,
      majorDissent,
      urgent,
      mix,
      mildN: mild.length,
      majorN: major.length,
      mildSev: meanSeverity(mild),
      majorSev: meanSeverity(major),
      lowCoverage,
      risk,
    }
  }, [patients])

  const recentChanges = useMemo(() => {
    const rows: Array<{ id: string; from: Severity; to: Severity; hoursAgo: number }> = []
    for (const p of patients) {
      const hist = p.verdictHistory
      if (!hist || hist.length < 2) continue
      for (let i = hist.length - 1; i >= 1; i--) {
        if (hist[i].verdict !== hist[i - 1].verdict) {
          const hoursAgo = p.icuHour - hist[i].hour
          if (hoursAgo <= 3) {
            rows.push({ id: p.id, from: hist[i - 1].verdict, to: hist[i].verdict, hoursAgo })
          }
          break
        }
      }
    }
    return rows
      .sort((a, b) => SEVERITY_ORDER[b.to] - SEVERITY_ORDER[a.to] || a.hoursAgo - b.hoursAgo)
      .slice(0, 5)
  }, [patients])

  const filtered = useMemo(
    () =>
      patients
        .filter((p) => {
          const matchFilter = filterVerdict === "ALL" || p.verdict === filterVerdict
          const matchDissent = !highDissentOnly || p.dissentScore > MAJOR_DISSENT
          const matchWorklist = !worklistOnly || flagged.has(p.id)
          const q = query.toLowerCase()
          const matchSearch =
            !q ||
            p.id.toLowerCase().includes(q) ||
            p.verdict.toLowerCase().includes(q) ||
            p.primaryDriver.toLowerCase().includes(q)
          return matchFilter && matchDissent && matchWorklist && matchSearch
        })
        .sort((a, b) => {
          if (sortKey === "severity") return SEVERITY_ORDER[b.verdict] - SEVERITY_ORDER[a.verdict]
          if (sortKey === "dissent") return b.dissentScore - a.dissentScore
          return b.icuHour - a.icuHour
        }),
    [patients, filterVerdict, highDissentOnly, worklistOnly, flagged, query, sortKey],
  )

  const updatedAgo = loadedAt == null ? null : Math.max(0, Math.floor((now - loadedAt) / 1000))

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 132,
    overscan: 10,
    gap: 8,
  })

  const filterPills: Array<{ label: string; value: Severity | "ALL" }> = [
    { label: "All", value: "ALL" },
    { label: "Critical", value: "CRITICAL" },
    { label: "Deteriorating", value: "DETERIORATING" },
    { label: "Watch", value: "WATCH" },
    { label: "Stable", value: "STABLE" },
  ]

  function toggleFlag(id: string) {
    setFlagged((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveWorklist(next)
      return next
    })
  }

  function downloadCsv() {
    const header = "patient_id,age,gender,committee_verdict,dissent_score,primary_concern"
    const lines = filtered.map((p) =>
      [p.id, p.age, p.sex, p.verdict, p.dissentScore, `"${(p.primaryDriver || "").replace(/"/g, '""')}"`].join(","),
    )
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "prodrome-worklist.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const insightHigher = stats.majorSev > stats.mildSev + 0.02
  const insightLower = stats.majorSev + 0.02 < stats.mildSev

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0f1419" }}>
      <nav style={{
        backgroundColor: "#0f1419",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "0 40px",
        height: "56px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}>
        <ProdromeWordmark />
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <LiveStatusBar />
          <button
            onClick={onAbout}
            style={{ all: "unset", cursor: "pointer", fontSize: "12px", color: "rgba(255,255,255,0.28)", fontFamily: "var(--font-ui)", transition: "color 0.15s" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#e8edf2")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.28)")}
          >
            About
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "28px 40px 80px" }}>
        <div style={{ marginBottom: "16px" }}>
          <h1 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 2px", color: "#e8edf2", letterSpacing: "-0.02em" }}>
            ICU Patient Monitor
          </h1>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.28)", margin: 0 }}>
            {listLoading ? "Loading…" : `${patients.length} patients`} · urgency-first · committee assessments updated continuously
          </p>
        </div>

        {!listLoading && !listError && patients.length > 0 && (
          <>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr 1fr 180px",
              gap: "10px",
              marginBottom: "10px",
              alignItems: "stretch",
            }}>
              <StatCard label="Mean dissent" value={stats.meanDissent.toFixed(1)} note="of 100" />
              <StatCard label="Major disagreement" value={String(stats.majorDissent)} note={`dissent > ${MAJOR_DISSENT}`} />
              <StatCard label="Deteriorating / Critical" value={String(stats.urgent)} note="current committee" />
              <StatCard label="Last updated" value={updatedAgo == null ? "—" : `${updatedAgo}s`} note="ago" />
              <div style={{
                backgroundColor: "#161e2a",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "10px",
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}>
                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.32)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  Severity mix
                </div>
                <div style={{ display: "flex", height: "10px", borderRadius: "4px", overflow: "hidden", backgroundColor: "rgba(255,255,255,0.06)", margin: "10px 0 8px" }}>
                  {SEVERITY_MIX.map((s) => {
                    const w = stats.n ? (stats.mix[s] / stats.n) * 100 : 0
                    if (w <= 0) return null
                    return (
                      <div
                        key={s}
                        title={`${s} ${stats.mix[s]}`}
                        style={{ width: `${w}%`, backgroundColor: severityColor(s), minWidth: stats.mix[s] ? "2px" : 0 }}
                      />
                    )
                  })}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                  {SEVERITY_MIX.map((s) => (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: severityColor(s), flexShrink: 0 }} />
                      <span style={{ flex: 1, letterSpacing: "0.02em" }}>{s.slice(0, 4)}</span>
                      <span style={{ fontFamily: "var(--font-mono)", color: "rgba(232,237,242,0.55)" }}>{stats.mix[s]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1.3fr", gap: "10px", marginBottom: "16px" }}>
              <div style={{ backgroundColor: "#161e2a", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "12px 14px" }}>
                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.32)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "8px" }}>
                  Verdict consistency
                </div>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginBottom: "10px", lineHeight: 1.45 }}>
                  How often the AI's explanation agreed with the computed verdict.
                </div>
                {consistency && consistency.cached_patients > 0 ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    {(["vitals", "labs", "risk", "historical"] as const).map((k) => {
                      const a = consistency.agents[k]
                      return (
                        <div key={k}>
                          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.32)", textTransform: "capitalize" }}>{k}</div>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: "16px", fontWeight: 600, color: "#e8edf2" }}>
                            {a?.pct == null ? "—" : `${a.pct}%`}
                          </div>
                          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.28)" }}>n={a?.n ?? 0}</div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.32)", lineHeight: 1.5 }}>
                    No cached committee narrations yet. Open a patient detail page to generate them — this panel never calls the LLM itself.
                  </div>
                )}
              </div>

              <StatCard
                label="Low lab coverage"
                value={String(stats.lowCoverage)}
                note={`drawn in <50% of ${patients[0]?.hoursRequested ?? 12}h window — lower confidence in lab findings`}
              />

              <div style={{ backgroundColor: "#161e2a", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "12px 14px" }}>
                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.32)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "8px" }}>
                  Baseline risk
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  {RISK_LEVELS.map((r) => (
                    <div key={r} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "rgba(255,255,255,0.45)" }}>
                      <span>{r}</span>
                      <span style={{ fontFamily: "var(--font-mono)", color: "#e8edf2" }}>{stats.risk[r]}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ backgroundColor: "#111c28", border: "1px solid rgba(6,182,212,0.22)", borderRadius: "10px", padding: "12px 14px" }}>
                <div style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(6,182,212,0.55)", marginBottom: "8px" }}>
                  Live cohort analysis
                </div>
                <div style={{ fontSize: "12px", color: "rgba(232,237,242,0.75)", lineHeight: 1.55 }}>
                  {insightHigher
                    ? `Patients with major disagreement (n=${stats.majorN}) currently trend toward higher committee severity than mild disagreement (n=${stats.mildN}) — mean ${stats.majorSev.toFixed(2)} vs ${stats.mildSev.toFixed(2)} on the 0–3 scale.`
                    : insightLower
                      ? `In this live cohort, major disagreement (n=${stats.majorN}) does not currently sit above mild disagreement (n=${stats.mildN}) on mean severity (${stats.majorSev.toFixed(2)} vs ${stats.mildSev.toFixed(2)}).`
                      : `Mean committee severity is similar for major (n=${stats.majorN}) and mild (n=${stats.mildN}) disagreement (${stats.majorSev.toFixed(2)} vs ${stats.mildSev.toFixed(2)}).`}
                </div>
                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.28)", marginTop: "8px" }}>
                  Computed from loaded summaries only — no ground-truth labels.
                </div>
              </div>
            </div>

            <div style={{
              backgroundColor: "#161e2a",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "10px",
              marginBottom: "16px",
              overflow: "hidden",
            }}>
              <button
                onClick={() => setRecentOpen((o) => !o)}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "12px 14px",
                  boxSizing: "border-box",
                  fontFamily: "var(--font-ui)",
                }}
              >
                <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>
                  Recent changes · {recentChanges.length}
                </span>
                <ChevronDown size={14} color="rgba(255,255,255,0.35)" style={{ transform: recentOpen ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s" }} />
              </button>
              {recentOpen && (
                <div style={{ padding: "0 14px 12px" }}>
                  {recentChanges.length === 0 ? (
                    <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.32)" }}>
                      No committee-verdict transitions in the last 3 hours of any loaded encounter.
                    </div>
                  ) : (
                    recentChanges.map((r) => (
                      <button
                        key={`${r.id}-${r.from}-${r.to}`}
                        onClick={() => onSelect(patients.find((p) => p.id === r.id)!)}
                        style={{
                          all: "unset",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          width: "100%",
                          padding: "8px 0",
                          borderTop: "1px solid rgba(255,255,255,0.05)",
                          fontFamily: "var(--font-ui)",
                          boxSizing: "border-box",
                        }}
                      >
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#e8edf2", width: "88px" }}>{r.id}</span>
                        <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.04em" }}>
                          <span style={{ color: severityColor(r.from) }}>{r.from}</span>
                          <span style={{ color: "rgba(255,255,255,0.3)" }}> → </span>
                          <span style={{ color: severityColor(r.to) }}>{r.to}</span>
                        </span>
                        <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
                          {r.hoursAgo === 0 ? "this hour" : `${r.hoursAgo}h ago`}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        )}

        <div style={{ display: "flex", gap: "10px", marginBottom: "10px", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.22)" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search patient ID, severity, or clinical finding…"
              style={{
                width: "100%",
                backgroundColor: "#161c24",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "8px",
                padding: "9px 14px 9px 36px",
                fontSize: "13px",
                color: "#e8edf2",
                outline: "none",
                fontFamily: "var(--font-ui)",
                boxSizing: "border-box" as const,
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(6,182,212,0.4)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
            />
          </div>

          <button
            onClick={downloadCsv}
            disabled={filtered.length === 0}
            style={{
              all: "unset",
              cursor: filtered.length === 0 ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              backgroundColor: "#161c24",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "8px",
              padding: "9px 14px",
              fontSize: "12px",
              color: filtered.length === 0 ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.55)",
              fontFamily: "var(--font-ui)",
              whiteSpace: "nowrap" as const,
            }}
          >
            <Download size={13} />
            Download CSV
          </button>

          <div style={{ position: "relative" }}>
            <button
              onClick={() => setSortOpen((o) => !o)}
              style={{
                all: "unset",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                backgroundColor: sortOpen ? "#1e2730" : "#161c24",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "8px",
                padding: "9px 14px",
                fontSize: "12px",
                color: "rgba(255,255,255,0.55)",
                fontFamily: "var(--font-ui)",
                whiteSpace: "nowrap" as const,
                transition: "background-color 0.15s",
              }}
            >
              <ArrowUpDown size={13} />
              {sortLabels[sortKey]}
            </button>
            {sortOpen && (
              <div style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 6px)",
                backgroundColor: "#1e2730",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                overflow: "hidden",
                zIndex: 20,
                minWidth: "140px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
              }}>
                {(["severity", "dissent", "recent"] as SortKey[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => { setSortKey(k); setSortOpen(false) }}
                    style={{
                      all: "unset",
                      cursor: "pointer",
                      display: "block",
                      width: "100%",
                      padding: "10px 16px",
                      fontSize: "12px",
                      color: k === sortKey ? "#e8edf2" : "rgba(255,255,255,0.45)",
                      backgroundColor: k === sortKey ? "rgba(255,255,255,0.05)" : "transparent",
                      fontWeight: k === sortKey ? 600 : 400,
                      transition: "background-color 0.1s",
                      boxSizing: "border-box" as const,
                      fontFamily: "var(--font-ui)",
                    }}
                    onMouseEnter={(e) => { if (k !== sortKey) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(255,255,255,0.04)" }}
                    onMouseLeave={(e) => { if (k !== sortKey) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent" }}
                  >
                    {sortLabels[k]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: "6px", marginBottom: "20px", flexWrap: "wrap" as const }}>
          {filterPills.map(({ label, value }) => {
            const active = filterVerdict === value && !worklistOnly
            const pillColor = value === "ALL" ? null : severityColor(value as Severity)
            return (
              <button
                key={value}
                onClick={() => { setFilterVerdict(value); setWorklistOnly(false) }}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "4px 12px",
                  borderRadius: "20px",
                  fontSize: "11px",
                  fontWeight: active ? 600 : 400,
                  letterSpacing: "0.03em",
                  backgroundColor: active
                    ? pillColor ? `${pillColor}20` : "rgba(255,255,255,0.08)"
                    : "transparent",
                  border: active
                    ? `1px solid ${pillColor ? pillColor + "50" : "rgba(255,255,255,0.2)"}`
                    : "1px solid rgba(255,255,255,0.06)",
                  color: active
                    ? pillColor ?? "#e8edf2"
                    : "rgba(255,255,255,0.35)",
                  transition: "all 0.15s",
                  fontFamily: "var(--font-ui)",
                }}
              >
                {pillColor && (
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: active ? pillColor : "rgba(255,255,255,0.2)", flexShrink: 0 }} />
                )}
                {label}
                <span style={{ opacity: 0.5, fontSize: "10px" }}>
                  {value === "ALL" ? patients.length : patients.filter((p) => p.verdict === value).length}
                </span>
              </button>
            )
          })}
          <button
            onClick={() => setHighDissentOnly((v) => !v)}
            style={{
              all: "unset",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "4px 12px",
              borderRadius: "20px",
              fontSize: "11px",
              fontWeight: highDissentOnly ? 600 : 400,
              letterSpacing: "0.03em",
              backgroundColor: highDissentOnly ? "rgba(249,115,22,0.16)" : "transparent",
              border: highDissentOnly ? "1px solid rgba(249,115,22,0.45)" : "1px solid rgba(255,255,255,0.06)",
              color: highDissentOnly ? "#f97316" : "rgba(255,255,255,0.35)",
              transition: "all 0.15s",
              fontFamily: "var(--font-ui)",
            }}
          >
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: highDissentOnly ? "#f97316" : "rgba(255,255,255,0.2)", flexShrink: 0 }} />
            High dissent only
            <span style={{ opacity: 0.5, fontSize: "10px" }}>{stats.majorDissent}</span>
          </button>
          <button
            onClick={() => {
              setWorklistOnly((on) => {
                if (on) return false
                setFilterVerdict("ALL")
                return true
              })
            }}
            style={{
              all: "unset",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "4px 12px",
              borderRadius: "20px",
              fontSize: "11px",
              fontWeight: worklistOnly ? 600 : 400,
              letterSpacing: "0.03em",
              backgroundColor: worklistOnly ? "rgba(245,158,11,0.16)" : "transparent",
              border: worklistOnly ? "1px solid rgba(245,158,11,0.45)" : "1px solid rgba(255,255,255,0.06)",
              color: worklistOnly ? "#f59e0b" : "rgba(255,255,255,0.35)",
              transition: "all 0.15s",
              fontFamily: "var(--font-ui)",
            }}
          >
            My Worklist
            <span style={{ opacity: 0.5, fontSize: "10px" }}>{flagged.size}</span>
          </button>
        </div>

        {listError && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#f97316", fontSize: "13px" }}>
            {listError}
          </div>
        )}

        {listLoading && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "rgba(255,255,255,0.18)", fontSize: "13px" }}>
            Loading patient summaries…
          </div>
        )}

        {!listLoading && !listError && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "rgba(255,255,255,0.18)", fontSize: "13px" }}>
            No patients match the current filter.
          </div>
        )}

        {!listLoading && !listError && filtered.length > 0 && (
          <div
            ref={listRef}
            style={{
              height: "calc(100vh - 560px)",
              minHeight: "280px",
              overflow: "auto",
            }}
          >
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {virtualizer.getVirtualItems().map((vi) => {
                const p = filtered[vi.index]
                return (
                  <div
                    key={p.id}
                    data-index={vi.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${vi.start}px)`,
                    }}
                  >
                    <PatientCard
                      patient={p}
                      flagged={flagged.has(p.id)}
                      onToggleFlag={() => toggleFlag(p.id)}
                      onClick={() => onSelect(p)}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
