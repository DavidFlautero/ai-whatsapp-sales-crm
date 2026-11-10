import {test} from "node:test";
import assert from "node:assert/strict";
import {submitOneToteatOrder} from "./restaurant-toteat-order-client.service.js";
import type {ToteatCredentials} from "./restaurant-toteat-readonly.service.js";
const creds:ToteatCredentials={environment:"development",
 restaurantId:"9450186157992447",localNumber:"1",userId:"77",token:"dummy-secret"};
const ref="delibocados-123e4567-e89b-42d3-a456-426614174000";
test("sends exactly once and returns precise confirmed ID",async()=>{
 const methods:string[]=[];
 const fake=(async (_url:URL,opts:RequestInit)=>{
   methods.push(opts.method??"");
   return new Response('{"ok":true,"orderExp":{"orderReference":"'+ref+'","orderId":9450186157992447}}',
     {status:200});
 }) as typeof fetch;
 const r=await submitOneToteatOrder({credentials:creds,orderReference:ref,
   serializedBody:"{}",fetcher:fake});
 assert.equal(r.outcome,"accepted");
 assert.equal(r.externalOrderId,"9450186157992447");
 assert.deepEqual(methods,["POST"]);
});
test("200 without ID consults OPEN listing exactly once and never repeats POST",async()=>{
 const methods:string[]=[];
 const fake=(async (_url:URL,opts:RequestInit)=>{
   methods.push(opts.method??"");
   if(opts.method==="POST")return new Response('{"ok":true,"msg":"received"}',{status:200});
   return new Response('{"ok":true,"data":[{"orderReference":"'+ref+'","orderId":9450186157992447}]}',
     {status:200});
 }) as typeof fetch;
 const r=await submitOneToteatOrder({credentials:creds,orderReference:ref,
  serializedBody:"{}",fetcher:fake});
 assert.equal(r.outcome,"accepted");
 assert.equal(r.evidence,"open_order_listing");
 assert.deepEqual(methods,["POST","GET"]);
});
test("failed POST and absent listing stays UNKNOWN and never retries",async()=>{
 const methods:string[]=[];
 const fake=(async (_url:URL,opts:RequestInit)=>{
   methods.push(opts.method??"");
   if(opts.method==="POST")throw new Error("TIMEOUT");
   return new Response('{"ok":true,"data":[]}',{status:200});
 }) as typeof fetch;
 const r=await submitOneToteatOrder({credentials:creds,orderReference:ref,
  serializedBody:"{}",fetcher:fake});
 assert.equal(r.outcome,"unknown");
 assert.deepEqual(methods,["POST","GET"]);
});
test("explicit rejection is not disguised as accepted",async()=>{
 const methods:string[]=[];
 const fake=(async (_url:URL,opts:RequestInit)=>{
   methods.push(opts.method??"");
   return new Response('{"ok":false,"msg":"invalid"}',{status:400});
 }) as typeof fetch;
 const r=await submitOneToteatOrder({credentials:creds,orderReference:ref,
   serializedBody:"{}",fetcher:fake});
 assert.equal(r.outcome,"rejected");
 assert.deepEqual(methods,["POST"]);
});
