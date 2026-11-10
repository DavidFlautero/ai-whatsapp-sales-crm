/**
 * Pure intake of preparation instructions mentioned in the SAME message as
 * a product. Never silently omit food modifications or infer extra prices.
 * No persistence and no AI guesses.
 */
import {spanishNormalize,type CartLine} from "./restaurant-checkout-dialogue.service.js";

const safeIngredientLabels:Record<string,string>={
  "vegetales":"VEGETALES","cebolla":"CEBOLLA","tomate":"TOMATE",
  "lechuga":"LECHUGA","salsa":"SALSA","salsas":"SALSAS",
  "queso":"QUESO","mayonesa":"MAYONESA"
};
const allergy=/(?:^|\b)(?:alerg\w*|anafilaxia|intolerancia|celiac\w*|gluten|lactosa)\b/;
const foodChange=/(?:^|\b)(?:sin|extra|con|no le pongas|no poner|quita)\s+(?!(?:un|una|uno|dos|tres)\b)/;
const removePattern=/\b(?:sin|no le pongas|no poner|quita)\s+(?:(?:el|la|los|las)\s+)?(vegetales|cebolla|tomate|lechuga|salsas?|queso|mayonesa)\b/g;

export type PreparationIntake=
  |{kind:"safe";lines:CartLine[]}
  |{kind:"clarify";code:string;prompt:string}
  |{kind:"human";code:"FOOD_SAFETY_REVIEW";prompt:string};

export function isFoodSafetyMessage(message:string):boolean{
  return allergy.test(spanishNormalize(message));
}

export function interpretNaturalPreparation(
  message:string,lines:CartLine[]
):PreparationIntake{
  const m=spanishNormalize(message);
  if(isFoodSafetyMessage(message))
    return {kind:"human",code:"FOOD_SAFETY_REVIEW",prompt:
      "Para cuidar tu salud, una persona del restaurante debe revisar ingredientes y posibles alérgenos antes de aceptar este pedido. No lo registré automáticamente."};
  if(!foodChange.test(m))return {kind:"safe",lines};
  const removals=[...m.matchAll(removePattern)];
  // "con queso"/"extra salsa" can affect prices and stock; require a real variant.
  if(/\b(?:con|extra)\s+(?!(?:un|una|uno|dos|tres)\b)/.test(m))
    return {kind:"clarify",code:"POSSIBLE_PRICED_EXTRA",prompt:
      "Esa modificación podría cambiar el precio. Para anotarla necesito confirmar la variante del menú; todavía no agregué los productos."};
  if(!removals.length||removals.length>3)
    return {kind:"clarify",code:"UNSUPPORTED_PREPARATION",prompt:
      "No pude identificar todas las indicaciones de preparación de manera segura. Escribí el nombre exacto del producto y la modificación; no cambié el carrito."};
  if(lines.length!==1||lines[0].instructions)
    return {kind:"clarify",code:"MULTIPLE_PRODUCTS_PREPARATION",prompt:
      "Veo instrucciones especiales y varios productos. Decime exactamente a cuál producto se aplican antes de agregarlo; todavía no cambié el carrito."};
  const line=lines[0];
  if(!Number.isSafeInteger(line.quantity)||line.quantity<1||line.quantity>25)
    return {kind:"clarify",code:"BAD_QUANTITY",prompt:"Confirmame la cantidad exacta antes de agregarla."};
  const distinct=[...new Set(removals.map(x=>safeIngredientLabels[x[1]]))];
  if(distinct.some(x=>!x))
    return {kind:"clarify",code:"BAD_INGREDIENT",prompt:"Necesito confirmar la indicación con cocina."};
  let affected=1;
  if(line.quantity>1){
    // The phrase MUST specify the number of units that receive the change;
    // "2 hamburguesas sin cebolla" is ambiguous, don't assume only one.
    const before=m.slice(0,removals[0].index).trim();
    const count=before.match(/\b(una|uno|dos|tres|cuatro|cinco|1|2|3|4|5)(?:\s+de\s+(?:esas|esos|ellas|ellos|las|los))?\s*$/);
    if(!count)
      return {kind:"clarify",code:"PREPARATION_UNITS_AMBIGUOUS",prompt:
        "¿La indicación especial es para todas las unidades o solamente una? No cambié el carrito."};
    const amounts:Record<string,number>={una:1,uno:1,dos:2,tres:3,cuatro:4,cinco:5};
    affected=amounts[count[1]]??Number(count[1]);
    if(affected>line.quantity)
      return {kind:"clarify",code:"PREPARATION_TOO_MANY_UNITS",prompt:
        "La cantidad con indicaciones supera las unidades pedidas. Confirmame cuántas son."};
    if(removals.length>1 && /\b(?:otra|otras|la segunda|una mas)\b/.test(m))
      return {kind:"clarify",code:"DIFFERENT_UNIT_INSTRUCTIONS",prompt:
        "Necesito separar las indicaciones de cada unidad antes de agregar los productos."};
  }
  const description=distinct.map(x=>"SIN "+x).join("; ");
  return {kind:"safe",lines:[
    ...(line.quantity>affected?[{productId:line.productId,quantity:line.quantity-affected}]:[]),
    {productId:line.productId,quantity:affected,instructions:description}
  ]};
}
