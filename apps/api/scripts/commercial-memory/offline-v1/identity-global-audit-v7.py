import json
import hashlib
import sys
from pathlib import Path
from collections import defaultdict


def evaluate(anchors_data, registry_data, links_data):
    anchors = anchors_data["anchors"]
    records = registry_data["records"]
    results = links_data["results"]

    if not (
        len(anchors) ==
        len(results) ==
        links_data["contact_groups"]
    ):
        raise ValueError("SOURCE_TOTAL_MISMATCH")

    anchor_by_fingerprint = {
        row["fingerprint"]: row
        for row in anchors
    }

    if len(anchor_by_fingerprint) != len(anchors):
        raise ValueError("DUPLICATED_SOURCE_FINGERPRINT")

    registry = {
        (str(row["table"]), str(row["id"])): row
        for row in records
    }

    if len(registry) != len(records):
        raise ValueError("DUPLICATED_OFFICIAL_RECORD")

    usage = defaultdict(list)
    items = []

    for result in results:
        fingerprint = result["fingerprint"]
        anchor = anchor_by_fingerprint.get(fingerprint)

        if anchor is None:
            raise ValueError("UNKNOWN_SOURCE_FINGERPRINT")

        by_table = {}

        for proposal in result["proposals"]:
            table = proposal["table"]

            if table in by_table:
                raise ValueError("DUPLICATED_TABLE_PROPOSAL")

            by_table[table] = proposal

        reasons = []
        resolved = {}

        for table in (
            "crm_contacts",
            "crm_memory_identities",
        ):
            proposal = by_table.get(table)

            if proposal is None:
                reasons.append(f"MISSING_{table}")
                continue

            candidates = proposal["candidates"]

            if len(candidates) != 1:
                reasons.append(f"AMBIGUOUS_{table}")
                continue

            candidate = candidates[0]
            record_id = str(candidate["id"])

            record = registry.get((table, record_id))

            if record is None:
                reasons.append(f"UNKNOWN_ID_{table}")
                continue

            source_tokens = set(
                anchor.get("phone_tokens") or []
            )

            official_tokens = set(
                record.get("phone_tokens") or []
            )

            same_phone = bool(
                source_tokens & official_tokens
            )

            if not same_phone:
                reasons.append(f"PHONE_MISMATCH_{table}")

            if "same_phone_token" not in candidate["reasons"]:
                reasons.append(f"PHONE_REASON_MISSING_{table}")

            if table == "crm_contacts":
                if str(anchor.get("contact_id")) != record_id:
                    reasons.append("CRM_CONTACT_ID_MISMATCH")

                if "same_internal_id" not in candidate["reasons"]:
                    reasons.append("INTERNAL_ID_REASON_MISSING")

            resolved[table] = record_id

            usage[(table, record_id)].append(fingerprint)

        items.append({
            "fingerprint": fingerprint,
            "crm_contact_id": resolved.get("crm_contacts"),
            "memory_identity_id": resolved.get(
                "crm_memory_identities"
            ),
            "reasons": sorted(set(reasons)),
        })

    for item in items:
        for table, field in (
            ("crm_contacts", "crm_contact_id"),
            ("crm_memory_identities", "memory_identity_id"),
        ):
            record_id = item.get(field)

            if record_id and len(
                usage[(table, record_id)]
            ) > 1:
                item["reasons"].append(
                    f"SHARED_TARGET_{table}"
                )

        item["reasons"] = sorted(set(item["reasons"]))

        item["status"] = (
            "corroborated_candidate"
            if not item["reasons"]
            else "requires_review"
        )

    if len({i["fingerprint"] for i in items}) != len(items):
        raise ValueError("DUPLICATED_AUDIT_RESULT")

    supported = sum(
        item["status"] == "corroborated_candidate"
        for item in items
    )

    return {
        "contact_groups": len(items),
        "counts": {
            "corroborated_candidates": supported,
            "requires_review": len(items) - supported,
        },
        "items": sorted(
            items,
            key=lambda item: item["fingerprint"],
        ),
        "automatically_applied": False,
        "crm_writes": 0,
    }


def main():
    stage = Path(sys.argv[1]).resolve()

    if (
        stage.parent != Path(
            "/var/backups/eventos-commercial-memory"
        )
        or not stage.name.startswith("offline-contacts-")
    ):
        raise RuntimeError("INVALID_STAGE")

    v7 = stage / "v7"

    names = [
        "contact-anchors.json",
        "official-contact-registry.json",
        "identity-link-proposals.json",
    ]

    payloads = []
    hashes = {}

    for name in names:
        source = v7 / name

        if source.stat().st_mode & 0o077:
            raise RuntimeError("UNSAFE_FILE_PERMISSIONS")

        raw = source.read_bytes()
        hashes[name] = hashlib.sha256(raw).hexdigest()
        payloads.append(json.loads(raw))

    manifest = json.loads(
        (v7 / "manifest.json").read_text()
    )

    company = manifest["company_id"]

    if any(
        data["company_id"] != company
        for data in payloads
    ):
        raise RuntimeError("COMPANY_MISMATCH")

    result = evaluate(*payloads)

    result["company_id"] = company
    result["source_hashes"] = hashes
    result["schema_version"] = 7

    destination = v7 / "identity-global-audit.json"

    if destination.exists():
        previous = json.loads(destination.read_text())

        if previous != result:
            raise RuntimeError("EXISTING_AUDIT_DIFFERS")

        print("GLOBAL_AUDIT_ALREADY_VALID")

    else:
        with destination.open(
            "x",
            encoding="utf-8",
        ) as handle:
            json.dump(result, handle, indent=2)

        destination.chmod(0o600)
        print("GLOBAL_AUDIT_CREATED")

    print("CONTACTS:", result["contact_groups"])
    print(
        "CORROBORATED_CANDIDATES:",
        result["counts"]["corroborated_candidates"],
    )
    print(
        "REQUIRES_REVIEW:",
        result["counts"]["requires_review"],
    )
    print("NO_CRM_WRITES")


if __name__ == "__main__":
    main()
