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

- [x] `data-service/` — built and tested against real (and synthetic)
      PhysioNet-format data
- [ ] Agent committee (prototyped in n8n, then ported to Python)
      - [x] Vitals Agent (n8n prototype) — complete; threshold-comparison
            moved from the LLM prompt into deterministic flags in
            `data-service/main.py` after unreliable numeric reasoning
            on both a local 8B model and Groq's 70B. Validated on
            known-stable p000001 and known-critical p000003.
      - [x] Lab Agent (n8n prototype) — complete; same pattern as Vitals:
            verdict classification moved from the LLM prompt into
            deterministic Python (`compute_labs_verdict` in `main.py`)
            after the LLM misapplied its own explicit rules even on
            correctly pre-flagged data. LLM role is narration only,
            citing `computed_verdict`. Known limitation: narration
            sometimes cites slightly imprecise supporting hour-counts
            even when the final verdict is correct — an LLM evidence-
            citation issue, not a correctness issue.
      - [x] Demographic/Risk Agent (n8n prototype) — complete; baseline
            risk level computed deterministically in `main.py`
            (`compute_baseline_risk`), LLM narration/context only.
            Outputs a BASELINE RISK level (not STABLE/WATCH/
            DETERIORATING/CRITICAL) for the Judge to weigh other
            agents against. Validated on p000003 (age 71 → ELEVATED),
            clean output, no correction needed.
      - [x] Historical Pattern Agent (n8n prototype) — complete,
            including cohort comparison. Deterministic `trend_analysis`
            in `get_trajectory_so_far`; `get_cohort_outcomes` already
            had `sample_size` safety. Earlier cohort-tool failures were
            an n8n `$fromAI` typing bug: untyped/string `min_lactate`
            with an uninformative auto-generated name let the model
            pass non-numeric text. Fixed by naming it
            `min_lactate_threshold`, describing it clearly, and typing
            it as number. Validated E2E on p000003: 48 hours, 18
            sepsis-labeled, WORSENING on all four signals, and
            `get_cohort_outcomes` called with a sensible threshold
            (2/2 septic + small-sample caveat).
      All four specialist agents are built and validated in n8n
      (deterministic data-service + LLM narration only). Next:
      Judge agent synthesis + dissent score (Week 3).
- [ ] Evaluation against labeled ground truth
- [ ] Deployment (Railway/Render for backend, Vercel for frontend)
- [ ] Frontend

See `data-service/README.md` for setup instructions for that piece.
