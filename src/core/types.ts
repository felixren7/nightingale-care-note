export const roles = ['patient', 'staff', 'clinician', 'admin'] as const;
export type Role = (typeof roles)[number];

export type SessionUser = {
  id: string;
  clinicId: string | null;
  patientId: string | null;
  role: Role;
  displayName: string;
};

export type EntryDTO = {
  id: string;
  authorRole: string;
  authorName: string;
  type: string;
  visibility: string;
  section: string;
  riskLevel: string;
  version: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  sourceSessionRef?: string;
  supersedesEntryId?: string;
  comments?: Array<{
    id: string;
    authorName: string;
    body: string;
    status: string;
    assignedToName?: string;
    createdAt: string;
  }>;
};

export type HighlightDTO = {
  id: string;
  kind: string;
  summary: string;
  riskReason: string;
  riskLevel: string;
  status: string;
  score: number;
  featureKey: string;
  provenance: {
    entryId: string;
    versionId: string;
    version: number;
    startOffset: number;
    endOffset: number;
    sourceArtifactId?: string;
  };
};
