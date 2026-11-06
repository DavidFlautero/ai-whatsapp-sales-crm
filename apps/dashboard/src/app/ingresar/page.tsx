"use client";
import {useRouter} from "next/navigation";
import {useState, type FormEvent} from "react";
export default function RestaurantLogin(){
  const router=useRouter();const[email,setEmail]=useState("");const[password,setPassword]=useState("");
  const[error,setError]=useState("");const[busy,setBusy]=useState(false);
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError("");
    try{const r=await fetch("/api/restaurant-auth/login",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({email,password})});
      if(!r.ok){setError("Credenciales incorrectas o usuario sin acceso a Delibocados.");return;}
      router.replace("/panel");router.refresh();
    }catch{setError("No se pudo contactar al servicio de acceso.");}finally{setBusy(false);}}
  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#f6f7fa",fontFamily:"Arial,sans-serif"}}>
    <form onSubmit={submit} style={{maxWidth:420,width:"90%",background:"white",padding:35,borderRadius:18,boxShadow:"0 10px 40px #0001"}}>
      <div style={{fontSize:32,fontWeight:700,color:"#b98e53"}}>Delibocados</div><p>Acceso al panel del restaurante</p>
      <label htmlFor="email">Correo electrónico</label><input id="email" required type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} style={{display:"block",width:"100%",boxSizing:"border-box",padding:12,margin:"8px 0 18px"}}/>
      <label htmlFor="pwd">Contraseña</label><input id="pwd" required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} style={{display:"block",width:"100%",boxSizing:"border-box",padding:12,margin:"8px 0 18px"}}/>
      <button type="submit" disabled={busy} style={{width:"100%",padding:13,background:"#253640",color:"white",border:0,borderRadius:8,cursor:"pointer"}}>{busy?"Ingresando…":"Ingresar"}</button>
      {error?<p role="alert" style={{color:"#b91c1c"}}>{error}</p>:null}
    </form></main>;
}
