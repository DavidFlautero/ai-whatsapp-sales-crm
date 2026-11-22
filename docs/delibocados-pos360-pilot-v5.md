# Delibocados — POS360 pilot v5 (NOT DEPLOYED)

This draft protects six historical pending POS360 exports while preparing the existing Neuromind QR → SmartPOS connector.

## Changes

- Legacy /claim defaults to blocked; only enable full claim after historical queue reconciliation.
- Authenticated /claim-pilot delegates to a new PostgreSQL function requiring a new, explicitly enabled, non-expired export UUID allowlist entry.
- A separate Windows pilot worker uses /claim-pilot and single-run explicit opt-in. Default mode checks health only.
- No original SmartPOS JAR, settings, or MySQL modifications are included in this GitHub branch.

## Status and blockers

16/16 QR tables mapped. Mesa 4 ticket and KDS tested under the previous canary. Six existing pending exports MUST remain unclaimed. 126 catalog matches; deli-055 price to correct to 8000 COP in Neuromind; six returnable drinks unmapped; no SKU approvals yet.

Full incremental Java 8 bridge and local native adapter are in the separate user ZIP package Neuromind-QR-SmartPOS-Automatico-v5.zip, not installed on Windows or VPS.

Before merging: validate SQL against the live schema in staging, check route auth and all preconditions, verify Windows incremental append with original JAR and GUI, approve SKU mapping and safeguards, reconcile old exports. Never start a continuous worker or enable a general claim during the pilot.

IMPORTANT: Direct edits to serialized tickets may conflict with a simultaneously open GUI ticket. Require operator-serialization testing before enabling production.