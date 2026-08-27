from array import array


def pcm16_to_float32(payload: bytes) -> list[float]:
    if len(payload) % 2:
        raise ValueError("PCM16 payload must contain complete samples")
    samples = array("h")
    samples.frombytes(payload)
    return [sample / 32768.0 for sample in samples]


def join_pcm16(chunks: list[bytes], max_bytes: int) -> bytes:
    payload = b"".join(chunks)
    if len(payload) > max_bytes:
        raise ValueError("audio limit exceeded")
    return payload
