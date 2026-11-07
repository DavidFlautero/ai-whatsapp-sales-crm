/**
 * Mixed bank transfer + cash is intentionally quoted in whole Colombian pesos.
 * We never silently turn "40" into 40,000: customer's exact figure must be
 * confirmed before order creation and again in the final order review.
 */
export function isSplitPaymentRequest(text:string):boolean {
  const m=text.toLocaleLowerCase("es-CO").normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ");
  const transfer=/\b(?:transferencia|transfiero|transferir|bre[\s-]?b|nequi|daviplata)\b/.test(m);
  const cash=/\b(?:efectivo|en mano|aqui el resto|aca el resto|resto aqui|resto por aca|el resto|pago mixto)\b/.test(m);
  return (transfer&&cash)||/\b(?:mixto|pago dividido|pago combinado)\b/.test(m);
}
export function parseExactTransferCOP(input:string):number|null{
  const normalized=input.toLocaleLowerCase("es-CO").normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"").trim();
  const money=normalized.match(/(?:^|[^\d])(\d{1,3}(?:[.,]\d{3})+|\d{4,9}|\d{1,3}\s*(?:mil|miles|k))\s*(?:cop|pesos)?\b/);
  if(!money)return null;
  const amount=money[1];
  const value=/(?:mil|miles|k)\s*$/.test(amount)
    ? Number(amount.replace(/\s*(?:mil|miles|k)\s*$/,"").trim())*1000
    : Number(amount.replace(/[.,]/g,""));
  if(!Number.isSafeInteger(value)||value<1||value>999999999)return null;
  return value;
}
export function splitPaymentQuote(totalCOP:number,transferCOP:number):
  {transferCOP:number;cashCOP:number}|null{
  if(!Number.isSafeInteger(totalCOP)||totalCOP<=1||
     !Number.isSafeInteger(transferCOP)||transferCOP<=0||
     transferCOP>=totalCOP)return null;
  return {transferCOP,cashCOP:totalCOP-transferCOP};
}
export function splitQuoteMessage(total:number,transfer:number):string{
  const split=splitPaymentQuote(total,transfer);
  if(!split)throw new Error("SPLIT_PAYMENT_AMOUNT_INVALID");
  const money=(v:number)=>"$"+v.toLocaleString("es-CO")+" COP";
  return "Quedaría así: *"+money(split.transferCOP)+" por transferencia*"+
    " y *"+money(split.cashCOP)+" en efectivo* al recibir. "+
    "El encargado verificará que haya ingresado la transferencia antes de "+
    "enviar el pedido a cocina. Respondé exactamente *CONFIRMAR DIVISIÓN* "+
    "si las dos cantidades son correctas.";
}
