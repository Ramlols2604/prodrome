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
      - Vitals Agent (n8n prototype) — working, tool-calling to
        data-service confirmed
- [ ] Evaluation against labeled ground truth
- [ ] Deployment (Railway/Render for backend, Vercel for frontend)
- [ ] Frontend

See `data-service/README.md` for setup instructions for that piece.
