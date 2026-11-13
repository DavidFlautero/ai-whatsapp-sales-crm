#!/usr/bin/env python3
"""Read-only audit of the actual production menu HTML. No browser/DB writes."""
from html.parser import HTMLParser
from pathlib import Path
import re

path = Path("/var/www/delibocados-public/carta.html")
s = path.read_text(encoding="utf-8")
print("=== DELIBOCADOS / DIAGNOSTICO REAL DEL CARRITO ===")
print("HTML_BYTES:", path.stat().st_size)
for label, regex in {
    "PLACEHOLDER": r"Pedidos?\s+en\s+l[ií]nea\s+pr[oó]ximamente",
    "LEGACY_SELECTOR": r"disabled-submit",
    "NEW_SCRIPT_ID": r'id=["\x27]delibocados-menu-live-checkout["\x27]',
    "DYNAMIC_OBSERVER": r"MutationObserver\(scheduleScan\)",
    "BODY_CLOSINGS": r"</body\s*>",
}.items():
    print(label, len(re.findall(regex,s,re.I)))
for phrase in ["Pedidos en línea próximamente","disabled-submit","delibocados-menu-live-checkout"]:
    found = list(re.finditer(re.escape(phrase),s,re.I))
    print("---",phrase,"hits:",len(found))
    for m in found[:6]:
        raw=s[max(0,m.start()-240):min(len(s),m.end()+220)]
        raw=re.sub(r"data:image/[^ \x22\x27>]+", "[IMAGEN_OMITIDA]",raw)
        raw=re.sub(r"https?://[^\x22\x27<> ]+", "[URL_OMITIDA]",raw)
        raw=re.sub(r"[\t\r\n]+"," ",raw)
        print("FRAGMENTO:",raw[:500])
class Analyzer(HTMLParser):
    def __init__(self):
        super().__init__();self.stack=[];self.matches=[];self.inputs=[];self.scriptIds=[]
    def handle_starttag(self,tag,attrs):
        d=dict(attrs)
        if tag not in ("meta","link","input","img","br","hr","source"):
            self.stack.append((tag,d))
        if tag in ("button","input","a","div","span") and ("disabled-submit" in str(d.get("class","")) or re.search(r"checkout|submit|pedido",str(d.get("id",""))+" "+str(d.get("name","")),re.I)):
            self.matches.append((tag,{k:v for k,v in d.items() if k in ("id","class","type","name","disabled","role","value")}))
        if tag in ("input","textarea","select") and len(self.inputs)<100:
            self.inputs.append((tag,{k:v for k,v in d.items() if k in ("id","name","type","placeholder","value","disabled")}))
        if tag=="script":
            self.scriptIds.append(d.get("id") or d.get("src") or "(inline)")
    def handle_endtag(self,tag):
        for i in range(len(self.stack)-1,-1,-1):
            if self.stack[i][0]==tag:
                self.stack=self.stack[:i];return
a=Analyzer()
try:a.feed(s)
except Exception as e:print("HTML_PARSER_ERROR:",type(e).__name__)
print("=== CANDIDATOS A BOTON ===")
for tag,attrs in a.matches[-35:]:
    print(tag,{k:(str(v)[:90] if v is not None else None) for k,v in attrs.items()})
print("=== CAMPOS EN HTML ===")
for tag,attrs in a.inputs[-45:]:
    print(tag,{k:(str(v)[:70] if v is not None else None) for k,v in attrs.items()})
print("=== SCRIPTS ===")
print("SCRIPTS_TOTAL",len(a.scriptIds),"ULTIMOS",a.scriptIds[-8:])
print("=== FIN DE AUDITORIA SIN CAMBIOS ===")
