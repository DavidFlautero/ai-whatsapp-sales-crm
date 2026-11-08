import assert from "node:assert/strict";
import {test} from "node:test";
import {
  parseToteatCredentials,toteatReadOnlyUrl,probeToteatReadOnly
} from "./restaurant-toteat-readonly.service.js";

const base={environment:"development",restaurantId:"123",localNumber:"2",
  userId:"98",token:"test-secret-do-not-log"} as const;

test("unstructured credentials are not considered ready",()=>{
  assert.deepEqual(parseToteatCredentials("abc"),{ok:false,reason:"NOT_STRUCTURED"});
  assert.deepEqual(parseToteatCredentials(JSON.stringify({
    restaurantId:"1",localNumber:"2",userId:"3",token:"abc"
  })),{ok:false,reason:"INVALID_ENVIRONMENT"});
  assert.deepEqual(parseToteatCredentials(JSON.stringify({...base,restaurantId:"../../../"})),
    {ok:false,reason:"INVALID_ID"});
});

test("reads configured IDs and production/development env with exact host",()=>{
  const parsed=parseToteatCredentials(JSON.stringify(base));
  assert.equal(parsed.ok,true);
  if(!parsed.ok)return;
  const url=toteatReadOnlyUrl(parsed.value,"products");
  assert.equal(url.hostname,"apidev.toteat.com");
  assert.equal(url.pathname,"/mw/or/1.0/products");
  assert.equal(url.searchParams.get("xir"),"123");
  assert.equal(url.searchParams.get("xil"),"2");
  assert.equal(url.searchParams.get("xiu"),"98");
  assert.equal(url.searchParams.get("activeProducts"),"true");
  assert.equal(url.searchParams.get("xapitoken"),base.token);
  const prod=toteatReadOnlyUrl({...parsed.value,environment:"production"},"shiftstatus");
  assert.equal(prod.hostname,"api.toteat.com");
});

test("GET-only probe validates Toteat JSON success, never exposing token in results",async()=>{
  const parsed=parseToteatCredentials(JSON.stringify(base));
  assert.equal(parsed.ok,true);if(!parsed.ok)return;
  let seen=0;
  const fakeFetch:typeof fetch=async (request,options)=>{
    const url=request instanceof URL?request:new URL(String(request));
    assert.equal(url.hostname,"apidev.toteat.com");
    assert.equal(url.searchParams.get("xapitoken"),base.token);
    assert.equal(options?.method,"GET");
    assert.equal(options?.redirect,"error");
    seen++;
    return new Response(JSON.stringify({ok:true,data:[{localCode:"x"}]}),
      {status:200,headers:{"Content-Type":"application/json"}});
  };
  const result=await probeToteatReadOnly(parsed.value,"products",fakeFetch);
  assert.deepEqual(result,{connected:true,status:"approved",httpStatus:200,productCount:1});
  assert.equal(seen,1);
  assert.doesNotMatch(JSON.stringify(result),/test-secret/);
});

test("a failed request cannot be mistaken for a working integration",async()=>{
  const creds={...base};
  const denied=await probeToteatReadOnly(creds,"shiftstatus",async()=>new Response(
    JSON.stringify({ok:false,msg:"token invalid"}),{status:200}
  ));
  assert.deepEqual(denied,{connected:false,status:"denied",httpStatus:200});
  const bad=await probeToteatReadOnly(creds,"shiftstatus",async()=>new Response(
    "nope",{status:200}
  ));
  assert.deepEqual(bad,{connected:false,status:"bad_response",httpStatus:200});
  const error=await probeToteatReadOnly(creds,"shiftstatus",async()=>{
    throw new Error("failed with secret "+base.token);
  });
  assert.deepEqual(error,{connected:false,status:"network_error"});
  assert.doesNotMatch(JSON.stringify(error),/test-secret/);
});
