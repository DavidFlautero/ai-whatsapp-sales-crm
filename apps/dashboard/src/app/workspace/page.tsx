"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type User = { name:string; email:string; companyId:string|null; role:string };

export default function WorkspacePage(){
  const router=useRouter();
  const [user,setUser]=useState<User|null>(null);
  const [error,setError]=useState("");
  useEffect(()=>{
    let active=true;
    fetch("/api/auth/session",{credentials:"include",cache:"no-store"})
      .then(async r=>{if(!r.ok)throw new Error("AUTH");const data=await r.json();return data.user as User;})
      .then(data=>{if(!data?.companyId){router.replace("/login");return;}if(active)setUser(data);})
      .catch(()=>{if(active){setError("No hay sesión válida.");router.replace("/login");}});
    return ()=>{active=false;};
  },[router]);
  async function logout(){
    await fetch("/api/auth/logout",{method:"POST",credentials:"include"}).catch(()=>undefined);
    router.replace("/login");
  }
  return <main style={{maxWidth:920,margin:"40px auto",padding:24,fontFamily:"system-ui"}}>
    <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
      <strong>Panel empresarial</strong>
      <button type="button" onClick={logout}>Cerrar sesión</button>
    </header>
    {error?<p role="alert">{error}</p>:null}
    {!user?<p>Validando acceso…</p>:<>
      <h1>Bienvenido, {user.name}</h1>
      <p>Empresa asignada: <strong>{user.companyId}</strong></p>
      <p>Sesión individual verificada. Los módulos del restaurante se habilitan después de vincular el menú, WhatsApp y el sistema de pedidos.</p>
      <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:16,marginTop:28}}>
        {["Menú y códigos QR","Pedidos y POS","WhatsApp IA","Integraciones"].map(label=>
          <article key={label} style={{border:"1px solid #aaa5",padding:20,borderRadius:12}}>
            <h2 style={{fontSize:18}}>{label}</h2><p>Configuración pendiente</p>
          </article>
        )}
      </section>
      <p style={{marginTop:26}}><Link href="/login">Cambiar de cuenta</Link></p>
    </>}
  </main>;
}
