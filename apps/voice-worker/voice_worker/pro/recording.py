from __future__ import annotations

import asyncio
import hashlib
import json
import os
import time
import wave
from dataclasses import asdict, dataclass
from pathlib import Path


@dataclass(slots=True, frozen=True)
class RecordingManifest:
    session_id: str
    company_id: str
    started_at_ms: int
    ended_at_ms: int
    inbound_path: str
    outbound_path: str
    inbound_sha256: str
    outbound_sha256: str
    inbound_bytes: int
    outbound_bytes: int
    sample_rate: int
    consent_basis: str


class CallRecorder:
    """Writes isolated inbound/outbound PCM streams and consent metadata atomically."""

    def __init__(
        self,
        root: str | Path,
        *,
        session_id: str,
        company_id: str,
        sample_rate: int = 16_000,
        enabled: bool = False,
        consent_basis: str = "disabled",
    ) -> None:
        self.root = Path(root)
        self.session_id = session_id
        self.company_id = company_id
        self.sample_rate = sample_rate
        self.enabled = enabled
        self.consent_basis = consent_basis.strip()[:500]
        self.started_at_ms = time.time_ns() // 1_000_000
        self._inbound = bytearray()
        self._outbound = bytearray()
        self._lock = asyncio.Lock()
        self._closed = False

    async def inbound(self, pcm16: bytes) -> None:
        if self.enabled and pcm16:
            async with self._lock:
                if not self._closed:
                    self._inbound.extend(pcm16)

    async def outbound(self, pcm16: bytes) -> None:
        if self.enabled and pcm16:
            async with self._lock:
                if not self._closed:
                    self._outbound.extend(pcm16)

    async def close(self) -> RecordingManifest | None:
        async with self._lock:
            if self._closed or not self.enabled:
                self._closed = True
                return None
            self._closed = True
            inbound = bytes(self._inbound)
            outbound = bytes(self._outbound)
            self._inbound.clear()
            self._outbound.clear()
        return await asyncio.to_thread(self._write, inbound, outbound)

    def _write_wav(self, path: Path, pcm: bytes) -> None:
        temporary = path.with_suffix(".wav.tmp")
        with wave.open(str(temporary), "wb") as handle:
            handle.setnchannels(1)
            handle.setsampwidth(2)
            handle.setframerate(self.sample_rate)
            handle.writeframes(pcm)
        os.chmod(temporary, 0o640)
        temporary.replace(path)

    def _write(self, inbound: bytes, outbound: bytes) -> RecordingManifest:
        day = time.strftime("%Y-%m-%d", time.gmtime(self.started_at_ms / 1000))
        directory = self.root / self.company_id / day / self.session_id
        directory.mkdir(parents=True, exist_ok=True, mode=0o750)
        inbound_path = directory / "inbound.wav"
        outbound_path = directory / "outbound.wav"
        manifest_path = directory / "manifest.json"
        self._write_wav(inbound_path, inbound)
        self._write_wav(outbound_path, outbound)
        manifest = RecordingManifest(
            session_id=self.session_id,
            company_id=self.company_id,
            started_at_ms=self.started_at_ms,
            ended_at_ms=time.time_ns() // 1_000_000,
            inbound_path=str(inbound_path),
            outbound_path=str(outbound_path),
            inbound_sha256=hashlib.sha256(inbound).hexdigest(),
            outbound_sha256=hashlib.sha256(outbound).hexdigest(),
            inbound_bytes=len(inbound),
            outbound_bytes=len(outbound),
            sample_rate=self.sample_rate,
            consent_basis=self.consent_basis,
        )
        temporary = manifest_path.with_suffix(".json.tmp")
        temporary.write_text(json.dumps(asdict(manifest), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        os.chmod(temporary, 0o640)
        temporary.replace(manifest_path)
        return manifest
