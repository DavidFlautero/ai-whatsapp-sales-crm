#!/usr/bin/env python3
"""Read-only tenant-scoped restaurant panel. Local host only; auth required for all data.
Never expose other tenants' integrations or webhook configurations.
"""
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
import json
import os
import restaurant_ai_config as ai_config
import restaurant_floorplan as floorplan

COMPANY = "delibocados"
BACKEND = "http://127.0.0.1:4100"
ROOT = Path("/var/www/delibocados-owner")
PORT = int(os.environ.get("DELIBOCADOS_PANEL_PORT", "3601"))

class App(BaseHTTPRequestHandler):
    server_version = "RestaurantPanel/1.0"
    def log_message(self, fmt, *args):
        # No loggear cookies, datos de clientes ni contenido de pedidos.
        print("[restaurant-panel]", self.command, urlsplit(self.path).path,
              fmt % args, flush=True)

    def send(self, code, body, kind="application/json; charset=utf-8"):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, ensure_ascii=False).encode("utf-8")
        elif isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        if "text/html" in kind:
            self.send_header("Content-Security-Policy",
                "default-src 'self'; style-src 'self' 'unsafe-inline'; "
                "script-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; "
                "frame-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'")
        self.end_headers()
        self.wfile.write(body)

    def backend(self, path, cookie):
        # La cookie nunca sale de localhost; el backend valida JWT.
        request = Request(BACKEND + path, headers={
            "Cookie": cookie,
            "Accept": "application/json",
        }, method="GET")
        with urlopen(request, timeout=12) as res:
            data = res.read(6_000_000)
            return json.loads(data.decode("utf-8"))

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/health":
            return self.send(200, {"ok": True, "service": "delibocados-restaurant-panel"})
        if path not in ("/authz", "/panel", "/panel/ia", "/panel/plano", "/api/restaurant/overview",
                        "/api/restaurant/orders", "/api/restaurant/customers",
                        "/api/restaurant/ai-config", "/api/restaurant/floorplan"):
            return self.send(404, {"ok": False, "error": "NOT_FOUND"})
        cookie = self.headers.get("Cookie", "")
        if not cookie:
            return self.send(401, {"ok": False, "error": "LOGIN_REQUIRED"})
        try:
            session = self.backend("/auth/session", cookie)
            user = session.get("user") or {}
        except (HTTPError, URLError, ValueError, TimeoutError) as error:
            return self.send(401, {"ok": False, "error": "INVALID_SESSION"})
        if (user.get("companyId") != COMPANY or
                user.get("role") not in ("owner", "admin") or
                user.get("active") is not True):
            return self.send(403, {"ok": False, "error": "WRONG_COMPANY_OR_ROLE"})
        if path == "/authz":
            return self.send(200, {"ok": True})
        if path == "/panel/plano":
            page = ROOT / "restaurant-floorplan.html"
            if not page.is_file():
                return self.send(503, {"ok": False, "error": "FLOORPLAN_PAGE_NOT_INSTALLED"})
            return self.send(200, page.read_bytes(), "text/html; charset=utf-8")
        if path == "/api/restaurant/floorplan":
            try:
                return self.send(200, {"ok": True, "companyId": COMPANY, **floorplan.get()})
            except Exception:
                return self.send(503, {"ok": False, "error": "FLOORPLAN_UNAVAILABLE"})
        if path == "/panel/ia":
            page = ROOT / "restaurant-ai-settings.html"
            if not page.is_file():
                return self.send(503, {"ok": False, "error": "SETTINGS_PAGE_NOT_INSTALLED"})
            return self.send(200, page.read_bytes(), "text/html; charset=utf-8")
        if path == "/api/restaurant/ai-config":
            try:
                return self.send(200, ai_config.public())
            except Exception:
                return self.send(503, {"ok": False, "error": "AI_SETTINGS_UNAVAILABLE"})
        if path == "/panel":
            page = ROOT / "restaurant-dashboard.html"
            if not page.is_file():
                return self.send(503, {"ok": False, "error": "DASHBOARD_NOT_INSTALLED"})
            return self.send(200, page.read_bytes(), "text/html; charset=utf-8")
        if path == "/api/restaurant/overview":
            results = {}
            for name, route in (("orders", "/orders"), ("customers", "/crm/customers")):
                try:
                    data = self.backend(route, cookie)
                    results[name] = data.get(name, []) if isinstance(data, dict) else []
                    results[name + "Status"] = "ready"
                except HTTPError as err:
                    results[name] = []
                    results[name + "Status"] = "HTTP " + str(err.code)
                except (URLError, ValueError, TimeoutError):
                    results[name] = []
                    results[name + "Status"] = "unavailable"
            return self.send(200, {"ok": True, "companyId": COMPANY, **results})
        target = "/orders" if path.endswith("/orders") else "/crm/customers"
        try:
            result = self.backend(target, cookie)
            return self.send(200, result)
        except HTTPError as err:
            return self.send(err.code, {"ok": False, "error": "BACKEND_DENIED"})
        except (URLError, ValueError, TimeoutError):
            return self.send(502, {"ok": False, "error": "BACKEND_UNAVAILABLE"})

    def do_PUT(self):
        path = urlsplit(self.path).path
        if path not in ("/api/restaurant/ai-config", "/api/restaurant/floorplan"):
            return self.send(404, {"ok": False, "error": "NOT_FOUND"})
        # Un token de sesión de navegador solo autoriza escrituras desde nuestro origen.
        origin = self.headers.get("Origin", "")
        fetch_site = self.headers.get("Sec-Fetch-Site", "")
        if origin != "https://delibocados.online" or fetch_site not in ("", "same-origin"):
            return self.send(403, {"ok": False, "error": "ORIGIN_NOT_ALLOWED"})
        if self.headers.get("Content-Type", "").split(";")[0].strip().lower() != "application/json":
            return self.send(415, {"ok": False, "error": "JSON_REQUIRED"})
        cookie = self.headers.get("Cookie", "")
        if not cookie:
            return self.send(401, {"ok": False, "error": "LOGIN_REQUIRED"})
        try:
            session = self.backend("/auth/session", cookie)
            user = session.get("user") or {}
        except (HTTPError, URLError, ValueError, TimeoutError):
            return self.send(401, {"ok": False, "error": "INVALID_SESSION"})
        if (user.get("companyId") != COMPANY or
                user.get("role") not in ("owner", "admin") or
                user.get("active") is not True):
            return self.send(403, {"ok": False, "error": "WRONG_COMPANY_OR_ROLE"})
        try:
            size = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return self.send(400, {"ok": False, "error": "INVALID_CONTENT_LENGTH"})
        if not 1 <= size <= (65536 if path.endswith("/floorplan") else 16000):
            return self.send(413, {"ok": False, "error": "INVALID_PAYLOAD_SIZE"})
        try:
            data = json.loads(self.rfile.read(size))
            if path == "/api/restaurant/floorplan":
                result = {"ok": True, "companyId": COMPANY, **floorplan.save(data)}
            else:
                result = ai_config.save(data)
        except RuntimeError as err:
            return self.send(409, {"ok": False, "error": str(err)[:120]})
        except (ValueError, TypeError) as err:
            return self.send(400, {"ok": False, "error": str(err)[:120]})
        except Exception:
            return self.send(503, {"ok": False, "error": "SETTINGS_NOT_SAVED"})
        return self.send(200, result)

    def do_POST(self):
        return self.send(405, {"ok": False, "error": "READ_ONLY_ENDPOINT"})

if __name__ == "__main__":
    print("[restaurant-panel] bind 127.0.0.1 port", PORT, flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), App).serve_forever()
