import { Activity, FlaskConical, UserCircle, TrendingUp } from "lucide-react"
import type { Agent } from "../types"

export default function AgentIcon({ type }: { type: Agent["icon"] }) {
  const icons = {
    vitals: <Activity size={16} />,
    labs: <FlaskConical size={16} />,
    risk: <UserCircle size={16} />,
    history: <TrendingUp size={16} />,
  }
  return icons[type]
}

