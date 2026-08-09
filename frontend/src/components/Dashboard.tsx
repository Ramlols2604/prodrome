import { useEffect, useMemo, useRef, useState } from "react"
import { Search, ArrowUpDown } from "lucide-react"
import { useVirtualizer } from "@tanstack/react-virtual"
import type { Patient, Severity } from "../types"
import { SEVERITY_ORDER } from "../types"
import { fetchSummaries, summaryToPatient } from "../api"
import { severityColor } from "../lib/colors"
import PatientCard from "./PatientCard"
import ProdromeWordmark from "./ProdromeWordmark"
import LiveStatusBar from "./LiveStatusBar"

type SortKey = "severity" | "dissent" | "recent"

export default function Dashboard({ onSelect, onAbout }: { onSelect: (p: Patient) => void; onAbout: () => void }) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [filterVerdict, setFilterVerdict] = useState<Severity | "ALL">("ALL")
  const [sortKey, setSortKey] = useState<SortKey>("severity")
  const [sortOpen, setSortOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    fetchSummaries()
      .then((rows) => {
        if (!cancelled) {
          setPatients(rows.map(summaryToPatient))
          setListLoading(false)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setListError(err.message || "Failed to load patients")
          setListLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const sortLabels: Record<SortKey, string> = {
    severity: "Severity",
    dissent: "Dissent",
    recent: "Most Recent",
  }

  const filtered = useMemo(
    () =>
      patients
        .filter((p) => {
          const matchFilter = filterVerdict === "ALL" || p.verdict === filterVerdict
          const q = query.toLowerCase()
          const matchSearch =
            !q ||
            p.id.toLowerCase().includes(q) ||
            p.verdict.toLowerCase().includes(q) ||
            p.primaryDriver.toLowerCase().includes(q)
          return matchFilter && matchSearch
        })
        .sort((a, b) => {
          if (sortKey === "severity") return SEVERITY_ORDER[b.verdict] - SEVERITY_ORDER[a.verdict]
          if (sortKey === "dissent") return b.dissentScore - a.dissentScore
          return b.icuHour - a.icuHour
        }),
    [patients, filterVerdict, query, sortKey],
  )

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 128,
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

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0f1419" }}>
      {/* Nav */}
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
        {/* Compact page header */}
        <div style={{ marginBottom: "16px" }}>
          <h1 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 2px", color: "#e8edf2", letterSpacing: "-0.02em" }}>
            ICU Patient Monitor
          </h1>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.28)", margin: 0 }}>
            {listLoading ? "Loading…" : `${patients.length} patients`} · urgency-first · committee assessments updated continuously
          </p>
        </div>

        {/* Search + sort row */}
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

          {/* Sort control */}
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

        {/* Filter pills row — compact, inline */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "20px", flexWrap: "wrap" as const }}>
          {filterPills.map(({ label, value }) => {
            const active = filterVerdict === value
            const pillColor = value === "ALL" ? null : severityColor(value as Severity)
            return (
              <button
                key={value}
                onClick={() => setFilterVerdict(value)}
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
              height: "calc(100vh - 280px)",
              minHeight: "360px",
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
                    <PatientCard patient={p} onClick={() => onSelect(p)} />
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
