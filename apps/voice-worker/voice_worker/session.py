from dataclasses import dataclass, field


@dataclass(slots=True)
class VoiceSession:
    call_id: str
    company_id: str
    language: str
    audio: list[bytes] = field(default_factory=list)

    def append(self, chunk: bytes, limit: int) -> None:
        if sum(map(len, self.audio)) + len(chunk) > limit:
            raise ValueError("audio limit exceeded")
        self.audio.append(chunk)

    def drain(self) -> bytes:
        payload = b"".join(self.audio)
        self.audio.clear()
        return payload
