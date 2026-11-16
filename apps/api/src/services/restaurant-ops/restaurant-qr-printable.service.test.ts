import {describe,it,expect} from "vitest";
import {createHash,randomBytes} from "node:crypto";
import {
  encryptPrintableTableQrToken,decryptPrintableTableQrToken,
  hashTableQrToken,printableTableQrUrl
} from "./restaurant-qr-printable.service.js";

const id="b2acdf2a-8892-5ee6-bece-e70413c057c1";
const other="aaacdf2a-8892-5ee6-bece-e70413c057c1";
const key=Buffer.alloc(32,42);
const token=randomBytes(32).toString("base64url");

describe("permanent table QR envelopes",()=>{
 it("can recover the identical bearer link without rotating the printed QR",()=>{
   const sealed=encryptPrintableTableQrToken(token,id,key);
   expect(sealed.startsWith("qr-v1.")).toBe(true);
   expect(sealed).not.toContain(token);
   const decoded=decryptPrintableTableQrToken(sealed,id,hashTableQrToken(token),key);
   expect(decoded).toBe(token);
   expect(printableTableQrUrl(id,decoded)).toBe(printableTableQrUrl(id,token));
   expect(printableTableQrUrl(id,token)).toContain("/qr-pedido#kind=table");
 });
 it("never confuses a QR from one table with another table",()=>{
   const sealed=encryptPrintableTableQrToken(token,id,key);
   expect(()=>decryptPrintableTableQrToken(sealed,other,hashTableQrToken(token),key)).toThrow();
 });
 it("rejects invalid MAC, master key and digest",()=>{
   const sealed=encryptPrintableTableQrToken(token,id,key);
   const badDigest=createHash("sha256").update("different").digest("hex");
   expect(()=>decryptPrintableTableQrToken(sealed,id,badDigest,key)).toThrow();
   expect(()=>decryptPrintableTableQrToken(sealed,id,hashTableQrToken(token),Buffer.alloc(32,24))).toThrow();
   const changed=sealed.slice(0,-3)+"abc";
   expect(()=>decryptPrintableTableQrToken(changed,id,hashTableQrToken(token),key)).toThrow();
 });
 it("never derives a token from a public table number",()=>{
   expect(()=>hashTableQrToken("Mesa 12")).toThrow();
 });
});
