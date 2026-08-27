from __future__ import annotations

from voice_worker.pro.config import ProVoiceConfig


def test_config_supports_required_languages(monkeypatch) -> None:
    monkeypatch.setenv("VOICE_LANGUAGES", "es,en,pt,it")
    monkeypatch.setenv("VOICE_ENVIRONMENT", "development")
    monkeypatch.setenv("VOICE_DEFAULT_LANGUAGE", "es")
    monkeypatch.setenv("VOICE_TTS_PROVIDER", "piper")
    monkeypatch.setenv("PIPER_MODEL_PATH", "")
    config = ProVoiceConfig.from_env()
    assert config.supported_languages == ("es", "en", "pt", "it")
    assert config.auto_detect_language is True
