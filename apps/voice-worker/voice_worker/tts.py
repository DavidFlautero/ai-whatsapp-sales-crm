from __future__ import annotations

import io
import os
import subprocess
import wave
from pathlib import Path
from tempfile import NamedTemporaryFile


class Synthesizer:
    def __init__(
        self,
        engine: str,
        device: str,
        reference_audio: str | None,
    ) -> None:
        self.engine = engine.strip().lower()
        self.device = device
        self.reference_audio = reference_audio
        self.model = None

        self.piper_model_path = os.getenv(
            "VOICE_PIPER_MODEL",
            (
                "/opt/ventas-ia-mayorista/"
                "apps/voice-worker/models/piper/"
                "es_MX-ald-medium.onnx"
            ),
        )

    def synthesize(
        self,
        text: str,
        language: str,
    ) -> tuple[bytes, str]:
        normalized_text = " ".join(
            text.split()
        ).strip()

        if not normalized_text:
            raise ValueError(
                "No hay texto para sintetizar."
            )

        if self.engine == "piper":
            return self.piper(
                normalized_text
            )

        if self.engine == "chatterbox":
            return self.chatterbox(
                normalized_text,
                language,
            )

        return self.espeak(
            normalized_text,
            language,
        )

    def piper(
        self,
        text: str,
    ) -> tuple[bytes, str]:
        from piper import PiperVoice

        model_path = Path(
            self.piper_model_path
        )

        config_path = Path(
            f"{self.piper_model_path}.json"
        )

        if not model_path.is_file():
            raise RuntimeError(
                "No existe el modelo Piper: "
                f"{model_path}"
            )

        if not config_path.is_file():
            raise RuntimeError(
                "No existe la configuración Piper: "
                f"{config_path}"
            )

        if self.model is None:
            self.model = PiperVoice.load(
                str(model_path),
                config_path=str(config_path),
                use_cuda=False,
            )

        target = io.BytesIO()

        with wave.open(target, "wb") as wav_file:
            self.model.synthesize_wav(
                text,
                wav_file,
            )

        audio = target.getvalue()

        if len(audio) <= 44:
            raise RuntimeError(
                "Piper generó un WAV vacío."
            )

        return audio, "audio/wav"

    def chatterbox(
        self,
        text: str,
        language: str,
    ) -> tuple[bytes, str]:
        import torchaudio as ta

        from chatterbox.mtl_tts import (
            ChatterboxMultilingualTTS,
        )

        if self.model is None:
            self.model = (
                ChatterboxMultilingualTTS
                .from_pretrained(
                    device=self.device,
                    t3_model="v3",
                )
            )

        wav = self.model.generate(
            text,
            language_id=language,
            audio_prompt_path=(
                self.reference_audio
            ),
        )

        with NamedTemporaryFile(
            suffix=".wav"
        ) as target:
            ta.save(
                target.name,
                wav,
                self.model.sr,
            )

            return (
                Path(target.name).read_bytes(),
                "audio/wav",
            )

    def espeak(
        self,
        text: str,
        language: str,
    ) -> tuple[bytes, str]:
        with NamedTemporaryFile(
            suffix=".wav"
        ) as target:
            subprocess.run(
                [
                    "espeak-ng",
                    "-v",
                    language,
                    "-w",
                    target.name,
                    text,
                ],
                check=True,
                timeout=30,
            )

            return (
                Path(target.name).read_bytes(),
                "audio/wav",
            )
