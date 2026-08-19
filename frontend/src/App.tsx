import { BrowserRouter, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom"
import type { Patient } from "./types"
import Dashboard from "./components/Dashboard"
import PatientDetail from "./components/PatientDetail"
import AboutPage from "./components/AboutPage"

function DashboardLayer() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const visible = pathname === "/"
  return (
    <div
      aria-hidden={!visible}
      style={{
        display: visible ? "flex" : "none",
        flexDirection: "column",
        height: "100vh",
      }}
    >
      <Dashboard
        visible={visible}
        onSelect={(p: Patient) => navigate(`/patients/${p.id}`)}
        onAbout={() => navigate("/about")}
      />
    </div>
  )
}

function PatientDetailPage() {
  const { id } = useParams()
  return <PatientDetail key={id} />
}

function AboutRoute() {
  const navigate = useNavigate()
  return <AboutPage onBack={() => navigate("/")} />
}

function AppRoutes() {
  return (
    <>
      <DashboardLayer />
      <Routes>
        <Route path="/" element={null} />
        <Route path="/patients/:id" element={<PatientDetailPage />} />
        <Route path="/about" element={<AboutRoute />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
