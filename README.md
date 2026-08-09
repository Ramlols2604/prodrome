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
- [x] Judge agent — deterministic dissent score + LLM narration
  (validation-only). Parallel `asyncio.gather` of all four specialists.
- [ ] `agents/orchestrator.py` — FastAPI SSE endpoint over the existing
  gather + Judge pipeline

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

## Evaluation

**Persistence filtering.** A 2-of-3-hour persistence filter was evaluated as a targeted intervention for transient WATCH+ false positives. The baseline WATCH+ rule had 100.0% sensitivity and 2.7% specificity; applying persistence reduced sensitivity to 92.7% while increasing specificity to 12.7% and reducing false positives from 146 to 131. Median lead time increased from 17 to 20 hours. DETERIORATING+ and CRITICAL performance were unchanged, since those tiers already require sustained multi-signal agreement across the full window.

A subsequent case-level review of the 59 septic cases affected by persistence showed that the apparent sensitivity loss was heterogeneous. Forty cases (67.8%) involved isolated one-hour abnormalities, and another 10 (16.9%) were borderline two-hour patterns that failed the exact 2-of-3 requirement. Nine cases (15.3%) represented genuine early signals that were temporarily suppressed by the trailing-window requirement; importantly, all nine were eventually detected under persistence, with a mean lead-time loss of 4.95 hours and median loss of 3 hours.

Eleven septic cases were never assigned WATCH+ under persistence. These cases also did not reach DETERIORATING+ or CRITICAL under the evaluated rules, and most had negative baseline lead time, suggesting that many represented low-value late WATCH+ alerts rather than clinically useful early detections. One important exception was a case in which a single abnormal laboratory draw provided a 15-hour pre-onset warning that persistence eliminated. This illustrates a structural limitation: the 2-of-3 rule implicitly assumes roughly hourly observation, which holds for vitals but not for sparsely-drawn labs — a single significant lab abnormality cannot satisfy any persistence requirement if no second draw occurs to persist across. This is a sampling-frequency mismatch, not merely a threshold-tuning issue, and is a natural candidate for a separate, lab-specific persistence rule in future work.

Overall, persistence represents a defensible operating-point change with a characterized tradeoff rather than a universal solution to false-positive detection. The 2-of-3 filter removes a meaningful portion of WATCH+ false positives while preserving higher-severity rule behavior and retaining eventual detection for the identified genuine early-signal cases. Sensitivity did fall (100.0% → 92.7%); the tradeoff was investigated and found mostly favorable, with some loss of early warning time, particularly for isolated laboratory abnormalities.

**Dissent validation.** All 300 evaluation patients were bucketed by maximum dissent score reached during their encounter, and the actual septic rate within each bucket was measured against ground truth. The main comparison is Mild disagreement (0–33.3, n=224, 46.0% septic) vs Major disagreement (>33.3, n=72, 65.3% septic): septic rate rose monotonically, a 19.3 percentage-point difference between these well-populated buckets. (A Consensus bucket at dissent 0, n=4, had a 0% septic rate; that figure is a descriptive footnote only and is not part of the trend claim.) Notably, mean maximum severity barely differed between the Mild and Major buckets (1.00 vs. 1.26), while septic prevalence differed substantially. This suggests disagreement is not simply tracking overall case severity, but capturing something closer to genuine clinical heterogeneity or diagnostic ambiguity associated with septic outcome. Combined with the persistence-filtering results, a coherent picture emerges: the deterministic rules identify a broad population with physiological abnormality; persistence filtering removes a meaningful share of transient false positives; and among the remaining, harder-to-classify cases, the hypothesis that disagreement contains outcome-relevant information is supported by the evaluation, though this establishes association rather than independent predictive value beyond severity alone (see Phase B below). The dissent score is not validated for calibration or causal interpretation, and should not be treated as a production-ready risk score without further work.

### Upcoming

- [x] Judge agent synthesis + dissent score (Week 3)
- [x] Evaluation against PhysioNet ground-truth sepsis labels (Week 4 /
  Phase A)
- [ ] Phase B: test whether dissent has independent predictive value
  beyond severity; calibration of dissent as a confidence measure
- [ ] Deployment: Railway/Render (backend), Vercel (frontend),
  Postgres/Supabase (trajectory storage)
- [ ] Frontend

See `data-service/README.md` for setup instructions for that piece.
