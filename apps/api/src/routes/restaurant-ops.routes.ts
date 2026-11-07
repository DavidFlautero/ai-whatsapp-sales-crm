import { polygonSchema, containsPoint } from "../services/restaurant-ops/restaurant-zones.service.js";
import { listContacts } from "../services/crm/crm.repository.js";
import { dispatchDelibocadosTestNotifications } from "../services/restaurant-ops/restaurant-notifications.service.js";
import { Router, type Request, type Response } from "express";
import { z, ZodError } from "zod";
import { requireRoles } from "../middlewares/auth.middleware.js";
import { supabaseRequest, supabaseRpc } from "../services/db/supabase-rest.client.js";
import {
  getBusinessProfile,validOpeningHours,getRestaurantOrderInsights,
  type OpeningHours
} from "../services/restaurant-ops/restaurant-agent-business.service.js";
import { analyzeRecentRestaurantQuestions } from "../services/restaurant-ops/restaurant-agent-learning.service.js";
import { loadCustomerHistory } from "../services/restaurant-ops/restaurant-customer-support.service.js";
import {quoteVerifiedDeliveryAddress} from "../services/restaurant-ops/restaurant-delivery-routing.service.js";

export const restaurantOpsRoutes = Router();
type Row = Record<string, unknown>;
const uuid = z.string().uuid();
const phone = z.string().regex(/^[0-9]{8,15}$/);
const str = z.string().trim();
const orderInput = z.object({
  sourceKey: str.min(8).max(200),
  source: z.enum(["panel","whatsapp","web","qr","external"]).default("panel"),
  customerPhone: phone, customerName: str.min(2).max(120),
  fulfillmentMode: z.enum(["pickup","delivery"]),
  zoneId: uuid.nullable().optional(), address: str.max(500).nullable().optional(),
  addressNote: str.max(500).optional(), customerNote: str.max(2000).optional(),
  pickupDueAt: z.string().datetime({ offset: true }).nullable().optional(),
  items: z.array(z.object({
    productId: str.min(1).max(100), quantity: z.number().int().min(1).max(25),
    instructions: str.max(500).optional()
  })).min(1).max(60),
  customerConfirmed: z.literal(true)
}).strict();
const transitionInput = z.object({
  version: z.number().int().positive(),
  nextStatus: z.enum(["preparing","ready","out_for_delivery","completed","cancelled"]),
  reason: str.max(500).optional()
}).strict();
const paymentInput = z.object({
  version: z.number().int().positive(),
  status: z.enum(["pending","proof_submitted","verified","cash_on_delivery","refunded"]),
  method: str.max(50).optional()
}).strict();
const courierInput = z.object({
  name: str.min(2).max(120), phone,
  vehicle: z.enum(["bike","motorbike"]),
  availability: z.enum(["offline","available"]).default("offline")
}).strict();
const zoneInput = z.object({
  name: str.min(2).max(100),
  feeCOP: z.number().int().min(0).max(1000000),
  etaMinutes: z.number().int().min(1).max(240),
  priority: z.number().int().min(1).max(500).default(100),
  active: z.boolean().default(false),
  coverageVerified: z.boolean().default(false),
  geojson: polygonSchema.nullable().optional()
}).strict();
const incidentInput = z.object({
  orderId: uuid,
  category: z.enum(["late","wrong_item","missing_item","allergy","payment","address","courier","technical","other"]),
  severity: z.enum(["normal","high","critical"]).default("normal"),
  description: str.min(5).max(2000)
}).strict();

restaurantOpsRoutes.use((req, res, next) => {
  if (req.tenantContext?.effectiveCompanyId !== "delibocados" ||
      req.authUser?.companyId !== "delibocados" || !req.authUser.active) {
    res.status(403).json({ ok: false, error: "RESTAURANT_TENANT_DENIED" });
    return;
  }
  next();
});
function actor(req: Request) {
  return { id: String(req.authUser?.id ?? ""), role: String(req.authUser?.role ?? "") };
}
function handleError(err: unknown, res: Response) {
  if (err instanceof ZodError) return res.status(400).json({ ok: false,
    error: "INVALID_INPUT", issues: err.issues.map(x => ({ path: x.path.join("."), code: x.code })) });
  const message = err instanceof Error ? err.message : "";
  const allowed = [
    "CUSTOMER_CONFIRMATION_REQUIRED", "RESTAURANT_ORDER_INVALID", "RESTAURANT_MENU_NOT_AVAILABLE",
    "DELIVERY_ZONE_UNVERIFIED", "DELIVERY_ADDRESS_AND_ZONE_REQUIRED", "INVALID_MENU_LINE",
    "INVALID_QUANTITY", "PRODUCT_UNAVAILABLE_OR_PRICE_UNVERIFIED", "INVALID_CATALOG_PRICE",
    "INVALID_ORDER_TRANSITION", "ORDER_VERSION_CONFLICT", "ORDER_NOT_FOUND",
    "COURIER_ASSIGNMENT_REQUIRED", "COURIER_NOT_AVAILABLE", "ORDER_NOT_ASSIGNABLE",
    "ORDER_ALREADY_ASSIGNED", "CANCELLATION_REASON_REQUIRED", "PAYMENT_TRANSITION_FORBIDDEN",
    "PAYMENT_VERIFICATION_REQUIRES_MANAGER", "PICKUP_MUST_NOT_HAVE_ZONE",
    "INSTRUCTIONS_TOO_LONG", "ORDER_TOTAL_TOO_LARGE",
    "PROOF_NOT_FOUND","PROOF_ALREADY_REVIEWED","ORDER_PAYMENT_STATE_CHANGED",
    "ORDER_NOT_REVIEWABLE","TRANSFER_REQUIRES_PROOF_REVIEW",
    "PAYMENT_REVIEW_FORBIDDEN","REJECTION_REASON_REQUIRED",
    "PAYMENT_REVIEW_REQUIRED_BEFORE_KITCHEN"
  ];
  const code = allowed.find(x => message.includes(x));
  if (code) return res.status(code === "ORDER_VERSION_CONFLICT" ? 409 : 422)
    .json({ ok: false, error: code });
  console.error("[RESTAURANT OPS]", { type: err instanceof Error ? err.name : "UNKNOWN" });
  return res.status(503).json({ ok: false, error: "RESTAURANT_OPERATION_UNAVAILABLE" });
}
function safe(fn: (req: Request,res: Response) => Promise<unknown>) {
  return async (req: Request,res: Response) => {
    try { await fn(req,res); } catch(error) { handleError(error,res); }
  };
}
function rows(table: string, query: string) {
  return supabaseRequest<Row[]>({ table, query });
}
function patch(table: string, query: string, body: object) {
  return supabaseRequest<Row[]>({ table, method: "PATCH", query, body,
    prefer: "return=representation" });
}
const readOnly = (res: Response) => res.setHeader("Cache-Control", "no-store");

const daySchema=z.object({
  enabled:z.boolean(),open:z.string().max(5),close:z.string().max(5)
}).strict();
const businessProfileInput=z.object({
  businessName:str.min(2).max(120),
  description:z.string().max(1500),
  locationAddress:z.string().max(250),
  publicPhone:z.string().max(40),
  city:str.min(2).max(100),
  coverageSummary:z.string().max(1000),
  openingHours:z.record(z.string(),daySchema),
  specialHoursNote:z.string().max(700),
  tone:z.enum(["natural","formal","friendly"]),
  extraInstructions:z.string().max(2000),
  learningEnabled:z.boolean(),
  originLat:z.number().finite().min(-90).max(90).nullable(),
  originLng:z.number().finite().min(-180).max(180).nullable(),
  originVerified:z.boolean()
}).strict();

restaurantOpsRoutes.get("/agent/business",requireRoles("owner","admin"),safe(async (_req,res)=>{
  const [profile,zones,couriers,stats]=await Promise.all([
    getBusinessProfile(),
    rows("restaurant_ops_zones","?company_id=eq.delibocados&select=id,name,fee_cop,eta_minutes,active,priority&order=priority.asc&limit=100"),
    rows("restaurant_ops_couriers","?company_id=eq.delibocados&select=id,name,phone,vehicle,availability,active&order=created_at.asc&limit=100"),
    getRestaurantOrderInsights()
  ]);
  readOnly(res);return res.json({ok:true,profile,zones,couriers,stats});
}));
restaurantOpsRoutes.post("/agent/business",requireRoles("owner","admin"),safe(async(req,res)=>{
  const v=businessProfileInput.parse(req.body);
  if(!validOpeningHours(v.openingHours as OpeningHours))
    return res.status(422).json({ok:false,error:"INVALID_OPENING_HOURS"});
  if(v.originVerified && (v.originLat===null||v.originLng===null))
    return res.status(422).json({ok:false,error:"ORIGIN_COORDINATES_REQUIRED"});
  const a=actor(req);
  const rowsSaved=await supabaseRequest<Row[]>({
    table:"restaurant_agent_business_profiles",method:"POST",
    query:"?on_conflict=company_id",prefer:"resolution=merge-duplicates,return=representation",
    body:[{
      company_id:"delibocados",business_name:v.businessName,
      description:v.description,location_address:v.locationAddress,
      public_phone:v.publicPhone,city:v.city,
      timezone:"America/Bogota",coverage_summary:v.coverageSummary,
      opening_hours:v.openingHours,special_hours_note:v.specialHoursNote,
      tone:v.tone,extra_instructions:v.extraInstructions,
      learning_enabled:v.learningEnabled,
      origin_lat:v.originLat,origin_lng:v.originLng,origin_verified:v.originVerified,
      updated_by:a.id,updated_at:new Date().toISOString()
    }]
  });
  return res.json({ok:true,profile:rowsSaved[0]??null});
}));
restaurantOpsRoutes.post("/delivery/quote-address",requireRoles("owner","admin","supervisor"),
  safe(async(req,res)=>{
    const v=z.object({address:str.min(8).max(300)}).strict().parse(req.body);
    const quote=await quoteVerifiedDeliveryAddress(v.address);
    readOnly(res);return res.json({ok:true,quote});
  })
);

restaurantOpsRoutes.get("/agent/learnings",requireRoles("owner","admin"),safe(async(_req,res)=>{
  const lessons=await rows("restaurant_agent_learnings",
    "?company_id=eq.delibocados&select=*&order=created_at.desc&limit=200");
  readOnly(res);return res.json({ok:true,lessons});
}));
restaurantOpsRoutes.post("/agent/learnings/analyze",requireRoles("owner","admin"),safe(async(_req,res)=>{
  const profile=await getBusinessProfile();
  if(!profile?.learning_enabled)
    return res.status(403).json({ok:false,error:"LEARNING_MUST_BE_ENABLED_BY_OWNER"});
  const result=await analyzeRecentRestaurantQuestions();
  return res.json({ok:true,result});
}));
restaurantOpsRoutes.post("/agent/learnings/:id/review",requireRoles("owner","admin"),safe(async(req,res)=>{
  const id=uuid.parse(req.params.id);
  const v=z.object({
    decision:z.enum(["approved","rejected"]),
    question:str.min(8).max(300),
    answer:str.min(8).max(900)
  }).strict().parse(req.body);
  if(v.decision==="approved" &&
    /pendiente de verificar y responder por el encargado/i.test(v.answer))
    return res.status(422).json({ok:false,error:"LEARNING_ANSWER_NEEDS_REVIEW"});
  const a=actor(req);
  const updated=await patch("restaurant_agent_learnings",
    "?company_id=eq.delibocados&id=eq."+id+"&status=eq.proposed",{
      status:v.decision,question:v.question,answer:v.answer,
      reviewed_by:a.id,reviewed_at:new Date().toISOString()
    });
  if(!updated.length)return res.status(409).json({ok:false,error:"LEARNING_ALREADY_REVIEWED"});
  return res.json({ok:true,lesson:updated[0]});
}));

restaurantOpsRoutes.get("/orders", safe(async (_req,res) => {
  const orders = await rows("restaurant_ops_orders",
    "?select=*,restaurant_ops_order_items(*)&company_id=eq.delibocados&order=created_at.desc&limit=200");
  readOnly(res); res.json({ ok:true, orders });
}));
restaurantOpsRoutes.post("/orders", requireRoles("owner","admin","supervisor"),
 safe(async (req,res) => {
  const v=orderInput.parse(req.body);
  if(v.fulfillmentMode==="pickup"&&(v.zoneId||v.address))
    return res.status(400).json({ok:false,error:"PICKUP_HAS_DELIVERY_FIELDS"});
  const a=actor(req);
  const order=await supabaseRpc<Row>("restaurant_ops_create_order",{
    p_company_id:"delibocados",p_source:v.source,p_source_key:v.sourceKey,
    p_customer_phone:v.customerPhone,p_customer_name:v.customerName,
    p_fulfillment_mode:v.fulfillmentMode,p_items:v.items,p_zone_id:v.zoneId??null,
    p_address:v.address??null,p_address_note:v.addressNote??null,
    p_customer_note:v.customerNote??null,p_pickup_due_at:v.pickupDueAt??null,
    p_actor_id:a.id,p_actor_role:a.role,p_customer_confirmed:true
  });
  return res.status(201).json({ok:true,order});
 }));
restaurantOpsRoutes.post("/orders/:id/transition",requireRoles("owner","admin","supervisor"),
 safe(async (req,res) => {
  const orderId=uuid.parse(req.params.id),v=transitionInput.parse(req.body),a=actor(req);
  if(v.nextStatus==="cancelled"&&a.role==="supervisor")
    return res.status(403).json({ok:false,error:"MANAGER_REQUIRED_TO_CANCEL"});
  const order=await supabaseRpc<Row>("restaurant_ops_transition_order",{
    p_company_id:"delibocados",p_order_id:orderId,p_expected_version:v.version,
    p_next_status:v.nextStatus,p_actor_id:a.id,p_actor_role:a.role,p_reason:v.reason??null
  });
  return res.json({ok:true,order});
 }));
restaurantOpsRoutes.post("/orders/:id/assign",requireRoles("owner","admin","supervisor"),
 safe(async (req,res) => {
  const orderId=uuid.parse(req.params.id);
  const v=z.object({version:z.number().int().positive(),courierId:uuid}).strict().parse(req.body);
  const a=actor(req);
  const order=await supabaseRpc<Row>("restaurant_ops_assign_courier",{
    p_company_id:"delibocados",p_order_id:orderId,p_courier_id:v.courierId,
    p_expected_version:v.version,p_actor_id:a.id,p_actor_role:a.role
  });
  return res.json({ok:true,order});
 }));
restaurantOpsRoutes.post("/orders/:id/payment",requireRoles("owner","admin","supervisor"),
 safe(async (req,res) => {
  const orderId=uuid.parse(req.params.id),v=paymentInput.parse(req.body),a=actor(req);
  const order=await supabaseRpc<Row>("restaurant_ops_set_payment",{
    p_company_id:"delibocados",p_order_id:orderId,p_expected_version:v.version,
    p_payment_status:v.status,p_payment_method:v.method??null,
    p_actor_id:a.id,p_actor_role:a.role
  });
  return res.json({ok:true,order});
 }));
const bankAccountInput=z.object({
  institutionName:str.min(2).max(120),
  holderName:str.min(2).max(180),
  accountType:z.enum(["bank_account","virtual_wallet"]),
  accountNumber:str.max(80).nullable().optional(),
  alias:str.max(120).nullable().optional(),
  instructions:str.max(1000).nullable().optional(),
  active:z.boolean().default(false)
}).strict();

restaurantOpsRoutes.get("/payments/account",requireRoles("owner","admin"),
  safe(async (_req,res)=>{
    const account=await rows("restaurant_ops_payment_accounts",
      "?company_id=eq.delibocados&select=*&limit=1");
    readOnly(res);return res.json({ok:true,account:account[0]??null});
  })
);
restaurantOpsRoutes.post("/payments/account",requireRoles("owner","admin"),
  safe(async (req,res)=>{
    const v=bankAccountInput.parse(req.body);
    if(!v.accountNumber?.trim()&&!v.alias?.trim())return res.status(422)
      .json({ok:false,error:"BANK_DESTINATION_REQUIRED"});
    const a=actor(req);
    const account=await supabaseRequest<Row[]>({
      table:"restaurant_ops_payment_accounts",
      method:"POST",
      query:"?on_conflict=company_id",
      prefer:"resolution=merge-duplicates,return=representation",
      body:[{
        company_id:"delibocados",
        institution_name:v.institutionName,
        holder_name:v.holderName,
        account_type:v.accountType,
        account_number:v.accountNumber||null,
        alias:v.alias||null,
        instructions:v.instructions||null,
        currency:"COP",active:v.active,
        updated_by:a.id,updated_at:new Date().toISOString()
      }]
    });
    return res.json({ok:true,account:account[0]??null});
  })
);

type RestaurantPaymentProof = {
  id: string; order_id: string; source_message_id: string; status: string;
  customer_phone: string; created_at: string; reviewed_at?: string | null;
  reviewed_by?: string | null; rejection_reason?: string | null;
};
restaurantOpsRoutes.get("/payments", requireRoles("owner","admin"), safe(async (req,res) => {
  const status=z.enum(["pending_review","approved","rejected","all"])
    .parse(req.query.status ?? "pending_review");
  const condition=status==="all"?"":"&status=eq."+status;
  const proofs=await supabaseRequest<RestaurantPaymentProof[]>({
    table:"restaurant_ops_payment_proofs",
    query:"?company_id=eq.delibocados"+condition+"&select=*"+
      "&order=created_at.desc&limit=150"
  });
  const orderIds=[...new Set(proofs.map(p=>p.order_id))];
  const orders=orderIds.length?await rows("restaurant_ops_orders",
    "?company_id=eq.delibocados&id=in.("+orderIds.map(encodeURIComponent).join(",")+")"+
    "&select=id,number,customer_name,customer_phone,total_cop,payment_method,payment_status,status"): [];
  const index=new Map(orders.map(x=>[String(x.id),x]));
  readOnly(res);return res.json({
    ok:true,proofs:proofs.map(p=>({...p,order:index.get(p.order_id)??null}))
  });
}));
restaurantOpsRoutes.post("/payments/:id/review",requireRoles("owner","admin"),
 safe(async (req,res) => {
   const proofId=uuid.parse(req.params.id);
   const decision=z.enum(["approve","reject"]).parse(req.body?.decision);
   const reason=decision==="reject"
     ? str.min(5).max(500).parse(req.body?.reason)
     : null;
   const a=actor(req);
   const review=await supabaseRpc<Row>("restaurant_ops_review_payment_proof",{
     p_company_id:"delibocados",
     p_proof_id:proofId,
     p_decision:decision,
     p_actor_id:a.id,
     p_actor_role:a.role,
     p_reason:reason
   });
   return res.json({ok:true,review});
 }));

restaurantOpsRoutes.get("/kitchen",safe(async (_req,res) => {
  const tickets=await rows("restaurant_ops_kitchen_tickets",
    "?company_id=eq.delibocados&select=id,order_id,status,queued_at,started_at,ready_at,printed_at"+
    "&order=queued_at.desc&limit=200");
  readOnly(res);return res.json({ok:true,tickets});
}));

restaurantOpsRoutes.get("/orders/:id/events",safe(async (req,res) => {
  const orderId=uuid.parse(req.params.id);
  const events=await rows("restaurant_ops_order_events",
    "?company_id=eq.delibocados&order_id=eq."+orderId+"&select=*&order=created_at.asc&limit=300");
  readOnly(res);return res.json({ok:true,events});
}));

restaurantOpsRoutes.get("/zones",safe(async (_req,res) => {
  const zones=await rows("restaurant_ops_zones",
    "?company_id=eq.delibocados&select=*&order=priority.asc&limit=100");
  readOnly(res);return res.json({ok:true,zones});
}));
restaurantOpsRoutes.post("/zones",requireRoles("owner","admin"),safe(async (req,res) => {
  const v=zoneInput.parse(req.body);
  if(v.active&&(!v.coverageVerified || !v.geojson))
    return res.status(422).json({ok:false,error:"ZONE_COVERAGE_VERIFICATION_REQUIRED"});
  const zones=await supabaseRequest<Row[]>({table:"restaurant_ops_zones",
    method:"POST",query:"?on_conflict=company_id,name",
    prefer:"resolution=merge-duplicates,return=representation",
    body:[{company_id:"delibocados",name:v.name,fee_cop:v.feeCOP,
      eta_minutes:v.etaMinutes,priority:v.priority,active:v.active,geojson:v.geojson??null}]});
  return res.json({ok:true,zone:zones[0]??null});
}));

restaurantOpsRoutes.get("/couriers",safe(async (_req,res) => {
  const couriers=await rows("restaurant_ops_couriers",
    "?company_id=eq.delibocados&select=*&order=created_at.asc&limit=100");
  readOnly(res);return res.json({ok:true,couriers});
}));
restaurantOpsRoutes.post("/couriers",requireRoles("owner","admin"),safe(async (req,res) => {
  const v=courierInput.parse(req.body);
  const couriers=await supabaseRequest<Row[]>({table:"restaurant_ops_couriers",
    method:"POST",query:"?on_conflict=company_id,phone",
    prefer:"resolution=merge-duplicates,return=representation",
    body:[{company_id:"delibocados",...v}]});
  return res.json({ok:true,courier:couriers[0]??null});
}));
restaurantOpsRoutes.post("/couriers/:id/availability",requireRoles("owner","admin"),
 safe(async (req,res) => {
  const courierId=uuid.parse(req.params.id);
  const availability=z.enum(["offline","available"]).parse(req.body?.availability);
  const active=await rows("restaurant_ops_orders",
    "?company_id=eq.delibocados&courier_id=eq."+courierId+
    "&status=in.(confirmed,preparing,ready,out_for_delivery)&select=id&limit=1");
  if(active.length)return res.status(409).json({ok:false,error:"COURIER_HAS_ACTIVE_ORDER"});
  const result=await patch("restaurant_ops_couriers",
    "?company_id=eq.delibocados&id=eq."+courierId,{availability});
  return res.json({ok:true,courier:result[0]??null});
 }));

restaurantOpsRoutes.get("/incidents",safe(async (_req,res) => {
  const incidents=await rows("restaurant_ops_incidents",
    "?company_id=eq.delibocados&select=*&order=created_at.desc&limit=250");
  readOnly(res);return res.json({ok:true,incidents});
}));
restaurantOpsRoutes.post("/incidents",requireRoles("owner","admin","supervisor"),
 safe(async (req,res) => {
  const v=incidentInput.parse(req.body);
  const matching=await rows("restaurant_ops_orders",
    "?company_id=eq.delibocados&id=eq."+v.orderId+"&select=id&limit=1");
  if(!matching.length)return res.status(404).json({ok:false,error:"ORDER_NOT_FOUND"});
  const incidents=await supabaseRequest<Row[]>({table:"restaurant_ops_incidents",
    method:"POST",body:[{company_id:"delibocados",order_id:v.orderId,
      actor_id:actor(req).id,category:v.category,severity:v.severity,
      description:v.description}]});
  return res.status(201).json({ok:true,incident:incidents[0]??null});
 }));
restaurantOpsRoutes.post("/incidents/:id/resolve",requireRoles("owner","admin"),
 safe(async (req,res) => {
  const incidentId=uuid.parse(req.params.id);
  const resolution=str.min(5).max(2000).parse(req.body?.resolution);
  const records=await patch("restaurant_ops_incidents",
    "?company_id=eq.delibocados&id=eq."+incidentId+"&status=eq.open",
    {status:"resolved",resolution,resolved_at:new Date().toISOString()});
  return res.json({ok:true,incident:records[0]??null});
 }));

restaurantOpsRoutes.get("/report",safe(async (req,res) => {
  const days=z.coerce.number().int().min(1).max(30).parse(req.query.days??7);
  const since=new Date(Date.now()-days*86400000).toISOString();
  const after=encodeURIComponent(since);
  const [orders,tickets,incidents,couriers]=await Promise.all([
    rows("restaurant_ops_orders",
      "?company_id=eq.delibocados&created_at=gte."+after+"&select=*&order=created_at.desc&limit=1000"),
    rows("restaurant_ops_kitchen_tickets",
      "?company_id=eq.delibocados&queued_at=gte."+after+"&select=*&order=queued_at.desc&limit=1000"),
    rows("restaurant_ops_incidents",
      "?company_id=eq.delibocados&created_at=gte."+after+"&select=*&order=created_at.desc&limit=1000"),
    rows("restaurant_ops_couriers",
      "?company_id=eq.delibocados&select=id,name,vehicle,availability,active&limit=100")
  ]);
  const count=(arr:Row[],field:string,value:string)=>arr.filter(r=>r[field]===value).length;
  const prep=tickets.filter(t=>t.started_at&&t.ready_at).map(t=>
    (new Date(String(t.ready_at)).getTime()-new Date(String(t.started_at)).getTime())/60000)
    .filter(n=>Number.isFinite(n)&&n>=0);
  const completed=orders.filter(o=>o.status==="completed");
  readOnly(res);return res.json({ok:true,report:{
    days,since,truncated:orders.length>=1000||tickets.length>=1000||incidents.length>=1000,
    orders:{
      total:orders.length,confirmed:count(orders,"status","confirmed"),
      preparing:count(orders,"status","preparing"),ready:count(orders,"status","ready"),
      outForDelivery:count(orders,"status","out_for_delivery"),
      completed:completed.length,cancelled:count(orders,"status","cancelled"),
      pickup:count(orders,"fulfillment_mode","pickup"),delivery:count(orders,"fulfillment_mode","delivery"),
      awaitingPayment:count(orders,"payment_status","pending"),
      verifiedPayment:count(orders,"payment_status","verified")
    },
    kitchen:{
      commandsGenerated:tickets.length,printed:tickets.filter(t=>Boolean(t.printed_at)).length,started:count(tickets,"status","working")+count(tickets,"status","ready"),
      ready:count(tickets,"status","ready"),
      averagePrepMinutes:prep.length?Math.round(prep.reduce((a,b)=>a+b,0)/prep.length):null,
      overdue:tickets.filter(t=>t.status==="working"&&
        Date.now()-new Date(String(t.started_at)).getTime()>30*60000).length
    },
    incidents:{
      total:incidents.length,open:count(incidents,"status","open"),
      resolved:count(incidents,"status","resolved"),
      critical:count(incidents,"severity","critical")
    },
    couriers:couriers.map(c=>({
      id:c.id,name:c.name,vehicle:c.vehicle,availability:c.availability,
      completed:completed.filter(o=>o.courier_id===c.id).length,
      assigned:orders.filter(o=>o.courier_id===c.id&&o.status!=="cancelled").length
    })),
    customers:new Set(orders.map(o=>String(o.customer_phone))).size
  }});
}));

// Deliberately manual, manager-only and limited to the configured test phone.
restaurantOpsRoutes.post("/notifications/dispatch-test",
  requireRoles("owner","admin"), safe(async (_req,res) => {
    const result = await dispatchDelibocadosTestNotifications();
    return res.json({ok:true,result});
  })
);


restaurantOpsRoutes.get("/customers/:phone/history",requireRoles("owner","admin","supervisor"),
  safe(async(req,res)=>{
    const customerPhone=phone.parse(req.params.phone);
    const history=await loadCustomerHistory(customerPhone,30);
    readOnly(res);return res.json({ok:true,...history});
  })
);

restaurantOpsRoutes.get("/customers", safe(async (_req,res) => {
  const [contacts,orders,incidents] = await Promise.all([
    listContacts("delibocados"),
    rows("restaurant_ops_orders",
      "?company_id=eq.delibocados&select=customer_phone,status,total_cop,created_at&order=created_at.desc&limit=1000"),
    rows("restaurant_ops_incidents",
      "?company_id=eq.delibocados&status=eq.open&select=order_id&limit=1000")
  ]);
  const aggregate = new Map<string,{orderCount:number;completed:number;spentCOP:number;lastOrder:string|null}>();
  for(const o of orders) {
    const ph = String(o.customer_phone??"");
    const item=aggregate.get(ph) ?? {orderCount:0,completed:0,spentCOP:0,lastOrder:null};
    item.orderCount++;
    if(o.status==="completed") {
      item.completed++;
      item.spentCOP += Number(o.total_cop)||0;
    }
    if(!item.lastOrder)item.lastOrder=String(o.created_at??"");
    aggregate.set(ph,item);
  }
  const customers = contacts.map(c => ({
    phone:c.phone,name:c.name??null,
    profileName:c.metadata?.whatsapp_profile_name ?? null,
    nameConfirmed:c.metadata?.name_confirmed===true,
    nameSource:c.metadata?.name_source ?? "unknown",
    status:c.status??"lead",lastSeen:c.last_seen_at??null,
    ...(aggregate.get(c.phone) ?? {orderCount:0,completed:0,spentCOP:0,lastOrder:null})
  }));
  readOnly(res);return res.json({ok:true,customers,
    partial:orders.length>=1000 || incidents.length>=1000});
}));


restaurantOpsRoutes.get("/zones/quote", safe(async (req,res) => {
  const lat=z.coerce.number().finite().min(-90).max(90).parse(req.query.lat);
  const lng=z.coerce.number().finite().min(-180).max(180).parse(req.query.lng);
  const zones=await rows("restaurant_ops_zones",
    "?company_id=eq.delibocados&active=eq.true&select=id,name,geojson,fee_cop,eta_minutes,priority&order=priority.asc&limit=100");
  for(const zone of zones) {
    const verified=polygonSchema.safeParse(zone.geojson);
    if(verified.success && containsPoint(verified.data,lng,lat)) {
      readOnly(res);return res.json({ok:true,covered:true,zone:{
        id:zone.id,name:zone.name,feeCOP:zone.fee_cop,
        etaMinutes:zone.eta_minutes
      }});
    }
  }
  readOnly(res);return res.json({ok:true,covered:false,zone:null});
}));
