import json
import unittest
from _api import client_for


class RbacScopeTest(unittest.TestCase):
    def test_roles_cannot_overwrite_one_another(self):
        staff = client_for("user-staff")
        status, payload = staff.request("PATCH", "/api/entries/entry-clinician-plan", {"baseVersion": 2, "content": "forbidden overwrite"})
        self.assertEqual(status, 403)
        self.assertEqual(payload["error"]["code"], "ROLE_OWNERSHIP_REQUIRED")

    def test_patient_dto_has_no_internal_fields(self):
        patient = client_for("user-patient")
        status, payload = patient.request("GET", "/api/patients/patient-maya/care-note")
        self.assertEqual(status, 200)
        self.assertEqual(payload["glance"], [])
        self.assertEqual(payload["tasks"], [])
        serialized = json.dumps(payload)
        self.assertNotIn("comments", serialized)
        self.assertNotIn("Known penicillin", serialized)
        self.assertTrue(all(entry["visibility"] == "patient" for entry in payload["timeline"]))

    def test_patient_update_remains_visible_after_creation(self):
        patient = client_for("user-patient")
        content = "My cough woke me twice last night."
        status, created = patient.request(
            "POST",
            "/api/patients/patient-maya/entries",
            {"type": "patient_insight", "section": "patient_context", "content": content},
        )
        self.assertEqual(status, 201)

        status, payload = patient.request("GET", "/api/patients/patient-maya/care-note")
        self.assertEqual(status, 200)
        restored = next(entry for entry in payload["timeline"] if entry["id"] == created["id"])
        self.assertEqual(restored["content"], content)
        self.assertEqual(restored["visibility"], "patient")
        serialized = json.dumps(payload)
        self.assertNotIn("Known penicillin", serialized)
        self.assertNotIn("comments", serialized)

    def test_cross_clinic_scope_is_hidden(self):
        north_staff = client_for("user-north-staff")
        status, payload = north_staff.request("GET", "/api/patients/patient-maya/care-note")
        self.assertEqual(status, 404)
        self.assertEqual(payload["error"]["code"], "NOT_FOUND")


if __name__ == "__main__":
    unittest.main()
