import { test } from "node:test";
import assert from "node:assert/strict";
import { containsPoint, polygonSchema } from "./restaurant-zones.service.js";

test("verified delivery geofence accepts inside and rejects outside", () => {
  const polygon = polygonSchema.parse({
    type:"Polygon",
    coordinates: [[[-74.1,4.6],[-74.0,4.6],[-74.0,4.7],[-74.1,4.7],[-74.1,4.6]]]
  });
  assert.equal(containsPoint(polygon,-74.05,4.65),true);
  assert.equal(containsPoint(polygon,-74.15,4.65),false);
  assert.equal(containsPoint(polygon,200,4.65),false);
});

test("reject unclosed/untrusted polygons", () => {
  assert.equal(polygonSchema.safeParse({
    type:"Polygon", coordinates:[[[-74.1,4.6],[-74.0,4.6],[-74.0,4.7],[-74.1,4.7]]]
  }).success,false);
  assert.equal(polygonSchema.safeParse({type:"FeatureCollection",features:[]}).success,false);
});
