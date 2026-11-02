"""Isolated, revisioned, tenant-owned floor plan storage for Delibocados.
The QR token registry remains in the existing editor; this stores only the physical layout.
"""
from pathlib import Path
from threading import Lock
import json
import os
import re
import tempfile

STORE = Path("/root/neuromind-data/restaurant-floorplan/delibocados.json")
_LOCK = Lock()
IDS = re.compile(r"^[A-Za-z0-9_-]{3,90}$")
KINDS = frozenset(("bar", "door", "bathroom", "stairs"))

def _default():
    return {
        "floors": [{"id": "planta_baja", "name": "Planta baja"}],
        "tables": {},
        "fixtures": [],
    }

def _read_unlocked():
    if not STORE.exists():
        return {"revision": 0, "payload": _default()}
    value = json.loads(STORE.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("PLAN_CORRUPT")
    return value

def get():
    with _LOCK:
        return _read_unlocked()

def _id(value):
    if not isinstance(value, str) or not IDS.fullmatch(value):
        raise ValueError("INVALID_ID")
    return value

def _str(value, maxlen=48):
    if not isinstance(value, str) or not (1 <= len(value.strip()) <= maxlen):
        raise ValueError("INVALID_NAME")
    return value.strip()

def _pos(value):
    if type(value) not in (int, float) or not 3 <= value <= 97:
        raise ValueError("INVALID_POSITION")
    return round(float(value), 2)

def _size(value):
    if type(value) not in (int, float) or not 5 <= value <= 40:
        raise ValueError("INVALID_SIZE")
    return round(float(value), 2)

def _validate(payload):
    if not isinstance(payload, dict) or set(payload) != {"floors", "tables", "fixtures"}:
        raise ValueError("INVALID_PLAN")
    floors = payload["floors"]
    if not isinstance(floors, list) or not 1 <= len(floors) <= 10:
        raise ValueError("INVALID_FLOOR_COUNT")
    allowed_floors = set()
    floor_names = set()
    clean_floors = []
    for floor in floors:
        if not isinstance(floor, dict) or set(floor) != {"id", "name"}:
            raise ValueError("INVALID_FLOOR")
        ident = _id(floor["id"])
        name = _str(floor["name"])
        if ident in allowed_floors or name.casefold() in floor_names:
            raise ValueError("DUPLICATE_FLOOR")
        allowed_floors.add(ident)
        floor_names.add(name.casefold())
        clean_floors.append({"id": ident, "name": name})
    tables = payload["tables"]
    if not isinstance(tables, dict) or len(tables) > 80:
        raise ValueError("INVALID_TABLE_COUNT")
    clean_tables = {}
    for ident, value in tables.items():
        ident = _id(ident)
        if not isinstance(value, dict) or set(value) != {"floor", "x", "y"}:
            raise ValueError("INVALID_TABLE")
        floor = _id(value["floor"])
        if floor not in allowed_floors:
            raise ValueError("UNKNOWN_FLOOR")
        clean_tables[ident] = {
            "floor": floor,
            "x": _pos(value["x"]),
            "y": _pos(value["y"]),
        }
    fixtures = payload["fixtures"]
    if not isinstance(fixtures, list) or len(fixtures) > 160:
        raise ValueError("TOO_MANY_FIXTURES")
    seen = set()
    clean_fixtures = []
    for obj in fixtures:
        if not isinstance(obj, dict) or set(obj) != {"id", "type", "floor", "x", "y", "width", "height", "rotation"}:
            raise ValueError("INVALID_FIXTURE")
        ident = _id(obj["id"])
        typ = obj["type"]
        floor = _id(obj["floor"])
        rotation = obj["rotation"]
        if ident in seen or typ not in KINDS or floor not in allowed_floors:
            raise ValueError("INVALID_FIXTURE")
        if type(rotation) is not int or rotation not in (0, 90, 180, 270):
            raise ValueError("INVALID_ROTATION")
        seen.add(ident)
        clean_fixtures.append({
            "id": ident,
            "type": typ,
            "floor": floor,
            "x": _pos(obj["x"]),
            "y": _pos(obj["y"]),
            "width": _size(obj["width"]),
            "height": _size(obj["height"]),
            "rotation": rotation,
        })
    return {"floors": clean_floors, "tables": clean_tables, "fixtures": clean_fixtures}

def save(request):
    if not isinstance(request, dict) or set(request) != {"revision", "payload"}:
        raise ValueError("INVALID_REQUEST")
    revision = request["revision"]
    if type(revision) is not int or revision < 0:
        raise ValueError("INVALID_REVISION")
    clean = _validate(request["payload"])
    with _LOCK:
        previous = _read_unlocked()
        if revision != previous.get("revision"):
            raise RuntimeError("PLAN_REVISION_CONFLICT")
        result = {"revision": revision + 1, "payload": clean}
        STORE.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        STORE.parent.chmod(0o700)
        fd, temp = tempfile.mkstemp(prefix=".plan-", suffix=".tmp", dir=str(STORE.parent))
        try:
            os.fchmod(fd, 0o600)
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(result, f, ensure_ascii=False, separators=(",", ":"))
                f.flush()
                os.fsync(f.fileno())
            os.replace(temp, STORE)
        finally:
            if os.path.exists(temp):
                os.unlink(temp)
        return result
