import concurrent.futures
import unittest
from _api import client_for


class ConcurrentEditsTest(unittest.TestCase):
    def create_entry(self, section):
        client = client_for("user-clinician")
        status, payload = client.request("POST", "/api/patients/patient-maya/entries", {"type": "clinician_note", "section": section, "content": "Base content"})
        self.assertEqual(status, 201)
        return payload["id"]

    def test_different_sections_succeed_concurrently(self):
        first = self.create_entry("concurrent_section_a")
        second = self.create_entry("concurrent_section_b")
        def update(entry_id):
            return client_for("user-clinician").request("PATCH", f"/api/entries/{entry_id}", {"baseVersion": 1, "content": f"Update {entry_id}"})[0]
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            statuses = list(executor.map(update, [first, second]))
        self.assertEqual(statuses, [200, 200])

    def test_same_section_returns_deterministic_conflict(self):
        entry_id = self.create_entry("concurrent_same_section")
        def update(number):
            return client_for("user-clinician").request("PATCH", f"/api/entries/{entry_id}", {"baseVersion": 1, "content": f"Competing update {number}"})
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            responses = list(executor.map(update, [1, 2]))
        self.assertEqual(sorted(status for status, _ in responses), [200, 409])
        conflict = next(payload for status, payload in responses if status == 409)
        self.assertEqual(conflict["error"]["code"], "VERSION_CONFLICT")


if __name__ == "__main__":
    unittest.main()
