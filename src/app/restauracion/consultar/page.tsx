"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

/** =======================================================
 *  Consulta de entrevistas — Modal premium con CE refs
 *  + Carga/actualización de foto (Supabase Storage)
 *  + Preview instantáneo, compresión y cache de URLs firmadas
 *  Archivo: src/app/restauracion/consultar/page.tsx
 *  NOTA: Pega este archivo COMPLETO (sin omitir líneas).
 *  =======================================================
 */

// ---------------------- Tipos ----------------------
export type Entrevista = {
  id: string;
  created_at?: string | null;
  updated_at?: string | null;

  // Identificación
  nombre?: string | null;
  cedula?: string | null;
  email?: string | null;
  telefono?: string | null;
  foto_path?: string | null;

  // Datos personales
  fecha_nac?: string | null;
  lugar_nac?: string | null;
  direccion?: string | null;
  estado_civil?: "soltero" | "casado" | "union" | "viudo" | null;
  ocupacion?: string | null;
  escolaridad?: string | null;

  // Iglesia
  se_congrega?: "si" | "no" | null;
  dia_congrega?:
    | "Domingo"
    | "Lunes"
    | "Martes"
    | "Miércoles"
    | "Jueves"
    | "Viernes"
    | "Sábado"
    | null;
  tiempo_iglesia?: string | null;
  invito?: string | null;
  pastor?: string | null;

  // Vida espiritual
  nacimiento_espiritu?: "si" | "no" | "no_sabe" | null;
  bautizo_agua?: "si" | "no" | null;
  bautismo_espiritu?: "si" | "no" | null;
  tiene_biblia?: boolean | null;
  ayuna?: "si" | "no" | null;

  // Evaluación / observaciones
  aspecto_feliz?: boolean | null;
  muy_interesado?: boolean | null;
  interviene?: boolean | null;
  cambios_fisicos?: string | null;
  notas?: string | null;
  promovido?: "si" | "no" | null;

  // Campo efímero para preview local inmediato (no se guarda en BD)
  _tempPreview?: string | null;

  [k: string]: any;
};

// ---------------------- Utils ----------------------
function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function formatDateTime(s?: string | null) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

function extFromMime(mime?: string) {
  if (!mime) return ".jpg";
  if (mime.includes("png")) return ".png";
  if (mime.includes("webp")) return ".webp";
  if (mime.includes("jpeg")) return ".jpg";
  if (mime.includes("jpg")) return ".jpg";
  return ".jpg";
}

function bustUrl(u?: string | null) {
  if (!u) return u ?? null;
  const sep = u.includes("?") ? "&" : "?";
  return `${u}${sep}v=${Date.now()}`;
}

/** Placeholder inline (evita 404 a /avatar-placeholder.svg) */
const PLACEHOLDER_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#a855f7"/>
      </linearGradient></defs>
      <rect width="64" height="64" rx="999" fill="url(#g)"/>
      <circle cx="32" cy="24" r="12" fill="rgba(255,255,255,.85)"/>
      <path d="M8,60a24,24 0 0 1 48,0" fill="rgba(255,255,255,.85)"/>
    </svg>`
  );

// ---------------------- Campo editable (CE refs) ----------------------
type CEProps = {
  value?: string | null;
  edit: boolean;
  placeholder?: string;
  onInput?: (e: React.FormEvent<HTMLSpanElement>) => void;
  className?: string;
};
function CEField({
  value = "",
  edit,
  placeholder = "",
  onInput,
  className,
}: CEProps) {
  const ref = useRef<HTMLSpanElement>(null);

  // Carga externa sin romper el caret durante la edición
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const current = el.innerText ?? "";
    const next = value ?? "";
    if (current !== next && !document.activeElement?.isSameNode(el)) {
      el.innerText = next;
    }
  }, [value, edit]);

  // Sanitiza pegado
  function onPaste(e: React.ClipboardEvent<HTMLSpanElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  }

  return (
    <span
      ref={ref}
      contentEditable={edit}
      suppressContentEditableWarning
      onInput={onInput}
      onPaste={onPaste}
      spellCheck={false}
      className={classNames(
        "inline min-w-[2ch]",
        edit
          ? "px-1 rounded-md ring-1 ring-indigo-200 bg-white/70 supports-[backdrop-filter]:bg-white/40 focus:outline-none"
          : "",
        className
      )}
      data-placeholder={placeholder}
    />
  );
}

// ---------------------- Fila editable util ----------------------
function EditableRow({
  label,
  value,
  edit,
  onInput,
}: {
  label: string;
  value?: string | null;
  edit: boolean;
  onInput: (e: React.FormEvent<HTMLSpanElement>) => void;
}) {
  return (
    <div className="grid grid-cols-[160px_1fr] items-start gap-3 py-1.5">
      <div className="text-sm text-zinc-500">{label}</div>
      <div className="text-sm text-zinc-800">
        {edit ? (
          <CEField value={value ?? ""} edit={edit} onInput={onInput} />
        ) : (
          <span className="text-zinc-800">
            {value && value.trim() ? value : "—"}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------- Modal Detalle ----------------------
type DetalleEntrevistaProps = {
  row: Entrevista;
  signedUrl: string | null;
  onClose: () => void;
  onUpdated: (r: Entrevista) => void;
  onDeleted: (id: string) => void;
};

function DetalleEntrevista({
  row,
  signedUrl,
  onClose,
  onUpdated,
  onDeleted,
}: DetalleEntrevistaProps) {
  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [form, setForm] = useState<Entrevista>(row);

  // Signed URL local para refrescar preview sin tocar el padre
  const [localSignedUrl, setLocalSignedUrl] = useState<string | null>(signedUrl);
  useEffect(() => setLocalSignedUrl(signedUrl), [signedUrl]);

  const inputFotoRef = useRef<HTMLInputElement>(null);
  const tempObjUrlRef = useRef<string | null>(null);

  // Sync cuando cambia el registro seleccionado
  useEffect(() => setForm(row), [row?.id]);

  function setF<K extends keyof Entrevista>(k: K, v: Entrevista[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // Genera manejadores CE -> estado sin perder caret
  const onCE =
    (k: keyof Entrevista) => (e: React.FormEvent<HTMLSpanElement>) => {
      const t = (e.currentTarget.innerText || "").trim();
      setF(k, t as any);
    };

  // Mapeos si/no <-> boolean en CE
  const onBoolSiNo =
    (k: keyof Entrevista) => (e: React.FormEvent<HTMLSpanElement>) => {
      const t = (e.currentTarget.innerText || "").trim().toLowerCase();
      const v =
        t === "si" ? true : t === "no" ? false : (null as unknown as boolean);
      setF(k as any, v as any);
    };

  // --------- COMPRESIÓN CLIENTE ----------
  function downscaleImage(file: File, maxSide = 720, quality = 0.82): Promise<File> {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const { width, height } = img;
        let w = width;
        let h = height;
        if (w > h && w > maxSide) {
          h = Math.round((h * maxSide) / w);
          w = maxSide;
        } else if (h >= w && h > maxSide) {
          w = Math.round((w * maxSide) / h);
          h = maxSide;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (!blob) return resolve(file);
            const f = new File([blob], file.name.replace(/\.\w+$/, ".webp"), {
              type: "image/webp",
              lastModified: Date.now(),
            });
            resolve(f);
          },
          "image/webp",
          quality
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file);
      };
      img.src = url;
    });
  }

  async function handleUpdate() {
    if (!edit) {
      setEdit(true);
      return;
    }
    // Validación mínima de coherencia
    const SINO = new Set(["si", "no", ""]);
    const SINO_NS = new Set(["si", "no", "no_sabe", ""]);
    const DIAS = new Set([
      "Domingo",
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
      "",
    ]);
    if (form.se_congrega && !SINO.has(form.se_congrega)) {
      alert("Se congrega debe ser si/no");
      return;
    }
    if (form.ayuna && !SINO.has(form.ayuna)) {
      alert("Ayuna debe ser si/no");
      return;
    }
    if (form.nacimiento_espiritu && !SINO_NS.has(form.nacimiento_espiritu)) {
      alert("Nacimiento del Espíritu: si/no/no_sabe");
      return;
    }
    if (form.bautizo_agua && !SINO.has(form.bautizo_agua)) {
      alert("Bautizo en agua: si/no");
      return;
    }
    if (form.bautismo_espiritu && !SINO.has(form.bautismo_espiritu)) {
      alert("Bautismo del Espíritu: si/no");
      return;
    }
    if (form.dia_congrega && !DIAS.has(form.dia_congrega)) {
      alert("Día congrega inválido");
      return;
    }

    try {
      setSaving(true);
      // Payload explícito
      const payload = {
        nombre: form.nombre ?? null,
        cedula: form.cedula ?? null,
        email: form.email ?? null,
        telefono: form.telefono ?? null,

        fecha_nac: form.fecha_nac ?? null,
        lugar_nac: form.lugar_nac ?? null,
        direccion: form.direccion ?? null,
        escolaridad: form.escolaridad ?? null,
        ocupacion: form.ocupacion ?? null,
        estado_civil: form.estado_civil ?? null,

        se_congrega: form.se_congrega ?? null,
        dia_congrega: form.dia_congrega ?? null,
        tiempo_iglesia: form.tiempo_iglesia ?? null,
        invito: form.invito ?? null,
        pastor: form.pastor ?? null,

        nacimiento_espiritu: form.nacimiento_espiritu ?? null,
        bautizo_agua: form.bautizo_agua ?? null,
        bautismo_espiritu: form.bautismo_espiritu ?? null,
        tiene_biblia: form.tiene_biblia ?? null,
        ayuna: form.ayuna ?? null,

        aspecto_feliz: form.aspecto_feliz ?? null,
        muy_interesado: form.muy_interesado ?? null,
        interviene: form.interviene ?? null,
        cambios_fisicos: form.cambios_fisicos ?? null,
        notas: form.notas ?? null,
        promovido: form.promovido ?? null,

        foto_path: form.foto_path ?? null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("entrevistas")
        .update(payload)
        .eq("id", form.id)
        .select("*")
        .single();

      if (error) throw error;
      onUpdated(data as Entrevista);
      setEdit(false);
    } catch (e: any) {
      alert(e?.message ?? "Error actualizando");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("¿Eliminar definitivamente esta entrevista?")) return;
    try {
      setSaving(true);
      if (form.foto_path) {
        await supabase.storage
          .from("entrevistas-fotos")
          .remove([form.foto_path]);
      }
      const { error } = await supabase
        .from("entrevistas")
        .delete()
        .eq("id", form.id);
      if (error) throw error;
      onDeleted(form.id);
    } catch (e: any) {
      alert(e?.message ?? "Error eliminando");
    } finally {
      setSaving(false);
    }
  }

  // --------- CARGA / CAMBIO DE FOTO ----------
  async function handleChangeFoto(file: File) {
    if (!file.type.startsWith("image/")) {
      alert("Selecciona una imagen válida.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      alert("La imagen supera 12MB.");
      return;
    }

    // 1) Comprimir/redimensionar (rápido de subir)
    const compact = await downscaleImage(file, 720, 0.82);

    // 2) Preview INMEDIATO con el archivo comprimido
    const tempUrl = URL.createObjectURL(compact);
    tempObjUrlRef.current = tempUrl;
    setLocalSignedUrl(tempUrl);
    onUpdated({ ...form, _tempPreview: tempUrl }); // no tocamos foto_path aún

    setUploadingFoto(true);
    const oldPath = form.foto_path || undefined;
    const path = `fotos/${row.id}-${Date.now()}${extFromMime(compact.type)}`;

    try {
      // 3) Subir a Storage (sin caché para que aparezca al toque)
      const up = await supabase.storage
        .from("entrevistas-fotos")
        .upload(path, compact, {
          cacheControl: "0",
          upsert: true,
          contentType: compact.type || "image/webp",
        });
      if (up.error) throw up.error;

      // 4) Actualizar DB
      const { data: updated, error: upErr } = await supabase
        .from("entrevistas")
        .update({ foto_path: path, updated_at: new Date().toISOString() })
        .eq("id", row.id)
        .select("*")
        .single();
      if (upErr) throw upErr;

      // 5) Firmar URL para preview (con bust)
      const signed = await supabase.storage
        .from("entrevistas-fotos")
        .createSignedUrl(path, 60 * 10); // 10 min
      if (signed.error) throw signed.error;

      const signedBusted = bustUrl(signed.data?.signedUrl) ?? null;

      // 6) Borrar imagen previa (si había)
      if (oldPath) {
        await supabase.storage.from("entrevistas-fotos").remove([oldPath]);
      }

      // 7) Refrescar estado local y notificar padre (quitamos _tempPreview)
      setF("foto_path", path);
      setLocalSignedUrl(signedBusted);
      onUpdated({ ...(updated as Entrevista), _tempPreview: null });
    } catch (e: any) {
      // Revertimos el preview efímero en caso de error
      onUpdated({ ...row, _tempPreview: null });
      alert(e?.message ?? "No se pudo subir la foto");
    } finally {
      setUploadingFoto(false);
      // Liberar el objectURL temporal
      if (tempObjUrlRef.current) {
        URL.revokeObjectURL(tempObjUrlRef.current);
        tempObjUrlRef.current = null;
      }
    }
  }

  const btnUpdateClass = edit
    ? "bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 text-zinc-900 shadow ring-1 ring-amber-300"
    : "bg-zinc-900 text-white hover:bg-zinc-800";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Contenedor modal centrado y scrolleable */}
      <section className="relative z-[81] w-full max-w-4xl max-h-[95vh] rounded-3xl ring-1 ring-white/60 shadow-[0_24px_60px_-12px_rgba(0,0,0,.45)] bg-white/60 supports-[backdrop-filter]:bg-white/30 backdrop-blur-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <header className="px-6 pt-5 pb-3 border-b border-white/50 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Avatar clickeable (no altera layout general) */}
            <div className="relative">
              <img
                src={localSignedUrl ?? PLACEHOLDER_SVG}
                alt={form.nombre ?? "avatar"}
                width={56}
                height={56}
                className={classNames(
                  "rounded-full object-cover ring-1 ring-white/70 shadow",
                  uploadingFoto ? "opacity-60" : "opacity-100",
                  "cursor-pointer"
                )}
                onClick={() => inputFotoRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    inputFotoRef.current?.click();
                  }
                }}
                role="button"
                aria-label="Cambiar foto"
                title="Cambiar foto"
              />
              {uploadingFoto && (
                <div className="absolute inset-0 grid place-items-center rounded-full bg-black/30 text-white text-[10px]">
                  Subiendo…
                </div>
              )}
              {/* input oculto */}
              <input
                ref={inputFotoRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleChangeFoto(f);
                  e.currentTarget.value = "";
                }}
              />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-zinc-800">
                {form.nombre ?? "Consulta de entrevista"}
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                Creada: {formatDateTime(row.created_at)} · Actualizada:{" "}
                {formatDateTime(row.updated_at)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm font-medium rounded-full transition ring-1 ring-zinc-200 bg-white/70 supports-[backdrop-filter]:bg-white/40 hover:bg-white/80 text-zinc-700"
              title="Salir"
            >
              Salir
            </button>
            <button
              onClick={handleDelete}
              disabled={saving}
              className="px-3 py-1.5 text-sm font-medium rounded-full transition text-white bg-gradient-to-r from-rose-500 to-rose-600 hover:brightness-105 active:scale-[.98] shadow-[0_10px_30px_-10px_rgba(225,29,72,.6)] disabled:opacity-60"
              title="Eliminar"
            >
              Eliminar
            </button>
            <button
              onClick={handleUpdate}
              disabled={saving}
              className={classNames(
                "px-3 py-1.5 text-sm font-medium rounded-full transition disabled:opacity-60",
                btnUpdateClass
              )}
              title={edit ? "Guardar cambios" : "Editar"}
            >
              {edit ? (saving ? "Guardando…" : "Guardar") : "Editar"}
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="px-6 py-6 overflow-y-auto flex-1 min-h-0">
          {/* Cabecera con nombre/cedula */}
          <div className="min-w-0">
            <div className="text-xl font-semibold text-zinc-800 break-words">
              <CEField value={form.nombre ?? ""} edit={edit} onInput={onCE("nombre")} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-700">
              <span className="inline-flex items-center gap-1">
                Cédula:{" "}
                <CEField value={form.cedula ?? ""} edit={edit} onInput={onCE("cedula")} />
              </span>
              {form.estado_civil && (
                <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200">
                  {form.estado_civil}
                </span>
              )}
              {form.se_congrega && (
                <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  Se congrega: {form.se_congrega}
                </span>
              )}
              {form.promovido && (
                <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200">
                  Promovido: {form.promovido}
                </span>
              )}
            </div>
          </div>

          {/* Secciones */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Información personal */}
            <section className="rounded-2xl p-4 ring-1 ring-black/5 bg-zinc-50">
              <h4 className="text-sm font-semibold text-zinc-600 mb-2">Información personal</h4>
              <EditableRow label="Email" value={form.email} edit={edit} onInput={onCE("email")} />
              <EditableRow label="Teléfono" value={form.telefono} edit={edit} onInput={onCE("telefono")} />
              <EditableRow label="Fecha de nacimiento" value={form.fecha_nac ?? ""} edit={edit} onInput={onCE("fecha_nac")} />
              <EditableRow label="Lugar de nacimiento" value={form.lugar_nac} edit={edit} onInput={onCE("lugar_nac")} />
              <EditableRow label="Dirección" value={form.direccion} edit={edit} onInput={onCE("direccion")} />
              <EditableRow label="Escolaridad" value={form.escolaridad} edit={edit} onInput={onCE("escolaridad")} />
              <EditableRow label="Ocupación" value={form.ocupacion} edit={edit} onInput={onCE("ocupacion")} />
            </section>

            {/* Información general */}
            <section className="rounded-2xl p-4 ring-1 ring-black/5 bg-zinc-50">
              <h4 className="text-sm font-semibold text-zinc-600 mb-2">Información general</h4>
              <EditableRow label="Se congrega" value={form.se_congrega ?? ""} edit={edit} onInput={onCE("se_congrega")} />
              <EditableRow label="Día congrega" value={form.dia_congrega ?? ""} edit={edit} onInput={onCE("dia_congrega")} />
              <EditableRow label="Tiempo en la iglesia" value={form.tiempo_iglesia} edit={edit} onInput={onCE("tiempo_iglesia")} />
              <EditableRow label="Invitó" value={form.invito} edit={edit} onInput={onCE("invito")} />
              <EditableRow label="Pastor" value={form.pastor} edit={edit} onInput={onCE("pastor")} />
            </section>

            {/* Datos espirituales */}
            <section className="rounded-2xl p-4 ring-1 ring-black/5 bg-zinc-50 md:col-span-2">
              <h4 className="text-sm font-semibold text-zinc-600 mb-2">Datos espirituales</h4>
              <EditableRow label="Nacimiento del Espíritu" value={form.nacimiento_espiritu ?? ""} edit={edit} onInput={onCE("nacimiento_espiritu")} />
              <EditableRow label="Bautizo en agua" value={form.bautizo_agua ?? ""} edit={edit} onInput={onCE("bautizo_agua")} />
              <EditableRow label="Bautismo del Espíritu" value={form.bautismo_espiritu ?? ""} edit={edit} onInput={onCE("bautismo_espiritu")} />
              <EditableRow
                label="Tiene Biblia"
                value={form.tiene_biblia == null ? "" : form.tiene_biblia ? "si" : "no"}
                edit={edit}
                onInput={onBoolSiNo("tiene_biblia")}
              />
              <EditableRow label="Ayuna" value={form.ayuna ?? ""} edit={edit} onInput={onCE("ayuna")} />
            </section>

            {/* Evaluación y observaciones */}
            <section className="rounded-2xl p-4 ring-1 ring-black/5 bg-zinc-50 md:col-span-2">
              <h4 className="text-sm font-semibold text-zinc-600 mb-2">Evaluación y observaciones</h4>
              <EditableRow
                label="Aspecto feliz"
                value={form.aspecto_feliz == null ? "" : form.aspecto_feliz ? "si" : "no"}
                edit={edit}
                onInput={onBoolSiNo("aspecto_feliz")}
              />
              <EditableRow
                label="Muy interesado"
                value={form.muy_interesado == null ? "" : form.muy_interesado ? "si" : "no"}
                edit={edit}
                onInput={onBoolSiNo("muy_interesado")}
              />
              <EditableRow
                label="Interviene"
                value={form.interviene == null ? "" : form.interviene ? "si" : "no"}
                edit={edit}
                onInput={onBoolSiNo("interviene")}
              />
              <EditableRow label="Cambios físicos / observaciones" value={form.cambios_fisicos} edit={edit} onInput={onCE("cambios_fisicos")} />
              <EditableRow label="Promovido" value={form.promovido ?? ""} edit={edit} onInput={onCE("promovido")} />
              <EditableRow label="Notas del maestro" value={form.notas} edit={edit} onInput={onCE("notas")} />
            </section>
          </div>

          <div className="mt-6 text-right text-xs text-zinc-500">
            Creada: {formatDateTime(row.created_at)}
          </div>
        </div>
      </section>
    </div>
  );
}

// ---------------------- Página: tabla y listado ----------------------
type SortState = { key: keyof Entrevista | "created_at"; dir: "asc" | "desc" };

export default function Page() {
  const [rows, setRows] = useState<Entrevista[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortState>({
    key: "created_at",
    dir: "desc",
  });
  const [selected, setSelected] = useState<Entrevista | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  // Cache de URLs firmadas por foto_path (para la tabla)
  const [fotoUrls, setFotoUrls] = useState<Record<string, string>>({});

  async function getSignedUrlCached(path?: string | null) {
    if (!path) return null;
    if (fotoUrls[path]) return fotoUrls[path];
    const { data } = await supabase.storage
      .from("entrevistas-fotos")
      .createSignedUrl(path, 60 * 10);
    const url = bustUrl(data?.signedUrl) ?? null;
    if (url) setFotoUrls((m) => ({ ...m, [path]: url }));
    return url;
  }

  // Cargar entrevistas
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("entrevistas")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500);
        if (error) throw error;
        setRows((data ?? []) as Entrevista[]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Búsqueda y orden
  const filtered = useMemo(() => {
    const r = rows.filter((x) => {
      if (!q.trim()) return true;
      const hay = (s?: string | null) =>
        (s ?? "").toLowerCase().includes(q.toLowerCase());
      return (
        hay(x.nombre) ||
        hay(x.cedula) ||
        hay(x.email) ||
        hay(x.telefono) ||
        hay(x.notas) ||
        hay(x.direccion)
      );
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...r].sort((a, b) => {
      const ak = (a as any)[sort.key] ?? "";
      const bk = (b as any)[sort.key] ?? "";
      if (ak === bk) return 0;
      return (ak > bk ? 1 : -1) * dir;
    });
  }, [rows, q, sort]);

  // Prefetch de URLs firmadas para las primeras filas visibles (reduce “lag”)
  useEffect(() => {
    const TO_PREFETCH = Math.min(30, filtered.length);
    const paths = Array.from(
      new Set(
        filtered.slice(0, TO_PREFETCH).map((r) => r.foto_path).filter(Boolean) as string[]
      )
    );
    if (paths.length === 0) return;
    Promise.all(
      paths.map((p) =>
        supabase.storage
          .from("entrevistas-fotos")
          .createSignedUrl(p, 60 * 10)
          .then(({ data }) => ({ p, url: bustUrl(data?.signedUrl) ?? null }))
          .catch(() => ({ p, url: null }))
      )
    ).then((pairs) => {
      setFotoUrls((m) => {
        const next = { ...m };
        pairs.forEach(({ p, url }) => {
          if (p && url) next[p] = url;
        });
        return next;
      });
    });
  }, [filtered]);

  // Abrir modal: obtener Signed URL si hay foto y precachear
  async function openRow(row: Entrevista) {
    setSelected(row);
    setSignedUrl(null);
    if (row.foto_path) {
      const url = await getSignedUrlCached(row.foto_path);
      if (url) setSignedUrl(url);
    }
  }

  // Actualizaciones desde modal
  function onUpdated(r: Entrevista) {
    setRows((xs) => xs.map((x) => (x.id === r.id ? r : x)));
    setSelected(r);
    // Si la fila tiene preview temporal, priorízalo en la tabla (solo fila seleccionada)
    if ((r as any)._tempPreview && selected?.id === r.id) {
      setSignedUrl((r as any)._tempPreview);
      return;
    }
    // Si cambió/estableció foto, firmamos y cacheamos
    if (r.foto_path) {
      supabase.storage
        .from("entrevistas-fotos")
        .createSignedUrl(r.foto_path, 60 * 10)
        .then(({ data }) => {
          const url = bustUrl(data?.signedUrl) ?? null;
          if (url) {
            setFotoUrls((m) => ({ ...m, [r.foto_path as string]: url }));
            if (selected?.id === r.id) setSignedUrl(url);
          }
        })
        .catch(() => {});
    }
  }

  function onDeleted(id: string) {
    setRows((xs) => xs.filter((x) => x.id !== id));
    setSelected(null);
  }

  // Avatar de fila: resuelve URL firmada on-demand con cache
  function RowAvatar({
    path,
    isSelected,
    selectedUrl,
  }: {
    path?: string | null;
    isSelected: boolean;
    selectedUrl?: string | null;
  }) {
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
      let active = true;
      // Si es la fila seleccionada y tenemos URL (firmada o temp), úsala
      if (isSelected && selectedUrl) {
        setUrl(selectedUrl);
        return () => {
          active = false;
        };
      }
      // Si hay path, busca en cache o firma
      if (path) {
        const cached = fotoUrls[path];
        if (cached) {
          setUrl(cached);
        } else {
          supabase.storage
            .from("entrevistas-fotos")
            .createSignedUrl(path, 60 * 10)
            .then(({ data }) => {
              if (!active) return;
              const u = bustUrl(data?.signedUrl) ?? null;
              if (u) {
                setUrl(u);
                setFotoUrls((m) => ({ ...m, [path]: u }));
              }
            })
            .catch(() => {});
        }
      } else {
        setUrl(null);
      }
      return () => {
        active = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [path, isSelected, selectedUrl]);

    return (
      <img
        src={url || PLACEHOLDER_SVG}
        alt="avatar"
        width={28}
        height={28}
        className="rounded-full object-cover ring-1 ring-white/70 shadow"
      />
    );
  }

  return (
    <div className="min-h-[calc(100vh-120px)] w-full relative">
      {/* Glow premium */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: "#ffffff",
          backgroundImage: `radial-gradient( circle at 85% 15%, rgba(99,102,241,.35), transparent 60% )`,
          filter: "blur(80px)",
          backgroundRepeat: "no-repeat",
        }}
      />

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-800">
          Consulta de entrevistas
        </h2>
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, cédula, email…"
            className="h-9 w-[260px] rounded-xl px-3 text-sm ring-1 ring-zinc-200 bg-white/70 supports-[backdrop-filter]:bg-white/40 focus:outline-none focus:ring-indigo-300"
          />
          <select
            value={`${String(sort.key)}:${sort.dir}`}
            onChange={(e) => {
              const [k, d] = e.target.value.split(":");
              setSort({ key: k as any, dir: d as "asc" | "desc" });
            }}
            className="h-9 rounded-xl px-3 text-sm ring-1 ring-zinc-200 bg-white/70 supports-[backdrop-filter]:bg-white/40 focus:outline-none focus:ring-indigo-300"
          >
            <option value="created_at:desc">Más recientes</option>
            <option value="created_at:asc">Más antiguas</option>
            <option value="nombre:asc">Nombre (A-Z)</option>
            <option value="nombre:desc">Nombre (Z-A)</option>
          </select>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-auto rounded-2xl ring-1 ring-black/5 bg-white/70 supports-[backdrop-filter]:bg-white/40">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
              <th className="p-3 text-left w-10">#</th>
              <th className="p-3 text-left">Nombre</th>
              <th className="p-3 text-left">Cédula</th>
              <th className="p-3 text-left">Teléfono</th>
              <th className="p-3 text-left">Correo</th>
              <th className="p-3 text-left">Creada</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-zinc-500">
                  Cargando…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-zinc-500">
                  Sin resultados.
                </td>
              </tr>
            ) : (
              filtered.map((row, idx) => {
                const isSelected = selected?.id === row.id;
                const selectedUrl =
                  isSelected
                    ? (selected?._tempPreview ?? signedUrl ?? null)
                    : null;

                return (
                  <tr
                    key={row.id}
                    onClick={() => openRow(row)}
                    className={classNames(
                      idx % 2 ? "bg-zinc-50/50" : "bg-white",
                      "hover:bg-indigo-50/50 cursor-pointer transition-colors"
                    )}
                  >
                    <td className="p-3 align-middle">{idx + 1}</td>
                    <td className="p-3 align-middle">
                      <div className="flex items-center gap-3">
                        <RowAvatar
                          path={row.foto_path}
                          isSelected={isSelected}
                          selectedUrl={selectedUrl ?? undefined}
                        />
                        <div className="font-medium text-zinc-800 truncate max-w-[260px]">
                          {row.nombre ?? "—"}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 align-middle">{row.cedula ?? "—"}</td>
                    <td className="p-3 align-middle">{row.telefono ?? "—"}</td>
                    <td className="p-3 align-middle">{row.email ?? "—"}</td>
                    <td className="p-3 align-middle">
                      {formatDateTime(row.created_at)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {selected && (
        <DetalleEntrevista
          row={selected}
          signedUrl={signedUrl}
          onClose={() => setSelected(null)}
          onUpdated={onUpdated}
          onDeleted={onDeleted}
        />
      )}
    </div>
  );
}
