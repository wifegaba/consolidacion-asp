'use client';

import Image from 'next/image';
import { BookOpen, Check, Smile, Settings, CalendarDays, ShieldCheck, ArrowRight, LockKeyhole } from 'lucide-react';
import styles from './login.module.css';
import { getDailyLoginVerse, millisecondsToNextVerse, type LoginVerse } from '@/lib/loginVerses';
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
  const [verse, setVerse] = useState<LoginVerse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const cedulaInputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef(false); // evita doble submit rápido

  // ESTADO PREMIUM: Controla la visibilidad del campo (text vs password)
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

  // Se ejecuta solamente al interactuar con el campo; no hay intervalos ni
  // sondeo continuo del navegador, por lo que no afecta el rendimiento.
  const ensureFullscreen = () => {
    if (window.matchMedia('(pointer: coarse)').matches) {
      if (document.fullscreenElement) void document.exitFullscreen?.();
      return;
    }
    if (document.fullscreenElement || !document.documentElement.requestFullscreen) return;
    void document.documentElement.requestFullscreen().catch(() => {
      // Algunos navegadores pueden requerir un gesto adicional o bloquearlo.
      // El inicio de sesión sigue funcionando normalmente en ese caso.
    });
  };

  const handleCredentialFocus = () => {
    ensureFullscreen();
    window.setTimeout(() => {
      cedulaInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  };

  const enterFullscreenForPortal = () => {
    if (!window.matchMedia('(pointer: coarse)').matches) return;
    if (document.fullscreenElement || !document.documentElement.requestFullscreen) return;
    void document.documentElement.requestFullscreen().catch(() => {
      // Algunos navegadores solo permiten pantalla completa tras un gesto
      // adicional; la navegación al portal continúa sin interrupciones.
    });
  };

  useEffect(() => {
    let midnightTimer: ReturnType<typeof setTimeout>;
    const updateVerse = () => {
      clearTimeout(midnightTimer);
      setVerse(getDailyLoginVerse());
      midnightTimer = setTimeout(updateVerse, millisecondsToNextVerse() + 100);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') updateVerse();
    };
    updateVerse();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(midnightTimer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    enterFullscreenForPortal();
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

  // When opening the custom keyboard, ensure the input is visible above it
  // no custom keyboard helper - using native keyboard on responsive

  return (
    <main className={styles.scene}>
      <section className={styles.card} aria-labelledby="login-title">
        <header className={styles.header}>
          <h1 id="login-title">Bienvenido</h1>
          <div className={styles.logo}>
            <Image src="/asp-logo.png" alt="Logo ASP" width={66} height={66} priority />
          </div>
        </header>

        <blockquote className={styles.verse} aria-label="Versículo del día">
          <p>{verse ? `“${verse.text}”` : ''}</p>
          <cite style={{ visibility: verse ? 'visible' : 'hidden' }}><BookOpen size={16} strokeWidth={1.7} aria-hidden="true" />{verse?.reference || '\u00a0'}</cite>
        </blockquote>

        <section className={styles.ministries} aria-label="Ministerios">
          <div className={styles.ministryList}>
            <div className={styles.ministry}>
              <BookOpen className={styles.ministryIcon} aria-hidden="true" />
              <span className={styles.ministryName}>PTDM</span>
              <span className={styles.activeStatus} role="img" aria-label="Activo"><Check size={13} strokeWidth={2} /></span>
            </div>
            <div className={styles.ministry}>
              <Smile className={styles.ministryIcon} aria-hidden="true" />
              <div className={styles.kidsInfo}>
                <span className={styles.ministryName}>Kids</span>
                <span className={styles.development}><CalendarDays size={10} aria-hidden="true" />En desarrollo</span>
              </div>
              <Settings className={styles.settingsIcon} size={17} aria-hidden="true" />
            </div>
          </div>
        </section>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <LockKeyhole size={17} strokeWidth={1.5} className={styles.fieldIcon} aria-hidden="true" />
            <input type="text" name="username" autoComplete="username" value={cedula} className="hidden" readOnly aria-hidden="true" />
            <label htmlFor="cedula" className="sr-only">Cédula o Usuario</label>
            <input
              id="cedula"
              name="password"
              ref={cedulaInputRef}
              type={showPassword ? 'text' : 'password'}
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="current-password"
              placeholder="Ingrese su cédula o usuario"
              value={cedula}
              onChange={(e) => setCedula(normalizeCedula(e.target.value))}
              onFocus={handleCredentialFocus}
              aria-invalid={!!errorMsg}
              aria-describedby={errorMsg ? 'login-error' : undefined}
              className={styles.input}
            />
            {cedula.length > 0 && (
              <button
                type="button"
                onClick={togglePasswordVisibility}
                aria-label={showPassword ? 'Ocultar cédula' : 'Mostrar cédula'}
                className={styles.visibility}
              >
                {showPassword ? <EyeOffIcon width={19} height={19} /> : <EyeIcon width={19} height={19} />}
              </button>
            )}
          </div>
          {errorMsg && <p id="login-error" role="alert" className={styles.error}>{errorMsg}</p>}
          <button type="submit" disabled={loading || pendingRef.current} aria-busy={loading} data-loading={loading} className={styles.submit}>
            <span className={styles.submitLight} aria-hidden="true" />
            <span>{loading ? 'Validando…' : 'Ingresar'}</span>
            <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </form>

        <p className={styles.security}>
          <ShieldCheck size={14} strokeWidth={1.5} aria-hidden="true" />
          Su acceso está protegido con sesión segura.
        </p>
      </section>
    </main>
  );
}
