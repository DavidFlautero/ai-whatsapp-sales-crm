/**
 * Windows POS360 connector. Never exposed to browsers. The bridge client
 * authenticates with an unguessable secret; only its SHA-256 is stored on VPS.
 *
 * Disabled by default. Claim is one-shot; a lost external receipt is UNKNOWN
 * until a human reconciles the local POS. This API does NOT itself speak any
 * proprietary SmartPOS protocol or claim kitchen paper was printed.
 */
import {createHash,timingSafeEqual} from "node:crypto";
import {Router,type Request,type Response,type NextFunction} from "express";
import {z} from "zod";
import {supabaseRpc} from "../services/db/supabase-rest.client.js";

export const restaurantPos360BridgeRoutes=Router();

function deny(res:Response,code=401,error="BRIDGE_AUTH_REQUIRED"){
 return res.status(code).setHeader("Cache-Control","no-store")
   .json({ok:false,error});
}
function bridgeAuth(req:Request,res:Response,next:NextFunction){
 res.setHeader("Cache-Control","no-store");
 if(process.env.DELIBOCADOS_POS360_BRIDGE_ENABLED!=="1")
   return deny(res,503,"BRIDGE_DISABLED");
 const expected=process.env.DELIBOCADOS_POS360_BRIDGE_KEY_SHA256?.trim()||"";
 const presented=req.header("x-deli-pos360-bridge-key")||"";
 if(!/^[a-f0-9]{64}$/i.test(expected)||!/^[A-Za-z0-9_-]{40,128}$/.test(presented))
   return deny(res);
 const a=Buffer.from(expected,"hex");
 const b=createHash("sha256").update(presented).digest();
 if(!timingSafeEqual(a,b))return deny(res);
 return next();
}
restaurantPos360BridgeRoutes.use(bridgeAuth);

restaurantPos360BridgeRoutes.post("/health",(_req,res)=>{
 return res.json({ok:true,bridge:"delibocados-pos360",state:"listening",
   notice:"Bridge transport configured. Native SmartPOS acceptance/printing not guaranteed."});
});

restaurantPos360BridgeRoutes.post("/claim",async(req,res)=>{
 // Full claim is disabled until the historical outbox has been reconciled.
 if(process.env.DELIBOCADOS_POS360_FULL_CLAIM_ENABLED!=="1")
   return deny(res,403,"FULL_CLAIM_DISABLED_USE_PILOT");
 if(!req.is("application/json"))return deny(res,415,"JSON_REQUIRED");
 const body=z.object({}).strict().safeParse(req.body);
 if(!body.success)return deny(res,400,"INVALID_INPUT");
 try{
  const job=await supabaseRpc<Record<string,unknown>|null>(
    "restaurant_ops_pos360_claim",{p_company_id:"delibocados"});
  return res.json({ok:true,job:job??null});
 }catch{
  console.error("[POS360 BRIDGE CLAIM] operation failed");
  return deny(res,503,"POS360_CLAIM_UNAVAILABLE");
 }
});

// Pilot-only claim: SQL requires a separately approved, expiring export allowlist.
restaurantPos360BridgeRoutes.post("/claim-pilot",async(req,res)=>{
 if(!req.is("application/json"))return deny(res,415,"JSON_REQUIRED");
 const parsed=z.object({}).strict().safeParse(req.body);
 if(!parsed.success)return deny(res,400,"INVALID_INPUT");
 try{
  const job=await supabaseRpc<Record<string,unknown>|null>(
    "restaurant_ops_pos360_claim_pilot",{p_company_id:"delibocados"});
  return res.json({ok:true,job:job??null});
 }catch{
  console.error("[POS360 PILOT CLAIM] operation failed");
  return deny(res,503,"POS360_PILOT_CLAIM_UNAVAILABLE");
 }
});

const receipt=z.object({
 exportId:z.string().uuid(),
 outcome:z.enum(["accepted","unknown","rejected"]),
 externalOrderId:z.string().trim().min(3).max(150).optional()
}).strict().superRefine((v,ctx)=>{
 if(v.outcome==="accepted"&&!v.externalOrderId)
   ctx.addIssue({code:"custom",path:["externalOrderId"],message:"RECEIPT_REQUIRED"});
 if(v.outcome!=="accepted"&&v.externalOrderId)
   ctx.addIssue({code:"custom",path:["externalOrderId"],message:"RECEIPT_UNEXPECTED"});
});
restaurantPos360BridgeRoutes.post("/ack",async(req,res)=>{
 if(!req.is("application/json"))return deny(res,415,"JSON_REQUIRED");
 const parsed=receipt.safeParse(req.body);
 if(!parsed.success)return deny(res,400,"INVALID_INPUT");
 try{
  const result=await supabaseRpc<Record<string,unknown>>(
    "restaurant_ops_pos360_finish",{
      p_company_id:"delibocados",
      p_export_id:parsed.data.exportId,
      p_outcome:parsed.data.outcome,
      p_external_order_id:parsed.data.externalOrderId??null
    });
  return res.json({ok:true,export:result});
 }catch{
  // Fail closed. A worker must NOT assume failed ACK means a safe resend.
  console.error("[POS360 BRIDGE ACK] operation failed");
  return deny(res,409,"POS360_ACK_UNCONFIRMED");
 }
});
