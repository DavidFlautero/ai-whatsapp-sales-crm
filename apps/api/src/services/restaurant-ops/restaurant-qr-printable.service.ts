/**
 * Encrypted-at-rest printable QR capability for a single Delibocados table.
 * The public QR never expires automatically; replacement requires an explicit
 * owner/admin operation. Reprint decrypts only for that authorized admin.
 *
 * Do not log QR URLs or bearer tokens. Keep the master key backed up: losing
 * it makes saved QR links unrecoverable (existing printed links still work).
 */
import {
  createHash, createCipheriv, createDecipheriv, hkdfSync, randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { loadCompanySecretMasterKey } from "../integrations/company-secret-master-key.service.js";

const COMPANY = "delibocados";
const PREFIX = "qr-v1.";
const tokenPattern = /^[A-Za-z0-9_-]{32,200}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function subkey(master: Buffer, tableId: string): Buffer {
  if(master.length!==32 || !uuidPattern.test(tableId))
    throw new Error("QR_SECRET_CONTEXT_INVALID");
  return Buffer.from(hkdfSync("sha256",master,
    Buffer.from("neuromind-delibocados-permanent-qr-v1"),
    Buffer.from(COMPANY+":"+tableId.toLowerCase()),32));
}
function aad(tableId:string):Buffer{
  return Buffer.from("delibocados:printable-qr:v1:"+tableId.toLowerCase());
}

export function hashTableQrToken(token:string):string{
  if(!tokenPattern.test(token))throw new Error("QR_TOKEN_INVALID");
  return createHash("sha256").update(token).digest("hex");
}

/** Compact v1 envelope: IV (12), GCM tag (16), ciphertext. */
export function encryptPrintableTableQrToken(token:string,tableId:string,master:Buffer):string{
  hashTableQrToken(token);
  const iv=randomBytes(12);
  const cipher=createCipheriv("aes-256-gcm",subkey(master,tableId),iv);
  cipher.setAAD(aad(tableId));
  const ciphertext=Buffer.concat([cipher.update(token,"utf8"),cipher.final()]);
  return PREFIX+Buffer.concat([iv,cipher.getAuthTag(),ciphertext]).toString("base64url");
}

export function decryptPrintableTableQrToken(
  envelope:string,tableId:string,expectedSha256:string,master:Buffer
):string{
  if(typeof envelope!=="string" || !envelope.startsWith(PREFIX) ||
      envelope.length>512 || !/^[0-9a-f]{64}$/.test(expectedSha256))
    throw new Error("QR_REPRINT_UNAVAILABLE");
  const raw=Buffer.from(envelope.slice(PREFIX.length),"base64url");
  if(raw.length<60 || raw.length>256)throw new Error("QR_REPRINT_UNAVAILABLE");
  const iv=raw.subarray(0,12),tag=raw.subarray(12,28),ciphertext=raw.subarray(28);
  const decipher=createDecipheriv("aes-256-gcm",subkey(master,tableId),iv);
  decipher.setAAD(aad(tableId));decipher.setAuthTag(tag);
  const token=Buffer.concat([decipher.update(ciphertext),decipher.final()]).toString("utf8");
  const hash=hashTableQrToken(token);
  if(!timingSafeEqual(Buffer.from(hash,"hex"),Buffer.from(expectedSha256,"hex")))
    throw new Error("QR_REPRINT_HASH_MISMATCH");
  return token;
}

export function issuePrintableTableQrToken(tableId:string){
  const token=randomBytes(32).toString("base64url");
  const sha256=hashTableQrToken(token);
  const sealed=encryptPrintableTableQrToken(token,tableId,loadCompanySecretMasterKey(COMPANY));
  return {token,sha256,sealed};
}
export function recoverPrintableTableQrToken(tableId:string,sha256:string,sealed:string){
  return decryptPrintableTableQrToken(
    sealed,tableId,sha256,loadCompanySecretMasterKey(COMPANY)
  );
}
export function printableTableQrUrl(tableId:string,token:string):string{
  return "https://panel.delibocados.online/qr-pedido"+
    "#kind=table&tableId="+encodeURIComponent(tableId)+
    "&token="+encodeURIComponent(token);
}
