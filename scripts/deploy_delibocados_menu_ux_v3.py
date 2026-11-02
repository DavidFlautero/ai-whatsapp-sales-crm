#!/usr/bin/env python3
"""Delibocados: URL /menu, acceso propietario y checkout por modalidad.
Despliegue atómico con backups; no modifica EventOS ni las cuentas de usuario.
Ejecutar: python3 scripts/deploy_delibocados_menu_ux_v3.py
"""
from pathlib import Path
from datetime import datetime
import os
import re
import shutil
import subprocess
import sys
import tempfile

PUBLIC = Path("/var/www/delibocados-public/carta.html")
TEMPLATE = Path("/var/www/delibocados-editor/template.html")
SERVER = Path("/var/www/delibocados-editor/server.py")
NGINX = Path("/etc/nginx/conf.d/delibocados-online.conf")
FILES = (PUBLIC, TEMPLATE, SERVER, NGINX)
BACKUPS = Path("/root/neuromind-backups/domains")
MARKER = "delibocados-checkout-ux-v3"

def run(*args):
    return subprocess.run(args, text=True, capture_output=True)

STYLE = '''
<style id="delibocados-checkout-ux-v3">
/* La regla .field{display:block} anulaba el atributo HTML hidden. */
[hidden]{display:none!important}
.overlay{align-items:center!important;justify-content:center;overflow-y:auto;
 padding:12px!important;overscroll-behavior:contain}
.overlay.open{display:flex}
.overlay .sheet{width:min(630px,100%);max-height:calc(100dvh - 24px);
 margin:auto;border:1px solid #89603e;border-radius:20px;
 overflow-y:auto;overscroll-behavior:contain;
 padding:22px 20px max(22px,env(safe-area-inset-bottom));
 box-shadow:0 30px 90px #000b}
.sheet-head{position:sticky;top:-22px;z-index:2;background:#20130d;
 padding:10px 0 14px}
.order-type{grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
.order-type label{display:flex;align-items:center;justify-content:center;
 gap:4px;min-height:46px;cursor:pointer;padding:8px 5px}
.order-type input{flex:0 0 auto}
#service-help{color:#eac69e;font-size:13px;line-height:1.5;margin:9px 0 16px}
#business-access{display:block;text-align:center;margin:10px auto 32px;
 color:#dcb687;font-size:12px;text-decoration:underline}
@media(max-width:640px){
 .overlay{padding:10px!important}
 .overlay .sheet{max-height:calc(100dvh - 20px);border-radius:17px;
 padding:17px 14px max(18px,env(safe-area-inset-bottom))}
 .sheet-head{top:-17px}
 .order-type label{font-size:11px;line-height:1.2}
}
</style>
'''

UX_SCRIPT = '''
<script id="delibocados-checkout-fields-v3">
(() => {
  "use strict";
  const byId = id => document.getElementById(id);
  const getMode = () => document.querySelector('input[name="mode"]:checked')?.value || 'mesa';
  const modes = {
    mesa: 'Para consumir en el local: indicá tu nombre y la mesa en la que estás.',
    recoger: 'Retirás tu pedido en el local. Solo necesitamos tu nombre y celular; no pedimos número de mesa ni dirección.',
    domicilio: 'Para entrega a domicilio, indicá nombre, celular, dirección y barrio. No corresponde un número de mesa.'
  };
  const group = document.querySelector('.order-type');
  if (!group || !byId('table-field')) return;
  let help = byId('service-help');
  if (!help) {
    help = document.createElement('p');
    help.id = 'service-help';
    help.setAttribute('aria-live','polite');
    group.insertAdjacentElement('afterend',help);
  }
  function syncFields() {
    const mode = getMode();
    byId('table-field').hidden = mode !== 'mesa';
    byId('phone-field').hidden = mode === 'mesa';
    byId('address-field').hidden = mode !== 'domicilio';
    byId('neighborhood-field').hidden = mode !== 'domicilio';
    help.textContent = modes[mode] || '';
    if (byId('table')) byId('table').required = mode === 'mesa';
    if (byId('phone')) byId('phone').required = mode !== 'mesa';
    if (byId('address')) byId('address').required = mode === 'domicilio';
    if (byId('neighborhood')) byId('neighborhood').required = mode === 'domicilio';
  }
  document.querySelectorAll('input[name="mode"]').forEach(radio =>
    radio.addEventListener('change', syncFields));
  const cartButton = byId('cart-button');
  if (cartButton) cartButton.addEventListener('click', () => {
    syncFields();
    const panel = document.querySelector('.overlay .sheet');
    if (panel) panel.scrollTop = 0;
  });
  syncFields();
})();
</script>
'''

ORIGINAL_ADDRESS = '<label class="field" id="address-field" hidden><span>Dirección y barrio</span><input id="address" type="text" autocomplete="street-address" placeholder="Dirección de entrega"></label>'
NEW_ADDRESS = '<label class="field" id="address-field" hidden><span>Dirección de entrega</span><input id="address" type="text" autocomplete="street-address" placeholder="Calle, carrera, número y referencias"></label><label class="field" id="neighborhood-field" hidden><span>Barrio o sector</span><input id="neighborhood" type="text" autocomplete="address-level3" placeholder="Escribí tu barrio"></label>'

def patch_html(raw):
    if MARKER in raw:
        print("El HTML ya tiene UX v3.")
        return raw
    if 'id="catalog-data"' not in raw or 'id="table-field"' not in raw:
        raise RuntimeError("HTML inesperado: no coincide con la carta QR actual")
    if raw.count(ORIGINAL_ADDRESS) != 1:
        raise RuntimeError("No se identificó el campo de dirección; no se modificó")
    if raw.count('</head>') != 1 or raw.count('</body>') != 1:
        raise RuntimeError("HTML inesperado: estructura")
    raw = raw.replace(ORIGINAL_ADDRESS, NEW_ADDRESS, 1)
    raw = raw.replace('value="recoger"> Recoger</label>', 'value="recoger"> Retirar en el local</label>', 1)
    raw = raw.replace('</head>', STYLE + '\n</head>', 1)
    raw = raw.replace('</body>', UX_SCRIPT + '\n<a id="business-access" href="/ingresar">Acceso del negocio</a>\n</body>', 1)
    return raw

def patch_server(raw):
    """Adaptador tolerante: instalaciones previas pueden tener otro formato QR.
    No modificar código de sesión/autenticación ni romper un servidor desconocido.
    """
    original = raw
    pairs = [
        ("link='https://'+IP+'/r/delibocados?mesa='+token",
         "link='https://delibocados.online/menu?mesa='+token"),
        ("link='https://'+IP+'/r/delibocados'",
         "link='https://delibocados.online/menu'"),
        ("const url='/r/delibocados';const origin=location.origin;",
         "const url='https://delibocados.online/menu';const origin='';"),
        ('href="/r/delibocados"',
         'href="https://delibocados.online/menu"'),
    ]
    for old, new in pairs:
        if old in raw:
            raw = raw.replace(old, new)
    if raw == original:
        print("AVISO: generador QR instalado difiere del original; se conserva sin cambios.")
        print("La URL /menu funcionará, pero verificaremos el contenido de los QR después.")
    else:
        print("Generador QR: referencias antiguas reconocidas y actualizadas.")
    return raw

def patch_nginx(raw):
    if "server_name delibocados.online www.delibocados.online;" not in raw:
        raise RuntimeError("No encontré el host público de Delibocados")
    if 'location = /menu {' not in raw:
        existing = '    location = /r/delibocados {'
        if raw.count(existing) != 1:
            raise RuntimeError("No se encontró ruta pública base para insertar /menu")
        route = '''    location = /menu {
        alias /var/www/delibocados-public/carta.html;
        default_type text/html;
        charset utf-8;
        add_header Cache-Control "no-store" always;
    }

    location = /ingresar {
        return 302 https://187.33.150.136/login;
    }

'''
        raw = raw.replace(existing, route+existing, 1)
    elif "location = /ingresar {" not in raw:
        raise RuntimeError("Hay /menu sin /ingresar, revisión manual")
    old = 'return 302 /r/delibocados;'
    if old in raw:
        raw=raw.replace(old,'return 302 /menu;',1)
    elif 'return 302 /menu;' not in raw:
        raise RuntimeError("La redirección de raíz cambió; no se modificó")
    return raw

def atomic_write(path, body):
    fd, name = tempfile.mkstemp(dir=str(path.parent), prefix=".deli-v3-")
    try:
        with os.fdopen(fd,"w",encoding="utf8") as handle:
            handle.write(body)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(name, path.stat().st_mode & 0o777)
        os.replace(name,path)
    finally:
        if os.path.exists(name):
            os.unlink(name)

def main():
    print("=== DELIBOCADOS: MENU /menu + INGRESO + CHECKOUT V3 ===")
    for path in FILES:
        if not path.is_file():
            print("Falta",path,"-- no se cambia nada")
            return 1
    try:
        originals = {p:p.read_text(encoding="utf8") for p in FILES}
        changes = {
            PUBLIC:patch_html(originals[PUBLIC]),
            TEMPLATE:patch_html(originals[TEMPLATE]),
            SERVER:patch_server(originals[SERVER]),
            NGINX:patch_nginx(originals[NGINX]),
        }
        # Comprobar sintaxis del servidor antes de tocar producción.
        compile(changes[SERVER],str(SERVER),"exec")
    except Exception as err:
        print("VALIDACIÓN FALLIDA (sin cambios):",err)
        return 1
    BACKUPS.mkdir(parents=True,exist_ok=True)
    dest=BACKUPS/("delibocados-ux-v3-"+datetime.now().strftime("%Y%m%d-%H%M%S"))
    dest.mkdir()
    for p in FILES:
        shutil.copy2(p,dest/p.name)
    print("Respaldo en:",dest)
    written=[]
    try:
        for path, data in changes.items():
            if data != originals[path]:
                atomic_write(path,data)
                written.append(path)
        check=run("nginx","-t")
        if check.returncode:
            raise RuntimeError("nginx -t: "+(check.stderr or check.stdout)[-450:])
        if SERVER in written:
            restart=run("pm2","restart","delibocados-menu-admin")
            if restart.returncode:
                raise RuntimeError("PM2 no reinició el admin: "+restart.stderr[-450:])
        reload=run("systemctl","reload","nginx")
        if reload.returncode:
            raise RuntimeError("Nginx no recargó: "+reload.stderr[-450:])
        print("CAMBIOS INSTALADOS. Verificá:")
        print("  https://delibocados.online/menu")
        print("  https://delibocados.online/ingresar")
        print("  https://delibocados.online/restaurant-qr/image?tipo=general")
        print("No se modificaron cuentas, PostgreSQL ni Eventos Mediterráneo.")
        return 0
    except Exception as err:
        print("FALLÓ EL DESPLIEGUE; RESTAURANDO:",err)
        for path in reversed(written):
            try: atomic_write(path,originals[path])
            except Exception as restore:
                print("RESTAURAR MANUALMENTE",path,restore)
        run("nginx","-t")
        run("systemctl","reload","nginx")
        if SERVER in written: run("pm2","restart","delibocados-menu-admin")
        return 1

if __name__=="__main__":
    sys.exit(main())
