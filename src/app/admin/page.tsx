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
  ChevronDown, AlertTriangle, ClipboardList, UserX, UserCheck2,
  Phone, MessageCircle, GraduationCap, LogOut
} from 'lucide-react';
import ServidoresPage from '../panel/servidores/page';
import ComponenteGestionarMaestros from './components/GestionServidores'; // Asumo que este es el nombre real o similar
import PanelMatricular from './components/PanelMatricular';
import PanelConsultarEstudiantes from './components/PanelConsultarEstudiantes';
import PanelPromovidos from './components/PanelPromovidos';
import { PresenceToast, type Toast } from './components/PresenceToast';
import { usePresence } from '../../hooks/usePresence';
import { useGlobalPresence } from '../../hooks/useGlobalPresence';

// --- CONSTANTES DE ESTILO ---
export const GLASS_STYLES = {
  // En móvil (rounded-none, border-0) para que parezca app nativa, en desktop (rounded-3xl)
  container: "bg-white/25 backdrop-blur-xl md:border md:border-white/40 md:shadow-2xl",
  panel: "bg-white/30 backdrop-blur-xl border border-white/50 shadow-sm",
  input: "bg-white/40 backdrop-blur-sm border border-white/50 text-gray-900 placeholder-gray-600 focus:bg-white/60 focus:ring-2 focus:ring-blue-500 focus:border-transparent",
  buttonSecondary: "bg-white/40 border border-white/50 text-gray-800 hover:bg-white/60 transition-colors",
  headerGradient: "bg-gradient-to-br from-indigo-50/40 via-white/60 to-white/40 backdrop-blur-md border-b border-white/50",
  listItem: "hover:bg-white/30 transition-colors border-b border-white/30 last:border-0"
};

// --- TIPOS DE DATOS ---
export type Observacion = { id: string; observacion: string; created_at: string; creador: { nombre: string; } | null; };
export type Maestro = { id: string; nombre: string; cedula: string; telefono: string | null; email: string | null; activo: boolean; };
export type Curso = { id: number; nombre: string; color: string; orden?: number };
export type AsignacionMaestro = { id: string; servidor_id: string; curso_id: number; cursos: Pick<Curso, 'nombre' | 'color'> | null; };
export type MaestroDataRaw = Maestro & { asignaciones: AsignacionMaestro[]; observaciones_count: { count: number }[]; servidores_roles: { rol: string }[]; };
export type MaestroConCursos = Maestro & { asignaciones: AsignacionMaestro[]; obs_count: number; rol: string | null; };
export type Estudiante = { id: string; nombre: string; cedula: string; telefono?: string | null; foto_path?: string | null; };
export type Inscripcion = { id: number; entrevista_id: string; curso_id: number; servidor_id: string | null; cursos?: Pick<Curso, 'nombre' | 'color'> | null; };
export type EstudianteInscrito = Estudiante & { maestro: MaestroConCursos | null; curso: Curso | null; inscripcion_id: number | null; };
export type AdminTab = 'matricular' | 'maestros' | 'servidores' | 'consultar' | 'promovidos';

// --- HELPERS ---
function bustUrl(u?: string | null) {
  if (!u) return u ?? null;
  const sep = u.includes("?") ? "&" : "?";
  return `${u}${sep}v=${Date.now()}`;
}


// --- VARIANTES DE ANIMACIÓN ---
const fadeTransition: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: "easeOut" } },
  exit: { opacity: 0, x: 20, transition: { duration: 0.2 } }
};

export const modalVariants: Variants = {
  hidden: { scale: 0.95, opacity: 0 },
  visible: { scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 30 } },
  exit: { scale: 0.95, opacity: 0 },
};

// Animaciones premium para las tarjetas de maestros
const EASE_SMOOTH = [0.16, 1, 0.3, 1] as const;

const LIST_WRAPPER_VARIANTS: Variants = {
  hidden: {
    transition: { staggerChildren: 0.035, staggerDirection: -1 }
  },
  visible: {
    transition: { delayChildren: 0.12, staggerChildren: 0.055 }
  }
};

const LIST_ITEM_VARIANTS: Variants = {
  hidden: { opacity: 0, x: 28, y: 14, scale: 0.97 },
  visible: {
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: EASE_SMOOTH }
  }
};

// --- COMPONENTE PRINCIPAL ---
export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('maestros');
  const [maestros, setMaestros] = useState<MaestroConCursos[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [fotoUrls, setFotoUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Modales
  const [modalMaestro, setModalMaestro] = useState<MaestroConCursos | 'new' | null>(null);
  const [modalAsignar, setModalAsignar] = useState<MaestroConCursos | null>(null);
  const [modalObservacion, setModalObservacion] = useState<MaestroConCursos | null>(null);
  const [modalDesactivar, setModalDesactivar] = useState<MaestroConCursos | null>(null);

  // Usuario Logueado
  const [currentUser, setCurrentUser] = useState<{ name: string; initials: string; id: string }>({ name: 'Administrador', initials: 'AD', id: '' });

  // Presence Notifications


  useEffect(() => {
    // Obtener información del usuario desde el JWT
    const fetchUserProfile = async () => {
      try {
        const res = await fetch('/api/me');
        if (res.ok) {
          const data = await res.json();
          // data incluye: cedula, servidorId, etc

          if (data.servidorId) {
            // Buscar el nombre usando servidorId
            const { data: servidor } = await supabase
              .from('servidores')
              .select('nombre')
              .eq('id', data.servidorId)
              .maybeSingle();

            if (servidor && servidor.nombre) {
              setCurrentUser({
                name: servidor.nombre,
                initials: servidor.nombre.substring(0, 2).toUpperCase(),
                id: data.servidorId
              });
            }
          } else if (data.cedula) {
            // Fallback: buscar por cédula
            const { data: servidor } = await supabase
              .from('servidores')
              .select('nombre, id')
              .eq('cedula', data.cedula)
              .maybeSingle();

            if (servidor && servidor.nombre) {
              setCurrentUser({
                name: servidor.nombre,
                initials: servidor.nombre.substring(0, 2).toUpperCase(),
                id: servidor.id
              });
            }
          }
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
      }
    };

    fetchUserProfile();
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [{ data: mData }, { data: cData }, { data: eData }, { data: iData }] = await Promise.all([
        supabase.from('servidores').select(`id, nombre, cedula, telefono, email, activo, asignaciones:asignaciones_academia (id, servidor_id, curso_id, cursos ( nombre, color )), observaciones_count:servidores_observaciones!servidor_id(count), servidores_roles ( rol )`).order('nombre', { ascending: true }),
        supabase.from('cursos').select('id, nombre, color, orden').order('orden', { ascending: true }),
        supabase.from('entrevistas').select('id, nombre, cedula, telefono, foto_path').order('nombre', { ascending: true }),
        supabase.from('inscripciones').select('id, entrevista_id, curso_id, servidor_id, estado')
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

      // Cargar fotos en background
      const eList = (eData as Estudiante[]) || [];
      const paths = eList.map(e => e.foto_path).filter(Boolean) as string[];
      if (paths.length > 0) {
        supabase.storage.from("entrevistas-fotos").createSignedUrls(paths, 3600).then(({ data }) => {
          if (data) {
            const map: Record<string, string> = {};
            data.forEach(d => { if (d.path && d.signedUrl) map[d.path] = bustUrl(d.signedUrl)!; });
            setFotoUrls(p => ({ ...p, ...map }));
          }
        });
      }
    } catch (err) { console.error(err); } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  const onDataUpdated = () => loadData();

  const estudiantesPendientesCount = useMemo(() => {
    // Count students that either have no inscription OR have inactive/suspended status
    const activeIds = new Set(
      inscripciones
        .filter(i => (i as any).estado === 'activo' || (i as any).estado === 'promovido')
        .map(i => i.entrevista_id)
    );
    return estudiantes.filter(e => !activeIds.has(e.id)).length;
  }, [estudiantes, inscripciones]);

  const promovidosCount = useMemo(() => {
    return inscripciones.filter(i => (i as any).estado === 'promovido').length;
  }, [inscripciones]);



  // Presence Notifications (Centralizado)
  const { toasts, handleDismissToast } = useGlobalPresence(currentUser.name, currentUser.id);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

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
              {/* <TabButton Icon={Server} label="Servidores" isActive={activeTab === 'servidores'} onClick={() => setActiveTab('servidores')} /> */}
              <TabButton Icon={Users} label="Maestros" isActive={activeTab === 'maestros'} onClick={() => setActiveTab('maestros')} />
              <TabButton Icon={UserPlus} label="Matricular" isActive={activeTab === 'matricular'} onClick={() => setActiveTab('matricular')} badge={estudiantesPendientesCount} />
              <TabButton Icon={GraduationCap} label="Promovidos" isActive={activeTab === 'promovidos'} onClick={() => setActiveTab('promovidos')} badge={promovidosCount} />
              <TabButton Icon={ClipboardList} label="Estudiantes" isActive={activeTab === 'consultar'} onClick={() => setActiveTab('consultar')} />
            </nav>
            <div className="mt-auto border-t border-white/30 pt-4 px-2">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">{currentUser.initials}</div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-indigo-900">{currentUser.name}</span>
                  <span className="text-[10px] text-indigo-700/70">En línea</span>
                </div>
                <button onClick={handleLogout} className="ml-auto p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Cerrar Sesión">
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          </aside>

          {/* CONTENIDO PRINCIPAL */}
          <main className="flex-1 relative flex flex-col min-w-0 bg-transparent h-full overflow-hidden">
            {/* Header Móvil */}
            {/* Removido: Título 'Academia' */}

            {/* Area de Contenido con Scroll */}
            <div className="flex-1 overflow-y-auto p-2 md:p-8 md:pb-8 scroll-smooth relative">
              {/* Botón Logout Flotante (Solo Móvil) */}
              <button
                onClick={handleLogout}
                className="md:hidden absolute top-4 right-4 z-50 p-2 rounded-full bg-white/40 border border-white/50 text-red-600 shadow-lg backdrop-blur text-xs font-bold active:scale-95"
              >
                <LogOut size={16} />
              </button>

              <AnimatePresence mode="wait">
                <motion.div key={activeTab} variants={fadeTransition} initial="hidden" animate="visible" exit="exit" className="h-full flex flex-col">
                  {activeTab === 'servidores' && <ServidoresPage />}
                  {activeTab === 'matricular' && <PanelMatricular maestros={maestros} cursos={cursos} estudiantes={estudiantes} inscripciones={inscripciones} onMatriculaExitosa={onDataUpdated} loading={isLoading} />}
                  {activeTab === 'maestros' && <PanelGestionarMaestros maestros={maestros.filter(m => m.rol === 'Maestro Ptm')} loading={isLoading} onCrear={() => setModalMaestro('new')} onEditar={(m) => setModalMaestro(m)} onAsignar={(m) => setModalAsignar(m)} onObs={(m) => setModalObservacion(m)} onDesactivar={(m) => setModalDesactivar(m)} />}
                  {activeTab === 'promovidos' && <PanelPromovidos maestros={maestros} cursos={cursos} estudiantes={estudiantes} onDataUpdated={onDataUpdated} loading={isLoading} />}
                  {activeTab === 'consultar' && <PanelConsultarEstudiantes maestros={maestros} cursos={cursos} estudiantes={estudiantes} inscripciones={inscripciones} loading={isLoading} fotoUrls={fotoUrls} onDataUpdated={onDataUpdated} />}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Barra de Navegación Móvil (Sticky Bottom) */}
            <div className="md:hidden border-t border-white/40 bg-white/40 backdrop-blur-xl flex justify-around py-1 px-2 pb-safe shrink-0 z-30">
              {/* <MobileTab Icon={Server} label="Servidores" isActive={activeTab === 'servidores'} onClick={() => setActiveTab('servidores')} /> */}
              <MobileTab Icon={Users} label="Maestros" isActive={activeTab === 'maestros'} onClick={() => setActiveTab('maestros')} />
              <MobileTab Icon={UserPlus} label="Matricular" isActive={activeTab === 'matricular'} onClick={() => setActiveTab('matricular')} badge={estudiantesPendientesCount} />
              <MobileTab Icon={GraduationCap} label="Prom." isActive={activeTab === 'promovidos'} onClick={() => setActiveTab('promovidos')} badge={promovidosCount} />
              <MobileTab Icon={ClipboardList} label="Estudiantes" isActive={activeTab === 'consultar'} onClick={() => setActiveTab('consultar')} />
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

      {/* PRESENCE TOAST NOTIFICATIONS */}
      <PresenceToast toasts={toasts} onDismiss={handleDismissToast} />
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
      <div className={`p-1 rounded-lg transition-colors ${isActive ? 'bg-indigo-100/50 text-indigo-700' : 'text-gray-600'}`}><Icon size={18} /></div>
      <span className="text-[10px] font-medium mt-0.5 text-gray-600">{label}</span>
      {badge !== undefined && badge > 0 && <span className="absolute top-0 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-0.5 text-[9px] font-bold text-white shadow-sm ring-1 ring-white">{badge}</span>}
    </button>
  );
}

export function GlassCard({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return <div className={`${GLASS_STYLES.panel} rounded-2xl overflow-hidden flex flex-col h-full ${className}`}>{children}</div>;
}

export function CardHeader({ Icon, title, subtitle, children }: { Icon: LucideIcon, title: string, subtitle: string, children?: React.ReactNode }) {
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
          <motion.ul
            className="space-y-3"
            variants={LIST_WRAPPER_VARIANTS}
            initial="hidden"
            animate="visible"
          >
            {filtered.map(m => (
              <motion.li
                key={m.id}
                variants={LIST_ITEM_VARIANTS}
                className={`p-4 rounded-xl ${GLASS_STYLES.panel} flex flex-col md:flex-row items-start md:items-center gap-4 justify-between`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-white/50 flex items-center justify-center text-indigo-800 font-bold shadow-sm">{m.nombre.charAt(0)}</div>
                  <div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <p className="font-bold text-gray-900 text-[16px]">{m.nombre}</p>
                      {m.telefono && (
                        <div className="flex items-center gap-3">
                          <button onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${m.telefono!.replace(/\s+/g, '')}`; }} className="h-10 w-10 rounded-full bg-white/70 flex items-center justify-center text-sky-600 hover:bg-white hover:scale-110 hover:shadow-md transition-all shadow-sm border border-sky-100"><Phone size={20} /></button>
                          <button onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/${m.telefono!.replace(/\D/g, '')}`, '_blank'); }} className="h-10 w-10 rounded-full bg-white/70 flex items-center justify-center text-emerald-600 hover:bg-white hover:scale-110 hover:shadow-md transition-all shadow-sm border border-emerald-100"><MessageCircle size={20} /></button>
                        </div>
                      )}
                    </div>
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
              </motion.li>
            ))}
          </motion.ul>
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
export function FormSelect({ label, value, onChange, children, disabled }: SelectProps) {
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

interface InputProps { id: string; label: string; value: string; onChange: (v: string) => void; type?: string; disabled?: boolean; placeholder?: string; }
export function FormInput({ id, label, value, onChange, type = "text", disabled, placeholder }: InputProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-bold text-gray-600 uppercase mb-1">{label}</label>
      <input id={id} type={type} value={value} onChange={e => onChange(e.target.value)} disabled={disabled} placeholder={placeholder} className={`w-full rounded-lg px-3 py-2 ${GLASS_STYLES.input}`} />
    </div>
  );
}

/* ==========================================================================
   MODALES
   ==========================================================================
*/

export function ModalTemplate({ children, onClose, title }: { children: React.ReactNode, onClose: () => void, title: string }) {
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
  const [tel, setTel] = useState(maestroInicial?.telefono || '');
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
        p_telefono: tel.trim() || null,
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
        <FormInput id="t" label="Teléfono" value={tel} onChange={setTel} placeholder="Ej: 3001234567" />
        <FormInput id="rol-display" label="Rol" value="Maestro Proceso Transformacional" onChange={() => { }} disabled />
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







