import { NextRequest, NextResponse } from "next/server";

type Context={params:Promise<{action:string}>};
function error(status:number,code:string){
 return NextResponse.json({ok:false,error:code},{status,
   headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
}
export async function POST(request:NextRequest,context:Context){
 const {action}=await context.params;
 if(!["context","order","tables"].includes(action))return error(404,"NOT_FOUND");
 // The readonly context preview never permits order or general table listing.
 const enabled=process.env.DELIBOCADOS_QR_CHECKOUT_ENABLED==="1";
 const preview=process.env.DELIBOCADOS_QR_MENU_PREVIEW_ENABLED==="1";
 if(process.env.NEXT_PUBLIC_PANEL_INSTANCE!=="delibocados"||
   (!enabled && !(action==="context" && preview)))
   return error(503,"QR_CHECKOUT_NOT_ENABLED");
 const origin=request.headers.get("origin");
 // Nginx forwards to loopback; request.url may resolve to http://127.0.0.1:3700.
 // Match the browser Origin against the explicit public HTTPS application origin.
 if(origin!=="https://panel.delibocados.online")return error(403,"ORIGIN_DENIED");
 if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
   return error(415,"JSON_REQUIRED");
 const declared=Number(request.headers.get("content-length")??"0");
 if(declared>14000)return error(413,"PAYLOAD_TOO_LARGE");
 const body=await request.text();
 if(Buffer.byteLength(body,"utf8")>14000)return error(413,"PAYLOAD_TOO_LARGE");
 try{JSON.parse(body);}catch{return error(400,"BAD_JSON");}
 // Fixed internal address only; never accept a user-supplied target URL.
 const upstream=`http://127.0.0.1:4000/public/delibocados-qr/${action}`;
 try{
   const result=await fetch(upstream,{
     method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},
     body,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(12000)
   });
   const data=await result.json() as Record<string,unknown>;
   if(!data||typeof data!=="object")return error(502,"BAD_QR_UPSTREAM");
   return NextResponse.json(data,{status:result.status,
     headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
 }catch{return error(503,"QR_SERVICE_UNAVAILABLE");}
}
