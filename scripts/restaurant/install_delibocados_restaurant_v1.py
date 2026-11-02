#!/usr/bin/env python3
"""Instala un panel Delibocados aislado, sin modificar las APIs ni servicios originales.
Uso: python3 /root/install_delibocados_restaurant_v1.py
Los otros dos archivos deben estar en /root/delibocados-restaurant-v1/ .
"""
from pathlib import Path
from datetime import datetime
import subprocess
import shutil
import socket
import sys
import time
import re

ROOT = Path("/root/delibocados-restaurant-v1")
NG = Path("/etc/nginx/conf.d/delibocados-online.conf")
OWNER = Path("/var/www/delibocados-owner")
DEST_SERVICE = OWNER / "restaurant_panel.py"
DEST_DASHBOARD = OWNER / "restaurant-dashboard.html"
PM2_NAME = "delibocados-restaurant-panel"
BACKUP = Path("/root/neuromind-backups/delibocados-restaurant-v1") / datetime.now().strftime("%Y%m%d-%H%M%S-%f")
FILES = {
    DEST_SERVICE: ROOT / "delibocados_panel_service.py",
    DEST_DASHBOARD: ROOT / "delibocados_dashboard.html",
}
saved = {}
created_process = False

def run(*args, timeout=40):
    return subprocess.run(args, text=True, capture_output=True, timeout=timeout)

def probe(path, resolve=False):
    args = ["curl", "--noproxy", "*", "-ksS", "--max-time", "10", "-o", "/dev/null", "-w", "%{http_code}"]
    if resolve:
        args += ["--resolve", "delibocados.online:443:127.0.0.1"]
    args += ["https://delibocados.online" + path]
    r = run(*args, timeout=14)
    return r.stdout.strip() if r.returncode == 0 else "000"

def restore():
    print("=== REVIRTIENDO CAMBIOS DE ESTE INSTALADOR ===")
    try:
        if NG in saved:
            NG.write_bytes(saved[NG])
            check = run("nginx", "-t")
            if check.returncode == 0:
                run("systemctl", "reload", "nginx")
            else:
                print("ATENCIÓN: nginx -t no pasó tras restaurar.", check.stderr[-300:])
    except Exception as exc:
        print("ATENCIÓN: restauración Nginx:", exc)
    if created_process:
        try:
            run("pm2", "delete", PM2_NAME)
        except Exception as exc:
            print("ATENCIÓN: borrar proceso nuevo:", exc)
    for path in FILES:
        try:
            if path in saved:
                if saved[path] is None:
                    path.unlink(missing_ok=True)
                else:
                    path.write_bytes(saved[path])
        except Exception as exc:
            print("ATENCIÓN: restaurar", path, exc)

try:
    print("=== DELIBOCADOS RESTAURANT OS: INSTALACIÓN V1 ===")
    for dest, source in FILES.items():
        if not source.is_file():
            raise RuntimeError("Falta el archivo descargado: " + str(source))
    if not NG.is_file():
        raise RuntimeError("No existe el NGINX de Delibocados")
    if "with-http_auth_request_module" not in (run("nginx", "-V").stderr + run("nginx", "-V").stdout):
        raise RuntimeError("Nginx no tiene auth_request; no se publica un editor desprotegido")
    name_check = run("pm2", "jlist")
    if name_check.returncode != 0:
        raise RuntimeError("PM2 no responde")
    import json
    if any(x.get("name") == PM2_NAME for x in json.loads(name_check.stdout)):
        raise RuntimeError("El proceso ya existe. No se reemplaza el servicio en ejecución")
    with socket.socket() as sock:
        sock.settimeout(1)
        if sock.connect_ex(("127.0.0.1", 3601)) == 0:
            raise RuntimeError("El puerto 3601 ya está ocupado")
    src = (ROOT / "delibocados_panel_service.py").read_text()
    compile(src, str(DEST_SERVICE), "exec")
    html = (ROOT / "delibocados_dashboard.html").read_text()
    if "id=\"tab-inicio\"" not in html or "api/restaurant/overview" not in html:
        raise RuntimeError("HTML del panel incompleto")
    old = NG.read_text()
    if "location = /_restaurant_auth {" in old or "location ^~ /api/restaurant/ {" in old:
        raise RuntimeError("Ya hay rutas Restaurant OS; revisión manual antes de sobrescribir")
    panel_match = re.search(r"(?m)^    location = /panel \{\n.*?^    \}", old, re.S)
    if not panel_match or "proxy_pass http://127.0.0.1:3500;" not in panel_match.group():
        raise RuntimeError("La ruta /panel instalada difiere de la conocida; sin cambios")
    menu_match = re.search(r"(?m)^    location \^~ /workspace/menu \{\n.*?^    \}", old, re.S)
    if not menu_match or "proxy_pass http://127.0.0.1:3500;" not in menu_match.group():
        raise RuntimeError("La ruta /workspace/menu instalada difiere de la conocida; sin cambios")
    new_panel = """    location = /panel {
        auth_request /_restaurant_auth;
        error_page 401 =302 /ingresar;
        proxy_pass http://127.0.0.1:3601;
        proxy_set_header Cookie $http_cookie;
        proxy_set_header Host $host;
    }"""
    new_menu = menu_match.group().replace(
        "    location ^~ /workspace/menu {\n",
        "    location ^~ /workspace/menu {\n"
        "        auth_request /_restaurant_auth;\n"
        "        error_page 401 =302 /ingresar;\n",
        1,
    )
    nginx = old.replace(panel_match.group(), new_panel, 1).replace(menu_match.group(), new_menu, 1)
    anchor = "    location ^~ /restaurant-qr/ {"
    if nginx.count(anchor) != 1:
        raise RuntimeError("Anclaje QR inesperado en Nginx")
    routes = """    location = /_restaurant_auth {
        internal;
        proxy_pass http://127.0.0.1:3601/authz;
        proxy_pass_request_body off;
        proxy_set_header Content-Length "";
        proxy_set_header Cookie $http_cookie;
        proxy_set_header Host $host;
    }

    location ^~ /api/restaurant/ {
        proxy_pass http://127.0.0.1:3601;
        proxy_set_header Cookie $http_cookie;
        proxy_set_header Host $host;
        limit_except GET { deny all; }
    }

"""
    nginx = nginx.replace(anchor, routes + anchor, 1)
    if "location = /ingresar" not in nginx:
        raise RuntimeError("No se encontró el login actual de Delibocados")
    for path in [NG, *FILES.keys()]:
        saved[path] = path.read_bytes() if path.is_file() else None
    BACKUP.mkdir(parents=True, exist_ok=False)
    BACKUP.chmod(0o700)
    for path, data in saved.items():
        if data is not None:
            (BACKUP / path.name).write_bytes(data)
    print("Respaldo:", BACKUP)
    OWNER.mkdir(parents=True, exist_ok=True)
    for dest, source in FILES.items():
        shutil.copy2(source, dest)
        dest.chmod(0o644)
    check = run("pm2", "start", str(DEST_SERVICE), "--name", PM2_NAME, "--interpreter", "python3", timeout=45)
    if check.returncode != 0:
        raise RuntimeError("No se inició el proceso nuevo: " + check.stderr[-400:])
    created_process = True
    ready = False
    for _ in range(20):
        r = run("curl", "--noproxy", "*", "-sS", "--max-time", "3", "-o", "/dev/null", "-w", "%{http_code}", "http://127.0.0.1:3601/health")
        if r.returncode == 0 and r.stdout == "200":
            ready = True
            break
        time.sleep(1)
    if not ready:
        raise RuntimeError("El servicio nuevo no responde /health")
    NG.write_text(nginx)
    test = run("nginx", "-t")
    if test.returncode != 0:
        raise RuntimeError("NGINX: " + test.stderr[-400:])
    reload = run("systemctl", "reload", "nginx")
    if reload.returncode != 0:
        raise RuntimeError("NGINX no recargó: " + reload.stderr[-400:])
    # Esperar recarga; verificar accesos públicos y ausencia de exposición sin sesión.
    checks = [
        ("/menu", "200"),
        ("/ingresar", "200"),
        ("/panel", "302"),
        ("/api/restaurant/overview", "401"),
    ]
    for path, expected in checks:
        code = "000"
        for _ in range(12):
            code = probe(path, resolve=True)
            if code == expected:
                break
            time.sleep(1)
        print(path, "HTTP", code, "(esperado", expected + ")")
        if code != expected:
            raise RuntimeError("Prueba fallida: " + path)
    print("")
    print("=========================================")
    print("DELIBOCADOS RESTAURANT OS V1 INSTALADO")
    print("=========================================")
    print("PANEL: https://delibocados.online/panel")
    print("LOGIN: https://delibocados.online/ingresar")
    print("PEDIDOS/CRM: lectura aislada por companyId")
    print("WHATSAPP: visible, sin activación insegura")
    print("MENU/QR: editores existentes preservados")
    print("SERVICIOS EVENTOS: no modificados")
except Exception as error:
    print("ERROR:", error)
    if saved:
        restore()
    else:
        print("Sin cambios aplicados.")
print("SESION SSH ABIERTA")
