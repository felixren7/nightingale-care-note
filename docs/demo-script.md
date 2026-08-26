# 5–7 minute demo script

## 0:00–0:35 — Frame the problem

Open the clinician view. State: “This is synthetic data. The goal is not another note editor; it is a shared, trustworthy patient story where a clinician can understand what needs attention in under ten seconds.” Point to the three visible Glance cards and their risk/action/change labels.

## 0:35–1:45 — Scenario A: Glance + AI provenance

Read the critical allergy, lab action, and worsening cough. Explain the small score as deterministic rather than model confidence. Click **Verify source · v1** on the cough card. Show the exact Entry ID, immutable Version ID, offsets, session reference, full source, and exact slice. Click **Jump to timeline entry**; point out `Nightingale AI`, the distinct `ai_patient_session_summary` type, and “AI source preserved.”

Open **Mock scribe**. Use the prefilled synthetic name, ID, phone, and symptom. Click **Redact & ingest**. Explain that the raw synthetic source is encrypted locally, while the provider receives `[NAME]`, `[ID]`, and `[PHONE]`. No key, LLM, or network call is used.

## 1:45–3:35 — Scenario B: collaboration, versions, conflict, learning

Switch to Staff. Add a staff note: “Patient confirmed Friday spirometry; transport support requested.” Add a comment on the AI entry, assign it to the clinician, then resolve/reopen it. Try editing the clinician plan—or mention the automated test—and show that the server denies role overwrite.

Switch to Clinician. Edit the clinician-owned plan and save. Open **Version history**: show full snapshots and green/red word changes. Revert to an earlier version; point out that revert creates a new version rather than deleting history.

For concurrency, open a second window before the demo or reference the micro-test: different Entry IDs both succeed; two saves with the same `baseVersion` produce one 200 and one deterministic 409, preserving the losing draft for comparison.

On the respiratory AI highlight, note its score, click **Pin**, and show the success message. The clinic-scoped `topic:respiratory` weight increases by 2 and similar suggestions re-score. Accept/reject/pin is human control, not silent reinforcement.

## 3:35–4:35 — Patient and scope separation

Switch to Patient. Show that only care instructions remain; Glance, raw AI notes, tasks, comments, internal notes, and audit are absent from the server response. Switch to **North clinic staff**: Maya becomes a 404 so the other clinic cannot even confirm the record exists. Return to Clinician.

## 4:35–5:35 — Scenario C: longitudinal context + decay

Scroll the timeline from today through February 2026 to the April 2025 historic administrative note. Explain prioritization: recent symptoms, open tasks, clinician-confirmed facts, and allergies outrank old resolved administration.

In a terminal run `npm run archive:preview`: one old, low-risk, resolved candidate is listed and no data changes. Explain that explicit `archive:apply` creates gzip + AES-256-GCM, verifies SHA-256, and leaves metadata/provenance hot. Critical risks, allergies, open tasks, accepted/pinned highlights, and corrections are never auto-archived.

## 5:35–6:20 — Evidence and close

Show `npm run verify` results: unit tests, eight real-HTTP Python assertions, ciphertext scan, and production build. Show `reports/latest-benchmark.json` and the P95 gate below 300 ms. Close with the main trade-off: “I spent the 72-hour budget on trust boundaries, history, provenance, and reproducibility. Voice and a real model stay outside the core until those boundaries are production-ready.”
