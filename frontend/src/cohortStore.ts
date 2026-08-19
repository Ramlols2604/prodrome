import type { Patient } from "./types"
import { fetchNarrationConsistency, fetchSummaries, summaryToPatient, type NarrationConsistency } from "./api"

export interface CohortSnapshot {
  patients: Patient[]
  consistency: NarrationConsistency | null
  loadedAt: number
}

let snapshot: CohortSnapshot | null = null
let inflight: Promise<CohortSnapshot> | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const fn of listeners) fn()
}

export function getCohortSnapshot(): CohortSnapshot | null {
  return snapshot
}

export function subscribeCohort(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** Shared in-memory cohort. Dedupes in-flight fetches (including React Strict Mode). */
export function loadCohort(): Promise<CohortSnapshot> {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const [rows, consistency] = await Promise.all([
        fetchSummaries(),
        fetchNarrationConsistency().catch(() => snapshot?.consistency ?? null),
      ])
      snapshot = {
        patients: rows.map(summaryToPatient),
        consistency,
        loadedAt: Date.now(),
      }
      emit()
      return snapshot
    } finally {
      inflight = null
    }
  })()
  return inflight
}
