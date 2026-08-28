from collections.abc import Sequence


class SpeechDetector:
    def __init__(self, sample_rate: int) -> None:
        from silero_vad import load_silero_vad

        self.sample_rate = sample_rate
        self.model = load_silero_vad(onnx=True)

    def probability(self, samples: Sequence[float]) -> float:
        import torch

        expected = 512 if self.sample_rate == 16000 else 256
        if len(samples) != expected:
            return 0.0
        tensor = torch.tensor(samples, dtype=torch.float32)
        return float(self.model(tensor, self.sample_rate).item())

    def reset(self) -> None:
        reset = getattr(self.model, "reset_states", None)
        if callable(reset):
            reset()
