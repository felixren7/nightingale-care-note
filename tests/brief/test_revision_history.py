import json
import unittest
from _api import client_for


class RevisionHistoryTest(unittest.TestCase):
    def test_versions_increment_and_revert_appends(self):
        clinician = client_for("user-clinician")
        status, created = clinician.request("POST", "/api/patients/patient-maya/entries", {"type": "clinician_note", "section": "test_revision", "content": "Revision test version one"})
        self.assertEqual(status, 201)
        entry_id = created["id"]
        status, updated = clinician.request("PATCH", f"/api/entries/{entry_id}", {"baseVersion": 1, "content": "Revision test version two"})
        self.assertEqual((status, updated["version"]), (200, 2))
        status, reverted = clinician.request("POST", f"/api/entries/{entry_id}/revert", {"version": 1, "baseVersion": 2})
        self.assertEqual((status, reverted["version"], reverted["revertedFromVersion"]), (200, 3, 1))
        status, history = clinician.request("GET", f"/api/entries/{entry_id}/versions")
        self.assertEqual([item["version"] for item in history["versions"]], [3, 2, 1])
        self.assertEqual(history["versions"][0]["content"], "Revision test version one")

        admin = client_for("user-admin")
        status, audit = admin.request("GET", "/api/audit?patientId=patient-maya")
        self.assertEqual(status, 200)
        self.assertTrue(any(event["entityId"] == entry_id and event["action"] == "entry.reverted" for event in audit["events"]))
        self.assertNotIn("Revision test version", json.dumps(audit))


if __name__ == "__main__":
    unittest.main()
