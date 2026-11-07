/** Whapi Cloud's documented messages.post geo payload shape. */
export type IncomingWhapiPoint={
  lat:number;lng:number;live:boolean;name?:string;address?:string;
};
export function parseIncomingWhapiPoint(raw:unknown):IncomingWhapiPoint|null {
  if(!raw||typeof raw!=="object")return null;
  const message=raw as Record<string,unknown>;
  const type=message.type;
  if(type!=="location"&&type!=="live_location")return null;
  const source=message[type];
  if(!source||typeof source!=="object"||Array.isArray(source))return null;
  const p=source as Record<string,unknown>;
  const lat=Number(p.latitude),lng=Number(p.longitude);
  if(p.latitude==null||p.longitude==null||
     !Number.isFinite(lat)||!Number.isFinite(lng)||
     lat < -90||lat > 90||lng < -180||lng > 180)return null;
  const clean=(value:unknown)=>
    typeof value==="string"?value.replace(/[\r\n]/g," ").trim().slice(0,150):undefined;
  return {
    lat,lng,live:type==="live_location",
    name:clean(p.name),address:clean(p.address)
  };
}
