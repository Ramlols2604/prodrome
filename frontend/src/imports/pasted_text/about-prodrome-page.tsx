Design an "About Prodrome" page, matching the exact dark clinical/
research aesthetic already established in the ICU Patient Monitor 
dashboard (dark slate background, Inter/IBM Plex Sans for UI text, 
monospace font for all numeric/data values, severity color system: 
green=stable, amber=watch, orange=deteriorating, red=critical -- 
reserve these four colors ONLY for their actual severity meaning, do 
not reuse decoratively on this page).

Same top nav as the dashboard (Prodrome wordmark, logo). Add "About" 
as a nav link/tab alongside the existing dashboard view.

SECTIONS, IN ORDER:

1. HERO
   - "Prodrome" wordmark
   - Pitch line: "A multi-agent deterioration-detection system for ICU 
     patients, built to test whether structured disagreement between 
     independent evidence channels contains outcome-relevant 
     information beyond a single risk score."
   - Small pill/tag, neutral gray: "Research / portfolio project — not 
     a validated clinical tool"

2. PROBLEM STATEMENT
   - Short paragraph: existing single-score clinical deterioration 
     alert tools are widely criticized for high false-positive rates 
     and opaque scoring, causing alert fatigue and clinician distrust. 
     Prodrome's approach: four independent specialist agents assess a 
     patient separately; disagreement between them is surfaced 
     explicitly rather than averaged into one opaque number.

3. WHAT IS SOLVED — use a two-column layout, this section vs. 
   "What is not solved" (section 6) should visually mirror each other 
   so readers see them as a matched pair, not sequential unrelated lists
   
   Present as 4 distinct cards or a clean list, each with a bold 
   headline finding and 1-2 sentence supporting detail:
   
   - "Deterministic, auditable classification" — Python rules, not LLM 
     judgment, for vitals/labs/demographic risk, after testing showed 
     LLMs unreliably compare raw numeric thresholds even when given 
     correct data.
   
   - "Validated against 300 real ICU encounters" — naive severity 
     thresholds alone cause alert fatigue (WATCH+: 100% sensitivity, 
     2.7% specificity). A persistence filter (2-of-3 consecutive 
     abnormal hours) improved specificity to 12.7% with 81% of affected 
     cases delayed rather than missed.
   
   - "Committee disagreement is a validated signal" — dissent score is 
     empirically associated with septic outcome and outperforms raw 
     severity as a predictor (AUROC: severity alone 0.536, dissent 
     alone 0.583). Association, not a calibrated confidence measure.
   
   - "True parallel agent execution" — four agents run concurrently via 
     asyncio, with LLM narration strictly separated from verdict 
     computation: Python decides, the LLM explains.

4. ARCHITECTURE DIAGRAM
   Simple horizontal flow diagram, clean boxes and arrows, monospace 
   labels:
   PhysioNet Data → [4 parallel boxes: Vitals / Labs / Demographic-Risk 
   / Historical Pattern, each labeled "deterministic classification"] 
   → Judge [labeled "deterministic dissent score + LLM synthesis"] → 
   Output
   Use a subtle visual distinction (e.g. solid border = deterministic 
   Python, dashed border = LLM-involved) so the diagram itself teaches 
   the "code decides, LLM explains" principle.

5. TECH STACK — clean grid/table grouped by layer, monospace for 
   technology names:
   - Data layer: FastAPI, SQLite, PhysioNet/CinC Challenge 2019 dataset 
     (40,336 real ICU encounters)
   - Agent orchestration: Python asyncio, Groq (Llama models)
   - Prototyping: n8n (used to validate agent prompts before the 
     Python port; not part of the production architecture)
   - Evaluation: scikit-learn, statsmodels, pandas, LightGBM
   - Testing: pytest (30+ unit tests on deterministic classification 
     logic)
   - Frontend: [React/Figma-implied stack]

6. WHAT IS NOT SOLVED — mirror section 3's card layout exactly, same 
   visual weight (do not make this smaller or less prominent -- this 
   honesty is a real strength of the project)
   
   - "Not clinically validated" — not FDA-cleared, not intended for 
     real patient use.
   - "Dissent is association, not calibration" — no independent/
     external validation of the dissent-outcome relationship yet.
   - "No forecasting capability" — investigated directly (see below); 
     the system classifies current state, it does not predict future risk.
   - "Sparse-lab persistence gap" — a single significant lab 
     abnormality can't satisfy a multi-observation persistence rule, a 
     known limitation for sparsely-drawn labs.

7. FORECASTING INVESTIGATION — this deserves its own distinct section, 
   visually set apart (e.g. a bordered "research finding" card, similar 
   treatment to the Judge Synthesis panel style from the dashboard), 
   NOT folded quietly into limitations, because it's a real 
   investigation with a real answer:
   
   Headline: "Can Prodrome forecast future risk? We investigated — and 
   found a clear answer: not yet, with this data."
   
   Body: A multi-stage investigation into 6-hour-ahead sepsis 
   forecasting progressed from coarse features (AUPRC 0.034) to 123 
   engineered temporal features (lags, deltas, slopes, rolling stats), 
   evaluated on 38,838 patients with proper patient-level splits and 
   calibration. Temporal features improved raw discrimination (AUROC 
   0.630 → 0.726), but an ablation study showed this was substantially 
   explained by time-in-encounter rather than physiological signal — a 
   3-feature demographic/time model matched the full model's AUPRC. 
   Hand-engineered deterioration-interaction features still did not 
   beat this baseline in the clinically relevant 2-6 hour pre-onset 
   window (0.019 vs. 0.028). Patient-level evaluation showed a median 
   46-hour lead time, inconsistent with genuine near-term forecasting.
   
   Closing line, slightly emphasized: "Conclusion: physiological 
   trajectory data did not demonstrate forecasting value beyond 
   baseline demographic/temporal risk with this dataset and feature 
   set. This is a real, evidence-backed negative result — not an 
   unexplored gap."

8. FUTURE SCOPE — clearly a roadmap, distinct visual treatment from 
   "what is solved" (e.g. outlined/dashed cards vs. solid cards, 
   signaling "not built yet")
   - External validation of the dissent-outcome finding on a held-out 
     cohort
   - Lab-specific persistence rules accounting for sparse sampling
   - Higher-resolution and intervention-rich datasets (MIMIC-IV, 
     eICU-CRD, HiRID) — these require CITI training and a data use 
     agreement, and would test whether intervention-response and 
     higher-resolution data support genuine short-horizon forecasting; 
     not pursued in this investigation
   - Baseline model comparison (logistic regression / gradient 
     boosting) to test whether the multi-agent architecture outperforms 
     simpler approaches
   - Full frontend with historical hour scrubbing

9. LINKS
   - GitHub repo link (prominent, icon + text)
   - Back to dashboard link

TONE: precise, confident, unapologetic about limitations. The 
credibility of this page comes from stating exact numbers and honest 
negative results as plainly as the positive ones -- don't round 
favorably, don't hedge findings that are actually solid, don't soften 
findings that are actually negative.