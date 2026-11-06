"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import styles from "./native-menu.module.css";

type Category = { name: string; label?: string; [key: string]: unknown };
type Product = {
  id: string;
  name: string;
  category: string;
  description?: string;
  priceCOP: number;
  priceText?: string;
  priceNeedsReview?: boolean;
  imageId?: string | number | null;
  available?: boolean;
  [key: string]: unknown;
};
type Catalog = {
  categories: Category[];
  products: Product[];
  images: Record<string, string>;
  [key: string]: unknown;
};
type ApiDoc = { revision: number; payload: Catalog; error?: string };

const PUBLIC = "https://delibocados.online";
const price = (value: number) => new Intl.NumberFormat("es-CO", {
  style: "currency", currency: "COP", maximumFractionDigits: 0,
}).format(value || 0);

function imageSrc(value?: string): string {
  if (!value) return "";
  if (value.startsWith("data:image/png;base64,") || value.startsWith("data:image/jpeg;base64,") ||
      value.startsWith("data:image/webp;base64,")) return value;
  if (/^\/restaurant-menu-media\/[a-f0-9]{32}\.(?:png|jpg|webp)$/.test(value)) return PUBLIC + value;
  return "";
}

async function jsonRequest(url: string, options?: RequestInit) {
  const res = await fetch(url, { credentials: "same-origin", cache: "no-store", ...options });
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

export default function NativeMenuEditor() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [revision, setRevision] = useState<number | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await jsonRequest("/panel/menu/api") as ApiDoc;
      const payload = result.payload;
      if (!payload || !Array.isArray(payload.products) || !Array.isArray(payload.categories) ||
          !payload.images || typeof payload.images !== "object") {
        throw new Error("El servidor devolvió un catálogo incompatible. No se modificó nada.");
      }
      setCatalog(payload);
      setRevision(Number(result.revision));
      setSelected(payload.products[0]?.id || "");
      setDirty(false);
      setNotice(`${payload.products.length} productos y ${payload.categories.length} secciones cargados desde PostgreSQL.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el menú");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);
  useEffect(() => { return () => { if (filePreview.startsWith("blob:")) URL.revokeObjectURL(filePreview); }; }, [filePreview]);

  const product = useMemo(() => catalog?.products.find(p => p.id === selected), [catalog, selected]);
  const visibleProducts = useMemo(() => (catalog?.products ?? []).filter(p =>
    (!filter || p.category === filter) &&
    (`${p.name} ${p.description ?? ""}`.toLocaleLowerCase("es-CO")
      .includes(search.toLocaleLowerCase("es-CO").trim()))), [catalog, filter, search]);

  function updateProduct(patch: Partial<Product>) {
    setCatalog(prev => prev ? ({ ...prev,
      products: prev.products.map(p => p.id === selected ? { ...p, ...patch } : p),
    }) : prev);
    setDirty(true); setError("");
  }

  function newProduct() {
    if (!catalog?.categories.length) { setError("Primero creá una sección."); return; }
    const id = "manual-" + crypto.randomUUID().replaceAll("-", "");
    const p: Product = { id, category: filter || catalog.categories[0].name,
      name: "Nuevo producto", description: "", priceCOP: 0, priceText: "$0",
      priceNeedsReview: true, imageId: null, available: false };
    setCatalog({ ...catalog, products: [...catalog.products, p] });
    setSelected(id); setFile(null); setFilePreview("");setDirty(true);
    setNotice("Producto creado en el borrador. Completá sus datos antes de publicar.");
  }

  function removeProduct() {
    if (!catalog || !product) return;
    if (!window.confirm(`¿Eliminar «${product.name}» del catálogo? La acción se hará efectiva al publicar.`)) return;
    const remaining = catalog.products.filter(p => p.id !== selected);
    setCatalog({ ...catalog, products: remaining });
    setSelected(remaining[0]?.id || ""); setDirty(true);
    setNotice("Producto quitado del borrador. Publicá para aplicar.");
  }

  function addCategory() {
    if (!catalog || catalog.categories.length >= 40) return;
    const label = window.prompt("Nombre de la nueva sección:")?.trim();
    if (!label) return;
    const name = label.toLocaleUpperCase("es-CO");
    if (catalog.categories.some(c => c.name === name)) { setError("Esa sección ya existe."); return; }
    setCatalog({ ...catalog, categories: [...catalog.categories, { name, label }] });
    setFilter(name); setDirty(true); setError("");
  }

  function renameCategory(index: number) {
    if (!catalog) return;
    const oldName = catalog.categories[index]?.name;
    if (!oldName) return;
    const label = window.prompt("Nuevo nombre de la sección:", catalog.categories[index].label || oldName)?.trim();
    if (!label) return;
    const name = label.toLocaleUpperCase("es-CO");
    if (catalog.categories.some((c, i) => i !== index && c.name === name)) { setError("Nombre de sección duplicado."); return; }
    setCatalog({ ...catalog,
      categories: catalog.categories.map((c, i) => i === index ? { ...c, name, label } : c),
      products: catalog.products.map(p => p.category === oldName ? { ...p, category: name } : p),
    });
    if (filter === oldName) setFilter(name);
    setDirty(true);setError("");
  }

  function moveCategory(index: number, direction: number) {
    if (!catalog) return;
    const j = index + direction;
    if (j < 0 || j >= catalog.categories.length) return;
    const cats = [...catalog.categories];
    [cats[index], cats[j]] = [cats[j], cats[index]];
    setCatalog({ ...catalog, categories: cats }); setDirty(true);
  }

  function removeCategory(index: number) {
    if (!catalog || catalog.categories.length < 2) return;
    const name = catalog.categories[index].name;
    if (catalog.products.some(p => p.category === name)) {
      setError("Mové los productos de esta sección antes de eliminarla."); return;
    }
    if (!window.confirm(`¿Eliminar la sección «${name}» del borrador?`)) return;
    setCatalog({ ...catalog, categories: catalog.categories.filter((_, i) => i !== index) });
    if (filter === name) setFilter("");
    setDirty(true);setError("");
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0] || null;
    if (!chosen) return;
    if (chosen.size > 2 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(chosen.type)) {
      setError("La imagen debe ser JPG, PNG o WebP, de hasta 2 MB.");return;
    }
    setFile(chosen);setFilePreview(URL.createObjectURL(chosen));setError("");
  }

  async function uploadImage() {
    if (!file || !catalog || !product) return;
    setBusy(true);setError("");
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
        reader.readAsDataURL(file);
      });
      const up = await jsonRequest("/panel/menu/upload", { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: dataUrl }) });
      setCatalog(prev => prev ? ({ ...prev,
        products: prev.products.map(p => p.id === selected ? { ...p, imageId: up.id } : p),
        images: { ...prev.images, [String(up.id)]: up.url },
      }) : prev);
      setDirty(true);setFile(null);setFilePreview("");
      setNotice("Foto subida al almacenamiento del menú. Publicá para asociarla al producto.");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo subir la imagen"); }
    finally { setBusy(false); }
  }

  async function publish() {
    if (!catalog || revision === null || busy || !dirty) return;
    if (catalog.categories.length < 1 || catalog.categories.length > 40 || catalog.products.length > 1200) {
      setError("El número de productos o secciones supera los límites del editor."); return;
    }
    if (catalog.products.some(p => !p.name.trim() || !catalog.categories.some(c => c.name === p.category) ||
        !Number.isInteger(p.priceCOP) || p.priceCOP < 0 || p.priceCOP > 999_999_999)) {
      setError("Revisá nombres, secciones y precios. No se publicó nada.");return;
    }
    setBusy(true);setError("");
    try {
      const result = await jsonRequest("/panel/menu/api", { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision, payload: catalog }) });
      setRevision(Number(result.revision));
      setDirty(false);
      setNotice("Menú guardado en PostgreSQL y carta pública publicada correctamente.");
    } catch (e) {
      setError((e instanceof Error ? e.message : "Fallo al publicar") + ". Los cambios siguen en el borrador; no recargues la página.");
    } finally {setBusy(false);}
  }

  return <section className={styles.wrapper}>
    <div className={styles.heading}>
      <div><div className={styles.kicker}>DELIBOCADOS / RESTAURANTE</div>
        <h1>Menú digital</h1><p>Administrá productos, categorías, precios, fotografías y disponibilidad en el mismo catálogo que publica la carta.</p></div>
      <div className={styles.actions}>
        <a className={styles.secondary} href={`${PUBLIC}/menu`} target="_blank" rel="noopener noreferrer">Ver carta pública</a>
        <Link className={styles.secondary} href="/panel/qr">QR y mesas</Link>
        <button className={styles.primary} type="button" onClick={() => void publish()} disabled={!dirty || busy || loading}> {busy ? "Procesando…" : dirty ? "Publicar cambios" : "Sin cambios"}</button>
      </div>
    </div>
    {loading && <div className={styles.notice}>Cargando catálogo real del restaurante…</div>}
    {notice && !error && <div className={styles.notice} role="status">{notice}{dirty ? " · Hay cambios sin publicar." : ""}</div>}
    {error && <div className={styles.error} role="alert">{error}</div>}
    {!loading && !catalog && <button className={styles.secondary} onClick={() => void load()}>Reintentar</button>}
    {catalog && <>
      <div className={styles.summary}>
        <div><strong>{catalog.products.length}</strong><span>Productos</span></div>
        <div><strong>{catalog.categories.length}</strong><span>Secciones</span></div>
        <div><strong>{catalog.products.filter(p => p.available !== false).length}</strong><span>Visibles</span></div>
        <div><strong>{catalog.products.filter(p => p.available === false).length}</strong><span>Ocultos</span></div>
      </div>
      <div className={styles.columns}>
        <div className={styles.card}>
          <div className={styles.cardTitle}><h2>Catálogo</h2><button className={styles.primarySmall} type="button" onClick={newProduct}>+ Producto</button></div>
          <div className={styles.filters}><input aria-label="Buscar producto" type="search" placeholder="Buscar productos…" value={search} onChange={e => setSearch(e.target.value)}/>
            <select aria-label="Filtrar por sección" value={filter} onChange={e => setFilter(e.target.value)}><option value="">Todas las secciones</option>{catalog.categories.map(c => <option key={c.name} value={c.name}>{c.label || c.name}</option>)}</select></div>
          <div className={styles.scrollList}>{visibleProducts.map(p => <button type="button" key={p.id} className={`${styles.productRow} ${p.id === selected ? styles.active : ""}`} onClick={() => {setSelected(p.id);setFile(null);setFilePreview("");}}>
            {imageSrc(catalog.images[String(p.imageId ?? "")]) ? <img src={imageSrc(catalog.images[String(p.imageId ?? "")])} alt=""/> : <span className={styles.noPhoto}>Foto</span>}
            <span className={styles.productMeta}><strong>{p.name}</strong><small>{p.category} · {price(Number(p.priceCOP))}</small></span>
            <span className={p.available === false ? styles.hiddenBadge : styles.visibleBadge}>{p.available === false ? "Oculto" : "Visible"}</span>
          </button>)}</div>
          {visibleProducts.length === 0 && <p className={styles.muted}>No hay productos para este filtro.</p>}
        </div>
        <div className={styles.card}>
          <h2>{product ? "Editar producto" : "Seleccioná un producto"}</h2>
          {product && <form className={styles.form} onSubmit={e => {e.preventDefault();setNotice("Cambios aplicados al borrador. Pulsá Publicar cambios.");}}>
            <label>Nombre<input required maxLength={120} value={product.name} onChange={e => updateProduct({name:e.target.value})}/></label>
            <label>Sección<select value={product.category} onChange={e => updateProduct({category:e.target.value})}>{catalog.categories.map(c => <option key={c.name} value={c.name}>{c.label || c.name}</option>)}</select></label>
            <label>Descripción<textarea rows={4} maxLength={2000} value={product.description || ""} onChange={e => updateProduct({description:e.target.value})}/></label>
            <div className={styles.split}><label>Precio (COP)<input type="number" min={0} max={999999999} step={1} value={product.priceCOP} onChange={e => {const n = Number(e.target.value);if(Number.isInteger(n)){updateProduct({priceCOP:n,priceText:price(n),priceNeedsReview:false});}}}/></label>
              <label className={styles.checkbox}><input type="checkbox" checked={product.available !== false} onChange={e => updateProduct({available:e.target.checked})}/> Visible en la carta</label></div>
            <label>Fotografía</label>
            <div className={styles.photoArea}>
              {filePreview || imageSrc(catalog.images[String(product.imageId ?? "")]) ? <img src={filePreview || imageSrc(catalog.images[String(product.imageId ?? "")])} alt={`Foto de ${product.name}`}/> : <span>Sin fotografía</span>}
              <div><input aria-label="Elegir fotografía" type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseFile}/><p className={styles.muted}>Vista previa antes de subir. JPG, PNG o WebP · hasta 2 MB.</p>
                {file && <button className={styles.secondary} type="button" disabled={busy} onClick={() => void uploadImage()}>Confirmar y subir fotografía</button>}</div>
            </div>
            <div className={styles.formActions}><button type="submit" className={styles.secondary}>Aplicar al borrador</button><button type="button" className={styles.danger} onClick={removeProduct}>Eliminar producto</button></div>
          </form>}
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.cardTitle}><h2>Secciones y orden de la carta</h2><button className={styles.secondary} type="button" onClick={addCategory}>+ Nueva sección</button></div>
        <div className={styles.categories}>{catalog.categories.map((c, i) => <div key={c.name} className={styles.category}>
          <strong>{c.label || c.name}</strong><small>{catalog.products.filter(p => p.category === c.name).length} productos</small>
          <div className={styles.categoryActions}>
            <button type="button" title="Subir" disabled={i===0} onClick={() => moveCategory(i,-1)}>↑</button>
            <button type="button" title="Bajar" disabled={i===catalog.categories.length-1} onClick={() => moveCategory(i,1)}>↓</button>
            <button type="button" onClick={() => renameCategory(i)}>Renombrar</button>
            <button type="button" title="Eliminar sección vacía" onClick={() => removeCategory(i)}>×</button>
          </div>
        </div>)}</div>
      </div>
      <div className={styles.footer}><span>Guardado con control de revisión. Solo Delibocados. Los cambios no afectan a Fulanitas ni a Eventos Mediterráneo.</span>
        <button className={styles.primary} type="button" disabled={!dirty || busy} onClick={() => void publish()}>{dirty ? "Publicar cambios" : "Menú actualizado"}</button></div>
    </>}
  </section>;
}
