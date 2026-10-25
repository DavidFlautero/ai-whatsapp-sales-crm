from pathlib import Path
from collections import Counter
from hashlib import sha256
import json

state = Path("/root/.eventos-offline-contacts-stage")
stage = Path(state.read_text().strip()).resolve()
v4 = stage / "v4"

index = json.loads((stage / "source-index.json").read_text())
previous = json.loads(
    (stage / "unmatched-candidates-v3.json").read_text()
)

company = index["company_id"]
known = set(index["external_id_hashes"])

source = Path(
    "/var/www/control/apps/api/data/whapi-webhook.jsonl"
)

if not source.is_file():
    raise RuntimeError("HISTORY_NOT_FOUND")

found = {}
event_types = Counter()
direction_types = Counter()
days = Counter()
channels = Counter()

for line in source.open(encoding="utf-8"):
    try:
        record = json.loads(line)
    except json.JSONDecodeError:
        continue

    payload = record.get("payload", {})

    if not isinstance(payload, dict):
        continue

    event = payload.get("event", {})
    event_type = (
        event.get("type", "unknown")
        if isinstance(event, dict)
        else "unknown"
    )

    entries = payload.get("messages", [])

    if not isinstance(entries, list):
        continue

    for message in entries:
        if not isinstance(message, dict):
            continue

        identifier = message.get("id") or message.get("message_id")

        if not isinstance(identifier, str) or not identifier.strip():
            continue

        digest = sha256(
            f"{company}\0whatsapp\0{identifier.strip()}".encode()
        ).hexdigest()

        if digest in known or digest in found:
            continue

        direction = (
            "outbound" if message.get("from_me") is True
            else "inbound" if message.get("from_me") is False
            else "unknown"
        )

        kind = str(message.get("type", "unknown"))

        nested = message.get("text")
        body = message.get("body")

        if not body and isinstance(nested, dict):
            body = nested.get("body")

        chat_id = (
            message.get("chat_id")
            or message.get("from")
            or message.get("to")
        )

        channel_id = payload.get("channel_id")

        channel_hash = (
            sha256(str(channel_id).encode()).hexdigest()[:16]
            if channel_id else None
        )

        received = str(record.get("received_at") or "")

        entry = {
            "message_hash": digest,
            "provider_type": kind,
            "event_type": event_type,
            "direction": direction,
            "received_day": received[:10],
            "has_text": isinstance(body, str) and bool(body.strip()),
            "has_chat_identifier": bool(chat_id),
            "channel_hash": channel_hash,
            "requires_source_verification": True,
            "eligible_for_automatic_replay": False,
        }

        found[digest] = entry

        event_types[event_type] += 1
        direction_types[(direction, kind)] += 1
        days[received[:10]] += 1
        channels[channel_hash or "not_present"] += 1

if len(found) != previous["candidate_count"]:
    raise RuntimeError(
        "UNMATCHED_COUNT_CHANGED"
    )

inbound_with_text = sum(
    x["direction"] == "inbound" and x["has_text"]
    for x in found.values()
)

inbound_with_identity = sum(
    x["direction"] == "inbound" and x["has_chat_identifier"]
    for x in found.values()
)

report = {
    "schema_version": 4,
    "company_id": company,
    "total_unmatched": len(found),
    "event_types": dict(event_types),
    "directions_by_type": [
        {"direction": d, "type": t, "count": count}
        for (d, t), count in direction_types.items()
    ],
    "received_days": dict(days),
    "channel_hash_counts": dict(channels),
    "inbound_with_text": inbound_with_text,
    "inbound_with_chat_identifier": inbound_with_identity,
    "entries": list(found.values()),
    "automatic_replay": False,
}

target = v4 / "missing-deep-audit.json"

if not target.exists():
    with target.open("x", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2)
    target.chmod(0o600)

print("TOTAL_UNMATCHED:", len(found))
print("EVENT_TYPES:", dict(event_types))
print("RECEIVED_DAYS:", dict(days))
print("CHANNEL_GROUPS:", dict(channels))
print("INBOUND_WITH_TEXT:", inbound_with_text)
print("INBOUND_WITH_CHAT_IDENTIFIER:", inbound_with_identity)
print("RECOVERY_CANDIDATES_REVIEW_REQUIRED")
print("NO_MESSAGE_REPLAY")
