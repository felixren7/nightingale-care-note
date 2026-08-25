import type { SessionUser } from '@/src/core/types';
import { HttpError, notFound } from './http';

type PatientResource = { id: string; clinicId: string };
type EntryResource = {
  authorId: string | null;
  authorRole: string;
  clinicId: string;
  patientId: string;
  type: string;
  visibility: string;
};

export function assertCanViewPatient(user: SessionUser, patient: PatientResource) {
  if (user.role === 'patient') {
    if (user.patientId !== patient.id) notFound();
    return;
  }
  if (!user.clinicId || user.clinicId !== patient.clinicId) notFound();
}

export function canViewEntry(user: SessionUser, entry: EntryResource) {
  if (user.role === 'patient') {
    return user.patientId === entry.patientId && entry.visibility === 'patient';
  }
  return Boolean(user.clinicId && user.clinicId === entry.clinicId);
}

export function assertCanEditEntry(user: SessionUser, entry: EntryResource) {
  if (!canViewEntry(user, entry)) notFound();
  const allowed =
    (user.role === 'staff' && entry.authorRole === 'staff' && entry.authorId === user.id) ||
    (user.role === 'clinician' && entry.authorRole === 'clinician' && entry.authorId === user.id) ||
    (user.role === 'patient' && entry.authorRole === 'patient' && entry.authorId === user.id);
  if (!allowed) {
    throw new HttpError(403, 'ROLE_OWNERSHIP_REQUIRED', 'Roles cannot overwrite one another’s notes.');
  }
}

export function assertCanCreateEntry(user: SessionUser, type: string) {
  const allowed =
    (user.role === 'staff' && type === 'staff_note') ||
    (user.role === 'clinician' && ['clinician_note', 'patient_instruction'].includes(type)) ||
    (user.role === 'patient' && type === 'patient_insight');
  if (!allowed) throw new HttpError(403, 'ROLE_ENTRY_TYPE_FORBIDDEN', 'This role cannot create that entry type.');
}

export function assertInternalCollaborator(user: SessionUser) {
  if (!['staff', 'clinician'].includes(user.role)) {
    throw new HttpError(403, 'COLLABORATOR_REQUIRED', 'Only staff and clinicians can perform this action.');
  }
}
