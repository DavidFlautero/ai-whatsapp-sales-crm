import { supabaseRequest, supabaseRpc } from "../db/supabase-rest.client.js";
import { updateConversationMetadata } from "../conversations/conversation.repository.js";
import { getDefaultPaymentAccount } from "../payments/payment-submission.service.js";

const COMPANY = "delibocados";

type TransferOrder = {
  id: string;
  number: number;
  customer_phone: string;
  payment_method: string;
  payment_status: string;
  status: string;
  total_cop: number;
  created_at: string;
};
type PaymentProof = {
  id: string; order_id: string;
  source_message_id: string;
  status: "pending_review" | "approved" | "rejected";
};
type PaymentAccount = NonNullable<Awaited<ReturnType<typeof getDefaultPaymentAccount>>>;

export function transferInstructions(account: PaymentAccount, orderNumber: number, totalCOP: number) {
  const lines = [
    "Pedido #" + orderNumber + " — *$" + totalCOP.toLocaleString("es-CO") + " COP*",
    "Transferí solamente a los datos oficiales del restaurante:",
    "Entidad: " + account.institution_name,
    "Titular: " + account.holder_name,
    ...(account.account_type === "bank_account" ? ["Tipo: cuenta bancaria"] : []),
    ...(account.account_type === "virtual_wallet" ? ["Tipo: billetera digital"] : []),
    ...(account.account_number ? ["Número: " + account.account_number] : []),
    ...(account.alias ? ["Alias: " + account.alias] : []),
    ...(account.instructions ? [account.instructions] : []),
    "Después enviá por este WhatsApp una *foto o PDF del comprobante*.",
    "El pago queda pendiente hasta que un encargado lo verifique. Solo entonces pasa a cocina."
  ];
  return lines.join("\n");
}

export async function transferInstructionsForOrder(input: { number: number; totalCOP: number }) {
  const account = await getDefaultPaymentAccount({ companyId: COMPANY, currency: "COP" });
  if (!account || account.account_type === "cash" ||
      (!account.account_number && !account.alias)) {
    return {
      text: "Tu pedido #" + input.number + " está registrado, pero la cuenta para transferencia aún no está configurada. " +
        "Un encargado te compartirá los datos oficiales. *No transfieras a una cuenta enviada por terceros.*",
      humanHandoff: true
    };
  }
  return { text: transferInstructions(account,input.number,input.totalCOP),humanHandoff:false };
}

function requestedNumber(caption: string) {
  const match = caption.match(/(?:pedido\s*)?#\s*(\d{1,12})\b/i);
  return match ? Number(match[1]) : null;
}
export function choosePaymentOrder(orders: TransferOrder[], caption: string) {
  const candidates=orders.filter(x =>
    x.payment_method==="transfer" && x.status==="confirmed" &&
    (x.payment_status==="pending" || x.payment_status==="proof_submitted") &&
    Date.now()-Date.parse(x.created_at)<48*3600*1000);
  const number=requestedNumber(caption);
  const matched=number!==null?candidates.filter(o=>Number(o.number)===number):candidates;
  if(matched.length===1)return { order:matched[0], problem:null as string|null };
  if(matched.length>1)return { order:null,problem:"MULTIPLE_PENDING_ORDERS" };
  return {order:null,problem:number!==null?"NO_MATCHING_ORDER":"NO_PENDING_TRANSFER"};
}

/** Called only AFTER the incoming media message was durably written to the CRM. */
export async function captureRestaurantPaymentProof(input: {
  companyId: string;
  phone: string;
  externalMessageId: string;
  internalMessageId: string;
  kind: "image" | "document";
  caption: string;
}): Promise<{ received: boolean; reason: string; orderNumber?: number }> {
  if(input.companyId!==COMPANY || !/^[0-9]{8,15}$/.test(input.phone) ||
     !input.internalMessageId || !input.externalMessageId) {
    return {received:false,reason:"INVALID_CONTEXT"};
  }
  const orders=await supabaseRequest<TransferOrder[]>({
    table:"restaurant_ops_orders",
    query:"?company_id=eq.delibocados&customer_phone=eq."+encodeURIComponent(input.phone)+
      "&payment_method=eq.transfer&payment_status=in.(pending,proof_submitted)"+
      "&status=eq.confirmed&select=id,number,customer_phone,payment_method,payment_status,status,total_cop,created_at"+
      "&order=created_at.desc&limit=20"
  });
  const selected=choosePaymentOrder(orders,input.caption);
  if(!selected.order) {
    if(selected.problem==="MULTIPLE_PENDING_ORDERS") {
      await updateConversationMetadata(input.phone,{
        restaurant_attention:{
          type:"payment_ambiguous",status:"needs_human",
          reported_at:new Date().toISOString()
        }
      },COMPANY);
    }
    return {received:false,reason:selected.problem??"NO_ORDER"};
  }
  try {
    await supabaseRpc<PaymentProof>("restaurant_ops_submit_payment_proof",{
      p_company_id:COMPANY,
      p_order_id:selected.order.id,
      p_source_message_id:input.internalMessageId,
      p_customer_phone:input.phone
    });
    return {received:true,reason:"PENDING_MANAGER_REVIEW",orderNumber:selected.order.number};
  } catch (error) {
    const msg=error instanceof Error?error.message:"";
    if(msg.includes("PROOF_ALREADY_PENDING_REVIEW"))return {
      received:false,reason:"PROOF_ALREADY_PENDING_REVIEW",orderNumber:selected.order.number
    };
    throw error;
  }
}
