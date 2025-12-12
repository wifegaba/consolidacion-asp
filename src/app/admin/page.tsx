/*
  ARCHIVO: app/admin/page.tsx
  ESTADO: FINAL - FULL RESPONSIVE FIX
  DESCRIPCIÓN: 
  - Menú móvil siempre visible (sticky bottom).
  - Listas con scroll independiente en móvil y desktop.
  - TypeScript Strict Mode Compliant.
*/
'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import {
  Users, UserPlus, Server, Search, Plus, X, Loader2, Check,
  Edit2, Trash2, BookOpen, MessageSquarePlus, type LucideIcon,
  ChevronDown, AlertTriangle, ClipboardList, UserX, UserCheck2, Settings
} from 'lucide-react';
import GestionServidores from './components/GestionServidores';

// --- CONSTANTES DE ESTILO ---
const GLASS_STYLES = {
  // En móvil (rounded-none, border-0) para que parezca app nativa, en desktop (rounded-3xl)
  container: "bg-white/25 backdrop-blur-xl md:border md:border-white/40 md:shadow-2xl",
  panel: "bg-white/30 backdrop-blur-xl border border-white/50 shadow-sm",
  input: "bg-white/40 backdrop-blur-sm border border-white/50 text-gray-900 placeholder-gray-600 focus:bg-white/60 focus:ring-2 focus:ring-blue-500 focus:border-transparent",
  buttonSecondary: "bg-white/40 border border-white/50 text-gray-800 hover:bg-white/60 transition-colors",
  headerGradient: "bg-gradient-to-br from-indigo-50/40 via-white/60 to-white/40 backdrop-blur-md border-b border-white/50",
  listItem: "hover:bg-white/30 transition-colors border-b border-white/30 last:border-0"
};

// --- TIPOS DE DATOS ---
type Observacion = { id: string; observacion: string; created_at: string; creador: { nombre: string; } | null; };
type Maestro = { id: string; nombre: string; cedula: string; telefono: string | null; email: string | null; activo: boolean; };
type Curso = { id: number; nombre: string; color: string; orden?: number };
type AsignacionMaestro = { id: string; servidor_id: string; curso_id: number; cursos: Pick<Curso, 'nombre' | 'color'> | null; };
type MaestroDataRaw = Maestro & { asignaciones: AsignacionMaestro[]; observaciones_count: { count: number }[]; servidores_roles: { rol: string }[]; };
type MaestroConCursos = Maestro & { asignaciones: AsignacionMaestro[]; obs_count: number; rol: string | null; };
type Estudiante = { id: string; nombre: string; cedula: string; };
type Inscripcion = { entrevista_id: string; curso_id: number; servidor_id: string | null; cursos?: Pick<Curso, 'nombre' | 'color'> | null; };
type EstudianteInscrito = Estudiante & { maestro: MaestroConCursos | null; curso: Curso | null; inscripcion_id: string | null; };
type AdminTab = 'matricular' | 'maestros' | 'servidores' | 'consultar';

// --- VARIANTES DE ANIMACIÓN ---
const fadeTransition: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: "easeOut" } },
  exit: { opacity: 0, x: 20, transition: { duration: 0.2 } }
};

const modalVariants: Variants = {
  hidden: { scale: 0.95, opacity: 0 },
  visible: { scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 30 } },
  exit: { scale: 0.95, opacity: 0 },
};

// --- COMPONENTE PRINCIPAL ---
export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('maestros');
  const [maestros, setMaestros] = useState<MaestroConCursos[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modales
  const [modalMaestro, setModalMaestro] = useState<MaestroConCursos | 'new' | null>(null);
  const [modalAsignar, setModalAsignar] = useState<MaestroConCursos | null>(null);
  const [modalObservacion, setModalObservacion] = useState<MaestroConCursos | null>(null);
  const [modalDesactivar, setModalDesactivar] = useState<MaestroConCursos | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [{ data: mData }, { data: cData }, { data: eData }, { data: iData }] = await Promise.all([
        supabase.from('servidores').select(`id, nombre, cedula, telefono, email, activo, asignaciones:asignaciones_academia (id, servidor_id, curso_id, cursos ( nombre, color )), observaciones_count:servidores_observaciones!servidor_id(count), servidores_roles ( rol )`).order('nombre', { ascending: true }),
        supabase.from('cursos').select('id, nombre, color, orden').order('orden', { ascending: true }),
        supabase.from('entrevistas').select('id, nombre, cedula').order('nombre', { ascending: true }),
        supabase.from('inscripciones').select('entrevista_id, curso_id, servidor_id').eq('estado', 'activo')
      ]);

      const processedMaestros = (mData as unknown as MaestroDataRaw[] || []).map(m => ({
        ...m,
        obs_count: m.observaciones_count.length > 0 ? m.observaciones_count[0].count : 0,
        rol: m.servidores_roles.length > 0 ? m.servidores_roles[0].rol : null,
      }));

      setMaestros(processedMaestros);
      setCursos((cData as Curso[]) || []);
      setEstudiantes((eData as Estudiante[]) || []);
      setInscripciones((iData as Inscripcion[]) || []);
    } catch (err) { console.error(err); } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { if (activeTab !== 'servidores') loadData(); }, [loadData, activeTab]);
  const onDataUpdated = () => loadData();

  const estudiantesPendientesCount = useMemo(() => {
    const inscritosSet = new Set(inscripciones.map(i => i.entrevista_id));
    return estudiantes.filter(e => !inscritosSet.has(e.id)).length;
  }, [estudiantes, inscripciones]);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-slate-100 text-gray-900 font-sans">
      {/* FONDO ESTATICO */}
      <div className="absolute inset-0 z-0 bg-[url('/fondo-admin-v2.jpg')] bg-cover bg-center" />

      {/* WRAPPER PRINCIPAL */}
      {/* FIX: En móvil usamos padding-0 y h-full para ocupar toda la pantalla */}
      <div className="relative z-10 h-full w-full flex items-center justify-center p-0 md:p-6">

        {/* TARJETA PRINCIPAL */}
        {/* FIX: En móvil es h-full y rounded-none. En desktop es h-[92vh] (ampliado) y rounded-3xl */}
        <div className={`w-full max-w-[1500px] h-full md:h-[92vh] flex flex-col md:flex-row md:rounded-3xl overflow-hidden ${GLASS_STYLES.container}`}>

          {/* SIDEBAR (Desktop) */}
          <aside className="hidden md:flex w-64 flex-col border-r border-white/40 bg-white/20 p-4">
            <nav className="flex flex-col gap-2 flex-1">

              <TabButton Icon={Users} label="Maestros" isActive={activeTab === 'maestros'} onClick={() => setActiveTab('maestros')} />
              <TabButton Icon={UserPlus} label="Matricular" isActive={activeTab === 'matricular'} onClick={() => setActiveTab('matricular')} badge={estudiantesPendientesCount} />
              <TabButton Icon={ClipboardList} label="Consultar" isActive={activeTab === 'consultar'} onClick={() => setActiveTab('consultar')} />
            </nav>
            <div className="mt-auto border-t border-white/30 pt-4 px-2">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">AD</div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-indigo-900">Administrador</span>
                  <span className="text-[10px] text-indigo-700/70">En línea</span>
                </div>
              </div>
            </div>
          </aside>

          {/* CONTENIDO PRINCIPAL */}
          <main className="flex-1 relative flex flex-col min-w-0 bg-transparent h-full">
            {/* Header Móvil */}
            {/* Removido: Título 'Academia' */}

            {/* Area de Contenido con Scroll */}
            <div className="flex-1 overflow-y-auto p-2 md:p-8 scroll-smooth">
              <AnimatePresence mode="wait">
                <motion.div key={activeTab} variants={fadeTransition} initial="hidden" animate="visible" exit="exit" className="h-full flex flex-col">

                  {activeTab === 'matricular' && <PanelMatricular maestros={maestros} cursos={cursos} estudiantes={estudiantes} inscripciones={inscripciones} onMatriculaExitosa={onDataUpdated} loading={isLoading} />}
                  {activeTab === 'maestros' && <PanelGestionarMaestros maestros={maestros.filter(m => m.rol === 'Maestro Ptm')} loading={isLoading} onCrear={() => setModalMaestro('new')} onEditar={(m) => setModalMaestro(m)} onAsignar={(m) => setModalAsignar(m)} onObs={(m) => setModalObservacion(m)} onDesactivar={(m) => setModalDesactivar(m)} />}
                  {activeTab === 'consultar' && <PanelConsultarEstudiantes maestros={maestros} cursos={cursos} estudiantes={estudiantes} inscripciones={inscripciones} loading={isLoading} />}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Barra de Navegación Móvil (Sticky Bottom) */}
            <div className="md:hidden border-t border-white/40 bg-white/40 backdrop-blur-xl flex justify-around p-2 pb-safe shrink-0 z-30">

              <MobileTab Icon={Users} label="Maestros" isActive={activeTab === 'maestros'} onClick={() => setActiveTab('maestros')} />
              <MobileTab Icon={UserPlus} label="Matricular" isActive={activeTab === 'matricular'} onClick={() => setActiveTab('matricular')} badge={estudiantesPendientesCount} />
              <MobileTab Icon={ClipboardList} label="Consultar" isActive={activeTab === 'consultar'} onClick={() => setActiveTab('consultar')} />
            </div>
          </main>
        </div>
      </div>

      {/* MODALES */}
      <AnimatePresence>
        {(modalMaestro === 'new' || (typeof modalMaestro === 'object' && modalMaestro !== null)) && (
          <ModalCrearEditarMaestro key="modal-maestro" maestroInicial={modalMaestro === 'new' ? null : modalMaestro} onClose={() => setModalMaestro(null)} onSuccess={() => { setModalMaestro(null); onDataUpdated(); }} />
        )}
        {modalAsignar && (
          <ModalAsignarCursos key="modal-asignar" maestro={modalAsignar} cursosDisponibles={cursos} onClose={() => setModalAsignar(null)} onSuccess={() => { setModalAsignar(null); onDataUpdated(); }} />
        )}
        {modalObservacion && (
          <ModalObservaciones key="modal-obs" maestro={modalObservacion} onClose={() => { setModalObservacion(null); onDataUpdated(); }} />
        )}
        {modalDesactivar && (
          <ModalConfirmarDesactivar key="modal-del" maestro={modalDesactivar} onClose={() => setModalDesactivar(null)} onSuccess={() => { setModalDesactivar(null); onDataUpdated(); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ==========================================================================
   COMPONENTES UI
   ==========================================================================
*/

interface TabButtonProps { Icon: LucideIcon; label: string; isActive: boolean; onClick: () => void; badge?: number; }
function TabButton({ Icon, label, isActive, onClick, badge }: TabButtonProps) {
  return (
    <button onClick={onClick} className={`relative group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-300 ${isActive ? 'bg-white/40 text-indigo-800 shadow-sm border border-white/50' : 'text-gray-600 hover:bg-white/20 hover:text-gray-900'}`}>
      <Icon size={18} className={isActive ? "text-indigo-600" : "text-gray-500 group-hover:text-gray-700"} />
      <span>{label}</span>
      {badge !== undefined && badge > 0 && <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gradient-to-r from-pink-500 to-rose-500 px-1 text-[10px] font-bold text-white shadow-sm">{badge}</span>}
    </button>
  );
}

interface MobileTabProps { Icon: LucideIcon; label: string; isActive: boolean; onClick: () => void; badge?: number; }
function MobileTab({ Icon, label, isActive, onClick, badge }: MobileTabProps) {
  return (
    <button onClick={onClick} className="relative flex flex-col items-center justify-center p-2 rounded-lg w-16 active:scale-95 transition-transform">
      <div className={`p-1.5 rounded-lg transition-colors ${isActive ? 'bg-indigo-100/50 text-indigo-700' : 'text-gray-600'}`}><Icon size={20} /></div>
      <span className="text-[10px] font-medium mt-1 text-gray-600">{label}</span>
      {badge !== undefined && badge > 0 && <span className="absolute top-1 right-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />}
    </button>
  );
}

function GlassCard({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return <div className={`${GLASS_STYLES.panel} rounded-2xl overflow-hidden flex flex-col h-full ${className}`}>{children}</div>;
}

function CardHeader({ Icon, title, subtitle, children }: { Icon: LucideIcon, title: string, subtitle: string, children?: React.ReactNode }) {
  return (
    <div className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 ${GLASS_STYLES.headerGradient}`}>
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/50 text-indigo-600 shadow-sm border border-white/40"><Icon size={20} /></div>
        <div><h2 className="text-lg font-bold text-gray-900">{title}</h2><p className="text-sm text-gray-600">{subtitle}</p></div>
      </div>
      {children}
    </div>
  );
}

/* ==========================================================================
   PANELES (SCROLL FIX)
   ==========================================================================
*/

interface PanelConsultarProps { maestros: MaestroConCursos[]; cursos: Curso[]; estudiantes: Estudiante[]; inscripciones: Inscripcion[]; loading: boolean; }
function PanelConsultarEstudiantes({ maestros, cursos, estudiantes, inscripciones, loading }: PanelConsultarProps) {
  const [search, setSearch] = useState('');
  const [selectedMaestroId, setSelectedMaestroId] = useState('');

  const procesados = useMemo(() => {
    const mSet = new Map<string, MaestroConCursos>(maestros.map(m => [m.id, m]));
    const cSet = new Map<number, Curso>(cursos.map(c => [c.id, c]));
    const iSet = new Map<string, Inscripcion>(inscripciones.map(i => [i.entrevista_id, i]));

    return estudiantes.map(e => {
      const ins = iSet.get(e.id);
      return {
        ...e,
        maestro: (ins && ins.servidor_id) ? mSet.get(ins.servidor_id) || null : null,
        curso: (ins && ins.curso_id) ? cSet.get(ins.curso_id) || null : null,
        inscripcion_id: ins ? ins.entrevista_id : null
      };
    });
  }, [estudiantes, inscripciones, maestros, cursos]);

  const { pendientes, matriculados } = useMemo(() => {
    const q = search.toLowerCase();
    const match = (e: Estudiante) => !q || e.nombre.toLowerCase().includes(q) || e.cedula?.includes(q);
    return {
      pendientes: procesados.filter(e => !e.inscripcion_id && match(e)),
      matriculados: procesados.filter(e => e.inscripcion_id && (!selectedMaestroId || e.maestro?.id === selectedMaestroId) && match(e))
    };
  }, [procesados, search, selectedMaestroId]);

  return (
    <GlassCard className="h-full flex flex-col">
      <CardHeader Icon={ClipboardList} title="Consultar Estudiantes" subtitle="Base de datos de matrículas." />

      <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
        <div className="relative">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar estudiante..." className={`w-full rounded-lg px-4 py-2.5 pl-10 ${GLASS_STYLES.input}`} />
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        </div>
        <FormSelect value={selectedMaestroId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedMaestroId(e.target.value)} label="">
          <option value="">Todos los Maestros</option>
          {maestros.filter(m => m.rol === 'Maestro Ptm').map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </FormSelect>
      </div>

      {/* CONTENEDOR DE LISTAS CON SCROLL INDEPENDIENTE EN MÓVIL Y DESKTOP */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-4 pb-4 md:px-6 md:pb-6 flex-1 min-h-0 overflow-hidden">

        {/* COLUMNA PENDIENTES */}
        <div className="flex flex-col h-full min-h-0">
          <div className="mb-2 flex items-center gap-2 text-rose-700 font-semibold shrink-0"><UserX size={18} /> Pendientes ({pendientes.length})</div>
          {/* FIX: h-auto en movil con max-height o flex-1 si el contenedor padre lo permite. Usamos h-full con overflow. */}
          <div className={`flex-1 overflow-y-auto rounded-xl ${GLASS_STYLES.input} p-0 border-2 border-white/50`}>
            {loading ? <div className="p-4 text-center">Cargando...</div> : pendientes.length === 0 ? <div className="p-8 text-center text-gray-500">No hay pendientes</div> : pendientes.map(e => <EstudianteRow key={e.id} e={e} />)}
          </div>
        </div>

        {/* COLUMNA MATRICULADOS */}
        <div className="flex flex-col h-full min-h-0">
          <div className="mb-2 flex items-center gap-2 text-blue-700 font-semibold shrink-0"><UserCheck2 size={18} /> Matriculados ({matriculados.length})</div>
          <div className={`flex-1 overflow-y-auto rounded-xl ${GLASS_STYLES.input} p-0 border-2 border-white/50`}>
            {loading ? <div className="p-4 text-center">Cargando...</div> : matriculados.length === 0 ? <div className="p-8 text-center text-gray-500">No hay matriculados</div> : matriculados.map(e => <EstudianteRow key={e.id} e={e} matriculado />)}
          </div>
        </div>

      </div>
    </GlassCard>
  );
}

function EstudianteRow({ e, matriculado }: { e: EstudianteInscrito, matriculado?: boolean }) {
  return (
    <div className={`p-3 flex justify-between items-center ${GLASS_STYLES.listItem}`}>
      <div>
        <p className="font-medium text-gray-900 text-sm">{e.nombre}</p>
        <p className="text-xs text-gray-500">{e.cedula}</p>
      </div>
      {matriculado ? (
        <div className="text-right">
          <span className="block text-xs font-bold text-blue-700 bg-blue-100/50 px-2 py-0.5 rounded-full truncate max-w-[120px]">{e.curso?.nombre}</span>
          <span className="text-[10px] text-gray-500">{e.maestro?.nombre}</span>
        </div>
      ) : (
        <span className="text-xs font-medium text-amber-700 bg-amber-100/50 px-2 py-0.5 rounded-full">Pendiente</span>
      )}
    </div>
  );
}

interface PanelMatricularProps { maestros: MaestroConCursos[]; cursos: Curso[]; estudiantes: Estudiante[]; inscripciones: Inscripcion[]; onMatriculaExitosa: () => void; loading: boolean; }
function PanelMatricular({ maestros, cursos, estudiantes, inscripciones, onMatriculaExitosa, loading }: PanelMatricularProps) {
  const [cursoId, setCursoId] = useState('');
  const [maestroId, setMaestroId] = useState('');
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const c = cursos.find(c => c.nombre === 'Restauración 1');
    if (c) setCursoId(String(c.id));
  }, [cursos]);

  const mDisponibles = useMemo(() => !cursoId ? [] : maestros.filter(m => m.rol === 'Maestro Ptm' && m.asignaciones.some(a => a.curso_id === parseInt(cursoId))), [cursoId, maestros]);
  const eDisponibles = useMemo(() => {
    if (!cursoId) return [];
    const inscritos = new Set(inscripciones.map(i => i.entrevista_id));
    return estudiantes.filter(e => !inscritos.has(e.id) && (!search || e.nombre.toLowerCase().includes(search.toLowerCase())));
  }, [cursoId, estudiantes, inscripciones, search]);

  const handleMatricular = async () => {
    setIsSaving(true);
    const ids = Object.keys(selectedIds).filter(k => selectedIds[k]);
    try {
      const { data, error } = await supabase.from('inscripciones').insert(ids.map(id => ({ entrevista_id: id, curso_id: parseInt(cursoId), servidor_id: maestroId, estado: 'activo' }))).select('id');
      if (error) throw error;
      if (data) await supabase.from('asistencias_academia').insert(data.map((d: { id: number }) => ({ inscripcion_id: d.id, asistencias: '{}' })));
      alert("Matrícula exitosa"); setSelectedIds({}); onMatriculaExitosa();
    } catch (e: any) { alert(e.message); } finally { setIsSaving(false); }
  };

  return (
    <GlassCard className="h-full flex flex-col">
      <CardHeader Icon={UserPlus} title="Matricular Estudiantes" subtitle="Asignación de cursos y maestros." />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 flex-1 min-h-0 overflow-hidden">
        <div className="space-y-4 overflow-visible md:overflow-y-auto md:max-h-full">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Configuración</label>
            <FormSelect label="Curso" value={cursoId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setCursoId(e.target.value); setMaestroId(''); }}>
              {cursos.filter(c => c.nombre === 'Restauración 1').map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </FormSelect>
            <FormSelect label="Maestro" value={maestroId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMaestroId(e.target.value)} disabled={!cursoId}>
              <option value="">Seleccionar...</option>
              {mDisponibles.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </FormSelect>
          </div>
          <button onClick={handleMatricular} disabled={isSaving || !maestroId || Object.keys(selectedIds).length === 0} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50">
            {isSaving ? "Procesando..." : "Confirmar Matrícula"}
          </button>
        </div>

        <div className="md:col-span-2 flex flex-col min-h-0 h-full">
          <div className="mb-2 relative shrink-0">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Filtrar estudiantes..." className={`w-full rounded-lg pl-9 py-2 ${GLASS_STYLES.input}`} />
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          </div>
          <div className={`flex-1 overflow-y-auto rounded-xl ${GLASS_STYLES.input} p-0 border-2 border-white/50`}>
            {eDisponibles.length === 0 ? <div className="p-6 text-center text-gray-500">No hay estudiantes disponibles</div> : eDisponibles.map(e => (
              <div key={e.id} onClick={() => setSelectedIds(p => ({ ...p, [e.id]: !p[e.id] }))} className={`flex items-center gap-3 p-3 cursor-pointer ${GLASS_STYLES.listItem} ${selectedIds[e.id] ? 'bg-blue-50/60' : ''}`}>
                <div className={`h-5 w-5 rounded border flex items-center justify-center ${selectedIds[e.id] ? 'bg-blue-500 border-blue-500' : 'border-gray-400'}`}>
                  {selectedIds[e.id] && <Check size={12} className="text-white" />}
                </div>
                <div><p className="text-sm font-medium">{e.nombre}</p><p className="text-xs text-gray-500">{e.cedula}</p></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

interface PanelMaestrosProps {
  maestros: MaestroConCursos[];
  loading: boolean;
  onCrear: () => void;
  onEditar: (m: MaestroConCursos) => void;
  onAsignar: (m: MaestroConCursos) => void;
  onObs: (m: MaestroConCursos) => void;
  onDesactivar: (m: MaestroConCursos) => void;
}
function PanelGestionarMaestros({ maestros, loading, onCrear, onEditar, onAsignar, onObs, onDesactivar }: PanelMaestrosProps) {
  const [search, setSearch] = useState('');
  const filtered = maestros.filter(m => !search || m.nombre.toLowerCase().includes(search.toLowerCase()));

  return (
    <GlassCard className="h-full flex flex-col">
      <CardHeader Icon={Users} title="Gestionar Maestros" subtitle="Administración docente." >
        <button onClick={onCrear} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-md shadow-blue-500/30 flex items-center gap-2"><Plus size={16} /> Nuevo</button>
      </CardHeader>
      <div className="px-6 pt-4 shrink-0">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className={`w-full rounded-lg px-4 py-2 ${GLASS_STYLES.input}`} />
      </div>
      <div className="p-6 flex-1 overflow-y-auto min-h-0">
        {loading ? <div className="text-center p-4">Cargando...</div> : (
          <ul className="space-y-3">
            {filtered.map(m => (
              <li key={m.id} className={`p-4 rounded-xl ${GLASS_STYLES.panel} flex flex-col md:flex-row items-start md:items-center gap-4 justify-between`}>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-white/50 flex items-center justify-center text-indigo-800 font-bold shadow-sm">{m.nombre.charAt(0)}</div>
                  <div>
                    <p className="font-bold text-gray-900">{m.nombre}</p>
                    <p className="text-xs text-gray-600 flex items-center gap-2">
                      {m.cedula}
                      {m.rol && <span className="bg-gray-100/60 px-2 py-0.5 rounded text-gray-700">{m.rol}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {m.asignaciones.map((a, idx) => <span key={`${a.id}-${idx}`} className="text-[10px] bg-blue-50/80 text-blue-800 px-2 py-1 rounded border border-blue-100">{a.cursos?.nombre}</span>)}
                </div>
                <div className="flex gap-2 mt-2 md:mt-0">
                  <button onClick={() => onObs(m)} className={`${GLASS_STYLES.buttonSecondary} px-3 py-1.5 rounded-lg text-xs relative`}><MessageSquarePlus size={16} /> {m.obs_count > 0 && <span className="absolute -top-1 -right-1 h-2 w-2 bg-rose-500 rounded-full" />}</button>
                  <button onClick={() => onAsignar(m)} className={`${GLASS_STYLES.buttonSecondary} px-3 py-1.5 rounded-lg text-xs flex gap-1`}><BookOpen size={16} /> <span className="hidden md:inline">Cursos</span></button>
                  <button onClick={() => onEditar(m)} className={`${GLASS_STYLES.buttonSecondary} px-3 py-1.5 rounded-lg text-xs flex gap-1`}><Edit2 size={16} /> <span className="hidden md:inline">Editar</span></button>
                  <button onClick={() => onDesactivar(m)} className={`${GLASS_STYLES.buttonSecondary} px-3 py-1.5 rounded-lg text-xs text-red-600 hover:bg-red-50`}><Trash2 size={16} /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </GlassCard>
  );
}

/* ==========================================================================
   INPUTS REUTILIZABLES
   ==========================================================================
*/

interface SelectProps { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; children: React.ReactNode; disabled?: boolean; }
function FormSelect({ label, value, onChange, children, disabled }: SelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const options = React.Children.toArray(children).map((ch: any) => {
    if (!ch || typeof ch !== 'object') return null;
    const val = ch.props?.value ?? '';
    return { value: String(val), label: ch.props?.children ?? String(val), disabled: !!ch.props?.disabled };
  }).filter(Boolean) as { value: string; label: any; disabled: boolean }[];

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('click', onDoc); return () => document.removeEventListener('click', onDoc);
  }, []);

  const handleSelect = (val: string) => { onChange({ target: { value: val } } as any); setOpen(false); };
  const selectedLabel = options.find(o => o.value === value)?.label ?? 'Seleccionar...';

  return (
    <div className="relative" ref={rootRef}>
      {label && <label className="block text-xs font-bold text-gray-600 uppercase mb-1">{label}</label>}
      <button type="button" disabled={disabled} onClick={() => setOpen(p => !p)} className={`w-full text-left rounded-lg px-3 py-2.5 flex justify-between items-center ${GLASS_STYLES.input} ${disabled ? 'opacity-60' : ''}`}>
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown size={16} className="text-gray-500" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-lg shadow-xl border border-gray-200 max-h-60 overflow-auto p-1">
          {options.map((opt, idx) => (
            <div key={`${opt.value}-${idx}`} onClick={() => !opt.disabled && handleSelect(opt.value)} className={`px-3 py-2 text-sm rounded cursor-pointer ${opt.disabled ? 'opacity-50' : 'hover:bg-indigo-50 hover:text-indigo-700'} ${opt.value === value ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'}`}>
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface InputProps { id: string; label: string; value: string; onChange: (v: string) => void; type?: string; disabled?: boolean; }
function FormInput({ id, label, value, onChange, type = "text", disabled }: InputProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-bold text-gray-600 uppercase mb-1">{label}</label>
      <input id={id} type={type} value={value} onChange={e => onChange(e.target.value)} disabled={disabled} className={`w-full rounded-lg px-3 py-2 ${GLASS_STYLES.input}`} />
    </div>
  );
}

/* ==========================================================================
   MODALES
   ==========================================================================
*/

function ModalTemplate({ children, onClose, title }: { children: React.ReactNode, onClose: () => void, title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm" onClick={onClose}>
      <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit" onClick={e => e.stopPropagation()} className={`relative w-full max-w-lg rounded-2xl overflow-hidden flex flex-col max-h-[92vh] ${GLASS_STYLES.container} bg-white/80`}>
        <div className={`p-4 flex justify-between items-center border-b border-white/50 bg-white/40`}>
          <h3 className="font-bold text-gray-900 text-lg">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/50 rounded-full text-gray-500"><X size={20} /></button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

function ModalCrearEditarMaestro({ maestroInicial, onClose, onSuccess }: { maestroInicial: MaestroConCursos | null, onClose: () => void, onSuccess: () => void }) {
  const isEdit = !!maestroInicial;
  const [nom, setNom] = useState(maestroInicial?.nombre || '');
  const [ced, setCed] = useState(maestroInicial?.cedula || '');
  const [rol, setRol] = useState(maestroInicial?.rol || 'Maestro Ptm');
  const [loading, setLoading] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom || !ced) return alert("Nombre y Cédula requeridos");
    setLoading(true);
    try {
      // 1. Crear o Actualizar Servidor
      const { data: sid, error: err1 } = await supabase.rpc('fn_upsert_servidor', {
        p_cedula: ced.trim(),
        p_nombre: nom.trim(),
        p_telefono: null,
        p_email: null
      });
      if (err1) throw err1;

      // 2. Asignar Rol (Manual Update/Insert para evitar error ON CONFLICT)
      const { data: existingRole, error: errCheck } = await supabase
        .from('servidores_roles')
        .select('id')
        .eq('servidor_id', sid)
        .eq('rol', rol)
        .maybeSingle();

      if (errCheck) throw errCheck;

      if (existingRole) {
        // Actualizar
        const { error: errUpd } = await supabase
          .from('servidores_roles')
          .update({ vigente: true })
          .eq('id', existingRole.id);
        if (errUpd) throw errUpd;
      } else {
        // Insertar
        const { error: errIns } = await supabase
          .from('servidores_roles')
          .insert({ servidor_id: sid, rol: rol, vigente: true });
        if (errIns) throw errIns;
      }

      onSuccess();
    }
    catch (err: any) {
      console.error(err);
      alert("Error al guardar: " + err.message);
    }
    finally { setLoading(false); }
  };

  return (
    <ModalTemplate onClose={onClose} title={isEdit ? "Editar Maestro" : "Nuevo Maestro"}>
      <form onSubmit={save} className="p-6 space-y-4 flex-1 overflow-y-auto">
        <FormInput id="n" label="Nombre" value={nom} onChange={setNom} />
        <FormInput id="c" label="Cédula" value={ced} onChange={setCed} disabled={isEdit} />
        <FormSelect label="Rol" value={rol} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRol(e.target.value)}>
          <option value="Maestro Ptm">Maestro Ptm</option>
          {['Coordinador', 'Timoteo', 'Logistica', 'Director', 'Administrador'].map(r => <option key={r} value={r}>{r}</option>)}
        </FormSelect>
        <div className="pt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-gray-600 hover:bg-white/50 text-sm font-medium">Cancelar</button>
          <button disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-blue-500/30">
            {loading ? <Loader2 className="animate-spin inline mr-2" size={16} /> : null}
            {loading ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </ModalTemplate>
  );
}

function ModalAsignarCursos({ maestro, cursosDisponibles, onClose, onSuccess }: { maestro: MaestroConCursos, cursosDisponibles: Curso[], onClose: () => void, onSuccess: () => void }) {
  const [asig, setAsig] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const m: Record<string, boolean> = {};
    maestro.asignaciones.forEach(a => m[a.curso_id] = true);
    setAsig(m);
  }, [maestro]);

  const save = async () => {
    setSaving(true);
    try {
      const currentIds = maestro.asignaciones.map(a => a.curso_id);
      const newIds = Object.keys(asig).filter(k => asig[k]).map(Number);

      const toAdd = newIds.filter(id => !currentIds.includes(id));
      const toRemove = currentIds.filter(id => !newIds.includes(id));

      if (toRemove.length > 0) {
        // Buscar los IDs de asignación para desactivar
        // Necesitamos mapear curso_id -> asignacion_id
        const idsToUpdate = maestro.asignaciones
          .filter(a => toRemove.includes(a.curso_id))
          .map(a => a.id);

        if (idsToUpdate.length > 0) {
          const { error: errDel } = await supabase
            .from('asignaciones_academia')
            .update({ vigente: false })
            .in('id', idsToUpdate);
          if (errDel) throw errDel;
        }
      }

      if (toAdd.length > 0) {
        const rows = toAdd.map(cid => ({
          servidor_id: maestro.id,
          curso_id: cid,
          vigente: true
        }));
        const { error: errAdd } = await supabase.from('asignaciones_academia').insert(rows);
        if (errAdd) throw errAdd;
      }

      onSuccess();
    } catch (e: any) {
      alert("Error al guardar asignaciones: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalTemplate onClose={onClose} title={`Cursos: ${maestro.nombre}`}>
      <div className="p-4 flex-1 overflow-y-auto grid grid-cols-1 gap-2">
        {cursosDisponibles.map((c, idx) => (
          <label key={`${c.id}-${idx}`} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-all ${asig[c.id] ? 'bg-indigo-50 border-indigo-200' : 'bg-white/40 border-white/40 hover:bg-white/60'}`}>
            <input type="checkbox" checked={!!asig[c.id]} onChange={() => setAsig(p => ({ ...p, [c.id]: !p[c.id] }))} className="rounded text-indigo-600" />
            <span className="text-sm font-medium text-gray-800">{c.nombre}</span>
          </label>
        ))}
      </div>
      <div className="p-4 border-t border-white/50 flex justify-end">
        <button onClick={save} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-blue-500/30 flex items-center gap-2">
          {saving && <Loader2 className="animate-spin" size={14} />} Guardar Cambios
        </button>
      </div>
    </ModalTemplate>
  );
}

function ModalObservaciones({ maestro, onClose }: { maestro: MaestroConCursos, onClose: () => void }) {
  const [obs, setObs] = useState<Observacion[]>([]);
  const [txt, setTxt] = useState('');
  const [load, setLoad] = useState(true);

  const fetchObs = useCallback(async () => {
    const { data } = await supabase.from('servidores_observaciones').select('*').eq('servidor_id', maestro.id).order('created_at', { ascending: false });
    setObs(data as unknown as Observacion[] || []); setLoad(false);
  }, [maestro.id]);

  useEffect(() => { fetchObs(); }, [fetchObs]);

  const send = async () => {
    if (!txt.trim()) return;
    await supabase.from('servidores_observaciones').insert({ servidor_id: maestro.id, observacion: txt });
    setTxt(''); fetchObs();
  };

  return (
    <ModalTemplate onClose={onClose} title="Observaciones">
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/30">
        {load ? <div className="text-center text-sm text-gray-500">Cargando...</div> : obs.length === 0 ? <div className="text-center text-sm text-gray-500 opacity-60">No hay historial</div> : obs.map(o => (
          <div key={o.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 text-sm text-gray-700">
            <p>{o.observacion}</p>
            <p className="text-[10px] text-gray-400 mt-1 text-right">{new Date(o.created_at).toLocaleDateString()}</p>
          </div>
        ))}
      </div>
      <div className="p-3 bg-white border-t border-gray-100 flex gap-2">
        <input value={txt} onChange={e => setTxt(e.target.value)} placeholder="Escribir nota..." className="flex-1 border border-gray-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <button onClick={send} disabled={!txt.trim()} className="bg-indigo-600 text-white p-2 rounded-lg disabled:opacity-50"><Plus size={20} /></button>
      </div>
    </ModalTemplate>
  );
}

function ModalConfirmarDesactivar({ maestro, onClose, onSuccess }: { maestro: MaestroConCursos, onClose: () => void, onSuccess: () => void }) {
  return (
    <ModalTemplate onClose={onClose} title="Desactivar">
      <div className="p-6 text-center">
        <div className="mx-auto w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-3"><AlertTriangle /></div>
        <p className="text-gray-800 mb-6">¿Estás seguro de desactivar a <b>{maestro.nombre}</b>?</p>
        <div className="flex justify-center gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100">Cancelar</button>
          <button onClick={async () => { await supabase.rpc('fn_desactivar_servidor', { p_servidor_id: maestro.id }); onSuccess(); }} className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-red-500/30">Si, Desactivar</button>
        </div>
      </div>
    </ModalTemplate>
  );
}