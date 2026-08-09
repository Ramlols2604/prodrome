import { useEffect, useState } from "react"
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom"
import type { Patient } from "./types"
import { patients } from "./data/patients"
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
  const patient = patients.find((p) => p.id === id)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => setLoading(false), 2200)
    return () => clearTimeout(t)
  }, [id])

  if (!patient) return <Navigate to="/" replace />

  return (
    <PatientDetail
      patient={patient}
      onBack={() => navigate("/")}
      onAbout={() => navigate("/about")}
      loading={loading}
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
