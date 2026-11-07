import assert from "node:assert/strict";
import {test} from "node:test";
import {parseIncomingWhapiPoint} from "../whapi/whapi-location-parser.service.js";
import {
  deliveryPinSummary,freshVerifiedPin,PIN_TTL_MS
} from "./restaurant-whatsapp-location.service.js";
import {quoteVerifiedDeliveryPoint} from "./restaurant-delivery-routing.service.js";

const staticPin={
  id:"wa-pin-1",type:"location",from:"34632441787",
  location:{latitude:4.7182,longitude:-74.2131,name:"Frente al parque"}
};
test("Whapi static pin lat/lng are parsed without guessing a street address",()=>{
  assert.deepEqual(parseIncomingWhapiPoint(staticPin),{
    lat:4.7182,lng:-74.2131,live:false,
    name:"Frente al parque",address:undefined
  });
  assert.equal(parseIncomingWhapiPoint({type:"text",text:{body:"mi ubicación"}}),null);
  assert.equal(parseIncomingWhapiPoint({type:"location",location:{latitude:91,longitude:0}}),null);
  assert.equal(parseIncomingWhapiPoint({type:"location",location:{latitude:4.7}}),null);
});
test("Whapi moving location is a non-fixed destination until customer sends static pin",()=>{
  const moving=parseIncomingWhapiPoint({
    type:"live_location",live_location:{latitude:4.718,longitude:-74.213}
  });
  assert.equal(moving?.live,true);
});
test("verified pin is available only for thirty minutes",()=>{
  const now=Date.parse("2026-11-07T12:00:00Z");
  const pin={lat:4.718,lng:-74.213,zoneId:"zone-id",
    createdAt:new Date(now-10000).toISOString(),
    quotedFeeCOP:6000,routeMeters:2200,routeMinutes:8};
  assert.ok(freshVerifiedPin(pin,now));
  assert.equal(freshVerifiedPin(pin,now+PIN_TTL_MS+11000),null);
  assert.equal(freshVerifiedPin({...pin,lat:Infinity},now),null);
});
test("routing result is stated as road distance, without implying driver GPS tracking",()=>{
  const text=deliveryPinSummary({
    covered:true,zone:{id:"z",name:"Funza centro",feeCOP:4000,estimatedMinutes:20},
    drivingDistanceMeters:2800,drivingDurationMinutes:9
  });
  assert.match(text,/2\.80 km/);
  assert.match(text,/4\.000 COP/);
  assert.match(text,/estim/i);
  assert.doesNotMatch(text,/repartidor.*cerca/i);
});
test("invalid coordinate fails before making network calls",async()=>{
  const quote=await quoteVerifiedDeliveryPoint({lat:200,lng:-74.213});
  assert.equal(quote.covered,false);
  assert.equal(quote.reason,"COORDENADAS_INVALIDAS");
});
