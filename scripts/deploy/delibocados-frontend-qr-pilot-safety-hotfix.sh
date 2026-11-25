#!/usr/bin/env bash
# Surgical frontend-only update. Never creates orders, touches database,
# restarts the API, enables general checkout, or changes SmartPOS/Windows.
set -Eeuo pipefail
cd /var/www/control
[[ "$1" == "--instalar-validacion" ]] || { echo "BLOQUEADO: use --instalar-validacion"; exit 1; }
[[ "$(id -u)" == 0 ]] || { echo "BLOQUEADO: requiere root"; exit 1; }
for c in python3 pnpm pm2 curl node; do
  command -v "$c" >/dev/null || { echo "BLOQUEADO: falta $c"; exit 1; }
done
page=apps/dashboard/src/app/qr-pedido/page.tsx
view=apps/dashboard/src/app/qr-pedido/CafeMenuView.tsx
[[ -f "$page" && -f "$view" ]] || { echo "BLOQUEADO: falta fuente QR"; exit 1; }
[[ -f apps/dashboard/.next-delibocados/BUILD_ID ]] || { echo "BLOQUEADO: no hay build actual"; exit 1; }
[[ ! -e apps/dashboard/.next-delibocados-candidate ]] || { echo "BLOQUEADO: candidate ya existe"; exit 1; }

pm2 jlist | node -e '
let s="";process.stdin.on("data",b=>s+=b);process.stdin.on("end",()=>{
const p=JSON.parse(s),a=p.filter(x=>x.name==="neuromind-api"),n=p.filter(x=>x.name==="delibocados-whatsapp-next");
if(a.length!==1||n.length!==1){console.log("BLOQUEADO: procesos no unicos");process.exitCode=1;return}
const x=a[0].pm2_env,y=n[0].pm2_env;
const safe=x.status==="online"&&y.status==="online"&&x.DELIBOCADOS_QR_CHECKOUT_ENABLED==="0"&&
x.DELIBOCADOS_QR_MESA1_PILOT_ENABLED==="1"&&x.DELIBOCADOS_POS360_FULL_CLAIM_ENABLED==="0"&&
x.DELIBOCADOS_WEB_CHECKOUT_ENABLED!=="1"&&y.NEXT_PUBLIC_PANEL_INSTANCE==="delibocados";
console.log("PILOTO_RESTRINGIDO="+(x.DELIBOCADOS_QR_CHECKOUT_ENABLED==="0"&&x.DELIBOCADOS_QR_MESA1_PILOT_ENABLED==="1"));
console.log("NEXT_ES_DELIBOCADOS="+(y.NEXT_PUBLIC_PANEL_INSTANCE==="delibocados"));
console.log("CHECKOUT_GENERAL_OFF="+(x.DELIBOCADOS_WEB_CHECKOUT_ENABLED!=="1"));
if(!safe)process.exitCode=1;
});'
[[ "$(curl --noproxy '*' -sS -m 6 -o /dev/null -w '%{http_code}' http://127.0.0.1:3700/qr-pedido || true)" == 200 ]] ||
  { echo "BLOQUEADO: Next 3700 no sirve QR"; exit 1; }

backup="$(mktemp -d /tmp/deli-qr-frontend-safe.XXXXXX)"
chmod 700 "$backup"
cp -p "$page" "$backup/page.tsx"
cp -p "$view" "$backup/CafeMenuView.tsx"
sources_touched=0
build_moved=0
rollback(){
  rc=$?
  if [[ $rc == 0 ]]; then return; fi
  echo "DESPLIEGUE_FALLIDO=$rc"
  if [[ $sources_touched == 1 ]]; then
    cp -p "$backup/page.tsx" "$page" || true
    cp -p "$backup/CafeMenuView.tsx" "$view" || true
  fi
  if [[ $build_moved == 1 ]]; then
    [[ -d apps/dashboard/.next-delibocados ]] && mv apps/dashboard/.next-delibocados "$backup/failed-build" || true
    if [[ -d "$backup/old-build" ]]; then
      mv "$backup/old-build" apps/dashboard/.next-delibocados || true
    fi
    DELIBOCADOS_BUILD=1 NEXT_PUBLIC_PANEL_INSTANCE=delibocados \
      DELIBOCADOS_STAGING_BUILD=0 pm2 restart delibocados-whatsapp-next --update-env >/dev/null || true
  fi
  echo "FUENTES_RESTAURADAS_SI_MODIFICADAS=SI"
  echo "BACKUP=$backup"
}
trap rollback EXIT

# Two-phase preflight: validate ALL exact anchors before writing either source.
python3 - "$page" "$view" <<'PY'
import pathlib,sys
p=pathlib.Path(sys.argv[1])
v=pathlib.Path(sys.argv[2])
changes={
 p:[
  ('type Context={table:{id:string;label:string}|null;revision:number;products:Product[];ordersEnabled?:boolean;account?:Account|null};',
   'type Context={table:{id:string;label:string}|null;revision:number;products:Product[];ordersEnabled?:boolean;pilotOnly?:boolean;account?:Account|null};'),
  ('  INVALID_INPUT:"Los datos del código QR no tienen el formato esperado.",',
   '  INVALID_INPUT:"Los datos del código QR no tienen el formato esperado.",\n'
   '  QR_PILOT_SCOPE_DENIED:"Modo de prueba: solo 1 Hamburguesa Res, nombre PILOTO NEUROMIND, teléfono vacío, efectivo y sin observaciones.",'),
  ('ordersEnabled:payload.ordersEnabled===true,account:payload.account??null});',
   'ordersEnabled:payload.ordersEnabled===true,\n'
   '        pilotOnly:payload.pilotOnly===true||\n'
   '          (payload.ordersEnabled===true&&Array.isArray(payload.products)&&\n'
   '           payload.products.length===1&&payload.products[0]?.id==="deli-006"&&\n'
   '           payload.products[0]?.priceCOP===14000),\n'
   '        account:payload.account??null});'),
  ('   setError("");setBusy(true);\n   try{\n     const response=await fetch("/api/delibocados-qr/order",{',
   '   if(context.pilotOnly){\n'
   '     // UI guard only; API and SQL perform authoritative independent checks.\n'
   '     if(name.trim().toUpperCase()!=="PILOTO NEUROMIND"||phone.trim()!==""||\n'
   '        payment!=="cash"||selected.length!==1||selected[0].id!=="deli-006"||\n'
   '        selected[0].quantity!==1||(notes["deli-006"]??"").trim()!==""||\n'
   '        customerNote.trim()!==""){\n'
   '       setError("Modo de prueba: 1 Hamburguesa Res, nombre PILOTO NEUROMIND, teléfono y observaciones vacíos, pago en efectivo.");\n'
   '       return;\n'
   '     }\n'
   '   }\n'
   '   setError("");setBusy(true);\n'
   '   try{\n'
   '     const response=await fetch("/api/delibocados-qr/order",{')
 ],
 v:[
  ('type MenuContext={table:{id:string;label:string}|null;revision:number;products:Product[];ordersEnabled?:boolean;account?:Account|null};',
   'type MenuContext={table:{id:string;label:string}|null;revision:number;products:Product[];ordersEnabled?:boolean;pilotOnly?:boolean;account?:Account|null};'),
  ('          <div className={styles.formGrid}>',
   '          {context.pilotOnly?<div className={styles.checkoutWarning} role="status">Prueba controlada de Mesa 1: solo Hamburguesa Res × 1. Nombre PILOTO NEUROMIND, teléfono y observaciones vacíos, pago en efectivo. No es el checkout público.</div>:null}\n'
   '          <div className={styles.formGrid}>')
 ]
}
result={}
for file,repls in changes.items():
 s=file.read_text()
 for old,new in repls:
  if s.count(old)!=1:
   raise SystemExit('BLOQUEADO: código local desconocido: '+file.name+' '+old[:80])
  s=s.replace(old,new,1)
 result[file]=s
print('PREFLIGHT_PARCHES=6')
for file,s in result.items():
 file.write_text(s)
print('FRONTEND_PATCH=APLICADO')
PY
sources_touched=1
pnpm --filter @ventas/dashboard typecheck
echo "FRONTEND_TYPECHECK=OK"

DELIBOCADOS_BUILD=1 NEXT_PUBLIC_PANEL_INSTANCE=delibocados DELIBOCADOS_STAGING_BUILD=1 \
  pnpm -C apps/dashboard exec next build
[[ -f apps/dashboard/.next-delibocados-candidate/BUILD_ID ]] || { echo "BLOQUEADO: build incompleto"; exit 1; }
echo "NEXT_BUILD_CANDIDATE=OK"

mv apps/dashboard/.next-delibocados "$backup/old-build"
build_moved=1
mv apps/dashboard/.next-delibocados-candidate apps/dashboard/.next-delibocados
DELIBOCADOS_BUILD=1 NEXT_PUBLIC_PANEL_INSTANCE=delibocados DELIBOCADOS_STAGING_BUILD=0 \
  pm2 restart delibocados-whatsapp-next --update-env >/dev/null

ok=0
for i in $(seq 1 35); do
  status="$(curl --noproxy '*' -sS -m 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:3700/qr-pedido 2>/dev/null || true)"
  if [[ "$status" == 200 ]]; then ok=1; break; fi
  sleep 2
done
[[ "$ok" == 1 ]] || { echo "BLOQUEADO: QR Next no responde tras reinicio"; exit 1; }

echo "FRONTEND_VALIDACION_INSTALADA=SI"
echo "QR_NEXT_HTTP=200"
echo "API_NO_REINICIADA=SI"
echo "BD_NO_MODIFICADA=SI"
echo "POS360_WINDOWS_NO_MODIFICADO=SI"
echo "BACKUP_PREVIO=$backup"
trap - EXIT
