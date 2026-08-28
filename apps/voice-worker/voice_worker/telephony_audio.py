from __future__ import annotations

import audioop
import io
import wave


class TelephonyAudioError(
    ValueError
):
    pass


class RateConverter:
    def __init__(
        self,
        input_rate: int,
        output_rate: int,
    ) -> None:
        self.input_rate = input_rate
        self.output_rate = output_rate
        self.state = None

    def convert(
        self,
        pcm16: bytes,
    ) -> bytes:
        converted, self.state = audioop.ratecv(
            pcm16,
            2,
            1,
            self.input_rate,
            self.output_rate,
            self.state,
        )

        return converted

    def reset(self) -> None:
        self.state = None


def wav_to_pcm16_mono(
    wav_bytes: bytes,
    output_rate: int,
) -> bytes:
    try:
        with wave.open(
            io.BytesIO(wav_bytes),
            "rb",
        ) as source:
            channels = source.getnchannels()
            width = source.getsampwidth()
            input_rate = source.getframerate()
            frames = source.readframes(
                source.getnframes()
            )
    except (wave.Error, EOFError) as error:
        raise TelephonyAudioError(
            "El TTS no devolvió un WAV válido."
        ) from error

    if width != 2:
        frames = audioop.lin2lin(
            frames,
            width,
            2,
        )

    if channels == 2:
        frames = audioop.tomono(
            frames,
            2,
            0.5,
            0.5,
        )
    elif channels != 1:
        raise TelephonyAudioError(
            f"Canales no soportados: {channels}"
        )

    if input_rate != output_rate:
        frames, _ = audioop.ratecv(
            frames,
            2,
            1,
            input_rate,
            output_rate,
            None,
        )

    return frames


def chunk_pcm(
    pcm16: bytes,
    sample_rate: int,
    milliseconds: int = 20,
) -> list[bytes]:
    frame_size = (
        sample_rate
        * 2
        * milliseconds
        // 1000
    )

    if frame_size <= 0:
        raise TelephonyAudioError(
            "Tamaño de trama inválido."
        )

    return [
        pcm16[offset:offset + frame_size]
        for offset in range(
            0,
            len(pcm16),
            frame_size,
        )
    ]
