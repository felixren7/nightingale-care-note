from __future__ import annotations

import json
import shutil
from pathlib import Path

from reportlab.graphics.shapes import Drawing, Line, Polygon, Rect, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "nightingale-technical-brief-enhanced.pdf"
COMPAT_OUTPUT = ROOT / "output" / "pdf" / "technical-brief.pdf"
ARCHITECTURE = ROOT / "output" / "diagrams" / "nightingale-system-architecture.png"
BENCHMARK = ROOT / "reports" / "latest-benchmark.json"

NAVY = colors.HexColor("#102A3A")
DEEP_NAVY = colors.HexColor("#123149")
TEAL = colors.HexColor("#0F7C79")
MINT = colors.HexColor("#7AD9C2")
PALE_MINT = colors.HexColor("#E9F7F3")
PURPLE = colors.HexColor("#7259B6")
PALE_PURPLE = colors.HexColor("#F3EFFB")
AMBER = colors.HexColor("#C77A12")
PALE_AMBER = colors.HexColor("#FFF7E8")
INK = colors.HexColor("#132A38")
MUTED = colors.HexColor("#60717B")
LINE = colors.HexColor("#CFDAD7")
CANVAS = colors.HexColor("#F6F9F8")
WHITE = colors.white


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="TitleN", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=22.5, leading=26, textColor=NAVY, alignment=TA_LEFT, spaceAfter=5))
styles.add(ParagraphStyle(name="Deck", parent=styles["BodyText"], fontName="Helvetica", fontSize=10.2, leading=13.5, textColor=MUTED, spaceAfter=9))
styles.add(ParagraphStyle(name="H1N", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=14.5, leading=17, textColor=NAVY, spaceBefore=4, spaceAfter=5))
styles.add(ParagraphStyle(name="H2N", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=10.2, leading=12.5, textColor=TEAL, spaceBefore=4, spaceAfter=3))
styles.add(ParagraphStyle(name="BodyN", parent=styles["BodyText"], fontName="Helvetica", fontSize=8.15, leading=11.15, textColor=INK, spaceAfter=5))
styles.add(ParagraphStyle(name="BodyTight", parent=styles["BodyText"], fontName="Helvetica", fontSize=7.55, leading=9.75, textColor=INK, spaceAfter=2))
styles.add(ParagraphStyle(name="SmallN", parent=styles["BodyText"], fontName="Helvetica", fontSize=6.9, leading=8.8, textColor=MUTED, spaceAfter=2))
styles.add(ParagraphStyle(name="Label", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=6.7, leading=8, textColor=TEAL, spaceAfter=2))
styles.add(ParagraphStyle(name="Callout", parent=styles["BodyText"], fontName="Helvetica", fontSize=7.75, leading=10.2, textColor=NAVY, leftIndent=7, rightIndent=7, spaceBefore=4, spaceAfter=4, borderColor=MINT, borderWidth=1, borderPadding=6, backColor=PALE_MINT))


def p(text: str, style: str = "BodyN"):
    return Paragraph(text, styles[style])


def header_footer(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(DEEP_NAVY)
    canvas.rect(0, height - 12 * mm, width, 12 * mm, fill=1, stroke=0)
    canvas.setFillColor(WHITE)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawString(17 * mm, height - 7.7 * mm, "NIGHTINGALE 72 HOUR BUILD")
    canvas.setFillColor(MINT)
    canvas.setFont("Helvetica-Bold", 7)
    canvas.drawRightString(width - 17 * mm, height - 7.7 * mm, "SYNTHETIC DATA ONLY")
    canvas.setStrokeColor(LINE)
    canvas.line(17 * mm, 13 * mm, width - 17 * mm, 13 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7)
    canvas.drawString(17 * mm, 8.5 * mm, "Trust mechanics | reproducible evidence | explicit limits")
    canvas.drawRightString(width - 17 * mm, 8.5 * mm, f"Technical Brief | {doc.page}/3")
    canvas.restoreState()


def cell(text: str, style: str = "BodyTight"):
    return Paragraph(text, styles[style])


def table_style(header=True, font_size=7.2):
    commands = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.45, LINE),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), font_size),
        ("LEADING", (0, 0), (-1, -1), font_size + 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("ROWBACKGROUNDS", (0, 1 if header else 0), (-1, -1), [WHITE, CANVAS]),
    ]
    if header:
        commands.extend([
            ("BACKGROUND", (0, 0), (-1, 0), DEEP_NAVY),
            ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ])
    return TableStyle(commands)


def arrow(drawing, x1, y1, x2, y2, color=TEAL):
    drawing.add(Line(x1, y1, x2, y2, strokeColor=color, strokeWidth=1.25))
    angle_right = x2 >= x1
    if abs(x2 - x1) >= abs(y2 - y1):
        points = [x2, y2, x2 - 5 if angle_right else x2 + 5, y2 + 3, x2 - 5 if angle_right else x2 + 5, y2 - 3]
    else:
        points = [x2, y2, x2 - 3, y2 + 5 if y2 < y1 else y2 - 5, x2 + 3, y2 + 5 if y2 < y1 else y2 - 5]
    drawing.add(Polygon(points, fillColor=color, strokeColor=color))


def model_box(drawing, x, y, w, h, title, subtitle="", fill=WHITE, stroke=LINE):
    drawing.add(Rect(x, y, w, h, rx=7, ry=7, fillColor=fill, strokeColor=stroke, strokeWidth=1))
    drawing.add(String(x + 7, y + h - 13, title, fontName="Helvetica-Bold", fontSize=7.4, fillColor=NAVY))
    if subtitle:
        drawing.add(String(x + 7, y + 7, subtitle, fontName="Helvetica", fontSize=5.7, fillColor=MUTED))


def data_model_diagram():
    d = Drawing(500, 205)
    d.add(Rect(0, 0, 500, 205, rx=10, ry=10, fillColor=CANVAS, strokeColor=LINE, strokeWidth=1))
    model_box(d, 16, 119, 72, 40, "Patient", "scope root", PALE_MINT, MINT)
    model_box(d, 116, 119, 82, 40, "Entry", "owner + type", WHITE, DEEP_NAVY)
    model_box(d, 232, 119, 92, 40, "EntryVersion", "immutable body", WHITE, DEEP_NAVY)
    model_box(d, 358, 119, 92, 40, "Highlight", "version + offsets", PALE_MINT, MINT)
    arrow(d, 88, 139, 116, 139)
    arrow(d, 198, 139, 232, 139)
    arrow(d, 324, 139, 358, 139)

    model_box(d, 116, 54, 82, 36, "Comment", "thread + assign", WHITE, LINE)
    model_box(d, 16, 54, 72, 36, "Task", "patient + Entry", WHITE, LINE)
    model_box(d, 232, 54, 92, 36, "ArchiveBlob", "verified restore", PALE_AMBER, colors.HexColor("#E7B85D"))
    model_box(d, 358, 54, 92, 36, "Feedback", "accept / pin / reject", PALE_MINT, MINT)
    arrow(d, 157, 119, 157, 90)
    arrow(d, 52, 119, 52, 90)
    arrow(d, 278, 119, 278, 90, AMBER)
    arrow(d, 404, 119, 404, 90)

    model_box(d, 16, 9, 92, 26, "EntryRelation", "supersedes", WHITE, LINE)
    model_box(d, 128, 9, 92, 26, "Audit + Outbox", "metadata only", PALE_MINT, MINT)
    model_box(d, 352, 9, 98, 26, "FeatureWeight", "clinic + featureKey", PALE_MINT, MINT)
    d.add(Line(116, 139, 100, 139, strokeColor=TEAL, strokeWidth=1.25))
    arrow(d, 100, 139, 100, 35)
    arrow(d, 404, 54, 401, 35)

    model_box(d, 232, 168, 92, 26, "SourceArtifact", "raw + redacted", PALE_PURPLE, PURPLE)
    arrow(d, 248, 168, 178, 159, PURPLE)
    arrow(d, 308, 168, 388, 159, PURPLE)

    d.add(String(16, 199, "The narrative chain stays central; collaboration, source, learning, audit, and archive records attach to it.", fontName="Helvetica", fontSize=6.4, fillColor=MUTED))
    return d


def scope_table():
    data = [
        [cell("BUILT", "Label"), cell("LEFT OUT", "Label")],
        [cell("Role-owned entries, comments and assignments, tasks, full snapshots, append-only revert, deterministic 409 conflicts, patient-safe updates, exact provenance, reversible feedback, connection-aware SSE, admin audit, and cold archive."),
         cell("Voice capture, transcription, diarization, a real model provider, EHR integration, and any claim that the prototype may handle real patient data.")],
    ]
    table = Table(data, colWidths=[87.5 * mm, 87.5 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), PALE_MINT),
        ("BACKGROUND", (1, 0), (1, -1), PALE_PURPLE),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return table


def flow_notes_table():
    rows = [[
        cell("1. READ", "Label"), cell("2. WRITE", "Label"), cell("3. SCRIBE", "Label"), cell("4. REFRESH", "Label")
    ], [
        cell("Route authenticates; DAL checks scope again before the object query."),
        cell("Mutation appends ciphertext only after the base-version gate succeeds."),
        cell("Local summary logic receives the redacted string; no provider call exists."),
        cell("The same transaction stores audit metadata and an SSE outbox event."),
    ]]
    table = Table(rows, colWidths=[43.75 * mm] * 4)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CANVAS),
        ("BOX", (0, 0), (-1, -1), 0.5, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return table


def evidence_table(report):
    rows = [
        ["Check", "Current result", "What it proves"],
        [cell("Static checks"), cell("ESLint, TypeScript, production build: PASS"), cell("The final candidate build completes a production build.")],
        [cell("Core tests"), cell("Vitest 5/5"), cell("Encryption, redaction order, scoring, archive round-trip.")],
        [cell("HTTP micro-tests"), cell("10/10 test cases"), cell("RBAC, patient persistence, history, provenance, conflicts, feedback undo.")],
        [cell("SQLite scan"), cell("4 seeded phrases absent"), cell("Known clinical free text is not stored in plaintext.")],
        [cell("Warm path"), cell(f"P50 {report['p50Ms']} ms | P95 {report['p95Ms']} ms"), cell("200 requests, concurrency 10; gate P95 < 300 ms.")],
    ]
    table = Table(rows, colWidths=[35 * mm, 55 * mm, 85 * mm], repeatRows=1)
    table.setStyle(table_style())
    return table


def tradeoff_table():
    rows = [
        ["Choice", "Why it fit 72 hours", "Limit / next step"],
        [cell("SQLite WAL"), cell("One local service; easy conflict reproduction."), cell("PostgreSQL, RLS, HA backups, durable outbox consumer.")],
        [cell("Full snapshots"), cell("Simple revert and stable provenance."), cell("More storage; keep the conservative archive path.")],
        [cell("MockScribe"), cell("Tests redaction and provenance without disclosure."), cell("Redacted-only provider interface, DLP, evals, model governance.")],
        [cell("Polling SSE"), cell("Small and inspectable collaboration path."), cell("Broker, backpressure, delivery monitoring, load tests.")],
        [cell("Pattern redactor"), cell("Deterministic coverage for the demo data."), cell("Not broad PHI detection; replace with tested DLP / NER.")],
    ]
    table = Table(rows, colWidths=[31 * mm, 63 * mm, 81 * mm], repeatRows=1)
    table.setStyle(table_style())
    return table


def gap_table():
    rows = [[cell("CURRENT LEARNING BEHAVIOR", "Label"), cell("NEXT ACCEPTANCE TEST", "Label")], [
        cell("Feedback updates clinic-scoped FeatureWeight and re-scores matching stored highlights. Reject is reversible through an auditable inverse update."),
        cell("Read FeatureWeight during ingest, create a second similar suggestion, and assert that its score inherits the learned priority without changing provenance."),
    ]]
    table = Table(rows, colWidths=[87.5 * mm, 87.5 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PALE_PURPLE),
        ("BOX", (0, 0), (-1, -1), 0.7, PURPLE),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D7CCF1")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return table


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    report = json.loads(BENCHMARK.read_text(encoding="utf-8"))
    doc = BaseDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=17 * mm,
        rightMargin=17 * mm,
        topMargin=18 * mm,
        bottomMargin=17 * mm,
        title="Nightingale Shared Care Note - Technical Brief",
        author="Ren Hongxu",
        subject="Nightingale 72 Hour Build technical architecture and verification evidence",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="body")
    doc.addPageTemplates(PageTemplate(id="main", frames=[frame], onPage=header_footer))

    story = [
        Spacer(1, 3 * mm),
        p("Nightingale Shared Care Note", "TitleN"),
        p("A trust-first clinical collaboration prototype for one longitudinal patient record", "Deck"),
        p("1. What I built and why", "H1N"),
        p("During a consult, the expensive task is not writing another note. It is finding what changed, what is still open, and whether a claim can be trusted. I kept the timeline as the record of fact and made Glance a five-item working set. It favors risk, unfinished work, clinician-confirmed corrections, and recent change. Each item says why it is shown and opens the exact stored source span."),
        scope_table(),
        p("One TypeScript repository contains the Next.js 16.3.2 UI, Route Handlers, SSE endpoint, and server data-access layer. Prisma 7.9.1 uses the better-sqlite3 adapter against one local SQLite WAL database.", "SmallN"),
        p("<b>Assumption:</b> a synthetic, single-region clinic demo with seeded identities and stable loopback connectivity. <b>First principle:</b> a summary must not become a second source of truth; authorization stays server-side, writes stay append-only, and derived claims resolve to immutable evidence.", "BodyTight"),
        Spacer(1, 2 * mm),
        Image(str(ARCHITECTURE), width=175 * mm, height=96 * mm),
        Spacer(1, 2 * mm),
        flow_notes_table(),
        p("Clinical narrative fields are encrypted, but identifiers and control metadata are not. The redactor is a narrow pattern matcher, not a production DLP system. These are explicit reasons the build remains synthetic-data only.", "Callout"),
        PageBreak(),

        Spacer(1, 3 * mm),
        p("2. Data model and trust mechanics", "TitleN"),
        p("The timeline stays authoritative. Derived signals point back to an immutable version rather than becoming a second source of truth.", "Deck"),
        data_model_diagram(),
        Spacer(1, 3 * mm),
        p("Narrative and revision", "H2N"),
        p("<b>Entry</b> holds ownership, role, type, visibility, section, risk, current version, and source or correction links. The body exists only in <b>EntryVersion</b>. Revert decrypts a chosen snapshot and appends a new version with <b>revertedFromVersion</b>; it does not delete history. A write increments <b>currentVersion</b> only when it still equals <b>baseVersion</b>. Two writes to different Entries succeed. The losing writer to the same Entry receives <b>409 VERSION_CONFLICT</b>."),
        p("Provenance and correction", "H2N"),
        p("A SourceArtifact produces a distinct system-owned Entry; its interaction type maps to doctor-patient, nurse-patient, or AI-patient summary types. A Highlight cites one immutable EntryVersion plus start and end offsets. It may also point to the original artifact. Resolution repeats authorization, reads hot or archived content, checks the plaintext hash, and returns the exact slice. A clinician correction creates a new Entry and a <b>supersedes</b> relation, so the earlier statement remains reviewable."),
        p("Server-side role boundaries", "H2N"),
        p("Patients receive only <b>visibility=patient</b> instructions and patient-authored insights. Glance, tasks, comments, raw artifacts, and audit fields are absent from their payload. Staff and clinicians may edit only entries they authored in their own role. Cross-clinic reads return 404. The clinic-scoped admin can inspect metadata-only audit events and reset synthetic data only in development."),
        p("Collaboration and live refresh", "H2N"),
        p("Threaded comments attach to an Entry and support assignment plus resolve/reopen. Tasks stay separate because work state should not be buried inside prose. History and Comments are true filtered views. Every mutation writes audit metadata and an EventOutbox row in the same transaction. The 25-second SSE connection sends metadata only after authorization; the UI exposes connecting/live/reconnecting state before refetching the role-filtered care note."),
        p("Clinical free text in versions, comments, tasks, highlights, reasons, and source artifacts uses AES-256-GCM. Audit rows keep actor, action, object IDs, versions, and non-sensitive control metadata. Unauthorized object access returns 404 when revealing existence would leak scope.", "Callout"),
        PageBreak(),

        Spacer(1, 3 * mm),
        p("3. Evidence, trade-offs, and the next boundary", "TitleN"),
        p("The claims below come from the final candidate working tree and a fresh local run on 27 August 2026.", "Deck"),
        evidence_table(report),
        p("The benchmark ran on an Apple M4 with 16 GB RAM and Node 24.14.0 after 50 warmups, with 200 measured requests at concurrency 10. It is a local acceptance result, not a production capacity claim.", "SmallN"),
        p("Importance logic and the honest boundary", "H1N"),
        p("<b>base</b> = risk + unresolved task + clinician confirmation + entity + freshness<br/><b>learned</b> = clamp(clinic feature weight, -15, 15)<br/><b>final</b> = clamp(base + learned, 0, 100)", "Callout"),
        p("Accept and pin add +2; reject adds -2; undo_reject adds the inverse +2 and restores the suggestion. Every action is auditable and cannot erase provenance."),
        gap_table(),
        p("Trade-offs", "H1N"),
        tradeoff_table(),
        p("Cold archive", "H2N"),
        p("Archive is opt-in. A version must be older than 365 days, low risk, unrelated to open work, and free of accepted, pinned, high-risk, or correction status. Apply gzip-compresses the existing encrypted payload, wraps it in a second AES-256-GCM envelope, verifies SHA-256, and only then marks SQL content cold. Reads verify both the blob hash and original plaintext hash."),
        p("Before real data, the project still needs managed identity, CSRF and rate limits, trusted TLS termination, key rotation, formal threat modeling, a formal accessibility and clinical safety evaluation, retention rules, restore drills, and content-free observability. This build demonstrates trust mechanics and reproducible behavior. It does not claim regulatory compliance.", "Callout"),
    ]

    doc.build(story)
    shutil.copyfile(OUTPUT, COMPAT_OUTPUT)
    print(OUTPUT)
    print(COMPAT_OUTPUT)


if __name__ == "__main__":
    build()
