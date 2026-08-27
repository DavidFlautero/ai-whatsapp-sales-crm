from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass


class VoiceTokenError(ValueError):
    pass


def encode_base64(value: bytes) -> str:
    return (
        base64.urlsafe_b64encode(value)
        .rstrip(b"=")
        .decode("ascii")
    )


def decode_base64(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)

    return base64.urlsafe_b64decode(
        value + padding
    )


@dataclass(frozen=True, slots=True)
class VoiceIdentity:
    company_id: str
    call_id: str
    language: str
    expires_at: int


class VoiceTokenSigner:
    def __init__(
        self,
        secret: str,
        ttl_seconds: int,
    ) -> None:
        self.secret = secret.encode("utf-8")
        self.ttl_seconds = ttl_seconds

    @property
    def enabled(self) -> bool:
        return bool(self.secret)

    def issue(
        self,
        company_id: str,
        call_id: str,
        language: str = "es",
    ) -> str:
        now = int(time.time())

        payload = {
            "company_id": company_id,
            "call_id": call_id,
            "language": language,
            "iat": now,
            "exp": now + self.ttl_seconds,
        }

        encoded = encode_base64(
            json.dumps(
                payload,
                separators=(",", ":"),
                sort_keys=True,
            ).encode("utf-8")
        )

        signature = hmac.new(
            self.secret,
            encoded.encode("ascii"),
            hashlib.sha256,
        ).digest()

        return (
            f"{encoded}."
            f"{encode_base64(signature)}"
        )

    def verify(
        self,
        token: str,
    ) -> VoiceIdentity:
        if not self.enabled:
            raise VoiceTokenError(
                "Firma de sesiones no configurada."
            )

        try:
            encoded, supplied = token.split(".", 1)

            expected = hmac.new(
                self.secret,
                encoded.encode("ascii"),
                hashlib.sha256,
            ).digest()

            supplied_bytes = decode_base64(
                supplied
            )

            if not hmac.compare_digest(
                expected,
                supplied_bytes,
            ):
                raise VoiceTokenError(
                    "Firma inválida."
                )

            payload = json.loads(
                decode_base64(encoded)
            )
        except VoiceTokenError:
            raise
        except Exception as error:
            raise VoiceTokenError(
                "Token mal formado."
            ) from error

        expires_at = int(
            payload.get("exp", 0)
        )

        if expires_at < int(time.time()):
            raise VoiceTokenError(
                "Token vencido."
            )

        company_id = str(
            payload.get("company_id", "")
        ).strip()

        call_id = str(
            payload.get("call_id", "")
        ).strip()

        if not company_id or not call_id:
            raise VoiceTokenError(
                "Token sin empresa o llamada."
            )

        return VoiceIdentity(
            company_id=company_id,
            call_id=call_id,
            language=str(
                payload.get("language", "es")
            ),
            expires_at=expires_at,
        )
