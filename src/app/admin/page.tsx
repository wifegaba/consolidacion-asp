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
  Phone, MessageCircle, GraduationCap, LogOut, Home
} from 'lucide-react';
import { LogoutButton } from '../../components/ui/LogoutButton';
import { PremiumActionButton } from './components/PremiumActionButton';
// import ServidoresPage from '../panel/servidores/page'; // REMOVIDO: causaba errores de compilación
import ComponenteGestionarMaestros from './components/GestionServidores'; // Asumo que este es el nombre real o similar
import PanelMatricular from './components/PanelMatricular';
import PanelConsultarEstudiantes from './components/PanelConsultarEstudiantes';
import PanelPromovidos from './components/PanelPromovidos';
import PanelDashboard, { DashboardStats } from './components/PanelDashboard';
import WelcomePanelAdmin from './components/WelcomePanelAdmin';
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
export type MaestroConCursos = Maestro & { asignaciones: AsignacionMaestro[]; obs_count: number; rol: string | null; dia_asignado?: string | null; };
export type Estudiante = { id: string; nombre: string; cedula: string; telefono?: string | null; foto_path?: string | null; dia?: string; };
export type Inscripcion = { id: number; entrevista_id: string; curso_id: number; servidor_id: string | null; cursos?: Pick<Curso, 'nombre' | 'color'> | null; estado?: string; };
export type EstudianteInscrito = Estudiante & { maestro: MaestroConCursos | null; curso: Curso | null; inscripcion_id: number | null; };
export type AdminTab = 'bienvenida' | 'dashboard' | 'matricular' | 'maestros' | 'servidores' | 'consultar' | 'promovidos';

// --- HELPERS ---
function bustUrl(u?: string | null) {
  if (!u) return u ?? null;
  const sep = u.includes("?") ? "&" : "?";
  return `${u}${sep}v=${Date.now()}`;
}


// --- VARIANTES DE ANIMACIÓN ---
const fadeTransition: Variants = {
  hidden: { opacity: 0, y: 0 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
  exit: { opacity: 0, transition: { duration: 0.1 } }
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
    transition: { staggerChildren: 0.05, staggerDirection: -1 }
  },
  visible: {
    transition: { delayChildren: 0.1, staggerChildren: 0.08 }
  }
};

const LIST_ITEM_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.6, ease: EASE_SMOOTH }
  }
};

// --- COMPONENTE PRINCIPAL ---
export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('bienvenida');
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
  const [currentUser, setCurrentUser] = useState<{ isLoaded: boolean; name: string; initials: string; id: string; rol?: string; diaAcceso?: string; cursosAcceso?: string[]; roleCount: number }>({ isLoaded: false, name: 'Administrador', initials: 'AD', id: '', cursosAcceso: [], roleCount: 1 });

  // Presence Notifications


  useEffect(() => {
    // Obtener información del usuario desde el JWT
    const fetchUserProfile = async () => {
      try {
        const res = await fetch('/api/me');
        if (res.ok) {
          const data = await res.json();
          // data incluye: cedula, servidorId, etc

          // commonSelect removido para usar selecciones explícitas con tipado

          if (data.servidorId) {
            // Buscar el nombre usando servidorId
            const { data: servidor } = await supabase
              .from('servidores')
              .select('nombre, id, servidores_roles(rol, dia_acceso, cursos_asignados)')
              .eq('id', data.servidorId)
              .maybeSingle();

            if (servidor && servidor.nombre) {
              const roles = (servidor as any).servidores_roles || [];
              const rolData = roles.find((r: any) => r.rol === 'Administrador' || r.rol === 'Director') || roles[0];

              setCurrentUser({
                isLoaded: true,
                name: servidor.nombre,
                initials: servidor.nombre.substring(0, 2).toUpperCase(),
                id: data.servidorId,
                rol: rolData?.rol,
                diaAcceso: rolData?.dia_acceso,
                cursosAcceso: rolData?.cursos_asignados || [],
                roleCount: data.roleCount || 1
              });
            }
          } else if (data.cedula) {
            // Fallback: buscar por cédula
            const { data: servidor } = await supabase
              .from('servidores')
              .select('nombre, id, servidores_roles(rol, dia_acceso, cursos_asignados)')
              .eq('cedula', data.cedula)
              .maybeSingle();

            if (servidor && servidor.nombre) {
              const roles = (servidor as any).servidores_roles || [];
              const rolData = roles.find((r: any) => r.rol === 'Administrador' || r.rol === 'Director') || roles[0];

              setCurrentUser({
                isLoaded: true,
                name: servidor.nombre,
                initials: servidor.nombre.substring(0, 2).toUpperCase(),
                id: servidor.id,
                rol: rolData?.rol,
                diaAcceso: rolData?.dia_acceso,
                cursosAcceso: rolData?.cursos_asignados || [],
                roleCount: data.roleCount || 1
              });
            }
          }
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
        setCurrentUser(p => ({ ...p, isLoaded: true }));
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
        supabase.from('entrevistas').select('*').order('nombre', { ascending: true }),
        supabase.from('inscripciones').select('id, entrevista_id, curso_id, servidor_id, estado')
      ]);

      // Cargar días asignados de maestros (Primero PTM, luego Academia como fallback)
      const [{ data: ptmDias }, { data: acadDias }] = await Promise.all([
        supabase.from('asignaciones_maestro_ptm').select('servidor_id, dia').eq('vigente', true),
        supabase.from('asignaciones_maestro').select('servidor_id, dia').eq('vigente', true)
      ]);

      const diasMap: Record<string, string> = {};
      // Prioridad 1: Tabla PTM
      if (ptmDias) ptmDias.forEach((d: any) => { diasMap[d.servidor_id] = d.dia; });
      // Prioridad 2: Tabla Academia (solo si no está en PTM)
      if (acadDias) acadDias.forEach((d: any) => { if (!diasMap[d.servidor_id]) diasMap[d.servidor_id] = d.dia; });

      const processedMaestros = (mData as unknown as MaestroDataRaw[] || []).map(m => ({
        ...m,
        obs_count: m.observaciones_count.length > 0 ? m.observaciones_count[0].count : 0,
        // CORRECCIÓN: Buscar específicamente el rol "Maestro Ptm" en el array
        rol: m.servidores_roles.find(r => r.rol === 'Maestro Ptm')?.rol ||
          m.servidores_roles.find(r => r.rol === 'Maestros')?.rol ||
          (m.servidores_roles.length > 0 ? m.servidores_roles[0].rol : null),
        dia_asignado: diasMap[m.id] || null
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

  const estudiantesFiltrados = useMemo(() => {
    // Si no hay info de acceso o rol es Director, mostrar TODO
    if (!currentUser.rol || currentUser.rol === 'Director') return estudiantes;

    // Si diaAcceso es 'Todos' o vacio, mostrar TODO
    if (!currentUser.diaAcceso || currentUser.diaAcceso === 'Todos') return estudiantes;

    // Filtrar por dia contenido en diaAcceso (soporta multiples dias comma-separated)
    return estudiantes.filter(e => e.dia && currentUser.diaAcceso?.includes(e.dia));
  }, [estudiantes, currentUser]);

  const estudiantesPendientesCount = useMemo(() => {
    // Count students that either have no inscription OR have inactive/suspended status
    const activeIds = new Set(
      inscripciones
        .filter(i => (i as any).estado === 'activo' || (i as any).estado === 'promovido')
        .map(i => i.entrevista_id)
    );
    // Usar la lista filtrada para el conteo también
    return estudiantesFiltrados.filter(e => !activeIds.has(e.id)).length;
  }, [estudiantesFiltrados, inscripciones]);

  const promovidosCount = useMemo(() => {
    return inscripciones.filter(i => (i as any).estado === 'promovido').length;
  }, [inscripciones]);

  // Filtro centralizado de maestros visibles (lógica compartida con PanelGestionarMaestros)
  const maestrosVisibles = useMemo(() => {
    return maestros.filter(m => {
      // 1. Filtro base: Solo Maestro Ptm (coincidiendo con visual)
      if (m.rol !== 'Maestro Ptm') return false;

      // 2. Filtro por rol y cursos (Director ve todos)
      if (!currentUser.rol || currentUser.rol === 'Director') {
        // Pasa
      } else {
        if (currentUser.cursosAcceso && currentUser.cursosAcceso.length > 0) {
          const pasaCursos = m.asignaciones.length === 0 || m.asignaciones.some(a => currentUser.cursosAcceso?.includes(a.cursos?.nombre || ''));
          if (!pasaCursos) return false;
        }
      }

      // 3. Filtro por día
      const diaAcceso = currentUser.diaAcceso;
      if (!diaAcceso || diaAcceso === 'Todos') {
        return true;
      } else {
        const diasUsuario = diaAcceso.split(',').map(d => d.trim());
        if (!m.dia_asignado) return true;
        return diasUsuario.includes(m.dia_asignado);
      }
    });
  }, [maestros, currentUser]);

  // Cálculo de estadísticas para el Dashboard en tiempo real
  const dashboardStats = useMemo<DashboardStats>(() => {
    // 1. Totales Básicos
    const totalEstudiantes = estudiantes.length;
    // Usamos maestrosVisibles para coherencia visual, filtrando activos
    const totalMaestros = maestrosVisibles.filter(m => m.activo).length;

    // 2. Estado Académico
    const inscripcionesActivas = inscripciones.filter((i: any) => i.estado === 'activo');
    const estudiantesActivos = inscripcionesActivas.length;
    const promovidos = inscripciones.filter((i: any) => i.estado === 'promovido' || i.estado === 'graduado').length;

    // 3. Distribución por Curso (basada en inscripciones activas)
    const conteoPorCurso: Record<number, number> = {};
    inscripcionesActivas.forEach((i: any) => {
      const cId = i.curso_id;
      conteoPorCurso[cId] = (conteoPorCurso[cId] || 0) + 1;
    });

    const distribucion = cursos.map(c => ({
      label: c.nombre,
      val: conteoPorCurso[c.id] || 0,
      color: c.color,
      id: c.id
    })).sort((a, b) => b.val - a.val);

    return {
      totalEstudiantes,
      totalMaestros,
      estudiantesActivos,
      promovidos,
      promedioNotas: 8.7, // Dato simulado
      tasaAsistencia: 92.3, // Dato simulado
      distribucion
    };
  }, [estudiantes, maestrosVisibles, inscripciones, cursos]);

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

          {/* SIDEBAR (Desktop) - Oculto en vista de bienvenida y dashboard */}
          {activeTab !== 'bienvenida' && activeTab !== 'dashboard' && (
            <aside className="hidden md:flex w-64 flex-col border-r border-white/20 bg-gradient-to-b from-blue-600 via-blue-700 to-indigo-900 backdrop-blur-xl p-4 shadow-2xl z-20">
              <nav className="flex flex-col gap-2 flex-1">
                <TabButton Icon={Home} label="Bienvenida" isActive={false} onClick={() => setActiveTab('bienvenida')} />
                {/* <TabButton Icon={Server} label="Servidores" isActive={activeTab === 'servidores'} onClick={() => setActiveTab('servidores')} /> */}
                <TabButton Icon={Users} label="Maestros" isActive={activeTab === 'maestros'} onClick={() => setActiveTab('maestros')} />
                <TabButton Icon={UserPlus} label="Matriculas" isActive={activeTab === 'matricular'} onClick={() => setActiveTab('matricular')} badge={estudiantesPendientesCount} />

                {/* Ocultar Promovidos para usuarios exclusivos de Restauración 1 */}
                {!(currentUser.cursosAcceso?.length === 1 && currentUser.cursosAcceso[0] === 'Restauración 1' && currentUser.rol !== 'Director') && (
                  <TabButton Icon={GraduationCap} label="Promovidos" isActive={activeTab === 'promovidos'} onClick={() => setActiveTab('promovidos')} badge={promovidosCount} />
                )}

                <TabButton Icon={ClipboardList} label="Estudiantes" isActive={activeTab === 'consultar'} onClick={() => setActiveTab('consultar')} />

                <div className="mt-2 pt-2 border-t border-white/20">
                  <LogoutButton
                    isMultiRole={currentUser.roleCount > 1}
                    className="relative group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-all duration-300 text-white bg-white/10 hover:bg-white/20 hover:shadow-lg hover:shadow-blue-900/20 border border-white/20 w-full"
                    iconClassName="text-blue-200 group-hover:text-white transition-colors"
                    textClassName=""
                  />
                </div>            </nav>
              <div className="mt-auto border-t border-white/20 pt-4 px-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-white font-bold text-sm shadow-inner">{currentUser.initials}</div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white tracking-wide">{currentUser.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)] animate-pulse"></span>
                      <span className="text-[11px] text-blue-100/80 font-medium">En línea</span>
                    </div>
                    {/* Mostrar badge de día si es relevante */}
                    {currentUser.diaAcceso && currentUser.diaAcceso !== 'Todos' && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/30 border border-blue-400/30 text-blue-100 w-fit mt-1">{currentUser.diaAcceso}</span>
                    )}
                  </div>
                </div>
              </div>
            </aside>
          )}

          {/* CONTENIDO PRINCIPAL */}
          <main className="flex-1 relative flex flex-col min-w-0 bg-transparent h-full overflow-hidden">
            {/* Header Móvil */}
            {/* Removido: Título 'Academia' */}

            {/* Area de Contenido con Scroll */}
            <div className="flex-1 overflow-y-auto p-2 md:p-8 md:pb-8 scroll-smooth relative">
              {/* Botón Logout Flotante ELIMINADO */}

              <AnimatePresence mode="wait">
                <motion.div key={activeTab} variants={fadeTransition} initial="hidden" animate="visible" exit="exit" className="h-auto min-h-full flex flex-col">
                  {activeTab === 'bienvenida' && (
                    <WelcomePanelAdmin
                      userName={currentUser.name}
                      userRole={currentUser.rol}
                      onSelectSection={(sectionId) => setActiveTab(sectionId)}
                      onLogout={handleLogout}
                      isMultiRole={currentUser.roleCount > 1}
                      estudiantesPendientesCount={estudiantesPendientesCount}
                      promovidosCount={promovidosCount}
                      currentUser={currentUser}
                      isActive={currentUser.isLoaded}
                    />
                  )}
                  {activeTab === 'dashboard' && (
                    <PanelDashboard
                      onClose={() => setActiveTab('bienvenida')}
                      stats={dashboardStats}
                      estudiantes={estudiantes}
                      inscripciones={inscripciones}
                      fotoUrls={fotoUrls}
                    />
                  )}
                  {/* {activeTab === 'servidores' && <ServidoresPage />} */}
                  {/* NOTA: La pestaña Servidores está oculta - se gestiona desde /panel/servidores */}
                  {activeTab === 'matricular' && (
                    <PanelMatricular
                      maestros={maestros}
                      cursos={cursos.filter(c => !currentUser.rol || currentUser.rol === 'Director' || !currentUser.cursosAcceso || currentUser.cursosAcceso.length === 0 || currentUser.cursosAcceso.includes(c.nombre))}
                      estudiantes={estudiantesFiltrados}
                      inscripciones={inscripciones}
                      onMatriculaExitosa={onDataUpdated}
                      loading={isLoading}
                    />
                  )}
                  {activeTab === 'maestros' && (
                    <PanelGestionarMaestros
                      maestros={maestrosVisibles}
                      loading={isLoading}
                      onCrear={() => setModalMaestro('new')}
                      onEditar={(m) => setModalMaestro(m)}
                      onAsignar={(m) => setModalAsignar(m)}
                      onObs={(m) => setModalObservacion(m)}
                      onDesactivar={(m) => setModalDesactivar(m)}
                      onReactivar={async (m) => {
                        try {
                          await supabase.from('servidores').update({ activo: true }).eq('id', m.id);
                          const { data: existingRole } = await supabase
                            .from('servidores_roles')
                            .select('id')
                            .eq('servidor_id', m.id)
                            .eq('rol', 'Maestro Ptm')
                            .maybeSingle();

                          if (existingRole) {
                            await supabase.from('servidores_roles').update({ vigente: true }).eq('id', existingRole.id);
                          } else {
                            await supabase.from('servidores_roles').insert({ servidor_id: m.id, rol: 'Maestro Ptm', vigente: true });
                          }
                          onDataUpdated();
                        } catch (err: any) {
                          alert('Error al reactivar: ' + err.message);
                        }
                      }}
                    />
                  )}
                  {activeTab === 'promovidos' && (
                    <PanelPromovidos
                      maestros={maestros}
                      cursos={cursos}
                      estudiantes={estudiantes}
                      onDataUpdated={onDataUpdated}
                      loading={isLoading}
                      currentUser={currentUser}
                    />
                  )}
                  {activeTab === 'consultar' && (
                    <PanelConsultarEstudiantes
                      maestros={maestros.filter(m => {
                        const isMaestro = m.rol === 'Maestro Ptm';
                        if (!isMaestro) return false;
                        if (!currentUser.rol || currentUser.rol === 'Director') return true;
                        if (!currentUser.cursosAcceso || currentUser.cursosAcceso.length === 0) return true;
                        return m.asignaciones.length === 0 || m.asignaciones.some(a => currentUser.cursosAcceso?.includes(a.cursos?.nombre || ''));
                      })}
                      cursos={cursos.filter(c => !currentUser.rol || currentUser.rol === 'Director' || !currentUser.cursosAcceso || currentUser.cursosAcceso.length === 0 || currentUser.cursosAcceso.includes(c.nombre))}
                      estudiantes={estudiantes}
                      inscripciones={inscripciones}
                      loading={isLoading}
                      fotoUrls={fotoUrls}
                      onDataUpdated={onDataUpdated}
                      currentUser={currentUser}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Barra de Navegación Móvil (Sticky Bottom) - Solo visible si NO estamos en bienvenida ni dashboard */}
            {activeTab !== 'bienvenida' && activeTab !== 'dashboard' && (
              <div className="md:hidden border-t border-white/20 bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-900 backdrop-blur-xl flex justify-between py-1 px-1 pb-safe shrink-0 z-30 shadow-[0_-5px_20px_rgba(30,58,138,0.5)]">
                <MobileTab Icon={Home} label="Inicio" isActive={false} onClick={() => setActiveTab('bienvenida')} />
                {/* <MobileTab Icon={Server} label="Servidores" isActive={activeTab === 'servidores'} onClick={() => setActiveTab('servidores')} /> */}
                <MobileTab Icon={Users} label="Maestros" isActive={activeTab === 'maestros'} onClick={() => setActiveTab('maestros')} />
                <MobileTab Icon={UserPlus} label="Matriculas" isActive={activeTab === 'matricular'} onClick={() => setActiveTab('matricular')} badge={estudiantesPendientesCount} />

                {!(currentUser.cursosAcceso?.length === 1 && currentUser.cursosAcceso[0] === 'Restauración 1' && currentUser.rol !== 'Director') && (
                  <MobileTab Icon={GraduationCap} label="Prom." isActive={activeTab === 'promovidos'} onClick={() => setActiveTab('promovidos')} badge={promovidosCount} />
                )}

                <MobileTab Icon={ClipboardList} label="Estudiantes" isActive={activeTab === 'consultar'} onClick={() => setActiveTab('consultar')} />

                {/* Botón de Perfil/Salir integrado */}
                <LogoutButton
                  isMultiRole={currentUser.roleCount > 1}
                  className="relative flex flex-1 flex-col items-center justify-center p-2 rounded-lg active:scale-95 transition-transform text-blue-200/80 hover:text-white hover:bg-white/10"
                  iconClassName="text-blue-200/80 mb-0.5 group-hover:text-white"
                  textClassName="text-[10px] font-medium mt-0.5 text-blue-200/80 text-center leading-tight w-full group-hover:text-white"
                />
              </div>
            )}
          </main>
        </div>
      </div>

      {/* MODALES */}
      <AnimatePresence>
        {(modalMaestro === 'new' || (typeof modalMaestro === 'object' && modalMaestro !== null)) && (
          <ModalCrearEditarMaestro key="modal-maestro" maestroInicial={modalMaestro === 'new' ? null : modalMaestro} currentUser={currentUser} onClose={() => setModalMaestro(null)} onSuccess={() => { setModalMaestro(null); onDataUpdated(); }} />
        )}
        {modalAsignar && (
          <ModalAsignarCursos
            key="modal-asignar"
            maestro={modalAsignar}
            cursosDisponibles={cursos.filter(c => !currentUser.rol || currentUser.rol === 'Director' || !currentUser.cursosAcceso || currentUser.cursosAcceso.length === 0 || currentUser.cursosAcceso.includes(c.nombre))}
            onClose={() => setModalAsignar(null)}
            onSuccess={() => { setModalAsignar(null); onDataUpdated(); }}
          />
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
    <button onClick={onClick} className={`relative group flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium transition-all duration-300 overflow-hidden ${isActive ? 'bg-gradient-to-r from-white/25 to-white/10 text-white shadow-lg border-t border-white/50 border-b border-white/10 backdrop-blur-md' : 'text-blue-100/70 hover:bg-white/10 hover:text-white'}`}>
      {isActive && <div className="absolute inset-0 bg-white/5 pointer-events-none" />}
      <Icon size={20} className={`transition-colors duration-300 ${isActive ? "text-white drop-shadow-md" : "text-blue-300/70 group-hover:text-white"}`} />
      <span className="relative z-10 tracking-wide">{label}</span>
      {isActive && <motion.div layoutId="active-glow" className="absolute left-0 w-1 h-8 bg-white/80 rounded-r-full shadow-[0_0_10px_rgba(255,255,255,0.5)]" />}
      {badge !== undefined && badge > 0 && <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500/90 border border-rose-400/50 px-1 text-[10px] font-bold text-white shadow-lg">{badge}</span>}
    </button>
  );
}

interface MobileTabProps { Icon: LucideIcon; label: string; isActive: boolean; onClick: () => void; badge?: number; }
function MobileTab({ Icon, label, isActive, onClick, badge }: MobileTabProps) {
  return (
    <button onClick={onClick} className="relative flex flex-1 flex-col items-center justify-center p-2 rounded-lg active:scale-95 transition-transform group">
      <div className={`p-1.5 rounded-lg transition-all duration-300 ${isActive ? 'bg-white/20 text-white shadow-[0_0_12px_rgba(255,255,255,0.4)] border border-white/20' : 'text-blue-300/60 group-hover:text-white group-hover:bg-white/10'}`}><Icon size={20} /></div>
      <span className={`text-[10px] font-bold mt-1 text-center leading-tight line-clamp-1 w-full transition-colors ${isActive ? 'text-white drop-shadow-md' : 'text-blue-300/60 group-hover:text-white'}`}>{label}</span>
      {badge !== undefined && badge > 0 && <span className="absolute top-1 right-1/4 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 border border-rose-400 text-[9px] font-bold text-white shadow-lg z-10">{badge}</span>}
      {isActive && <motion.div layoutId="active-mobile-glow" className="absolute inset-x-2 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-white/80 to-transparent shadow-[0_0_8px_rgba(255,255,255,0.8)]" />}
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
  onReactivar: (m: MaestroConCursos) => void;
}
function PanelGestionarMaestros({ maestros, loading, onCrear, onEditar, onAsignar, onObs, onDesactivar, onReactivar }: PanelMaestrosProps) {
  const [search, setSearch] = useState('');
  const filtered = maestros.filter(m => !search || m.nombre.toLowerCase().includes(search.toLowerCase()));

  return (
    <GlassCard className="h-full flex flex-col">
      <motion.div
        className="flex flex-col h-full"
        variants={LIST_WRAPPER_VARIANTS}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={LIST_ITEM_VARIANTS}>
          <CardHeader Icon={Users} title="Gestionar Maestros" subtitle="Administración docente." >
            <button onClick={onCrear} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-md shadow-blue-500/30 flex items-center gap-2"><Plus size={16} /> Nuevo</button>
          </CardHeader>
        </motion.div>

        <motion.div variants={LIST_ITEM_VARIANTS} className="px-6 pt-4 shrink-0">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className={`w-full rounded-lg px-4 py-2 ${GLASS_STYLES.input}`} />
        </motion.div>

        <div className="p-6 flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-10 text-gray-400">
              <Loader2 className="animate-spin mb-2" size={32} />
              <p>Cargando maestros...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 text-gray-400 text-center">
              <div className="bg-gray-100 p-4 rounded-full mb-3">
                <Search size={32} className="text-gray-300" />
              </div>
              <p className="font-bold text-gray-500">No se encontraron maestros</p>
              <p className="text-sm">Intenta ajustar los filtros de búsqueda o crea uno nuevo.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filtered.map(m => (
                <motion.div
                  key={m.id}
                  variants={LIST_ITEM_VARIANTS}
                  initial="hidden"
                  animate="visible"
                  className={`relative p-4 rounded-2xl bg-gradient-to-br from-white/90 via-white/60 to-white/80 border border-white/60 shadow-lg hover:shadow-xl transition-all backdrop-blur-sm ${!m.activo ? 'opacity-60' : ''}`}
                >
                  {/* Badge de estado inactivo */}
                  {!m.activo && (
                    <div className="absolute top-2 right-2">
                      <span className="bg-red-100 text-red-700 text-[9px] font-bold px-2 py-0.5 rounded-full border border-red-300 uppercase tracking-wide">
                        Inactivo
                      </span>
                    </div>
                  )}

                  {/* Layout Horizontal */}
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="h-12 w-12 shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
                      {m.nombre.charAt(0)}
                    </div>

                    {/* Información Principal */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm truncate">{m.nombre}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-gray-600">{m.cedula}</span>
                        {m.asignaciones.length > 0 && (
                          <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200 font-bold">
                            {m.asignaciones[0].cursos?.nombre}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Botones de Comunicación */}
                    {m.telefono && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${m.telefono!.replace(/\s+/g, '')}`; }}
                          className="h-9 w-9 rounded-full bg-white flex items-center justify-center text-sky-600 hover:scale-110 hover:shadow-md transition-all shadow-sm border border-sky-100"
                          title="Llamar"
                        >
                          <Phone size={18} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/${m.telefono!.replace(/\D/g, '')}`, '_blank'); }}
                          className="h-9 w-9 rounded-full bg-white flex items-center justify-center text-emerald-600 hover:scale-110 hover:shadow-md transition-all shadow-sm border border-emerald-100"
                          title="WhatsApp"
                        >
                          <MessageCircle size={18} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Botones de Acción */}
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <PremiumActionButton
                      onClick={() => onObs(m)}
                      Icon={MessageSquarePlus}
                      color="violet"
                      label="OBSERVACIONES"
                      badgeCount={m.obs_count}
                    />
                    <PremiumActionButton
                      onClick={() => onAsignar(m)}
                      Icon={BookOpen}
                      color="amber"
                      label="CURSOS"
                    />
                    <PremiumActionButton
                      onClick={() => onEditar(m)}
                      Icon={Edit2}
                      color="sky"
                      label="EDITAR"
                    />
                    {m.activo ? (
                      <PremiumActionButton
                        onClick={() => onDesactivar(m)}
                        Icon={Trash2}
                        color="rose"
                        label="ELIMINAR"
                      />
                    ) : (
                      <PremiumActionButton
                        onClick={() => onReactivar(m)}
                        Icon={UserCheck2}
                        color="emerald"
                        label="REACTIVAR"
                      />
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
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

export function ModalTemplate({ children, onClose, title, className = "max-w-lg", position = "center" }: { children: React.ReactNode, onClose: () => void, title: string, className?: string, position?: 'center' | 'top' }) {
  const alignClass = position === 'center' ? 'items-center' : 'items-start pt-2 md:pt-4';

  return (
    <div className={`fixed inset-0 z-50 flex justify-center p-4 bg-slate-900/40 backdrop-blur-md ${alignClass}`} onClick={onClose}>
      <motion.div
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={e => e.stopPropagation()}
        className={`relative w-full ${className} rounded-3xl overflow-hidden flex flex-col max-h-[92vh] shadow-2xl border border-white/10`}
        style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)'
        }}
      >
        {/* Gradiente decorativo superior izquierdo - Azul/Índigo */}
        <div
          className="absolute top-0 left-0 w-96 h-96 opacity-30 pointer-events-none blur-3xl"
          style={{
            background: 'radial-gradient(circle at top left, #3b82f6 0%, #6366f1 40%, transparent 70%)'
          }}
        />

        {/* Gradiente decorativo inferior derecho - Violeta/Rosa */}
        <div
          className="absolute bottom-0 right-0 w-80 h-80 opacity-25 pointer-events-none blur-3xl"
          style={{
            background: 'radial-gradient(circle at bottom right, #a855f7 0%, #ec4899 40%, transparent 70%)'
          }}
        />

        {/* Contenido del modal con z-index para estar sobre los gradientes */}
        <div className="relative z-10 flex flex-col h-full bg-white/40 backdrop-blur-xl rounded-3xl overflow-hidden">
          <div className="px-5 py-3 flex justify-between items-center border-b border-white/30 bg-gradient-to-r from-white/50 via-white/30 to-white/50 backdrop-blur-sm shrink-0">
            <h3 className="font-bold text-gray-900 text-lg tracking-tight">{title}</h3>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/60 rounded-full text-gray-600 hover:text-gray-900 transition-all active:scale-95"
            >
              <X size={20} />
            </button>
          </div>
          {children}
        </div>
      </motion.div>
    </div>
  );
}

function ModalCrearEditarMaestro({ maestroInicial, currentUser, onClose, onSuccess }: { maestroInicial: MaestroConCursos | null, currentUser: { name: string; initials: string; id: string; rol?: string; diaAcceso?: string; cursosAcceso?: string[]; roleCount: number }, onClose: () => void, onSuccess: () => void }) {
  const isEdit = !!maestroInicial;
  const [nom, setNom] = useState(maestroInicial?.nombre || '');
  const [ced, setCed] = useState(maestroInicial?.cedula || '');
  const [tel, setTel] = useState(maestroInicial?.telefono || '');
  const [rol, setRol] = useState(maestroInicial?.rol || 'Maestro Ptm');
  const [loading, setLoading] = useState(false);
  const [loadingDiaActual, setLoadingDiaActual] = useState(isEdit);

  // Estados para selector de día
  const [diaSeleccionado, setDiaSeleccionado] = useState<"Domingo" | "Martes" | "Jueves" | "Virtual" | null>(null);
  const [diasHabilitados, setDiasHabilitados] = useState<("Domingo" | "Martes" | "Jueves" | "Virtual")[]>([]);
  const [esSoloLectura, setEsSoloLectura] = useState(false);

  // Cargar día actual del maestro si está en modo edición
  useEffect(() => {
    const cargarDiaActual = async () => {
      if (!isEdit || !maestroInicial?.id) {
        setLoadingDiaActual(false);
        return;
      }

      try {
        // Intentar primero en la tabla PTM
        const { data: ptmData, error: ptmError } = await supabase
          .from('asignaciones_maestro_ptm')
          .select('dia')
          .eq('servidor_id', maestroInicial.id)
          .eq('vigente', true)
          .maybeSingle();

        if (!ptmError && ptmData && ptmData.dia) {
          setDiaSeleccionado(ptmData.dia as any);
        } else {
          // Fallback a tabla normal por si es un registro antiguo
          const { data, error } = await supabase
            .from('asignaciones_maestro')
            .select('dia')
            .eq('servidor_id', maestroInicial.id)
            .eq('vigente', true)
            .maybeSingle();

          if (!error && data && data.dia) {
            setDiaSeleccionado(data.dia as any);
          }
        }
      } catch (err) {
        console.error('Error cargando día del maestro:', err);
      } finally {
        setLoadingDiaActual(false);
      }
    };

    cargarDiaActual();
  }, [isEdit, maestroInicial?.id]);

  // Determinar días habilitados según configuración del usuario
  useEffect(() => {
    const diaAcceso = currentUser.diaAcceso;

    if (!diaAcceso || diaAcceso === "Todos") {
      // Usuario tiene todos los días - puede seleccionar entre los 4
      setDiasHabilitados(["Domingo", "Martes", "Jueves", "Virtual"]);
      setEsSoloLectura(false);
    } else {
      // Parsear días separados por coma (ej: "Domingo,Martes")
      const diasUsuario = diaAcceso
        .split(',')
        .map(d => d.trim())
        .filter(d => ["Domingo", "Martes", "Jueves", "Virtual"].includes(d)) as ("Domingo" | "Martes" | "Jueves" | "Virtual")[];

      if (diasUsuario.length === 0) {
        // Fallback: si no hay días válidos, habilitar todos
        setDiasHabilitados(["Domingo", "Martes", "Jueves", "Virtual"]);
        setEsSoloLectura(false);
      } else if (diasUsuario.length === 1) {
        // Usuario tiene solo 1 día - solo lectura
        setDiasHabilitados(diasUsuario);
        setEsSoloLectura(true);
        // Auto-seleccionar el único día disponible
        if (!isEdit) {
          setDiaSeleccionado(diasUsuario[0]);
        }
      } else {
        // Usuario tiene múltiples días específicos - puede seleccionar entre ellos
        setDiasHabilitados(diasUsuario);
        setEsSoloLectura(false);
      }
    }
  }, [currentUser.diaAcceso, isEdit]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom || !ced) return alert("Nombre y Cédula requeridos");

    // Validar que se haya seleccionado un día
    if (!diaSeleccionado) {
      return alert("Debe seleccionar un día para el maestro");
    }


    setLoading(true);
    try {
      // ===== PASO 1: Crear o Actualizar Servidor =====
      const { data: servidorId, error: rpcError } = await supabase.rpc('fn_upsert_servidor', {
        p_cedula: ced.trim(),
        p_nombre: nom.trim(),
        p_telefono: tel.trim() || null,
        p_email: null
      });

      if (rpcError) throw rpcError;
      if (!servidorId) throw new Error('No se pudo obtener el ID del servidor');

      // ===== PASO 2: Asignar Rol "Maestro Ptm" SIN afectar otros roles =====
      const { data: updateData, error: updateError } = await supabase
        .from('servidores_roles')
        .update({ vigente: true })
        .eq('servidor_id', servidorId)
        .eq('rol', rol)
        .select();

      // Si no se actualizó ninguna fila (rol no existía), insertamos
      if (!updateError && (!updateData || updateData.length === 0)) {
        const { error: insertError } = await supabase
          .from('servidores_roles')
          .insert({
            servidor_id: servidorId,
            rol: rol,
            vigente: true
          });

        if (insertError) {
          console.error(`Error insertando rol ${rol}:`, insertError);
          throw insertError;
        }
      }

      // ===== PASO 3: Marcar asignaciones PTM previas como no vigentes =====
      await supabase
        .from('asignaciones_maestro_ptm')
        .update({ vigente: false })
        .eq('servidor_id', servidorId);

      // ===== PASO 4: Insertar nueva asignación PTM vigente =====
      const { error: errAsig } = await supabase
        .from('asignaciones_maestro_ptm')
        .insert({
          servidor_id: servidorId,
          etapa: 'Restauracion',
          dia: diaSeleccionado,
          vigente: true
        });

      if (errAsig) throw errAsig;

      // IMPORTANTE: cerrar carga ANTES de llamar onSuccess
      setLoading(false);
      onSuccess();
    }
    catch (err: any) {
      console.error('Error al guardar:', err);
      setLoading(false);
      alert("Error al guardar: " + err.message);
    }
  };

  // Mostrar cargando mientras se obtiene el día actual en modo edición
  if (loadingDiaActual) {
    return (
      <ModalTemplate onClose={onClose} title="Editar Maestro">
        <div className="p-6 flex items-center justify-center">
          <Loader2 className="animate-spin text-indigo-600" size={32} />
          <span className="ml-3 text-gray-600">Cargando información...</span>
        </div>
      </ModalTemplate>
    );
  }

  return (
    <ModalTemplate onClose={onClose} title={isEdit ? "Editar Maestro" : "Nuevo Maestro"}>
      <form onSubmit={save} className="p-6 space-y-4 flex-1 overflow-y-auto">
        <FormInput id="n" label="Nombre" value={nom} onChange={setNom} />
        <FormInput id="c" label="Cédula" value={ced} onChange={setCed} />
        <FormInput id="t" label="Teléfono" value={tel} onChange={setTel} placeholder="Ej: 3001234567" />
        <FormInput id="rol-display" label="Rol" value="Maestro Proceso Transformacional" onChange={() => { }} disabled />

        {/* Selector de Día */}
        <div>
          <label className="block text-xs font-bold text-gray-600 uppercase mb-2">
            Día de Servicio *
          </label>

          {esSoloLectura ? (
            // Usuario tiene solo 1 día - mostrar en modo solo lectura
            <div className="px-4 py-2.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm font-semibold flex items-center justify-between">
              <span>{diaSeleccionado || diasHabilitados[0]}</span>
              <span className="text-xs text-indigo-500 font-normal">
                (Asignado automáticamente)
              </span>
            </div>
          ) : (
            // Usuario puede seleccionar entre múltiples días
            <>
              <div className="grid grid-cols-2 gap-2">
                {diasHabilitados.map(dia => (
                  <button
                    key={dia}
                    type="button"
                    onClick={() => setDiaSeleccionado(dia)}
                    className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${diaSeleccionado === dia
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 border-2 border-indigo-600'
                      : 'bg-white/40 border-2 border-white/50 text-gray-800 hover:bg-white/60 hover:border-indigo-200'
                      }`}
                  >
                    {dia}
                  </button>
                ))}
              </div>
              {!diaSeleccionado && (
                <p className="text-xs text-amber-600 mt-2 font-medium">
                  Por favor selecciona un día para continuar
                </p>
              )}
              {diasHabilitados.length < 4 && (
                <p className="text-xs text-gray-500 mt-2">
                  Solo puedes asignar en los días que tienes habilitados
                </p>
              )}
            </>
          )}
        </div>

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
      // IDs de cursos actuales (basado en lo que cargó la página)
      const currentIds = maestro.asignaciones.map(a => a.curso_id);
      // IDs seleccionados en el modal (convertidos a number)
      const newIds = Object.keys(asig).filter(k => asig[k]).map(Number);

      const toAdd = newIds.filter(id => !currentIds.includes(id));
      const toRemove = currentIds.filter(id => !newIds.includes(id));

      const promises = [];

      // 1. RETIRAR CURSOS (DELETE directo)
      if (toRemove.length > 0) {
        console.log('[MAESTROS] Retirando cursos:', toRemove, 'de maestro:', maestro.id);
        // DELETE directo usando clave compuesta (servidor_id + curso_id)
        const removeProm = toRemove.map(async (cursoId) => {
          const result = await supabase
            .from('asignaciones_academia')
            .delete()
            .eq('servidor_id', maestro.id)
            .eq('curso_id', cursoId);

          console.log(`[MAESTROS] DELETE curso ${cursoId}:`, result);
          return result;
        });
        promises.push(...removeProm);
      }

      // 2. AGREGAR CURSOS
      if (toAdd.length > 0) {
        // Para agregar, usamos upsert para mayor robustez en caso de que exista registro previo desactivado
        const upsertRows = toAdd.map(cid => ({
          servidor_id: maestro.id,
          curso_id: cid,
          vigente: true
        }));

        // Upsert requiere validación de conflicto. Si no hay constraint unique (servidor_id, curso_id),
        // upsert podría duplicar. Asumimos que existe. Si falla, el catch lo capturará.
        promises.push(
          supabase.from('asignaciones_academia').upsert(upsertRows, { onConflict: 'servidor_id,curso_id' })
        );
      }

      const results = await Promise.all(promises);

      // Verificar errores en resultados individuales
      const errors = results.filter(r => r.error).map(r => r.error?.message);
      if (errors.length > 0) {
        throw new Error("Errores al guardar: " + errors.join(', '));
      }

      onSuccess();
    } catch (e: any) {
      console.error("Error detallado al guardar asignaciones:", e);
      alert("Error al guardar asignaciones: " + (e.message || JSON.stringify(e)));
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
  const [paso, setPaso] = useState<'seleccion' | 'confirmar-eliminar'>('seleccion');
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleDesactivar = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.from('servidores').update({ activo: false }).eq('id', maestro.id);
      if (error) throw error;
      setLoading(false);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setLoading(false);
      alert("Error al desactivar: " + err.message);
    }
  };

  const handleEliminarDefinitivo = async () => {
    setError('');

    if (password !== '93062015-4') {
      setError('Contraseña administrativa incorrecta.');
      return;
    }

    setLoading(true);
    try {
      // PASO 1: Eliminar asignaciones PTM primero (para evitar FK constraint)
      await supabase
        .from('asignaciones_maestro_ptm')
        .delete()
        .eq('servidor_id', maestro.id);

      // PASO 2: Eliminar asignaciones de academia (si las tiene)
      await supabase
        .from('asignaciones_maestro')
        .delete()
        .eq('servidor_id', maestro.id);

      // PASO 3: Eliminar asignaciones de academia
      await supabase
        .from('asignaciones_academia')
        .delete()
        .eq('servidor_id', maestro.id);

      // PASO 4: Eliminar roles
      await supabase
        .from('servidores_roles')
        .delete()
        .eq('servidor_id', maestro.id);

      // PASO 5: Ahora sí, eliminar el servidor
      const { error } = await supabase.from('servidores').delete().eq('id', maestro.id);
      if (error) throw error;

      setLoading(false);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setLoading(false);
      setError("No se pudo eliminar: " + (err.message || 'Error desconocido.'));
    }
  };

  return (
    <ModalTemplate onClose={onClose} title="Gestionar Baja">
      {paso === 'seleccion' && (
        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
              <UserX size={28} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">¿Qué deseas hacer con {maestro.nombre}?</h3>
              <p className="text-sm text-gray-500">Selecciona el tipo de baja para este maestro.</p>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleDesactivar}
              disabled={loading}
              className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all group text-left"
            >
              <div>
                <span className="block font-bold text-gray-800 group-hover:text-indigo-700">Desactivar Temporalmente</span>
                <span className="block text-xs text-gray-500 mt-1">El registro permance inactivo. Se puede reactivar después.</span>
              </div>
              <div className="h-8 w-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 group-hover:border-indigo-200 group-hover:text-indigo-600">
                {loading ? <Loader2 className="animate-spin" size={16} /> : <UserX size={16} />}
              </div>
            </button>

            <button
              onClick={() => setPaso('confirmar-eliminar')}
              disabled={loading}
              className="w-full flex items-center justify-between p-4 rounded-xl border border-red-100 bg-red-50/30 hover:bg-red-50 hover:border-red-300 transition-all group text-left"
            >
              <div>
                <span className="block font-bold text-red-700">Eliminar Definitivamente</span>
                <span className="block text-xs text-red-600/70 mt-1">Borra todos los datos del sistema. <span className="font-bold">Esta acción no se puede deshacer.</span></span>
              </div>
              <div className="h-8 w-8 rounded-full bg-white border border-red-200 flex items-center justify-center text-red-400 group-hover:text-red-600">
                <Trash2 size={16} />
              </div>
            </button>
          </div>

          <div className="mt-6 flex justify-center">
            <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800 underline">Cancelar</button>
          </div>
        </div>
      )}

      {paso === 'confirmar-eliminar' && (
        <div className="p-6 text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4 animate-bounce">
            <AlertTriangle size={32} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Acción Irreversible</h3>
          <p className="text-gray-600 mb-6 text-sm">
            Para eliminar permanentemente a <b>{maestro.nombre}</b>, por favor ingresa la contraseña de administrador.
          </p>

          <div className="mb-6">
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="Contraseña de Administrador"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-red-500 focus:border-transparent text-center font-mono text-lg"
              autoFocus
            />
            {error && <p className="text-red-600 text-sm mt-2 font-bold animate-pulse">{error}</p>}
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleEliminarDefinitivo}
              disabled={loading || !password}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-red-500/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && <Loader2 className="animate-spin" size={18} />}
              Confirmar Eliminación
            </button>
            <button
              onClick={() => { setPaso('seleccion'); setPassword(''); setError(''); }}
              disabled={loading}
              className="w-full bg-white border border-gray-300 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </ModalTemplate>
  );
}
