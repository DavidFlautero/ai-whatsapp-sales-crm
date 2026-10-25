"use client";

import { useEffect, useState, type FormEvent } from "react";
import css from "./OwnerWorkspace.module.css";

type R = Record<string, any>;
type Tab = "inicio" | "ficha" | "media" | "calendario" |
  "reservas" | "contratos" | "finanzas" | "incidencias";

type Workspace = {
  venue: R;
  images: R[];
  assets: R[];
  blocks: R[];
  inquiries: R[];
  contracts: R[];
  settlements: R[];
  incidents: R[];
};

const sections: { id: Tab; title: string }[] = [
  { id: "inicio", title: "Inicio" },
  { id: "ficha", title: "Ficha del chalet" },
  { id: "media", title: "Fotos y vídeos" },
  { id: "calendario", title: "Calendario" },
  { id: "reservas", title: "Reservas y solicitudes" },
  { id: "contratos", title: "Contratos" },
  { id: "finanzas", title: "Ingresos y liquidaciones" },
  { id: "incidencias", title: "Incidencias" },
];

const fields = [
  { id: "name", title: "Nombre de la propiedad" },
  { id: "description", title: "Descripción completa", long: true },
  { id: "province", title: "Provincia" },
  { id: "city", title: "Municipio" },
  { id: "address", title: "Dirección" },
  { id: "public_location", title: "Ubicación para mostrar al público" },
  { id: "capacity_min", title: "Capacidad mínima", numeric: true },
  { id: "capacity_max", title: "Capacidad máxima", numeric: true },
];

const s = (v: any) => v == null ? "" : String(v);
const enc = encodeURIComponent;

async function api(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    cache: "no-store",
  });

  if (response.status === 401) {
    window.location.replace("/propietarios/acceso");
    throw new Error("Sesión caducada.");
  }

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.ok === false) {
    const messages: Record<string, string> = {
      VENUE_DATE_CONFLICT: "Fecha ocupada o bloqueada.",
      BLOCK_CONFLICT_OR_UNAVAILABLE: "Conflicto de disponibilidad.",
      OWNER_BLOCK_NOT_FOUND: "No podés liberar ese bloqueo.",
      MEDIA_LIMIT_REACHED: "Alcanzaste el límite de archivos.",
      FIELD_NOT_EDITABLE: "Ese campo requiere autorización.",
    };

    throw new Error(
      messages[result.error] || result.error ||
      `Error HTTP ${response.status}`
    );
  }

  return result;
}

function madridDay(value: any) {
  const date = new Date(s(value));
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find(p => p.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function madridMidnight(day: string) {
  const base = new Date(`${day}T00:00:00Z`);
  const offset = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    timeZoneName: "shortOffset",
  }).formatToParts(base).find(
    p => p.type === "timeZoneName"
  )?.value;

  const match = offset?.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) throw new Error("Zona horaria no disponible.");

  const minutes = (
    (match[1] === "+" ? 1 : -1) *
    (Number(match[2]) * 60 + Number(match[3] ?? 0))
  );

  return new Date(base.getTime() - minutes * 60000).toISOString();
}

function displayDate(value: any) {
  if (!value) return "Sin fecha";
  const date = new Date(s(value));
  if (Number.isNaN(date.getTime())) return "Fecha inválida";

  return date.toLocaleDateString("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function PropietariosPage() {
  const [venues, setVenues] = useState<R[]>([]);
  const [selected, setSelected] = useState("");
  const [tab, setTab] = useState<Tab>("inicio");
  const [data, setData] = useState<Workspace | null>(null);
  const [form, setForm] = useState<R>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [videoProgress, setVideoProgress] = useState("");
  const [photoProgress, setPhotoProgress] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const [month, setMonth] = useState(() => {
    const today = new Date();
    return new Date(Date.UTC(
      today.getFullYear(), today.getMonth(), 1
    ));
  });
  const [day, setDay] = useState(() => new Date().getDate());
  const [incidentTitle, setIncidentTitle] = useState("");
  const [incidentDescription, setIncidentDescription] = useState("");

  const endpoint = `/api/owner/venues/${enc(selected)}`;


  // OWNER_UNIFIED_WORKSPACE_V2
  function goTo(section: Tab) {
    setTab(section);
    document.getElementById(`owner-${section}`)
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }

  function goToToday() {
    const now = madridDay(new Date().toISOString());

    setMonth(
      new Date(`${now.slice(0, 7)}-01T00:00:00Z`)
    );

    setDay(Number(now.slice(8)));
  }

  function reload() {
    setRevision(v => v + 1);
  }

  useEffect(() => {
    let active = true;

    void api("/api/owner/venues").then(result => {
      if (!active) return;
      const list = Array.isArray(result.venues) ? result.venues : [];
      setVenues(list);
      setSelected(s(list[0]?.id));
      if (!list.length) setLoading(false);
    }).catch(err => {
      if (active) {
        setError(err.message);
        setLoading(false);
      }
    });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    setLoading(true);

    void api(`${endpoint}/workspace`).then((result: Workspace) => {
      if (!active) return;
      setData(result);
      const initial: R = {};
      fields.forEach(f => initial[f.id] = s(result.venue[f.id]));
      setForm(initial);
    }).catch(err => {
      if (active) {
        setData(null);
        setError(err.message);
      }
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, [selected, revision]);

  async function perform(
    action: () => Promise<void>,
    success: string
  ) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");

    try {
      await action();
      setNotice(success);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de operación.");
    } finally {
      setBusy(false);
    }
  }

  const venue = data?.venue;
  const images = data?.images ?? [];
  const assets = data?.assets ?? [];
  const photos = assets.filter(x => x.kind === "image");
  const videos = assets.filter(x => x.kind === "video");
  const blocks = data?.blocks ?? [];
  const inquiries = data?.inquiries ?? [];
  const pending = inquiries.filter(x => x.status === "pending");
  const reserved = blocks.filter(x => x.status === "reserved");

  const cover = photos.find(x => x.is_cover) || photos[0];
  const legacyCover = images.find(x => x.role === "cover") || images[0];
  const coverUrl = s(
    cover?.url || legacyCover?.url || legacyCover?.public_url
  );

  const year = month.getUTCFullYear();
  const number = month.getUTCMonth();
  const total = new Date(Date.UTC(year, number + 1, 0)).getUTCDate();
  const leading = (new Date(Date.UTC(year, number, 1)).getUTCDay() + 6) % 7;

  function dateKey(n: number) {
    return `${year}-${String(number + 1).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
  }

  function blocksOn(n: number) {
    const start = Date.parse(madridMidnight(dateKey(n)));
    const next = new Date(Date.UTC(year, number, n + 1))
      .toISOString().slice(0, 10);
    const end = Date.parse(madridMidnight(next));

    return blocks.filter(b =>
      Date.parse(s(b.starts_at)) < end &&
      Date.parse(s(b.ends_at)) > start
    );
  }

  function changeMonth(delta: number) {
    setMonth(new Date(Date.UTC(year, number + delta, 1)));
    setDay(1);
  }

  function saveDetails(event: FormEvent) {
    event.preventDefault();

    void perform(async () => {
      const body: R = {};

      for (const f of fields) {
        const value = s(form[f.id]).trim();
        body[f.id] = f.numeric
          ? value === "" ? null : Number(value)
          : value || null;
      }

      await api(`${endpoint}/details`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }, "Ficha guardada correctamente.");
  }

  function blockDay() {
    if (!window.confirm(`¿Bloquear el ${dateKey(day)}?`)) return;

    void perform(async () => {
      const next = new Date(Date.UTC(year, number, day + 1))
        .toISOString().slice(0, 10);

      await api(`${endpoint}/blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startsAt: madridMidnight(dateKey(day)),
          endsAt: madridMidnight(next),
        }),
      });
    }, "Fecha bloqueada en el calendario del CRM.");
  }

  function release(id: string) {
    if (!window.confirm("¿Liberar este bloqueo propio?")) return;

    void perform(async () => {
      await api(`${endpoint}/blocks/${enc(id)}/cancel`, {
        method: "PATCH",
      });
    }, "Bloqueo liberado.");
  }


  // OWNER_MULTIVIDEO_30_V1
  async function uploadVideos(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);

    if (!files.length || busy) return;

    const maxVideos = 30;
    const maxBytes = 200 * 1024 * 1024;
    const remaining = maxVideos - videos.length;

    if (remaining <= 0 || files.length > remaining) {
      setError(
        `Este chalet admite ${maxVideos} vídeos. ` +
        `Actualmente tiene ${videos.length}. ` +
        `Podés agregar ${Math.max(0, remaining)} más.`
      );
      setNotice("");
      return;
    }

    const invalid = files.find(file =>
      !/\.(mp4|webm|mov)$/i.test(file.name) ||
      file.size === 0 ||
      file.size > maxBytes
    );

    if (invalid) {
      setError(
        `Archivo no válido: ${invalid.name}. ` +
        "Usá MP4, WebM o MOV, hasta 200 MB por vídeo."
      );
      setNotice("");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    let completed = 0;
    let failure = "";

    try {
      for (const file of files) {
        setVideoProgress(
          `Subiendo vídeo ${completed + 1} de ${files.length}: ` +
          file.name
        );

        const body = new FormData();
        body.append("file", file);

        try {
          await api(`${endpoint}/assets`, {
            method: "POST",
            body,
          });

          completed++;
        } catch (err) {
          failure =
            `${file.name}: ` +
            (err instanceof Error
              ? err.message
              : "Error de subida");
          break;
        }
      }

      if (completed > 0) {
        setNotice(
          `${completed} de ${files.length} vídeos subidos ` +
          "correctamente."
        );
        reload();
      }

      if (failure) {
        setError(
          `La subida se detuvo. ${failure}. ` +
          `Se guardaron ${completed} vídeos.`
        );
      }
    } finally {
      setBusy(false);
      setVideoProgress("");
    }
  }


  // OWNER_HEIC_AUTOCONVERT_V1
  async function uploadFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);

    if (!files.length || busy) return;

    setBusy(true);
    setError("");
    setNotice("");

    let completed = 0;
    const failures: string[] = [];

    try {
      for (let index = 0; index < files.length; index++) {
        const file = files[index];

        setPhotoProgress(
          `Procesando fotografía ${index + 1} de ${files.length}: ` +
          file.name
        );

        try {
          let uploadFile = file;

          const isHeic =
            /\.(heic|heif)$/i.test(file.name) ||
            /image\/hei[cf]/i.test(file.type);


          if (isHeic) {
            // El servidor convierte el HEIC original a JPEG.
            setPhotoProgress(
              `Enviando HEIC ${index + 1} de ${files.length}: ` +
              file.name
            );
          }

          if (
            uploadFile.size === 0 ||
            uploadFile.size > 40 * 1024 * 1024
          ) {
            throw new Error(
              "La imagen supera el límite de 40 MB."
            );
          }

          setPhotoProgress(
            `Subiendo fotografía ${index + 1} de ${files.length}: ` +
            uploadFile.name
          );

          const body = new FormData();
          body.append("file", uploadFile);

          await api(`${endpoint}/assets`, {
            method: "POST",
            body,
          });

          completed++;
        } catch (err) {
          failures.push(
            `${file.name}: ${
              err instanceof Error
                ? err.message
                : "Error desconocido"
            }`
          );
        }
      }

      if (completed > 0) {
        setNotice(
          `${completed} de ${files.length} fotografías subidas.`
        );

        reload();
      }

      if (failures.length > 0) {
        setError(
          `No se pudieron subir ${failures.length} fotografías: ` +
          failures.slice(0, 3).join(" | ")
        );
      }
    } finally {
      setBusy(false);
      setPhotoProgress("");
    }
  }

  function removeAsset(id: string) {
    if (!window.confirm("¿Eliminar este archivo?")) return;

    void perform(async () => {
      await api(`${endpoint}/assets/${enc(id)}`, {
        method: "DELETE",
      });
    }, "Archivo eliminado.");
  }

  function setCover(id: string) {
    void perform(async () => {
      await api(`${endpoint}/assets/${enc(id)}/cover`, {
        method: "PATCH",
      });
    }, "Portada actualizada.");
  }

  function answerInquiry(id: string, status: string) {
    const notes = window.prompt("Observaciones (opcional):", "");
    if (notes === null) return;

    void perform(async () => {
      await api(`${endpoint}/inquiries/${enc(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes }),
      });
    }, "Respuesta guardada en el CRM.");
  }

  function saveIncident(event: FormEvent) {
    event.preventDefault();

    void perform(async () => {
      await api(`${endpoint}/incidents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: incidentTitle,
          description: incidentDescription,
        }),
      });
      setIncidentTitle("");
      setIncidentDescription("");
    }, "Incidencia registrada.");
  }

  async function logout() {
    try {
      await api("/api/owner/auth/logout", { method: "POST" });
      window.location.replace("/propietarios/acceso");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de cierre de sesión.");
    }
  }

  const chosen = blocksOn(day);

  return (
    <main className={css.app}>
      <aside className={css.sidebar}>
        <div className={css.brand}>
          <span className={css.brandMark}>EM</span>
          <div>
            <strong>Eventos Mediterráneo</strong>
            <small>Portal de propietarios</small>
          </div>
        </div>

        <div className={css.propertyPicker}>
          <label htmlFor="selectedVenue">PROPIEDAD</label>
          <select
            id="selectedVenue"
            value={selected}
            onChange={e => {
              setSelected(e.target.value);
              setData(null);
              setTab("inicio");
            }}
          >
            {venues.map(v => (
              <option key={s(v.id)} value={s(v.id)}>
                {s(v.name)}
              </option>
            ))}
          </select>
        </div>

        <nav className={css.navigation}>
          {sections.map(section => (
            <button
              key={section.id}
              type="button"
              className={tab === section.id ? css.active : ""}
              onClick={() => {
                goTo(section.id);
                setError("");
                setNotice("");
              }}
            >
              {section.title}
              {section.id === "reservas" && pending.length > 0 && (
                <span className={css.count}>{pending.length}</span>
              )}
            </button>
          ))}
        </nav>

        <button className={css.logout} onClick={logout}>
          Cerrar sesión
        </button>
      </aside>

      <div className={css.main}>
        <header className={css.topbar}>
          <div>
            
            <div className={css.topLinks}>
              <button
                type="button"
                onClick={() => window.history.back()}
              >
                ← Volver
              </button>

              <button
                type="button"
                onClick={() => goTo("inicio")}
              >
                ↑ Ir al inicio
              </button>
            </div>

            <p className={css.eyebrow}>ÁREA PRIVADA</p>
            <h1>Centro de gestión de propiedades</h1>
            <p className={css.muted}>{s(venue?.name)}</p>
          </div>
          <span className={css.topStatus}>
            {venue?.status === "published" ? "Publicado" : "En revisión"}
          </span>
        </header>

        <div className={css.content}>
          {error && <div className={css.error} role="alert">{error}</div>}
          {notice && <div className={css.success} role="status">{notice}</div>}
          {loading && <p>Cargando datos...</p>}

          {!loading && venues.length === 0 && !error && (
            <section className={css.panel}>
              No hay chalets asociados a esta cuenta.
            </section>
          )}

          {!loading && data && (
            <div className={css.dashboardGrid}>
              {(
                <div id="owner-inicio" className={[css.stack, css.ownerSection, css.overview].join(" ")}>
                  <section className={css.hero}>
                    {coverUrl ? (
                      <img className={css.heroPhoto} src={coverUrl}
                        alt="Portada del chalet" />
                    ) : (
                      <div className={css.heroEmpty}>
                        <span>EVENTOS MEDITERRÁNEO</span>
                        <strong>Presentá tu propiedad al mundo.</strong>
                        <button onClick={() => goTo("media")}>
                          Añadir fotografías
                        </button>
                      </div>
                    )}
                    <div className={css.heroCaption}>
                      <h2>{s(venue?.name)}</h2>
                      <p>{s(venue?.city)}, {s(venue?.province)}</p>
                    </div>
                  </section>

                  <div className={css.stats}>
                    {[
                      ["Reservas en calendario", reserved.length],
                      ["Consultas pendientes", pending.length],
                      ["Fotografías", photos.length + images.length],
                      ["Capacidad máxima", venue?.capacity_max ?? "—"],
                    ].map(([title, value]) => (
                      <div className={css.stat} key={s(title)}>
                        <span>{title}</span><strong>{value}</strong>
                      </div>
                    ))}
                  </div>

                  
                </div>
              )}

              {(
                <section id="owner-ficha" className={[css.panel, css.ownerSection, css.details].join(" ")}>
                  <h2>Información del chalet</h2>
                  <p className={css.muted}>
                    Los cambios se guardan en la ficha existente del CRM.
                  </p>
                  <form className={css.form} onSubmit={saveDetails}>
                    {fields.map(f => (
                      <label className={css.field} key={f.id}>
                        <span>{f.title}</span>
                        {f.long ? (
                          <textarea
                            rows={6}
                            value={s(form[f.id])}
                            onChange={e => setForm({
                              ...form, [f.id]: e.target.value
                            })}
                          />
                        ) : (
                          <input
                            type={f.numeric ? "number" : "text"}
                            min={f.numeric ? 0 : undefined}
                            required={f.id === "name"}
                            value={s(form[f.id])}
                            onChange={e => setForm({
                              ...form, [f.id]: e.target.value
                            })}
                          />
                        )}
                      </label>
                    ))}
                    <div className={css.actions}>
                      <button className={css.primary} disabled={busy}>
                        Guardar ficha
                      </button>
                    </div>
                  </form>
                </section>
              )}

              {(
                <div id="owner-media" className={[css.stack, css.ownerSection, css.media].join(" ")}>
                  <section className={css.panel}>
                    <h2>Fotografías</h2>
                    {photoProgress && (
                      <p className={css.muted} role="status">
                        {photoProgress}
                      </p>
                    )}
                    <p className={css.muted}>
                      JPG, PNG, WebP y HEIC de iPhone. Conversión HEIC a JPG en el servidor. Máximo 40 MB por imagen.
                    </p>
                    <label className={css.upload}>
                      <strong>+ Subir fotografías</strong>
                      <span>Elegí las fotos de tu chalet</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                        multiple
                        disabled={busy}
                        onChange={e => {
                          void uploadFiles(e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </label>

                    <div className={css.gallery}>
                      {photos.map(a => (
                        <div className={css.mediaCard} key={s(a.id)}>
                          <img src={s(a.url)} alt="Foto de la propiedad" />
                          <div className={css.mediaActions}>
                            <button disabled={busy} onClick={() => setCover(s(a.id))}>
                              {a.is_cover ? "Portada" : "Elegir portada"}
                            </button>
                            <button disabled={busy} onClick={() => removeAsset(s(a.id))}>
                              Eliminar
                            </button>
                          </div>
                        </div>
                      ))}
                      {images.map(a => {
                        const url = s(a.url || a.public_url);
                        return url ? (
                          <div className={css.mediaCard} key={s(a.id)}>
                            <img src={url} alt="Imagen existente" />
                            <p>Imagen existente del CRM</p>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </section>

                  <section className={css.panel}>
                    <h2>Vídeos</h2>
                    <p className={css.muted}>
                      {videos.length} de 30 vídeos cargados.
                    </p>
                    {videoProgress && (
                      <p className={css.muted} role="status">
                        {videoProgress}
                      </p>
                    )}
                    <p className={css.muted}>
                      MP4, WebM o MOV. Hasta 200 MB por archivo. Máximo 30 vídeos por chalet.
                    </p>
                    <label className={css.upload}>
                      <strong>+ Subir vídeo</strong>
                      <input
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime"
                        multiple
                        disabled={busy || videos.length >= 30}
                        onChange={e => {
                          void uploadVideos(e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </label>

                    <div className={css.gallery}>
                      {videos.map(v => (
                        <div className={css.mediaCard} key={s(v.id)}>
                          <video controls preload="metadata" src={s(v.url)} />
                          <button disabled={busy} onClick={() => removeAsset(s(v.id))}>
                            Eliminar vídeo
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              )}

              {(
                <section id="owner-calendario" className={[css.panel, css.ownerSection, css.calendarArea].join(" ")}>
                  <h2>Disponibilidad del chalet</h2>
                  <p className={css.muted}>
                    Sin bloqueos no significa disponibilidad confirmada.
                  </p>
                  <div className={css.monthNav}>
                    
                    <div className={css.monthButtons}>
                      <button
                        type="button"
                        onClick={() => changeMonth(-1)}
                      >
                        ← Anterior
                      </button>

                      <button
                        type="button"
                        onClick={goToToday}
                      >
                        Hoy
                      </button>
                    </div>
                    <strong>
                      {month.toLocaleDateString("es-ES", {
                        timeZone: "UTC", month: "long", year: "numeric"
                      })}
                    </strong>
                    <button onClick={() => changeMonth(1)}>Siguiente</button>
                  </div>
                  <div className={css.calendar}>
                    {["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map(w => (
                      <span className={css.weekday} key={w}>{w}</span>
                    ))}
                    {Array.from({ length: leading + total }, (_, i) => {
                      const n = i - leading + 1;
                      if (n < 1) return <span className={css.emptyDay} key={i} />;

                      const entries = blocksOn(n);
                      const state = entries.some(b => b.status === "reserved")
                        ? "reserved"
                        : entries.some(b => b.status === "held")
                          ? "held"
                          : entries.length ? "blocked" : "";

                      return (
                        <button
                          key={i}
                          className={[
                            css.calendarDay,
                            day === n ? css.selectedDay : "",
                            state ? css[state] : "",
                          ].join(" ")}
                          onClick={() => setDay(n)}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                  <div className={css.legend}>
                    <span>Sin confirmar</span>
                    <span>Bloqueado</span>
                    <span>Pendiente</span>
                    <span>Reservado</span>
                  </div>
                  <div className={css.dayDetails}>
                    <div>
                      <h3>{displayDate(madridMidnight(dateKey(day)))}</h3>
                      {chosen.length === 0 && (
                        <p>No hay bloqueos para este día.</p>
                      )}
                      {chosen.map(b => (
                        <div className={css.booking} key={s(b.id)}>
                          <strong>{s(b.status)}</strong>
                          {b.status === "blocked" &&
                            s(b.notes).startsWith("OWNER_PORTAL:") && (
                            <button disabled={busy}
                              onClick={() => release(s(b.id))}>
                              Liberar bloqueo propio
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {chosen.length === 0 && (
                      <button className={css.primary} disabled={busy}
                        onClick={blockDay}>
                        Bloquear fecha
                      </button>
                    )}
                  </div>
                </section>
              )}

              {(
                <div id="owner-reservas" className={[css.stack, css.ownerSection, css.bookings].join(" ")}>
                  <section className={css.panel}>
                    <h2>Solicitudes de disponibilidad</h2>
                    {inquiries.length === 0 && (
                      <p className={css.empty}>No hay solicitudes.</p>
                    )}
                    {inquiries.map(i => (
                      <article className={css.listCard} key={s(i.id)}>
                        <div>
                          <strong>{displayDate(i.starts_at)} — {displayDate(i.ends_at)}</strong>
                          <p>Estado: {s(i.status)}</p>
                          {i.owner_notes && <p>{s(i.owner_notes)}</p>}
                        </div>
                        {i.status === "pending" && (
                          <div className={css.inlineActions}>
                            <button onClick={() => answerInquiry(s(i.id), "available")}>
                              Disponible
                            </button>
                            <button onClick={() => answerInquiry(s(i.id), "conditional")}>
                              Con condiciones
                            </button>
                            <button onClick={() => answerInquiry(s(i.id), "unavailable")}>
                              No disponible
                            </button>
                          </div>
                        )}
                      </article>
                    ))}
                  </section>
                  <section className={css.panel}>
                    <h2>Reservas confirmadas</h2>
                    {reserved.length === 0 && (
                      <p className={css.empty}>Sin reservas en el período consultado.</p>
                    )}
                    {reserved.map(b => (
                      <article className={css.listCard} key={s(b.id)}>
                        <strong>{displayDate(b.starts_at)} — {displayDate(b.ends_at)}</strong>
                        <span className={css.status}>Confirmada</span>
                      </article>
                    ))}
                  </section>
                </div>
              )}

              {(
                <section id="owner-contratos" className={[css.panel, css.ownerSection, css.contracts].join(" ")}>
                  <h2>Contratos y acuerdos</h2>
                  <p className={css.muted}>
                    Documentos registrados por Eventos Mediterráneo.
                  </p>
                  {(data.contracts ?? []).length === 0 && (
                    <p className={css.empty}>Todavía no hay contratos registrados.</p>
                  )}
                  {data.contracts.map(c => (
                    <article className={css.listCard} key={s(c.id)}>
                      <div>
                        <strong>{s(c.title)}</strong>
                        <p>Estado: {s(c.status)}</p>
                        {c.terms && <p>{s(c.terms)}</p>}
                      </div>
                      {typeof c.document_url === "string" &&
                        c.document_url.startsWith("https://") && (
                        <a href={c.document_url} target="_blank"
                          rel="noopener noreferrer">
                          Ver contrato
                        </a>
                      )}
                    </article>
                  ))}
                </section>
              )}

              {(
                <section id="owner-finanzas" className={[css.panel, css.ownerSection, css.finances].join(" ")}>
                  <h2>Ingresos y liquidaciones</h2>
                  {data.settlements.length === 0 && (
                    <p className={css.empty}>Sin liquidaciones registradas.</p>
                  )}
                  <div className={css.tableScroll}>
                    <table className={css.table}>
                      <thead>
                        <tr>
                          <th>Período</th><th>Bruto</th><th>Comisión</th>
                          <th>Neto</th><th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.settlements.map(x => (
                          <tr key={s(x.id)}>
                            <td>{s(x.period_label)}</td>
                            <td>{s(x.gross_amount)} {s(x.currency)}</td>
                            <td>{s(x.commission_amount)} {s(x.currency)}</td>
                            <td>{s(x.net_amount)} {s(x.currency)}</td>
                            <td>{s(x.status)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {(
                <div id="owner-incidencias" className={[css.stack, css.ownerSection, css.incidents].join(" ")}>
                  <section className={css.panel}>
                    <h2>Informar un problema</h2>
                    <form className={css.form} onSubmit={saveIncident}>
                      <label className={css.field}>
                        <span>Asunto</span>
                        <input required minLength={4} maxLength={160}
                          value={incidentTitle}
                          onChange={e => setIncidentTitle(e.target.value)} />
                      </label>
                      <label className={css.field}>
                        <span>Descripción</span>
                        <textarea required minLength={10} maxLength={4000}
                          value={incidentDescription}
                          onChange={e => setIncidentDescription(e.target.value)} />
                      </label>
                      <div className={css.actions}>
                        <button className={css.primary} disabled={busy}>
                          Registrar incidencia
                        </button>
                      </div>
                    </form>
                  </section>
                  <section className={css.panel}>
                    <h2>Historial</h2>
                    {data.incidents.length === 0 && (
                      <p className={css.empty}>Sin incidencias registradas.</p>
                    )}
                    {data.incidents.map(i => (
                      <article className={css.listCard} key={s(i.id)}>
                        <div>
                          <strong>{s(i.title)}</strong>
                          <p>{s(i.description)}</p>
                          <small>{displayDate(i.created_at)}</small>
                        </div>
                        <span className={css.status}>{s(i.status)}</span>
                      </article>
                    ))}
                  </section>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
