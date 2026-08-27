# Nightingale 6:55 demo script

This is a click-by-click script for the current clinical workspace at
`http://127.0.0.1:3000/#tasks`. The spoken track is in English so it can be read
verbatim during the demo; operator directions are in Chinese and are not
spoken.

## Before the clock starts

Do this before every full rehearsal so the scores, version numbers, comments,
tasks and timeline count are reproducible.

1. Stop the app. First prepare the evidence tabs so no long-running command is
   needed during the demo:

   ```bash
   npm run verify
   npm run archive:preview
   ```

2. Preserve the completed command output in two terminal tabs. Open
   `reports/latest-benchmark.json` in a third tab; the current report contains
   `p95Ms: 12.01`, `targetP95Ms: 300` and `passed: true`.
3. Reset only the synthetic demo database, then start the app:

   ```bash
   npm run db:seed
   npm run dev
   ```

4. Open `http://127.0.0.1:3000/#tasks`, select **Clinician · Dr Evan Lim**, then
   scroll to the top. After a clean seed, the page starts with 3 Glance signals,
   2 open tasks and 7 timeline entries. The prepared terminal tabs should be:

   - **Evidence:** the completed final lines of `npm run verify`.
   - **Archive:** the completed output of `npm run archive:preview`.
   - **Benchmark:** the already-open `reports/latest-benchmark.json`.

5. Keep this text ready for the two manual inputs:

   - Staff note: `Patient confirmed Friday spirometry; transport support requested.`
   - Comment: `Please review the worsening nightly cough before Friday spirometry.`
   - Patient update: `My cough woke me twice last night.`

6. Use browser zoom 100%. Keep the role selector and top command bar visible.
   After the demo, switch to **Admin · Sara Chen** and use **Reset demo**, or run
   `npm run db:seed`, to remove all live demo mutations.

## 0:00–1:35 — Problem, Glance and exact provenance

| Time | Operator action — do not say | Spoken track — say this | Expected screen evidence |
| --- | --- | --- | --- |
| 0:00–0:12 | 页面停在 Clinician 顶部；鼠标圈过 **Synthetic data**、`Live clinical workspace` 和患者栏。 | “This is synthetic data only. Nightingale is not another note editor; it is a live, shared and trustworthy patient story.” | `Synthetic data`, live connection state, Maya Tan, Central Clinic and the clinician role are visible. |
| 0:12–0:25 | 鼠标移到 **What needs attention now**，不要点击。 | “The first design goal is simple: a clinician should know what needs attention in under ten seconds.” | The three compact Glance rows remain together on screen. |
| 0:25–0:45 | 依次指向 **Critical risk**, **Open action**, **Recent change**；最后停在每行右侧的 `pts`。 | “The Glance separates a prescribing risk, an unresolved action, and a recent symptom change. These points are deterministic ranking points, not model confidence.” | Allergy, lab order and worsening night cough are visible with their plain-language reasons. |
| 0:45–1:00 | 点击第三行 **Night cough increased…** 的主体，不点 Source；指向右侧 **Selected signal**。 | “Selecting a signal keeps its reason and the human controls in context. Nothing here silently edits the patient record.” | The cough row is selected and the right rail updates to the respiratory signal. |
| 1:00–1:22 | 点击该行最右侧 **Source · v1**。按顺序指向 `Entry entry-ai-patient`, `Version 1`, `Version ID version-ai-patient-1`, `Span 16–67`, `Artifact artifact-ai-patient-1`, `Session ai-session-20260825-0842`, full source and exact span。 | “Now I can verify the claim. The interface exposes the source Entry, immutable Version ID, source artifact, exact offsets, session reference, full stored source, and the exact referenced slice.” | Modal title is **Verified provenance pointer**. Both IDs are visibly rendered and the exact slice reads `night cough increased from twice weekly to nightly,`. |
| 1:22–1:35 | 点击 **Jump to timeline entry**；鼠标指向 `Nightingale AI`, `Ai Patient Session Summary`, `v1`, `AI source preserved`。 | “The pointer lands on a distinct AI patient-session entry. AI authorship and the preserved source stay visible; the summary never masquerades as a clinician-authored fact.” | The provenance modal closes and the Patient Context timeline card is centred. |

## 1:35–2:10 — Deterministic Mock scribe

| Time | Operator action — do not say | Spoken track — say this | Expected screen evidence |
| --- | --- | --- | --- |
| 1:35–1:55 | 滚回患者栏，点击 **Mock scribe**。打开 **Interaction type**，保留 **Patient self-report**；再指向 `Provider: deterministic local mock`、`No external transmission` 和预填文本中的 name/ID/phone。 | “The mock supports patient, clinician and nurse interactions. For this patient self-report, the synthetic transcript contains a name, a Singapore ID and a phone number. Those identifiers are redacted before the provider boundary; no network, LLM, or API key is used.” | Modal title is **Mock scribe · local provider**; the three interaction types and prefilled synthetic transcript are visible. |
| 1:55–2:10 | 点击 **Redact & ingest**；等待弹窗关闭和成功提示；指向新出现的顶部 **Scribe Summary**。 | “The raw synthetic source is encrypted locally. The provider receives redacted tokens, and the resulting AI entry remains traceable back to that source.” | Success notice says PHI was redacted. New Scribe Summary shows `[NAME]`, `[ID]`, `[PHONE]`, `Nightingale AI` and `AI source preserved`. |

## 2:10–3:35 — Staff collaboration and task ownership

| Time | Operator action — do not say | Spoken track — say this | Expected screen evidence |
| --- | --- | --- | --- |
| 2:10–2:18 | 右上角色下拉选择 **Staff · Aisha Rahman**，等加载完成。 | “Now I switch to the care coordinator. The same story is visible, but write ownership changes with the role.” | Role selector and timeline edit controls update to Staff. |
| 2:18–2:40 | 点击患者栏 **Add care note**；输入 staff note；点击 **Create version 1**。 | “Aisha adds a coordination update. This creates a staff-owned Entry with its own first immutable version; it cannot overwrite a clinician section.” | Modal explicitly says it creates a new staff section. Success notice says the note has a traceable first version. |
| 2:40–2:58 | 点击顶部命令栏 **Tasks**；在右侧 **Care coordination** 勾选 **Confirm spirometry slot**。 | “Tasks stay outside prose because work state needs an explicit owner and status. Completing one task changes the open count from two to one without rewriting the source note.” | Checkbox becomes checked, its label is struck through and the open count falls to 1. |
| 2:58–3:20 | 点击顶部 **Comments**，确认列表只剩含评论的 Entry；切回 **Timeline**，滚到刚生成的 **Scribe Summary**；点击其中 **Comment**；输入 comment；点击 **Comment & assign**。 | “Comments is now a real filtered view, not a duplicate link. Internal discussion stays attached to the exact Entry. From Staff, this new thread is assigned to the clinician and never enters the patient response.” | **Comments** has the active indicator and initially shows only commented Entries; after returning to Timeline, the new comment appears as `Aisha Rahman → Dr. Evan Lim` with status `open`. |
| 3:20–3:28 | 在新评论下点击 **Resolve**，等待状态变 `resolved`；再点击 **Reopen**。 | “Resolution is explicit and reversible, so the coordination state is auditable instead of disappearing into chat.” | Button and status change from Resolve/open to Reopen/resolved, then back to Resolve/open. |
| 3:28–3:35 | 滚到 **Assessment Plan**；指向只有 **Version history** 和 **Comment**、没有 **Edit owned section**。 | “Notice that Staff is not even offered an edit control for the clinician plan. The real HTTP test also verifies a forced write is rejected with 403 `ROLE_OWNERSHIP_REQUIRED`.” | Staff-owned cards have Edit; the clinician Assessment Plan does not. Do not say that you clicked a denied edit—the current UI intentionally exposes no such button. |

## 3:35–4:58 — Immutable versions and deterministic conflict handling

| Time | Operator action — do not say | Spoken track — say this | Expected screen evidence |
| --- | --- | --- | --- |
| 3:35–3:43 | 角色切回 **Clinician · Dr Evan Lim**。 | “Back as the clinician, Dr Evan can edit only clinician-owned sections.” | **Edit owned section** reappears on Assessment Plan and Instructions. |
| 3:43–4:05 | 在 **Assessment Plan** 点击 **Edit owned section**；把光标移到末尾，追加 ` Schedule review after spirometry.`；点击 **Save new version**。 | “This save sends the version I started from as `baseVersion`. The server appends a new encrypted snapshot only if that version is still current.” | Modal warns about optimistic locking; success notice says **New immutable version saved.** Assessment Plan advances from v2 to v3. |
| 4:05–4:28 | 点击左侧 **History**，确认只显示有多个版本的 Entry；在 Assessment Plan 点击 **Version history**；指向 Version 3、Version 2、Version 1，以及 **Added text / Removed text** 图例和绿色/红色 diff。 | “History is a filtered view of versioned Entries. The modal keeps full snapshots and word-level changes: green is added text, red is removed text, and the labels preserve that meaning beyond colour alone.” | **History** has the active indicator. Modal title is **Immutable history · Assessment Plan** and all versions are listed newest first with a labelled change legend. |
| 4:28–4:42 | 在 **Version 2** 下点击 **Revert by creating a new version**；等待弹窗关闭；指向成功提示和卡片新版本号。 | “Revert is append-only. Restoring version two creates version four; it does not delete versions three, two, or one.” | Success notice confirms Version 2 was restored as a new version; current card is v4. |
| 4:42–4:58 | 切到预先准备的 Evidence terminal，定位 `test_concurrent_edits.py` 的两个通过项；不要现场启动测试。 | “The concurrency micro-test proves the boundary: writes to different Entry IDs both return 200, while two saves from the same `baseVersion` produce one 200 and one deterministic 409. The 409 UI preserves the losing draft beside the current server text.” | Prepared test output shows both concurrency tests passed. If the terminal is not ready, keep the browser visible and say the same sentence without switching. |

## 4:58–5:16 — Human feedback, re-ranking and undo

| Time | Operator action — do not say | Spoken track — say this | Expected screen evidence |
| --- | --- | --- | --- |
| 4:58–5:16 | 切回浏览器；点击顶部 **Care note**；选中 **Night cough increased…**；记住当前 `pts`，点击 **Reject**，立刻点击成功提示中的 **Undo reject**。 | “Reject lowers the clinic-scoped respiratory weight by two and removes the suggestion from Glance, but a slip is reversible. Undo restores the suggestion and applies the inverse plus-two adjustment. Both actions remain auditable.” | Reject removes the row and exposes **Undo reject**. Undo restores the row at its original score and the notice confirms restoration. |

## 5:16–5:58 — Patient-safe response and clinic scope

| Time | Operator action — do not say | Spoken track — say this | Expected screen evidence |
| --- | --- | --- | --- |
| 5:16–5:42 | 角色切换为 **Patient · Maya Tan**；点击 **Share an update**，输入 patient update，点击 **Create version 1**；指向新增内容和 **Private by construction**。 | “The patient receives a separate allowlisted response: care-team instructions plus patient-authored updates. This update remains visible after creation, while Glance, raw AI notes, internal notes, comments, tasks and audit data are absent from the payload—not hidden with CSS.” | The instruction and new patient update are both visible after reload; no internal workspace sections appear. |
| 5:42–5:58 | 角色切换为 **North clinic staff · scope test**；指向 **Record unavailable** 和 404 explanation；随后切回 Clinician。 | “A staff member from another clinic gets 404, not a permission-shaped patient record. That prevents the other clinic from confirming that Maya exists here at all.” | Page states that the 404 intentionally hides cross-clinic objects. Return to Clinician before continuing. |

## 5:58–6:28 — Longitudinal context and cold archive

| Time | Operator action — do not say | Spoken track — say this | Expected screen evidence |
| --- | --- | --- | --- |
| 5:58–6:10 | 点击顶部 **Timeline**；向下滚动，先停在 **Follow Up · 6 Feb**，再停在 **Historic Admin · 15 Apr**。 | “The record remains longitudinal, but prioritisation decays safely. Recent symptoms, open actions, clinician-confirmed facts and allergies outrank this old, resolved administrative note.” | February 2026 follow-up and April 2025 Historic Admin are visible in chronological context. |
| 6:10–6:28 | 切到预先准备的 Archive terminal；指向 `PREVIEW: 1`, `entry-archive-candidate v1` 和 `No data changed`。 | “The archive command is preview-only by default. It finds one old, low-risk, resolved candidate and changes nothing. Explicit apply writes gzip plus AES-256-GCM, verifies SHA-256, and keeps metadata and provenance hot. Critical risk, open work, pinned or accepted evidence, allergies and corrections are excluded.” | Terminal shows one candidate and **No data changed**. Do not run `archive:apply` during the demo. |

## 6:28–6:55 — Evidence and close

| Time | Operator action — do not say | Spoken track — say this | Expected screen evidence |
| --- | --- | --- | --- |
| 6:28–6:42 | 切到 Evidence terminal 的 `npm run verify` 最终结果，再切到 `reports/latest-benchmark.json`；指向 `p95Ms`, `targetP95Ms`, `passed`。 | “The acceptance gate covers lint, types, unit tests, ten real-HTTP cases, a ciphertext scan and a production build. It now includes patient write visibility and reject-undo recovery. The recorded 200-request benchmark reports 12.01 millisecond P95 against a 300 millisecond gate.” | Verify is complete; benchmark shows P95 12.01, target 300 and `passed: true`. |
| 6:42–6:55 | 回到浏览器完整 clinical workspace；停止点击，面向听众收尾。 | “I spent the 72-hour budget on trust boundaries, ownership, history, provenance and reproducibility. Voice capture and a real model stay outside the core until those boundaries are production-ready.” | End on the clinician workspace, with the patient story and trust rail visible. |

## Recovery lines for a live demo

- **A mutation is slow:** “The mutation is transactional; while it completes, notice that the UI keeps the current role and source context visible.” Then wait—do not click twice.
- **The page is no longer at the expected score or version:** “This environment preserves prior demo feedback. The invariant is the delta: reject subtracts two, undo adds two, and revert appends one new version.” Continue using the number on screen.
- **The provenance modal does not open:** “The same pointer is covered by the real-HTTP provenance test, which verifies that the stored offsets resolve exactly to the displayed source span.” Move on after five seconds.
- **You are more than 20 seconds behind:** Skip the live task checkbox and the resolve/reopen clicks. Keep the staff note, source modal, role separation, version history and closing evidence.
- **You finish early:** Reopen Assessment Plan **Version history** and spend the remaining time on the green/red word diff. Do not improvise a second mutation.

## Optional evaluator follow-ups after the 6:55 clock

| Time | Operator action — do not say | Spoken track — say this | Expected screen evidence |
| --- | --- | --- | --- |
| 0:00–0:10 | 切换为 **Admin · Sara Chen**；点击 **Audit trail**。 | “Audit access is a separate admin capability, not part of the clinician or patient payload.” | Admin-only audit modal opens and lists newest events first. |
| 0:10–0:25 | 展开视线依次扫过 action、actor、entity ID、version transition 和 metadata；点击 **Refresh**。 | “The audit view contains identifiers, transitions and safe metadata, but no decrypted clinical free text.” | Refresh completes; entries remain metadata-only. |
| 0:25–0:40 | 关闭 Audit；点击 **Reset demo**，读出警告后点击 **Reset synthetic data**。 | “Reset is deliberately development-only and admin-only. It replaces synthetic edits, feedback and sessions with the clean reproducible seed.” | The reset modal warns what will be replaced; the page returns to Clinician with 3 Glance signals, 2 open tasks and 7 timeline entries. |
