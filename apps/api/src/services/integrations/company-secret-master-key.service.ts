/**
 * Delibocados' root-owned company secret key file is the canonical source
 * for NEW Delibocados provider credentials. Other companies keep the existing
 * env-based derivation unchanged for backward compatibility.
 *
 * Never log keys, file contents or key fingerprints. Fail closed on a
 * present-but-invalid file or mismatching environment override.
 */
import {createHash} from "node:crypto";
import {readFileSync,statSync} from "node:fs";

const KEY_FILE="/etc/neuromind/company-secrets.env";

export function parseCompanyMasterKeyFile(content:string):string {
 const values=content.split(/\r?\n/).flatMap(line=>{
  const match=line.match(/^\s*(?:export\s+)?COMPANY_INTEGRATION_MASTER_KEY_HEX\s*=\s*(.*?)\s*$/);
  return match?[match[1].trim().replace(/^['"]|['"]$/g,"")]:[];
 });
 if(values.length!==1||!/^[0-9a-fA-F]{64}$/.test(values[0]))
  throw new Error("COMPANY_MASTER_KEY_FILE_INVALID");
 return values[0].toLowerCase();
}
export type SecretMasterSources={
 dedicated?:string;
 shared?:string;
 fileKey?:string;
};
export function resolveCompanySecretMasterKey(
 companyId:string, sources:SecretMasterSources
):Buffer {
 const dedicated=sources.dedicated?.trim()??"";
 const fileKey=companyId==="delibocados"?(sources.fileKey??"").trim():"";
 if(dedicated&&!/^[a-fA-F0-9]{64}$/.test(dedicated))
  throw new Error("COMPANY_MASTER_KEY_INVALID");
 if(fileKey&&!/^[a-fA-F0-9]{64}$/.test(fileKey))
  throw new Error("COMPANY_MASTER_KEY_FILE_INVALID");
 if(fileKey && dedicated && fileKey.toLowerCase()!==dedicated.toLowerCase())
  throw new Error("COMPANY_MASTER_KEY_SOURCE_MISMATCH");
 if(fileKey)return Buffer.from(fileKey,"hex");
 if(dedicated)return Buffer.from(dedicated,"hex");
 const shared=sources.shared?.trim()??"";
 if(!shared)throw new Error("COMPANY_MASTER_KEY_NOT_CONFIGURED");
 return /^[a-fA-F0-9]{64}$/.test(shared)
   ?Buffer.from(shared,"hex")
   :createHash("sha256").update(shared).digest();
}
export function loadCompanySecretMasterKey(companyId:string):Buffer {
 let fileKey:string|undefined;
 if(companyId==="delibocados") {
  try {
   const stat=statSync(KEY_FILE);
   if(!stat.isFile()||stat.uid!==0||(stat.mode&0o077)!==0)
    throw new Error("COMPANY_MASTER_KEY_FILE_INSECURE");
   fileKey=parseCompanyMasterKeyFile(readFileSync(KEY_FILE,"utf8"));
  }catch(error) {
   if(!(error instanceof Error&&"code" in error&&error.code==="ENOENT"))
    throw error;
  }
 }
 return resolveCompanySecretMasterKey(companyId,{
  dedicated:process.env.COMPANY_INTEGRATION_MASTER_KEY_HEX,
  shared:process.env.INTEGRATIONS_MASTER_KEY,
  fileKey
 });
}
