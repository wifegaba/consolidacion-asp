"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* =========================================
   Tipos y esquema (sin libs externas)
========================================= */
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

function validar(values: FormValues): { ok: boolean; errors: string[]; firstKey?: keyof FormValues } {
  const errs: string[] = [];
  let firstKey: keyof FormValues | undefined;

  const push = (key: keyof FormValues, msg: string) => {
    if (!firstKey) firstKey = key;
    errs.push(msg);
  };

  if (!values.nombre || values.nombre.trim().length < 3)
    push("nombre", "Nombre es obligatorio (mín. 3).");
  if (!values.cedula || values.cedula.trim().length < 5)
    push("cedula", "Cédula es obligatoria (mín. 5).");
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))
    push("email", "Email no válido.");
  if (values.telefono && values.telefono.replace(/\D/g, "").length < 7)
    push("telefono", "Teléfono no válido.");
  if (values.seCongrega === "si" && !values.diaCongrega)
    push("diaCongrega", "Selecciona el día en que se congrega.");

  return { ok: errs.length === 0, errors: errs, firstKey };
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

/* =========================================
   Página
========================================= */
export default function EntrevistaPage() {
  const [values, setValues] = useState<FormValues>({ ...INITIAL });
  const [errores, setErrores] = useState<string[]>([]);
  const [okMsg, setOkMsg] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  // refs para enfoque de error
  const fieldRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>>({});

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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrores([]);
    setOkMsg("");

    const { ok, errors, firstKey } = validar(values);
    if (!ok) {
      setErrores(errors);
      focusField(firstKey);
      return;
    }

    try {
      setSaving(true);
      // TODO: Conectar a tu backend real:
      // await fetch("/api/entrevista", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      await new Promise((r) => setTimeout(r, 600)); // demo delay
      setOkMsg("Guardado con éxito.");
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 1700);
    } catch {
      setErrores(["Error al guardar. Intenta de nuevo."]);
    } finally {
      setSaving(false);
    }
  };

  const previewFoto = useMemo(() => {
    if (!values.foto) return "";
    return URL.createObjectURL(values.foto);
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
      className="min-h-[100dvh] relative overflow-clip"
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
      }}
    >
      {/* Contenedor principal con reveal y fondo premium */}
      <motion.div
        variants={REVEAL}
        initial="initial"
        animate="animate"
        className="mx-auto max-w-6xl supports-[backdrop-filter]:backdrop-blur-2xl ring-1 ring-white/60 rounded-3xl shadow-[0_28px_88px_-28px_rgba(15,23,42,0.28)] mt-6 md:mt-10"
        style={{
          backgroundImage: `
            linear-gradient(135deg, 
              rgba(248,250,252,1) 0%, 
              rgba(219,234,254,0.7) 30%, 
              rgba(165,180,252,0.5) 60%, 
              rgba(129,140,248,0.6) 100%
            ),
            radial-gradient(circle at 20% 30%, rgba(255,255,255,0.6) 0%, transparent 40%)
          `,
          backgroundAttachment: 'fixed',
          backgroundSize: 'cover',
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
  <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr_260px] gap-4 md:gap-6 px-4 md:px-6 pb-5">
          {/* Formulario */}
          <form onSubmit={onSubmit} className="space-y-6 md:space-y-8">
            {/* Alertas */}
            <AnimatePresence>
              {errores.length > 0 && (
                <motion.div
                  initial={{ y: -10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -10, opacity: 0 }}
                  className="rounded-xl border border-red-200/80 bg-red-50/70 text-red-700 p-3"
                >
                  <ul className="list-disc pl-5 space-y-1">{errores.map((e, i) => <li key={i}>{e}</li>)}</ul>
                </motion.div>
              )}
            </AnimatePresence>

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

            {/* SECCIÓN: Foto + Datos personales */}
            <motion.section id="s-personal" initial={SECTION.initial} animate={SECTION.animate} className="card-premium p-4 md:p-6">
              <h2 className="h2-premium">Información personal</h2>

              <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8 min-h-[420px] h-full">
                {/* Foto */}
                <div className="flex flex-col items-center gap-5 min-h-[320px] h-full justify-between">
                  <div
                    ref={dropRef}
                    className="w-56 h-56 rounded-2xl bg-slate-100 ring-1 ring-slate-200 overflow-hidden flex items-center justify-center photo-drop"
                    title="Arrastra una imagen o haz clic para seleccionar"
                    onClick={() => document.getElementById('file-foto')?.click()}
                    role="button"
                    tabIndex={0}
                  >
                    {previewFoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previewFoto} alt="foto" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center text-slate-400 text-xs leading-tight">
                        Arrastra o <span className="underline">sube</span> tu foto
                      </div>
                    )}
                  </div>
                  <label className="block w-full">
                    <span className="sr-only">Seleccionar archivo</span>
                    <input
                      id="file-foto"
                      type="file"
                      accept="image/*"
                      onChange={(e) => onChange("foto", e.target.files?.[0] ?? null)}
                      className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-white hover:file:opacity-90"
                    />
                  </label>
                  <button
                    type="button"
                    className="mt-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold shadow hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    onClick={() => document.getElementById('file-foto-cam')?.click()}
                  >
                    Tomar foto con cámara
                  </button>
                  <input
                    id="file-foto-cam"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={(e) => onChange("foto", e.target.files?.[0] ?? null)}
                  />
                </div>

                {/* Campos personales */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Nombre y apellidos *" icon="user">
                    <input
                      ref={el => { fieldRefs.current["nombre"] = el; }}
                      className="input-premium"
                      placeholder="Ej: Juan Pérez"
                      value={values.nombre}
                      onChange={(e) => onChange("nombre", e.target.value)}
                    />
                  </Field>

                  <Field label="Cédula *" icon="id">
                    <input
                      ref={el => { fieldRefs.current["cedula"] = el; }}
                      className="input-premium"
                      placeholder="Ej: 1234567890"
                      value={values.cedula}
                      onChange={(e) => onChange("cedula", e.target.value)}
                    />
                  </Field>

                  <Field label="Teléfono" icon="phone">
                    <input
                      ref={el => { fieldRefs.current["telefono"] = el; }}
                      className="input-premium"
                      placeholder="Ej: 3001234567"
                      inputMode="tel"
                      value={values.telefono ?? ""}
                      onChange={(e) => onChange("telefono", e.target.value)}
                    />
                  </Field>

                  <Field label="Email" icon="mail">
                    <input
                      ref={el => { fieldRefs.current["email"] = el; }}
                      className="input-premium"
                      placeholder="ejemplo@correo.com"
                      inputMode="email"
                      value={values.email ?? ""}
                      onChange={(e) => onChange("email", e.target.value)}
                    />
                  </Field>

                  <Field label="Fecha de nacimiento" icon="clock">
                    <input
                      ref={el => { fieldRefs.current["fechaNac"] = el; }}
                      type="date"
                      className="input-premium"
                      value={values.fechaNac ?? ""}
                      onChange={(e) => onChange("fechaNac", e.target.value)}
                    />
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
                    <input
                      ref={el => { fieldRefs.current["direccion"] = el; }}
                      className="input-premium"
                      placeholder="Calle/Carrera, número, barrio, localidad"
                      value={values.direccion ?? ""}
                      onChange={(e) => onChange("direccion", e.target.value)}
                    />
                  </Field>

                  <Field label="Estado civil" icon="heart">
                    <select
                      ref={(el) => (fieldRefs.current["estadoCivil"] = el as any)}
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
                      ref={(el) => (fieldRefs.current["escolaridad"] = el as any)}
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
            </motion.section>

            {/* SECCIÓN: Información general de iglesia */}
            <motion.section id="s-general" initial={SECTION.initial} animate={SECTION.animate} className="card-premium p-4 md:p-6">
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
                    ref={(el) => (fieldRefs.current["diaCongrega"] = el as any)}
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
            </motion.section>

            {/* SECCIÓN: Datos espirituales */}
            <motion.section id="s-espirituales" initial={SECTION.initial} animate={SECTION.animate} className="card-premium p-4 md:p-6">
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
            </motion.section>

            {/* SECCIÓN: Evaluación & Notas */}
            <motion.section id="s-evaluacion" initial={SECTION.initial} animate={SECTION.animate} className="card-premium p-4 md:p-6">
              <h2 className="h2-premium">Evaluación y observaciones</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Toggle label="Tiene aspecto feliz" checked={values.aspectoFeliz} onChange={(v) => onChange("aspectoFeliz", v)} />
                <Toggle label="Muy interesado en el conocimiento" checked={values.muyInteresado} onChange={(v) => onChange("muyInteresado", v)} />
                <Toggle label="Interviene y opina en las clases" checked={values.interviene} onChange={(v) => onChange("interviene", v)} />
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
                    ref={(el) => (fieldRefs.current["notas"] = el as any)}
                    className="input-premium min-h-[120px] resize-y"
                    placeholder="Escribe aquí notas relevantes"
                    value={values.notas ?? ""}
                    onChange={(e) => onChange("notas", e.target.value)}
                  />
                </div>
              </div>
            </motion.section>

          {/* FOOTER actions sticky */}
<div className="sticky bottom-3 z-20 flex items-center justify-end gap-3">
  <button
    type="button"
    onClick={() => { setValues({ ...INITIAL }); setErrores([]); setOkMsg(""); }}
    className="btn-secondary"
  >
    Limpiar
  </button>
  <button
    id="btn-guardar"
    type="submit"
    className="btn-primary"
    disabled={saving} // opcional: evita doble clic mientras guarda
  >
    {saving ? "Guardando…" : "Guardar"}
  </button>
</div>
</form>


          {/* Aside: nav sticky + tips */}
          <aside className="hidden lg:block">
            <div className="sticky top-6 space-y-4">
              <nav className="rounded-2xl bg-white/70 ring-1 ring-white/60 shadow-[0_16px_48px_-18px_rgba(15,23,42,.22)] p-3">
                <p className="text-xs font-semibold text-slate-600 px-2 pb-2">Secciones</p>
                <ul className="space-y-1">
                  {[
                    { href: "#s-personal", label: "Información personal" },
                    { href: "#s-general", label: "Información general" },
                    { href: "#s-espirituales", label: "Datos espirituales" },
                    { href: "#s-evaluacion", label: "Evaluación y observaciones" },
                  ].map((l) => (
                    <li key={l.href}>
                      <a
                        href={l.href}
                        className={`nav-chip ${activeAnchor === l.href ? "nav-chip-active" : ""}`}
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>

              <div className="rounded-2xl bg-gradient-to-br from-indigo-50/80 to-sky-50/80 ring-1 ring-white p-3">
                <p className="text-[13px] text-slate-600">
                  Atajos: <kbd className="kbd">Ctrl/Cmd + S</kbd> guardar · <kbd className="kbd">Shift + 2</kbd> Datos espirituales
                </p>
              </div>
            </div>
          </aside>
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
        body {
          font-family: var(--mac-font);
          background: var(--mac-bg);
        }

        /* Contenedores */
        .card-premium{
          border-radius: 22px;
          /* background: linear-gradient(120deg, var(--mac-glass) 80%, #f3f0ff 100%); */
          background: transparent;
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
          border-radius: var(--mac-radius);
          border:1.5px solid rgba(108,99,255,0.13);
          background: linear-gradient(120deg, #fff 70%, #f5f3ff 100%);
          box-shadow: var(--mac-shadow);
          padding:.75rem 1.1rem;
          font-size:1rem; color:#23223a;
          transition: box-shadow .18s, border .18s, transform .08s;
          outline:none; backdrop-filter: blur(8px);
        }
        .input-premium:focus{
          border-color: var(--mac-accent);
          box-shadow: 0 0 0 3px #6c63ff33, var(--mac-shadow-strong);
          transform: translateY(-1px);
          animation: macPulse .18s;
        }
        @keyframes macPulse{0%{box-shadow:0 0 0 0 var(--mac-accent2)}100%{box-shadow:0 0 0 3px #a084ff33}}
        .label-premium{ font-size:.76rem; font-weight:700; color:#6c63ff; letter-spacing:.01em; }

        /* Chips (pill toggles) */
        .chip{
          display:inline-flex; align-items:center; gap:.55em;
          border-radius:999px;
          background: linear-gradient(90deg, #f7f7fd 60%, #ecebff 100%);
          border: 1.2px solid #ecebff;
          box-shadow: 0 2px 12px -6px #6c63ff22;
          padding:.52em 1.2em; font-size:.98rem; color:#5a5a7a; cursor:pointer;
          transition: background .18s, color .18s, box-shadow .18s, transform .12s;
          user-select:none;
        }
        .chip:hover{ transform: translateY(-1px); }
        .chip[data-checked="true"]{
          background: linear-gradient(90deg, var(--mac-accent) 60%, var(--mac-accent2) 100%);
          color:#fff; border-color: transparent; box-shadow: 0 6px 18px -8px var(--mac-accent2);
        }

        /* Nav secciones */
        .nav-chip{
          display:block; padding:.55rem .8rem;
          border-radius:12px; color:#334155; font-weight:600;
          transition: background .16s, transform .12s;
        }
        .nav-chip:hover{ background:#f1f5ff; transform: translateX(2px); }
        .nav-chip-active{ background:linear-gradient(90deg,#eef2ff,#e0f2ff); color:#1e293b; }

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
