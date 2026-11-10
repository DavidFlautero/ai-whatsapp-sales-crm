/**
 * The only supported CLI path for a controlled ONE-UUID WhatsApp CRM export.
 * Default: --check, no writes and no HTTP POST.
 * --execute is a REAL POS insertion and may PRINT PAPER at the restaurant.
 * Requires migration 20261110210000, owner integration enabled, verified menu,
 * one eligible NEW confirmed WhatsApp order, cutoff, explicit opt-in flags.
 * The cancelled Chicharrón test reference is NEVER targeted.
 */
import {config} from "dotenv";
config({path:"../../.env",quiet:true});
import {
  toteatExportControls,exportOneConfirmedWhatsappOrder
} from "../services/restaurant-ops/restaurant-toteat-export-worker.service.js";

async function main(){
 const mode=process.argv[2]??"--check";
 if(!["--check","--execute"].includes(mode))
   throw new Error("USE_CHECK_OR_EXECUTE");
 const controls=toteatExportControls();
 console.log("=== DELIBOCADOS / EXPORTACION UNICA TOTEAT ===");
 console.log("MODE:",mode);
 console.log("ENABLED:",controls.enabled);
 console.log("REASON:",controls.reason);
 console.log("CUTOVER:",controls.cutover??"MISSING");
 console.log("PILOT_UUID:",controls.onlyOrderId??"MISSING");
 if(mode==="--check"){
   console.log("NO_POST_NO_DB_CHANGES_NO_PRINT");
   return;
 }
 if(!controls.enabled||!controls.cutover||!controls.onlyOrderId ||
    process.env.DELIBOCADOS_TOTEAT_EXPORT_PUBLIC==="1")
   throw new Error("ONE_ORDER_PILOT_GUARD_NOT_SATISFIED");
 // May insert exactly ONE real order. A timeout is UNKNOWN: no retry.
 const result=await exportOneConfirmedWhatsappOrder();
 console.log("RESULT:",JSON.stringify(result));
 if(result.action!=="finished"||result.outcome!=="accepted")
   process.exitCode=2;
}
void main().catch(e=>{
 console.error("PILOT_BLOCKED:",e instanceof Error?e.message:"UNKNOWN");
 process.exitCode=1;
});
