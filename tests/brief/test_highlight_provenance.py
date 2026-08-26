import unittest
from _api import client_for


class HighlightProvenanceTest(unittest.TestCase):
    def test_every_glance_highlight_resolves_exact_span(self):
        clinician = client_for("user-clinician")
        status, care_note = clinician.request("GET", "/api/patients/patient-maya/care-note")
        self.assertEqual(status, 200)
        self.assertGreater(len(care_note["glance"]), 0)
        for highlight in care_note["glance"]:
            status, provenance = clinician.request("GET", f"/api/provenance/{highlight['id']}")
            self.assertEqual(status, 200)
            pointer = provenance["pointer"]
            source = provenance["source"]
            self.assertEqual(pointer["entryId"], highlight["provenance"]["entryId"])
            self.assertEqual(pointer["versionId"], highlight["provenance"]["versionId"])
            self.assertEqual(source["exactSpan"], source["content"][pointer["startOffset"]:pointer["endOffset"]])


if __name__ == "__main__":
    unittest.main()
