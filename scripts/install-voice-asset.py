from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import shutil
import sys
import tempfile
import time
import zlib
from pathlib import Path


def decode(expected: str) -> bytes:
    encoded = "".join(sys.stdin.read().split())
    compressed = base64.b64decode(encoded, validate=True)
    data = zlib.decompress(compressed)
    actual = hashlib.sha256(data).hexdigest()
    if actual != expected:
        raise RuntimeError(f"SHA incorrecto: esperado={expected}, recibido={actual}")
    return data


def atomic_write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.read_bytes() == data:
        print(f"SIN_CAMBIOS={path}")
        return
    if path.exists():
        backup = path.with_name(f"{path.name}.before-pro-{int(time.time())}")
        shutil.copy2(path, backup)
        print(f"BACKUP={backup}")
    handle, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(handle, "wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temporary, 0o644)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    print(f"INSTALADO={path}")


if len(sys.argv) >= 2 and sys.argv[1] == "--bundle-json":
    destination = Path(sys.argv[2])
    payload = json.loads(decode(sys.argv[3]).decode("utf-8"))
    for filename, content in payload.items():
        if not re.fullmatch(r"[A-Za-z0-9_.-]+", filename):
            raise RuntimeError(f"Nombre inseguro: {filename}")
        if not isinstance(content, str):
            raise RuntimeError(f"Contenido inválido: {filename}")
        atomic_write(destination / filename, content.encode("utf-8"))
else:
    if len(sys.argv) != 3:
        raise SystemExit("uso: install-voice-asset.py TARGET SHA256")
    atomic_write(Path(sys.argv[1]), decode(sys.argv[2]))
