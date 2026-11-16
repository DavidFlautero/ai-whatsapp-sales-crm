#!/usr/bin/env python3
"""Make phone optional only for QR table orders in the legacy public menu.

Requires database migration 20261116103000 and the matching API code live.
Does not change pickup/delivery contact requirements, the QR token gate, or POS.
"""
from datetime import datetime
from pathlib import Path
import shutil

PATH = Path("/var/www/delibocados-public/carta.html")
MARKER = "DELIBOCADOS_OPTIONAL_TABLE_PHONE_20261116"
CHECK = 'if(!/^[0-9]{8,15}$/.test(customerPhone))'
MODE = 'const data=m==="table"?state.qr:state.catalog;'

if not PATH.is_file():
    raise SystemExit("BLOQUEADO: carta.html no encontrada. Sin cambios.")

original = PATH.read_text(encoding="utf-8")
if MARKER in original:
    print("CORRECTO: teléfono de mesa ya opcional. No se modificó nada.")
    raise SystemExit(0)

anchor = original.find(MODE)
if anchor < 0 or original.count(MODE) != 1:
    raise SystemExit("BLOQUEADO: no se encontró una única validación de modo. Sin cambios.")
check = original.rfind(CHECK, 0, anchor)
if check < 0 or anchor - check > 450:
    raise SystemExit("BLOQUEADO: validación de teléfono no reconocida. Sin cambios.")

replacement = ('if((m!=="table"||customerPhone.length>0)'
               '&&!/^[0-9]{8,15}$/.test(customerPhone))')
updated = original[:check] + replacement + original[check+len(CHECK):]
# Phone stays visible with the previous display fix; only the label changes.
if '<span>Teléfono</span>' in updated:
    updated = updated.replace(
        '<span>Teléfono</span>',
        '<span>Teléfono (opcional en mesa)</span>',
        1
    )
updated = updated.replace('</body>', f'<!-- {MARKER} -->\n</body>', 1)
if updated == original or updated.count(MARKER) != 1:
    raise SystemExit("BLOQUEADO: parche no validado. Sin cambios.")

backup = PATH.with_name("carta.backup-optional-phone-" +
    datetime.now().strftime("%Y%m%d-%H%M%S") + ".html")
shutil.copy2(PATH, backup)
PATH.write_text(updated, encoding="utf-8")
print("CORRECTO: teléfono opcional en mesa; obligatorio para retiro/domicilio.")
print("RESPALDO:", backup)
print("No se creó ningún pedido y no se cambió la API.")
