'use client';

// --- 1. IMPORTACIONES ---
import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Edit2,
  SquarePen,
  Check,
  Trash2,
  Landmark,
  BookOpen,
  HeartPulse,
  ClipboardList,
  NotebookPen,
  IdCard,
  Phone,
} from 'lucide-react';
import { supabase } from '../../../../lib/supabaseClient'; // Ajusta la ruta a tu supabaseClient

// --- IMPORTAR DESDE NUESTRO ARCHIVO DE UTILS ---
import {
  Entrevista,
  classNames,
  formatDateTime,
  extFromMime,
  bustUrl,
  PLACEHOLDER_SVG,
  downscaleImage,
  toWhiteBackground,
  DIAS,
  ESTADOS,
  TIEMPO_ORACION,
  LECTURA_BIBLIA,
  CONVIVENCIA,
  CEField,
  EditableRow,
  EditableRowSelect,
  EditableRowBool,
  EditableRowBool_SNNS,
} from './academia.utils';

// --- 2. EL COMPONENTE 'HojaDeVidaPanel' ---
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
  useEffect(() => setLocalSignedUrl(signedUrl), [signedUrl]);

  const inputFotoRef = useRef<HTMLInputElement>(null);
  const tempObjUrlRef = useRef<string | null>(null);

  useEffect(() => setForm(row), [row?.id]);

  function setF<K extends keyof Entrevista>(k: K, v: Entrevista[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const onCE =
    (k: keyof Entrevista) => (e: React.FormEvent<HTMLSpanElement>) => {
      const t = (e.currentTarget.innerText || '').trim();
      setF(k, t as any);
    };

  const onBool =
    (k: keyof Entrevista) => (v: 'si' | 'no' | null) => {
      setF(k, v === 'si' ? true : v === 'no' ? false : null);
    };

  const onBoolString =
    (k: keyof Entrevista) => (v: 'si' | 'no' | null) => {
      setF(k, v);
    };

  const onBoolSNNS =
    (k: keyof Entrevista) => (v: 'si' | 'no' | 'no_sabe' | null) => {
      setF(k, v);
    };

  async function handleUpdate() {
    if (!edit) {
      setEdit(true);
      return;
    }

    try {
      setSaving(true);
      const payload = {
        nombre: form.nombre ?? null,
        cedula: form.cedula ?? null,
        email: form.email ?? null,
        telefono: form.telefono ?? null,
        fecha_nac: form.fecha_nac ?? null,
        lugar_nac: form.lugar_nac ?? null,
        direccion: form.direccion ?? null,
        escolaridad: form.escolaridad ?? null,
        ocupacion: form.ocupacion ?? null,
        estado_civil: form.estado_civil ?? null,
        se_congrega: form.se_congrega ?? null,
        dia_congrega: form.se_congrega === 'si' ? form.dia_congrega : null,
        tiempo_iglesia: form.tiempo_iglesia ?? null,
        invito: form.invito ?? null,
        pastor: form.pastor ?? null,
        // ELIMINADO: nacimiento_espiritu
        bautizo_agua: form.bautizo_agua ?? null,
        // ELIMINADO: bautismo_espiritu
        tiene_biblia: form.tiene_biblia ?? null,
        ayuna: form.ayuna ?? null,
        // ELIMINADO: aspecto_feliz
        // ELIMINADO: muy_interesado
        interviene: form.interviene ?? null,
        cambios_fisicos: form.cambios_fisicos ?? null,
        notas: form.notas ?? null,
        promovido: form.promovido ?? null,
        foto_path: form.foto_path ?? null,
        updated_at: new Date().toISOString(),
        labora_actualmente: form.labora_actualmente ?? null,
        viene_otra_iglesia: form.viene_otra_iglesia ?? null,
        otra_iglesia_nombre:
          form.viene_otra_iglesia === 'si' ? form.otra_iglesia_nombre : null,
        tiempo_oracion: form.tiempo_oracion ?? null,
        frecuencia_lectura_biblia: form.frecuencia_lectura_biblia ?? null,
        motivo_ayuno: form.ayuna === 'si' ? form.motivo_ayuno : null,
        meta_personal: form.meta_personal ?? null,
        enfermedad: form.enfermedad ?? null,
        tratamiento_clinico: form.tratamiento_clinico ?? null,
        motivo_tratamiento:
          form.tratamiento_clinico === 'si' ? form.motivo_tratamiento : null,
        retiros_asistidos: form.retiros_asistidos ?? null,
        convivencia: form.convivencia ?? null,
        recibe_consejeria: form.recibe_consejeria ?? null,
        motivo_consejeria:
          form.recibe_consejeria === 'si' ? form.motivo_consejeria : null,
        // ELIMINADO: cambios_emocionales
        desempeno_clase: form.desempeno_clase ?? null,
        maestro_encargado: form.maestro_encargado ?? null,
      };

      const { data, error } = await supabase
        .from('entrevistas')
        .update(payload)
        .eq('id', form.id)
        .select('*')
        .single();

      if (error) throw error;
      onUpdated(data as Entrevista);
      setEdit(false);
    } catch (e: any) {
      alert(e?.message ?? 'Error actualizando');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar definitivamente esta entrevista?')) return;
    try {
      setSaving(true);
      if (form.foto_path) {
        await supabase.storage
          .from('entrevistas-fotos')
          .remove([form.foto_path]);
      }
      const { error } = await supabase
        .from('entrevistas')
        .delete()
        .eq('id', form.id);
      if (error) throw error;
      onDeleted(form.id);
    } catch (e: any) {
      alert(e?.message ?? 'Error eliminando');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangeFoto(file: File) {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 12 * 1024 * 1024) return;

    setUploadingFoto(true);
    let whiteFile;
    try {
      whiteFile = await toWhiteBackground(file);
    } catch (e) {
      console.warn('Background removal falló, uso original:', e);
      whiteFile = file;
    }

    const compact = await downscaleImage(file, 720, 0.82);

    const tempUrl = URL.createObjectURL(compact);
    tempObjUrlRef.current = tempUrl;
    setLocalSignedUrl(tempUrl);
    onUpdated({ ...form, _tempPreview: tempUrl });

    const oldPath = form.foto_path || undefined;
    const path = `fotos/${row.id}-${Date.now()}${extFromMime(compact.type)}`;

    try {
      const up = await supabase.storage
        .from('entrevistas-fotos')
        .upload(path, compact, {
          cacheControl: '0',
          upsert: true,
          contentType: compact.type || 'image/webp',
        });
      if (up.error) throw up.error;

      const { data: updated, error: upErr } = await supabase
        .from('entrevistas')
        .update({ foto_path: path, updated_at: new Date().toISOString() })
        .eq('id', row.id)
        .select('*')
        .single();
      if (upErr) throw upErr;

      const signed = await supabase.storage
        .from('entrevistas-fotos')
        .createSignedUrl(path, 60 * 10);
      if (signed.error) throw signed.error;

      const signedBusted = bustUrl(signed.data?.signedUrl) ?? null;

      if (oldPath) {
        await supabase.storage.from('entrevistas-fotos').remove([oldPath]);
      }

      setF('foto_path', path);
      setLocalSignedUrl(signedBusted);
      onUpdated({ ...(updated as Entrevista), _tempPreview: null });
    } catch (e: any) {
      onUpdated({ ...row, _tempPreview: null });
      alert(e?.message ?? 'No se pudo subir la foto');
    } finally {
      setUploadingFoto(false);
      if (tempObjUrlRef.current) {
        URL.revokeObjectURL(tempObjUrlRef.current);
        tempObjUrlRef.current = null;
      }
    }
  }

  const btnUpdateClass = edit
    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/40 hover:bg-blue-700 active:scale-[.98]'
    : 'bg-white text-gray-800 border border-gray-300/80 shadow-sm hover:bg-gray-100 active:scale-[.98]';

  return (
    // --- NUEVO ESTILO: Contenedor principal del panel con fondo azul fresco ---
    <div
      className={classNames(
        'flex-1 min-h-0 flex flex-col bg-sky-50 mt-[1cm]', 
        'rounded-2xl mx-4 sm:mx-6 md:mx-[1cm] overflow-hidden', 
        className || ''
      )}
    >
      {/* --- ESTILO: Header "Glass" pegajoso (sin cambios) --- */}
      <header
        className={classNames(
          'px-6 pt-7 pb-4 flex-shrink-0',
          'sticky top-0 z-10',
          'bg-white/70 backdrop-blur-xl',
          'border-b border-black/5'
        )}
      >
        <div className="flex items-start gap-6">
          <div className="relative w-32 h-32 rounded-full shadow-xl shadow-black/10 ring-4 ring-white/90 overflow-hidden">
            {/* --- NUEVO ESTILO: Círculo de foto premium --- */}
            <img
              src={localSignedUrl ?? PLACEHOLDER_SVG}
              alt={form.nombre ?? 'avatar'}
              className={classNames(
                'object-cover w-full h-full',      
                uploadingFoto ? 'opacity-60' : 'opacity-100',
                'cursor-pointer'
              )}
              onClick={() => inputFotoRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  inputFotoRef.current?.click();
                }
              }}
              role="button"
              aria-label="Cambiar foto"
              title="Cambiar foto"
            />
            {uploadingFoto && (
              <div className="absolute inset-0 grid place-items-center rounded-full bg-black/30 text-white text-[10px]">
                Subiendo…
              </div>
            )}
            <input
              ref={inputFotoRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleChangeFoto(f);
                e.currentTarget.value = '';
              }}
            />
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <h3 className="text-xl font-semibold text-zinc-900">
                {edit ? (
                  <CEField
                    value={form.nombre}
                    edit={edit}
                    onInput={onCE('nombre')}
                    placeholder="Nombre completo"
                    className="text-xl font-semibold"
                  />
                ) : (
                  form.nombre ?? 'Consulta de entrevista'
                )}
              </h3>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="flex items-center justify-center h-9 w-9 rounded-full transition-all disabled:opacity-60 active:scale-[.98] bg-red-500 text-white shadow-lg shadow-red-500/30 hover:bg-red-600"
                  title="Eliminar"
                >
                  <Trash2 size={16} />
                </button>

                <button
                  onClick={handleUpdate}
                  disabled={saving}
                  className={classNames(
                    'flex items-center justify-center h-9 w-9 rounded-full transition-all disabled:opacity-60',
                    btnUpdateClass
                  )}
                  title={edit ? 'Guardar cambios' : 'Editar'}
                >
                  {edit ? (
                    saving ? (
                      <span className="text-xs">...</span>
                    ) : (
                      <Check size={18} />
                    )
                  ) : (
                    <SquarePen size={16} />
                  )}
                </button>
              </div>
            </div>
            {/* ESTILO: "Pills" */}
            <div className="mt-2 flex items-center gap-4 text-sm text-zinc-700 flex-wrap">
              <span className="flex items-center gap-1">
                {edit ? (
                  <>
                    <IdCard size={18} className="text-blue-700" />
                    <CEField
                      value={form.cedula}
                      edit={edit}
                      onInput={onCE('cedula')}
                      placeholder="Cédula"
                    />
                  </>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-gray-200/80 text-gray-800 font-medium">
                    <IdCard size={14} className="mr-1.5" />{' '}
                    {form.cedula || 'N/A'}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-1">
                {edit ? (
                  <>
                    <Phone size={18} className="text-blue-700" />
                    <CEField
                      value={form.telefono}
                      edit={edit}
                      onInput={onCE('telefono')}
                      placeholder="Teléfono"
                    />
                  </>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-gray-200/80 text-gray-800 font-medium">
                    <Phone size={14} className="mr-1.5" />{' '}
                    {form.telefono || 'N/A'}
                  </span>
                )}
              </span>
              {form.estado_civil && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-gray-200/80 text-gray-800 font-medium">
                  {form.estado_civil}
                </span>
              )}
              <span
                className={classNames(
                  'inline-flex items-center px-2.5 py-0.5 rounded-full font-medium',
                  form.promovido === 'si'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-amber-100 text-amber-800'
                )}
              >
                Promovido: {form.promovido || 'No'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* --- ESTILO: Contenedor del body con scroll --- */}
      {/* CAMBIO AQUÍ: Se ajustó el padding: px-0 en mobile, sm:px-6 en desktop */}
      <div className="flex-1 min-h-0 overflow-y-auto px-0 py-4 sm:px-6 sm:py-6">
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* --- 1. INFORMACIÓN PERSONAL --- */}
          <section className="rounded-2xl shadow-xl shadow-black/5 border border-white/50 bg-white/60 backdrop-blur-lg overflow-hidden">
            <div className="flex items-center justify-between bg-white/70 backdrop-blur-sm p-4 border-b border-black/10">
              <div className="flex items-center gap-2.5">
                <User size={16} className="text-blue-600" />
                <h4 className="text-base font-semibold text-zinc-900">
                  Información personal
                </h4>
              </div>
              {edit && <Edit2 size={14} className="text-blue-400/80" />}
            </div>
            <div className="p-4">
              <EditableRow
                label="Email"
                value={form.email}
                edit={edit}
                onInput={onCE('email')}
              />
              <EditableRow
                label="Fecha de nacimiento"
                value={form.fecha_nac ?? ''}
                edit={edit}
                onInput={onCE('fecha_nac')}
              />
              <EditableRow
                label="Lugar de nacimiento"
                value={form.lugar_nac}
                edit={edit}
                onInput={onCE('lugar_nac')}
              />
              <EditableRow
                label="Dirección"
                value={form.direccion}
                edit={edit}
                onInput={onCE('direccion')}
              />
              <EditableRow
                label="Escolaridad"
                value={form.escolaridad}
                edit={edit}
                onInput={onCE('escolaridad')}
              />
              <EditableRow
                label="Ocupación"
                value={form.ocupacion}
                edit={edit}
                onInput={onCE('ocupacion')}
              />
              <EditableRowSelect
                label="Estado Civil"
                value={form.estado_civil}
                edit={edit}
                onChange={(v) => setF('estado_civil', v as any)}
                options={ESTADOS}
              />
              <EditableRowBool
                label="Labora actualmente"
                value={form.labora_actualmente}
                edit={edit}
                onChange={onBoolString('labora_actualmente')}
              />
            </div>
          </section>

          {/* --- 2. INFORMACIÓN CONGREGACIONAL --- */}
          <section className="rounded-2xl shadow-xl shadow-black/5 border border-white/50 bg-white/60 backdrop-blur-lg overflow-hidden">
            <div className="flex items-center justify-between bg-white/70 backdrop-blur-sm p-4 border-b border-black/10">
              <div className="flex items-center gap-2.5">
                <Landmark size={16} className="text-blue-600" />
                <h4 className="text-base font-semibold text-zinc-900">
                  Informacion Congregacional
                </h4>
              </div>
              {edit && <Edit2 size={14} className="text-blue-400/80" />}
            </div>
            <div className="p-4">
              <EditableRowBool
                label="Se congrega"
                value={form.se_congrega}
                edit={edit}
                onChange={onBoolString('se_congrega')}
              />
              <EditableRowSelect
                label="Día congrega"
                value={form.dia_congrega}
                edit={edit}
                onChange={(v) => setF('dia_congrega', v as any)}
                options={DIAS}
                disabled={form.se_congrega !== 'si'}
              />
              <EditableRow
                label="Tiempo en la iglesia"
                value={form.tiempo_iglesia}
                edit={edit}
                onInput={onCE('tiempo_iglesia')}
              />
              <EditableRow
                label="Invitó"
                value={form.invito}
                edit={edit}
                onInput={onCE('invito')}
              />
              <EditableRow
                label="Pastor"
                value={form.pastor}
                edit={edit}
                onInput={onCE('pastor')}
              />
              <EditableRowBool
                label="Viene de otra iglesia"
                value={form.viene_otra_iglesia}
                edit={edit}
                onChange={onBoolString('viene_otra_iglesia')}
              />
              <EditableRow
                label="Nombre otra iglesia"
                value={form.otra_iglesia_nombre}
                edit={edit}
                onInput={onCE('otra_iglesia_nombre')}
              />
              <EditableRowSelect
                label="Convivencia"
                value={form.convivencia}
                edit={edit}
                onChange={(v) => setF('convivencia', v as any)}
                options={CONVIVENCIA}
              />
            </div>
          </section>

          {/* --- 3. DATOS ESPIRITUALES (Modificado) --- */}
          <section className="rounded-2xl shadow-xl shadow-black/5 border border-white/50 bg-white/60 backdrop-blur-lg overflow-hidden">
            <div className="flex items-center justify-between bg-white/70 backdrop-blur-sm p-4 border-b border-black/10">
              <div className="flex items-center gap-2.5">
                <BookOpen size={16} className="text-blue-600" />
                <h4 className="text-base font-semibold text-zinc-900">
                  Datos espirituales
                </h4>
              </div>
              {edit && <Edit2 size={14} className="text-blue-400/80" />}
            </div>
            <div className="p-4">
              {/* ELIMINADO: Nacimiento del Espíritu */}
              <EditableRowBool
                label="Bautizo en agua"
                value={form.bautizo_agua}
                edit={edit}
                onChange={onBoolString('bautizo_agua')}
              />
              {/* ELIMINADO: Bautismo del Espíritu */}
              <EditableRowBool
                label="Tiene Biblia"
                value={form.tiene_biblia}
                edit={edit}
                onChange={onBool('tiene_biblia')}
              />
              <EditableRowBool
                label="Ayuna"
                value={form.ayuna}
                edit={edit}
                onChange={onBoolString('ayuna')}
              />
              <EditableRow
                label="Motivo Ayuno"
                value={form.motivo_ayuno}
                edit={edit}
                onInput={onCE('motivo_ayuno')}
              />
              <EditableRowSelect
                label="Tiempo de oración"
                value={form.tiempo_oracion}
                edit={edit}
                onChange={(v) => setF('tiempo_oracion', v)}
                options={TIEMPO_ORACION}
              />
              <EditableRowSelect
                label="Lectura Bíblica"
                value={form.frecuencia_lectura_biblia}
                edit={edit}
                onChange={(v) => setF('frecuencia_lectura_biblia', v)}
                options={LECTURA_BIBLIA}
              />
            </div>
          </section>

          {/* --- 4. SALUD Y CONSEJERÍA --- */}
          <section className="rounded-2xl shadow-xl shadow-black/5 border border-white/50 bg-white/60 backdrop-blur-lg overflow-hidden">
            <div className="flex items-center justify-between bg-white/70 backdrop-blur-sm p-4 border-b border-black/10">
              <div className="flex items-center gap-2.5">
                <HeartPulse size={16} className="text-blue-600" />
                <h4 className="text-base font-semibold text-zinc-900">
                  Salud y Consejería
                </h4>
              </div>
              {edit && <Edit2 size={14} className="text-blue-400/80" />}
            </div>
            <div className="p-4">
              <EditableRow
                label="Meta Personal"
                value={form.meta_personal}
                edit={edit}
                onInput={onCE('meta_personal')}
              />
              <EditableRow
                label="Retiros Asistidos"
                value={form.retiros_asistidos}
                edit={edit}
                onInput={onCE('retiros_asistidos')}
              />
              <EditableRow
                label="Enfermedad"
                value={form.enfermedad}
                edit={edit}
                onInput={onCE('enfermedad')}
              />
              <EditableRowBool
                label="Tratamiento clínico"
                value={form.tratamiento_clinico}
                edit={edit}
                onChange={onBoolString('tratamiento_clinico')}
              />
              <EditableRow
                label="Motivo tratamiento"
                value={form.motivo_tratamiento}
                edit={edit}
                onInput={onCE('motivo_tratamiento')}
              />
              <EditableRowBool
                label="Recibe consejería"
                value={form.recibe_consejeria}
                edit={edit}
                onChange={onBoolString('recibe_consejeria')}
              />
              <EditableRow
                label="Motivo consejería"
                value={form.motivo_consejeria}
                edit={edit}
                onInput={onCE('motivo_consejeria')}
              />
            </div>
          </section>

          {/* --- 5. EVALUACIÓN Y OBSERVACIONES (Modificado) --- */}
          <section className="rounded-2xl shadow-xl shadow-black/5 border border-white/50 bg-white/60 backdrop-blur-lg overflow-hidden">
            <div className="flex items-center justify-between bg-white/70 backdrop-blur-sm p-4 border-b border-black/10">
              <div className="flex items-center gap-2.5">
                <ClipboardList size={16} className="text-blue-600" />
                <h4 className="text-base font-semibold text-zinc-900">
                  Evaluación y observaciones
                </h4>
              </div>
              {edit && <Edit2 size={14} className="text-blue-400/80" />}
            </div>
            <div className="p-4">
              {/* ELIMINADO: Aspecto feliz */}
              {/* ELIMINADO: Muy interesado */}
              <EditableRowBool
                label="Interviene"
                value={form.interviene}
                edit={edit}
                onChange={onBool('interviene')}
              />
              <EditableRow
                label="Cambios físicos"
                value={form.cambios_fisicos}
                edit={edit}
                onInput={onCE('cambios_fisicos')}
              />
              {/* ELIMINADO: Cambios emocionales */}
              <EditableRow
                label="Desempeño en clase"
                value={form.desempeno_clase}
                edit={edit}
                onInput={onCE('desempeno_clase')}
              />
              <EditableRow
                label="Maestro encargado"
                value={form.maestro_encargado}
                edit={edit}
                onInput={onCE('maestro_encargado')}
              />
              <EditableRowBool
                label="Promovido"
                value={form.promovido}
                edit={edit}
                onChange={onBoolString('promovido')}
              />
            </div>
          </section>

          {/* --- 6. NOTAS ADICIONALES --- */}
          <section className="rounded-2xl shadow-xl shadow-black/5 border border-white/50 bg-white/60 backdrop-blur-lg overflow-hidden">
            <div className="flex items-center justify-between bg-white/70 backdrop-blur-sm p-4 border-b border-black/10">
              <div className="flex items-center gap-2.5">
                <NotebookPen size={16} className="text-blue-600" />
                <h4 className="text-base font-semibold text-zinc-900">
                  Notas Adicionales
                </h4>
              </div>
              {edit && <Edit2 size={14} className="text-blue-400/80" />}
            </div>
            <div className="p-4">
              <EditableRow
                label="Notas del maestro"
                value={form.notas}
                edit={edit}
                onInput={onCE('notas')}
              />
            </div>
          </section>
        </div>

        <div className="mt-8 text-center text-xs text-zinc-500">
          Creada: {formatDateTime(row.created_at)}
        </div>
      </div>
    </div>
  );
}