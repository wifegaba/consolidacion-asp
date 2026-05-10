'use client';

import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// IMPORTACIÓN SIMULADA DE ÍCONOS MODERNOS
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

  useEffect(() => {
    // no-op: kept for future use
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitCedula();
  };

  // Submit sin evento (para que lo dispare el keypad personalizado)
  const submitCedula = async () => {
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
    <main className="min-h-[100dvh] relative flex flex-col items-center justify-start pt-[8vh] sm:justify-center sm:pt-0 px-4 pb-6 sm:p-6 bg-[url('/fondo-login.jpg')] bg-cover bg-center bg-no-repeat overflow-hidden">
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
        <div className="mt-5 rounded-xl border border-white/50 bg-white/30 backdrop-blur-md shadow-inner p-4">
          <p className="text-[13.5px] sm:text-sm font-serif italic text-slate-800 text-center leading-relaxed">
            "Cuando hagan cualquier trabajo, háganlo de todo corazón, como si estuvieran trabajando para el Señor y no para los seres humanos.
            Recuerden que ustedes van a recibir la recompensa del Señor que Dios le prometió a su pueblo, pues ustedes sirven a Cristo el Señor."
            <br />
            <span className="font-bold not-italic">Colosenses 3:23-24</span>
          </p>
        </div>

        {/* Tarjetas de Ministerios */}
        <div className="mt-6 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-700">Ministerios activos</h3>
            <span className="text-sky-500 text-lg leading-none">✦</span>
            <div className="flex-1 h-px bg-gradient-to-r from-sky-200 to-transparent"></div>
          </div>
          
          {/* Contenedor relativo para la línea conectora y las tarjetas */}
          <div className="relative flex flex-row items-center justify-center sm:justify-start gap-3 py-2 w-full">
            {/* Línea horizontal en el fondo (simula la conexión de luz) */}
            <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-gradient-to-r from-sky-100 via-sky-200 to-transparent -translate-y-1/2 z-0 hidden sm:block"></div>

            {/* Tarjeta PTDM */}
            <div className="relative group z-10 cursor-default shrink-0">
              {/* Luz azul de fondo (resplandor) */}
              <div className="absolute -inset-1 bg-sky-400 rounded-full blur opacity-50 transition duration-500"></div>
              {/* Contenido de la tarjeta */}
              <div className="relative flex items-center gap-2.5 px-3 py-2 bg-white/80 backdrop-blur-md border border-white/90 rounded-full shadow-lg">
                <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-sm text-sky-600 border border-sky-100">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                </div>
                <span className="text-[13px] font-semibold text-slate-700">PTDM</span>
                <div className="w-4 h-4 rounded-full bg-sky-500 flex items-center justify-center shadow-inner">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
              </div>
              {/* Punto de luz inferior */}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-sky-100 rounded-full shadow-[0_0_12px_4px_rgba(56,189,248,0.9)] z-20"></div>
            </div>

            {/* Tarjeta Kids (Compacta y Premium con Engranaje Giratorio) */}
            <div className="relative group z-10 cursor-default shrink-0">
              {/* Luz azul de fondo (resplandor suave) */}
              <div className="absolute -inset-1 bg-sky-300 rounded-full blur-md opacity-40 transition duration-500"></div>
              
              {/* Contenido de la tarjeta */}
              <div className="relative flex items-center justify-between gap-3 px-2 py-1.5 bg-gradient-to-br from-white/95 to-white/70 backdrop-blur-xl border border-white rounded-full shadow-[0_4px_15px_rgba(14,165,233,0.15)]">
                
                <div className="flex items-center gap-2">
                  {/* Ícono Izquierdo (Anillos concéntricos tipo Neumorfismo) */}
                  <div className="relative w-8 h-8 rounded-full bg-white/40 flex items-center justify-center shadow-[inset_0_1px_2px_rgba(255,255,255,1),0_1px_3px_rgba(0,0,0,0.05)] border border-white/50 ml-0.5">
                    <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-[inset_0_-1px_3px_rgba(0,0,0,0.05),0_1px_4px_rgba(0,0,0,0.08)] border border-slate-50">
                      <svg className="w-4 h-4 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>

                  {/* Textos */}
                  <div className="flex flex-col justify-center">
                    <span className="text-[13px] font-extrabold text-slate-800 tracking-tight leading-none mb-1">Kids</span>
                    {/* Badge En Desarrollo */}
                    <div className="flex items-center gap-1 px-1.5 py-[2px] bg-gradient-to-r from-sky-400 to-blue-500 rounded-full shadow-sm">
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth={2} />
                        <line x1="16" y1="2" x2="16" y2="6" strokeWidth={2} />
                        <line x1="8" y1="2" x2="8" y2="6" strokeWidth={2} />
                        <line x1="3" y1="10" x2="21" y2="10" strokeWidth={2} />
                      </svg>
                      <span className="text-[7.5px] font-bold text-white uppercase tracking-wider">En Desarrollo</span>
                    </div>
                  </div>
                </div>

                {/* Botón Derecho (Engranaje Giratorio) */}
                <div className="w-7 h-7 mr-0.5 rounded-full bg-white/70 flex items-center justify-center shadow-[inset_0_1px_2px_rgba(255,255,255,1),0_2px_5px_rgba(0,0,0,0.08)] border border-white/80">
                  <svg className="w-4 h-4 text-sky-500 animate-[spin_3s_linear_infinite]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>

              </div>
              
              {/* Punto de luz inferior */}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-sky-200 rounded-full shadow-[0_0_12px_4px_rgba(125,211,252,0.9)] z-20"></div>
            </div>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {/* CAMPO DE CONTRASEÑA/CÉDULA CON TOGGLE DE VISIBILIDAD */}
          <div className="relative">
            <label htmlFor="cedula" className="sr-only">Cédula o Usuario</label>
            <input
              id="cedula"
              type="tel"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Ingrese su cédula o usuario"
              value={cedula}
              onChange={(e) => setCedula(normalizeCedula(e.target.value))}
              className="w-full px-4 py-3 pr-12 rounded-2xl bg-white/35 border border-white/60 text-slate-800 placeholder-slate-400 shadow-inner focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent backdrop-blur-md"
              style={{ WebkitTextSecurity: showPassword ? 'none' : 'disc' } as React.CSSProperties}
            />

            {cedula.length > 0 && (
              <button
                type="button"
                onClick={togglePasswordVisibility}
                aria-label={showPassword ? 'Ocultar cédula' : 'Mostrar cédula'}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-800 transition-colors"
              >
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

          {/* Nota: el input está configurado para mostrar teclado numérico nativo en móviles */}

          <button
            type="submit"
            disabled={loading || pendingRef.current}
            className="w-full py-3 rounded-full bg-gradient-to-r from-sky-500 via-sky-600 to-indigo-700 text-white font-semibold tracking-wide shadow-md hover:shadow-[0_0_18px_rgba(37,99,235,0.6)] active:scale-[0.99] transition-all duration-300 disabled:opacity-50"
          >
            {loading ? 'Validando…' : 'Ingresar'}
          </button>
        </form>

        {/* teclado personalizado eliminado; uso del teclado nativo móvil */}

        <p className="mt-4 text-xs text-center text-slate-500">
          Su acceso está protegido con sesión segura.
        </p>
      </div>
    </main>
  );
}