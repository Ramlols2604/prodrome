# Prodrome

Multi-agent early deterioration detection for ICU patients. Instead of
a single black-box risk score, a committee of specialist agents reads
a patient's hourly vitals and labs, debates independently, and a Judge
agent synthesizes a verdict plus a **dissent score** — how much the
agents disagreed. High dissent is the signal that a human needs to
look, not a case to average away into a middling number.

Built on the openly available PhysioNet/CinC Challenge 2019 sepsis
prediction dataset (no credentialing required), so results can be
validated against real labeled outcomes rather than shown as an
unvalidated demo.

> This is a research/portfolio project running on retrospective data.
> It is not a validated clinical tool and is not intended for use on
> real patients.

## Structure

```
prodrome/
├── data-service/     # FastAPI layer serving PhysioNet patient data
│                      # (vitals, labs, demographics, cohort stats)
├── agents/            # (coming next) committee agent logic —
│                      # Vitals, Lab, Demographic, Historical Pattern,
│                      # and Judge agents
└── frontend/          # (coming later) patient timeline + live
                        # committee panel UI
```

## Status

### Data layer
- [x] `data-service/` — FastAPI backend serving PhysioNet-format patient
  data (vitals, labs, demographics, trajectory), with deterministic
  flag computation and verdict classification. Built and tested against
  both synthetic and real-format data.

### Specialist agent committee

All four agents were prototyped and validated in n8n before being
ported to Python. Each follows the same architectural pattern:
**classification is computed deterministically in `data-service/main.py`;
the LLM's role is narration and evidence synthesis only.** This pattern
emerged directly from testing — see *Key Finding* below.

| Agent | Status | Notes |
|---|---|---|
| Vitals | ✅ Complete | Validated on known-stable (`p000001`) and known-critical (`p000003`) patients |
| Lab | ✅ Complete | Validated on `p000001` (STABLE) and `p000003` (CRITICAL) |
| Demographic/Risk | ✅ Complete | Outputs a `BASELINE RISK` level (LOW/MODERATE/ELEVATED/HIGH), not a rule-based STABLE/WATCH/DETERIORATING/CRITICAL classification — used as context for the Judge, not a vote |
| Historical Pattern | ✅ Complete | Validated end-to-end including population cohort comparison |

### Key finding: LLM threshold reasoning is unreliable, even with correct data

Initial agent prompts asked the LLM to compare raw values against
stated project-defined thresholds (e.g. "is HR > 100?") directly in natural
language. Testing against known-stable and known-deteriorating patients
surfaced consistent failures:

- **Vitals Agent**: misread values well within normal range as abnormal
  (e.g. called HR 83 "tachycardia" when the stated threshold was 100),
  on both a local 8B model (Ollama `llama3.1:8b`) and Groq's 70B model.
- **Lab Agent**: correctly read pre-flagged data but misapplied its own
  explicit classification rule, downgrading a verdict that should have
  triggered CRITICAL by its own stated criteria.

**Fix:** moved all threshold comparison and verdict classification into
deterministic Python functions (`compute_vitals_verdict`,
`compute_labs_verdict`, `compute_baseline_risk`, `compute_trajectory_trend`
in `data-service/main.py`). Each data-service response now includes
pre-computed `flags` and a `computed_verdict`. Agent prompts were
rewritten so the LLM's only job is to explain, in plain language,
why the rule-based classification matches the flagged data — never to
derive it. This made every subsequent agent's output reliably consistent
with the defined ruleset on the same test patients.

These numeric cutoffs (HR > 100, MAP < 65, lactate > 2.0, etc.) are
**project-defined rules for a research/portfolio system**, not clinically
validated decision criteria. HR, MAP, lactate, and related signals are
clinically meaningful vitals/labs to track; the specific thresholds and
STABLE/WATCH/DETERIORATING/CRITICAL mapping are ours.

**Known limitation:** even in a narration-only role, LLM output
occasionally cites slightly imprecise supporting evidence (e.g. an
off-by-one hour count) while still landing on the correct verdict. This
is treated as an acceptable, documented limitation of LLM evidence
citation, not a correctness issue — the verdict itself is deterministic
and unaffected.

### Python port (in progress)

- [x] `agents/llm_client.py` — async Groq wrapper
- [x] `agents/vitals.py` — ported from validated n8n prototype, trusts
  `computed_verdict`. Validated: `p000003` → DETERIORATING, `p000001`
  → STABLE, matching the data-service's own classification.
- [x] `agents/labs.py` — validated: `p000003` → CRITICAL, `p000001` →
  STABLE, both `verdict_consistent=True`.
- [x] `agents/risk.py` — validated: `p000001` (age 58) → MODERATE,
  `p000003` (age 71) → ELEVATED.
- [x] `agents/historical.py` — cohort call decided in Python (lactate >
  4.0), not by the LLM. Validated: `p000001` → STABLE (no cohort call);
  `p000003` → WORSENING (cohort `min_lactate=4.0`, n=2, narration hedged).
- [ ] Judge agent — deterministic dissent score (agent verdict severity
  spread) + LLM narration, same pattern as the specialist agents
- [ ] `agents/orchestrator.py` — `asyncio.gather` parallel fan-out +
  FastAPI SSE endpoint

### Why the n8n prototype is sequential, not parallel

Running multiple agents concurrently in n8n against Groq's API caused
tool-calling failures (`Bad request — please check your parameters`,
malformed function-call syntax) under concurrent load. This is a
demonstrated limitation of n8n's chat-trigger execution model combined
with Groq's function-calling under concurrency — not a limitation of
the committee architecture itself. The n8n prototype was used to
validate each agent's prompt logic individually and is not intended to
represent production performance. **True parallel execution is restored
in the Python port** via `asyncio.gather`, which does not share this
constraint.

### Upcoming

- [ ] Judge agent synthesis + dissent score (Week 3)
- [ ] Evaluation against PhysioNet ground-truth sepsis labels (Week 4)
- [ ] Deployment: Railway/Render (backend), Vercel (frontend),
  Postgres/Supabase (trajectory storage)
- [ ] Frontend

See `data-service/README.md` for setup instructions for that piece.
