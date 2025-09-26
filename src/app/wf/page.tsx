'use client';

import { motion } from 'framer-motion';
import { Smartphone, ShieldCheck, Gauge, Workflow, ArrowRight } from 'lucide-react';

export default function Page() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0a0b10] text-white">
      {/* --- PREMIUM BACKGROUND LAYERS --- */}
      <div className="pointer-events-none absolute -top-48 -left-40 h-[34rem] w-[34rem] rounded-full bg-fuchsia-600/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 -right-40 h-[38rem] w-[38rem] rounded-full bg-indigo-600/25 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.15]"
        style={{
          background:
            'radial-gradient(1200px 600px at 15% 10%, rgba(147,51,234,.5), transparent 60%), radial-gradient(900px 600px at 85% 70%, rgba(79,70,229,.5), transparent 60%)'
        }}
      />
      {/* sutil patrón de líneas */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.08]"
        style={{ backgroundImage: 'linear-gradient(transparent 95%, rgba(255,255,255,.7) 96%, transparent 97%)',
                 backgroundSize: '100% 18px' }}
      />

      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 py-16 md:grid-cols-2 md:py-24">
        {/* ---------- LEFT: Marca + Claim + CTAs ---------- */}
        <div className="flex flex-col justify-center gap-8">


          
          {/* Logo + sello */}
         
<div className="relative flex items-center gap-5">
  {/* halo suave detrás del logo */}
  <div className="pointer-events-none absolute -left-4 top-1/2 -z-10 h-16 w-16 -translate-y-1/2 rounded-full bg-amber-300/25 blur-xl sm:h-24 sm:w-24" />

  {/* logo con más peso visual */}
  <img
    src="/wf-logo.png"
    alt="WF SYSTEM"
    className="h-16 w-16 sm:h-24 sm:w-24 object-contain drop-shadow-[0_10px_30px_rgba(250,204,21,.35)]"
  />

  <div>
    <p className="text-base sm:text-lg font-semibold tracking-[0.22em] text-white/90">
      WF SYSTEM
    </p>
    <p className="text-xs -mt-1 text-white/65">SOLUCIONES INTELIGENTES</p>
  </div>
</div>


          {/* Titular + frase aprobada */}
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
            <span className="text-white/90">Desarrollo de software</span>{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60">Premium.</span>
          </h1>

          <blockquote className="rounded-2xl border border-white/10 bg-white/5 p-5 text-2xl font-semibold leading-snug ring-1 ring-white/10 backdrop-blur">
            “No es solo software, es <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-indigo-400">inteligencia aplicada</span>.”
          </blockquote>

          <p className="max-w-xl text-white/70">
            Con nuestra tecnología, lo complejo se transforma en simple, y tu negocio en más eficiente.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap gap-4">
            <a
              href="#contacto"
              className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-3 text-sm font-medium ring-1 ring-white/10 transition hover:brightness-110 active:scale-[0.99]"
            >
              Construir mi app <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </a>
            <a
              href="#demo"
              className="rounded-2xl bg-white/5 px-5 py-3 text-sm font-medium text-white/90 ring-1 ring-white/10 backdrop-blur transition hover:bg-white/10"
            >
              Ver demo
            </a>
          </div>

          {/* Mini badges de valor */}
          <div className="mt-2 flex flex-wrap gap-3">
            <Badge icon={<ShieldCheck className="h-3.5 w-3.5" />} text="DevSecOps & SLOs" />
            <Badge icon={<Gauge className="h-3.5 w-3.5" />} text="Performance 99+ Lighthouse" />
            <Badge icon={<Smartphone className="h-3.5 w-3.5" />} text="Control total móvil" />
          </div>
        </div>

        {/* ---------- RIGHT: Panel tipo macOS (reemplaza el mockup “vacío”) ---------- */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative mx-auto w-full max-w-xl"
        >
          {/* halo premium */}
          <div className="pointer-events-none absolute -inset-8 -z-10 rounded-[2.5rem] bg-gradient-to-r from-fuchsia-500/20 via-transparent to-indigo-500/20 blur-3xl" />

          {/* Ventana macOS */}
          <div className="rounded-[1.6rem] border border-white/12.5 bg-white/[0.04] p-4 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl">
            {/* barra título mac */}
            <div className="mb-4 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-rose-400/90" />
              <span className="h-3 w-3 rounded-full bg-amber-300/90" />
              <span className="h-3 w-3 rounded-full bg-emerald-400/90" />
              <span className="ml-3 text-xs text-white/50">Panel — Tiempo real</span>
            </div>

            {/* GRID de tarjetas dentro de la ventana */}
            <div className="grid grid-cols-2 gap-4">
              {/* Tarjeta: Tareas */}
              <Card className="col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-[12px] text-white/65">Tareas</h3>
                  <span className="text-[11px] text-white/45">hoy</span>
                </div>
                <div className="mt-1 text-2xl font-bold">22</div>
                <Progress />
              </Card>

              {/* Tarjeta: Despliegue */}
              <Card className="col-span-2 sm:col-span-1">
                <h3 className="text-[12px] text-white/65 mb-2">Despliegue</h3>
                <Switch label="Producción" />
              </Card>

              {/* Métricas (mini chart) */}
              <Card className="col-span-2">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-[12px] text-white/65">Métricas</h3>
                  <span className="text-[10px] text-white/45">&lt;/&gt;</span>
                </div>
                <div className="h-24 w-full overflow-hidden rounded-md ring-1 ring-white/10">
                  {/* “chart” con beam animado */}
                  <div className="h-full w-full bg-gradient-to-b from-white/5 to-transparent" />
                  <div className="relative -mt-16 h-32 w-full">
                    <div className="absolute left-6 top-10 h-2 w-2 rounded-full bg-fuchsia-400 shadow-[0_0_18px_rgba(217,70,239,.7)]" />
                    <div className="absolute left-0 top-12 h-[3px] w-[90%] animate-pulse rounded-full bg-gradient-to-r from-fuchsia-500/60 via-indigo-400/60 to-transparent" />
                  </div>
                </div>
                <div className="mt-2 flex gap-4 text-[10px] text-white/60">
                  <span>812 req/min</span>
                  <span>5.1s p95</span>
                  <span>99.9% OK</span>
                </div>
              </Card>

              {/* Pipelines */}
              <Card className="col-span-2">
                <div className="mb-2 flex items-center gap-2">
                  <Workflow className="h-4 w-4 text-white/60" />
                  <h3 className="text-sm">Pipelines</h3>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                  <Pill title="CI" value="OK" valueClass="text-emerald-400" />
                  <Pill title="CD" value="1" valueClass="text-amber-300" />
                  <Pill title="Alerts" value="0" valueClass="text-rose-300" />
                </div>
              </Card>
            </div>
          </div>

          {/* Badges flotantes “premium” */}
          <FloatingBadge
            className="left-[-12%] top-[18%]"
            icon={<Smartphone className="h-4 w-4" />}
            text="Admin móvil"
          />
          <FloatingBadge
            className="right-[-10%] top-[8%]"
            icon={<ShieldCheck className="h-4 w-4" />}
            text="Cifrado & RBAC"
          />
        </motion.div>
      </section>
    </main>
  );
}

/* ---------------- Reusable UI ---------------- */

function Badge({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-1 text-xs text-white/75 ring-1 ring-white/10 backdrop-blur">
      {icon} {text}
    </span>
  );
}

function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={
        'rounded-xl border border-white/10 bg-white/[0.04] p-4 ring-1 ring-white/10 backdrop-blur ' +
        className
      }
    >
      {children}
    </motion.div>
  );
}

function Progress() {
  return (
    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div className="h-full w-3/4 animate-[pulse_2.2s_ease-in-out_infinite] bg-gradient-to-r from-fuchsia-500 to-indigo-500" />
    </div>
  );
}

function Switch({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <button
        aria-label="toggle"
        className="relative h-7 w-12 rounded-full bg-white/10 ring-1 ring-white/10 transition"
      >
        <span className="absolute left-[2px] top-[2px] h-6 w-6 rounded-full bg-gradient-to-br from-fuchsia-500 to-indigo-500 shadow" />
      </button>
    </div>
  );
}

function Pill({ title, value, valueClass }: { title: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-md bg-black/30 p-2 ring-1 ring-white/10">
      <p className="text-white/60">{title}</p>
      <p className={`text-sm font-semibold ${valueClass ?? ''}`}>{value}</p>
    </div>
  );
}

function FloatingBadge({
  className,
  icon,
  text,
}: {
  className?: string;
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: [0, -4, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      className={
        'pointer-events-none absolute z-10 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs ring-1 ring-white/10 backdrop-blur ' +
        (className ?? '')
      }
    >
      <div className="flex items-center gap-2 text-white/85">
        {icon} {text}
      </div>
    </motion.div>
  );
}
