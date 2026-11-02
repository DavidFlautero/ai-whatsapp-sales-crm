"""Owner-only connector settings for Delibocados; encrypted independently of AI credentials.
Toteat supports read-only menu validation; POS360 requires a verified licensed adapter.
"""
from pathlib import Path
from threading import Lock
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
import json
import os
import re
import time
import restaurant_ai_config as enc

STORE = Path("/root/neuromind-data/restaurant-ai/delibocados/connectors.enc.json")
LOCK = Lock()
_last_test = {"toteat": 0.0, "pos360": 0.0, "openai": 0.0, "anthropic": 0.0}
BASES = {"production": "https://api.toteat.com/mw/or/1.0/",
         "development": "https://apidev.toteat.com/mw/or/1.0/"}

def defaults():
    return {
        "toteat": {"enabled": False, "environment": "production",
                   "restaurantId": "", "localId": "", "userId": "",
                   "apiToken": "", "originChannel": ""},
        "pos360": {"mode": "not_connected", "bridgeUrl": "", "apiToken": "",
                   "installationId": "", "notes": ""},
    }

def _read():
    data = defaults()
    if STORE.is_file():
        stored = enc._crypto("decrypt", json.loads(STORE.read_text()))
        if not isinstance(stored, dict):
            raise ValueError("CONNECTOR_STORE_INVALID")
        for provider in data:
            if isinstance(stored.get(provider), dict):
                data[provider].update(stored[provider])
    return data

def public():
    with LOCK:
        data = _read()
    t, p = data["toteat"], data["pos360"]
    return {"ok": True, "companyId": "delibocados",
            "toteat": {
                "enabled": t["enabled"], "environment": t["environment"],
                "restaurantId": t["restaurantId"], "localId": t["localId"],
                "userId": t["userId"], "originChannel": t["originChannel"],
                "apiTokenConfigured": bool(t["apiToken"]),
                "readyToTest": all(t[k] for k in ("restaurantId", "localId", "userId", "apiToken")),
                "orderIntegrationActive": False},
            "pos360": {
                "mode": p["mode"], "bridgeUrl": p["bridgeUrl"],
                "installationId": p["installationId"], "notes": p["notes"],
                "apiTokenConfigured": bool(p["apiToken"]),
                "adapterActive": False}}

def clean(s, key, maxlen=200, regex=None):
    if not isinstance(s, str) or len(s)>maxlen:
        raise ValueError("INVALID_" + key)
    s=s.strip()
    if regex and s and not re.fullmatch(regex,s):
        raise ValueError("INVALID_" + key)
    return s

def save(body):
    if not isinstance(body,dict) or not body or set(body) - {"toteat", "pos360"}:
        raise ValueError("INVALID_INTEGRATIONS_REQUEST")
    with LOCK:
        cfg=_read()
        for provider, changes in body.items():
            if not isinstance(changes,dict) or set(changes)-set(cfg[provider]):
                raise ValueError("INVALID_" + provider.upper())
            obj=cfg[provider]
            for key,value in changes.items():
                if provider=="toteat":
                    if key=="enabled":
                        if type(value) is not bool:
                            raise ValueError("INVALID_ENABLED")
                        obj[key]=value
                    elif key=="environment":
                        if value not in BASES:
                            raise ValueError("INVALID_ENVIRONMENT")
                        obj[key]=value
                    elif key in ("restaurantId","localId","userId"):
                        obj[key]=clean(value,key,100,r"[0-9]{1,32}")
                    elif key=="originChannel":
                        obj[key]=clean(value,key,100,r"[A-Za-z0-9._ -]{0,100}")
                    elif key=="apiToken":
                        v=clean(value,key,4000)
                        if v: obj[key]=v
                else:
                    if key=="mode":
                        if value not in ("not_connected","local_bridge"):
                            raise ValueError("INVALID_MODE")
                        obj[key]=value
                    elif key=="bridgeUrl":
                        value=clean(value,key,500)
                        if value and not re.fullmatch(r"https://[A-Za-z0-9.-]+(?::[0-9]{2,5})?(?:/[A-Za-z0-9/_-]*)?", value):
                            raise ValueError("BRIDGE_HTTPS_REQUIRED")
                        obj[key]=value
                    elif key=="apiToken":
                        v=clean(value,key,4000)
                        if v: obj[key]=v
                    elif key=="installationId":
                        obj[key]=clean(value,key,100)
                    elif key=="notes":
                        obj[key]=clean(value,key,800)
        STORE.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
        STORE.parent.chmod(0o700)
        import tempfile
        raw=enc._crypto("encrypt",cfg)
        fd,tmp=tempfile.mkstemp(prefix=".connectors-",dir=str(STORE.parent))
        try:
            os.fchmod(fd,0o600)
            with os.fdopen(fd,"w",encoding="utf8") as f:
                json.dump(raw,f,ensure_ascii=False)
                f.flush();os.fsync(f.fileno())
            os.replace(tmp,STORE)
        finally:
            if os.path.exists(tmp):os.unlink(tmp)
    return public()

def test(provider):
    if provider not in _last_test:
        raise ValueError("UNKNOWN_PROVIDER")
    now=time.monotonic()
    with LOCK:
        if now-_last_test[provider]<20:
            return {"ok":False,"status":"rate_limited","message":"Esperá 20 segundos para repetir la prueba."}
        _last_test[provider]=now
    if provider=="pos360":
        return {"ok":False,"status":"adapter_not_available",
                "message":"POS360 requiere comprobar su API/licencia y configurar un puente local seguro; aún no hay envío de comandas."}
    if provider in ("openai","anthropic"):
        a=enc.read()["ai"]
        key=a["openaiApiKey" if provider=="openai" else "anthropicApiKey"]
        if not key:
            return {"ok":False,"status":"missing_key","message":"Primero guardá la clave API de este proveedor."}
        if provider=="openai":
            url="https://api.openai.com/v1/models"
            headers={"Authorization":"Bearer "+key}
        else:
            url="https://api.anthropic.com/v1/models"
            headers={"x-api-key":key,"anthropic-version":"2023-06-01"}
    else:
        t=_read()["toteat"]
        if not all(t[k] for k in ("restaurantId","localId","userId","apiToken")):
            return {"ok":False,"status":"incomplete","message":"Faltan ID de restaurante, local, usuario o token."}
        params={"xir":t["restaurantId"],"xil":t["localId"],
                "xiu":t["userId"],"xapitoken":t["apiToken"],"activeProducts":"true"}
        url=BASES[t["environment"]]+"products?"+urlencode(params)
        headers={"Accept":"application/json"}
    try:
        request=Request(url,headers=headers,method="GET")
        with urlopen(request,timeout=14) as response:
            result=json.loads(response.read(1000000).decode("utf8"))
        if provider=="toteat" and isinstance(result,dict) and result.get("ok") is False:
            return {"ok":False,"status":"rejected","message":"Toteat rechazó la consulta de productos."}
        count = len(result["data"]) if provider=="toteat" and isinstance(result,dict) and isinstance(result.get("data"),list) else None
        return {"ok":True,"status":"connected","message":"Credenciales aceptadas por "+provider+".",
                **({"productCount":count} if count is not None else {})}
    except HTTPError as error:
        return {"ok":False,"status":"http_error","httpCode":error.code,
                "message":"El proveedor devolvió HTTP "+str(error.code)+". Revisá credenciales y permisos."}
    except (URLError, ValueError, TimeoutError):
        return {"ok":False,"status":"unavailable",
                "message":"No se pudo completar la prueba. Revisá conexión, permisos y credenciales."}
