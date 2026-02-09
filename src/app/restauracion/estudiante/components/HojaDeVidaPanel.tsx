'use client';

// --- 1. IMPORTACIONES ---
import React, { useState, useEffect, useRef } from 'react';
import {
  User, Edit2, SquarePen, Save, Trash2, Landmark, BookOpen,
  HeartPulse, ClipboardList, NotebookPen, IdCard, Phone, Mail,
  MapPin, Calendar, GraduationCap, Loader2, MessageSquare, Send, Clock, Check
} from 'lucide-react';
import { supabase } from '../../../../lib/supabaseClient';
import { AnimatePresence, motion } from 'framer-motion';

// Importamos utilidades (Asegúrate que la ruta sea correcta)
import {
  Entrevista, classNames, extFromMime, bustUrl, PLACEHOLDER_SVG,
  downscaleImage, DIAS, ESTADOS, TIEMPO_ORACION, LECTURA_BIBLIA, CONVIVENCIA,
  CEField
} from './academia.utils';

// Nota: Los estilos del scrollbar se manejan mediante Tailwind CSS utilities

// --- 2. COMPONENTE PRINCIPAL ---
export function HojaDeVidaPanel({
  row,
  signedUrl,
  onUpdated,
  onDeleted,
  className,
  currentUserName = 'Admin',
  currentUserRole
}: {
  row: Entrevista;
  signedUrl: string | null;
  onUpdated: (r: Entrevista) => void;
  onDeleted: (id: string) => void;
  className?: string;
  currentUserName?: string;
  currentUserRole?: string;
}) {
  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [form, setForm] = useState<Entrevista>(row);

  const [localSignedUrl, setLocalSignedUrl] = useState<string | null>(signedUrl);
  const inputFotoRef = useRef<HTMLInputElement>(null);

  // Estados recuperados
  const [viewMode, setViewMode] = useState<'general' | 'observaciones'>('general');
  const [newObs, setNewObs] = useState('');
  const [isFlying, setIsFlying] = useState(false);
  const [showNewObservation, setShowNewObservation] = useState(false);

  const parsedObservations = React.useMemo(() => {
    if (!form.notas) return [];
    return form.notas.split('\n')
      .filter(line => line.trim()) // Filtrar lineas vacias
      .map((line, i) => {
        // 1. Intenta formato estricto: [Fecha] (Usuario): Texto
        let match = line.match(/^\[(.*?)\] \((.*?)\): (.*)/);

        // 2. Si falla, intenta formato sin paréntesis (común en logs antiguos): [Fecha] Usuario: Texto
        if (!match) {
          match = line.match(/^\[(.*?)\] (.*?): (.*)/);
        }

        if (match) {
          return { id: i, date: match[1], user: match[2], text: match[3] };
        }

        // Si no coincide, fallback
        return { id: i, date: 'Registro', user: 'Sistema', text: line };
      });
  }, [form.notas]);

  async function handleAddObservation() {
    if (!newObs.trim() || saving) return;

    try {
      setSaving(true);
      setIsFlying(true); // Activar animación

      const dateStr = new Date().toLocaleString('es-CO');
      const newEntry = `[${dateStr}] (${currentUserName}): ${newObs.trim()}`;
      const updatedNotas = form.notas ? `${newEntry}\n${form.notas}` : newEntry;

      const { data, error } = await supabase
        .from('entrevistas')
        .update({
          notas: updatedNotas,
          updated_at: new Date().toISOString()
        })
        .eq('id', form.id)
        .select('*')
        .single();

      if (error) throw error;

      // Esperar a que el avioncito "aterrice" antes de mostrar la observación
      setTimeout(() => {
        setForm(data as Entrevista);
        setShowNewObservation(true);
        onUpdated(data as Entrevista);

        // Resetear la animación de entrada de la observación
        setTimeout(() => setShowNewObservation(false), 800);
      }, 1400); // Sincronizado con el aterrizaje del avioncito (1.6s animation)

      setNewObs('');

      // Resetear animación del avioncito
      setTimeout(() => setIsFlying(false), 1700);
    } catch (e: any) {
      console.error('Error al agregar observación:', e);
      alert('No se pudo guardar la observación: ' + (e.message || 'Error desconocido'));
      setIsFlying(false);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => setLocalSignedUrl(signedUrl), [signedUrl]);
  useEffect(() => setForm(row), [row]);

  // Helpers de estado
  function setF<K extends keyof Entrevista>(k: K, v: Entrevista[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  const onCE = (k: keyof Entrevista) => (val: string) => {
    setF(k, val as any);
  };
  const onBool = (k: keyof Entrevista) => (v: 'si' | 'no' | null) => {
    setF(k, v === 'si' ? true : v === 'no' ? false : null);
  };
  const onBoolString = (k: keyof Entrevista) => (v: 'si' | 'no' | null) => {
    setF(k, v);
  };

  // Acciones
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Acciones
  async function handleUpdate() {
    if (!edit) { setEdit(true); return; }
    try {
      setSaving(true);
      // Payload completo
      const payload = {
        nombre: form.nombre ?? null, cedula: form.cedula ?? null, email: form.email ?? null,
        telefono: form.telefono ?? null, fecha_nac: form.fecha_nac ?? null, lugar_nac: form.lugar_nac ?? null,
        direccion: form.direccion ?? null, escolaridad: form.escolaridad ?? null, ocupacion: form.ocupacion ?? null,
        estado_civil: form.estado_civil ?? null, se_congrega: form.se_congrega ?? null,
        dia_congrega: form.se_congrega === 'si' ? form.dia_congrega : null, tiempo_iglesia: form.tiempo_iglesia ?? null,
        invito: form.invito ?? null, pastor: form.pastor ?? null, viene_otra_iglesia: form.viene_otra_iglesia ?? null,
        otra_iglesia_nombre: form.viene_otra_iglesia === 'si' ? form.otra_iglesia_nombre : null, convivencia: form.convivencia ?? null,
        bautizo_agua: form.bautizo_agua ?? null, tiene_biblia: form.tiene_biblia ?? null, ayuna: form.ayuna ?? null,
        motivo_ayuno: form.ayuna === 'si' ? form.motivo_ayuno : null, tiempo_oracion: form.tiempo_oracion ?? null,
        frecuencia_lectura_biblia: form.frecuencia_lectura_biblia ?? null, meta_personal: form.meta_personal ?? null,
        enfermedad: form.enfermedad ?? null, tratamiento_clinico: form.tratamiento_clinico ?? null,
        motivo_tratamiento: form.tratamiento_clinico === 'si' ? form.motivo_tratamiento : null, retiros_asistidos: form.retiros_asistidos ?? null,
        recibe_consejeria: form.recibe_consejeria ?? null, motivo_consejeria: form.recibe_consejeria === 'si' ? form.motivo_consejeria : null,
        interviene: form.interviene ?? null, cambios_fisicos: form.cambios_fisicos ?? null, desempeno_clase: form.desempeno_clase ?? null,
        maestro_encargado: form.maestro_encargado ?? null, promovido: form.promovido ?? null, notas: form.notas ?? null,
        foto_path: form.foto_path ?? null, updated_at: new Date().toISOString(), labora_actualmente: form.labora_actualmente ?? null,
      };

      const { data, error } = await supabase.from('entrevistas').update(payload).eq('id', form.id).select('*').single();
      if (error) throw error;
      onUpdated(data as Entrevista);

      // Activar animación de éxito
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setEdit(false);
      }, 2000);

    } catch (e: any) { console.error(e); alert(e?.message ?? 'Error actualizando'); } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar definitivamente?')) return;
    try {
      setSaving(true);
      if (form.foto_path) await supabase.storage.from('entrevistas-fotos').remove([form.foto_path]);
      const { error } = await supabase.from('entrevistas').delete().eq('id', form.id);
      if (error) throw error;
      onDeleted(form.id);
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  }

  async function handleChangeFoto(file: File) {
    if (!file.type.startsWith('image/')) return;
    setUploadingFoto(true);
    try {
      const compact = await downscaleImage(file, 500, 0.8);
      const tempUrl = URL.createObjectURL(compact);
      setLocalSignedUrl(tempUrl);
      const path = `fotos/${row.id}-${Date.now()}${extFromMime(compact.type)}`;
      const { error } = await supabase.storage.from('entrevistas-fotos').upload(path, compact, { upsert: true });
      if (error) throw error;
      await supabase.from('entrevistas').update({ foto_path: path }).eq('id', row.id);
      const signed = await supabase.storage.from('entrevistas-fotos').createSignedUrl(path, 600);
      if (form.foto_path) await supabase.storage.from('entrevistas-fotos').remove([form.foto_path]);
      setF('foto_path', path);
      setLocalSignedUrl(bustUrl(signed.data?.signedUrl) ?? null);
    } catch (e) { alert('Error foto'); } finally { setUploadingFoto(false); }
  }

  // --- RENDERIZADO PREMIUM ---
  return (
    <div className={classNames(
      "flex flex-col h-full w-full overflow-hidden rounded-2xl shadow-2xl relative isolate",
      "border border-white/20",
      // FONDO PREMIUM: Gradiente suave azul/lavanda
      "bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50",
      className
    )}>

      {/* Luces de fondo ambientales premium */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-blue-400/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-400/15 rounded-full blur-[100px]"></div>
      </div>

      <div className="flex flex-1 h-full relative z-10 flex-col md:flex-row backdrop-blur-[2px]">

        {/* === PANEL IZQUIERDO: PERFIL (Diseño limpio) === */}
        <aside className="w-full md:w-[320px] flex-shrink-0 border-r border-white/20 flex flex-col bg-white/40 backdrop-blur-xl">

          {/* Header Perfil */}
          <div className="px-4 pt-2 md:pt-4 pb-3 md:pb-6 flex flex-col items-center text-center border-b border-white/20 relative">

            {/* Botón EDITAR - Superior izquierda (Compacto para todos los tamaños) */}
            <div className="absolute top-4 left-4 flex gap-2 z-20">
              <button
                onClick={handleUpdate}
                disabled={saving || saveSuccess}
                className={classNames(
                  "group relative h-[34px] md:h-[28px] rounded-full transition-all duration-500 outline-none shadow-lg overflow-hidden",
                  // Ancho dinámico
                  saveSuccess ? "w-[120px] md:w-[100px] cursor-default" : "w-[110px] md:w-[80px] active:scale-95"
                )}
              >
                {/* Body Background & Shadows */}
                <div className={classNames(
                  "absolute inset-0 transition-colors duration-500 ease-out border border-white/20",
                  saveSuccess
                    ? "bg-gradient-to-r from-emerald-500 to-green-500"
                    : edit
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                      : "bg-gradient-to-r from-blue-600 to-indigo-600"
                )}>
                  {/* Inner Shadow for Depth */}
                  <div className="absolute inset-0 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"></div>

                  {/* Gloss Overlay */}
                  <div className="absolute right-0 top-0 bottom-0 w-[50%] bg-gradient-to-l from-white/20 to-transparent skew-x-12 opacity-60"></div>

                  {/* Success Shine Animation */}
                  {saveSuccess && (
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/50 to-transparent w-[150%]" />
                  )}

                  {/* Light Sweep Animation (Hover) */}
                  {!saveSuccess && (
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out bg-gradient-to-r from-transparent via-white/50 to-transparent w-[150%]" />
                  )}
                </div>

                {/* Knob Content */}
                <div className={classNames(
                  "absolute inset-y-0 left-0.5 flex items-center transition-all duration-500",
                  saveSuccess ? "translate-x-[88px] md:translate-x-[72px]" : "translate-x-0"
                )}>
                  <div className={classNames(
                    "h-[28px] w-[28px] md:h-[22px] md:w-[22px] rounded-full shadow-md flex items-center justify-center z-10 transition-colors duration-300 border-2 border-white",
                    saveSuccess ? "bg-white text-emerald-600 scale-110" : "bg-gradient-to-b from-white to-gray-200",
                    !saveSuccess && (edit ? "text-emerald-600" : "text-blue-600")
                  )}>
                    <AnimatePresence mode="wait">
                      {saveSuccess ? (
                        <motion.div
                          key="success"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                        >
                          <Check size={14} strokeWidth={4} className="md:w-3.5 md:h-3.5" />
                        </motion.div>
                      ) : edit ? (
                        saving ? (
                          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <Loader2 size={12} className="animate-spin md:w-3 md:h-3" />
                          </motion.div>
                        ) : (
                          <motion.div key="save" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                            <Save size={12} className="md:w-3 md:h-3" />
                          </motion.div>
                        )
                      ) : (
                        <motion.div key="edit" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                          <Edit2 size={12} className="md:w-3 md:h-3" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Text */}
                <div className="absolute inset-0 flex items-center justify-center pl-6 md:pl-5 pointer-events-none">
                  <AnimatePresence mode="wait">
                    {saveSuccess ? (
                      <motion.span
                        key="saved-text"
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -10, opacity: 0 }}
                        className="text-[9px] md:text-[8px] font-black text-white uppercase tracking-widest drop-shadow-md pr-6 md:pr-4"
                      >
                        ¡GUARDADO!
                      </motion.span>
                    ) : (
                      <motion.span
                        key="normal-text"
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -10, opacity: 0 }}
                        className="text-[9px] md:text-[7px] font-black text-white uppercase tracking-widest drop-shadow-md"
                      >
                        {edit ? (saving ? "Guardando" : "Guardar") : "Editar"}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </button>
            </div>

            {/* Avatar Premium Refinado */}
            <div className="relative group mb-2 md:mb-4">
              <div className={classNames(
                "w-24 h-24 md:w-32 md:h-32 rounded-full p-[3px] shadow-xl transition-all duration-500",
                "bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400",
                uploadingFoto && "animate-pulse"
              )}>
                <div className="w-full h-full rounded-full overflow-hidden bg-white relative border border-white/50">
                  <img src={localSignedUrl ?? PLACEHOLDER_SVG} alt="Avatar" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  {/* Overlay de edición */}
                  <div onClick={() => inputFotoRef.current?.click()} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-all duration-300 backdrop-blur-[1px]">
                    <Edit2 className="text-white drop-shadow-md" size={16} />
                  </div>
                </div>
              </div>
              <input ref={inputFotoRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleChangeFoto(e.target.files[0])} />
            </div>

            {/* Nombre & Título */}
            <div className="w-full mt-2 space-y-1">
              {edit ? (
                <CEField value={form.nombre} edit={true} onChange={onCE('nombre')} placeholder="Tu Nombre" className="text-2xl font-bold text-slate-800 block border-b border-indigo-500/50 text-center bg-transparent tracking-tight" />
              ) : (
                <h2 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-blue-600 tracking-tight leading-tight">{form.nombre || 'Sin Nombre'}</h2>
              )}

              {edit ? (
                <CEField value={form.ocupacion} edit={true} onChange={onCE('ocupacion')} placeholder="Profesión" className="text-xs text-blue-700 block border-b border-blue-500/30 text-center bg-transparent font-medium" />
              ) : (
                <p className="text-xs text-blue-600 font-medium tracking-wide uppercase">{form.ocupacion || 'Sin Ocupación'}</p>
              )}
            </div>

            {/* TOGGLE OBSERVACIONES BUTTON */}
            <div className="px-4 pb-3 mt-2 md:mt-3 w-full">
              <button
                onClick={() => setViewMode(viewMode === 'general' ? 'observaciones' : 'general')}
                className={classNames(
                  "w-full flex items-center justify-between gap-2 px-4 py-2.5 md:py-2 rounded-xl transition-all duration-300 group shadow-md hover:shadow-lg",
                  viewMode === 'observaciones'
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 ring-2 ring-blue-300/50 hover:from-blue-700 hover:to-indigo-700"
                    : "bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600"
                )}
              >
                <div className="flex items-center gap-2">
                  {viewMode === 'observaciones' ? (
                    <User size={16} className="text-white transition-transform group-hover:-translate-x-1 md:w-4 md:h-4" />
                  ) : (
                    <MessageSquare size={16} className="text-white transition-transform group-hover:scale-110 md:w-4 md:h-4" />
                  )}
                  <span className="text-xs md:text-[11px] font-bold uppercase tracking-wide text-white">
                    {viewMode === 'observaciones' ? 'Ver Información' : 'Observaciones'}
                  </span>
                </div>
                <div className={classNames(
                  "flex items-center justify-center min-w-[22px] h-[22px] md:min-w-[18px] md:h-[18px] px-1.5 rounded-full text-[10px] md:text-[9px] font-extrabold shadow-sm transition-colors",
                  viewMode === 'observaciones' ? "bg-white/20 text-white" : "bg-white text-teal-700"
                )}>
                  {parsedObservations.length}
                </div>
              </button>
            </div>


          </div>

          {/* Lista de Contacto */}
          <div className="hidden md:block px-4 py-4 overflow-y-auto custom-scrollbar">
            <div className="space-y-3">
              <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.25em] border-b border-slate-300 pb-1 mb-2">Contacto</h3>
              <ContactRow icon={<IdCard size={16} />} label="Cédula" value={form.cedula} edit={edit} onChange={onCE('cedula')} />
              <ContactRow icon={<Phone size={16} />} label="Teléfono" value={form.telefono} edit={edit} onChange={onCE('telefono')} color="text-cyan-400" />
              <ContactRow icon={<Mail size={16} />} label="Email" value={form.email} edit={edit} onChange={onCE('email')} color="text-blue-400" />
            </div>
          </div>
        </aside>

        {/* === PANEL DERECHO: CONTENIDO CAMBIEABLE === */}
        <main className="flex-1 overflow-hidden relative bg-transparent">
          <AnimatePresence mode="wait">
            {viewMode === 'general' ? (
              <motion.div
                key="general"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="h-full overflow-y-auto custom-scrollbar p-4 md:p-6"
              >
                {/* Mobile Contact - Scrolls with content */}
                <div className="md:hidden block mb-6 bg-white/40 backdrop-blur-xl p-5 rounded-2xl border border-white/20 shadow-sm">
                  <div className="space-y-3">
                    <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.25em] border-b border-slate-300 pb-1 mb-2">Contacto</h3>
                    <ContactRow icon={<IdCard size={16} />} label="Cédula" value={form.cedula} edit={edit} onChange={onCE('cedula')} />
                    <ContactRow icon={<Phone size={16} />} label="Teléfono" value={form.telefono} edit={edit} onChange={onCE('telefono')} color="text-cyan-400" />
                    <ContactRow icon={<Mail size={16} />} label="Email" value={form.email} edit={edit} onChange={onCE('email')} color="text-blue-400" />
                  </div>
                </div>

                <div className="max-w-6xl mx-auto space-y-4">

                  {/* Header Sección - Compacto */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-3">
                    <div>
                      <h1 className="text-xl md:text-2xl font-semibold text-slate-800 mb-0.5">Información Detallada</h1>
                      <p className="text-xs md:text-sm text-slate-600 font-light">
                        Gestión integral del perfil académico y espiritual
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-5">
                    {/* === TARJETAS DE CRISTAL === */}
                    <GlassSection title="Datos Demográficos" icon={<User size={20} />} color="indigo">
                      <DarkRowDate label="Fecha Nacimiento" icon={<Calendar size={14} />} value={form.fecha_nac} edit={edit} onChange={onCE('fecha_nac')} />
                      <DarkRow label="Lugar Nacimiento" icon={<MapPin size={14} />} value={form.lugar_nac} edit={edit} onChange={onCE('lugar_nac')} />
                      <DarkRow label="Dirección" value={form.direccion} edit={edit} onChange={onCE('direccion')} />
                      <DarkRowSelect label="Estado Civil" value={form.estado_civil} edit={edit} onChange={(v: any) => setF('estado_civil', v)} options={ESTADOS} />
                      <DarkRowSelect label="Convivencia" value={form.convivencia} edit={edit} onChange={(v: any) => setF('convivencia', v)} options={CONVIVENCIA} />
                      <DarkRow label="Escolaridad" icon={<GraduationCap size={14} />} value={form.escolaridad} edit={edit} onChange={onCE('escolaridad')} />
                      <DarkRow label="Ocupación" value={form.ocupacion} edit={edit} onChange={onCE('ocupacion')} />
                      <DarkRowBool label="Labora actualmente" value={form.labora_actualmente} edit={edit} onChange={onBoolString('labora_actualmente')} />
                    </GlassSection>

                    <GlassSection title="Vida Eclesiástica" icon={<Landmark size={20} />} color="cyan">
                      <DarkRowBool label="¿Se congrega?" value={form.se_congrega} edit={edit} onChange={onBoolString('se_congrega')} />
                      <DarkRowSelect label="Día servicio" value={form.dia_congrega} edit={edit} onChange={(v: any) => setF('dia_congrega', v)} options={DIAS} disabled={form.se_congrega !== 'si'} />
                      <DarkRow label="Tiempo asistiendo" value={form.tiempo_iglesia} edit={edit} onChange={onCE('tiempo_iglesia')} />
                      <DarkRow label="Invitado por" value={form.invito} edit={edit} onChange={onCE('invito')} />
                      <DarkRow label="Pastor" value={form.pastor} edit={edit} onChange={onCE('pastor')} />
                      <DarkRowBool label="De otra iglesia" value={form.viene_otra_iglesia} edit={edit} onChange={onBoolString('viene_otra_iglesia')} />
                      {form.viene_otra_iglesia === 'si' && <DarkRow label="¿Cuál iglesia?" value={form.otra_iglesia_nombre} edit={edit} onChange={onCE('otra_iglesia_nombre')} />}
                    </GlassSection>

                    <GlassSection title="Vida Espiritual" icon={<BookOpen size={20} />} color="amber">
                      <DarkRowBool label="Bautizo agua" value={form.bautizo_agua} edit={edit} onChange={onBoolString('bautizo_agua')} />
                      <DarkRowBool label="Tiene Biblia" value={form.tiene_biblia} edit={edit} onChange={onBool('tiene_biblia')} />
                      <DarkRowBool label="Ayuna" value={form.ayuna} edit={edit} onChange={onBoolString('ayuna')} />
                      {form.ayuna === 'si' && <DarkRow label="Motivo Ayuno" value={form.motivo_ayuno} edit={edit} onChange={onCE('motivo_ayuno')} />}
                      <DarkRowSelect label="Tiempo oración" value={form.tiempo_oracion} edit={edit} onChange={(v: any) => setF('tiempo_oracion', v)} options={TIEMPO_ORACION} />
                      <DarkRowSelect label="Lectura Bíblica" value={form.frecuencia_lectura_biblia} edit={edit} onChange={(v: any) => setF('frecuencia_lectura_biblia', v)} options={LECTURA_BIBLIA} />
                    </GlassSection>

                    <GlassSection title="Salud y Bienestar" icon={<HeartPulse size={20} />} color="rose">
                      <DarkRow label="Meta Personal" value={form.meta_personal} edit={edit} onChange={onCE('meta_personal')} />
                      <DarkRow label="Enfermedad" value={form.enfermedad} edit={edit} onChange={onCE('enfermedad')} />
                      <DarkRowBool label="Tratamiento clínico" value={form.tratamiento_clinico} edit={edit} onChange={onBoolString('tratamiento_clinico')} />
                      {form.tratamiento_clinico === 'si' && <DarkRow label="Motivo trat." value={form.motivo_tratamiento} edit={edit} onChange={onCE('motivo_tratamiento')} />}
                      <DarkRowBool label="Recibe consejería" value={form.recibe_consejeria} edit={edit} onChange={onBoolString('recibe_consejeria')} />
                      {form.recibe_consejeria === 'si' && <DarkRow label="Motivo cons." value={form.motivo_consejeria} edit={edit} onChange={onCE('motivo_consejeria')} />}
                    </GlassSection>

                    {/* Ancho Completo */}
                    <div>
                      <GlassSection title="Evaluación Académica" icon={<ClipboardList size={20} />} color="violet">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2">
                          <div>
                            <DarkRowBool label="Participa activamente" value={form.interviene} edit={edit} onChange={onBool('interviene')} />
                            <DarkRow label="Maestro Encargado" value={form.maestro_encargado} edit={edit} onChange={onCE('maestro_encargado')} />
                            <DarkRow label="Retiros Asistidos" value={form.retiros_asistidos} edit={edit} onChange={onCE('retiros_asistidos')} />
                          </div>
                          <div>
                            <DarkRow label="Cambios físicos" value={form.cambios_fisicos} edit={edit} onChange={onCE('cambios_fisicos')} />
                            <DarkRow label="Desempeño general" value={form.desempeno_clase} edit={edit} onChange={onCE('desempeno_clase')} />
                          </div>
                        </div>
                      </GlassSection>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="observaciones"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="h-full overflow-y-auto custom-scrollbar p-4 md:p-10"
              >
                <div className="min-h-full pb-0 flex flex-col">
                  <div className="flex flex-col gap-4 md:gap-6">

                    {/* Premium Header Observaciones */}
                    <div className="flex-shrink-0 bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-800 rounded-xl p-3 md:p-4 flex items-center gap-3 md:gap-4 shadow-lg border border-white/20 relative overflow-hidden group">
                      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
                      <div className="absolute -right-10 -top-10 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-700"></div>

                      <div className="relative p-2 md:p-2.5 bg-white/15 rounded-lg md:rounded-xl text-white backdrop-blur-md border border-white/10 shadow-inner group-hover:scale-110 transition-transform duration-300">
                        <NotebookPen size={20} className="md:w-6 md:h-6" strokeWidth={2} />
                      </div>
                      <div className="relative">
                        <h3 className="text-sm md:text-base font-bold text-white uppercase tracking-widest drop-shadow-md">Historial de Observaciones</h3>
                        <p className="text-[10px] md:text-[11px] text-emerald-50 font-medium opacity-90">Bitácora de seguimiento y anotaciones</p>
                      </div>
                    </div>

                    {/* Input Area - Fixed at top */}
                    <div className="flex gap-2 items-end bg-white/40 p-2 md:p-3 rounded-xl border border-white/40 shadow-inner flex-shrink-0 relative">
                      <textarea
                        value={newObs}
                        onChange={e => setNewObs(e.target.value)}
                        placeholder="Escribe una nueva observación..."
                        className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-slate-700 placeholder-slate-500 resize-none h-16 md:h-20 py-1"
                      />
                      <button
                        onClick={handleAddObservation}
                        disabled={!newObs.trim() || saving}
                        className="p-2 rounded-lg bg-teal-600 text-white shadow-lg hover:bg-teal-700 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 flex-shrink-0 relative"
                        title="Agregar Observación"
                      >
                        {saving && !isFlying ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className={isFlying ? 'opacity-0' : ''} />}
                      </button>

                      {/* Flying Paper Plane Animation */}
                      <AnimatePresence>
                        {isFlying && (
                          <motion.div
                            initial={{
                              x: 0,
                              y: 0,
                              rotate: 0,
                              scale: 1,
                              opacity: 1
                            }}
                            animate={{
                              x: [0, -20, -60, -120, -140, -120, -60, -20, 0],
                              y: [0, -60, -140, -220, -280, -340, -380, -400, -420],
                              rotate: [0, -40, -100, -180, -230, -280, -320, -345, -360],
                              scale: [1, 1.15, 1.3, 1.4, 1.4, 1.3, 1.15, 0.9, 0.5],
                              opacity: [1, 1, 1, 1, 1, 1, 1, 0.7, 0]
                            }}
                            transition={{
                              duration: 1.6,
                              ease: "easeInOut",
                              times: [0, 0.11, 0.22, 0.33, 0.44, 0.55, 0.66, 0.85, 1]
                            }}
                            className="absolute right-2 bottom-2 pointer-events-none z-50"
                          >
                            <div className="relative">
                              <Send size={24} className="text-teal-300 drop-shadow-[0_0_24px_rgba(20,184,166,1)]" />
                              {/* Estela continua */}
                              <motion.div
                                animate={{
                                  opacity: [0.6, 1, 0.6],
                                  scale: [2.5, 3.5, 2.5]
                                }}
                                transition={{
                                  duration: 0.4,
                                  repeat: Infinity,
                                  ease: "linear"
                                }}
                                className="absolute inset-0 bg-gradient-radial from-teal-200/80 via-teal-300/50 to-transparent rounded-full blur-2xl"
                              />
                              {/* Partículas de velocidad */}
                              <motion.div
                                animate={{
                                  scale: [1, 2.5, 1],
                                  opacity: [0.8, 1, 0.8],
                                  rotate: [0, 360]
                                }}
                                transition={{
                                  duration: 0.5,
                                  repeat: Infinity,
                                  ease: "linear"
                                }}
                                className="absolute -inset-4 bg-gradient-conic from-teal-100/80 via-emerald-200/60 to-cyan-200/40 rounded-full blur-xl"
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Timeline */}
                    <motion.div
                      className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1 min-h-0"
                      variants={{
                        hidden: {
                          transition: { staggerChildren: 0.035, staggerDirection: -1 }
                        },
                        visible: {
                          transition: { delayChildren: 0.12, staggerChildren: 0.055 }
                        }
                      }}
                      initial="hidden"
                      animate="visible"
                    >
                      {parsedObservations.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 italic text-sm">No hay observaciones registradas.</div>
                      ) : parsedObservations.map((obs) => {
                        // Paleta Avatar Premium Dinámica
                        const avatars = [
                          "bg-gradient-to-br from-purple-500 to-indigo-600 shadow-purple-500/30",
                          "bg-gradient-to-br from-rose-500 to-pink-600 shadow-rose-500/30",
                          "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30",
                          "bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/30",
                          "bg-gradient-to-br from-blue-500 to-cyan-600 shadow-blue-500/30",
                          "bg-gradient-to-br from-slate-600 to-slate-800 shadow-slate-500/30"
                        ];

                        // Paleta de Cintas Suaves (Matching ribbons)
                        const ribbons = [
                          "bg-gradient-to-r from-purple-50/90 via-indigo-50/90 to-transparent border-l-4 border-purple-400",
                          "bg-gradient-to-r from-rose-50/90 via-pink-50/90 to-transparent border-l-4 border-rose-400",
                          "bg-gradient-to-r from-emerald-50/90 via-teal-50/90 to-transparent border-l-4 border-emerald-400",
                          "bg-gradient-to-r from-amber-50/90 via-orange-50/90 to-transparent border-l-4 border-amber-400",
                          "bg-gradient-to-r from-blue-50/90 via-cyan-50/90 to-transparent border-l-4 border-blue-400",
                          "bg-gradient-to-r from-slate-100/90 via-gray-50/90 to-transparent border-l-4 border-slate-400"
                        ];

                        const idx = (obs.user || 'S').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % avatars.length;
                        const themeClass = avatars[idx];
                        const ribbonClass = ribbons[idx];
                        const initials = (obs.user || 'S').substring(0, 2).toUpperCase();

                        return (
                          <motion.div
                            key={obs.id}
                            className="flex gap-4 mb-5 group px-1"
                            variants={{
                              hidden: { opacity: 0, x: 28, y: 14, scale: 0.97 },
                              visible: {
                                opacity: 1,
                                x: 0,
                                y: 0,
                                scale: 1,
                                transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
                              }
                            }}
                          >
                            {/* Avatar */}
                            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-lg border-2 border-white ring-1 ring-black/5 ${themeClass} z-10 select-none transform transition-transform group-hover:scale-110 mt-1`}>
                              {initials}
                            </div>
                            {/* Content Bubble */}
                            <div className="flex-1 bg-white hover:bg-white/95 backdrop-blur-sm rounded-2xl rounded-tl-sm shadow-sm border border-white/50 transition-all hover:shadow-md hover:-translate-y-0.5 overflow-hidden">
                              {/* Cinta Premium Header */}
                              <div className={`px-4 py-2 flex justify-between items-center ${ribbonClass}`}>
                                <span className="font-bold text-[11px] text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                  {obs.user}
                                </span>
                                <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1 opacity-80">
                                  <Clock size={10} /> {obs.date}
                                </span>
                              </div>
                              <div className="p-4 pt-3">
                                <p className="text-sm text-slate-600 leading-relaxed font-normal whitespace-pre-wrap">{obs.text}</p>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main >
      </div >
    </div >
  );
}

// ============================================================================
//  COMPONENTES LOCALES CON ESTILO "GLASS" REFINADO
// ============================================================================

function ContactRow({ icon, label, value, edit, onInput, onChange, color = "text-slate-400" }: any) {
  return (
    <div className="group flex items-center gap-3 p-2 rounded-xl hover:bg-white/60 transition-all border border-transparent hover:border-white/40">
      <div className={classNames(
        "w-8 h-8 rounded-lg flex items-center justify-center transition-all shadow-lg",
        "bg-white border border-slate-300 group-hover:scale-110 group-hover:border-slate-400",
        color
      )}>
        {icon}
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mb-0.5">{label}</span>
        <div className="text-sm text-slate-800 font-medium truncate">
          {edit ? <CEField value={value} edit={true} onInput={onInput} onChange={onChange} className="border-b border-slate-600 block w-full bg-transparent" /> : (value || '—')}
        </div>
      </div>
    </div>
  );
}

function GlassSection({ title, icon, color, children }: any) {
  const themeColors: any = {
    indigo: "from-indigo-600 via-blue-600 to-indigo-800",
    cyan: "from-cyan-600 via-blue-500 to-cyan-800",
    amber: "from-amber-600 via-orange-500 to-amber-800",
    rose: "from-rose-600 via-pink-600 to-rose-800",
    violet: "from-violet-600 via-purple-600 to-violet-800",
    teal: "from-teal-600 via-emerald-600 to-teal-800",
  };

  const subtitles: any = {
    "Datos Demográficos": "Información personal básica",
    "Vida Eclesiástica": "Compromiso y asistencia",
    "Vida Espiritual": "Crecimiento y disciplinas",
    "Salud y Bienestar": "Estado físico y emocional",
    "Evaluación Académica": "Desempeño y aprendizaje"
  };

  const bgGradient = themeColors[color] || themeColors.indigo;
  const subtitle = subtitles[title] || "Información General";

  return (
    <div className="relative group overflow-hidden rounded-xl border border-white/40 bg-white/60 backdrop-blur-md transition-all duration-300 shadow-lg hover:shadow-xl">
      {/* Premium Header */}
      <div className={classNames(
        "relative p-4 flex items-center gap-4 overflow-hidden shadow-md",
        "bg-gradient-to-r",
        bgGradient
      )}>
        {/* Texture Overlay */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>

        {/* Glow Effect */}
        <div className="absolute -right-10 -top-10 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-700"></div>

        {/* Icon Box */}
        <div className="relative p-2.5 bg-white/15 rounded-xl text-white backdrop-blur-md border border-white/10 shadow-inner group-hover:scale-110 transition-transform duration-300">
          {React.cloneElement(icon, { size: 22, strokeWidth: 2 })}
        </div>

        {/* Text */}
        <div className="relative">
          <h4 className="text-sm md:text-base font-bold text-white uppercase tracking-widest drop-shadow-md">
            {title}
          </h4>
          <p className="text-[10px] md:text-[11px] text-white/90 font-medium opacity-90">
            {subtitle}
          </p>
        </div>
      </div>

      <div className="p-6 space-y-1">{children}</div>
    </div>
  );
}

function DarkRow({ label, value, edit, onInput, onChange, icon }: any) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between py-3 border-b border-slate-200 last:border-0 gap-2 hover:bg-white/40 px-3 -mx-3 rounded-lg transition-colors">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-600 uppercase w-[160px] flex-shrink-0 tracking-wide mt-0.5">
        {icon && <span className="opacity-50">{icon}</span>}
        {label}
      </div>
      <div className="text-sm text-slate-700 font-light flex-1 sm:text-right break-words leading-relaxed">
        {edit ? (
          <CEField value={value} edit={true} onInput={onInput} onChange={onChange} className="inline-block min-w-[50px] text-left sm:text-right border-b border-blue-500/50 px-1 focus:border-blue-400 transition-colors" />
        ) : (
          value || <span className="text-slate-400 text-xs">—</span>
        )}
      </div>
    </div>
  );
}

function DarkRowSelect({ label, value, edit, onChange, options, disabled }: any) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-200 last:border-0 hover:bg-white/40 px-3 -mx-3 rounded-lg transition-colors">
      <div className="text-xs font-medium text-slate-600 uppercase tracking-wide">{label}</div>
      <div className="text-sm text-slate-700">
        {edit ? (
          <select
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="bg-white border border-slate-300 rounded-md text-xs py-1.5 px-3 text-slate-700 focus:border-blue-500 outline-none shadow-sm"
          >
            <option value="">Seleccionar</option>
            {options.map((op: string) => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>
        ) : (
          value || <span className="text-slate-400 text-xs">—</span>
        )}
      </div>
    </div>
  );
}

function DarkRowBool({ label, value, edit, onChange }: any) {
  const val = value === true ? 'si' : value === false ? 'no' : value;

  const content = edit ? (
    <div className="flex gap-1">
      <button onClick={() => onChange('si')} className={classNames("px-3 py-1 text-[10px] rounded-md transition-all font-semibold", val === 'si' ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700")}>SÍ</button>
      <button onClick={() => onChange('no')} className={classNames("px-3 py-1 text-[10px] rounded-md transition-all font-semibold", val === 'no' ? "bg-red-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700")}>NO</button>
    </div>
  ) : (
    <span className={classNames("text-[10px] font-bold px-2 py-0.5 rounded border", val === 'si' ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/5" : val === 'no' ? "text-red-400 border-red-500/30 bg-red-500/5" : "text-slate-600 border-transparent")}>
      {val === 'si' ? "SÍ" : val === 'no' ? "NO" : "—"}
    </span>
  );

  if (!label) return content;

  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-200 last:border-0 hover:bg-white/40 px-3 -mx-3 rounded-lg transition-colors">
      <div className="text-xs font-medium text-slate-600 uppercase tracking-wide">{label}</div>
      <div>{content}</div>
    </div>
  );
}

function DarkRowDate({ label, value, edit, onChange, icon }: any) {
  // Helper to ensure YYYY-MM-DD format for the input
  const getInputValue = (val: string | null | undefined) => {
    if (!val) return "";
    // If it's already YYYY-MM-DD, return it
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    // Try to parse it
    const date = new Date(val);
    // basic check if valid date
    if (!isNaN(date.getTime())) {
      try {
        return date.toISOString().split('T')[0];
      } catch (e) {
        return "";
      }
    }
    return "";
  };

  const displayValue = (val: string | null | undefined) => {
    if (!val) return <span className="text-slate-400 text-xs">—</span>;

    // If matches YYYY-MM-DD
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
      const [y, m, d] = val.split('-');
      // Create date using local time constructor to avoid UTC shift
      const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      return date.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    // Fallback for other formats
    const date = new Date(val);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    return val;
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 border-b border-slate-200 last:border-0 gap-2 hover:bg-white/40 px-3 -mx-3 rounded-lg transition-colors">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-600 uppercase w-[160px] flex-shrink-0 tracking-wide mt-0.5">
        {icon && <span className="opacity-50">{icon}</span>}
        {label}
      </div>
      <div className="text-sm text-slate-700 font-light flex-1 sm:text-right break-words leading-relaxed relative">
        {edit ? (
          <div className="relative inline-block w-full sm:w-auto">
            <input
              type="date"
              value={getInputValue(value)}
              onChange={(e) => onChange(e.target.value)}
              className="w-full sm:w-auto text-sm text-left sm:text-right border-b border-blue-500/50 px-2 py-1 focus:border-blue-400 transition-colors bg-white/50 rounded-t-sm outline-none text-slate-700 font-medium appearance-none min-h-[30px] shadow-sm cursor-pointer"
            />
          </div>
        ) : (
          <span className="capitalize font-medium text-slate-800">{displayValue(value)}</span>
        )}
      </div>
    </div>
  );
}