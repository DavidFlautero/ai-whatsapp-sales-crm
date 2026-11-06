import { NextRequest } from "next/server";
const routes:{[key:string]:string}={conversaciones:"/panel/conversaciones",ia:"/panel/ia",plano:"/panel/plano",integraciones:"/panel/integraciones"};
export async function GET(request:NextRequest,ctx:{params:Promise<{slug:string}>}){
  const {slug}=await ctx.params;const path=routes[slug];
  if(!path)return new Response("No encontrado",{status:404});
  const cookie=request.headers.get("cookie")||"";
  if(!cookie)return new Response("Iniciá sesión",{status:401});
  try{
    const upstream=await fetch(`http://127.0.0.1:3601${path}`,{headers:{Cookie:cookie},cache:"no-store",signal:AbortSignal.timeout(12000)});
    if(!upstream.ok)return new Response("Módulo no disponible o sin autorización",{status:upstream.status,headers:{"Cache-Control":"no-store"}});
    let html=await upstream.text();
    const script=`<script>document.querySelectorAll('a[href^="/panel"],a[href^="/workspace"]').forEach(function(a){a.target='_top';});</script>`;
    html=html.replace("</body>",script+"</body>");
    return new Response(html,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'"}});
  }catch{return new Response("Motor del restaurante no disponible",{status:503});}
}
