from __future__ import annotations


class Transcriber:
    def __init__(
        self,
        model_name: str,
        device: str,
        compute_type: str,
    ) -> None:
        from faster_whisper import WhisperModel

        self.model = WhisperModel(
            model_name,
            device=device,
            compute_type=compute_type,
        )

    def transcribe(
        self,
        pcm16: bytes,
        sample_rate: int,
        language: str,
    ) -> str:
        import numpy as np

        if not pcm16:
            return ""

        if len(pcm16) % 2:
            raise ValueError(
                "El audio PCM16 contiene una muestra incompleta."
            )

        if sample_rate != 16000:
            raise ValueError(
                "El transcriptor requiere audio PCM16 a 16000 Hz."
            )

        samples = (
            np.frombuffer(
                pcm16,
                dtype=np.int16,
            )
            .astype(np.float32)
            / 32768.0
        )

        segments, information = (
            self.model.transcribe(
                samples,
                language=language,
                beam_size=1,
                vad_filter=False,
                condition_on_previous_text=False,
                without_timestamps=True,
            )
        )

        transcript_parts: list[str] = []

        for segment in segments:
            text = segment.text.strip()

            if text:
                transcript_parts.append(text)

        return " ".join(
            transcript_parts
        ).strip()
