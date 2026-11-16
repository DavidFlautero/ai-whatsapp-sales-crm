import {describe,it} from "node:test";
import assert from "node:assert/strict";
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
   assert.equal(sealed.startsWith("qr-v1."),true);
   assert.equal(sealed.includes(token),false);
   const decoded=decryptPrintableTableQrToken(sealed,id,hashTableQrToken(token),key);
   assert.equal(decoded,token);
   assert.equal(printableTableQrUrl(id,decoded),printableTableQrUrl(id,token));
   assert.ok(printableTableQrUrl(id,token).includes("/qr-pedido#kind=table"));
 });
 it("never confuses a QR from one table with another table",()=>{
   const sealed=encryptPrintableTableQrToken(token,id,key);
   assert.throws(()=>decryptPrintableTableQrToken(sealed,other,hashTableQrToken(token),key));
 });
 it("rejects invalid MAC, master key and digest",()=>{
   const sealed=encryptPrintableTableQrToken(token,id,key);
   const badDigest=createHash("sha256").update("different").digest("hex");
   assert.throws(()=>decryptPrintableTableQrToken(sealed,id,badDigest,key));
   assert.throws(()=>decryptPrintableTableQrToken(sealed,id,hashTableQrToken(token),Buffer.alloc(32,24)));
   const changed=sealed.slice(0,30)+(sealed[30]==="A"?"B":"A")+sealed.slice(31);
   assert.throws(()=>decryptPrintableTableQrToken(changed,id,hashTableQrToken(token),key));
 });
 it("never derives a token from a public table number",()=>{
   assert.throws(()=>hashTableQrToken("Mesa 12"));
 });
});
