import pytest

from voice_worker.security import VoiceTokenError
from voice_worker.security import VoiceTokenSigner


def test_token_roundtrip() -> None:
    signer = VoiceTokenSigner(
        "secret-for-testing",
        60,
    )

    token = signer.issue(
        "fulanitas",
        "call-123",
        "es",
    )

    identity = signer.verify(token)

    assert identity.company_id == "fulanitas"
    assert identity.call_id == "call-123"
    assert identity.language == "es"


def test_tampered_token() -> None:
    signer = VoiceTokenSigner(
        "secret-for-testing",
        60,
    )

    token = signer.issue(
        "fulanitas",
        "call-123",
    )

    payload, signature = token.split(
        ".",
        1,
    )

    with pytest.raises(VoiceTokenError):
        signer.verify(
            f"{payload}x.{signature}"
        )
