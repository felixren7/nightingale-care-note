export type ImportanceInput = {
  riskLevel: string;
  unresolvedTask?: boolean;
  clinicianConfirmed?: boolean;
  entityType?: string | null;
  ageDays?: number;
  learnedWeight?: number;
};

const riskScore: Record<string, number> = {
  critical: 40,
  high: 25,
  medium: 10,
  low: 0,
};

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function calculateImportance(input: ImportanceInput) {
  const entityScore = input.entityType === 'allergy'
    ? 15
    : input.entityType === 'medication'
      ? 10
      : input.entityType === 'chief_complaint'
        ? 8
        : 0;
  const recency = clamp(15 - Math.floor((input.ageDays ?? 0) / 14), 0, 15);
  const base =
    (riskScore[input.riskLevel] ?? 0) +
    (input.unresolvedTask ? 25 : 0) +
    (input.clinicianConfirmed ? 15 : 0) +
    entityScore +
    recency;
  const learned = clamp(input.learnedWeight ?? 0, -15, 15);
  return { baseScore: base, learnedScore: learned, finalScore: clamp(base + learned, 0, 100) };
}

export function feedbackDelta(action: string) {
  if (action === 'accept' || action === 'pin' || action === 'undo_reject') return 2;
  if (action === 'reject') return -2;
  return 0;
}
