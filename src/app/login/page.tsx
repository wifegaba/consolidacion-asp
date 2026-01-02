'use client';

import Image from 'next/image';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

// IMPORTACIÓN SIMULADA DE ÍCONOS MODERNOS
// En un proyecto real, se usaría una librería como 'lucide-react', 'react-icons', o similar.
// Se recomienda instalar una para usar SVGs limpios en lugar de los placeholders de texto.
// Por ejemplo: `npm install lucide-react` o `npm install react-icons`
const EyeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
);

const EyeOffIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path><path d="M6.61 6.61A13.11 13.11 0 0 0 2 12s3 7 10 7a9.8 9.8 0 0 0 5.61-1.92"></path><line x1="2" x2="22" y1="2" y2="22"></line></svg>
);


const normalizeCedula = (raw: string) => raw.trim();

export default function LoginPage() {
  const router = useRouter();
  const [cedula, setCedula] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pendingRef = useRef(false); // evita doble submit rápido

  // ESTADO PREMIUM: Controla la visibilidad del campo (text vs password)
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pendingRef.current) return;
    setErrorMsg(null);

    const ced = normalizeCedula(cedula);
    if (!ced) {
      setErrorMsg('Por favor ingrese su cédula o usuario.');
      return;
    }

    setLoading(true);
    pendingRef.current = true;

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cedula: ced }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        throw new Error('Respuesta inválida del servidor');
      }

      if (!res.ok) {
        throw new Error(data?.error || 'Error de autenticación');
      }

      if (!data?.redirect || typeof data.redirect !== 'string') {
        throw new Error('El servidor no envió una ruta de redirección.');
      }

      router.replace(data.redirect);
    } catch (err: any) {
      setErrorMsg(err?.message || 'No fue posible validar su ingreso.');
    } finally {
      setLoading(false);
      pendingRef.current = false;
    }
  };

  return (
    <main className="min-h-screen relative flex flex-col items-center justify-center p-6 bg-[url('/fondo-login.jpg')] bg-cover bg-center bg-no-repeat overflow-hidden">
      {/* Overlay suave para mejor legibilidad (opcional, más claro) */}
      <div className="absolute inset-0 bg-white/10 pointer-events-none" />

      {/* Tarjeta principal */}
      <div className="relative z-10 w-full max-w-md bg-white/20 backdrop-blur-2xl border border-white/30 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] p-7 sm:p-9">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-800 tracking-tight">
            Bienvenido
          </h1>
          <div className="w-24 h-24 rounded-full bg-white shadow-xl ring-4 ring-white/50 grid place-items-center transform hover:scale-105 transition-transform duration-300">
            <Image
              src="/asp-logo.png"
              alt="Logo ASP"
              width={72} /* Aumentado */
              height={72}
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
          {/* CAMPO DE CONTRASEÑA/CÉDULA CON TOGGLE DE VISIBILIDAD */}
          <div className="relative">
            <label htmlFor="cedula" className="sr-only">Cédula o Usuario</label>
            <input
              id="cedula"
              // Usamos siempre type="text" para evitar que el navegador muestre
              // su propio control de visibilidad (icono de ojo). En su lugar
              // aplicamos -webkit-text-security para enmascarar los caracteres
              // cuando showPassword === false.
              type={showPassword ? 'text' : 'password'}
              // Se mantiene 'text' en inputMode para permitir letras si el 'usuario' las tiene.
              inputMode="text"
              autoComplete="off"
              placeholder="Ingrese su cédula o usuario"
              value={cedula}
              onChange={(e) => setCedula(normalizeCedula(e.target.value))}
              // Se agregó 'pr-12' para el padding derecho, dando espacio al ícono
              className="w-full px-4 py-3 pr-12 rounded-2xl bg-white/35 border border-white/60 text-slate-800 placeholder-slate-400 shadow-inner focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent backdrop-blur-md"
            />

            {/* BOTÓN DE TOGGLE DE VISIBILIDAD (LA 'LUPITA') */}
            {/* Solo se muestra si el campo tiene contenido para alternar */}
            {cedula.length > 0 && (
              <button
                type="button"
                onClick={togglePasswordVisibility}
                // ARIA: Mejora la accesibilidad para lectores de pantalla
                aria-label={showPassword ? 'Ocultar cédula' : 'Mostrar cédula'}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-800 transition-colors"
              >
                {/* El ícono cambia dinámicamente según la visibilidad */}
                {showPassword ? (
                  <EyeOffIcon className="w-5 h-5" />
                ) : (
                  <EyeIcon className="w-5 h-5" />
                )}
              </button>
            )}
          </div>

          {errorMsg && (
            <div className="text-[13px] text-red-600 text-center">{errorMsg}</div>
          )}

          <button
            type="submit"
            disabled={loading || pendingRef.current}
            className="w-full py-3 rounded-full bg-gradient-to-r from-sky-500 via-sky-600 to-indigo-700 text-white font-semibold tracking-wide shadow-md hover:shadow-[0_0_18px_rgba(37,99,235,0.6)] active:scale-[0.99] transition-all duration-300 disabled:opacity-50"
          >
            {loading ? 'Validando…' : 'Ingresar'}
          </button>
        </form>

        <p className="mt-4 text-xs text-center text-slate-500">
          Su acceso está protegido con sesión segura.
        </p>
      </div>
    </main>
  );
}