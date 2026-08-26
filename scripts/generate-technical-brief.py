import json
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
)
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Polygon


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "technical-brief.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

NAVY = colors.HexColor("#102638")
TEAL = colors.HexColor("#176A68")
MINT = colors.HexColor("#A9E6CF")
INK = colors.HexColor("#132330")
MUTED = colors.HexColor("#68757D")
LINE = colors.HexColor("#DCE3DF")
CANVAS = colors.HexColor("#F3F5F2")
RED = colors.HexColor("#B94D46")
AMBER = colors.HexColor("#C88218")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="TitleN", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=23, leading=27, textColor=NAVY, alignment=TA_LEFT, spaceAfter=8))
styles.add(ParagraphStyle(name="Deck", parent=styles["BodyText"], fontName="Helvetica", fontSize=10.5, leading=15, textColor=MUTED, spaceAfter=14))
styles.add(ParagraphStyle(name="H1N", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=15, leading=19, textColor=NAVY, spaceBefore=5, spaceAfter=7))
styles.add(ParagraphStyle(name="H2N", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=10.5, leading=13, textColor=TEAL, spaceBefore=5, spaceAfter=4))
styles.add(ParagraphStyle(name="BodyN", parent=styles["BodyText"], fontName="Helvetica", fontSize=8.4, leading=12.1, textColor=INK, spaceAfter=6))
styles.add(ParagraphStyle(name="SmallN", parent=styles["BodyText"], fontName="Helvetica", fontSize=7.3, leading=10.2, textColor=MUTED, spaceAfter=3))
styles.add(ParagraphStyle(name="Callout", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=8.2, leading=11.5, textColor=NAVY, leftIndent=8, rightIndent=8, spaceBefore=5, spaceAfter=5, borderColor=MINT, borderWidth=1, borderPadding=7, backColor=colors.HexColor("#F0F8F5")))


def header_footer(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(NAVY)
    canvas.rect(0, height - 12 * mm, width, 12 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawString(17 * mm, height - 7.7 * mm, "NIGHTINGALE 72 HOUR BUILD")
    canvas.setFillColor(MINT)
    canvas.setFont("Helvetica-Bold", 7)
    canvas.drawRightString(width - 17 * mm, height - 7.7 * mm, "SYNTHETIC DATA ONLY")
    canvas.setStrokeColor(LINE)
    canvas.line(17 * mm, 13 * mm, width - 17 * mm, 13 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7)
    canvas.drawString(17 * mm, 8.5 * mm, "Shared context · clear action · verified provenance")
    canvas.drawRightString(width - 17 * mm, 8.5 * mm, f"Technical Brief · {doc.page}/3")
    canvas.restoreState()


def arrow(drawing, x1, y1, x2, y2, color=TEAL):
    drawing.add(Line(x1, y1, x2, y2, strokeColor=color, strokeWidth=1.3))
    drawing.add(Polygon([x2, y2, x2 - 5, y2 + 3, x2 - 5, y2 - 3], fillColor=color, strokeColor=color))


def box(drawing, x, y, w, h, title, subtitle, fill=colors.white, stroke=LINE):
    drawing.add(Rect(x, y, w, h, rx=7, ry=7, fillColor=fill, strokeColor=stroke, strokeWidth=1))
    drawing.add(String(x + 8, y + h - 14, title, fontName="Helvetica-Bold", fontSize=8, fillColor=NAVY))
    drawing.add(String(x + 8, y + 8, subtitle, fontName="Helvetica", fontSize=6.4, fillColor=MUTED))


def architecture_diagram():
    d = Drawing(500, 125)
    box(d, 0, 72, 95, 42, "Care Note UI", "role-aware DTOs", colors.HexColor("#F7FCFA"), MINT)
    box(d, 132, 72, 105, 42, "Route Handlers", "auth + validation", colors.white, LINE)
    box(d, 274, 72, 105, 42, "DAL / Mutations", "RBAC + locking", colors.white, LINE)
    box(d, 416, 72, 84, 42, "SQLite WAL", "encrypted text", colors.HexColor("#FFF9EF"), colors.HexColor("#E8C988"))
    arrow(d, 95, 93, 132, 93); arrow(d, 237, 93, 274, 93); arrow(d, 379, 93, 416, 93)
    box(d, 132, 4, 105, 42, "MockScribe", "redacted input only", colors.HexColor("#F8F5FF"), colors.HexColor("#CFC2EC"))
    box(d, 274, 4, 105, 42, "Audit + Outbox", "metadata + SSE", colors.HexColor("#F7FCFA"), MINT)
    box(d, 416, 4, 84, 42, "Cold Blob", "gzip + AES + hash", colors.HexColor("#FFF9EF"), colors.HexColor("#E8C988"))
    arrow(d, 184, 46, 310, 72, colors.HexColor("#7B6BB3")); arrow(d, 326, 72, 326, 46); arrow(d, 416, 25, 379, 25, AMBER)
    return d


def schema_table():
    rows = [
        ["Cluster", "Core records", "Invariant"],
        ["Identity / scope", "Clinic, User, Session, Patient", "Opaque cookie; clinic/patient checked on every object"],
        ["Narrative", "Entry, EntryVersion", "Role owns Entry; body exists only in append-only versions"],
        ["Collaboration", "Comment, Task", "Internal fields never enter patient DTO"],
        ["AI / source", "SourceArtifact, Highlight", "System Entry remains distinct; exact version + span pointer"],
        ["Trust / learning", "Feedback, FeatureWeight, EntryRelation", "Human action is auditable; correction supersedes, never erases"],
        ["Operations", "EventOutbox, AuditEvent, ArchiveBlob", "Scoped SSE; metadata-only audit; verified transparent restore"],
    ]
    table = Table(rows, colWidths=[31 * mm, 58 * mm, 86 * mm], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 7.2),
        ("LEADING", (0, 0), (-1, -1), 9.5), ("TEXTCOLOR", (0, 1), (-1, -1), INK),
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("GRID", (0, 0), (-1, -1), .5, LINE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, CANVAS]), ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6), ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return table


def metric_cards():
    report_path = ROOT / "reports" / "latest-benchmark.json"
    if report_path.exists():
        report = json.loads(report_path.read_text())
        p50, p95, outcome = f"{report['p50Ms']} ms", f"{report['p95Ms']} ms", "PASS" if report["passed"] else "FAIL"
    else:
        p50, p95, outcome = "pending", "pending", "run bench"
    rows = [
        ["Warm path", "Measured", "Concurrency", "P50", "P95 / gate"],
        ["50 requests", "200 requests", "10", p50, f"{p95} · {outcome} < 300 ms"],
    ]
    table = Table(rows, colWidths=[35 * mm] * 5)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"), ("BACKGROUND", (0, 1), (-1, 1), colors.HexColor("#F0F8F5")),
        ("TEXTCOLOR", (0, 1), (-1, 1), TEAL), ("BOX", (0, 0), (-1, -1), .7, LINE),
        ("INNERGRID", (0, 0), (-1, -1), .4, LINE), ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return table


doc = BaseDocTemplate(str(OUTPUT), pagesize=A4, leftMargin=17 * mm, rightMargin=17 * mm, topMargin=18 * mm, bottomMargin=17 * mm, title="Nightingale Shared Care Note — Technical Brief", author="Ren Hongxu")
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="body")
doc.addPageTemplates(PageTemplate(id="main", frames=[frame], onPage=header_footer))

story = []
story += [Spacer(1, 4 * mm), Paragraph("Nightingale Shared Care Note", styles["TitleN"]), Paragraph("A local-first communication and trust system for one actionable longitudinal patient record", styles["Deck"])]
story += [Paragraph("1 · Product thesis", styles["H1N"]), Paragraph("The failure is not absence of notes; it is the time and uncertainty required to reconstruct a trustworthy patient story. Nightingale makes the Glance card a decision surface—not an AI summary. It shows at most five explainable risks, open actions, clinician-confirmed facts, and meaningful changes. Every item states why it matters and resolves to an exact immutable source span.", styles["BodyN"])]
story += [Paragraph("72-hour scope", styles["H2N"]), Paragraph("Implemented: role-owned entries, longitudinal timeline, threaded coordination, tasks, full revisions and word diffs, append-only revert, deterministic 409 conflicts, patient-safe DTOs, three scribe interaction types, exact provenance, adaptive importance, SSE, and verified cold archive. Deliberately excluded: real LLM, voice capture, transcription, diarization, multilingual audio, and EHR integration.", styles["BodyN"])]
story += [Paragraph("System architecture", styles["H1N"]), architecture_diagram()]
story += [Paragraph("One TypeScript repository contains Next.js 16 UI, Route Handlers, SSE, and authorization. Prisma + better-sqlite3 provides a typed SQLite WAL store. The browser receives a random opaque session cookie; only its hash is stored. All object access is re-authorized by clinic or patient link. Unauthorized cross-scope objects return 404.", styles["BodyN"])]
story += [Paragraph("Privacy boundary", styles["H2N"]), Paragraph("Free text is AES-256-GCM encrypted before persistence. Audit rows contain actor, action, object, version, and non-sensitive control metadata only. Scribe order is: encrypt raw synthetic source locally → redact known names, SG ID/NRIC/FIN-like values, and phones → call deterministic MockScribe with redacted text → encrypt summary and provenance. No key, model, or network request is used.", styles["BodyN"])]
story += [Paragraph("Patient safety is a server response property: patient DTOs contain only visibility=patient instructions; highlights, tasks, comments, raw AI notes, artifacts, and audit fields do not exist in the payload.", styles["Callout"]), PageBreak()]

story += [Spacer(1, 4 * mm), Paragraph("Data model and trust mechanics", styles["TitleN"]), Paragraph("The timeline stays authoritative while derived Glance signals remain explainable and reversible.", styles["Deck"]), schema_table(), Spacer(1, 5 * mm)]
story += [Paragraph("Immutable revisions and deterministic conflicts", styles["H1N"]), Paragraph("Entry stores role, owner, type, visibility, section, risk, current version, and optional source/supersession IDs. Body text exists only in EntryVersion snapshots. A write performs an atomic update where currentVersion equals baseVersion, then appends the encrypted snapshot. Different Entries succeed independently; the second writer to one Entry receives 409 VERSION_CONFLICT. The UI preserves its draft beside current server text. Revert decrypts a selected snapshot and appends a new version with revertedFromVersion; history is never deleted.", styles["BodyN"])]
story += [Paragraph("RBAC invariants", styles["H2N"]), Paragraph("Staff can create/modify only their own staff entries; clinicians only their own clinician entries while reading staff/system context; patients can access only their linked record and patient-facing entries; admin is clinic-scoped and read-only in the prototype. Comments/tasks require internal collaborator status. The browser cannot assert a role: POST /api/session accepts only seeded server IDs.", styles["BodyN"])]
story += [Paragraph("Provenance and correction", styles["H1N"]), Paragraph("A pointer is entryId + immutable versionId + character offsets + optional sourceArtifactId. Resolution repeats authorization, reads hot or cold content, validates its plaintext hash, and returns the exact slice. AI doctor, nurse, and patient sessions are distinct system Entries linked to their source session. A clinician correction creates a new Entry plus supersedes relation; the original patient/AI statement remains auditable while the corrected clinician source ranks higher.", styles["BodyN"])]
story += [Paragraph("Collaboration and realtime", styles["H2N"]), Paragraph("Encrypted threaded comments support assignment and resolve/reopen. Tasks remain separate actionable records. Each mutation writes metadata-only audit plus a patient-scoped outbox event in the same transaction. A reconnectable 25-second SSE stream queries only after patient authorization; another browser refreshes without receiving unauthorized payload fields.", styles["BodyN"])]
story += [Paragraph("Trust is built by preserving disagreement. AI suggestions can be accepted, rejected, pinned, corrected, or traced—but never silently overwrite a human-owned section.", styles["Callout"]), PageBreak()]

story += [Spacer(1, 4 * mm), Paragraph("Importance, decay and evidence", styles["TitleN"]), Paragraph("Deterministic scoring plus conservative storage automation keeps behavior inspectable under time pressure.", styles["Deck"])]
story += [Paragraph("Self-learning importance", styles["H1N"]), Paragraph("Base score combines risk (critical +40, high +25, medium +10), unresolved task (+25), clinician confirmation (+15), entity (allergy +15, medication +10, chief complaint +8), and freshness (up to +15). Accept/pin adds +2 and reject −2 to a clinic-scoped featureKey weight, bounded to [−15,15]. Matching suggestions recompute finalScore = clamp(base + learned, 0, 100). Feedback, score, reason, and source remain auditable; rejection never removes provenance.", styles["BodyN"])]
story += [Paragraph("Conservative data decay", styles["H1N"]), Paragraph("Eligible versions are older than 365 days, low-risk, have no open linked task, no accepted/pinned/high-risk highlight, and are not corrections or critical types. Preview is the default. Apply writes the original encrypted payload into gzip, encrypts it again with AES-256-GCM, rereads and hashes the blob, then marks SQL content cold. Metadata/pointers stay hot. Reads validate blob SHA-256, decrypt/decompress, and validate the original plaintext hash. Critical risk, allergy, open work, and correction are never auto-archived.", styles["BodyN"])]
story += [Paragraph("Measured acceptance", styles["H1N"]), metric_cards(), Spacer(1, 4 * mm), Paragraph("Vitest verifies encryption, redaction-before-provider, scoring, and archive round-trip. Five brief-named Python files make real HTTP calls and run eight assertions covering cross-role writes, cross-clinic hiding, patient field omission, revisions/revert/metadata-only audit, exact spans, separate-entry concurrency, deterministic same-entry 409, and +2 learned score. A binary scan confirms known free-text phrases are absent from SQLite.", styles["BodyN"])]
tradeoffs = [
    ["Choice", "Why now", "Production evolution"],
    ["SQLite WAL", "Zero-service, reproducible review", "PostgreSQL + RLS + HA backups"],
    ["Polling SSE", "Small, inspectable collaboration path", "Broker + durable outbox consumer"],
    ["Demo cookie", "No external auth dependency", "OIDC/passkeys + CSRF + rotation"],
    ["MockScribe", "Proves redaction/provenance without disclosure", "Approved model gateway + evals + DLP"],
]
trade = Table(tradeoffs, colWidths=[36 * mm, 67 * mm, 72 * mm])
trade.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,0), NAVY), ("TEXTCOLOR", (0,0), (-1,0), colors.white), ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"), ("FONTSIZE", (0,0), (-1,-1), 7.1), ("LEADING", (0,0), (-1,-1), 9.5), ("GRID", (0,0), (-1,-1), .5, LINE), ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, CANVAS]), ("VALIGN", (0,0), (-1,-1), "TOP"), ("LEFTPADDING", (0,0), (-1,-1), 6), ("TOPPADDING", (0,0), (-1,-1), 5), ("BOTTOMPADDING", (0,0), (-1,-1), 5)]))
story += [Paragraph("Trade-offs and next boundary", styles["H1N"]), trade, Spacer(1, 4 * mm), Paragraph("Before real data: trusted TLS termination, managed identity, CSRF/rate limits, rotating secrets, formal threat modeling, retention policy, restore drills, clinical safety evaluation, accessibility testing, and observability without content. The prototype optimizes for trust boundaries and reproducibility—not compliance claims.", styles["Callout"])]

doc.build(story)
print(OUTPUT)
