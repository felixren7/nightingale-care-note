import { redactPhi, type RedactionResult } from './redaction';

export type ScribeInteraction =
  | 'doctor_patient'
  | 'nurse_patient'
  | 'ai_patient';

export type ScribeResult = {
  entryType: string;
  redaction: RedactionResult;
  summary: string;
  riskLevel: 'low' | 'medium' | 'high';
  featureKey: string;
};

const entryTypes: Record<ScribeInteraction, string> = {
  doctor_patient: 'ai_doctor_consult_summary',
  nurse_patient: 'ai_nurse_consult_summary',
  ai_patient: 'ai_patient_session_summary',
};

export function runMockScribe(
  interaction: ScribeInteraction,
  transcript: string,
  knownNames: string[],
): ScribeResult {
  const redaction = redactPhi(transcript, knownNames);
  const lower = redaction.text.toLowerCase();
  const worsening = /worsen|nightly|shortness of breath|chest pain/.test(lower);
  const featureKey = /allerg/.test(lower)
    ? 'entity:allergy'
    : /cough|breath|asthma/.test(lower)
      ? 'topic:respiratory'
      : 'topic:general_follow_up';
  const prefix = interaction === 'ai_patient'
    ? 'Patient-reported context'
    : interaction === 'nurse_patient'
      ? 'Nursing consult summary'
      : 'Clinician consult summary';

  return {
    entryType: entryTypes[interaction],
    redaction,
    summary: `${prefix}: ${redaction.text.trim()}`,
    riskLevel: worsening ? 'medium' : 'low',
    featureKey,
  };
}
