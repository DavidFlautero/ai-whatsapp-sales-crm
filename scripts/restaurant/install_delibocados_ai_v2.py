#!/usr/bin/env python3
"""Upgrade Delibocados Restaurant OS V1: independent WhatsApp/Claude/OpenAI settings.
Backups and rollback. Does not modify the 4100 API or the Eventos/owner editor.
"""
from pathlib import Path
from datetime import datetime
import base64
import json
import os
import re
import secrets
import subprocess
import time

ROOT = Path("/root/delibocados-restaurant-ai-v2")
OWNER = Path("/var/www/delibocados-owner")
NG = Path("/etc/nginx/conf.d/delibocados-online.conf")
DASH = OWNER / "restaurant-dashboard.html"
SERVICE = OWNER / "restaurant_panel.py"
AI = OWNER / "restaurant_ai_config.py"
CRYPT = OWNER / "restaurant_ai_crypto.cjs"
PAGE = OWNER / "restaurant-ai-settings.html"
KEY = Path("/root/neuromind-data/restaurant-ai/secret.key")
COMPANY_STORE = Path("/root/neuromind-data/restaurant-ai/delibocados/settings.enc.json")
BACKUP = Path("/root/neuromind-backups/delibocados-restaurant-ai-v2") / datetime.now().strftime("%Y%m%d-%H%M%S-%f")
FILES = {
    SERVICE: ROOT / "delibocados_panel_service_v3.py",
    AI: ROOT / "restaurant_ai_config.py",
    CRYPT: ROOT / "restaurant_ai_crypto.cjs",
    PAGE: ROOT / "delibocados_ai_settings.html",
}
saved = {}
modified = []
new_key = False

def call(*cmd, data=None, timeout=45):
    return subprocess.run(cmd, input=data, text=True, capture_output=True, timeout=timeout)

def status(path, verb="GET", data=None, headers=None):
    args = ["curl", "--noproxy", "*", "-ksS", "--max-time", "9",
            "--resolve", "delibocados.online:443:127.0.0.1",
            "-o", "/dev/null", "-w", "%{http_code}", "-X", verb]
    for key, value in (headers or {}).items():
        args += ["-H", key + ": " + value]
    if data is not None:
        args += ["--data-binary", data]
    r = call(*(args + ["https://delibocados.online" + path]), timeout=12)
    return r.stdout if r.returncode == 0 else "000"

def rollback():
    print("=== REVERTIR INSTALACION IA ===")
    for path in reversed(modified):
        try:
            value = saved.get(path)
            if value is None:
                path.unlink(missing_ok=True)
            else:
                path.write_bytes(value)
        except Exception as exc:
            print("ATENCION archivo", path, str(exc)[:150])
    if saved.get(NG) is not None:
        check = call("nginx", "-t")
        if check.returncode == 0:
            call("systemctl", "reload", "nginx")
    if saved.get(SERVICE) is not None:
        call("pm2", "restart", "delibocados-restaurant-panel")
    if new_key and not COMPANY_STORE.exists():
        # Solo borrar clave recién creada si no se guardó ninguna configuración.
        KEY.unlink(missing_ok=True)

print("=== CONFIGURACION WHATSAPP + CLAUDE / OPENAI ===")
try:
    for dst, source in FILES.items():
        if not source.is_file() or source.stat().st_size < 200:
            raise RuntimeError("Falta archivo: " + str(source))
    for path in (NG, SERVICE, DASH):
        if not path.exists():
            raise RuntimeError("Falta panel V1: " + str(path))
    if "delibocados-restaurant-panel" not in call("pm2", "list").stdout:
        raise RuntimeError("El proceso Delibocados V1 no existe en PM2")
    ng0 = NG.read_text()
    if "location = /panel/ia {" in ng0 or "location = /api/restaurant/ai-config {" in ng0:
        raise RuntimeError("Ya existe la ruta de configuración; evitar instalación duplicada")
    if "location = /_restaurant_auth {" not in ng0 or "location ^~ /api/restaurant/ {" not in ng0:
        raise RuntimeError("NGINX no contiene las rutas privadas del panel V1")
    source = (ROOT / "delibocados_panel_service_v3.py").read_text()
    compile(source, str(SERVICE), "exec")
    py2 = (ROOT / "restaurant_ai_config.py").read_text()
    compile(py2, str(AI), "exec")
    scriptcheck = call("node", "--check", str(ROOT / "restaurant_ai_crypto.cjs"))
    if scriptcheck.returncode:
        raise RuntimeError("JavaScript de cifrado inválido: " + scriptcheck.stderr[-200:])
    html = (ROOT / "delibocados_ai_settings.html").read_text()
    if 'id="provider"' not in html or 'id="waProvider"' not in html or "/api/restaurant/ai-config" not in html:
        raise RuntimeError("Formulario de configuración incompleto")
    dash0 = DASH.read_text()
    marker = '<section class="view" id="tab-whatsapp">'
    if marker not in dash0 or "/panel/ia" in dash0:
        raise RuntimeError("La sección de WhatsApp V1 no está en el estado esperado")
    banner = '<div class="notice"><strong>Configuración de WhatsApp y agente IA.</strong> Elegí OpenAI o Claude, el modelo y el número propio del restaurante. <a class="btn primary" href="/panel/ia">Configurar WhatsApp e IA</a></div>'
    dash1 = dash0.replace(marker, marker + "\n" + banner, 1)
    anchor = '    location ^~ /api/restaurant/ {'
    if ng0.count(anchor) != 1:
        raise RuntimeError("Ancla API de restaurante ambigua")
    blocks = """    location = /panel/ia {
        auth_request /_restaurant_auth;
        error_page 401 =302 /ingresar;
        proxy_pass http://127.0.0.1:3601;
        proxy_set_header Cookie $http_cookie;
        proxy_set_header Host $host;
    }

    location = /api/restaurant/ai-config {
        proxy_pass http://127.0.0.1:3601;
        proxy_set_header Cookie $http_cookie;
        proxy_set_header Host $host;
        client_max_body_size 16k;
        limit_except GET PUT { deny all; }
    }

"""
    ng1 = ng0.replace(anchor, blocks + anchor, 1)
    BACKUP.mkdir(parents=True, exist_ok=False)
    BACKUP.chmod(0o700)
    for path in (NG, DASH, *FILES.keys()):
        saved[path] = path.read_bytes() if path.exists() else None
        if saved[path] is not None:
            (BACKUP / path.name).write_bytes(saved[path])
    print("Respaldo:", BACKUP)

    KEY.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    KEY.parent.chmod(0o700)
    if not KEY.exists():
        flags = os.O_CREAT | os.O_EXCL | os.O_WRONLY | getattr(os, "O_NOFOLLOW", 0)
        fd = os.open(str(KEY), flags, 0o600)
        new_key = True
        with os.fdopen(fd, "wb") as fh:
            fh.write(secrets.token_bytes(32))
    if KEY.stat().st_size != 32:
        raise RuntimeError("La clave de cifrado no tiene 32 bytes")
    KEY.chmod(0o600)

    for path, source in FILES.items():
        path.write_bytes(source.read_bytes())
        path.chmod(0o644)
        modified.append(path)
    DASH.write_text(dash1)
    modified.append(DASH)

    sample = {"test": "delibocados-secreto-no-mostrar"}
    encrypted = call("node", str(CRYPT), "encrypt", str(KEY), data=json.dumps(sample))
    if encrypted.returncode != 0:
        raise RuntimeError("Error probando cifrado")
    decrypted = call("node", str(CRYPT), "decrypt", str(KEY), data=encrypted.stdout)
    if decrypted.returncode != 0 or json.loads(decrypted.stdout) != sample:
        raise RuntimeError("Fallo al verificar cifrado autenticado")
    print("CIFRADO: AES-256-GCM verificado")

    NG.write_text(ng1)
    modified.append(NG)
    test = call("nginx", "-t")
    if test.returncode:
        raise RuntimeError("NGINX inválido: " + test.stderr[-400:])
    restart = call("pm2", "restart", "delibocados-restaurant-panel")
    if restart.returncode:
        raise RuntimeError("No reinició el panel: " + restart.stderr[-300:])
    reload = call("systemctl", "reload", "nginx")
    if reload.returncode:
        raise RuntimeError("No se pudo recargar NGINX")

    tests = [
        ("/menu", "GET", "200"),
        ("/ingresar", "GET", "200"),
        ("/panel", "GET", "302"),
        ("/panel/ia", "GET", "302"),
        ("/api/restaurant/ai-config", "GET", "401"),
    ]
    for path, verb, expected in tests:
        result = "000"
        for _ in range(15):
            result = status(path, verb)
            if result == expected:
                break
            time.sleep(1)
        print(path, result, "(esperado", expected + ")")
        if result != expected:
            raise RuntimeError("Fallo verificación: " + path)
    put = status("/api/restaurant/ai-config", "PUT", "{}",
                 {"Origin":"https://delibocados.online", "Content-Type":"application/json"})
    print("PUT sin sesión:", put, "(esperado 401)")
    if put != "401":
        raise RuntimeError("La escritura API no está protegida")
    print("")
    print("==========================================")
    print("DELIBOCADOS CONFIGURACION IA INSTALADA")
    print("==========================================")
    print("ABRIR: https://delibocados.online/panel/ia")
    print("PROVEEDORES: OPENAI / ANTHROPIC")
    print("CREDENCIALES: CIFRADAS POR EMPRESA")
    print("AGENTE EN PRODUCCION: DESACTIVADO")
    print("ORIGINAL EVENTOS: INTACTO")
except Exception as exc:
    print("ERROR:", str(exc))
    if saved:
        rollback()
    else:
        print("SIN CAMBIOS EN EL PANEL")

print("SSH ABIERTA")
