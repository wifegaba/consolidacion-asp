'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const normalizeCedula = (raw: string) => raw.replace(/\D+/g, '').trim();

export default function LoginPage() {
  const router = useRouter();
  const [cedula, setCedula] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const ced = normalizeCedula(cedula);
    if (!ced) {
      setErrorMsg('Por favor ingrese su cédula.');
      return;
    }

    setLoading(true);
    try {
      // Enviamos solo la cédula al backend
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cedula: ced }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error de autenticación');

      // El backend responde con la ruta a donde redirigir
      router.replace(data.redirect || '/panel');
    } catch (err: any) {
      setErrorMsg(err.message || 'No fue posible validar su ingreso.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-sky-100 overflow-hidden">
      {/* Fondos decorativos */}
      <div className="pointer-events-none absolute -top-40 -left-40 w-[440px] h-[440px] rounded-full bg-sky-300/45 blur-3xl animate-pulse" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 w-[440px] h-[440px] rounded-full bg-indigo-300/40 blur-3xl animate-pulse" />

      {/* Tarjeta principal */}
      <div className="relative z-10 w-full max-w-md bg-white/20 backdrop-blur-2xl border border-white/30 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] p-7 sm:p-9">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-800 tracking-tight">
            Bienvenido
          </h1>
          <div className="w-12 h-12 rounded-full bg-white shadow-inner ring-1 ring-slate-200/70 grid place-items-center">
            <Image
              src="/asp-logo.png"
              alt="Logo ASP"
              width={36}
              height={36}
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Versículo */}
        <div className="mt-5 rounded-xl border border-amber-300/60 bg-gradient-to-br from-amber-50 via-amber-100/90 to-amber-200/70 shadow-inner p-4">
          <p className="text-[13.5px] sm:text-sm font-serif italic text-slate-800 text-center leading-relaxed">
            “Quien quiera servirme debe seguirme; y donde yo esté, allí también estará mi siervo.
            A quien me sirva, mi Padre lo honrará.”
            <br />
            <span className="font-bold not-italic">Juan 12:26</span>
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="cedula" className="sr-only">Cédula</label>
            <input
              id="cedula"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Ingrese su cédula"
              value={cedula}
              onChange={(e) => setCedula(normalizeCedula(e.target.value))}
              className="w-full px-4 py-3 rounded-2xl bg-white/35 border border-white/60 text-slate-800 placeholder-slate-400 shadow-inner focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent backdrop-blur-md"
            />
          </div>

          {errorMsg && (
            <div className="text-[13px] text-red-600 text-center">{errorMsg}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-full bg-gradient-to-r from-sky-500 via-sky-600 to-indigo-700 text-white font-semibold tracking-wide shadow-md hover:shadow-[0_0_18px_rgba(37,99,235,0.6)] active:scale-[0.99] transition-all duration-300 disabled:opacity-50"
          >
            {loading ? 'Validando…' : 'Ingresar'}
          </button>
        </form>

        <p className="mt-4 text-xs text-center text-slate-500">
          Ingrese solo números de cédula. Su acceso está protegido con sesión segura.
        </p>
      </div>
    </main>
  );
}
