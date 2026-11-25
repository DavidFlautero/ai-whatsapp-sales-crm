#!/usr/bin/env bash
# Guarded, narrowly scoped API hotfix:
# - cancelled orders stay in database but disappear from active QR bill
# - wrong pilot customer details reject with deterministic HTTP 422
# NO checkout enablement, NO order creation, NO POS/Windows changes.
set -Eeuo pipefail
cd /var/www/control
route=apps/api/src/routes/restaurant-qr-public.routes.ts
fail(){ echo "BLOQUEADO: $*" >&2; exit 1; }
[[ "$(id -u)" == "0" ]] || fail REQUIERE_ROOT
[[ -f "$route" ]] || fail RUTA_NO_EXISTE
command -v pnpm >/dev/null && command -v pm2 >/dev/null && command -v python3 >/dev/null || fail DEPENDENCIAS_NO_DISPONIBLES

# Preserve production flags exactly; refuse unexpected checkout modes.
pm2 jlist | node -e '
let b="";process.stdin.on("data",x=>b+=x);process.stdin.on("end",()=>{
const entries=JSON.parse(b).filter(p=>p.name==="neuromind-api");
if(entries.length!==1)process.exit(1);
const e=entries[0].pm2_env||{};
const safe=e.status==="online" &&
e.DELIBOCADOS_QR_CHECKOUT_ENABLED==="0" &&
e.DELIBOCADOS_QR_MESA1_PILOT_ENABLED==="1" &&
e.DELIBOCADOS_POS360_FULL_CLAIM_ENABLED==="0" &&
e.DELIBOCADOS_WEB_CHECKOUT_ENABLED!=="1";
console.log("API_ONLINE="+(e.status==="online"));
console.log("PILOTO_RESTRINGIDO="+(e.DELIBOCADOS_QR_CHECKOUT_ENABLED==="0"&&e.DELIBOCADOS_QR_MESA1_PILOT_ENABLED==="1"));
console.log("CHECKOUT_WEB_APAGADO="+(e.DELIBOCADOS_WEB_CHECKOUT_ENABLED!=="1"));
console.log("CLAIM_GENERAL_APAGADO="+(e.DELIBOCADOS_POS360_FULL_CLAIM_ENABLED==="0"));
if(!safe)process.exitCode=1;
});' || fail FLAGS_INSEGUROS

# Refuse to overwrite local fixes on this VPS.
python3 - "$route" <<'PY'
import pathlib,sys
s=pathlib.Path(sys.argv[1]).read_text()
assert 'READ_ONLY_PICKUP_CONTEXT_BOOTSTRAP_V1' in s,'READ_ONLY_PICKUP_CONTEXT_NO_ESTABLECIDO'
assert 'NEUROMIND_CANARY_SINGLE_ORDER' in s,'PILOT_QR_ROUTE_MISSING'
assert 'restaurant_ops_create_qr_order_pilot' in s,'PILOT_RPC_MISSING'
fixes=[
 ('"&select=id,number,status,total_cop,created_at,"+',
  '"&status=neq.cancelled"+\n      "&select=id,number,status,total_cop,created_at,"+'),
 ('  return {\n    id:session.id,openedAt:session.opened_at,',
  '  // Cancelled orders remain in admin/audit; only active orders belong to the customer bill.\n  if(orders.length===0)return null;\n  return {\n    id:session.id,openedAt:session.opened_at,'),
 ('createdAt:o.created_at,totalCOP:o.status==="cancelled"?0:o.total_cop,',
  'createdAt:o.created_at,totalCOP:o.total_cop,'),
 ('items:o.status==="cancelled"?[]:(o.restaurant_ops_order_items??[]).map(i=>({',
  'items:(o.restaurant_ops_order_items??[]).map(i=>({'),
 ('totalCOP:orders.reduce((n,o)=>n+(o.status==="cancelled"?0:o.total_cop),0),',
  'totalCOP:orders.reduce((n,o)=>n+o.total_cop,0),'),
 ('table.label!=="Mesa 1"||payload.paymentMethod!=="cash"||',
  'table.label!=="Mesa 1"||payload.paymentMethod!=="cash"||\n'
  '         payload.customerName.trim().toUpperCase()!=="PILOTO NEUROMIND"||\n'
  '         (payload.customerPhone??"").trim()!==""||'),
 ('return jsonError(res,403,"QR_PILOT_SCOPE_DENIED");',
  'return jsonError(res,422,"QR_PILOT_SCOPE_DENIED");')
]
pending=0
already=0
for old,new in fixes:
 if s.count(new)==1:
  already+=1
 elif s.count(old)==1:
  pending+=1
 else:
  raise SystemExit('BLOQUEADO: source desconocido/ambiguo: '+old[:70])
print("PATCH_SOURCE=VALIDADO")
print("CAMBIOS_PENDIENTES="+str(pending))
print("CAMBIOS_YA_PRESENTES="+str(already))
PY

dir="$(mktemp -d /tmp/delibocados-qr-active-bill.XXXXXX)"
cp -p "$route" "$dir/restaurant-qr-public.routes.ts"
echo "BACKUP_API=$dir"
restore_required=1
restart_started=0
restore(){
 if [[ "$restore_required" == 0 ]]; then return; fi
 echo "ROLLBACK_API=APLICANDO"
 cp -p "$dir/restaurant-qr-public.routes.ts" "$route" || true
 if [[ "$restart_started" == 1 ]]; then
  DELIBOCADOS_WEB_CHECKOUT_ENABLED=0 \
  DELIBOCADOS_QR_CHECKOUT_ENABLED=0 \
  DELIBOCADOS_QR_MESA1_PILOT_ENABLED=1 \
  DELIBOCADOS_POS360_FULL_CLAIM_ENABLED=0 \
  pm2 restart neuromind-api --update-env >/dev/null || true
 fi
}
trap restore EXIT

python3 - "$route" <<'PY'
import pathlib,sys
p=pathlib.Path(sys.argv[1]);s=p.read_text()
fixes=[
 ('"&select=id,number,status,total_cop,created_at,"+',
  '"&status=neq.cancelled"+\n      "&select=id,number,status,total_cop,created_at,"+'),
 ('  return {\n    id:session.id,openedAt:session.opened_at,',
  '  // Cancelled orders remain in admin/audit; only active orders belong to the customer bill.\n  if(orders.length===0)return null;\n  return {\n    id:session.id,openedAt:session.opened_at,'),
 ('createdAt:o.created_at,totalCOP:o.status==="cancelled"?0:o.total_cop,',
  'createdAt:o.created_at,totalCOP:o.total_cop,'),
 ('items:o.status==="cancelled"?[]:(o.restaurant_ops_order_items??[]).map(i=>({',
  'items:(o.restaurant_ops_order_items??[]).map(i=>({'),
 ('totalCOP:orders.reduce((n,o)=>n+(o.status==="cancelled"?0:o.total_cop),0),',
  'totalCOP:orders.reduce((n,o)=>n+o.total_cop,0),'),
 ('table.label!=="Mesa 1"||payload.paymentMethod!=="cash"||',
  'table.label!=="Mesa 1"||payload.paymentMethod!=="cash"||\n'
  '         payload.customerName.trim().toUpperCase()!=="PILOTO NEUROMIND"||\n'
  '         (payload.customerPhone??"").trim()!==""||'),
 ('return jsonError(res,403,"QR_PILOT_SCOPE_DENIED");',
  'return jsonError(res,422,"QR_PILOT_SCOPE_DENIED");')
]
pending=0
for old,new in fixes:
 if s.count(new)==1:
  continue
 assert s.count(old)==1,'Source changed during preflight: '+old[:70]
 s=s.replace(old,new,1)
 pending+=1
if pending:
 p.write_text(s)
print("CAMBIOS_APLICADOS="+str(pending))
PY

pnpm --filter @ventas/api typecheck >/dev/null
echo "TYPECHECK=OK"

restart_started=1
DELIBOCADOS_WEB_CHECKOUT_ENABLED=0 \
DELIBOCADOS_QR_CHECKOUT_ENABLED=0 \
DELIBOCADOS_QR_MESA1_PILOT_ENABLED=1 \
DELIBOCADOS_POS360_FULL_CLAIM_ENABLED=0 \
pm2 restart neuromind-api --update-env >/dev/null

ok=0
for i in $(seq 1 40); do
 status="$(curl --noproxy '*' -sS -o /dev/null -w '%{http_code}' \
 -m 3 -X POST -H 'Content-Type: application/json' --data '{}' \
 http://127.0.0.1:4000/public/delibocados-qr/context 2>/dev/null || true)"
 if [[ "$status" == 400 ]]; then ok=1; break; fi
 sleep 2
done
[[ "$ok" == 1 ]] || fail "API_NO_DISPONIBLE_DESPUES_DE_REINICIO; HTTP=$status"
echo "API_QR_RESPONDE=SI"

# Read-only Postgres verification; no raw phone/token or customer details.
db="$(docker ps --format '{{.Names}}' | grep -Ei 'supabase.*db|db.*supabase' | head -n 1 || true)"
if [[ -n "$db" ]]; then
 docker exec "$db" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atq <<'SQL'
SELECT 'PILOTO_CONSUMIDO='||(consumed_at IS NOT NULL)::text||
 ' PILOTO_VIGENTE='||(enabled AND now()<expires_at)::text
FROM public.restaurant_ops_qr_single_use_pilot WHERE singleton=1;
SELECT 'EXPORTACIONES_PENDING='||count(*)
FROM public.restaurant_ops_pos_exports
WHERE company_id='delibocados' AND provider='pos360' AND status='pending';
SQL
fi
restore_required=0
trap - EXIT
echo "CORRECCION_API=INSTALADA"
echo "CANCELADOS_OCULTOS_EN_CUENTA_CLIENTE=SI; AUDITORIA_INTACTA=SI"
echo "PILOTO_DATOS_INVALIDOS=HTTP_422"
echo "TRABAJADOR_WINDOWS=NO_EJECUTADO"
