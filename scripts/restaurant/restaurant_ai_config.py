"""Encrypted, restaurant-scoped settings for WhatsApp/AI. No provider connection until runtime is explicitly wired."""
from pathlib import Path
from threading import Lock
import json
import os
import re
import subprocess

DATA = Path("/root/neuromind-data/restaurant-ai/delibocados")
KEY = Path("/root/neuromind-data/restaurant-ai/secret.key")
STORE = DATA / "settings.enc.json"
CRYPTO = Path("/var/www/delibocados-owner/restaurant_ai_crypto.cjs")
LOCK = Lock()

DEFAULT_PROMPT = (
    "Sos el asistente de Delibocados, restaurante en Funza, Colombia. "
    "Respondé en español claro, breve y amable. "
    "No inventes precios, disponibilidad, promociones ni tiempos de entrega. "
    "Consultá el menú actualizado antes de cotizar. "
    "Preguntá dirección y barrio si es domicilio. "
    "Nunca confirmes un pedido, pago o envío al POS sin respuesta exitosa de la herramienta correspondiente. "
    "Si la operación no está disponible o el cliente lo pide, derivá a una persona."
)

def defaults():
    return {
        "ai": {
            "provider": "openai",
            "modelOpenai": "gpt-4.1-mini",
            "modelAnthropic": "claude-sonnet-4-5",
            "openaiApiKey": "",
            "anthropicApiKey": "",
            "prompt": DEFAULT_PROMPT,
            "replyStyle": "conciso",
            "humanHandoff": True,
            "outOfHours": False,
        },
        "whatsapp": {
            "provider": "whapi",
            "businessPhone": "",
            "token": "",
            "verifyToken": "",
            "phoneNumberId": "",
            "businessAccountId": "",
            "webhookUrl": "",
        },
    }

def _crypto(mode, value):
    proc = subprocess.run(
        ["node", str(CRYPTO), mode, str(KEY)],
        input=json.dumps(value, ensure_ascii=False), text=True,
        capture_output=True, timeout=8,
    )
    if proc.returncode or not proc.stdout:
        raise RuntimeError("ENCRYPTED_SETTINGS_UNAVAILABLE")
    return json.loads(proc.stdout)

def read():
    settings = defaults()
    if not STORE.exists():
        return settings
    raw = _crypto("decrypt", json.loads(STORE.read_text()))
    for section in ("ai", "whatsapp"):
        if isinstance(raw.get(section), dict):
            settings[section].update(raw[section])
    return settings

def public():
    with LOCK:
        cfg = read()
    ai, wa = cfg["ai"], cfg["whatsapp"]
    return {
        "ok": True, "companyId": "delibocados", "runtimeConnected": False,
        "ai": {
            "provider": ai["provider"],
            "modelOpenai": ai["modelOpenai"],
            "modelAnthropic": ai["modelAnthropic"],
            "openaiKeyConfigured": bool(ai["openaiApiKey"]),
            "anthropicKeyConfigured": bool(ai["anthropicApiKey"]),
            "prompt": ai["prompt"],
            "replyStyle": ai["replyStyle"],
            "humanHandoff": ai["humanHandoff"],
            "outOfHours": ai["outOfHours"],
        },
        "whatsapp": {
            "provider": wa["provider"],
            "businessPhone": wa["businessPhone"],
            "tokenConfigured": bool(wa["token"]),
            "verifyTokenConfigured": bool(wa["verifyToken"]),
            "phoneNumberId": wa["phoneNumberId"],
            "businessAccountId": wa["businessAccountId"],
            "webhookUrl": wa["webhookUrl"],
        },
    }

def _string(value, field, size, regex=None):
    if not isinstance(value, str) or len(value) > size:
        raise ValueError("INVALID_" + field)
    value = value.strip()
    if regex and value and not re.fullmatch(regex, value):
        raise ValueError("INVALID_" + field)
    return value

def _bool(value, field):
    if not isinstance(value, bool):
        raise ValueError("INVALID_" + field)
    return value

def save(body):
    if not isinstance(body, dict) or set(body) - {"ai", "whatsapp"}:
        raise ValueError("INVALID_CONFIG_PAYLOAD")
    if not body:
        raise ValueError("EMPTY_CONFIG_PAYLOAD")
    with LOCK:
        cfg = read()
        incoming_ai = body.get("ai")
        if incoming_ai is not None:
            if not isinstance(incoming_ai, dict) or set(incoming_ai) - {
                "provider", "modelOpenai", "modelAnthropic", "openaiApiKey", "anthropicApiKey",
                "prompt", "replyStyle", "humanHandoff", "outOfHours"
            }:
                raise ValueError("INVALID_AI_CONFIG")
            ai = cfg["ai"]
            for field, value in incoming_ai.items():
                if field == "provider":
                    if value not in ("openai", "anthropic"):
                        raise ValueError("INVALID_AI_PROVIDER")
                    ai[field] = value
                elif field in ("modelOpenai", "modelAnthropic"):
                    s = _string(value, field, 120, r"[A-Za-z0-9._:/-]{2,120}")
                    if not s:
                        raise ValueError("EMPTY_AI_MODEL")
                    ai[field] = s
                elif field in ("openaiApiKey", "anthropicApiKey"):
                    value = _string(value, field, 4000)
                    if value:
                        ai[field] = value
                elif field == "prompt":
                    value = _string(value, field, 8000)
                    if len(value) < 25:
                        raise ValueError("PROMPT_TOO_SHORT")
                    ai[field] = value
                elif field == "replyStyle":
                    if value not in ("conciso", "detallado", "formal"):
                        raise ValueError("INVALID_REPLY_STYLE")
                    ai[field] = value
                else:
                    ai[field] = _bool(value, field)
        incoming_wa = body.get("whatsapp")
        if incoming_wa is not None:
            if not isinstance(incoming_wa, dict) or set(incoming_wa) - {
                "provider", "businessPhone", "token", "verifyToken", "phoneNumberId", "businessAccountId"
            }:
                raise ValueError("INVALID_WHATSAPP_CONFIG")
            wa = cfg["whatsapp"]
            for field, value in incoming_wa.items():
                if field == "provider":
                    if value not in ("whapi", "meta_cloud", "whappi"):
                        raise ValueError("INVALID_WHATSAPP_PROVIDER")
                    wa[field] = value
                elif field == "businessPhone":
                    wa[field] = _string(value, field, 20, r"\+?[0-9]{7,17}")
                elif field in ("token", "verifyToken"):
                    value = _string(value, field, 4000)
                    if value:
                        wa[field] = value
                else:
                    wa[field] = _string(value, field, 140, r"[A-Za-z0-9._:-]*")
        for section in ("ai", "whatsapp"):
            for key, value in cfg[section].items():
                if not isinstance(value, (str, bool)):
                    raise ValueError("INVALID_SETTINGS_STATE")
        envelope = _crypto("encrypt", cfg)
        DATA.mkdir(parents=True, exist_ok=True, mode=0o700)
        DATA.chmod(0o700)
        tmp = DATA / ("settings." + str(os.getpid()) + ".tmp")
        fd = os.open(str(tmp), os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0), 0o600)
        try:
            with os.fdopen(fd, "w", encoding="utf8") as f:
                json.dump(envelope, f)
                f.flush()
                os.fsync(f.fileno())
            tmp.replace(STORE)
        finally:
            tmp.unlink(missing_ok=True)
    return public()
