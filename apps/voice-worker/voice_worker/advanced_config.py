from __future__ import annotations

import os
from dataclasses import dataclass


def env_int(
    name: str,
    default: int,
) -> int:
    return int(
        os.getenv(name, str(default)).strip()
    )


def env_float(
    name: str,
    default: float,
) -> float:
    return float(
        os.getenv(name, str(default)).strip()
    )


def env_bool(
    name: str,
    default: bool = False,
) -> bool:
    value = os.getenv(name)

    if value is None:
        return default

    return value.strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


@dataclass(frozen=True, slots=True)
class AdvancedSettings:
    bind_host: str = os.getenv(
        "VOICE_BIND_HOST",
        "127.0.0.1",
    )
    http_port: int = env_int(
        "VOICE_HTTP_PORT",
        4100,
    )
    audiosocket_host: str = os.getenv(
        "VOICE_AUDIOSOCKET_HOST",
        "127.0.0.1",
    )
    audiosocket_port: int = env_int(
        "VOICE_AUDIOSOCKET_PORT",
        9019,
    )
    worker_secret: str = os.getenv(
        "VOICE_WORKER_SECRET",
        "",
    )
    allow_unsafe_demo: bool = env_bool(
        "VOICE_ALLOW_UNSAFE_DEMO",
        False,
    )
    token_ttl_seconds: int = env_int(
        "VOICE_TOKEN_TTL_SECONDS",
        300,
    )
    max_sessions: int = env_int(
        "VOICE_MAX_SESSIONS",
        1,
    )
    inference_timeout_seconds: int = env_int(
        "VOICE_INFERENCE_TIMEOUT_SECONDS",
        60,
    )
    idle_timeout_seconds: int = env_int(
        "VOICE_IDLE_TIMEOUT_SECONDS",
        180,
    )
    sample_rate: int = env_int(
        "VOICE_SAMPLE_RATE",
        16000,
    )
    vad_start_threshold: float = env_float(
        "VOICE_VAD_START_THRESHOLD",
        0.62,
    )
    vad_end_threshold: float = env_float(
        "VOICE_VAD_END_THRESHOLD",
        0.38,
    )
    vad_start_frames: int = env_int(
        "VOICE_VAD_START_FRAMES",
        2,
    )
    vad_silence_frames: int = env_int(
        "VOICE_VAD_SILENCE_FRAMES",
        20,
    )
    vad_max_turn_seconds: int = env_int(
        "VOICE_VAD_MAX_TURN_SECONDS",
        25,
    )
    vad_preroll_frames: int = env_int(
        "VOICE_VAD_PREROLL_FRAMES",
        8,
    )
    callback_url: str = os.getenv(
        "VOICE_CALLBACK_URL",
        "",
    ).rstrip("/")
    callback_token: str = os.getenv(
        "VOICE_CALLBACK_TOKEN",
        "",
    )
    callback_timeout_seconds: float = env_float(
        "VOICE_CALLBACK_TIMEOUT_SECONDS",
        5,
    )

    def validate(self) -> None:
        if (
            not self.worker_secret
            and not self.allow_unsafe_demo
        ):
            raise RuntimeError(
                "Definí VOICE_WORKER_SECRET o "
                "VOICE_ALLOW_UNSAFE_DEMO=true."
            )

        if self.sample_rate != 16000:
            raise RuntimeError(
                "VOICE_SAMPLE_RATE debe ser 16000."
            )

        if self.max_sessions < 1:
            raise RuntimeError(
                "VOICE_MAX_SESSIONS debe ser mayor que cero."
            )


settings = AdvancedSettings()
