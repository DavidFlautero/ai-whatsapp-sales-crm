#!/usr/bin/env python3
"""Add Delibocados drag/drop croquis by floors to the existing QR admin.
Changes: restaurant panel service, Nginx 2 exact routes, QR editor link,
restaurant dashboard link. Leaves QR registry/tokens and other tenants intact.
"""
from pathlib import Path
from datetime import datetime
import json
import os
import re
import shutil
import subprocess
import tempfile
import time

ROOT = Path("/root/delibocados-floorplan-v1")
OWN = Path("/var/www/delibocados-owner")
PANEL = OWN / "restaurant_panel.py"
SERVICE_SRC = ROOT / "delibocados_panel_service_v4.py"
MODEL = OWN / "restaurant_floorplan.py"
MODEL_SRC = ROOT / "restaurant_floorplan.py"
PAGE = OWN / "restaurant-floorplan.html"
PAGE_SRC = ROOT / "delibocados_floorplan.html"
DASH = OWN / "restaurant-dashboard.html"
QR = Path("/var/www/delibocados-editor/server.py")
NG = Path("/etc/nginx/conf.d/delibocados-online.conf")
STORE = Path("/root/neuromind-data/restaurant-floorplan/delibocados.json")
BACKUP = Path("/root/neuromind-backups/delibocados-floorplan-v1") / datetime.now().strftime("%Y%m%d-%H%M%S-%f")
FILES = [PANEL, MODEL, PAGE, DASH, QR, NG]
SOURCES = {PANEL: SERVICE_SRC, MODEL: MODEL_SRC, PAGE: PAGE_SRC}
MARK = "DELIBOCADOS_FLOORPLAN_LINK_V1"
originals = {}
modified = []

def run(*args, input_data=None, timeout=40):
    return subprocess.run(args, input=input_data, capture_output=True, text=True, timeout=timeout)

def write_bytes(path, content):
    mode = path.stat().st_mode & 0o777 if path.is_file() else 0o644
    fd, tmp = tempfile.mkstemp(prefix=".deli-plano-", dir=str(path.parent))
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(content)
            f.flush()
            os.fsync(f.fileno())
        os.chmod(tmp, mode)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)

def probe(path, method="GET", data=None, headers=None):
    cmd = ["curl", "--noproxy", "*", "-ksS", "--max-time", "9",
           "--resolve", "delibocados.online:443:127.0.0.1",
           "-o", "/dev/null", "-w", "%{http_code}", "-X", method]
    for key, val in (headers or {}).items():
        cmd += ["-H", key+": "+val]
    if data is not None:
        cmd += ["--data-binary", data]
    r = run(*(cmd + ["https://delibocados.online" + path]), timeout=12)
    return r.stdout.strip() if r.returncode == 0 else "000"

def backout():
    print("=== RESTAURANDO ESTADO ANTERIOR ===")
    for path in reversed(modified):
        try:
            if originals[path] is None:
                path.unlink(missing_ok=True)
            else:
                write_bytes(path, originals[path])
        except Exception as err:
            print("ATENCION restaurar", path, str(err)[:200])
    check = run("nginx", "-t")
    if check.returncode == 0:
        run("systemctl", "reload", "nginx")
    run("pm2", "restart", "delibocados-restaurant-panel")
    run("pm2", "restart", "delibocados-menu-admin")
    print("Rollback completado; si hubo advertencias, revisar manualmente.")

try:
    print("=== DELIBOCADOS: CROQUIS POR PISOS ===")
    for source in SOURCES.values():
        if not source.is_file() or source.stat().st_size < 500:
            raise RuntimeError("Falta archivo de distribución: " + str(source))
    for path in (PANEL, DASH, QR, NG):
        if not path.is_file():
            raise RuntimeError("Falta archivo existente: " + str(path))
    if STORE.is_file():
        raise RuntimeError("Ya existen datos de croquis; evitar sobrescribir sin inspeccionarlos")

    pm2 = run("pm2", "jlist")
    if pm2.returncode:
        raise RuntimeError("PM2 no responde")
    names = {entry.get("name") for entry in json.loads(pm2.stdout)}
    if not {"delibocados-restaurant-panel", "delibocados-menu-admin"}.issubset(names):
        raise RuntimeError("Falta un proceso Delibocados en PM2")

    service_old = PANEL.read_text(encoding="utf-8")
    qr_old = QR.read_text(encoding="utf-8")
    dash_old = DASH.read_text(encoding="utf-8")
    nginx_old = NG.read_text(encoding="utf-8")

    if "import restaurant_ai_config as ai_config" not in service_old:
        raise RuntimeError("Panel IA V2 no encontrado; no se modifica")
    if '"/api/restaurant/ai-config"' not in service_old:
        raise RuntimeError("Panel existente no coincide con V2")
    if "restaurant_floorplan" in service_old or MARK in qr_old or "/panel/plano" in nginx_old:
        raise RuntimeError("Hay una instalación de croquis previa; sin modificaciones")
    if qr_old.count("$('add').onclick=") != 1 or "function newId()" not in qr_old:
        raise RuntimeError("Editor QR diferente del auditado; sin modificaciones")
    if "id=\"map\"" not in qr_old or "function printQr(tables)" not in qr_old:
        raise RuntimeError("No se encontró mapa QR actual")
    if dash_old.count('class="btn primary">Administrar mesas y QR</a>') != 1:
        raise RuntimeError("Botón de QR del dashboard inesperado")
    if nginx_old.count('    location ^~ /api/restaurant/ {') != 1:
        raise RuntimeError("NGINX no tiene endpoint de restaurante conocido")
    if 'location = /_restaurant_auth {' not in nginx_old:
        raise RuntimeError("NGINX no tiene auth_request")

    qr_link_js = """
// DELIBOCADOS_FLOORPLAN_LINK_V1
(function() {
  const map = document.getElementById('map');
  const section = map && map.closest('section');
  if (section && !document.getElementById('plano-multiplanta-acceso')) {
    const box = document.createElement('section');
    box.id = 'plano-multiplanta-acceso';
    box.className = 'card';
    box.style.marginTop = '16px';
    const heading = document.createElement('h2');
    heading.textContent = 'Croquis del restaurante por pisos';
    const summary = document.createElement('p');
    summary.textContent = 'Creá plantas o pisos y organizá mesas, barra, puertas, baños y escaleras arrastrándolos. Los QR actuales no cambian.';
    const link = document.createElement('a');
    link.href = '/panel/plano';
    link.textContent = 'Abrir diseñador de croquis';
    link.className = 'secondary';
    link.style.display = 'inline-block';
    link.style.padding = '12px 16px';
    link.style.border = '1px solid #d5a16a';
    link.style.borderRadius = '10px';
    box.append(heading, summary, link);
    section.insertAdjacentElement('afterend', box);
  }
})();
"""
    qr_new = qr_old.replace("$('add').onclick=", qr_link_js + "\n$('add').onclick=", 1)
    service_new = SERVICE_SRC.read_text(encoding="utf-8")
    model_new = MODEL_SRC.read_text(encoding="utf-8")
    page_new = PAGE_SRC.read_text(encoding="utf-8")
    dash_new = dash_old.replace(
        'class="btn primary">Administrar mesas y QR</a>',
        'class="btn primary">Administrar mesas y QR</a>'
        ' <a href="/panel/plano" class="btn">Diseñar croquis por pisos</a>', 1)
    locations = """    location = /panel/plano {
        auth_request /_restaurant_auth;
        error_page 401 =302 /ingresar;
        proxy_pass http://127.0.0.1:3601;
        proxy_set_header Cookie $http_cookie;
        proxy_set_header Host $host;
    }

    location = /api/restaurant/floorplan {
        proxy_pass http://127.0.0.1:3601;
        proxy_set_header Cookie $http_cookie;
        proxy_set_header Host $host;
        client_max_body_size 64k;
        limit_except GET PUT { deny all; }
    }

"""
    ng_new = nginx_old.replace('    location ^~ /api/restaurant/ {',
        locations + '    location ^~ /api/restaurant/ {', 1)

    # Validate before changing any live service.
    compile(qr_new, str(QR), "exec")
    compile(service_new, str(PANEL), "exec")
    compile(model_new, str(MODEL), "exec")
    if "id=\"stage\"" not in page_new or "/workspace/menu/qr/api" not in page_new:
        raise RuntimeError("La interfaz de croquis está incompleta")
    js_match = re.search(r"<script>(.*?)</script>", page_new, re.S)
    if not js_match:
        raise RuntimeError("No se encontró JavaScript del croquis")
    js_test = run("node", "--check", input_data=js_match.group(1))
    if js_test.returncode:
        raise RuntimeError("JavaScript de croquis inválido: " + js_test.stderr[-400:])
    js_test2 = run("node", "--check", input_data=qr_link_js)
    if js_test2.returncode:
        raise RuntimeError("JavaScript del acceso a croquis inválido")
    print("Sintaxis Python y JavaScript verificada.")

    BACKUP.mkdir(parents=True, exist_ok=False)
    BACKUP.chmod(0o700)
    for i, path in enumerate(FILES):
        originals[path] = path.read_bytes() if path.is_file() else None
        if originals[path] is not None:
            (BACKUP / (str(i)+"-"+path.name)).write_bytes(originals[path])
    print("RESPALDO:", BACKUP)
    changes = {
        PANEL: service_new.encode(),
        MODEL: model_new.encode(),
        PAGE: page_new.encode(),
        DASH: dash_new.encode(),
        QR: qr_new.encode(),
        NG: ng_new.encode(),
    }
    for path, value in changes.items():
        write_bytes(path, value)
        modified.append(path)

    test = run("nginx", "-t")
    if test.returncode:
        raise RuntimeError("Error de NGINX: " + test.stderr[-400:])
    restart_panel = run("pm2", "restart", "delibocados-restaurant-panel")
    if restart_panel.returncode:
        raise RuntimeError("Fallo reinicio del panel")
    restart_qr = run("pm2", "restart", "delibocados-menu-admin")
    if restart_qr.returncode:
        raise RuntimeError("Fallo reinicio del editor QR")
    reload = run("systemctl", "reload", "nginx")
    if reload.returncode:
        raise RuntimeError("Fallo recarga de NGINX")

    checks = [
        ("/menu", "200"),
        ("/ingresar", "200"),
        ("/panel", "302"),
        ("/panel/ia", "302"),
        ("/panel/plano", "302"),
        ("/api/restaurant/floorplan", "401"),
        ("/restaurant-qr/image?tipo=general", "200"),
        ("/workspace/menu/qr", "302"),
    ]
    for path, expect in checks:
        result = "000"
        for _ in range(15):
            result = probe(path)
            if result == expect:
                break
            time.sleep(1)
        print(path, "HTTP", result, "(esperado", expect + ")")
        if result != expect:
            raise RuntimeError("Falló comprobación de " + path)

    put = probe("/api/restaurant/floorplan", method="PUT",
        data='{"revision":0,"payload":{}}',
        headers={"Origin":"https://delibocados.online",
                 "Content-Type":"application/json"})
    if put != "401":
        raise RuntimeError("PUT sin sesión no está protegido (HTTP "+put+")")
    print("API de croquis PUT sin sesión: HTTP", put)
    print("")
    print("=====================================")
    print("DELIBOCADOS CROQUIS POR PISOS INSTALADO")
    print("=====================================")
    print("ABRIR: https://delibocados.online/panel/plano")
    print("QR ACTUALES CONSERVADOS: SI")
    print("PISOS, MESAS, BARRA, PUERTA, BANO, ESCALERA: DISPONIBLES")
    print("PERSISTENCIA: AISLADA Y CON CONTROL DE REVISION")
    print("OTROS CLIENTES: SIN CAMBIOS")
except Exception as exc:
    print("ERROR:", exc)
    if modified:
        backout()
    else:
        print("SIN CAMBIOS EN PRODUCCION")
print("SSH ABIERTA")
