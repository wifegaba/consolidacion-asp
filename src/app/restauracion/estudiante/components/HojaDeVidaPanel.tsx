'use client';

// --- 1. IMPORTACIONES ---
import React, { useState, useEffect, useRef } from 'react';
import {
  User, Edit2, SquarePen, Save, Trash2, Landmark, BookOpen,
  HeartPulse, ClipboardList, NotebookPen, IdCard, Phone, Mail,
  MapPin, Calendar, GraduationCap
} from 'lucide-react';
import { supabase } from '../../../../lib/supabaseClient';

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
}: {
  row: Entrevista;
  signedUrl: string | null;
  onUpdated: (r: Entrevista) => void;
  onDeleted: (id: string) => void;
  className?: string;
}) {
  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [form, setForm] = useState<Entrevista>(row);

  const [localSignedUrl, setLocalSignedUrl] = useState<string | null>(signedUrl);
  const inputFotoRef = useRef<HTMLInputElement>(null);

  useEffect(() => setLocalSignedUrl(signedUrl), [signedUrl]);
  useEffect(() => setForm(row), [row?.id]);

  // Helpers de estado
  function setF<K extends keyof Entrevista>(k: K, v: Entrevista[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  const onCE = (k: keyof Entrevista) => (e: React.FormEvent<HTMLSpanElement>) => {
    const t = (e.currentTarget.innerText || '').trim();
    setF(k, t as any);
  };
  const onBool = (k: keyof Entrevista) => (v: 'si' | 'no' | null) => {
    setF(k, v === 'si' ? true : v === 'no' ? false : null);
  };
  const onBoolString = (k: keyof Entrevista) => (v: 'si' | 'no' | null) => {
    setF(k, v);
  };

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
      setEdit(false);
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
          <div className="px-4 pt-4 pb-6 flex flex-col items-center text-center border-b border-white/20 relative">

            {/* Botones en modo responsive - Superior izquierda (solo iconos) */}
            <div className="absolute top-4 left-4 flex gap-2 md:hidden">
              <button onClick={handleUpdate} disabled={saving} className={classNames(
                "p-2 rounded-lg transition-all duration-300 border",
                edit
                  ? "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-700 border-emerald-500/50 shadow-lg"
                  : "bg-blue-600 hover:bg-blue-500 text-white border-transparent shadow-lg hover:shadow-xl"
              )}>
                {edit ? (saving ? <Save size={14} className="animate-pulse" /> : <Save size={14} />) : <SquarePen size={14} />}
              </button>
              <button onClick={handleDelete} className="p-2 rounded-lg bg-white/50 text-slate-600 hover:bg-red-500 hover:text-white border border-white/30 hover:border-red-500 hover:shadow-lg transition-all">
                <Trash2 size={14} />
              </button>
            </div>

            {/* Avatar Premium Refinado */}
            <div className="relative group mb-5">
              <div className={classNames(
                "w-28 h-28 rounded-full p-[3px] shadow-xl transition-all duration-500",
                "bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400",
                uploadingFoto && "animate-pulse"
              )}>
                <div className="w-full h-full rounded-full overflow-hidden bg-white relative border border-white/50">
                  <img src={localSignedUrl ?? PLACEHOLDER_SVG} alt="Avatar" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  {/* Overlay de edición */}
                  <div onClick={() => inputFotoRef.current?.click()} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-all duration-300 backdrop-blur-[1px]">
                    <Edit2 className="text-white drop-shadow-md" size={20} />
                  </div>
                </div>
              </div>
              <input ref={inputFotoRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleChangeFoto(e.target.files[0])} />
            </div>

            {/* Nombre & Título */}
            <div className="w-full mt-2 space-y-1">
              {edit ? (
                <CEField value={form.nombre} edit={true} onInput={onCE('nombre')} placeholder="Tu Nombre" className="text-2xl font-bold text-slate-800 block border-b border-indigo-500/50 text-center bg-transparent tracking-tight" />
              ) : (
                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-blue-600 tracking-tight">{form.nombre || 'Sin Nombre'}</h2>
              )}

              {edit ? (
                <CEField value={form.ocupacion} edit={true} onInput={onCE('ocupacion')} placeholder="Profesión" className="text-sm text-blue-700 block border-b border-blue-500/30 text-center bg-transparent font-medium" />
              ) : (
                <p className="text-sm text-blue-600 font-medium tracking-wide uppercase">{form.ocupacion || 'Sin Ocupación'}</p>
              )}
            </div>

            {/* Botones en modo desktop - Estilo minimalista */}
            <div className="hidden md:flex gap-3 mt-5 w-full justify-center">
              <button onClick={handleUpdate} disabled={saving} className={classNames(
                "flex items-center justify-center gap-2 px-6 py-2 rounded-full text-[11px] font-semibold uppercase tracking-wider transition-all duration-200",
                edit
                  ? "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-700 border border-emerald-500/40"
                  : "bg-white/60 hover:bg-white/80 text-slate-700 border border-white/40 hover:border-white/60"
              )}>
                {edit ? (saving ? "Guardando..." : <><Save size={14} /> Guardar</>) : <><SquarePen size={14} /> Editar</>}
              </button>
              <button onClick={handleDelete} className="p-2 rounded-full bg-white/40 text-slate-600 hover:text-red-600 hover:bg-red-500/20 transition-all" title="Eliminar">
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* Lista de Contacto */}
          <div className="hidden md:block px-4 py-4 overflow-y-auto custom-scrollbar">
            <div className="space-y-3">
              <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.25em] border-b border-slate-300 pb-1 mb-2">Contacto</h3>
              <ContactRow icon={<IdCard size={16} />} label="Cédula" value={form.cedula} edit={edit} onInput={onCE('cedula')} />
              <ContactRow icon={<Phone size={16} />} label="Teléfono" value={form.telefono} edit={edit} onInput={onCE('telefono')} color="text-cyan-400" />
              <ContactRow icon={<Mail size={16} />} label="Email" value={form.email} edit={edit} onInput={onCE('email')} color="text-blue-400" />
            </div>
          </div>
        </aside>

        {/* === PANEL DERECHO: INFORMACIÓN === */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 bg-transparent">
          {/* Mobile Contact - Scrolls with content */}
          <div className="md:hidden block mb-6 bg-white/40 backdrop-blur-xl p-5 rounded-2xl border border-white/20 shadow-sm">
            <div className="space-y-3">
              <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.25em] border-b border-slate-300 pb-1 mb-2">Contacto</h3>
              <ContactRow icon={<IdCard size={16} />} label="Cédula" value={form.cedula} edit={edit} onInput={onCE('cedula')} />
              <ContactRow icon={<Phone size={16} />} label="Teléfono" value={form.telefono} edit={edit} onInput={onCE('telefono')} color="text-cyan-400" />
              <ContactRow icon={<Mail size={16} />} label="Email" value={form.email} edit={edit} onInput={onCE('email')} color="text-blue-400" />
            </div>
          </div>

          <div className="max-w-6xl mx-auto space-y-10">

            {/* Header Sección */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-white/5">
              <div>
                <h1 className="text-2xl font-semibold text-slate-800 mb-1">Información Detallada</h1>
                <p className="text-sm text-slate-600 font-light">
                  Gestión integral del perfil académico y espiritual
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8">

              {/* === TARJETAS DE CRISTAL === */}

              <GlassSection title="Datos Demográficos" icon={<User size={20} />} color="indigo">
                <DarkRow label="Fecha Nacimiento" icon={<Calendar size={14} />} value={form.fecha_nac} edit={edit} onInput={onCE('fecha_nac')} />
                <DarkRow label="Lugar Nacimiento" icon={<MapPin size={14} />} value={form.lugar_nac} edit={edit} onInput={onCE('lugar_nac')} />
                <DarkRow label="Dirección" value={form.direccion} edit={edit} onInput={onCE('direccion')} />
                <DarkRowSelect label="Estado Civil" value={form.estado_civil} edit={edit} onChange={(v: any) => setF('estado_civil', v)} options={ESTADOS} />
                <DarkRowSelect label="Convivencia" value={form.convivencia} edit={edit} onChange={(v: any) => setF('convivencia', v)} options={CONVIVENCIA} />

                <DarkRow label="Escolaridad" icon={<GraduationCap size={14} />} value={form.escolaridad} edit={edit} onInput={onCE('escolaridad')} />
                <DarkRowBool label="Labora actualmente" value={form.labora_actualmente} edit={edit} onChange={onBoolString('labora_actualmente')} />
              </GlassSection>

              <GlassSection title="Vida Eclesiástica" icon={<Landmark size={20} />} color="cyan">
                <DarkRowBool label="¿Se congrega?" value={form.se_congrega} edit={edit} onChange={onBoolString('se_congrega')} />
                <DarkRowSelect label="Día servicio" value={form.dia_congrega} edit={edit} onChange={(v: any) => setF('dia_congrega', v)} options={DIAS} disabled={form.se_congrega !== 'si'} />

                <DarkRow label="Tiempo asistiendo" value={form.tiempo_iglesia} edit={edit} onInput={onCE('tiempo_iglesia')} />
                <DarkRow label="Invitado por" value={form.invito} edit={edit} onInput={onCE('invito')} />
                <DarkRow label="Pastor" value={form.pastor} edit={edit} onInput={onCE('pastor')} />
                <DarkRowBool label="De otra iglesia" value={form.viene_otra_iglesia} edit={edit} onChange={onBoolString('viene_otra_iglesia')} />
                {form.viene_otra_iglesia === 'si' && <DarkRow label="¿Cuál iglesia?" value={form.otra_iglesia_nombre} edit={edit} onInput={onCE('otra_iglesia_nombre')} />}
              </GlassSection>

              <GlassSection title="Vida Espiritual" icon={<BookOpen size={20} />} color="amber">
                <DarkRowBool label="Bautizo agua" value={form.bautizo_agua} edit={edit} onChange={onBoolString('bautizo_agua')} />
                <DarkRowBool label="Tiene Biblia" value={form.tiene_biblia} edit={edit} onChange={onBool('tiene_biblia')} />
                <DarkRowBool label="Ayuna" value={form.ayuna} edit={edit} onChange={onBoolString('ayuna')} />
                {form.ayuna === 'si' && <DarkRow label="Motivo Ayuno" value={form.motivo_ayuno} edit={edit} onInput={onCE('motivo_ayuno')} />}

                <DarkRowSelect label="Tiempo oración" value={form.tiempo_oracion} edit={edit} onChange={(v: any) => setF('tiempo_oracion', v)} options={TIEMPO_ORACION} />
                <DarkRowSelect label="Lectura Bíblica" value={form.frecuencia_lectura_biblia} edit={edit} onChange={(v: any) => setF('frecuencia_lectura_biblia', v)} options={LECTURA_BIBLIA} />
              </GlassSection>

              <GlassSection title="Salud y Bienestar" icon={<HeartPulse size={20} />} color="rose">
                <DarkRow label="Meta Personal" value={form.meta_personal} edit={edit} onInput={onCE('meta_personal')} />
                <DarkRow label="Enfermedad" value={form.enfermedad} edit={edit} onInput={onCE('enfermedad')} />
                <DarkRowBool label="Tratamiento clínico" value={form.tratamiento_clinico} edit={edit} onChange={onBoolString('tratamiento_clinico')} />
                {form.tratamiento_clinico === 'si' && <DarkRow label="Motivo trat." value={form.motivo_tratamiento} edit={edit} onInput={onCE('motivo_tratamiento')} />}
                <DarkRowBool label="Recibe consejería" value={form.recibe_consejeria} edit={edit} onChange={onBoolString('recibe_consejeria')} />
                {form.recibe_consejeria === 'si' && <DarkRow label="Motivo cons." value={form.motivo_consejeria} edit={edit} onInput={onCE('motivo_consejeria')} />}
              </GlassSection>

              {/* Ancho Completo */}
              <div>
                <GlassSection title="Evaluación Académica" icon={<ClipboardList size={20} />} color="violet">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2">
                    <div>
                      <DarkRowBool label="Participa activamente" value={form.interviene} edit={edit} onChange={onBool('interviene')} />
                      <DarkRow label="Maestro Encargado" value={form.maestro_encargado} edit={edit} onInput={onCE('maestro_encargado')} />
                      <DarkRow label="Retiros Asistidos" value={form.retiros_asistidos} edit={edit} onInput={onCE('retiros_asistidos')} />
                    </div>
                    <div>
                      <DarkRow label="Cambios físicos" value={form.cambios_fisicos} edit={edit} onInput={onCE('cambios_fisicos')} />
                      <DarkRow label="Desempeño general" value={form.desempeno_clase} edit={edit} onInput={onCE('desempeno_clase')} />
                    </div>
                  </div>
                </GlassSection>
              </div>

              <div className="pb-12">
                <GlassSection title="Notas y Observaciones" icon={<NotebookPen size={20} />} color="teal">
                  <div className={classNames(
                    "w-full p-5 rounded-xl text-sm leading-relaxed transition-all",
                    edit
                      ? "bg-white/60 border border-slate-300 text-slate-700 min-h-[100px] shadow-inner"
                      : "bg-transparent text-slate-600 italic"
                  )}>
                    {edit ? <CEField value={form.notas} edit={true} onInput={onCE('notas')} className="w-full block h-full" /> : (form.notas || "Sin observaciones registradas.")}
                  </div>
                </GlassSection>
              </div>

            </div>
          </div>
        </main>
      </div>
    </div >
  );
}

// ============================================================================
//  COMPONENTES LOCALES CON ESTILO "GLASS" REFINADO
// ============================================================================

function ContactRow({ icon, label, value, edit, onInput, color = "text-slate-400" }: any) {
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
          {edit ? <CEField value={value} edit={true} onInput={onInput} className="border-b border-slate-600 block w-full bg-transparent" /> : (value || '—')}
        </div>
      </div>
    </div>
  );
}

function GlassSection({ title, icon, color, children }: any) {
  // Mapeo de colores más sutil
  const themeColors: any = {
    indigo: { text: "text-indigo-400", border: "group-hover:border-indigo-500/30" },
    cyan: { text: "text-cyan-400", border: "group-hover:border-cyan-500/30" },
    amber: { text: "text-amber-400", border: "group-hover:border-amber-500/30" },
    rose: { text: "text-rose-400", border: "group-hover:border-rose-500/30" },
    violet: { text: "text-violet-400", border: "group-hover:border-violet-500/30" },
    teal: { text: "text-teal-400", border: "group-hover:border-teal-500/30" },
  };

  const th = themeColors[color] || themeColors.indigo;

  return (
    <div className={classNames(
      "relative group overflow-hidden rounded-xl border border-white/30 bg-white/50 backdrop-blur-md transition-all duration-300 shadow-lg",
      th.border
    )}>
      <div className="px-6 py-4 border-b border-white/30 flex items-center gap-3 bg-white/20">
        <div className={classNames("text-slate-400", th.text)}>
          {icon}
        </div>
        <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{title}</h4>
      </div>
      <div className="p-6 space-y-1">{children}</div>
    </div>
  );
}

function DarkRow({ label, value, edit, onInput, icon }: any) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between py-3 border-b border-slate-200 last:border-0 gap-2 hover:bg-white/40 px-3 -mx-3 rounded-lg transition-colors">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-600 uppercase w-[160px] flex-shrink-0 tracking-wide mt-0.5">
        {icon && <span className="opacity-50">{icon}</span>}
        {label}
      </div>
      <div className="text-sm text-slate-700 font-light flex-1 sm:text-right break-words leading-relaxed">
        {edit ? (
          <CEField value={value} edit={true} onInput={onInput} className="inline-block min-w-[50px] text-left sm:text-right border-b border-blue-500/50 px-1 focus:border-blue-400 transition-colors" />
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