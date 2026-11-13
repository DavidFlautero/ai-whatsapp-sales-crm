#!/usr/bin/env python3
"""Only add Delibocados v2 release slot/rewrite to the local Next config.

Keeps unrelated local settings; fails closed on unexpected distDir/rewrites.
This does NOT change the current running Next process unless deploy succeeds.
"""
from pathlib import Path
import sys
if len(sys.argv) != 3:
    raise SystemExit("Uso: transform.py NEXT_CONFIG OUTPUT")
source = Path(sys.argv[1])
output = Path(sys.argv[2])
s = source.read_text(encoding="utf-8")
needle = "const nextConfig = {"
release = 'const menuRelease=process.env.DELIBOCADOS_RELEASE_SLOT==="menu-v2";'
old_dist = '''  distDir: process.env.DELIBOCADOS_STAGING_BUILD === "1"
    ? ".next-delibocados-candidate"
    : isDelibocados ? ".next-delibocados" : ".next",'''
new_dist = '''  distDir: menuRelease
    ? ".next-delibocados-menu-v2"
    : process.env.DELIBOCADOS_STAGING_BUILD === "1"
      ? ".next-delibocados-candidate"
      : isDelibocados ? ".next-delibocados" : ".next",'''
new_rewrites = '''  // Keep the existing QR URL, route it to the isolated new storefront
  // before Next matches the old page. Only the v2 release uses this rewrite.
  async rewrites() {
    return {
      beforeFiles: menuRelease
        ? [{ source: "/qr-pedido", destination: "/qr-pedido-v2" }]
        : [],
      afterFiles: [],
      fallback: [],
    };
  },
'''
if s.count(needle) != 1:
    raise ValueError("NEXT_CONFIG_STRUCTURE_CHANGED")
if release not in s:
    if "const menuRelease" in s:
        raise ValueError("NEXT_CONFIG_RELEASE_SLOT_CHANGED")
    s = s.replace(needle, release + "\n" + needle, 1)
if old_dist in s:
    if s.count(old_dist) != 1:
        raise ValueError("NEXT_CONFIG_DISTDIR_AMBIGUOUS")
    s = s.replace(old_dist, new_dist, 1)
elif new_dist not in s:
    raise ValueError("NEXT_CONFIG_DISTDIR_UNEXPECTED")
if "async rewrites()" not in s:
    ending = "};\n\nexport default nextConfig;"
    if s.count(ending) != 1:
        raise ValueError("NEXT_CONFIG_ENDING_CHANGED")
    s = s.replace(ending, new_rewrites + ending, 1)
elif new_rewrites not in s:
    # An independently written rewrite function needs a manual merge.
    raise ValueError("NEXT_CONFIG_EXISTING_REWRITES_REQUIRE_REVIEW")
for marker in (release, ".next-delibocados-menu-v2", 'destination: "/qr-pedido-v2"'):
    if marker not in s:
        raise ValueError("NEXT_CONFIG_INCOMPLETE")
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(s,encoding="utf-8")
print("PATCH_NEXT_CONFIG_OK: conserva ajustes locales, activa ruta v2 solo en menu-v2")
