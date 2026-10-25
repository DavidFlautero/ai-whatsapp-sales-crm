import unittest
from importlib.util import spec_from_file_location, module_from_spec
from pathlib import Path

module_path = (
    Path(__file__).resolve().parent
    / "semantic-validator-v4.py"
)

spec = spec_from_file_location(
    "semantic_validator_v4",
    module_path,
)

module = module_from_spec(spec)
spec.loader.exec_module(module)

validate = module.validate

SOURCE = {
    "contact_fingerprint": "test-contact",
    "messages": [
        {"message_id": "m1"},
        {"message_id": "m2"},
    ],
}

def valid_candidate():
    return {
        "contact_fingerprint": "test-contact",
        "proposed_role": "client",
        "role_evidence_message_ids": ["m1"],
        "summary": "Solicita un espacio para un evento.",
        "facts": [
            {
                "kind": "requested_service",
                "value": "espacio",
                "certainty": "explicit",
                "message_ids": ["m1"],
            }
        ],
        "opt_out_candidate": False,
        "opt_out_evidence_message_ids": [],
        "followup_review_candidate": True,
        "followup_evidence_message_ids": ["m2"],
        "requires_human_review": True,
        "automatically_applied": False,
    }

class SemanticValidatorTests(unittest.TestCase):

    def test_valid_candidate(self):
        self.assertEqual(
            validate(valid_candidate(), SOURCE),
            [],
        )

    def test_foreign_contact(self):
        item = valid_candidate()
        item["contact_fingerprint"] = "other"
        self.assertIn(
            "CONTACT_MISMATCH",
            validate(item, SOURCE),
        )

    def test_foreign_message(self):
        item = valid_candidate()
        item["facts"][0]["message_ids"] = ["foreign"]
        self.assertIn(
            "FACT_0_FOREIGN_MESSAGE",
            validate(item, SOURCE),
        )

    def test_fact_without_evidence(self):
        item = valid_candidate()
        item["facts"][0]["message_ids"] = []
        self.assertIn(
            "FACT_0_EVIDENCE_MISSING",
            validate(item, SOURCE),
        )

    def test_automatic_apply_rejected(self):
        item = valid_candidate()
        item["automatically_applied"] = True
        self.assertIn(
            "UNSAFE_AUTOMATIC_APPLY",
            validate(item, SOURCE),
        )

    def test_opt_out_conflict_rejected(self):
        item = valid_candidate()
        item["opt_out_candidate"] = True
        item["opt_out_evidence_message_ids"] = ["m1"]
        self.assertIn(
            "OPT_OUT_FOLLOWUP_CONFLICT",
            validate(item, SOURCE),
        )

    def test_unknown_role_without_evidence(self):
        item = valid_candidate()
        item["proposed_role"] = "unknown"
        item["role_evidence_message_ids"] = []
        self.assertEqual(
            validate(item, SOURCE),
            [],
        )

if __name__ == "__main__":
    unittest.main(verbosity=2)
