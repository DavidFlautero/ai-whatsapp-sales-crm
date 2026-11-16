import { describe, expect, it } from "vitest";
import { calculateTableBill } from "./account-totals";

describe("QR cumulative table bill",()=>{
 it("shows the prior check plus only newly selected items",()=>{
  expect(calculateTableBill(25000,8000)).toEqual({
   previousCOP:25000, additionalCOP:8000, projectedCOP:33000
  });
 });
 it("keeps a reopened table account when the new cart is empty",()=>{
  expect(calculateTableBill(3500,0)).toEqual({
   previousCOP:3500, additionalCOP:0, projectedCOP:3500
  });
 });
 it("shows a first-time order without a previous account",()=>{
  expect(calculateTableBill(null,19000)).toEqual({
   previousCOP:0, additionalCOP:19000, projectedCOP:19000
  });
 });
 it("does not let a malformed previous amount contaminate the subtotal",()=>{
  expect(calculateTableBill(Number.NaN,5000)).toEqual({
   previousCOP:0, additionalCOP:5000, projectedCOP:5000
  });
 });
});