from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent

CONTRACT = json.loads(
    (ROOT / "semantic-contract-v4.json").read_text()
)

ROLES = set(CONTRACT["allowed_roles"])
KINDS = set(CONTRACT["allowed_fact_kinds"])

def validate(candidate, source_case):
    errors = []

    if not isinstance(candidate, dict):
        return ["INVALID_CANDIDATE"]

    if not isinstance(source_case, dict):
        return ["INVALID_SOURCE_CASE"]

    expected = source_case["contact_fingerprint"]

    if candidate.get("contact_fingerprint") != expected:
        errors.append("CONTACT_MISMATCH")

    if candidate.get("proposed_role") not in ROLES:
        errors.append("INVALID_ROLE")

    if candidate.get("requires_human_review") is not True:
        errors.append("REVIEW_NOT_REQUIRED")

    if candidate.get("automatically_applied") is not False:
        errors.append("UNSAFE_AUTOMATIC_APPLY")

    source_ids = {
        str(message["message_id"])
        for message in source_case["messages"]
    }

    def check_ids(value, label, required=False):
        if not isinstance(value, list):
            errors.append(f"{label}_INVALID_IDS")
            return

        if required and not value:
            errors.append(f"{label}_EVIDENCE_MISSING")

        for identifier in value:
            if (
                not isinstance(identifier, str)
                or identifier not in source_ids
            ):
                errors.append(f"{label}_FOREIGN_MESSAGE")

    role_ids = candidate.get(
        "role_evidence_message_ids"
    )

    check_ids(
        role_ids,
        "ROLE",
        candidate.get("proposed_role") not in (
            "unknown",
        ),
    )

    summary = candidate.get("summary")

    if not isinstance(summary, str) or len(summary) > 1200:
        errors.append("INVALID_SUMMARY")

    facts = candidate.get("facts")

    if not isinstance(facts, list) or len(facts) > 100:
        errors.append("INVALID_FACTS")
        facts = []

    for index, fact in enumerate(facts):
        label = f"FACT_{index}"

        if not isinstance(fact, dict):
            errors.append(f"{label}_INVALID")
            continue

        if fact.get("kind") not in KINDS:
            errors.append(f"{label}_UNKNOWN_KIND")

        value = fact.get("value")

        if (
            not isinstance(value, str)
            or not value.strip()
            or len(value) > 300
        ):
            errors.append(f"{label}_INVALID_VALUE")

        if fact.get("certainty") not in (
            "explicit",
            "inferred",
        ):
            errors.append(f"{label}_INVALID_CERTAINTY")

        check_ids(
            fact.get("message_ids"),
            label,
            required=True,
        )

    opt_out = candidate.get("opt_out_candidate")

    if not isinstance(opt_out, bool):
        errors.append("INVALID_OPT_OUT")

    check_ids(
        candidate.get("opt_out_evidence_message_ids"),
        "OPT_OUT",
        required=opt_out is True,
    )

    followup = candidate.get(
        "followup_review_candidate"
    )

    if not isinstance(followup, bool):
        errors.append("INVALID_FOLLOWUP_FLAG")

    check_ids(
        candidate.get("followup_evidence_message_ids"),
        "FOLLOWUP",
        required=followup is True,
    )

    if opt_out is True and followup is True:
        errors.append("OPT_OUT_FOLLOWUP_CONFLICT")

    return sorted(set(errors))
