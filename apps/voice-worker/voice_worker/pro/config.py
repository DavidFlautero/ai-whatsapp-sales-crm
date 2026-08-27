from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


SUPPORTED_LANGUAGES = ("es", "en", "pt", "it")


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on", "si", "sí"}


def _env_int(name: str, default: int, minimum: int, maximum: int) -> int:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    value = int(raw)
    if not minimum <= value <= maximum:
        raise ValueError(f"{name} debe estar entre {minimum} y {maximum}")
    return value


def _env_float(name: str, default: float, minimum: float, maximum: float) -> float:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    value = float(raw)
    if not minimum <= value <= maximum:
        raise ValueError(f"{name} debe estar entre {minimum} y {maximum}")
    return value


def _env_csv(name: str, default: tuple[str, ...]) -> tuple[str, ...]:
    raw = os.getenv(name)
    if not raw:
        return default
    values = tuple(dict.fromkeys(part.strip().lower() for part in raw.split(",") if part.strip()))
    return values or default


@dataclass(slots=True, frozen=True)
class ProVoiceConfig:
    environment: str = "development"
    company_id: str = "demo"
    sample_rate: int = 16_000
    frame_ms: int = 20
    supported_languages: tuple[str, ...] = field(default_factory=lambda: SUPPORTED_LANGUAGES)
    default_language: str = "es"
    auto_detect_language: bool = True

    vad_start_frames: int = 3
    vad_end_silence_ms: int = 420
    vad_min_speech_ms: int = 180
    vad_max_utterance_ms: int = 30_000
    vad_margin_db: float = 11.0

    stt_provider: str = "faster_whisper"
    stt_model: str = "large-v3-turbo"
    stt_device: str = "auto"
    stt_compute_type: str = "int8"
    stt_partial_interval_ms: int = 700
    stt_cpu_threads: int = 2
    stt_queue_timeout_seconds: float = 15.0
    stt_preload: bool = True
    stt_warmup_timeout_seconds: int = 120

    llm_provider: str = "anthropic"
    llm_model: str = "claude-sonnet-4-20250514"
    llm_timeout_seconds: int = 25
    llm_max_tokens: int = 300

    tts_provider: str = "piper"
    tts_gateway_url: str = ""
    tts_voice_id: str = "default"
    piper_binary: str = "piper"
    piper_model_path: str = ""
    tts_sentence_min_chars: int = 28
    tts_sentence_max_chars: int = 150

    internal_api_url: str = "http://127.0.0.1:4000"
    internal_api_token: str = ""
    websocket_token: str = ""
    memory_ttl_seconds: int = 3600
    memory_max_messages: int = 40
    recordings_dir: Path = Path("/opt/ventas-ia-mayorista/data/voice-recordings")

    @classmethod
    def from_env(cls) -> "ProVoiceConfig":
        config = cls(
            environment=os.getenv("VOICE_ENVIRONMENT", "development").strip(),
            company_id=os.getenv("VOICE_DEFAULT_COMPANY_ID", "demo").strip() or "demo",
            sample_rate=_env_int("VOICE_SAMPLE_RATE", 16_000, 8_000, 48_000),
            frame_ms=_env_int("VOICE_FRAME_MS", 20, 10, 100),
            supported_languages=_env_csv("VOICE_LANGUAGES", SUPPORTED_LANGUAGES),
            default_language=os.getenv("VOICE_DEFAULT_LANGUAGE", "es").strip().lower(),
            auto_detect_language=_env_bool("VOICE_AUTO_DETECT_LANGUAGE", True),
            vad_start_frames=_env_int("VOICE_VAD_START_FRAMES", 3, 1, 20),
            vad_end_silence_ms=_env_int("VOICE_VAD_END_SILENCE_MS", 420, 120, 2_000),
            vad_min_speech_ms=_env_int("VOICE_VAD_MIN_SPEECH_MS", 180, 80, 2_000),
            vad_max_utterance_ms=_env_int("VOICE_VAD_MAX_UTTERANCE_MS", 30_000, 2_000, 120_000),
            vad_margin_db=_env_float("VOICE_VAD_MARGIN_DB", 11.0, 3.0, 30.0),
            stt_provider=os.getenv("VOICE_STT_PROVIDER", "faster_whisper").strip().lower(),
            stt_model=os.getenv("VOICE_STT_MODEL", "large-v3-turbo").strip(),
            stt_device=os.getenv("VOICE_STT_DEVICE", "auto").strip().lower(),
            stt_compute_type=os.getenv("VOICE_STT_COMPUTE_TYPE", "int8").strip().lower(),
            stt_partial_interval_ms=_env_int("VOICE_STT_PARTIAL_INTERVAL_MS", 700, 200, 5_000),
            stt_cpu_threads=_env_int("VOICE_STT_CPU_THREADS", 2, 1, 16),
            stt_queue_timeout_seconds=_env_float("VOICE_STT_QUEUE_TIMEOUT_SECONDS", 15.0, 1.0, 120.0),
            stt_preload=_env_bool("VOICE_STT_PRELOAD", True),
            stt_warmup_timeout_seconds=_env_int("VOICE_STT_WARMUP_TIMEOUT_SECONDS", 120, 5, 600),
            llm_provider=os.getenv("VOICE_LLM_PROVIDER", "anthropic").strip().lower(),
            llm_model=os.getenv("VOICE_LLM_MODEL", os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")).strip(),
            llm_timeout_seconds=_env_int("VOICE_LLM_TIMEOUT_SECONDS", 25, 3, 120),
            llm_max_tokens=_env_int("VOICE_LLM_MAX_TOKENS", 300, 40, 2_000),
            tts_provider=os.getenv("VOICE_TTS_PROVIDER", "piper").strip().lower(),
            tts_gateway_url=os.getenv("VOICE_TTS_GATEWAY_URL", "").strip().rstrip("/"),
            tts_voice_id=os.getenv("VOICE_TTS_VOICE_ID", "default").strip(),
            piper_binary=os.getenv("PIPER_BINARY", "piper").strip(),
            piper_model_path=os.getenv("PIPER_MODEL_PATH", "").strip(),
            tts_sentence_min_chars=_env_int("VOICE_TTS_MIN_CHARS", 28, 5, 100),
            tts_sentence_max_chars=_env_int("VOICE_TTS_MAX_CHARS", 150, 40, 500),
            internal_api_url=os.getenv("VOICE_INTERNAL_API_URL", "http://127.0.0.1:4000").strip().rstrip("/"),
            internal_api_token=os.getenv("VOICE_INTERNAL_API_TOKEN", "").strip(),
            websocket_token=os.getenv("VOICE_WEBSOCKET_TOKEN", "").strip(),
            memory_ttl_seconds=_env_int("VOICE_MEMORY_TTL_SECONDS", 3600, 60, 86_400),
            memory_max_messages=_env_int("VOICE_MEMORY_MAX_MESSAGES", 40, 6, 200),
            recordings_dir=Path(os.getenv("VOICE_RECORDINGS_DIR", "/opt/ventas-ia-mayorista/data/voice-recordings")),
        )
        config.validate()
        return config

    def validate(self) -> None:
        unsupported = set(self.supported_languages) - set(SUPPORTED_LANGUAGES)
        if unsupported:
            raise ValueError(f"Idiomas no soportados: {sorted(unsupported)}")
        if self.default_language not in self.supported_languages:
            raise ValueError("VOICE_DEFAULT_LANGUAGE debe estar dentro de VOICE_LANGUAGES")
        if self.tts_provider == "chatterbox_http" and not self.tts_gateway_url:
            raise ValueError("VOICE_TTS_GATEWAY_URL es obligatorio para chatterbox_http")
        if self.tts_provider == "piper" and not self.piper_model_path:
            # The legacy runtime may inject its model later.  Fail only in production.
            if self.environment == "production":
                raise ValueError("PIPER_MODEL_PATH es obligatorio en producción")

    def public_dict(self) -> dict[str, object]:
        return {
            "environment": self.environment,
            "company_id": self.company_id,
            "sample_rate": self.sample_rate,
            "frame_ms": self.frame_ms,
            "languages": self.supported_languages,
            "auto_detect_language": self.auto_detect_language,
            "stt_provider": self.stt_provider,
            "stt_model": self.stt_model,
            "stt_preload": self.stt_preload,
            "stt_cpu_threads": self.stt_cpu_threads,
            "tts_provider": self.tts_provider,
            "tts_voice_id": self.tts_voice_id,
        }
