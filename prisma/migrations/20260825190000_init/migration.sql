-- CreateTable
CREATE TABLE "Clinic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT,
    "patientId" TEXT,
    "role" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "User_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "idHash" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "birthYear" INTEGER NOT NULL,
    "recordNumber" TEXT NOT NULL,
    "synthetic" BOOLEAN NOT NULL DEFAULT true,
    "lastContactAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Patient_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SourceArtifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "sessionRef" TEXT NOT NULL,
    "interactionType" TEXT NOT NULL,
    "rawCipher" TEXT NOT NULL,
    "rawIv" TEXT NOT NULL,
    "rawTag" TEXT NOT NULL,
    "redactedCipher" TEXT NOT NULL,
    "redactedIv" TEXT NOT NULL,
    "redactedTag" TEXT NOT NULL,
    "redactionMetadata" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SourceArtifact_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SourceArtifact_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Entry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorRole" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "visibility" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL DEFAULT 'low',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "sourceArtifactId" TEXT,
    "supersedesEntryId" TEXT,
    "storageTier" TEXT NOT NULL DEFAULT 'hot',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Entry_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Entry_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Entry_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Entry_sourceArtifactId_fkey" FOREIGN KEY ("sourceArtifactId") REFERENCES "SourceArtifact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Entry_supersedesEntryId_fkey" FOREIGN KEY ("supersedesEntryId") REFERENCES "Entry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntryVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "contentCipher" TEXT NOT NULL,
    "contentIv" TEXT NOT NULL,
    "contentTag" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdById" TEXT,
    "revertedFromVersion" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EntryVersion_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EntryVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "parentId" TEXT,
    "authorId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "bodyCipher" TEXT NOT NULL,
    "bodyIv" TEXT NOT NULL,
    "bodyTag" TEXT NOT NULL,
    "startOffset" INTEGER,
    "endOffset" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comment_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "entryId" TEXT,
    "assignedToId" TEXT,
    "titleCipher" TEXT NOT NULL,
    "titleIv" TEXT NOT NULL,
    "titleTag" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "dueAt" DATETIME,
    "riskLevel" TEXT NOT NULL DEFAULT 'low',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Highlight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "entryVersionId" TEXT NOT NULL,
    "sourceArtifactId" TEXT,
    "startOffset" INTEGER NOT NULL,
    "endOffset" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "summaryCipher" TEXT NOT NULL,
    "summaryIv" TEXT NOT NULL,
    "summaryTag" TEXT NOT NULL,
    "riskReasonCipher" TEXT NOT NULL,
    "riskReasonIv" TEXT NOT NULL,
    "riskReasonTag" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL DEFAULT 'low',
    "entityType" TEXT,
    "featureKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'suggested',
    "baseScore" REAL NOT NULL,
    "learnedScore" REAL NOT NULL DEFAULT 0,
    "finalScore" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Highlight_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Highlight_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Highlight_entryVersionId_fkey" FOREIGN KEY ("entryVersionId") REFERENCES "EntryVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Highlight_sourceArtifactId_fkey" FOREIGN KEY ("sourceArtifactId") REFERENCES "SourceArtifact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HighlightFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "highlightId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "delta" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HighlightFeedback_highlightId_fkey" FOREIGN KEY ("highlightId") REFERENCES "Highlight" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HighlightFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeatureWeight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "weight" REAL NOT NULL DEFAULT 0,
    "observations" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FeatureWeight_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntryRelation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "fromEntryId" TEXT NOT NULL,
    "toEntryId" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EntryRelation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EntryRelation_fromEntryId_fkey" FOREIGN KEY ("fromEntryId") REFERENCES "Entry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EntryRelation_toEntryId_fkey" FOREIGN KEY ("toEntryId") REFERENCES "Entry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EntryRelation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventOutbox" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventOutbox_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventOutbox_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ArchiveBlob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryVersionId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restoredAt" DATETIME,
    CONSTRAINT "ArchiveBlob_entryVersionId_fkey" FOREIGN KEY ("entryVersionId") REFERENCES "EntryVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fromVersion" INTEGER,
    "toVersion" INTEGER,
    "metadataJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuditEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GlanceCache" (
    "patientId" TEXT NOT NULL PRIMARY KEY,
    "payloadCipher" TEXT NOT NULL,
    "payloadIv" TEXT NOT NULL,
    "payloadTag" TEXT NOT NULL,
    "refreshedAt" DATETIME NOT NULL,
    CONSTRAINT "GlanceCache_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_patientId_key" ON "User"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "idx_users_clinic_role" ON "User"("clinicId", "role");

-- CreateIndex
CREATE INDEX "idx_sessions_user_expires" ON "Session"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_recordNumber_key" ON "Patient"("recordNumber");

-- CreateIndex
CREATE INDEX "idx_patients_clinic_contact" ON "Patient"("clinicId", "lastContactAt");

-- CreateIndex
CREATE INDEX "idx_artifacts_patient_created" ON "SourceArtifact"("patientId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SourceArtifact_clinicId_sessionRef_key" ON "SourceArtifact"("clinicId", "sessionRef");

-- CreateIndex
CREATE INDEX "idx_entries_patient_created" ON "Entry"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_entries_scope_visibility" ON "Entry"("clinicId", "patientId", "visibility");

-- CreateIndex
CREATE INDEX "idx_entries_patient_type_risk" ON "Entry"("patientId", "type", "riskLevel");

-- CreateIndex
CREATE INDEX "idx_versions_entry_created" ON "EntryVersion"("entryId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EntryVersion_entryId_version_key" ON "EntryVersion"("entryId", "version");

-- CreateIndex
CREATE INDEX "idx_comments_entry_status" ON "Comment"("entryId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "idx_tasks_patient_status_due" ON "Task"("patientId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "idx_highlights_patient_status_score" ON "Highlight"("patientId", "status", "finalScore");

-- CreateIndex
CREATE INDEX "idx_highlights_provenance" ON "Highlight"("entryId", "entryVersionId");

-- CreateIndex
CREATE INDEX "idx_feedback_highlight_created" ON "HighlightFeedback"("highlightId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureWeight_clinicId_featureKey_key" ON "FeatureWeight"("clinicId", "featureKey");

-- CreateIndex
CREATE UNIQUE INDEX "EntryRelation_fromEntryId_toEntryId_relation_key" ON "EntryRelation"("fromEntryId", "toEntryId", "relation");

-- CreateIndex
CREATE INDEX "idx_events_patient_cursor" ON "EventOutbox"("patientId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ArchiveBlob_entryVersionId_key" ON "ArchiveBlob"("entryVersionId");

-- CreateIndex
CREATE INDEX "idx_audit_scope_created" ON "AuditEvent"("clinicId", "patientId", "createdAt");
