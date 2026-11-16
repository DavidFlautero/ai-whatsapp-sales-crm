import { NextRequest,NextResponse } from "next/server";
import {mkdir,readFile,rename,writeFile} from "node:fs/promises";
import path from "node:path";

export const runtime="nodejs";
export const dynamic="force-dynamic";
type Banner={eyebrow:string;title:string;detail:string};
const FILE="/var/www/control/var/delibocados-menu-banners.json";
const DEFAULT:Banner[]=[
  {eyebrow:"BIENVENIDOS A DELIBOCADOS",title:"Comé rico, disfrutá más",detail:"Elegí tus favoritos de nuestra carta digital."},
  {eyebrow:"ALMUERZOS",title:"El sabor de todos los días",detail:"Consultá en el restaurante el almuerzo disponible hoy."},
  {eyebrow:"SERVICIO",title:"Estamos en Funza",detail:"Seleccioná lo que más te guste y revisá tu pedido."}
];
function valid(value:unknown):value is Banner[]{
  return Array.isArray(value)&&value.length>=1&&value.length<=5&&value.every(b=>b&&typeof b==="object"&&
    typeof b.eyebrow==="string"&&b.eyebrow.trim().length>0&&b.eyebrow.length<=55&&
    typeof b.title==="string"&&b.title.trim().length>0&&b.title.length<=95&&
    typeof b.detail==="string"&&b.detail.trim().length>0&&b.detail.length<=210);
}
async function readBanners():Promise<Banner[]>{
  try{const value=JSON.parse(await readFile(FILE,"utf8"));return valid(value)?value:DEFAULT;}catch{return DEFAULT;}
}
function result(value:object,status=200){return NextResponse.json(value,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});}
async function authorized(cookie:string):Promise<boolean>{
  if(!cookie)return false;
  try{
    const [session,modules]=await Promise.all([
      fetch("http://127.0.0.1:4100/auth/session",{headers:{Cookie:cookie,Accept:"application/json"},cache:"no-store",signal:AbortSignal.timeout(7000)}),
      fetch("http://127.0.0.1:3601/api/restaurant/modules",{headers:{Cookie:cookie,Accept:"application/json"},cache:"no-store",signal:AbortSignal.timeout(7000)})
    ]);
    if(!session.ok||!modules.ok)return false;
    const s=await session.json(),m=await modules.json();
    return s.user?.companyId==="delibocados"&&s.user?.active===true&&["owner","admin"].includes(s.user?.role)&&
      m.companyId==="delibocados"&&m.modules?.catalog===true;
  }catch{return false;}
}
export async function GET(){return result({ok:true,banners:await readBanners()});}
export async function POST(req:NextRequest){
  if(req.headers.get("origin")!=="https://panel.delibocados.online")return result({ok:false,error:"ORIGIN_DENIED"},403);
  if(!await authorized(req.headers.get("cookie")??""))return result({ok:false,error:"UNAUTHORIZED"},401);
  if(!req.headers.get("content-type")?.startsWith("application/json"))return result({ok:false,error:"JSON_REQUIRED"},415);
  if(Number(req.headers.get("content-length")??"0")>5000)return result({ok:false,error:"TOO_LARGE"},413);
  const raw=await req.text();if(Buffer.byteLength(raw,"utf8")>5000)return result({ok:false,error:"TOO_LARGE"},413);
  let payload:unknown;
  try{payload=JSON.parse(raw);}catch{return result({ok:false,error:"BAD_JSON"},400);}
  const banners=(payload as {banners?:unknown})?.banners;
  if(!valid(banners))return result({ok:false,error:"INVALID_BANNERS"},400);
  const clean=banners.map(({eyebrow,title,detail})=>({eyebrow:eyebrow.trim(),title:title.trim(),detail:detail.trim()}));
  try{
    await mkdir(path.dirname(FILE),{recursive:true,mode:0o750});
    const tmp=FILE+"."+process.pid+".tmp";
    await writeFile(tmp,JSON.stringify(clean,null,2)+"\n",{encoding:"utf8",mode:0o640});
    await rename(tmp,FILE);
    return result({ok:true,banners:clean});
  }catch{return result({ok:false,error:"SAVE_FAILED"},503);}
}
