import { useEffect, useState } from "react"
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom"
import type { Patient, PatientAnalytics } from "./types"
import type { ChartPoint } from "./api"
import {
  applyCommitteeNarration,
  fetchCommittee,
  fetchSnapshot,
  snapshotToAnalytics,
  snapshotToChart,
  summaryToPatient,
} from "./api"
import Dashboard from "./components/Dashboard"
import PatientDetail from "./components/PatientDetail"
import AboutPage from "./components/AboutPage"

function DashboardPage() {
  const navigate = useNavigate()
  return (
    <Dashboard
      onSelect={(p: Patient) => navigate(`/patients/${p.id}`)}
      onAbout={() => navigate("/about")}
    />
  )
}

function PatientDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [analytics, setAnalytics] = useState<PatientAnalytics | undefined>()
  const [chartData, setChartData] = useState<ChartPoint[] | undefined>()
  const [snapshotLoading, setSnapshotLoading] = useState(true)
  const [narrationLoading, setNarrationLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setPatient(null)
    setSnapshotLoading(true)
    setNarrationLoading(true)
    setNotFound(false)

    ;(async () => {
      try {
        const snap = await fetchSnapshot(id)
        if (cancelled) return
        const p = summaryToPatient(snap)
        setPatient(p)
        setAnalytics(snapshotToAnalytics(snap))
        setChartData(snapshotToChart(snap))
        setSnapshotLoading(false)
        try {
          const committee = await fetchCommittee(id)
          if (cancelled) return
          setPatient(applyCommitteeNarration(p, committee))
        } catch {
          /* deterministic UI still works without narration */
        } finally {
          if (!cancelled) setNarrationLoading(false)
        }
      } catch {
        if (!cancelled) {
          setNotFound(true)
          setSnapshotLoading(false)
          setNarrationLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [id])

  async function refreshNarration() {
    if (!id) return
    setNarrationLoading(true)
    try {
      const snap = await fetchSnapshot(id)
      const committee = await fetchCommittee(id, true)
      setPatient(applyCommitteeNarration(summaryToPatient(snap), committee))
      setAnalytics(snapshotToAnalytics(snap))
      setChartData(snapshotToChart(snap))
    } finally {
      setNarrationLoading(false)
    }
  }

  if (notFound) return <Navigate to="/" replace />
  if (!patient) {
    return (
      <PatientDetail
        patient={{
          id: id ?? "",
          age: 0,
          sex: "",
          icuHour: 0,
          verdict: "WATCH",
          dissentScore: 0,
          committeeStatus: "Majority",
          primaryDriver: "",
          agents: [],
          judgeSynthesis: "",
        }}
        onBack={() => navigate("/")}
        onAbout={() => navigate("/about")}
        loading
      />
    )
  }

  return (
    <PatientDetail
      patient={patient}
      onBack={() => navigate("/")}
      onAbout={() => navigate("/about")}
      loading={snapshotLoading}
      narrationLoading={narrationLoading}
      analytics={analytics}
      chartData={chartData}
      onRefresh={refreshNarration}
    />
  )
}

function AboutRoute() {
  const navigate = useNavigate()
  return <AboutPage onBack={() => navigate("/")} />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/patients/:id" element={<PatientDetailPage />} />
        <Route path="/about" element={<AboutRoute />} />
      </Routes>
    </BrowserRouter>
  )
}
