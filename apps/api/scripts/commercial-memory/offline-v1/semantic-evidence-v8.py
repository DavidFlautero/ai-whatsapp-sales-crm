import hashlib
import hmac
import re
from collections import defaultdict


def normalized(value):
    return " ".join(str(value).casefold().split())


def literal_supported(value, messages):
    if not isinstance(value, str):
        return False

    needle = normalized(value)

    if len(needle) < 4 or len(needle) > 160:
        return False

    pattern = re.compile(
        r"(?<!\w)" + re.escape(needle) + r"(?!\w)"
    )

    for message in messages:
        body = normalized(message.get("text", ""))

        if pattern.search(body):
            return True

    return False


def keyed_token(secret, *parts):
    if len(secret) != 32:
        raise ValueError("INVALID_PRIVATE_KEY")

    payload = "\0".join(
        str(part) for part in parts
    ).encode("utf-8")

    return hmac.new(
        secret,
        payload,
        hashlib.sha256,
    ).hexdigest()


def consolidate(full, baseline, secret):
    if full["company_id"] != baseline["company_id"]:
        raise ValueError("COMPANY_SCOPE_MISMATCH")

    company = full["company_id"]

    candidate_map = {
        item["contact_fingerprint"]: item
        for item in baseline["candidates"]
    }

    if len(candidate_map) != len(baseline["candidates"]):
        raise ValueError("DUPLICATE_BASELINE_CONTACT")

    results = []

    for case in full["cases"]:
        fingerprint = case["contact_fingerprint"]
        candidate = candidate_map.get(fingerprint)

        if candidate is None:
            raise ValueError("MISSING_BASELINE_CONTACT")

        messages = case["messages"]

        if len(messages) != case["total_messages"]:
            raise ValueError("SOURCE_MESSAGE_COUNT_CHANGED")

        message_map = {
            message["message_id"]: message
            for message in messages
        }

        if len(message_map) != len(messages):
            raise ValueError("DUPLICATE_MESSAGE_ID")

        facts = []

        for index, fact in enumerate(candidate["facts"]):
            if not isinstance(fact, dict):
                raise ValueError("INVALID_FACT_STRUCTURE")

            kind = fact.get("kind")
            value = fact.get("value")
            certainty = fact.get("certainty")
            references = fact.get("message_ids")

            if not isinstance(kind, str):
                raise ValueError("INVALID_FACT_KIND")

            if not isinstance(value, str):
                raise ValueError("INVALID_FACT_VALUE")

            if not isinstance(references, list):
                raise ValueError("INVALID_FACT_REFERENCES")

            if any(
                not isinstance(mid, str)
                for mid in references
            ):
                raise ValueError("INVALID_EVIDENCE_ID")

            ids = list(dict.fromkeys(references))

            found = [
                mid for mid in ids
                if mid in message_map
            ]

            missing = [
                mid for mid in ids
                if mid not in message_map
            ]

            supporting_messages = [
                message_map[mid]
                for mid in found
            ]

            literal_match = literal_supported(
                value,
                supporting_messages,
            )

            reasons = []

            if not ids:
                reasons.append("no_message_references")

            if missing:
                reasons.append("unknown_message_references")

            if not literal_match:
                reasons.append("literal_value_not_verified")

            if len(normalized(value)) < 4:
                reasons.append("ambiguous_short_value")

            safe_kind = (
                kind
                if re.fullmatch(
                    r"[a-zA-Z0-9_:-]{1,60}",
                    kind,
                )
                else "other"
            )

            certainty_class = (
                certainty
                if certainty in (
                    "confirmed",
                    "explicit",
                    "direct",
                    "verified",
                    "inferred",
                    "uncertain",
                    "unknown",
                )
                else "unclassified"
            )

            facts.append({
                "fact_id": keyed_token(
                    secret,
                    company,
                    fingerprint,
                    index,
                    safe_kind,
                    value,
                )[:32],
                "kind": safe_kind,
                "certainty_class": certainty_class,
                "value_token": keyed_token(
                    secret,
                    company,
                    safe_kind,
                    value,
                ),
                "message_ids": found,
                "missing_reference_count": len(missing),
                "literal_value_found": literal_match,
                "status": (
                    "text_anchor_found"
                    if not reasons
                    else "needs_evidence_review"
                ),
                "review_reasons": reasons,
                "possible_conflict": False,
                "human_review_required": True,
            })

        by_kind = defaultdict(set)

        for fact in facts:
            by_kind[fact["kind"]].add(
                fact["value_token"]
            )

        conflicting_kinds = {
            kind
            for kind, values in by_kind.items()
            if len(values) > 1
        }

        for fact in facts:
            if fact["kind"] in conflicting_kinds:
                fact["possible_conflict"] = True

        def evidence_count(field):
            ids = candidate.get(field)

            if not isinstance(ids, list):
                raise ValueError(
                    "INVALID_CANDIDATE_EVIDENCE_FIELD"
                )

            return {
                "provided": len(ids),
                "matched": sum(
                    isinstance(mid, str)
                    and mid in message_map
                    for mid in ids
                ),
            }

        role_evidence = evidence_count(
            "role_evidence_message_ids"
        )

        followup_evidence = evidence_count(
            "followup_evidence_message_ids"
        )

        optout_evidence = evidence_count(
            "opt_out_evidence_message_ids"
        )

        results.append({
            "contact_fingerprint": fingerprint,
            "source_message_count": len(messages),
            "fact_count": len(facts),
            "role_status": (
                "evidence_needs_human_review"
                if role_evidence["provided"] > 0
                else "role_not_evidenced"
            ),
            "role_evidence": role_evidence,
            "followup_evidence": followup_evidence,
            "optout_evidence": optout_evidence,
            "followup_review_candidate": (
                candidate.get("followup_review_candidate")
                is True
            ),
            "opt_out_candidate": (
                candidate.get("opt_out_candidate")
                is True
            ),
            "possible_conflicting_kinds": sorted(
                conflicting_kinds
            ),
            "facts": facts,
            "human_review_required": True,
            "automatically_applied": False,
        })

    if len(results) != len(candidate_map):
        raise ValueError("PILOT_CONTACT_COUNT_MISMATCH")

    fact_total = sum(
        len(case["facts"])
        for case in results
    )

    anchored = sum(
        fact["status"] == "text_anchor_found"
        for case in results
        for fact in case["facts"]
    )

    return {
        "schema_version": 8,
        "company_id": company,
        "mode": "local_evidence_consolidation",
        "case_count": len(results),
        "message_count": sum(
            case["source_message_count"]
            for case in results
        ),
        "fact_count": fact_total,
        "text_anchored_facts": anchored,
        "facts_requiring_review": fact_total - anchored,
        "cases_with_possible_conflicts": sum(
            bool(case["possible_conflicting_kinds"])
            for case in results
        ),
        "cases": results,
        "external_ai_calls": 0,
        "database_writes": 0,
        "automatically_applied": False,
    }
