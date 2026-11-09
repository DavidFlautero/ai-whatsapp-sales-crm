/**
 * Download and inspect the PUBLIC Toteat v2 OpenAPI YAML safely.
 * NO credentials, database, POST, local order, or printer calls.
 */
const SPEC_URL="https://developers.toteat.com/toteatApi_v2.yaml";
type Operation={path:string;method:string;at:number;end:number;block:string[]};
function clean(line:string):string{return line.replace(/\r$/,"");}
function indent(line:string){return (line.match(/^ */)?.[0].length)??0;}
function isKey(line:string,key:string){return line.trim()===key+":";}
async function main(){
  const response=await fetch(SPEC_URL,{method:"GET",redirect:"error",
    headers:{Accept:"text/yaml, text/plain, */*"},
    signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error("SPEC_HTTP_"+response.status);
  const yaml=await response.text();
  if(yaml.length<1000||yaml.length>12_000_000)throw new Error("SPEC_SIZE_INVALID");
  const lines=yaml.split("\n").map(clean);
  console.log("=== TOTEAT ORDER OPENAPI V2, PUBLIC SPEC ===");
  console.log("TOTAL_LINES",lines.length,"BYTES",yaml.length);
  const pathsIndex=lines.findIndex(x=>/^\s*paths:\s*$/.test(x));
  if(pathsIndex<0)throw new Error("PATHS_NOT_FOUND");
  const pathsIndent=indent(lines[pathsIndex]);
  let currentPath="",currentIndent=-1;
  const operations:Operation[]=[];
  for(let i=pathsIndex+1;i<lines.length;i++){
    const line=lines[i],tr=line.trim();
    if(tr && !tr.startsWith("#") && indent(line)<=pathsIndent)break;
    const match=line.match(/^\s*(["']?)(\/[^:]+)\1:\s*$/);
    if(match){
      currentPath=match[2];currentIndent=indent(line);continue;
    }
    const op=line.match(/^\s*(get|post|put|patch|delete):\s*$/i);
    if(op && currentPath && indent(line)>currentIndent){
      const base=indent(line);
      let end=i+1;
      while(end<lines.length){
        const next=lines[end],t=next.trim();
        if(t && !t.startsWith("#") && indent(next)<=base)break;
        end++;
      }
      operations.push({path:currentPath,method:op[1].toUpperCase(),at:i+1,end,block:lines.slice(i,end)});
    }
  }
  console.log("OPERATIONS_FOUND:",operations.length);
  if(operations.length===0){
    console.log("YAML_STRUCTURE_FIRST_128_LINES:");
    for(let i=0;i<Math.min(lines.length,128);i++)console.log((i+1)+" "+lines[i]);
  }
  for(const x of operations)
    if(x.method==="POST" || /order|orden|pedido|status|shift/i.test(x.path))
      console.log("ENDPOINT:",x.method,x.path,"LINES:",x.at+"-"+x.end);
  const candidates=operations.filter(x=>x.method==="POST" &&
    (/order|orden|pedido|delivery/i.test(x.path) ||
     x.block.some(v=>/order|orden|pedido|nueva orden|external/i.test(v))));
  if(!candidates.length)console.log("WARNING_NO_POST_ORDER_MATCHES");
  for(const x of candidates.slice(0,6)){
    console.log("\n=== POST OPERATION",x.path,"===");
    const cap=260;
    for(let i=0;i<Math.min(x.block.length,cap);i++)
      console.log(x.at+i+" "+x.block[i]);
    if(x.block.length>cap)console.log("TRUNCATED_OPERATION_LINES",x.block.length-cap);
    const refs=[...new Set(x.block.flatMap(v=>
      [...v.matchAll(/#\/(?:components\/schemas|definitions)\/([A-Za-z0-9_.-]+)/g)]
        .map(m=>m[1])))];
    for(const ref of refs.slice(0,12)){
      const k=lines.findIndex(v=>v.trim()===ref+":");
      if(k<0)continue;
      const base=indent(lines[k]);let end=k+1;
      while(end<lines.length){
        const v=lines[end],trim=v.trim();
        if(trim&&!trim.startsWith("#")&&indent(v)<=base)break;
        end++;
      }
      console.log("\n--- REFERENCED SCHEMA",ref,"LINES",k+1,"-",end,"---");
      for(let j=k;j<Math.min(end,k+170);j++)console.log((j+1)+" "+lines[j]);
      if(end>k+170)console.log("SCHEMA_TRUNCATED",end-k-170);
    }
  }

  const modular: Array<{url:URL;depth:number}>=[
    {url:new URL("./paths/create_order.yaml",SPEC_URL),depth:0},
    {url:new URL("./paths/orderstatus.yaml",SPEC_URL),depth:0},
    {url:new URL("./components/index.yaml",SPEC_URL),depth:0}
  ];
  const visited=new Set<string>();
  while(modular.length && visited.size<20){
    const item=modular.shift()!;
    const target=item.url;
    if(visited.has(target.href))continue;
    visited.add(target.href);
    if(target.hostname!=="developers.toteat.com" || target.protocol!=="https:")
      continue;
    try{
      const result=await fetch(target,{method:"GET",redirect:"error",
        headers:{Accept:"text/yaml,text/plain,*/*"},signal:AbortSignal.timeout(12000)});
      if(!result.ok){console.log("MODULE_HTTP",target.pathname,result.status);continue;}
      const source=await result.text();
      if(source.length>300000){console.log("MODULE_TOO_LARGE",target.pathname);continue;}
      const moduleLines=source.split("\n").map(clean);
      console.log("\n=== TOTEAT MODULE",target.pathname,
        "LINES",moduleLines.length,"BYTES",source.length,"===");
      const max=target.pathname.includes("create_order")?750:270;
      for(let i=0;i<Math.min(moduleLines.length,max);i++)
        console.log((i+1)+" "+moduleLines[i]);
      if(moduleLines.length>max)console.log("MODULE_TRUNCATED_LINES",moduleLines.length-max);
      const relatives=[...source.matchAll(/\$ref:\s*["']?([^"'\s#]+\.ya?ml)(?:#[^\s"']*)?["']?/g)];
      if(item.depth<3)
        for(const match of relatives){
          let next:URL;
          try{next=new URL(match[1],target);}catch{continue;}
          if(next.hostname!=="developers.toteat.com"||next.protocol!=="https:")continue;
          if(target.pathname==="/components/index.yaml"){
            const refLine=source.slice(0,source.indexOf(match[0]));
            const lastSection=refLine.split("\n").slice(-4).join(" ");
            if(!/NewOrder|BasicOrderResponse|DetailedOrderResponse|OrderStatusResult|Payment|Document|NewOrderLine/i.test(lastSection))
              continue;
          }
          if(!visited.has(next.href)&&!modular.some(x=>x.url.href===next.href))
            modular.push({url:next,depth:item.depth+1});
        }
    }catch{
      console.log("MODULE_GET_FAILED",target.pathname);
    }
  }
  console.log("=== END; PUBLIC OPENAPI ONLY; NO POST; NO PRINT ===");
}
void main().catch(e=>{
  console.error("CONTRACT_INSPECT_FAILED:",e instanceof Error?e.message:"UNKNOWN");
  process.exitCode=1;
});
