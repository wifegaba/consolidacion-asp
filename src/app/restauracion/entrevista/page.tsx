"use client";
import { guardarEntrevista } from "../../../services/entrevistas";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { removeBackground } from "@imgly/background-removal";

/* =========================================
  Tipos y esquema (sin libs externas)
========================================= */

// ========== Tipos para validación inline premium ========== 
type FieldKey =
  | 'nombre' | 'cedula' | 'email' | 'telefono' | 'fechaNac' | 'direccion'
  | 'lugarNac' | 'estadoCivil' | 'ocupacion';
type ActiveError = { key: FieldKey; msg: string } | null;
type EstadoCivil = "soltero" | "casado" | "union" | "viudo";
type Dia = "Domingo" | "Lunes" | "Martes" | "Miércoles" | "Jueves" | "Viernes" | "Sábado";

type FormValues = {
  // Foto (opcional)
  foto?: File | null;

  // Información personal
  nombre: string;
  cedula: string;
  telefono?: string;
  email?: string;
  fechaNac?: string;     // yyyy-mm-dd
  lugarNac?: string;
  direccion?: string;
  estadoCivil?: EstadoCivil;
  ocupacion?: string;
  escolaridad?: string;  // Primaria, Bachiller, Técnico, etc.

  // Información general de iglesia
  seCongrega: "si" | "no";
  diaCongrega?: Dia | "";
  tiempoIglesia?: string;
  invito?: string;
  pastor?: string;

  // Datos espirituales
  nacimientoEspiritu?: "si" | "no" | "no_sabe";
  bautizoAgua?: "si" | "no";
  bautismoEspiritu?: "si" | "no";
  tieneBiblia: boolean;
  ayuna?: "si" | "no";

  // Evaluación/Observaciones
  aspectoFeliz: boolean;
  muyInteresado: boolean;
  interviene: boolean;
  cambiosFisicos?: string; // "normal" u observaciones
  notas?: string;

  // Decisión
  promovido?: "si" | "no";
};

/* =========================================
   Constantes / utilidades
========================================= */
const DIAS: Dia[] = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const ESTADOS: EstadoCivil[] = ["soltero","casado","union","viudo"];
const ESCOLARIDAD = [
  "No lee / No escribe",
  "Primaria",
  "Secundaria/Bachiller",
  "Técnico",
  "Tecnológico",
  "Universitario",
  "Postgrado",
];

const INITIAL: FormValues = {
  nombre: "",
  cedula: "",
  telefono: "",
  email: "",
  fechaNac: "",
  lugarNac: "",
  direccion: "",
  estadoCivil: undefined,
  ocupacion: "",
  escolaridad: "",

  seCongrega: "no",
  diaCongrega: "",
  tiempoIglesia: "",
  invito: "",
  pastor: "",

  nacimientoEspiritu: undefined,
  bautizoAgua: undefined,
  bautismoEspiritu: undefined,
  tieneBiblia: false,
  ayuna: undefined,

  aspectoFeliz: false,
  muyInteresado: false,
  interviene: false,
  cambiosFisicos: "",
  notas: "",

  promovido: undefined,
  foto: null,
};

export default function EntrevistaPage() {
  // --- Validación inline premium ---
  function validateNombre(v: string) {
    if (!v || v.trim().length < 3) return 'Nombre es obligatorio (mín. 3).';
  }
  function validateCedula(v: string) {
    if (!v || v.trim().length < 5) return 'Cédula es obligatoria (mín. 5).';
  }
  function validateEmail(v: string) {
    if (!v) return undefined; // email opcional
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    if (!ok) return 'Email no válido.';
  }
  function validateTelefono(v: string) {
    if (!v) return undefined;
    if (v.replace(/\D/g, "").length < 7) return 'Teléfono no válido.';
  }
  function validateFechaNac(v: string) {
    if (!v || v.trim().length < 1) return 'Fecha de nacimiento es obligatoria.';
  }
  function validateDireccion(v: string) {
    if (!v || v.trim().length < 3) return 'Dirección es obligatoria (mín. 3).';
  }

/* =========================================
   Hooks premium 2025: autosave + scrollspy
========================================= */
function useAutoSave<T>(key: string, state: T, setState: (v: T) => void) {
  // hidrata al cargar
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setState({ ...(JSON.parse(raw) as T) });
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // guarda con debounce
  const timeout = useRef<number | null>(null);
  useEffect(() => {
    if (timeout.current) window.clearTimeout(timeout.current);
    timeout.current = window.setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch {}
    }, 450);
    return () => {
      if (timeout.current) window.clearTimeout(timeout.current);
    };
  }, [key, state]);
}

function useScrollSpy(ids: string[]) {
  const [active, setActive] = useState<string>(ids[0] ?? "");
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (a.target as HTMLElement).offsetTop - (b.target as HTMLElement).offsetTop);
        if (vis[0]) setActive(`#${vis[0].target.id}`);
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0.01 }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [ids]);
  return active;
}

/* =========================================
   Variants framer-motion
========================================= */
const REVEAL = {
  initial: { clipPath: "inset(0 0 100% 0 round 24px)", opacity: 0.6 },
  animate: { clipPath: "inset(0 0 0% 0 round 24px)", opacity: 1, transition: { duration: 0.75, ease: [0.42, 0, 0.58, 1] as [number, number, number, number] } },
};
const SECTION = {
  initial: { y: 28, opacity: 0, scale: 0.98 },
  animate: { y: 0, opacity: 1, scale: 1, transition: { duration: 0.6, type: "spring" as const, bounce: 0.22 } },
};

// ...existing code...

  // Determina si una sección está completa (puedes ajustar la lógica según tus reglas)
  function isSeccionCompleta(seccion: string): boolean {
    if (seccion === 'personales') {
      return (
        !!values.nombre &&
        !!values.cedula &&
        !!values.fechaNac &&
        !!values.lugarNac &&
        !!values.direccion &&
        !!values.estadoCivil &&
        !!values.ocupacion &&
        !!values.escolaridad
      );
    }
    if (seccion === 'generales') {
      if (values.seCongrega === 'si') {
        return (
          !!values.diaCongrega &&
          !!values.tiempoIglesia &&
          !!values.invito &&
          !!values.pastor
        );
      }
      if (values.seCongrega === 'no') {
        return true;
      }
      // If seCongrega is undefined or not set, section is not complete
      return false;
    }
    if (seccion === 'espirituales') {
      return (
        !!values.nacimientoEspiritu &&
        !!values.bautizoAgua &&
        !!values.bautismoEspiritu &&
        typeof values.tieneBiblia === 'boolean' &&
        !!values.ayuna
      );
    }
    if (seccion === 'evaluacion') {
      return (
  typeof values.aspectoFeliz === 'boolean' &&
  typeof values.muyInteresado === 'boolean' &&
  typeof values.interviene === 'boolean' &&
  values.cambiosFisicos !== undefined &&
  values.promovido !== undefined &&
  values.notas !== undefined &&
  values.cambiosFisicos !== '' &&
  values.notas !== ''
      );
    }
    return false;
  }
  // --- Animación premium entre secciones ---
  type Seccion = "personales" | "generales" | "espirituales" | "evaluacion";
  const [seccion, setSeccion] = useState<Seccion>("personales");
  const [direccion, setDireccion] = useState<1 | -1>(1); // 1 → adelante, -1 → atrás
  const reduceMotion = useReducedMotion();

  const slideVariants = {
    enter: (dir: 1 | -1) => ({
      x: reduceMotion ? 0 : dir > 0 ? "100%" : "-100%",
      opacity: reduceMotion ? 1 : 0,
      filter: reduceMotion ? "none" : "blur(6px)",
    }),
    center: {
      x: 0,
      opacity: 1,
      filter: "blur(0px)",
      transition: {
        type: "spring" as const,
        stiffness: 420,
        damping: 38,
        mass: 0.8,
      },
    },
    exit: (dir: 1 | -1) => ({
      x: reduceMotion ? 0 : dir > 0 ? "-12%" : "12%",
      opacity: reduceMotion ? 1 : 0,
      filter: reduceMotion ? "none" : "blur(6px)",
      transition: {
        duration: 0.32,
        ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
      },
    }),
  };

  function irA(next: Seccion, dir: 1 | -1 = 1) {
    if (next === seccion) return;
    setDireccion(dir);
    setSeccion(next);
  }
  const [values, setValues] = useState<FormValues>({ ...INITIAL });
 
 
 // ⛔️ elimina el uso de { backgroundColor: "white" }
// ✅ recortamos y luego “horneamos” fondo blanco con canvas

const [procesandoFoto, setProcesandoFoto] = useState(false);

/** Pega un PNG con transparencia sobre fondo blanco y devuelve un File JPG liviano */
async function pegarSobreBlanco(blob: Blob, nombreBase: string): Promise<File> {
  const img = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  const outBlob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b as Blob), "image/jpeg", 0.92)
  );
  return new File([outBlob], `${nombreBase}_white.jpg`, { type: "image/jpeg" });
}

/** Recorta fondo con IMG.LY y devuelve un File con fondo BLANCO ya aplicado */
async function aFondoBlanco(file: File): Promise<File> {
  // 1) recorte (PNG con transparencia)
  const cutBlob = await removeBackground(file, {
    // opcional: formateo de salida del recorte
    output: { format: "image/png" },
    // puedes añadir `model: "isnet"` si lo deseas; respeta los tipos
  });

  // 2) hornear en blanco con canvas
  const base = file.name.replace(/\.[^/.]+$/, "");
  return await pegarSobreBlanco(cutBlob as Blob, base);
}

/** Maneja Archivo/Cámara y guarda la foto con fondo blanco en tu estado */
async function handleFotoAutoWhite(e: React.ChangeEvent<HTMLInputElement>) {
  const f = e.target.files?.[0];
  if (!f) return;
  try {
    setProcesandoFoto(true);
    const whiteFile = await aFondoBlanco(f);
    setValues((v) => ({ ...v, foto: whiteFile })); // tu lógica existente
  } finally {
    setProcesandoFoto(false);
  }
}

 
 
 
 
 
 
 
 
 
 
 
 
  // Eliminado errores globales
  const [okMsg, setOkMsg] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  // refs para enfoque de error
  const fieldRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>>({});

  // --- Validación: un solo error a la vez ---
  const [activeError, setActiveError] = useState<ActiveError>(null);
  function clearActiveErrorFor(key: FieldKey) {
    if (activeError?.key === key) setActiveError(null);
  }
  function vNombre(v: string) {
    if (!v || v.trim().length < 3) return 'Nombre es obligatorio (mín. 3).';
  }
  function vCedula(v: string) {
    if (!v || v.trim().length < 5) return 'Cédula es obligatoria (mín. 5).';
  }
  function vEmail(v: string) {
    if (!v) return undefined;
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    if (!ok) return 'Email no válido.';
  }
  function vFecha(v: string) {
    if (!v) return 'Fecha de nacimiento es obligatoria.';
  }
  function validateField(key: FieldKey, values: typeof INITIAL): string | undefined {
    const v = (values as any)[key];
    switch (key) {
      case 'nombre': return vNombre(v);
      case 'cedula': return vCedula(v);
      case 'email':  return vEmail(v);
      case 'fechaNac': return vFecha(v);
      // agrega más si aplica
      default: return undefined;
    }
  }
  const VALIDATION_ORDER: FieldKey[] = ['nombre','cedula','email','fechaNac','direccion'];
  function validateFirstInvalid(values: typeof INITIAL): ActiveError {
    for (const k of VALIDATION_ORDER) {
      const msg = validateField(k, values);
      if (msg) return { key: k, msg };
    }
    return null;
  }

  // autosave premium
  useAutoSave<FormValues>("entrevistaDraft:v1", values, (v) => setValues(v));

  // Scroll-spy
  const SECTIONS = ["s-personal", "s-general", "s-espirituales", "s-evaluacion"];
  const activeAnchor = useScrollSpy(SECTIONS);

  const onChange = <K extends keyof FormValues>(key: K, v: FormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const focusField = (key?: keyof FormValues) => {
    if (!key) return;
    const el = fieldRefs.current[String(key)];
    el?.focus();
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    // flash
    el?.classList.add("ring-error-flash");
    setTimeout(() => el?.classList.remove("ring-error-flash"), 700);
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOkMsg('');
    const first = validateFirstInvalid(values);
    if (first) {
      setActiveError(first);
      const el = document.querySelector<HTMLElement>(`[data-field="${first.key}"]`);
      if (el) {
        el.focus({ preventScroll: true });
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    try {
      setSaving(true);
      await guardarEntrevista(values, values.foto ?? undefined);
      setOkMsg('Guardado con éxito.');
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 1700);
      // opcional: reset
      // setValues({ ...INITIAL }); setActiveError(null);
    } catch (err: any) {
      setActiveError({ key: 'nombre', msg: err?.message ?? 'Error al guardar.' });
    } finally {
      setSaving(false);
    }
  }

  const previewFoto = useMemo(() => {
    if (!values.foto || !(values.foto instanceof File)) return "";
    const url = URL.createObjectURL(values.foto);
    return url;
  }, [values.foto]);

  // Limpieza del objeto URL para evitar memory leaks
  useEffect(() => {
    let url: string | undefined;
    if (values.foto && values.foto instanceof File) {
      url = URL.createObjectURL(values.foto);
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [values.foto]);

  // Atajos: Guardar (Ctrl/Cmd+S) y saltos rápidos
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        (document.getElementById("btn-guardar") as HTMLButtonElement | null)?.click();
      }
      if (e.shiftKey && e.key === "2") {
        document.querySelector<HTMLAnchorElement>('a[href="#s-espirituales"]')?.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Drag & drop sobre la tarjeta de foto
  const dropRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const over = (ev: DragEvent) => { ev.preventDefault(); el.classList.add("drop-on"); };
    const leave = () => el.classList.remove("drop-on");
    const drop = (ev: DragEvent) => {
      ev.preventDefault();
      el.classList.remove("drop-on");
      const file = ev.dataTransfer?.files?.[0];
      if (file && file.type.startsWith("image/")) onChange("foto", file);
    };
    el.addEventListener("dragover", over); el.addEventListener("dragleave", leave); el.addEventListener("drop", drop);
    return () => { el.removeEventListener("dragover", over); el.removeEventListener("dragleave", leave); el.removeEventListener("drop", drop); };
  }, []);

  /* UI */
  return (
    <main
      className="min-h-screen w-full fixed inset-0 overflow-hidden pt-4 md:pt-6 pb-8"
      style={{
        backgroundImage: `
          linear-gradient(135deg, 
            rgba(248,250,252,1) 0%, 
            rgba(219,234,254,0.7) 30%, 
            rgba(165,180,252,0.5) 60%, 
            rgba(129,140,248,0.6) 100%
          ),
          radial-gradient(circle at 20% 30%, rgba(255,255,255,0.6) 0%, transparent 40%),
          radial-gradient(circle at 80% 70%, rgba(199,210,254,0.4) 0%, transparent 50%),
          radial-gradient(circle at 40% 80%, rgba(224,231,255,0.3) 0%, transparent 60%)
        `,
        backgroundAttachment: 'fixed',
        backgroundSize: 'cover',
        minHeight: '100vh',
        minWidth: '100vw',
        top: 0,
        left: 0,
        zIndex: 0,
      }}
    >
      {/* Contenedor principal con reveal */}
      <motion.div
        variants={REVEAL}
        initial="initial"
        animate="animate"
        className="mx-auto max-w-6xl supports-[backdrop-filter]:backdrop-blur-2xl ring-1 ring-white/60 rounded-3xl shadow-[0_28px_88px_-28px_rgba(15,23,42,0.28)]"
        style={{
          background: 'rgba(255,255,255,0.18)',
          backdropFilter: 'blur(24px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.2)',
          boxShadow: '0 28px 88px -28px rgba(15,23,42,0.28)',
          marginTop: 0,
        }}
      >
        {/* Header */}
        <header className="px-5 md:px-8 py-4 md:py-5 flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-[2.1rem] md:text-[2.4rem] font-extrabold tracking-tight text-slate-900 leading-tight">
              Formulario de Entrevista
            </h1>
            <p className="text-[.98rem] text-slate-600 font-medium mt-1">Etapa: Restauración</p>
          </div>

          {/* Estado rápido */}
          <div className="hidden md:flex items-center gap-3">
            <div className="h-10 px-4 rounded-full bg-white/70 ring-1 ring-white shadow-[0_8px_24px_-12px_rgba(99,102,241,.25)] flex items-center gap-2">
              <span className={`size-2 rounded-full ${saving ? "bg-amber-400 animate-pulse" : "bg-emerald-500"}`} />
              <span className="text-sm text-slate-700">{saving ? "Guardando borrador…" : "Borrador seguro"}</span>
            </div>
          </div>
        </header>

        {/* Contenido en dos columnas: formulario + nav sticky */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4 md:gap-6 px-4 md:px-6 pb-5 h-[80vh] min-h-0">
          {/* Formulario */}
          <form id="form-entrevista" onSubmit={onSubmit} className="space-y-6 md:space-y-8 flex flex-col h-full min-h-0">


            <AnimatePresence>
              {okMsg && (
                <motion.div
                  initial={{ y: -8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -8, opacity: 0 }}
                  className="rounded-xl border border-emerald-200/80 bg-emerald-50/70 text-emerald-700 p-3"
                >
                  {okMsg}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Animación premium entre secciones */}
            <div className="relative overflow-hidden rounded-2xl bg-white/60 ring-1 ring-white/60 supports-[backdrop-filter]:backdrop-blur-2xl shadow-[0_24px_80px_-24px_rgba(15,23,42,0.18)] p-4 md:p-6 flex-1 min-h-0">
              <AnimatePresence mode="sync" custom={direccion} initial={false}>
                <motion.div
                  key={seccion}
                  custom={direccion}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="absolute inset-0 transform-gpu will-change-transform will-change-[filter,opacity] h-full min-h-0 max-h-full overflow-y-auto pr-2 section-scroll-fix"
                >
                  {seccion === 'personales' && (
                    <section id="s-personal" className="card-premium p-4 md:p-6">
                      <h2 className="h2-premium">Información personal</h2>
                      <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-6">
                        {/* Foto */}
                        <div className="flex flex-col items-center gap-3">
                         <div
  ref={dropRef}
  className="w-40 h-40 rounded-2xl bg-slate-100 ring-1 ring-slate-200 overflow-hidden flex items-center justify-center photo-drop relative" // <-- + relative
  title="Arrastra una imagen o haz clic para seleccionar"
  onClick={() => document.getElementById('file-foto')?.click()}
  role="button"
  tabIndex={0}
  aria-busy={procesandoFoto ? true : undefined}
>
  {previewFoto ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={previewFoto} alt="foto" className="w-full h-full object-cover" />
  ) : (
    <div className="text-center text-slate-400 text-xs leading-tight">
      Arrastra o <span className="underline">sube</span> tu foto
    </div>
  )}

  {/* Overlay mientras se procesa la foto */}
  {procesandoFoto && (
    <div className="absolute inset-0 grid place-items-center bg-white/70 backdrop-blur-sm text-slate-700 text-xs font-semibold">
      Procesando foto…
    </div>
  )}
</div>

                          {/* === REEMPLAZO: controles de archivo/cámara con íconos Mac-2025 === */}

{/* Inputs ocultos (evita “sin archivo seleccionados”) */}
<input
  id="file-foto"
  type="file"
  accept="image/*"
  style={{ display: "none" }}
  onChange={handleFotoAutoWhite}
/>

<input
  id="file-foto-cam"
  type="file"
  accept="image/*"
  capture="environment"
  style={{ display: "none" }}
  onChange={handleFotoAutoWhite}
/>


{/* Botonera premium */}
<div className="flex w-full items-center justify-center gap-3">
  {/* Botón: Archivo */}
  <button
    type="button"
    onClick={() => document.getElementById("file-foto")?.click()}
    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/70 ring-1 ring-white/60 shadow-[0_10px_28px_-14px_rgba(15,23,42,.25)] hover:scale-[1.02] transition-transform select-none"
    aria-label="Seleccionar archivo de imagen"
  >
    {/* Ícono Archivo (estilo mac 2025) */}
    <svg width="22" height="22" viewBox="0 0 24 24" className="text-slate-700" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 3h6l4 4v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M13 3v4h4" />
    </svg>
    <span className="text-sm font-semibold text-slate-700">Archivo</span>
  </button>

  {/* Botón: Cámara */}
  <button
    type="button"
    onClick={() => document.getElementById("file-foto-cam")?.click()}
    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 text-white font-semibold shadow-[0_10px_28px_-14px_rgba(99,102,241,.45)] hover:scale-[1.02] transition-transform select-none"
    aria-label="Tomar foto con cámara"
  >
    {/* Ícono Cámara (estilo mac 2025) */}
    <svg width="22" height="22" viewBox="0 0 24 24" className="text-white" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 8h3l2-2h6l2 2h3a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
    <span className="text-sm">Cámara</span>
  </button>
</div>
                        </div>
                        {/* Campos personales */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Field label="Nombre y apellidos *" icon="user">
                            <div className="relative">
                              <input
                                data-field="nombre"
                                ref={el => { fieldRefs.current["nombre"] = el; }}
                                className={`input-base ${activeError?.key === 'nombre' ? 'ring-2 ring-rose-400 focus:ring-rose-500' : ''}`}
                                placeholder="Ej: Juan Pérez"
                                value={values.nombre}
                                onChange={e => { setValues(v => ({ ...v, nombre: e.target.value })); clearActiveErrorFor('nombre'); }}
                                onBlur={e => {
                                  const msg = vNombre(e.target.value);
                                  setActiveError(msg ? { key: 'nombre', msg } : (activeError?.key === 'nombre' ? null : activeError));
                                }}
                              />
                              {activeError?.key === 'nombre' && (
                                <div className="error-tooltip">
                                  <span className="error-dot" aria-hidden="true">!</span>
                                  {activeError.msg}
                                </div>
                              )}
                            </div>
                          </Field>
                          <Field label="Cédula *" icon="id">
                            <div className="relative">
                              <input
                                data-field="cedula"
                                ref={el => { fieldRefs.current["cedula"] = el; }}
                                className={`input-base ${activeError?.key === 'cedula' ? 'ring-2 ring-rose-400 focus:ring-rose-500' : ''}`}
                                placeholder="Ej: 1234567890"
                                value={values.cedula}
                                onChange={e => { setValues(v => ({ ...v, cedula: e.target.value })); clearActiveErrorFor('cedula'); }}
                                onBlur={e => {
                                  const msg = vCedula(e.target.value);
                                  setActiveError(msg ? { key: 'cedula', msg } : (activeError?.key === 'cedula' ? null : activeError));
                                }}
                              />
                              {activeError?.key === 'cedula' && (
                                <div className="error-tooltip">
                                  <span className="error-dot" aria-hidden="true">!</span>
                                  {activeError.msg}
                                </div>
                              )}
                            </div>
                          </Field>
                          <Field label="Teléfono" icon="phone">
                            <div className="relative">
                              <input
                                data-field="telefono"
                                ref={el => { fieldRefs.current["telefono"] = el; }}
                                className="input-base"
                                placeholder="Ej: 3001234567"
                                inputMode="tel"
                                value={values.telefono ?? ""}
                                onChange={e => setValues(v => ({ ...v, telefono: e.target.value }))}
                              />
                            </div>
                          </Field>
                          <Field label="Email" icon="mail">
                            <div className="relative">
                              <input
                                data-field="email"
                                ref={el => { fieldRefs.current["email"] = el; }}
                                className={`input-base ${activeError?.key === 'email' ? 'ring-2 ring-rose-400 focus:ring-rose-500' : ''}`}
                                placeholder="ejemplo@correo.com"
                                inputMode="email"
                                value={values.email ?? ""}
                                onChange={e => { setValues(v => ({ ...v, email: e.target.value })); clearActiveErrorFor('email'); }}
                                onBlur={e => {
                                  const msg = vEmail(e.target.value);
                                  setActiveError(msg ? { key: 'email', msg } : (activeError?.key === 'email' ? null : activeError));
                                }}
                              />
                              {activeError?.key === 'email' && (
                                <div className="error-tooltip">
                                  <span className="error-dot" aria-hidden="true">!</span>
                                  {activeError.msg}
                                </div>
                              )}
                            </div>
                          </Field>
                          <Field label="Fecha de nacimiento" icon="clock">
                            <div className="relative">
                              <input
                                data-field="fechaNac"
                                ref={el => { fieldRefs.current["fechaNac"] = el; }}
                                type="date"
                                className={`input-base ${activeError?.key === 'fechaNac' ? 'ring-2 ring-rose-400 focus:ring-rose-500' : ''}`}
                                value={values.fechaNac ?? ""}
                                onChange={e => { setValues(v => ({ ...v, fechaNac: e.target.value })); clearActiveErrorFor('fechaNac'); }}
                                onBlur={e => {
                                  const msg = vFecha(e.target.value);
                                  setActiveError(msg ? { key: 'fechaNac', msg } : (activeError?.key === 'fechaNac' ? null : activeError));
                                }}
                              />
                              {activeError?.key === 'fechaNac' && (
                                <div className="error-tooltip">
                                  <span className="error-dot" aria-hidden="true">!</span>
                                  {activeError.msg}
                                </div>
                              )}
                            </div>
                          </Field>
                          <Field label="Lugar de nacimiento" icon="pin">
                            <input
                              ref={el => { fieldRefs.current["lugarNac"] = el; }}
                              className="input-premium"
                              placeholder="Ciudad - Departamento"
                              value={values.lugarNac ?? ""}
                              onChange={(e) => onChange("lugarNac", e.target.value)}
                            />
                          </Field>
                          <Field label="Dirección" icon="home" full>
                            <div className="relative">
                              <input
                                data-field="direccion"
                                ref={el => { fieldRefs.current["direccion"] = el; }}
                                className={`input-base ${activeError?.key === 'direccion' ? 'ring-2 ring-rose-400 focus:ring-rose-500' : ''}`}
                                placeholder="Calle/Carrera, número, barrio, localidad"
                                value={values.direccion ?? ""}
                                onChange={e => { setValues(v => ({ ...v, direccion: e.target.value })); clearActiveErrorFor('direccion'); }}
                                onBlur={e => {
                                  const msg = validateField('direccion', { ...values, direccion: e.target.value });
                                  setActiveError(msg ? { key: 'direccion', msg } : (activeError?.key === 'direccion' ? null : activeError));
                                }}
                              />
                              {activeError?.key === 'direccion' && (
                                <div className="error-tooltip">
                                  <span className="error-dot" aria-hidden="true">!</span>
                                  {activeError.msg}
                                </div>
                              )}
                            </div>
                          </Field>
                          <Field label="Estado civil" icon="heart">
                            <select
                              ref={el => { fieldRefs.current["estadoCivil"] = el; }}
                              className="input-premium"
                              value={values.estadoCivil ?? ""}
                              onChange={(e) => onChange("estadoCivil", (e.target.value || undefined) as EstadoCivil | undefined)}
                            >
                              <option value="">Seleccione</option>
                              {ESTADOS.map((ec) => (
                                <option key={ec} value={ec}>{ec === "union" ? "Unión libre" : ec.charAt(0).toUpperCase() + ec.slice(1)}</option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Ocupación" icon="brief">
                            <input
                              ref={el => { fieldRefs.current["ocupacion"] = el; }}
                              className="input-premium"
                              placeholder="Profesión/Oficio"
                              value={values.ocupacion ?? ""}
                              onChange={(e) => onChange("ocupacion", e.target.value)}
                            />
                          </Field>
                          <Field label="Escolaridad" icon="cap" full>
                            <select
                              ref={el => { fieldRefs.current["escolaridad"] = el; }}
                              className="input-premium"
                              value={values.escolaridad ?? ""}
                              onChange={(e) => onChange("escolaridad", e.target.value)}
                            >
                              <option value="">Seleccione</option>
                              {ESCOLARIDAD.map((op) => (
                                <option key={op} value={op}>{op}</option>
                              ))}
                            </select>
                          </Field>
                        </div>
                      </div>
                    </section>
                  )}
                  {seccion === 'generales' && (
                    <section id="s-general" className="card-premium p-4 md:p-6">
                      <h2 className="h2-premium">Información general</h2>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="label-premium">¿Se está congregando? *</label>
                          <div className="flex gap-3 flex-wrap">
                            <Chip checked={values.seCongrega === "si"} onClick={() => onChange("seCongrega", "si")}>Sí</Chip>
                            <Chip checked={values.seCongrega === "no"} onClick={() => onChange("seCongrega", "no")}>No</Chip>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="label-premium">¿Qué día?</label>
                          <select
                            ref={el => { fieldRefs.current["diaCongrega"] = el; }}
                            className="input-premium disabled:opacity-60"
                            disabled={values.seCongrega !== "si"}
                            value={values.diaCongrega ?? ""}
                            onChange={(e) => onChange("diaCongrega", (e.target.value || "") as Dia | "")}
                          >
                            <option value="">{values.seCongrega === "si" ? "Seleccione" : "No aplica"}</option>
                            {DIAS.map((d) => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                        </div>
                        <Field label="Tiempo en la iglesia" icon="time">
                          <input
                            className="input-premium"
                            placeholder="Ej: 6 meses, 2 años"
                            value={values.tiempoIglesia ?? ""}
                            onChange={(e) => onChange("tiempoIglesia", e.target.value)}
                          />
                        </Field>
                        <Field label="¿Quién lo invitó?" icon="user2">
                          <input
                            className="input-premium"
                            placeholder="Nombre del servidor que invitó"
                            value={values.invito ?? ""}
                            onChange={(e) => onChange("invito", e.target.value)}
                          />
                        </Field>
                        <Field label="Pastor" icon="pastor">
                          <input
                            className="input-premium"
                            placeholder="Nombre del pastor"
                            value={values.pastor ?? ""}
                            onChange={(e) => onChange("pastor", e.target.value)}
                          />
                        </Field>
                      </div>
                    </section>
                  )}
                  {seccion === 'espirituales' && (
                    <section id="s-espirituales" className="card-premium p-4 md:p-6">
                      <h2 className="h2-premium">Datos espirituales</h2>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="label-premium">¿Nuevo nacimiento?</label>
                          <div className="flex gap-3 flex-wrap">
                            {(["si","no","no_sabe"] as const).map((op) => (
                              <Chip key={op} checked={values.nacimientoEspiritu === op} onClick={() => onChange("nacimientoEspiritu", op)}>
                                {op === "no_sabe" ? "No sabe" : op.toUpperCase()}
                              </Chip>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="label-premium">¿Bautizado en agua?</label>
                          <div className="flex gap-3">
                            {(["si","no"] as const).map((op) => (
                              <Chip key={op} checked={values.bautizoAgua === op} onClick={() => onChange("bautizoAgua", op)}>
                                {op.toUpperCase()}
                              </Chip>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="label-premium">¿Bautismo del Espíritu?</label>
                          <div className="flex gap-3">
                            {(["si","no"] as const).map((op) => (
                              <Chip key={op} checked={values.bautismoEspiritu === op} onClick={() => onChange("bautismoEspiritu", op)}>
                                {op.toUpperCase()}
                              </Chip>
                            ))}
                          </div>
                        </div>
                        <label className="flex items-center gap-2 md:col-span-1">
                          <input
                            id="tieneBiblia"
                            type="checkbox"
                            checked={values.tieneBiblia}
                            onChange={(e) => onChange("tieneBiblia", e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          <span className="text-sm text-slate-700">Tiene Biblia</span>
                        </label>
                        <div className="flex flex-col gap-1.5">
                          <label className="label-premium">¿Ayuna?</label>
                          <div className="flex gap-3">
                            {(["si","no"] as const).map((op) => (
                              <Chip key={op} checked={values.ayuna === op} onClick={() => onChange("ayuna", op)}>
                                {op.toUpperCase()}
                              </Chip>
                            ))}
                          </div>
                        </div>
                      </div>
                    </section>
                  )}
                  {seccion === 'evaluacion' && (
                    <section id="s-evaluacion" className="card-premium p-4 md:p-6">
                      <h2 className="h2-premium">Evaluación y observaciones</h2>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Toggle label="Tiene aspecto feliz" checked={values.aspectoFeliz} onChange={(v: boolean) => onChange("aspectoFeliz", v)} />
                        <Toggle label="Muy interesado en el conocimiento" checked={values.muyInteresado} onChange={(v: boolean) => onChange("muyInteresado", v)} />
                        <Toggle label="Interviene y opina en las clases" checked={values.interviene} onChange={(v: boolean) => onChange("interviene", v)} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <Field label="Cambios físicos / observaciones" icon="note">
                          <input
                            ref={el => { fieldRefs.current["cambiosFisicos"] = el; }}
                            className="input-premium"
                            placeholder="Normal o detalla observaciones"
                            value={values.cambiosFisicos ?? ""}
                            onChange={(e) => onChange("cambiosFisicos", e.target.value)}
                          />
                        </Field>
                        <div className="flex flex-col gap-1.5">
                          <label className="label-premium">Promovido</label>
                          <div className="flex gap-3">
                            {(["si","no"] as const).map((op) => (
                              <Chip key={op} checked={values.promovido === op} onClick={() => onChange("promovido", op)}>
                                {op.toUpperCase()}
                              </Chip>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5 md:col-span-2">
                          <label className="label-premium">Notas del maestro</label>
                          <textarea
                            ref={el => { fieldRefs.current["notas"] = el; }}
                            className="input-premium min-h-[120px] resize-y"
                            placeholder="Escribe aquí notas relevantes"
                            value={values.notas ?? ""}
                            onChange={(e) => onChange("notas", e.target.value)}
                          />
                        </div>
                      </div>
                      {/* Botones Guardar y Limpiar solo en móvil, centrados y compactos */}
                      <div className="flex lg:hidden justify-center mt-6 mb-2">
                        <button
                          type="button"
                          onClick={() => { setValues({ ...INITIAL }); setOkMsg(""); }}
                          className="btn-secondary btn-mobile-action mx-2"
                        >
                          Limpiar
                        </button>
                        <button
                          id="btn-guardar-mobile"
                          type="submit"
                          form="form-entrevista"
                          className="btn-primary btn-mobile-action mx-2"
                          disabled={saving}
                        >
                          {saving ? "Guardando…" : "Guardar"}
                        </button>
                      </div>
                    </section>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* FOOTER actions sticky eliminados, botones solo en el aside */}
          </form>

          {/* Aside: nav sticky + tips (solo desktop) */}
          <aside className="hidden lg:block">
            <div className="sticky top-6 space-y-4">
              {/* ...existing code for aside... */}
              <nav className="rounded-2xl bg-white/70 ring-1 ring-white/60 shadow-[0_16px_48px_-18px_rgba(15,23,42,.22)] p-3">
                <p className="text-xs font-semibold text-slate-600 px-2 pb-2">Secciones</p>
                <ul className="space-y-1">
                  <li className="flex items-center gap-2">
                    <button type="button" className={`nav-chip ${seccion === 'personales' ? 'nav-chip-active' : ''}`} onClick={() => irA('personales', -1)}>
                      Información personal
                    </button>
                    {isSeccionCompleta('personales') && (
                      <span className="inline-flex items-center justify-center ml-1">
                        {/* ...existing check icon... */}
                        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_2px_6px_rgba(16,185,129,0.18)]">
                          <circle cx="11" cy="11" r="10" fill="url(#mac2025green)"/>
                          <path d="M7.5 11.5L10 14L15 9" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                          <defs>
                            <linearGradient id="mac2025green" x1="3" y1="3" x2="19" y2="19" gradientUnits="userSpaceOnUse">
                              <stop stopColor="#34d399"/>
                              <stop offset="1" stopColor="#10b981"/>
                            </linearGradient>
                          </defs>
                        </svg>
                      </span>
                    )}
                  </li>
                  <li className="flex items-center gap-2">
                    <button type="button" className={`nav-chip ${seccion === 'generales' ? 'nav-chip-active' : ''}`} onClick={() => irA('generales', seccion === 'personales' ? 1 : -1)}>
                      Información general
                    </button>
                    {isSeccionCompleta('generales') && (
                      <span className="inline-flex items-center justify-center ml-1">
                        {/* ...existing check icon... */}
                        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_2px_6px_rgba(16,185,129,0.18)]">
                          <circle cx="11" cy="11" r="10" fill="url(#mac2025green)"/>
                          <path d="M7.5 11.5L10 14L15 9" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                          <defs>
                            <linearGradient id="mac2025green" x1="3" y1="3" x2="19" y2="19" gradientUnits="userSpaceOnUse">
                              <stop stopColor="#34d399"/>
                              <stop offset="1" stopColor="#10b981"/>
                            </linearGradient>
                          </defs>
                        </svg>
                      </span>
                    )}
                  </li>
                  <li className="flex items-center gap-2">
                    <button type="button" className={`nav-chip ${seccion === 'espirituales' ? 'nav-chip-active' : ''}`} onClick={() => irA('espirituales', seccion === 'evaluacion' ? -1 : 1)}>
                      Datos espirituales
                    </button>
                    {isSeccionCompleta('espirituales') && (
                      <span className="inline-flex items-center justify-center ml-1">
                        {/* ...existing check icon... */}
                        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_2px_6px_rgba(16,185,129,0.18)]">
                          <circle cx="11" cy="11" r="10" fill="url(#mac2025green)"/>
                          <path d="M7.5 11.5L10 14L15 9" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                          <defs>
                            <linearGradient id="mac2025green" x1="3" y1="3" x2="19" y2="19" gradientUnits="userSpaceOnUse">
                              <stop stopColor="#34d399"/>
                              <stop offset="1" stopColor="#10b981"/>
                            </linearGradient>
                          </defs>
                        </svg>
                      </span>
                    )}
                  </li>
                  <li className="flex items-center gap-2">
                    <button type="button" className={`nav-chip ${seccion === 'evaluacion' ? 'nav-chip-active' : ''}`} onClick={() => irA('evaluacion', 1)}>
                      Evaluación y observaciones
                    </button>
                    {isSeccionCompleta('evaluacion') && (
                      <span className="inline-flex items-center justify-center ml-1">
                        {/* ...existing check icon... */}
                        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_2px_6px_rgba(16,185,129,0.18)]">
                          <circle cx="11" cy="11" r="10" fill="url(#mac2025green)"/>
                          <path d="M7.5 11.5L10 14L15 9" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                          <defs>
                            <linearGradient id="mac2025green" x1="3" y1="3" x2="19" y2="19" gradientUnits="userSpaceOnUse">
                              <stop stopColor="#34d399"/>
                              <stop offset="1" stopColor="#10b981"/>
                            </linearGradient>
                          </defs>
                        </svg>
                      </span>
                    )}
                  </li>
                </ul>
              </nav>

              {/* Botones Guardar y Limpiar en fila horizontal */}
              <div className="rounded-2xl bg-gradient-to-br from-indigo-50/80 to-sky-50/80 ring-1 ring-white p-3 flex flex-row gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => { setValues({ ...INITIAL }); setOkMsg(""); }}
                  className="btn-secondary"
                >
                  Limpiar
                </button>
                <button
                  id="btn-guardar"
                  type="submit"
                  form="form-entrevista"
                  className="btn-primary"
                  disabled={saving}
                >
                  {saving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </div>
          </aside>

          {/* Navegación inferior responsive solo móvil */}
          <nav className="lg:hidden fixed bottom-0 left-0 w-full z-50 bg-white/90 border-t border-slate-200 flex justify-between items-center px-2 py-1 shadow-[0_-2px_16px_-6px_rgba(99,102,241,0.10)]">
            {["personales", "generales", "espirituales", "evaluacion"].map((sec, idx) => (
              <button
                key={sec}
                type="button"
                className={`flex-1 mx-1 my-1 rounded-full h-12 flex flex-col items-center justify-center font-bold text-base transition-all duration-150 ${seccion === sec ? 'bg-indigo-500 text-white scale-105 shadow-lg' : 'bg-white text-indigo-500 border border-indigo-200'}`}
                onClick={() => irA(sec as Seccion, 1)}
                aria-label={`Ir a sección ${idx + 1}`}
              >
                <span className="text-xs font-medium mt-0.5" style={{fontSize:'0.72rem'}}>
                  {sec === 'personales' ? 'Personal' : sec === 'generales' ? 'General' : sec === 'espirituales' ? 'Espiritual' : 'Evaluación'}
                </span>
              </button>
            ))}
          </nav>
        </div>
      </motion.div>

      {/* Toast guardado */}
      <AnimatePresence>
        {showSaved && (
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.98 }}
            className="fixed bottom-4 right-4 rounded-xl bg-emerald-600 text-white px-4 py-2 shadow-lg"
          >
            <span className="font-semibold">Guardado</span> · Borrador actualizado
          </motion.div>
        )}
      </AnimatePresence>

      {/* Estilos globales premium 2025 */}
  <style jsx global>{`
        /* Botones compactos para acciones en móvil */
        .btn-mobile-action {
          font-size: 0.98rem;
          padding: 0.55em 1.1em;
          min-width: 90px;
          min-height: 36px;
          border-radius: 12px;
        }
        /* Fix para que el último campo no quede oculto tras la barra inferior en móvil */
        .section-scroll-fix {
          padding-bottom: 1.5rem;
        }
        @media (max-width: 1023px) {
          .section-scroll-fix {
            padding-bottom: 4.5rem;
          }
        }
        /* Navegación inferior responsive */
        nav.lg\\:hidden.fixed.bottom-0 {
          display: flex;
          min-height: 48px;
          height: 52px;
          padding-top: 0.25rem;
          padding-bottom: 0.25rem;
        }
        @media (min-width: 1024px) {
          nav.lg\\:hidden.fixed.bottom-0 {
            display: none !important;
          }
        }
        @media (max-width: 1023px) {
          aside.lg\\:block {
            display: none !important;
          }
        }
        .nav-bottom-btn {
          transition: all 0.16s;
          font-weight: 700;
          border-radius: 999px;
          min-width: 38px;
          min-height: 38px;
          height: 38px;
          max-height: 40px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          padding: 0.25rem 0.25rem 0.1rem 0.25rem;
        }
        .nav-bottom-btn span.text-xs {
          font-size: 0.66rem !important;
        }
        .nav-bottom-btn.active {
          background: linear-gradient(90deg,#6366f1,#0ea5e9);
          color: #fff;
          box-shadow: 0 4px 18px -6px #6366f155;
          transform: scale(1.08);
        }
        .nav-bottom-btn:not(.active) {
          background: #fff;
          color: #6366f1;
          border: 1.5px solid #e0e7ef;
        }
        .nav-bottom-btn span {
          line-height: 1.1;
        }
        :root {
          --mac-accent: #6c63ff;
          --mac-accent2: #5bc2ff;
          --mac-bg: #f8f9fb;
          --mac-glass: rgba(255,255,255,0.72);
          --mac-shadow: 0 8px 40px -12px rgba(108,99,255,0.16), 0 1.5px 8px 0 rgba(108,99,255,0.08);
          --mac-shadow-strong: 0 12px 48px -8px rgba(108,99,255,0.22);
          --mac-radius: 18px;
          --mac-font: 'Inter', 'SF Pro Display', system-ui, sans-serif;
        }
        body { font-family: var(--mac-font); background: var(--mac-bg); }

        /* Contenedores */
        .card-premium{
          border-radius: 22px;
          background: linear-gradient(120deg, var(--mac-glass) 80%, #f3f0ff 100%);
          border: 1.5px solid rgba(226,232,240,.8);
          box-shadow: var(--mac-shadow);
          backdrop-filter: blur(10px);
        }

        /* Encabezados de sección */
        .h2-premium{
          display:flex; align-items:center; gap:.55rem;
          font-weight: 800; color:#1f2a44; font-size:1.15rem; margin-bottom: .9rem;
        }
        .h2-premium::before{
          content:"";
          width:10px; height:10px; border-radius:999px;
          background: linear-gradient(90deg,var(--mac-accent),var(--mac-accent2));
          box-shadow: 0 0 0 6px #6c63ff22, 0 0 0 12px #5bc2ff1a;
        }




        /* Inputs */
       .input-premium{
  width:100%;
  border:0; border-bottom:1.6px solid #e2e8f0;
  border-radius:0; background:transparent;
  padding:.95rem .25rem .7rem;
  font-size:1rem; color:#0b1220; outline:0;
  backdrop-filter:blur(6px);
  transition:border-color .16s, box-shadow .16s, transform .08s;
}



        .input-base{
  width:100%;
  border-radius:16px; border:1px solid #e6e9f2;
  background:linear-gradient(120deg,#fff 70%,#f6f7ff 100%);
  box-shadow: inset 8px 8px 18px #e8ebf5, inset -8px -8px 18px #ffffff;
  padding:.95rem 1.1rem; color:#23223a; outline:0;
  transition:box-shadow .18s, border .18s;
}
       .input-base:focus{
   border-color:#7c7bff;
  box-shadow: inset 12px 12px 26px #e6e9f5, inset -12px -12px 26px #ffffff,
              0 0 0 3px #7c7bff33;
}
        .input-premium:focus{
          border-color: var(--mac-accent);
          box-shadow: 0 0 0 3px #6c63ff33, var(--mac-shadow-strong);
          transform: translateY(-1px);
          animation: macPulse .18s;
        }
       
.input-premium::placeholder{ color:#9aa5b1 }
.input-premium:focus{
  border-bottom-color:#6366f1;
  box-shadow:0 14px 28px -22px rgba(99,102,241,.45), 0 1px 0 0 #6366f1 inset;
  transform:translateY(-1px);
}    


.input-neum-inset{
 
}
.input-neum-inset:focus{
  border-color:#7c7bff;
  box-shadow: inset 12px 12px 26px #e6e9f5, inset -12px -12px 26px #ffffff,
              0 0 0 3px #7c7bff33;
}

       
      




        @keyframes macPulse{0%{box-shadow:0 0 0 0 var(--mac-accent2)}100%{box-shadow:0 0 0 3px #a084ff33}}
        .label-premium{ font-size:.76rem; font-weight:700; color:#6c63ff; letter-spacing:.01em; }





        /* === CHIPS PREMIUM 2025 (selección) === */
.chip{
  --glow: rgba(99,102,241,.18);
  --grad1:#6366F1; --grad2:#0EA5E9;
  --glass: rgba(255,255,255,.72);

  position:relative;
  display:inline-flex; align-items:center; gap:.55em;
  padding:.56em 1.15em;
  border-radius:999px;
  border:1.4px solid #e6e9f2;
  background:
    linear-gradient(#fff,#fff) padding-box,
    linear-gradient(90deg,#eef2ff,#e0f2ff) border-box;
  color:#465066; font-weight:700; font-size:.95rem;
  box-shadow: 0 8px 22px -14px rgba(2,6,23,.18);
  backdrop-filter:saturate(1.05) blur(3px);
  transition: transform .12s, box-shadow .18s, border-color .18s, filter .14s, background .18s;
  cursor:pointer; user-select:none;
}
.chip:hover{ transform: translateY(-1px); filter: brightness(1.03); }
.chip:active{ transform: translateY(0); }

.chip[data-checked="true"]{
  border-color: transparent;
  background:
    linear-gradient(#fff0,#fff0) padding-box,
    linear-gradient(90deg,var(--grad1),var(--grad2)) border-box;
  color:#0b1020;
  box-shadow: 0 10px 28px -12px var(--glow);
}
.chip[data-checked="true"]::before{
  /* brillo interno suave tipo mac */
  content:""; position:absolute; inset:1.6px; border-radius:999px;
  background: radial-gradient(120% 120% at 20% 0%, #ffffff66 0%, transparent 50%);
  pointer-events:none;
}

.chip:focus-visible{
  outline: none;
  box-shadow: 0 0 0 3px #a5b4ff55, 0 10px 28px -12px var(--glow);
}

/* Tamaños (opcional) */
.chip.sm{ padding:.42em .9em; font-size:.88rem }
.chip.lg{ padding:.7em 1.35em; font-size:1.02rem }

/* Estado deshabilitado */
.chip[aria-disabled="true"]{
  opacity:.55; cursor:not-allowed; filter:grayscale(.1);
}






        /* Nav secciones */
    .nav-chip{
  display:block; padding:.55rem .8rem;
  border-radius:12px; color:#334155; font-weight:600;
  background:rgba(255,255,255,0.35);
  box-shadow: 0 1.5px 6px -2px #a5b4fc22;
  border: 1.7px solid #e0e7ef;
  backdrop-filter: blur(4px) saturate(1.05);
  transition: background .18s, filter .14s, box-shadow .18s, border-color .18s;
    }
    .nav-chip:hover{
  background: linear-gradient(90deg,rgba(238,242,255,0.97),rgba(224,242,255,0.97));
  box-shadow: 0 8px 28px -10px var(--mac-accent2, #5bc2ff33), 0 2px 8px -4px #a5b4fc33;
  border: 1.7px solid var(--mac-accent2, #5bc2ff);
  filter: brightness(1.09) saturate(1.13);
    }
        .nav-chip-active{
          background:linear-gradient(90deg,#eef2ff,#e0f2ff);
          color:#1e293b;
          border: 1.7px solid var(--mac-accent2, #5bc2ff);
          box-shadow: 0 8px 28px -10px var(--mac-accent2, #5bc2ff33);
        }

        /* Botones */
        .btn-primary, .btn-secondary {
          display:inline-flex; align-items:center; justify-content:center;
          border-radius: 14px; font-weight: 700; font-size: 1.02rem; padding:.7em 1.6em;
          transition: box-shadow .18s, transform .12s;
        }
        .btn-primary{
          background: linear-gradient(90deg,var(--mac-accent),var(--mac-accent2));
          color:#fff; border:none;
          box-shadow: 0 10px 28px -14px #5bc2ff66, 0 4px 14px -10px #6c63ff66;
        }
        .btn-primary:hover{ transform: translateY(-1px) scale(1.02); }
        .btn-secondary{
          background:#fff; color:#334155; border:1.3px solid #e2e8f0;
          box-shadow:0 6px 18px -10px rgba(2,6,23,.08);
        }
        .btn-secondary:hover{ transform: translateY(-1px); }

        /* KBD tip */
        .kbd{
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size:.75rem; padding:.1rem .45rem; border-radius:.375rem; border:1px solid #cbd5e1; background:#fff; color:#0f172a;
        }

        /* Foto dropzone */
        .photo-drop{ transition: transform .12s, box-shadow .18s; }
        .photo-drop.drop-on{ transform: scale(1.02); box-shadow: 0 0 0 4px #93c5fd88; }

        /* Flash error */
        .ring-error-flash{ box-shadow: 0 0 0 3px #fca5a54d !important; border-color:#ef4444 !important; }

        /* Toggle switch */
        .tgl{ position:relative; inline-size:48px; block-size:28px; border-radius:999px; background:#e2e8f0; transition:background .18s; }
        .tgl::after{
          content:""; position:absolute; inset:3px auto 3px 3px; inline-size:22px; border-radius:999px;
          background:#fff; box-shadow: 0 2px 8px rgba(2,6,23,.15); transition: transform .18s;
        }
        .tgl[data-on="true"]{ background: linear-gradient(90deg,#6366f1,#0ea5e9); }
        .tgl[data-on="true"]::after{ transform: translateX(20px); }
      `}</style>
    </main>
  );
}

/* =========================================
   Subcomponentes UI
========================================= */
function Field({
  label,
  children,
  icon,
  full,
}: {
  label: string;
  children: React.ReactNode;
  icon?: "user"|"id"|"phone"|"mail"|"clock"|"pin"|"home"|"heart"|"brief"|"cap"|"time"|"user2"|"pastor"|"note";
  full?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${full ? "md:col-span-2" : ""}`}>
      <label className="label-premium flex items-center gap-2">
        {icon && <Icon kind={icon} />}
        {label}
      </label>
      {children}
    </div>
  );
}

function Chip({ checked, onClick, children }: { checked: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="chip" data-checked={checked} onClick={onClick} aria-pressed={checked}>
      {children}
    </button>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2.5">
      <span className="text-sm text-slate-700">{label}</span>
      <button type="button" className="tgl" data-on={checked} onClick={() => onChange(!checked)} aria-pressed={checked} />
    </label>
  );
}

function Icon({ kind }: { kind: NonNullable<Parameters<typeof Field>[0]["icon"]> }) {
  const common = "w-4 h-4 text-[#6c63ff]";
  switch (kind) {
    case "user":   return (<svg className={common} viewBox="0 0 20 20" fill="currentColor"><circle cx="10" cy="7" r="3"/><path d="M4 16c0-3 3-5 6-5s6 2 6 5" /></svg>);
    case "id":     return (<svg className={common} viewBox="0 0 20 20" fill="none" stroke="currentColor"><rect x="3" y="4" width="14" height="12" rx="3"/><circle cx="8" cy="10" r="2"/><path d="M12 8h3M12 12h3"/></svg>);
    case "phone":  return (<svg className={common} viewBox="0 0 20 20" fill="none" stroke="currentColor"><path d="M3 4h4l2 4-3 2a12 12 0 0 0 6 6l2-3 4 2v4c0 1-1 2-2 2A15 15 0 0 1 3 6c0-1 1-2 2-2Z" strokeWidth="1.5"/></svg>);
    case "mail":   return (<svg className={common} viewBox="0 0 20 20" fill="none" stroke="currentColor"><rect x="3" y="5" width="14" height="10" rx="2"/><path d="M3 7l7 5 7-5"/></svg>);
    case "clock":  return (<svg className={common} viewBox="0 0 20 20" fill="none" stroke="currentColor"><circle cx="10" cy="10" r="8"/><path d="M10 6v4l3 2"/></svg>);
    case "pin":    return (<svg className={common} viewBox="0 0 20 20" fill="none" stroke="currentColor"><path d="M10 18s6-4.35 6-9a6 6 0 1 0-12 0c0 4.65 6 9 6 9Z"/><circle cx="10" cy="9" r="2.5"/></svg>);
    case "home":   return (<svg className={common} viewBox="0 0 20 20" fill="none" stroke="currentColor"><path d="M3 9.5 10 3l7 6.5v7.5a1 1 0 0 1-1 1h-4v-6H8v6H4a1 1 0 0 1-1-1Z"/></svg>);
    case "heart":  return (<svg className={common} viewBox="0 0 20 20" fill="currentColor"><path d="M10 17s-6-3.5-6-8a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.5-6 8-6 8Z"/></svg>);
    case "brief":  return (<svg className={common} viewBox="0 0 20 20" fill="none" stroke="currentColor"><rect x="3" y="6" width="14" height="10" rx="2"/><path d="M7 6V5a3 3 0 0 1 6 0v1"/></svg>);
    case "cap":    return (<svg className={common} viewBox="0 0 20 20" fill="none" stroke="currentColor"><path d="M2 9l8-4 8 4-8 4-8-4Z"/><path d="M6 11v3c2.5 1.5 5.5 1.5 8 0v-3"/></svg>);
    case "time":   return (<svg className={common} viewBox="0 0 20 20" fill="none" stroke="currentColor"><circle cx="10" cy="10" r="8"/><path d="M10 5v5l3 2"/></svg>);
    case "user2":  return (<svg className={common} viewBox="0 0 20 20" fill="currentColor"><circle cx="7" cy="7" r="3"/><circle cx="14" cy="11" r="2.5"/><path d="M2.5 16c0-2.3 2.7-4 6-4s6 1.7 6 4"/></svg>);
    case "pastor": return (<svg className={common} viewBox="0 0 20 20" fill="none" stroke="currentColor"><path d="M10 2v6M7 5h6"/><circle cx="10" cy="12" r="3"/><path d="M4 18c1.5-3 4-4 6-4s4.5 1 6 4"/></svg>);

    case "note":   return (<svg className={common} viewBox="0 0 20 20" fill="none" stroke="currentColor"><rect x="4" y="3" width="12" height="14" rx="2"/><path d="M7 7h6M7 10h6M7 13h4"/></svg>);
  }
}

