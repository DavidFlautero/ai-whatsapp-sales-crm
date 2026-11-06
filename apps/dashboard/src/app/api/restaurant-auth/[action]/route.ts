import {NextRequest,NextResponse} from "next/server";
const LEGACY_AUTH="http://127.0.0.1:4100";
export async function POST(request:NextRequest,ctx:{params:Promise<{action:string}>}){
  const {action}=await ctx.params;
  if(action!=="login"&&action!=="logout")return NextResponse.json({ok:false},{status:404});
  // Solo aceptar operaciones del origen propio; el 4100 es un backend local.
  const origin=request.headers.get("origin");
  if(origin!=="https://panel.delibocados.online")return NextResponse.json({ok:false,error:"ORIGIN_DENIED"},{status:403});
  let raw="";
  if(action==="login"){
    if(Number(request.headers.get("content-length")||0)>4096)return NextResponse.json({ok:false},{status:413});
    raw=await request.text();if(raw.length>4096)return NextResponse.json({ok:false},{status:413});
  }
  try{
    const upstream=await fetch(`${LEGACY_AUTH}/auth/${action}`,{
      method:"POST",headers:{"Content-Type":"application/json",Cookie:request.headers.get("cookie")||"",Origin:"https://delibocados.online","Sec-Fetch-Site":"same-origin"},body:action==="login"?raw:JSON.stringify({}),cache:"no-store",signal:AbortSignal.timeout(12000),
    });
    const setCookies=upstream.headers.getSetCookie();
    if(action==="login"&&upstream.ok){
      const cookieHeader=setCookies.map(x=>x.split(";")[0]).join("; ");
      if(!cookieHeader)return NextResponse.json({ok:false,error:"SESSION_COOKIE_MISSING"},{status:502});
      const check=await fetch(`${LEGACY_AUTH}/auth/session`,{headers:{Cookie:cookieHeader},cache:"no-store",signal:AbortSignal.timeout(9000)});
      if(!check.ok)return NextResponse.json({ok:false,error:"SESSION_CHECK_FAILED"},{status:403});
      const data=await check.json();const user=data.user;
      if(user?.companyId!=="delibocados"||user?.active!==true||!["owner","admin"].includes(user?.role)){
        return NextResponse.json({ok:false,error:"WRONG_COMPANY"},{status:403});
      }
    }
    const body=await upstream.text();
    const response=new NextResponse(body,{status:upstream.status,headers:{"Content-Type":upstream.headers.get("content-type")||"application/json","Cache-Control":"no-store"}});
    for(const cookie of setCookies){
      response.headers.append("Set-Cookie",cookie.replace(/;\s*Domain=[^;]+/ig,""));
    }
    return response;
  }catch{return NextResponse.json({ok:false,error:"AUTH_UNAVAILABLE"},{status:503});}
}
