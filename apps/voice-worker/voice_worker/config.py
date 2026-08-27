from dataclasses import dataclass
from os import getenv


@dataclass(frozen=True, slots=True)
class Settings:
    host: str = getenv("VOICE_WORKER_HOST", "127.0.0.1")
    port: int = int(getenv("VOICE_WORKER_PORT", "4100"))
    sample_rate: int = int(getenv("VOICE_SAMPLE_RATE", "16000"))
    whisper_model: str = getenv("VOICE_WHISPER_MODEL", "base")
    whisper_device: str = getenv("VOICE_WHISPER_DEVICE", "cpu")
    whisper_compute: str = getenv("VOICE_WHISPER_COMPUTE", "int8")
    tts_engine: str = getenv("VOICE_TTS_ENGINE", "espeak")
    tts_device: str = getenv("VOICE_TTS_DEVICE", "cpu")
    reference_audio: str | None = getenv("VOICE_REFERENCE_AUDIO")
    anthropic_key: str | None = getenv("ANTHROPIC_API_KEY")
    anthropic_model: str = getenv("ANTHROPIC_MODEL", "")
    max_audio_seconds: int = int(getenv("VOICE_MAX_AUDIO_SECONDS", "45"))


settings = Settings()
