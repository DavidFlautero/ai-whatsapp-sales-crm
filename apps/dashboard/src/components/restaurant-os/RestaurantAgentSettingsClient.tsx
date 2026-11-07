"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import "./restaurant-ops.css";

type DayKey="mon"|"tue"|"wed"|"thu"|"fri"|"sat"|"sun";
type Hours=Partial<Record<DayKey,{enabled:boolean;open:string;close:string}>>;
type Profile={
  business_name:string;description:string;location_address:string;
  public_phone:string;city:string;coverage_summary:string;
  opening_hours:Hours;special_hours_note:string;
  tone:"natural"|"formal"|"friendly";extra_instructions:string;
  learning_enabled:boolean;origin_lat:number|null;origin_lng:number|null;
  origin_verified:boolean;updated_at?:string;
};
type Zone={id:string;name:string;fee_cop:number;eta_minutes:number;active:boolean};
type Courier={id:string;name:string;phone:string;vehicle:"bike"|"motorbike";availability:string;active:boolean};
type Popular={name:string;quantity:number;orders:number};
type Lesson={id:string;category:string;question:string;answer:string;evidence:string;status:string;source_type:string;created_at:string};
const base="/dashboard-api/restaurant-ops";
const days:[DayKey,string][]=[
  ["mon","Lunes"],["tue","Martes"],["wed","Miércoles"],
  ["thu","Jueves"],["fri","Viernes"],["sat","Sábado"],["sun","Domingo"]
];
const defaultProfile:Profile={
  business_name:"Delibocados",description:"",location_address:"",
  public_phone:"",city:"Funza",
  coverage_summary:"Sectores verificados de Funza y Mosquera. No Bogotá.",
  opening_hours:{},special_hours_note:"",
  tone:"natural",extra_instructions:"",learning_enabled:false,
  origin_lat:null,origin_lng:null,origin_verified:false
};
const money=(value:number)=>new Intl.NumberFormat("es-CO",{
  style:"currency",currency:"COP",maximumFractionDigits:0
}).format(value);
async function jsonRequest<T>(path:string,body?:object):Promise<T>{
  const response=await fetch(base+"/"+path,{
    method:body?"POST":"GET",credentials:"same-origin",cache:"no-store",
    headers:{"Accept":"application/json","Content-Type":"application/json"},
    ...(body?{body:JSON.stringify(body)}:{})
  });
  const data=await response.json();
  if(!response.ok||!data.ok)throw new Error(data.error||"No se pudo completar la operación");
  return data as T;
}

function LearningCard({item,onReviewed}:{
  item:Lesson;onReviewed:()=>Promise<void>;
}){
  const [question,setQuestion]=useState(item.question);
  const [answer,setAnswer]=useState(item.answer);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  async function review(decision:"approved"|"rejected"){
    setBusy(true);setError("");
    try{
      await jsonRequest("agent/learnings/"+item.id+"/review",{decision,question,answer});
      await onReviewed();
    }catch(e){setError(e instanceof Error?e.message:"No se pudo revisar");}
    finally{setBusy(false);}
  }
  return <article className="rops-order">
    <div className="rops-order-head">
      <strong>{item.category==="faq"?"Pregunta frecuente":"Regla de servicio"}</strong>
      <span className={"rops-pill "+(item.status==="approved"?"rops-ok":
        item.status==="rejected"?"rops-danger":"rops-warning")}>
        {item.status==="approved"?"Aprobada":item.status==="rejected"?"Rechazada":"Pendiente"}
      </span>
    </div>
    <p className="rops-muted">{item.evidence}</p>
    {item.status==="proposed"?<div className="rops-form-grid" style={{gridTemplateColumns:"1fr"}}>
      <label>Pregunta
        <input value={question} onChange={e=>setQuestion(e.target.value)}/>
      </label>
      <label>Respuesta verificada (editar antes de aprobar)
        <textarea rows={3} value={answer} onChange={e=>setAnswer(e.target.value)}/>
      </label>
      <div className="rops-actions">
        <button disabled={busy||answer.trim().length<8} onClick={()=>void review("approved")}>
          Aprobar conocimiento
        </button>
        <button className="rops-secondary" disabled={busy} onClick={()=>void review("rejected")}>
          Descartar
        </button>
      </div>
    </div>:<p><b>{item.question}</b> — {item.answer}</p>}
    {error&&<p className="rops-error" role="alert">{error}</p>}
  </article>;
}

export default function RestaurantAgentSettingsClient(){
  const [profile,setProfile]=useState<Profile>(defaultProfile);
  const [zones,setZones]=useState<Zone[]>([]);
  const [couriers,setCouriers]=useState<Courier[]>([]);
  const [popular,setPopular]=useState<Popular[]>([]);
  const [samples,setSamples]=useState(0);
  const [lessons,setLessons]=useState<Lesson[]>([]);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const [testAddress,setTestAddress]=useState("");
  const [quote,setQuote]=useState<{
    covered:boolean;reason?:string;formattedAddress?:string;
    drivingDistanceMeters?:number;drivingDurationMinutes?:number;
    zone?:{name:string;feeCOP:number;estimatedMinutes:number};
    suggestedCouriers?:Array<{name:string;vehicle:string}>;
  }|null>(null);
  const [quoteBusy,setQuoteBusy]=useState(false);
  async function testDelivery(){
    setQuoteBusy(true);setError("");setQuote(null);
    try{
      const data=await jsonRequest<{ok:true;quote:NonNullable<typeof quote>}>(
        "delivery/quote-address",{address:testAddress});
      setQuote(data.quote);
    }catch(err){setError(err instanceof Error?err.message:"No se pudo verificar dirección");}
    finally{setQuoteBusy(false);}
  }


  const load=useCallback(async()=>{
    try{
      const [a,b]=await Promise.all([
        jsonRequest<{ok:true;profile:Profile|null;zones:Zone[];couriers:Courier[];
          stats:{sampleOrders:number;popular:Popular[]}}>("agent/business"),
        jsonRequest<{ok:true;lessons:Lesson[]}>("agent/learnings")
      ]);
      setProfile(a.profile??defaultProfile);
      setZones(a.zones);setCouriers(a.couriers);
      setPopular(a.stats.popular);setSamples(a.stats.sampleOrders);
      setLessons(b.lessons);setError("");
    }catch(e){setError(e instanceof Error?e.message:"No se pudieron cargar los datos");}
    finally{setLoaded(true);}
  },[]);
  useEffect(()=>{void load();},[load]);

  const update=<K extends keyof Profile>(key:K,value:Profile[K])=>
    setProfile(p=>({...p,[key]:value}));
  function changeDay(key:DayKey,field:"enabled"|"open"|"close",value:boolean|string){
    setProfile(p=>{
      const current=p.opening_hours[key]??{enabled:false,open:"",close:""};
      return {...p,opening_hours:{
        ...p.opening_hours,[key]:{...current,[field]:value}
      }};
    });
  }
  async function save(event:FormEvent){
    event.preventDefault();setBusy(true);setError("");setNotice("");
    try{
      const saved=await jsonRequest<{ok:true;profile:Profile}>("agent/business",{
        businessName:profile.business_name,description:profile.description,
        locationAddress:profile.location_address,publicPhone:profile.public_phone,
        city:profile.city,coverageSummary:profile.coverage_summary,
        openingHours:profile.opening_hours,specialHoursNote:profile.special_hours_note,
        tone:profile.tone,extraInstructions:profile.extra_instructions,
        learningEnabled:profile.learning_enabled,
        originLat:profile.origin_lat,originLng:profile.origin_lng,
        originVerified:profile.origin_verified
      });
      setProfile(saved.profile);
      setNotice("Configuración guardada. El agente de pruebas usará los datos verificados.");
    }catch(e){setError(e instanceof Error?e.message:"No se pudo guardar");}
    finally{setBusy(false);}
  }
  async function analyze(){
    setBusy(true);setError("");setNotice("");
    try{
      const data=await jsonRequest<{ok:true;result:{scanned:number;proposed:number}}>(
        "agent/learnings/analyze",{});
      setNotice("Se revisaron "+data.result.scanned+" mensajes y se propusieron "+
        data.result.proposed+" nuevas preguntas para aprobar.");
      const results=await jsonRequest<{ok:true;lessons:Lesson[]}>("agent/learnings");
      setLessons(results.lessons);
    }catch(e){setError(e instanceof Error?e.message:"No se pudo analizar el historial");}
    finally{setBusy(false);}
  }
  if(!loaded)return <main className="rops"><p className="rops-muted">Cargando configuración del negocio…</p></main>;
  return <main className="rops">
    <header className="rops-heading">
      <div>
        <span className="rops-eyebrow">DELIBOCADOS / INTELIGENCIA ARTIFICIAL</span>
        <h1>Configuración del agente</h1>
        <p>Datos operativos, horarios, repartidores y conocimiento aprendido con revisión humana.</p>
      </div>
      <a className="rops-primary" style={{padding:12,borderRadius:9,color:"white",textDecoration:"none"}}
        href="/panel/conversaciones">Ver conversaciones</a>
    </header>
    {error&&<div className="rops-error" role="alert">{error}</div>}
    {notice&&<div className="rops-notice" role="status">{notice}</div>}
    <form onSubmit={e=>void save(e)}>
      <section className="rops-card">
        <div className="rops-row"><h2>1. Datos del negocio</h2>
          <span className="rops-pill rops-neutral">Zona horaria: Bogotá</span>
        </div>
        <div className="rops-form-grid">
          <label>Nombre del negocio
            <input required value={profile.business_name}
              onChange={e=>update("business_name",e.target.value)}/>
          </label>
          <label>Ciudad
            <input required value={profile.city}
              onChange={e=>update("city",e.target.value)}/>
          </label>
          <label>Dirección pública (solo si está verificada)
            <input value={profile.location_address}
              onChange={e=>update("location_address",e.target.value)}
              placeholder="Sin configurar"/>
          </label>
          <label>Teléfono público
            <input value={profile.public_phone} placeholder="Sin configurar"
              onChange={e=>update("public_phone",e.target.value)}/>
          </label>
          <label className="rops-wide">Descripción del restaurante
            <textarea rows={2} value={profile.description} maxLength={1500}
              onChange={e=>update("description",e.target.value)}
              placeholder="Qué ofrece Delibocados, especialidades verificadas…"/>
          </label>
          <label className="rops-wide">Cobertura general
            <textarea rows={2} maxLength={1000} value={profile.coverage_summary}
              onChange={e=>update("coverage_summary",e.target.value)}/>
          </label>
        </div>
      </section>
      <section className="rops-card">
        <h2>2. Horarios de atención</h2>
        <p>Completá los horarios reales. Lo no configurado se informará como no confirmado; el agente no inventará horas de apertura.</p>
        <div className="rops-hours-grid">
          {days.map(([key,label])=>{
            const d=profile.opening_hours[key]??{enabled:false,open:"",close:""};
            return <div className="rops-hour-row" key={key}>
              <label className="rops-check">
                <input type="checkbox" checked={d.enabled}
                  onChange={e=>changeDay(key,"enabled",e.target.checked)}/>
                {label}
              </label>
              <input type="time" aria-label={label+" apertura"} value={d.open}
                required={d.enabled} disabled={!d.enabled}
                onChange={e=>changeDay(key,"open",e.target.value)}/>
              <span>a</span>
              <input type="time" aria-label={label+" cierre"} value={d.close}
                required={d.enabled} disabled={!d.enabled}
                onChange={e=>changeDay(key,"close",e.target.value)}/>
            </div>;
          })}
        </div>
        <label className="rops-settings-field">Excepciones, festivos o avisos de servicio
          <textarea rows={2} maxLength={700} value={profile.special_hours_note}
            onChange={e=>update("special_hours_note",e.target.value)}
            placeholder="Escribí únicamente fechas y condiciones verificadas"/>
        </label>
      </section>
      <section className="rops-card">
        <h2>3. Cómo responde la IA</h2>
        <div className="rops-form-grid">
          <label>Estilo de conversación
            <select value={profile.tone}
              onChange={e=>update("tone",e.target.value as Profile["tone"])}>
              <option value="natural">Natural y cercano</option>
              <option value="friendly">Amable y conversador</option>
              <option value="formal">Formal y conciso</option>
            </select>
          </label>
          <label className="rops-wide">Instrucciones adicionales del negocio
            <textarea value={profile.extra_instructions} rows={3}
              maxLength={2000} onChange={e=>update("extra_instructions",e.target.value)}
              placeholder="Ejemplo: preguntar primero si retira o necesita domicilio…"/>
          </label>
        </div>
        <p>No se pueden anular las validaciones de cobro, disponibilidad, confirmación del pedido ni seguridad alimentaria.</p>
      </section>
      <section className="rops-card">
        <div className="rops-row"><h2>4. Zonas de domicilio</h2>
          <a href="/panel/zonas">Gestionar tarifas y cobertura</a>
        </div>
        <p>Se muestran las zonas registradas; únicamente las verificadas y activas se ofrecen como domicilio.</p>
        <div className="rops-table-wrap"><table><thead><tr>
          <th>Zona</th><th>Tarifa</th><th>ETA estimado</th><th>Estado</th>
        </tr></thead><tbody>
          {zones.map(z=><tr key={z.id}>
            <td>{z.name}</td><td>{money(z.fee_cop)}</td>
            <td>{z.eta_minutes} min</td>
            <td><span className={"rops-pill "+(z.active?"rops-ok":"rops-warning")}>
              {z.active?"Activa":"Pendiente de verificar"}
            </span></td>
          </tr>)}
        </tbody></table></div>
        <div className="rops-form-grid">
          <label>Latitud exacta del restaurante
            <input type="number" step="any" min="-90" max="90" placeholder="Sin confirmar"
              value={profile.origin_lat??""}
              onChange={e=>update("origin_lat",e.target.value===""?null:Number(e.target.value))}/>
          </label>
          <label>Longitud exacta del restaurante
            <input type="number" step="any" min="-180" max="180" placeholder="Sin confirmar"
              value={profile.origin_lng??""}
              onChange={e=>update("origin_lng",e.target.value===""?null:Number(e.target.value))}/>
          </label>
          <label className="rops-check rops-wide">
            <input type="checkbox" checked={profile.origin_verified}
              onChange={e=>update("origin_verified",e.target.checked)}/>
            Confirmo que estas coordenadas son las del restaurante real
          </label>
        </div>
        <p>La distancia vial exige un servicio de mapas configurado en la VPS y polígonos de entrega verificados.</p>
        <div className="rops-mini-form">
          <h3>Comprobar dirección y repartidores disponibles</h3>
          <input style={{minWidth:"min(100%,390px)"}} value={testAddress} type="text"
            placeholder="Calle y número, barrio, Funza o Mosquera"
            aria-label="Dirección que se quiere comprobar"
            onChange={e=>setTestAddress(e.target.value)}/>
          <button type="button" disabled={quoteBusy||testAddress.trim().length<12}
            onClick={()=>void testDelivery()}>
            {quoteBusy?"Comprobando…":"Verificar ruta"}
          </button>
          {quote&&<p style={{width:"100%"}}>
            {quote.covered
              ?"Dirección verificada: "+quote.formattedAddress+
                ". Zona: "+quote.zone?.name+
                ". Domicilio: "+money(quote.zone?.feeCOP??0)+
                ". Distancia vial desde el restaurante: "+
                  ((quote.drivingDistanceMeters??0)/1000).toFixed(2)+" km"+
                ". Duración estimada en automóvil: "+quote.drivingDurationMinutes+
                " min. Repartidores disponibles: "+
                  (quote.suggestedCouriers?.map(c=>c.name+" ("+
                    (c.vehicle==="bike"?"bicicleta":"moto")+")").join(", ")||"ninguno")+
                ". La asignación requiere validación operativa."
              :"Domicilio no confirmado: "+(quote.reason??"sin detalles")+
                ". No se puede prometer cobertura ni asignar automáticamente."}
          </p>}
        </div>
      </section>
      <section className="rops-card">
        <div className="rops-row"><h2>5. Equipo de reparto</h2>
          <a href="/panel/reparto">Registrar o gestionar repartidores</a>
        </div>
        <div className="rops-settings-metrics">
          <div><b>{couriers.filter(c=>c.active&&c.vehicle==="bike").length}/2</b><span>Bicicletas registradas</span></div>
          <div><b>{couriers.filter(c=>c.active&&c.vehicle==="motorbike").length}/3</b><span>Motos registradas</span></div>
          <div><b>{couriers.filter(c=>c.active&&c.availability==="available").length}</b><span>Disponibles</span></div>
        </div>
        {couriers.length?<div className="rops-table-wrap"><table><thead><tr>
          <th>Nombre</th><th>Vehículo</th><th>Disponibilidad</th>
        </tr></thead><tbody>
          {couriers.map(c=><tr key={c.id}>
            <td>{c.name}</td><td>{c.vehicle==="bike"?"Bicicleta":"Moto"}</td>
            <td>{c.availability}</td>
          </tr>)}
        </tbody></table></div>:<p className="rops-empty">
          Todavía no hay perfiles verificables en la base de datos. La dotación esperada es de 2 bicicletas y 3 motos.
        </p>}
      </section>
      <section className="rops-card">
        <h2>6. Aprendizaje supervisado</h2>
        <p>El sistema reconoce preguntas frecuentes en las conversaciones y preferencias agregadas de compras finalizadas. Nada se incorpora al conocimiento del agente sin revisión y aprobación.</p>
        <label className="rops-check">
          <input type="checkbox" checked={profile.learning_enabled}
            onChange={e=>update("learning_enabled",e.target.checked)}/>
          Permitir analizar las conversaciones del restaurante para proponer preguntas frecuentes
        </label>
        <button type="submit" disabled={busy} className="rops-primary">
          {busy?"Guardando…":"Guardar toda la configuración"}
        </button>
      </section>
    </form>
    <section className="rops-card">
      <div className="rops-row"><h2>Preguntas sugeridas del historial</h2>
        <button disabled={busy||!profile.learning_enabled} onClick={()=>void analyze()}>
          Analizar conversaciones recientes
        </button>
      </div>
      <p>El análisis filtra información personal y genera borradores. Un encargado debe escribir o verificar cada respuesta.</p>
      {!lessons.length&&<p className="rops-empty">No hay sugerencias todavía.</p>}
      <div className="rops-cards">{lessons.map(l=><LearningCard item={l} key={l.id}
        onReviewed={async()=>{const x=await jsonRequest<{ok:true;lessons:Lesson[]}>("agent/learnings");setLessons(x.lessons);}}/>)}</div>
    </section>
    <section className="rops-card">
      <h2>Productos aprendidos de pedidos reales</h2>
      <p>Estadísticas anónimas de {samples} pedidos completados registrados en Restaurant OS. No se deducen preferencias de mensajes sin confirmar.</p>
      {!popular.length?<p className="rops-empty">Todavía no hay pedidos completados suficientes para mostrar favoritos.</p>:
        <div className="rops-table-wrap"><table><thead><tr>
          <th>Producto</th><th>Unidades vendidas</th><th>Pedidos</th>
        </tr></thead><tbody>
          {popular.map(p=><tr key={p.name}>
            <td>{p.name}</td><td>{p.quantity}</td><td>{p.orders}</td>
          </tr>)}
        </tbody></table></div>}
    </section>
  </main>;
}
