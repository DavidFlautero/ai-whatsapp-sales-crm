from __future__ import annotations

import asyncio
import base64
import binascii
import hashlib
import io
import json
import os
import re
import time
import uuid
import wave
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


_SAFE_ID = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$")


@dataclass(slots=True, frozen=True)
class VoiceProfile:
    id: str
    company_id: str
    name: str
    language: str
    consent_text: str
    consented_by: str
    created_at_ms: int
    audio_path: str
    audio_sha256: str
    duration_ms: int
    sample_rate: int
    channels: int
    active: bool = True


class VoiceProfileStore:
    """Consent-first local enrollment store; cloning is delegated to an external TTS gateway."""

    def __init__(self, root: str | Path, *, max_audio_bytes: int = 12_000_000) -> None:
        self.root = Path(root)
        self.max_audio_bytes = max_audio_bytes
        self._lock = asyncio.Lock()

    @staticmethod
    def _validate_tenant(company_id: str) -> str:
        value = company_id.strip()
        if not _SAFE_ID.fullmatch(value):
            raise ValueError("company_id contiene caracteres no permitidos.")
        return value

    @staticmethod
    def _inspect_wav(audio: bytes) -> tuple[int, int, int]:
        try:
            with wave.open(io.BytesIO(audio), "rb") as handle:
                channels = handle.getnchannels()
                sample_rate = handle.getframerate()
                frames = handle.getnframes()
                width = handle.getsampwidth()
        except (wave.Error, EOFError) as exc:
            raise ValueError("La muestra debe ser WAV PCM válido.") from exc
        if channels not in {1, 2} or width != 2:
            raise ValueError("La muestra debe ser PCM16 mono o estéreo.")
        if not 8_000 <= sample_rate <= 48_000:
            raise ValueError("La frecuencia de la muestra debe estar entre 8 y 48 kHz.")
        duration_ms = round(frames * 1000 / sample_rate)
        if not 3_000 <= duration_ms <= 180_000:
            raise ValueError("La muestra debe durar entre 3 y 180 segundos.")
        return duration_ms, sample_rate, channels

    async def enroll_base64(
        self,
        *,
        company_id: str,
        name: str,
        language: str,
        audio_base64: str,
        consent_text: str,
        consented_by: str,
    ) -> VoiceProfile:
        company_id = self._validate_tenant(company_id)
        name = name.strip()
        consent_text = consent_text.strip()
        consented_by = consented_by.strip()
        if len(name) < 2 or len(name) > 100:
            raise ValueError("El nombre debe tener entre 2 y 100 caracteres.")
        if language not in {"es", "en", "pt", "it"}:
            raise ValueError("Idioma de perfil no soportado.")
        if len(consent_text) < 20 or len(consented_by) < 2:
            raise ValueError("Se requiere consentimiento explícito y responsable identificable.")
        try:
            audio = base64.b64decode(audio_base64, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise ValueError("audio_base64 no es base64 válido.") from exc
        if not audio or len(audio) > self.max_audio_bytes:
            raise ValueError("La muestra está vacía o supera el tamaño permitido.")
        duration_ms, sample_rate, channels = self._inspect_wav(audio)
        profile_id = str(uuid.uuid4())
        created_at = time.time_ns() // 1_000_000
        digest = hashlib.sha256(audio).hexdigest()
        tenant_dir = self.root / company_id
        audio_path = tenant_dir / f"{profile_id}.wav"
        manifest_path = tenant_dir / f"{profile_id}.json"
        profile = VoiceProfile(
            id=profile_id,
            company_id=company_id,
            name=name,
            language=language,
            consent_text=consent_text,
            consented_by=consented_by,
            created_at_ms=created_at,
            audio_path=str(audio_path),
            audio_sha256=digest,
            duration_ms=duration_ms,
            sample_rate=sample_rate,
            channels=channels,
        )
        async with self._lock:
            await asyncio.to_thread(self._write_profile, profile, audio_path, manifest_path, audio)
        return profile

    @staticmethod
    def _write_profile(
        profile: VoiceProfile,
        audio_path: Path,
        manifest_path: Path,
        audio: bytes,
    ) -> None:
        audio_path.parent.mkdir(parents=True, exist_ok=True, mode=0o750)
        temp_audio = audio_path.with_suffix(".wav.tmp")
        temp_manifest = manifest_path.with_suffix(".json.tmp")
        temp_audio.write_bytes(audio)
        os.chmod(temp_audio, 0o640)
        temp_manifest.write_text(
            json.dumps(asdict(profile), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        os.chmod(temp_manifest, 0o640)
        temp_audio.replace(audio_path)
        temp_manifest.replace(manifest_path)

    async def list(self, company_id: str) -> list[dict[str, Any]]:
        company_id = self._validate_tenant(company_id)
        async with self._lock:
            return await asyncio.to_thread(self._list_sync, company_id)

    def _list_sync(self, company_id: str) -> list[dict[str, Any]]:
        tenant_dir = self.root / company_id
        if not tenant_dir.is_dir():
            return []
        profiles: list[dict[str, Any]] = []
        for path in tenant_dir.glob("*.json"):
            try:
                value = json.loads(path.read_text(encoding="utf-8"))
                value.pop("consent_text", None)
                value.pop("audio_path", None)
                profiles.append(value)
            except (OSError, json.JSONDecodeError):
                continue
        return sorted(profiles, key=lambda item: int(item.get("created_at_ms", 0)), reverse=True)

    async def deactivate(self, company_id: str, profile_id: str) -> bool:
        company_id = self._validate_tenant(company_id)
        try:
            uuid.UUID(profile_id)
        except ValueError as exc:
            raise ValueError("profile_id inválido.") from exc
        async with self._lock:
            return await asyncio.to_thread(self._deactivate_sync, company_id, profile_id)

    def _deactivate_sync(self, company_id: str, profile_id: str) -> bool:
        path = self.root / company_id / f"{profile_id}.json"
        if not path.is_file():
            return False
        value = json.loads(path.read_text(encoding="utf-8"))
        value["active"] = False
        temp = path.with_suffix(".json.tmp")
        temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        os.chmod(temp, 0o640)
        temp.replace(path)
        return True
