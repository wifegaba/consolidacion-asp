'use client';

import React, { useMemo, useRef, useState } from 'react';

type Talla = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';
type Modelo = 'Cintura' | 'Cuerpo entero' | 'Postparto' | 'Realce glúteos';
type Compresion = 'Suave' | 'Media' | 'Alta';
type Color = 'Negro' | 'Cocoa' | 'Beige' | 'Blanco';
type Pago = 'Contraentrega' | 'Nequi' | 'Daviplata' | 'Tarjeta';

export default function FajasViviansPage() {
  // ---- Estado del formulario
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [whatsapp, setWhatsapp] = useState(true);
  const [modelo, setModelo] = useState<Modelo>('Cintura');
  const [talla, setTalla] = useState<Talla>('M');
  const [color, setColor] = useState<Color>('Negro');
  const [compresion, setCompresion] = useState<Compresion>('Media');
  const [cintura, setCintura] = useState<number | ''>('');
  const [cadera, setCadera] = useState<number | ''>('');
  const [busto, setBusto] = useState<number | ''>('');
  const [objetivo, setObjetivo] = useState('Reducir cintura en corto tiempo');
  const [envio, setEnvio] = useState<'Domicilio' | 'Tienda'>('Domicilio');
  const [ciudad, setCiudad] = useState('');
  const [direccion, setDireccion] = useState('');
  const [pago, setPago] = useState<Pago>('Contraentrega');
  const [acepto, setAcepto] = useState(false);
  const [foto, setFoto] = useState<string | null>(null);

  // ---- Precio (demo): base x modelo + compresión + talla grande
  const precio = useMemo(() => {
    let base = 139000; // precio base demo
    if (modelo === 'Cuerpo entero') base += 60000;
    if (modelo === 'Postparto') base += 80000;
    if (modelo === 'Realce glúteos') base += 50000;

    if (compresion === 'Alta') base += 40000;
    if (compresion === 'Suave') base -= 10000;

    if (talla === 'XL' || talla === 'XXL') base += 20000;

    return base;
  }, [modelo, compresion, talla]);

  // ---- Progreso visual (100% = “lista para comprar”)
  const progreso = useMemo(() => {
    let filled = 0;
    const fields = [
      nombre, telefono, modelo, talla, color, compresion, objetivo, envio, pago,
    ];
    fields.forEach((f) => (f ? (filled += 1) : null));
    if (envio === 'Domicilio') {
      if (ciudad) filled += 1;
      if (direccion) filled += 1;
    }
    if (acepto) filled += 1;
    const max = envio === 'Domicilio' ? 12 : 11;
    return Math.min(100, Math.round((filled / max) * 100));
  }, [nombre, telefono, modelo, talla, color, compresion, objetivo, envio, ciudad, direccion, acepto, pago]);

  // ---- Tilt 3D
  const cardRef = useRef<HTMLDivElement | null>(null);
  const handleMouseMove = (e: React.MouseEvent) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const rotateX = (+y / rect.height) * -10;
    const rotateY = (+x / rect.width) * 10;
    el.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  };
  const handleMouseLeave = () => {
    const el = cardRef.current;
    if (!el) return;
    el.style.transform = `rotateX(0deg) rotateY(0deg)`;
  };

  // ---- Subida de imagen (preview local)
  const onFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFoto(reader.result as string);
    reader.readAsDataURL(file);
  };

  // ---- “Compra”
  const [toast, setToast] = useState<string | null>(null);
  const comprar = () => {
    if (!nombre || !telefono || !acepto) {
      setToast('Completa los datos obligatorios y acepta términos.');
      return;
    }
    setToast('¡Listo! Te contactaremos para confirmar tu pedido. ✨');
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#0b0b12] text-white">
      {/* Fondo premium */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-[38rem] w-[38rem] rounded-full bg-gradient-to-br from-fuchsia-500/40 via-indigo-500/30 to-cyan-500/20 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-[32rem] w-[32rem] rounded-full bg-gradient-to-tr from-violet-500/30 via-rose-500/20 to-blue-500/20 blur-3xl" />
      </div>

      {/* Contenido */}
      <section className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-10 md:grid-cols-2 md:py-14">
        {/* Copy + Tarjeta Showcase */}
        <div className="flex flex-col gap-6">
          <header className="space-y-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs tracking-wide ring-1 ring-white/10">
              Fajas Vivians — fajas colombianas hechas con <strong className="font-semibold">detalle</strong>
            </span>
            <h1 className="text-3xl font-bold leading-tight md:text-5xl">
              Elegancia que moldea,<br className="hidden md:block" />
              resultados en <span className="bg-gradient-to-r from-fuchsia-400 via-violet-400 to-sky-400 bg-clip-text text-transparent">corto tiempo</span>.
            </h1>
            <p className="max-w-xl text-white/70">
              Diseños modernos, acabados finos y compresión inteligente. Tu silueta, tu poder — pensado para destacar
              <em> hoy</em>, no “algún día”.
            </p>
          </header>

          {/* Tarjeta 3D */}
          <div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="group relative h-80 w-full cursor-pointer select-none rounded-3xl bg-white/5 p-1 ring-1 ring-white/10 transition-transform duration-200"
            style={{ transformStyle: 'preserve-3d' }}
          >
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="grid h-full w-full grid-cols-2 gap-3 rounded-3xl bg-[#0b0b12]/70 p-5 backdrop-blur-xl">
              <div className="flex items-center justify-center">
                <div className="relative aspect-[3/5] w-40 overflow-hidden rounded-2xl ring-1 ring-white/10">
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        color === 'Negro'
                          ? 'linear-gradient(180deg,#17171f,#0d0d14)'
                          : color === 'Beige'
                          ? 'linear-gradient(180deg,#f1e7d9,#e1d2bf)'
                          : color === 'Cocoa'
                          ? 'linear-gradient(180deg,#5a4334,#3c2b21)'
                          : 'linear-gradient(180deg,#f7f7f7,#d9d9db)',
                    }}
                  />
                  <div className="absolute inset-x-4 top-6 h-6 rounded-full bg-white/20 blur-sm" />
                  <div className="absolute bottom-4 left-1/2 h-16 w-16 -translate-x-1/2 rounded-full bg-white/10 blur-md" />
                </div>
              </div>
              <div className="flex flex-col justify-center">
                <h3 className="text-lg font-semibold">Modelo {modelo}</h3>
                <p className="mb-2 text-sm text-white/70">Talla {talla} · {compresion}</p>
                <div className="my-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 via-violet-400 to-sky-400 transition-[width]"
                    style={{ width: `${Math.max(18, progreso)}%` }}
                  />
                </div>
                <p className="text-xs text-white/60">Preparación del pedido: {progreso}%</p>
                <div className="mt-4 text-2xl font-bold tracking-tight">
                  {precio.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}
                </div>
              </div>
            </div>
            {/* Halo */}
            <div className="pointer-events-none absolute -inset-1 -z-10 rounded-3xl bg-gradient-to-r from-fuchsia-500/30 via-violet-500/25 to-sky-500/30 blur-xl opacity-60 group-hover:opacity-90 transition-opacity" />
          </div>

          <ul className="grid grid-cols-2 gap-3 text-sm text-white/80 md:grid-cols-3">
            <li className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">Costuras invisibles</li>
            <li className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">Tejido inteligente</li>
            <li className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">Moldeo rápido</li>
            <li className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">Hechas en Colombia</li>
            <li className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">Confort todo el día</li>
            <li className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">Garantía de ajuste</li>
          </ul>
        </div>

        {/* Formulario */}
        <div className="relative">
          <div className="pointer-events-none absolute -inset-0.5 -z-10 rounded-3xl bg-gradient-to-r from-fuchsia-500/40 via-violet-500/30 to-sky-500/40 opacity-60 blur-xl" />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              comprar();
            }}
            className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl md:p-7"
          >
            <h2 className="mb-4 text-xl font-semibold tracking-tight md:text-2xl">
              Pide tu <span className="bg-gradient-to-r from-fuchsia-300 via-violet-300 to-sky-300 bg-clip-text text-transparent">Faja Vivians</span>
            </h2>

            {/* Datos básicos */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="group">
                <label className="mb-1 block text-sm text-white/70">Nombre*</label>
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Tu nombre"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none ring-0 transition focus:border-fuchsia-400/40"
                />
              </div>
              <div className="group">
                <label className="mb-1 block text-sm text-white/70">Teléfono*</label>
                <input
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value.replace(/[^\d+ ]/g, ''))}
                  placeholder="+57 300 000 0000"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-fuchsia-400/40"
                />
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <input
                id="ws"
                type="checkbox"
                checked={whatsapp}
                onChange={(e) => setWhatsapp(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/10"
              />
              <label htmlFor="ws" className="text-sm text-white/80">Contactarme por WhatsApp</label>
            </div>

            {/* Preferencias de producto */}
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-white/70">Modelo</label>
                <select
                  value={modelo}
                  onChange={(e) => setModelo(e.target.value as Modelo)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-fuchsia-400/40"
                >
                  <option>Cintura</option>
                  <option>Cuerpo entero</option>
                  <option>Postparto</option>
                  <option>Realce glúteos</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-white/70">Talla</label>
                <select
                  value={talla}
                  onChange={(e) => setTalla(e.target.value as Talla)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-fuchsia-400/40"
                >
                  {['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-white/70">Color</label>
                <select
                  value={color}
                  onChange={(e) => setColor(e.target.value as Color)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-fuchsia-400/40"
                >
                  <option>Negro</option>
                  <option>Cocoa</option>
                  <option>Beige</option>
                  <option>Blanco</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-white/70">Compresión</label>
                <select
                  value={compresion}
                  onChange={(e) => setCompresion(e.target.value as Compresion)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-fuchsia-400/40"
                >
                  <option>Suave</option>
                  <option>Media</option>
                  <option>Alta</option>
                </select>
              </div>
            </div>

            {/* Medidas */}
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm text-white/70">Cintura (cm)</label>
                <input
                  inputMode="numeric"
                  value={cintura}
                  onChange={(e) => setCintura(e.target.value ? Number(e.target.value) : '')}
                  placeholder="Ej: 68"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-fuchsia-400/40"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-white/70">Cadera (cm)</label>
                <input
                  inputMode="numeric"
                  value={cadera}
                  onChange={(e) => setCadera(e.target.value ? Number(e.target.value) : '')}
                  placeholder="Ej: 96"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-fuchsia-400/40"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-white/70">Busto (cm)</label>
                <input
                  inputMode="numeric"
                  value={busto}
                  onChange={(e) => setBusto(e.target.value ? Number(e.target.value) : '')}
                  placeholder="Opcional"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-fuchsia-400/40"
                />
              </div>
            </div>

            {/* Objetivo + Upload */}
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-white/70">Objetivo</label>
                <input
                  value={objetivo}
                  onChange={(e) => setObjetivo(e.target.value)}
                  placeholder="Ej: Postparto, moldear cintura…"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-fuchsia-400/40"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-white/70">Foto (opcional)</label>
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-white/20 bg-white/5 px-3 py-2 text-sm hover:border-fuchsia-400/40">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onFile(e.target.files?.[0])}
                  />
                  <span className="text-white/80">Subir referencia</span>
                  <span className="rounded-lg bg-white/10 px-2 py-1 text-xs">PNG/JPG</span>
                </label>
                {foto && (
                  <img
                    src={foto}
                    alt="preview"
                    className="mt-2 h-24 w-full rounded-xl object-cover ring-1 ring-white/10"
                  />
                )}
              </div>
            </div>

            {/* Envío */}
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm text-white/70">Entrega</label>
                <select
                  value={envio}
                  onChange={(e) => setEnvio(e.target.value as 'Domicilio' | 'Tienda')}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-fuchsia-400/40"
                >
                  <option>Domicilio</option>
                  <option>Tienda</option>
                </select>
              </div>
              <div className={`${envio === 'Domicilio' ? '' : 'opacity-40'}`}>
                <label className="mb-1 block text-sm text-white/70">Ciudad</label>
                <input
                  value={ciudad}
                  onChange={(e) => setCiudad(e.target.value)}
                  disabled={envio !== 'Domicilio'}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none disabled:opacity-60 focus:border-fuchsia-400/40"
                />
              </div>
              <div className={`${envio === 'Domicilio' ? '' : 'opacity-40'}`}>
                <label className="mb-1 block text-sm text-white/70">Dirección</label>
                <input
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  disabled={envio !== 'Domicilio'}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none disabled:opacity-60 focus:border-fuchsia-400/40"
                />
              </div>
            </div>

            {/* Pago */}
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-white/70">Método de pago</label>
                <select
                  value={pago}
                  onChange={(e) => setPago(e.target.value as Pago)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-fuchsia-400/40"
                >
                  <option>Contraentrega</option>
                  <option>Nequi</option>
                  <option>Daviplata</option>
                  <option>Tarjeta</option>
                </select>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0f0f16]/60 p-3 text-sm text-white/80">
                <div className="flex items-center justify-between">
                  <span>Total estimado</span>
                  <strong className="text-lg">
                    {precio.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}
                  </strong>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full w-1/2 rounded-full bg-gradient-to-r from-fuchsia-400 via-violet-400 to-sky-400 animate-[pulse_2s_ease-in-out_infinite]"
                    style={{ width: `${Math.max(22, progreso)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-white/60">
                  * El valor puede variar según disponibilidad, envíos y promoción activa.
                </p>
              </div>
            </div>

            {/* Términos */}
            <div className="mt-5 flex items-start gap-2">
              <input
                id="acepto"
                type="checkbox"
                checked={acepto}
                onChange={(e) => setAcepto(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-white/20 bg-white/10"
              />
              <label htmlFor="acepto" className="text-sm text-white/80">
                Acepto la política de tratamiento de datos y confirmo que deseo ser contactada(o) por Fajas Vivians.
              </label>
            </div>

            {/* CTA */}
            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="submit"
                className="group relative inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold text-white transition [text-shadow:0_1px_0_rgba(0,0,0,.3)]"
              >
                <span className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-r from-fuchsia-500 via-violet-500 to-sky-500 opacity-90 blur-md transition group-hover:opacity-100" />
                <span className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-r from-fuchsia-500 via-violet-500 to-sky-500 ring-1 ring-white/20" />
                Comprar ahora
              </button>

              <div className="text-right text-xs text-white/70">
                Hechas con detalle, elegantes por fuera y por dentro.<br />
                Resultado visible en corto tiempo. 💫
              </div>
            </div>
          </form>

          {/* Toast */}
          {toast && (
            <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex items-center justify-center px-4">
              <div className="pointer-events-auto max-w-md rounded-2xl border border-white/10 bg-[#0f0f16]/90 px-4 py-3 text-sm text-white shadow-2xl backdrop-blur-xl">
                {toast}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
