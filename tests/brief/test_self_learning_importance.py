import unittest
from _api import client_for


class SelfLearningImportanceTest(unittest.TestCase):
    def test_pin_increases_similar_feature_score(self):
        clinician = client_for("user-clinician")
        status, before = clinician.request("GET", "/api/patients/patient-maya/care-note")
        self.assertEqual(status, 200)
        target = next(item for item in before["glance"] if item["featureKey"] == "topic:respiratory")
        status, feedback = clinician.request("POST", f"/api/highlights/{target['id']}/feedback", {"action": "pin"})
        self.assertEqual(status, 200)
        self.assertEqual(feedback["learnedWeight"], 2)
        status, after = clinician.request("GET", "/api/patients/patient-maya/care-note")
        updated = next(item for item in after["glance"] if item["id"] == target["id"])
        self.assertGreater(updated["score"], target["score"])
        self.assertEqual(updated["score"] - target["score"], 2)

    def test_reject_can_be_undone_without_losing_the_signal(self):
        clinician = client_for("user-clinician")
        status, before = clinician.request("GET", "/api/patients/patient-maya/care-note")
        self.assertEqual(status, 200)
        target = next(item for item in before["glance"] if item["featureKey"] == "topic:respiratory")

        status, rejected = clinician.request(
            "POST", f"/api/highlights/{target['id']}/feedback", {"action": "reject"}
        )
        self.assertEqual(status, 200)
        self.assertEqual(rejected["status"], "rejected")
        status, hidden = clinician.request("GET", "/api/patients/patient-maya/care-note")
        self.assertFalse(any(item["id"] == target["id"] for item in hidden["glance"]))

        status, restored = clinician.request(
            "POST", f"/api/highlights/{target['id']}/feedback", {"action": "undo_reject"}
        )
        self.assertEqual(status, 200)
        self.assertEqual(restored["status"], "suggested")
        self.assertEqual(restored["learnedWeight"], rejected["learnedWeight"] + 2)
        status, after = clinician.request("GET", "/api/patients/patient-maya/care-note")
        visible = next(item for item in after["glance"] if item["id"] == target["id"])
        self.assertEqual(visible["score"], target["score"])

        status, error = clinician.request(
            "POST", f"/api/highlights/{target['id']}/feedback", {"action": "undo_reject"}
        )
        self.assertEqual(status, 409)
        self.assertEqual(error["error"]["code"], "HIGHLIGHT_NOT_REJECTED")


if __name__ == "__main__":
    unittest.main()
