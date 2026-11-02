#!/usr/bin/env python3
"""Delibocados QR: bulk table count UI, using existing token/QR/save/print engine.
Only patches /var/www/delibocados-editor/server.py, backs up and reverts on failure.
"""
from pathlib import Path
from datetime import datetime
import os
import shutil
import subprocess
import tempfile
import time

PATH = Path("/var/www/delibocados-editor/server.py")
BACKUPS = Path("/root/neuromind-backups/delibocados-qr-bulk")
MARKER = "delibocados-mesas-lote-v1"
TITLE = "<main><h1>Códigos QR y mesas</h1>"
JS_ANCHOR = "$('add').onclick="
OLD_LINK = "const url='https://delibocados.online/';"
NEW_LINK = "const url='https://delibocados.online/menu';"

HTML = """
<!-- delibocados-mesas-lote-v1 -->
<section class="card" id="mesas-lote" style="margin:16px 0 18px;border:2px solid #d7a875">
  <h2>¿Cuántas mesas tiene el restaurante?</h2>
  <p class="sub">Ingresá la cantidad total de mesas. Generaremos automáticamente las que falten, sin borrar las existentes.</p>
  <div style="display:flex;gap:12px;align-items:end;flex-wrap:wrap;margin:13px 0">
    <label style="display:block;flex:0 0 180px">Cantidad de mesas<br>
      <input type="number" id="cantidad-mesas-lote" min="1" max="80" step="1" value="15"
        style="box-sizing:border-box;width:100%;padding:10px;border:1px solid #ad825d;border-radius:9px;background:#27160d;color:#fff4e3">
    </label>
    <button type="button" id="crear-mesas-lote" style="padding:12px 17px">Generar mesas</button>
  </div>
  <p class="info">Luego presioná <strong>Guardar</strong>. El sistema asignará un QR único a cada mesa. Podés previsualizarlos y usar <strong>Imprimir todos</strong>.</p>
</section>
"""

JS = r"""
// delibocados-mesas-lote-v1: crear N mesas sobre el mismo flujo de edición y guardado.
const bulkField = $('cantidad-mesas-lote');
const bulkButton = $('crear-mesas-lote');
if (bulkField && bulkButton) {
  bulkButton.addEventListener('click', () => {
    if (!data || !Array.isArray(data.tables)) {
      status('Primero debe cargarse la configuración de mesas.', true);
      return;
    }
    const target = Number(bulkField.value);
    if (!Number.isInteger(target) || target < 1 || target > 80) {
      status('Ingresá una cantidad de 1 a 80 mesas.', true);
      bulkField.focus();
      return;
    }
    const current = data.tables.length;
    if (target < current) {
      status('Ya existen ' + current + ' mesas. No se borrarán automáticamente; desactivá o eliminá las que sobren.', true);
      return;
    }
    if (target === current) {
      status('Ya están creadas las ' + current + ' mesas. Podés guardarlas o imprimir sus QR.');
      return;
    }
    const names = new Set(data.tables.map(t => String(t.mesa || '').trim().toLocaleLowerCase()));
    const pending = [];
    let nextName = 1;
    for (let i = current; i < target; i++) {
      let name;
      do {
        name = 'Mesa ' + nextName++;
      } while (names.has(name.toLocaleLowerCase()));
      names.add(name.toLocaleLowerCase());
      pending.push({
        id: newId(),
        mesa: name,
        enabled: true,
        x: 10 + (i % 6) * 16,
        y: 12 + Math.floor(i / 6) * 6
      });
    }
    data.tables.push(...pending);
    render();
    status('Se agregaron ' + pending.length + ' mesas. Total: ' + data.tables.length + '. Ahora presioná Guardar para crear los QR.');
  });
}
"""

def run(*cmd):
    return subprocess.run(cmd, capture_output=True, text=True, timeout=45)

def http(path):
    p = run("curl", "--noproxy", "*", "-ksS", "--max-time", "10",
            "--resolve", "delibocados.online:443:127.0.0.1",
            "-o", "/dev/null", "-w", "%{http_code}",
            "https://delibocados.online" + path)
    return p.stdout.strip() if p.returncode == 0 else "000"

def atomic_write(path, value, mode):
    fd, name = tempfile.mkstemp(dir=str(path.parent), prefix=".qr-lote-")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(value)
            f.flush()
            os.fsync(f.fileno())
        os.chmod(name, mode)
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)

print("=== DELIBOCADOS: GENERADOR MASIVO DE QR POR MESA ===")
changed = False
original = None
try:
    if not PATH.is_file():
        raise RuntimeError("No se encontró el editor Delibocados.")
    original = PATH.read_text(encoding="utf-8")
    if MARKER in original:
        print("Ya está instalado el generador masivo; sin cambios.")
    else:
        if original.count(TITLE) != 1:
            raise RuntimeError("Encabezado QR diferente del auditado; sin cambios.")
        if original.count(JS_ANCHOR) != 1:
            raise RuntimeError("Código JS de agregar mesa diferente del auditado; sin cambios.")
        for identifier in ("function newId()", "data.tables", "render()", "$('save').onclick", "printQr(tables)"):
            if identifier not in original:
                raise RuntimeError("Falta función existente " + identifier + "; sin cambios.")
        if original.count(OLD_LINK) != 1:
            raise RuntimeError("La dirección pública QR cambió; sin cambios.")

        updated = original.replace(TITLE, TITLE + "\n" + HTML, 1)
        updated = updated.replace(JS_ANCHOR, JS + "\n" + JS_ANCHOR, 1)
        updated = updated.replace(OLD_LINK, NEW_LINK, 1)
        compile(updated, str(PATH), "exec")

        BACKUPS.mkdir(parents=True, exist_ok=True)
        backup = BACKUPS / ("server-" + datetime.now().strftime("%Y%m%d-%H%M%S-%f") + ".py")
        shutil.copy2(PATH, backup)
        print("RESPALDO:", backup)
        mode = PATH.stat().st_mode & 0o777

        atomic_write(PATH, updated, mode)
        changed = True
        restart = run("pm2", "restart", "delibocados-menu-admin")
        if restart.returncode:
            raise RuntimeError("PM2 no reinició el editor: " + restart.stderr[-250:])
        checks = [
            ("/menu", "200"),
            ("/restaurant-qr/image?tipo=general", "200"),
            ("/workspace/menu/qr", "302"),
        ]
        for path, expected in checks:
            actual = "000"
            for _ in range(15):
                actual = http(path)
                if actual == expected:
                    break
                time.sleep(1)
            print(path, "HTTP", actual, "(esperado", expected + ")")
            if actual != expected:
                raise RuntimeError("Falló la verificación " + path)
        print("")
        print("MESAS MASIVAS INSTALADAS")
        print("ABRIR: https://delibocados.online/workspace/menu/qr")
        print("GENERAR MESAS -> GUARDAR -> IMPRIMIR TODOS")
        print("QR GENERAL Y PANEL PRINCIPAL: CONSERVADOS")
except Exception as exc:
    print("ERROR:", exc)
    if changed and original is not None:
        try:
            atomic_write(PATH, original, PATH.stat().st_mode & 0o777)
            run("pm2", "restart", "delibocados-menu-admin")
            print("CAMBIOS REVERTIDOS; editor restaurado")
        except Exception as restore:
            print("ATENCION: fallo al restaurar:", restore)
    else:
        print("SIN CAMBIOS")
print("SSH ABIERTA")
