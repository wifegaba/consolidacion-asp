'use client';

// Este archivo contiene TODOS los tipos, helpers y sub-componentes 
// que serán compartidos entre page.tsx y HojaDeVidaPanel.tsx

// --- IMPORTACIÓN DE REACT (ESTO CORRIGE LOS ERRORES DE JSX) ---
import React, { useRef, useEffect } from 'react';

// --- 1. TIPOS ---
export type Entrevista = {
  id: string;
  created_at?: string | null;
  updated_at?: string | null;
  nombre?: string | null;
  cedula?: string | null;
  email?: string | null;
  telefono?: string | null;
  foto_path?: string | null;
  fecha_nac?: string | null;
  lugar_nac?: string | null;
  direccion?: string | null;
  estado_civil?: "soltero" | "casado" | "union" | "viudo" | null;
  ocupacion?: string | null;
  escolaridad?: string | null;
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
  nacimiento_espiritu?: "si" | "no" | "no_sabe" | null;
  bautizo_agua?: "si" | "no" | null;
  bautismo_espiritu?: "si" | "no" | null;
  tiene_biblia?: boolean | null;
  ayuna?: "si" | "no" | null;
  aspecto_feliz?: boolean | null;
  muy_interesado?: boolean | null;
  interviene?: boolean | null;
  cambios_fisicos?: string | null;
  notas?: string | null;
  promovido?: "si" | "no" | null;
  labora_actualmente?: "si" | "no" | null;
  viene_otra_iglesia?: "si" | "no" | null;
  otra_iglesia_nombre?: string | null;
  tiempo_oracion?: string | null;
  frecuencia_lectura_biblia?: string | null;
  motivo_ayuno?: string | null;
  meta_personal?: string | null;
  enfermedad?: string | null;
  tratamiento_clinico?: "si" | "no" | null;
  motivo_tratamiento?: string | null;
  retiros_asistidos?: string | null;
  convivencia?: "solo" | "pareja" | "hijos" | "padres" | "otro" | null;
  recibe_consejeria?: "si" | "no" | null;
  motivo_consejeria?: string | null;
  cambios_emocionales?: string | null;
  desempeno_clase?: string | null;
  maestro_encargado?: string | null;
  _tempPreview?: string | null;
  };

// --- Tipos que faltaban por exportar (CORREGIDO) ---
export type GradePlaceholder = { id: number };
export type CourseTopic = { id: number; title: string; grades: GradePlaceholder[] };
export type StudentGrades = Record<number, Record<number, string>>;

// --- MODIFICADO ---
// 'create' se elimina de las pestañas válidas
export type ActiveTab = 'grades' | 'reports' | 'hojaDeVida';
// --- FIN MODIFICACIÓN ---

export type MainPanelState = 'welcome' | 'courseWelcome' | 'creating' | 'viewing';

// (Definición de folderColors necesaria para el tipo Course)
export const folderColors = {
  blue: 'text-blue-500/80 fill-blue-500/20',
  indigo: 'text-indigo-500/80 fill-indigo-500/20',
  teal: 'text-teal-500/80 fill-teal-500/20',
  purple: 'text-purple-500/80 fill-purple-500/20',
  pink: 'text-pink-500/80 fill-pink-500/20',
  // Añadimos 'default' o un color de fallback si es necesario
  default: 'text-gray-500/80 fill-gray-500/20',
};

// --- MODIFICADO ---
// Este tipo ahora coincide con la tabla 'cursos' de la BD
export type Course = {
  id: number; // <-- AÑADIDO: Coincide con la BD
  title: string;
  color: string; // <-- Cambiado a string genérico para aceptar 'blue', 'indigo', etc.
  hasSpecialBadge?: boolean; 
  // 'onSelect' se elimina de aquí. Es una prop del componente, no parte del modelo.
};
// --- FIN MODIFICACIÓN ---


// --- 2. CONSTANTES ---
export const DIAS: ("Domingo" | "Lunes" | "Martes" | "Miércoles" | "Jueves" | "Viernes" | "Sábado")[] = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
export const ESTADOS: ("soltero" | "casado" | "union" | "viudo")[] = ["soltero","casado","union","viudo"];
export const TIEMPO_ORACION = ["Menos de 15 min", "15-30 min", "30-60 min", "Más de 1 hora", "No oro"];
export const LECTURA_BIBLIA = ["Diariamente", "Varias veces por semana", "Semanalmente", "Ocasionalmente", "Casi nunca"];
export const CONVIVENCIA = ["solo", "pareja", "hijos", "padres", "otro"];

export const PLACEHOLDER_SVG =
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

// --- 3. FUNCIONES DE UTILIDAD ---

export function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export function formatDateTime(s?: string | null) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

export function extFromMime(mime?: string) {
  if (!mime) return ".jpg";
  if (mime.includes("png")) return ".png";
  if (mime.includes("webp")) return ".webp";
  if (mime.includes("jpeg")) return ".jpg";
  if (mime.includes("jpg")) return ".jpg";
  return ".jpg";
}

export function bustUrl(u?: string | null) {
  if (!u) return u ?? null;
  const sep = u.includes("?") ? "&" : "?";
  return `${u}${sep}v=${Date.now()}`;
}

export function downscaleImage(file: File, maxSide = 720, quality = 0.82): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      // (Lógica de downscale)
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

export async function toWhiteBackground(file: File): Promise<File> {
  // Asegúrate de tener @imgly/background-removal instalado
  // (Esta importación dinámica es más segura en un archivo de utils)
  const { removeBackground } = await import("@imgly/background-removal");

  const cutBlob = await removeBackground(file, { output: { format: "image/png" } });
  const img = await createImageBitmap(cutBlob as Blob);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  const whiteBlob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b as Blob), "image/jpeg", 0.95)
  );
  const base = file.name.replace(/\.[^/.]+$/, "");
  return new File([whiteBlob], `${base}_white.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}

export function generateAvatar(name: string): string {
  const initials = (name || 'NN').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  return `https://placehold.co/100x100/AED6F1/4A4A4A?text=${initials}`;
}

export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size));
  return chunks;
}


// --- 4. SUB-COMPONENTES DE UI COMPARTIDOS ---

type CEProps = {
  value?: string | null;
  edit: boolean;
  placeholder?: string;
  onInput?: (e: React.FormEvent<HTMLSpanElement>) => void;
  className?: string;
};
export function CEField({
  value = "",
  edit,
  placeholder = "",
  onInput,
  className,
}: CEProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const current = el.innerText ?? "";
    const next = value ?? "";
    if (current !== next && !document.activeElement?.isSameNode(el)) {
      el.innerText = next;
    }
  }, [value, edit]);

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

export function EditableRow({
  label,
  value,
  edit,
  onInput,
  icon,
}: {
  label: string;
  value?: string | null;
  edit: boolean;
  onInput: (e: React.FormEvent<HTMLSpanElement>) => void;
  icon?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[160px_1fr] items-start gap-3 py-1.5">
      <div className="text-sm text-zinc-500 flex items-center">
        {icon && <span className="mr-2">{icon}</span>}
        {label}
      </div>
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

export function Chip({ checked, onClick, children, disabled, variant = 'pill' }: { checked: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean; variant?: 'pill' | 'circle' }) {
  return (
    <button
      type="button"
      className={variant === 'circle' ? 'chip-circle' : 'chip'}
      data-checked={checked}
      onClick={onClick}
      aria-pressed={checked}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function EditableRowSelect({
  label,
  value,
  edit,
  onChange,
  options,
  placeholder = "Seleccione",
  disabled = false
}: {
  label: string;
  value?: string | null;
  edit: boolean;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-[160px_1fr] items-center gap-3 py-1.5">
      <div className={classNames("text-sm", disabled ? "text-zinc-400" : "text-zinc-500")}>{label}</div>
      <div className="text-sm text-zinc-800">
        {edit ? (
          <select
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="w-full rounded-md ring-1 ring-indigo-200 bg-white/70 supports-[backdrop-filter]:bg-white/40 focus:outline-none p-1 text-sm"
          >
            <option value="">{placeholder}</option>
            {options.map((op) => (
              <option key={op} value={op}>{op.charAt(0).toUpperCase() + op.slice(1)}</option>
            ))}
          </select>
        ) : (
          <span className="text-zinc-800">
            {value && value.trim() ? (value.charAt(0).toUpperCase() + value.slice(1)) : "—"}
          </span>
        )}
      </div>
    </div>
  );
}

export function EditableRowBool({
  label,
  value,
  edit,
  onChange,
  disabled = false
}: {
  label: string;
  value?: boolean | "si" | "no" | null;
  edit: boolean;
  onChange: (value: "si" | "no" | null) => void;
  disabled?: boolean;
}) {
  const val = value === true ? "si" : value === false ? "no" : value;
  return (
    <div className="grid grid-cols-[160px_1fr] items-center gap-3 py-1.5">
      <div className={classNames("text-sm", disabled ? "text-zinc-400" : "text-zinc-500")}>{label}</div>
      <div className="text-sm text-zinc-800">
        {edit ? (
          <div className="flex gap-2">
            <Chip variant="circle" checked={val === "si"} onClick={() => onChange("si")} disabled={disabled}>Sí</Chip>
            <Chip variant="circle" checked={val === "no"} onClick={() => onChange("no")} disabled={disabled}>No</Chip>
          </div>
        ) : (
          <span className="text-zinc-800">
            {val === "si" ? "Sí" : val === "no" ? "No" : "—"}
          </span>
        )}
      </div>
    </div>
  );
}

export function EditableRowBool_SNNS({
  label,
  value,
  edit,
  onChange,
  disabled = false
}: {
  label: string;
  value?: "si" | "no" | "no_sabe" | null;
  edit: boolean;
  onChange: (value: "si" | "no" | "no_sabe" | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-[160px_1fr] items-center gap-3 py-1.5">
      <div className={classNames("text-sm", disabled ? "text-zinc-400" : "text-zinc-500")}>{label}</div>
      <div className="text-sm text-zinc-800">
        {edit ? (
          <div className="flex gap-2 flex-wrap">
            <Chip variant="circle" checked={value === "si"} onClick={() => onChange("si")} disabled={disabled}>Sí</Chip>
            <Chip variant="circle" checked={value === "no"} onClick={() => onChange("no")} disabled={disabled}>No</Chip>
            <Chip variant="circle" checked={value === "no_sabe"} onClick={() => onChange("no_sabe")} disabled={disabled}>No Sabe</Chip>
          </div>
        ) : (
          <span className="text-zinc-800">
            {value === "si" ? "Sí" : value === "no" ? "No" : value === "no_sabe" ? "No Sabe" : "—"}
          </span>
        )}
      </div>
    </div>
  );
}