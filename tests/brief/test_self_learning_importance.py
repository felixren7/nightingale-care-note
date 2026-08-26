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


if __name__ == "__main__":
    unittest.main()
