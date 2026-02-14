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

// (Definición de folderColors — paleta premium para liquid glass)
export const folderColors = {
  blue: {
    icon: 'text-blue-400 fill-blue-400/15',
    glow: 'from-blue-500/20 to-cyan-400/10',
    border: 'hover:border-blue-400/30',
    shadow: 'hover:shadow-blue-500/15',
    accent: 'bg-blue-500',
    focusRing: 'focus:ring-blue-500/30',
    bgGlow: 'from-blue-500/10 to-blue-600/5',
    bgGlowHover: 'group-hover:from-blue-500/15 group-hover:to-blue-600/10',
  },
  indigo: {
    icon: 'text-indigo-400 fill-indigo-400/15',
    glow: 'from-indigo-500/20 to-violet-400/10',
    border: 'hover:border-indigo-400/30',
    shadow: 'hover:shadow-indigo-500/15',
    accent: 'bg-indigo-500',
    focusRing: 'focus:ring-indigo-500/30',
    bgGlow: 'from-indigo-500/10 to-indigo-600/5',
    bgGlowHover: 'group-hover:from-indigo-500/15 group-hover:to-indigo-600/10',
  },
  teal: {
    icon: 'text-teal-400 fill-teal-400/15',
    glow: 'from-teal-500/20 to-emerald-400/10',
    border: 'hover:border-teal-400/30',
    shadow: 'hover:shadow-teal-500/15',
    accent: 'bg-teal-500',
    focusRing: 'focus:ring-teal-500/30',
    bgGlow: 'from-teal-500/10 to-teal-600/5',
    bgGlowHover: 'group-hover:from-teal-500/15 group-hover:to-teal-600/10',
  },
  purple: {
    icon: 'text-purple-400 fill-purple-400/15',
    glow: 'from-purple-500/20 to-fuchsia-400/10',
    border: 'hover:border-purple-400/30',
    shadow: 'hover:shadow-purple-500/15',
    accent: 'bg-purple-500',
    focusRing: 'focus:ring-purple-500/30',
    bgGlow: 'from-purple-500/10 to-purple-600/5',
    bgGlowHover: 'group-hover:from-purple-500/15 group-hover:to-purple-600/10',
  },
  pink: {
    icon: 'text-pink-400 fill-pink-400/15',
    glow: 'from-pink-500/20 to-rose-400/10',
    border: 'hover:border-pink-400/30',
    shadow: 'hover:shadow-pink-500/15',
    accent: 'bg-pink-500',
    focusRing: 'focus:ring-pink-500/30',
    bgGlow: 'from-pink-500/10 to-pink-600/5',
    bgGlowHover: 'group-hover:from-pink-500/15 group-hover:to-pink-600/10',
  },
  default: {
    icon: 'text-slate-400 fill-slate-400/15',
    glow: 'from-slate-500/20 to-gray-400/10',
    border: 'hover:border-slate-400/30',
    shadow: 'hover:shadow-slate-500/15',
    accent: 'bg-slate-500',
    focusRing: 'focus:ring-slate-500/30',
    bgGlow: 'from-slate-500/10 to-slate-600/5',
    bgGlowHover: 'group-hover:from-slate-500/15 group-hover:to-slate-600/10',
  },
};

// --- MODIFICADO ---
// Este tipo ahora coincide con la tabla 'cursos' de la BD
export type Course = {
  id: number;
  title: string;
  color: string;
  hasSpecialBadge?: boolean;
  studentCount?: number;
  attendanceRate?: number; // 0-100, porcentaje promedio de asistencia del curso
};
// --- FIN MODIFICACIÓN ---


// --- 2. CONSTANTES ---
export const DIAS: ("Domingo" | "Lunes" | "Martes" | "Miércoles" | "Jueves" | "Viernes" | "Sábado")[] = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export const ESTADOS: ("soltero" | "casado" | "union" | "viudo")[] = ["soltero", "casado", "union", "viudo"];
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

export async function downscaleImage(file: File, maxSide = 800, quality = 0.8): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  try {
    // Intentar usar createImageBitmap (Moderno, rápido, maneja orientación EXIF automáticamente en muchos casos)
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;

    let w = width;
    let h = height;

    if (w > maxSide || h > maxSide) {
      if (w > h) {
        h = Math.round((h * maxSide) / w);
        w = maxSide;
      } else {
        w = Math.round((w * maxSide) / h);
        h = maxSide;
      }
    } else {
      // Si es más pequeña que el máximo, no redimensionar, pero sí comprimir (retornar canvas blob)
      // O devolver original si es muy pequeño? Mejor estandarizar a JPG.
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    // Draw bitmap
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close(); // Liberar memoria

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) return resolve(file);
          // Convertir a File
          const f = new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
            type: "image/jpeg",
            lastModified: Date.now(),
          });
          resolve(f);
        },
        "image/jpeg",
        quality
      );
    });

  } catch (error) {
    console.warn("createImageBitmap failed, falling back to FileReader", error);
    // Fallback clásico si createImageBitmap falla (ej. Safari antiguos u otros problemas)
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const { width, height } = img;
        let w = width;
        let h = height;

        if (w > maxSide || h > maxSide) {
          if (w > h) {
            h = Math.round((h * maxSide) / w);
            w = maxSide;
          } else {
            w = Math.round((w * maxSide) / h);
            h = maxSide;
          }
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
            const f = new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            resolve(f);
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file); // Retorna original si falla todo
      };
      img.src = url;
    });
  }
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

export function getNextCourse(currentId: number): { id: number; name: string } | null {
  const map: Record<number, { id: number; name: string }> = {
    1: { id: 2, name: 'Fundamentos 1' },
    2: { id: 3, name: 'Fundamentos 2' },
    3: { id: 4, name: 'Restauración 2' },
    4: { id: 5, name: 'Escuela de Siervos' },
  };
  return map[currentId] || null;
}


// --- 4. SUB-COMPONENTES DE UI COMPARTIDOS ---

type CEProps = {
  value?: string | null;
  edit: boolean;
  placeholder?: string;
  onInput?: (e: React.FormEvent<HTMLSpanElement>) => void;
  onChange?: (value: string) => void;
  className?: string;
};
export function CEField({
  value = "",
  edit,
  placeholder = "",
  onInput,
  onChange,
  className,
}: CEProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const current = el.textContent ?? "";
    const next = value ?? "";
    if (current !== next && !document.activeElement?.isSameNode(el)) {
      el.textContent = next;
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
      onInput={(e) => {
        if (onInput) onInput(e);
        if (onChange) onChange(e.currentTarget.textContent || '');
      }}
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