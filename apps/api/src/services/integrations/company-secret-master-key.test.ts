import test from "node:test";
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {
 parseCompanyMasterKeyFile, resolveCompanySecretMasterKey
} from "./company-secret-master-key.service.js";
import {encryptCompanySecret,decryptCompanySecret}
 from "./company-secret-crypto.js";

const fileKey=randomBytes(32).toString("hex");
const legacyKey="long shared integration master key";
test("loads company master key from strict root file format",()=>{
 assert.equal(parseCompanyMasterKeyFile("COMPANY_INTEGRATION_MASTER_KEY_HEX="+fileKey+"\n"),fileKey);
 assert.equal(parseCompanyMasterKeyFile("export COMPANY_INTEGRATION_MASTER_KEY_HEX='"+fileKey+"'\n"),fileKey);
 assert.throws(()=>parseCompanyMasterKeyFile("COMPANY_INTEGRATION_MASTER_KEY_HEX=invalid"));
 assert.throws(()=>parseCompanyMasterKeyFile("OTHER_KEY=hello"));
 assert.throws(()=>parseCompanyMasterKeyFile("COMPANY_INTEGRATION_MASTER_KEY_HEX="+fileKey+
  "\nCOMPANY_INTEGRATION_MASTER_KEY_HEX="+fileKey));
});
test("Delibocados always prefers canonical file to legacy shared env",()=>{
 const key=resolveCompanySecretMasterKey("delibocados",{fileKey,shared:legacyKey});
 assert.equal(key.toString("hex"),fileKey);
 const context={companyId:"delibocados",provider:"toteat",keyVersion:1};
 const encrypted=encryptCompanySecret('{"environment":"production"}',context,key);
 assert.equal(decryptCompanySecret(encrypted,context,
  resolveCompanySecretMasterKey("delibocados",{fileKey,shared:"different legacy"})),
  '{"environment":"production"}');
});
test("mismatched dedicated env and canonical file fail closed",()=>{
 assert.throws(()=>resolveCompanySecretMasterKey("delibocados",{
  fileKey,dedicated:randomBytes(32).toString("hex")
 }),/SOURCE_MISMATCH/);
});
test("other tenants retain former env key behavior",()=>{
 const secret=resolveCompanySecretMasterKey("another-tenant",{fileKey,shared:legacyKey});
 assert.notEqual(secret.toString("hex"),fileKey);
 assert.equal(secret.toString("hex"),
  resolveCompanySecretMasterKey("another-tenant",{shared:legacyKey}).toString("hex"));
});
test("invalid key and no configured master key do not continue",()=>{
 assert.throws(()=>resolveCompanySecretMasterKey("delibocados",{fileKey:"bad"}));
 assert.throws(()=>resolveCompanySecretMasterKey("delibocados",{}));
 assert.throws(()=>resolveCompanySecretMasterKey("delibocados",{dedicated:"bad"}));
});
