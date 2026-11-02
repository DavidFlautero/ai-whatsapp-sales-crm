#!/usr/bin/env python3
"""Delibocados V3: private conversations + Toteat/POS360 setup and key tests."""
from pathlib import Path
from datetime import datetime
import json,re,subprocess,time,os,tempfile

src=Path("/root/delibocados-operations-v3")
root=Path("/var/www/delibocados-owner")
ng=Path("/etc/nginx/conf.d/delibocados-online.conf")
dash=root/"restaurant-dashboard.html"
panel=root/"restaurant_panel.py"
sources={
panel:"delibocados_panel_service_v5.py",
root/"restaurant_connectors.py":"restaurant_connectors.py",
root/"restaurant_conversations.py":"restaurant_conversations.py",
root/"restaurant-integrations.html":"delibocados_integrations.html",
root/"restaurant-conversations.html":"delibocados_conversations.html",
root/"restaurant-ai-settings.html":"delibocados_ai_settings_v3.html",
}
backup=Path("/root/neuromind-backups/delibocados-operations-v3")/datetime.now().strftime("%Y%m%d-%H%M%S-%f")
saved={};changed=[]

def run(*cmd,stdin=None):
    return subprocess.run(cmd,input=stdin,text=True,capture_output=True,timeout=45)
def write(p,b):
    mode=p.stat().st_mode&0o777 if p.exists() else 0o644
    fd,tmp=tempfile.mkstemp(prefix=".deli-v3-",dir=str(p.parent))
    try:
        with os.fdopen(fd,"wb") as f:f.write(b);f.flush();os.fsync(f.fileno())
        os.chmod(tmp,mode);os.replace(tmp,p)
    finally:
        if os.path.exists(tmp):os.unlink(tmp)
def check(path,method="GET"):
    args=["curl","--noproxy","*","-ksS","--max-time","9",
    "--resolve","delibocados.online:443:127.0.0.1",
    "-o","/dev/null","-w","%{http_code}","-X",method]
    if method!="GET":args+=["-H","Origin: https://delibocados.online",
        "-H","Content-Type: application/json","--data-binary",'{"provider":"toteat"}' if method=="POST" else "{}"]
    r=run(*(args+["https://delibocados.online"+path]))
    return r.stdout.strip() if r.returncode==0 else "000"
def restore():
    print("REVIRTIENDO V3")
    for p in reversed(changed):
        try:
            if saved[p] is None:p.unlink(missing_ok=True)
            else:write(p,saved[p])
        except Exception as e:print("RESTAURAR MANUALMENTE:",p,str(e)[:80])
    if run("nginx","-t").returncode==0:run("systemctl","reload","nginx")
    run("pm2","restart","delibocados-restaurant-panel")

try:
    print("=== DELIBOCADOS V3: CLAVES / CONVERSACIONES / TOTEAT / POS360 ===")
    for p,name in sources.items():
        f=src/name
        if not f.is_file() or f.stat().st_size<300:raise RuntimeError("Falta "+str(f))
        if name.endswith(".py"):compile(f.read_text(),name,"exec")
        if name.endswith(".html"):
            m=re.search(r"<script>(.*?)</script>",f.read_text(),re.S)
            if not m or run("node","--check",stdin=m.group(1)).returncode:
                raise RuntimeError("Javascript inválido: "+name)
    for p in [ng,dash,panel]:
        if not p.is_file():raise RuntimeError("Falta archivo "+str(p))
    pm=run("pm2","jlist")
    if pm.returncode or not any(x.get("name")=="delibocados-restaurant-panel" for x in json.loads(pm.stdout)):
        raise RuntimeError("Servicio Delibocados no encontrado")
    ng_old=ng.read_text();dash_old=dash.read_text();panel_old=panel.read_text()
    if "import restaurant_floorplan as floorplan" not in panel_old:
        raise RuntimeError("Instalación croquis anterior no reconocida")
    if "import restaurant_connectors" in panel_old or "/panel/integraciones" in ng_old:
        raise RuntimeError("Módulo ya instalado; no sobrescribir")
    anchor="    location ^~ /api/restaurant/ {"
    if ng_old.count(anchor)!=1:raise RuntimeError("NGINX distinto al conocido")
    for tab,url,description in [
        ("tab-whatsapp","/panel/conversaciones","Abrir conversaciones"),
        ("tab-integraciones","/panel/integraciones","Configurar Toteat y POS360")]:
        marker='<section class="view" id="'+tab+'">'
        if dash_old.count(marker)!=1:raise RuntimeError("Pestaña no encontrada: "+tab)
        dash_old=dash_old.replace(marker,marker+
            '\n<div class="notice"><a class="btn primary" href="'+url+'">'+description+'</a></div>',1)
    routes="""    location = /panel/integraciones {
        auth_request /_restaurant_auth;
        error_page 401 =302 /ingresar;
        proxy_pass http://127.0.0.1:3601;
        proxy_set_header Cookie $http_cookie;
    }
    location = /panel/conversaciones {
        auth_request /_restaurant_auth;
        error_page 401 =302 /ingresar;
        proxy_pass http://127.0.0.1:3601;
        proxy_set_header Cookie $http_cookie;
    }
    location = /api/restaurant/integrations {
        proxy_pass http://127.0.0.1:3601;
        proxy_set_header Cookie $http_cookie;
        client_max_body_size 16k;
        limit_except GET PUT { deny all; }
    }
    location = /api/restaurant/integrations/test {
        proxy_pass http://127.0.0.1:3601;
        proxy_set_header Cookie $http_cookie;
        client_max_body_size 1k;
        limit_except POST { deny all; }
    }
"""
    updated={p:(src/name).read_bytes() for p,name in sources.items()}
    updated[dash]=dash_old.encode()
    updated[ng]=ng_old.replace(anchor,routes+anchor,1).encode()
    backup.mkdir(parents=True,exist_ok=False);backup.chmod(0o700)
    for i,p in enumerate(updated):
        saved[p]=p.read_bytes() if p.exists() else None
        if saved[p] is not None:(backup/(str(i)+"-"+p.name)).write_bytes(saved[p])
    print("RESPALDO:",backup)
    for p,b in updated.items():write(p,b);changed.append(p)
    test=run("nginx","-t")
    if test.returncode:raise RuntimeError("NGINX: "+test.stderr[-250:])
    if run("pm2","restart","delibocados-restaurant-panel").returncode:raise RuntimeError("PM2 restart")
    if run("systemctl","reload","nginx").returncode:raise RuntimeError("Nginx reload")
    paths=[
        ("/menu","GET","200"),("/ingresar","GET","200"),("/panel","GET","302"),
        ("/panel/ia","GET","302"),("/panel/plano","GET","302"),
        ("/panel/conversaciones","GET","302"),("/panel/integraciones","GET","302"),
        ("/api/restaurant/integrations","GET","401"),
        ("/api/restaurant/conversations","GET","401"),
        ("/api/restaurant/integrations/test","POST","401"),
        ("/restaurant-qr/image?tipo=general","GET","200")]
    for path,verb,want in paths:
        got="000"
        for i in range(12):
            got=check(path,verb)
            if got==want:break
            time.sleep(1)
        print(path,got,"esperado",want)
        if got!=want:raise RuntimeError("Falló "+path)
    print("=== ESTADO CLAVES PERSISTIDAS (SIN REVELARLAS) ===")
    p=run("python3","-c",
    "import sys;sys.path.insert(0,'/var/www/delibocados-owner');"
    "import restaurant_ai_config as c;v=c.public();"
    "print('OPENAI:',v['ai']['openaiKeyConfigured']);"
    "print('CLAUDE:',v['ai']['anthropicKeyConfigured']);"
    "print('WHATSAPP:',v['whatsapp']['tokenConfigured'])")
    print(p.stdout.strip() if p.returncode==0 else "ERROR CARGANDO CLAVES: revisar guardado")
    services=Path("/var/www/control-onboarding/apps/api/src/services")
    print("=== CÓDIGO TOTEAT PREVIO ===")
    for name in ("toteat.client.ts","toteat-config.service.ts","toteat-menu.service.ts"):
        print(name,"PRESENTE" if (services/name).exists() else "NO ENCONTRADO")
    print("=== DELIBOCADOS OPERACIONES V3 INSTALADO ===")
    print("CONVERSACIONES: https://delibocados.online/panel/conversaciones")
    print("TOTEAT/POS360: https://delibocados.online/panel/integraciones")
    print("OPENAI/CLAUDE: https://delibocados.online/panel/ia")
    print("IMPORTANTE: sin envío real de pedidos o mensajes hasta verificar integraciones.")
except Exception as e:
    print("ERROR:",str(e))
    if changed:restore()
    else:print("SIN CAMBIOS")
print("SSH ABIERTA")
