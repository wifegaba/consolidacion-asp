/*
  ARCHIVO: app/admin/page.tsx
  ROL: Panel de Administrador (Contenedor)
  
  (REFACTORIZADO: Estilo visual 'Liquid Glass' - Indigo Premium)
  
  Notas del desarrollador:
  - Se implementa un tema 'Liquid Glass' sobre un fondo
    índigo/azul profundo y premium.
  - El fondo es un 'motion.div' animado con 'transform' (acelerado por GPU)
    para máxima fluidez y rendimiento.
  - La animación es una deriva sutil de 40s (repeatType: mirror).
  - Todos los paneles (sidebar, cards, modales)
    mantienen el efecto translúcido 'Liquid Glass'.
*/
'use client';

// --- Imports ---
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  UserPlus, 
  Server, 
  Search, 
  Plus,
  X,
  Loader2,
  Check,
  UserCheck,
  Edit2,
  Trash2,
  BookOpen,
  MessageSquarePlus, 
  type LucideIcon,
  ChevronDown,
  AlertTriangle,
  ClipboardList,
  UserX,
  UserCheck2,
  Settings, 
  LayoutDashboard 
} from 'lucide-react';

import { classNames } from '../restauracion/estudiante/components/academia.utils';
import GestionServidores from './components/GestionServidores';

// --- Tipos de Datos (Sin cambios) ---
type Observacion = {
  id: string;
  observacion: string; 
  created_at: string;
  creador: {
    nombre: string;
  } | null;
};
type Maestro = {
  id: string;
  nombre: string;
  cedula: string;
  telefono: string | null;
  email: string | null;
  activo: boolean;
};
type Curso = {
  id: number;
  nombre: string;
  color: string;
};
type AsignacionMaestro = {
  id: string; 
  servidor_id: string;
  curso_id: number;
  cursos: Pick<Curso, 'nombre' | 'color'> | null;
};
type MaestroDataRaw = Maestro & {
  asignaciones: AsignacionMaestro[];
  observaciones_count: { count: number }[];
  servidores_roles: { rol: string }[];
};
type MaestroConCursos = Maestro & {
  asignaciones: AsignacionMaestro[];
  obs_count: number;
  rol: string | null;
};
type Estudiante = {
  id: string;
  nombre: string;
  cedula: string;
};
type Inscripcion = {
  entrevista_id: string;
  curso_id: number;
  servidor_id: string | null;
  cursos?: Pick<Curso, 'nombre' | 'color'> | null;
};
type EstudianteInscrito = Estudiante & {
  maestro: MaestroConCursos | null;
  curso: Curso | null;
  inscripcion_id: string | null;
};
type AdminTab = 'matricular' | 'maestros' | 'servidores' | 'consultar';

// --- Animaciones de Framer Motion (Sin cambios) ---
const backdropVariants = {
  hidden: { opacity: 0, backdropFilter: 'blur(0px)', background: 'rgba(255, 255, 255, 0)' },
  visible: { opacity: 1, backdropFilter: 'blur(4px)', background: 'rgba(255, 255, 255, 0.8)' },
};
const modalVariants = {
  hidden: { scale: 0.9, opacity: 0 },
  visible: { scale: 1, opacity: 1, transition: { type: 'spring' as const, stiffness: 300, damping: 30 } },
  exit: { scale: 0.9, opacity: 0 },
};

// --- Animación de Barrido (Entrada) - (Sin cambios) ---
const premiumSweepInVariants = {
  hidden: { 
    opacity: 0, 
    x: -30 
  },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { 
      duration: 0.4
    }
  },
  exit: { 
    opacity: 0, 
    x: 30,
    transition: { 
      duration: 0.3
    }
  }
};

// --- Componente Principal: Panel de Administrador ---
export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('servidores');

  const [maestros, setMaestros] = useState<MaestroConCursos[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);

  // --- Estados de Modales (Sin cambios) ---
  const [modalMaestro, setModalMaestro] = useState<MaestroConCursos | 'new' | null>(null);
  const [modalAsignar, setModalAsignar] = useState<MaestroConCursos | null>(null);
  const [modalObservacion, setModalObservacion] = useState<MaestroConCursos | null>(null); 
  const [modalDesactivar, setModalDesactivar] = useState<MaestroConCursos | null>(null);

  // --- Carga de Datos (Lógica sin cambios) ---
  const loadData = useCallback(async () => {
    setIsLoading(true);

    const [
      { data: maestrosData, error: maestrosError },
      { data: cursosData, error: cursosError },
      { data: estudiantesData, error: estudiantesError },
      { data: inscripcionesData, error: inscripcionesError }
    ] = await Promise.all([
      supabase
        .from('servidores')
        .select(`
          id, nombre, cedula, telefono, email, activo,
          asignaciones:asignaciones_academia (
            id, servidor_id, curso_id,
            cursos ( nombre, color )
          ),
          observaciones_count:servidores_observaciones!servidor_id(count),
          servidores_roles ( rol )
        `)
        .order('nombre', { ascending: true }),
      supabase
        .from('cursos')
        .select('id, nombre, color')
        .order('orden', { ascending: true }),
      supabase
        .from('entrevistas')
        .select('id, nombre, cedula')
        .order('nombre', { ascending: true }),
      supabase
        .from('inscripciones')
        .select('entrevista_id, curso_id, servidor_id')
        .eq('estado', 'activo')
    ]);

    if (maestrosError) console.error("Error cargando maestros:", maestrosError);
    if (cursosError) console.error("Error cargando cursos:", cursosError);
    if (estudiantesError) console.error("Error cargando estudiantes:", estudiantesError);
    if (inscripcionesError) console.error("Error cargando inscripciones:", inscripcionesError);

    const processedMaestros = (maestrosData as unknown as MaestroDataRaw[] || []).map(m => ({
      ...m,
      obs_count: m.observaciones_count.length > 0 ? m.observaciones_count[0].count : 0,
      rol: m.servidores_roles.length > 0 ? m.servidores_roles[0].rol : null,
    }));
    
    setMaestros(processedMaestros);
    setCursos((cursosData as Curso[]) || []);
    setEstudiantes((estudiantesData as Estudiante[]) || []);
    setInscripciones((inscripcionesData as Inscripcion[]) || []);

    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'maestros' || activeTab === 'matricular' || activeTab === 'consultar') {
      loadData();
    }
  }, [loadData, activeTab]);
  
  const onDataUpdated = () => {
    loadData(); 
  };

  const estudiantesPendientesCount = useMemo(() => {
    const inscritosSet = new Set(
      inscripciones.map(i => i.entrevista_id)
    );
    const count = estudiantes.filter(e => !inscritosSet.has(e.id)).length;
    return count;
  }, [estudiantes, inscripciones]);


  return (
    <>
      {/* --- REFACTOR VISUAL: Fondo Azul Claro Premium (ESTÁTICO) --- */}
      <div
        className="fixed inset-0 z-[-1] overflow-hidden"
        style={{
          // Fondo azul claro premium (sutil)
          background: 'linear-gradient(180deg, #bfdbfe 0%, #c4b5fd 100%)',
          backgroundSize: 'cover',
        }}
      />
    
      {/* --- REFACTOR VISUAL: Estilos Globales (fondo de respaldo) --- */}
      <style jsx global>{`
        body {
          font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          /* Fondo sólido de respaldo (premium indigo).
            El fondo real es el motion.div animado.
          */
          /* Cambiado a un fondo azul claro premium y sin animación */
          background: linear-gradient(180deg, #bfdbfe 0%, #c4b5fd 100%);
          color: #1a1a1a; /* Texto oscuro por defecto para mejor contraste */
          
          /* ================================================= */
          /* CAMBIO 1: Permite scroll en el body principal para evitar que la tarjeta sea recortada */
          overflow: auto;
          /* ================================================= */
        }

        /* Se elimina @keyframes gradientAnimation */

        /* Placeholder con mejor contraste sobre el vidrio */
        ::placeholder {
          color: rgba(0, 0, 0, 0.5) !important;
        }
      `}</style>
    
      {/* --- REFACTOR VISUAL: Layout principal 'Liquid Glass' --- */}
      {/* ================================================= */}
      {/* CAMBIO 2: 'min-h-screen' -> 'h-screen'            */}
      {/* ================================================= */}
        <div className="page-wrapper flex items-start justify-center min-h-screen w-full p-6 pt-4 text-gray-900">
          <div className="super-card mx-auto w-full max-w-[1400px] rounded-3xl bg-white/25 backdrop-blur-xl border border-white/40 shadow-2xl p-4 flex flex-col md:flex-row md:items-center overflow-hidden max-h-[calc(100vh-4rem)] min-h-[620px] md:min-h-[620px]">
            <div className="layout-grid flex flex-col md:flex-row w-full h-full gap-4 min-h-0 items-start md:items-center">
              {/* Sidebar vertical para md y superior */}
              <aside className="sidebar hidden md:flex flex-col w-56 flex-shrink-0 h-full items-stretch bg-white/30 backdrop-blur-xl p-4 md:p-4 border-r border-white/50 shadow-sm overflow-hidden rounded-l-3xl">
                <div className="flex md:flex-col gap-2">
                  <TabButton
                    IconComponent={Server}
                    label="Gestionar Servidores"
                    isActive={activeTab === 'servidores'}
                    onClick={() => setActiveTab('servidores')}
                  />
                  <TabButton
                    IconComponent={Users}
                    label="Gestionar Maestros"
                    isActive={activeTab === 'maestros'}
                    onClick={() => setActiveTab('maestros')}
                  />
                  <TabButton
                    IconComponent={UserPlus}
                    label="Matricular Estudiantes"
                    isActive={activeTab === 'matricular'}
                    onClick={() => setActiveTab('matricular')}
                    badgeCount={estudiantesPendientesCount > 0 ? estudiantesPendientesCount : 0}
                  />
                  <TabButton
                    IconComponent={ClipboardList}
                    label="Consultar Estudiantes"
                    isActive={activeTab === 'consultar'}
                    onClick={() => setActiveTab('consultar')}
                  />
                </div>
                <div className="flex-grow"></div>
                {/* Eliminada pestaña Configuración */}
              </aside>

              {/* Sidebar horizontal fijo abajo solo para móviles */}
              <aside className="sidebar-mobile md:hidden fixed bottom-0 left-0 w-full bg-white/40 backdrop-blur-xl border-t border-white/50 shadow-lg flex flex-row items-center justify-around px-2 py-2 z-40">
                <TabButton
                  IconComponent={Server}
                  label="Servidores"
                  isActive={activeTab === 'servidores'}
                  onClick={() => setActiveTab('servidores')}
                />
                <TabButton
                  IconComponent={Users}
                  label="Maestros"
                  isActive={activeTab === 'maestros'}
                  onClick={() => setActiveTab('maestros')}
                />
                <TabButton
                  IconComponent={UserPlus}
                  label="Matricular"
                  isActive={activeTab === 'matricular'}
                  onClick={() => setActiveTab('matricular')}
                  badgeCount={estudiantesPendientesCount > 0 ? estudiantesPendientesCount : 0}
                />
                <TabButton
                  IconComponent={ClipboardList}
                  label="Consultar"
                  isActive={activeTab === 'consultar'}
                  onClick={() => setActiveTab('consultar')}
                />
                {/* Eliminada pestaña Configuración en móvil */}
              </aside>

        {/* --- REFACTOR VISUAL: Panel de Contenido Principal (Transparente) --- */}
        {/* ESTE 'overflow-y-auto' ahora funciona como se espera */}
          <main className="content flex-1 p-6 md:p-8 overflow-y-auto bg-transparent min-h-0 h-full max-h-full flex flex-col">
          
          {/* Contenido de los Paneles (Lógica sin cambios) */}
          <div className="relative overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={premiumSweepInVariants}
                className="w-full" 
              >
                {activeTab === 'servidores' && (
                  <GestionServidores />
                )}

                {activeTab === 'matricular' && (
                  <PanelMatricular
                    maestros={maestros}
                    cursos={cursos}
                    estudiantes={estudiantes} 
                    inscripciones={inscripciones} 
                    onMatriculaExitosa={onDataUpdated}
                    loading={isLoading}
                  />
                )}
                
                {activeTab === 'maestros' && (
                  <PanelGestionarMaestros
                    maestros={maestros.filter(m => m.rol === 'Maestro Ptm')}
                    loading={isLoading}
                    onCrearMaestro={() => setModalMaestro('new')}
                    onEditarMaestro={(m) => setModalMaestro(m)}
                    onAsignarCursos={(m) => setModalAsignar(m)}
                    onVerObservaciones={(m) => setModalObservacion(m)}
                    onDesactivarMaestro={(m) => setModalDesactivar(m)} 
                  />
                )}

                {activeTab === 'consultar' && (
                  <PanelConsultarEstudiantes
                    maestros={maestros}
                    cursos={cursos}
                    estudiantes={estudiantes}
                    inscripciones={inscripciones}
                    loading={isLoading}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
          </main>

        {/* --- Modales (Ahora con estilo 'Liquid Glass') --- */}
        <AnimatePresence>
          {(modalMaestro === 'new' || typeof modalMaestro === 'object' && modalMaestro !== null) && (
            <ModalCrearEditarMaestro
              maestroInicial={modalMaestro === 'new' ? null : modalMaestro}
              onClose={() => setModalMaestro(null)}
              onSuccess={() => {
                setModalMaestro(null);
                onDataUpdated();
              }}
            />
          )}
          {modalAsignar && (
            <ModalAsignarCursos
              maestro={modalAsignar}
              cursosDisponibles={cursos}
              onClose={() => setModalAsignar(null)}
              onSuccess={() => {
                setModalAsignar(null);
                onDataUpdated();
              }}
            />
          )}
          {modalObservacion && (
            <ModalObservaciones
              maestro={modalObservacion}
              onClose={() => {
                setModalObservacion(null);
                onDataUpdated();
              }}
            />
          )}
          {modalDesactivar && (
            <ModalConfirmarDesactivar
              maestro={modalDesactivar}
              onClose={() => setModalDesactivar(null)}
              onSuccess={() => {
                setModalDesactivar(null);
                onDataUpdated();
              }}
            />
          )}
        </AnimatePresence>
          </div>
        </div>
      </div>
    </>
  );
}


/* ======================================================================
  COMPONENTE: "Consultar Estudiantes"
  (REFACTOR VISUAL: 'Liquid Glass' aplicado)
======================================================================
*/

function PanelConsultarEstudiantes({
  maestros,
  cursos,
  estudiantes,
  inscripciones,
  loading
}: {
  maestros: MaestroConCursos[];
  cursos: Curso[];
  estudiantes: Estudiante[];
  inscripciones: Inscripcion[];
  loading: boolean;
}) {
  const [search, setSearch] = useState('');
  const [selectedMaestroId, setSelectedMaestroId] = useState('');

  // Lógica de procesamiento (Sin cambios)
  const estudiantesProcesados = useMemo(() => {
    const maestrosMap = new Map(maestros.map(m => [m.id, m]));
    const cursosMap = new Map(cursos.map(c => [c.id, c]));
    const inscripcionesMap = new Map(inscripciones.map(i => [i.entrevista_id, i]));

    return estudiantes.map(estudiante => {
      const inscripcion = inscripcionesMap.get(estudiante.id);
      if (!inscripcion) {
        return { ...estudiante, maestro: null, curso: null, inscripcion_id: null };
      }
      const maestro = inscripcion.servidor_id ? maestrosMap.get(inscripcion.servidor_id) : null;
      const curso = inscripcion.curso_id ? cursosMap.get(inscripcion.curso_id) : null;
      return {
        ...estudiante,
        maestro: maestro || null,
        curso: curso || null,
        inscripcion_id: inscripcion.entrevista_id,
      };
    });
  }, [estudiantes, inscripciones, maestros, cursos]);

  // Lógica de filtrado (Sin cambios)
  const { pendientes, matriculados } = useMemo(() => {
    const q = search.toLowerCase();
    
    const pendientesFiltrados = estudiantesProcesados.filter(e => {
      if (e.inscripcion_id) return false;
      if (!search) return true;
      return e.nombre.toLowerCase().includes(q) || (e.cedula && e.cedula.includes(q));
    });

    const matriculadosFiltrados = estudiantesProcesados.filter(e => {
      if (!e.inscripcion_id) return false;
      if (selectedMaestroId && e.maestro?.id !== selectedMaestroId) return false;
      if (!search) return true;
      return e.nombre.toLowerCase().includes(q) || (e.cedula && e.cedula.includes(q));
    });

    return { pendientes: pendientesFiltrados, matriculados: matriculadosFiltrados };

  }, [estudiantesProcesados, search, selectedMaestroId]);

  return (
    <PremiumCard>
      <div>
        <CardHeader
          IconComponent={ClipboardList}
          title="Consultar Estudiantes"
          subtitle="Busca y filtra todos los estudiantes inscritos y pendientes."
        />
        
        {/* --- REFACTOR VISUAL: Inputs con estilo 'Liquid Glass' --- */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar estudiante por nombre o cédula..."
              // Estilo 'Liquid Glass' aplicado
              className="w-full rounded-lg border border-white/50 bg-white/40 backdrop-blur-sm py-3 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white/60"
            />
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          </div>
          
          <FormSelect
            label=""
            value={selectedMaestroId}
            onChange={(e) => setSelectedMaestroId(e.target.value)}
          >
            <option value="">Filtrar por Maestro (afecta Matriculados)</option>
            {maestros.filter(m => m.rol === 'Maestro Ptm').map(m => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </FormSelect>
        </div>

        {/* --- REFACTOR VISUAL: Layout de 2 Columnas --- */}
        <div className="p-6 pt-0 grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Columna Izquierda: Pendientes */}
          <div>
            {/* --- REFACTOR VISUAL: Cabecera de columna 'Liquid Glass' --- */}
            <div className="flex items-center gap-3 px-4 py-3 mb-3 rounded-lg bg-gradient-to-br from-white/60 to-white/30 backdrop-blur-sm ring-1 ring-white/30 border border-white/40 shadow-md">
              <UserX className="h-6 w-6 text-gray-600" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Pendientes de Matrícula ({loading ? '...' : pendientes.length})
                </h3>
                <p className="text-sm text-gray-700">Estudiantes sin curso activo.</p>
              </div>
            </div>
            
            {/* --- REFACTOR VISUAL: Contenedor de lista 'Liquid Glass' (inset) --- */}
            <div className="h-96 max-h-[70vh] overflow-y-auto rounded-lg border border-white/50 bg-white/30 shadow-inner-lg">
              {loading ? (
                <LoadingSpinner />
              ) : pendientes.length === 0 ? (
                <EmptyState message={search ? "No hay coincidencias." : "No hay estudiantes pendientes."} />
              ) : (
                <ul className="divide-y divide-white/50">
                  {pendientes.map(e => (
                    <EstudianteListItem key={e.id} estudiante={e} />
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Columna Derecha: Matriculados */}
          <div>
            {/* --- REFACTOR VISUAL: Cabecera de columna 'Liquid Glass' (con acento) --- */}
            <div className="flex items-center gap-3 px-4 py-3 mb-3 rounded-lg bg-gradient-to-br from-white/60 to-white/30 backdrop-blur-sm ring-1 ring-white/30 border border-blue-300 shadow-md">
              <UserCheck2 className="h-6 w-6 text-blue-600" />
              <div>
                <h3 className="text-lg font-semibold text-blue-800">
                  Estudiantes Matriculados ({loading ? '...' : matriculados.length})
                </h3>
                <p className="text-sm text-gray-700">Estudiantes con curso y maestro.</p>
              </div>
            </div>

            {/* --- REFACTOR VISUAL: Contenedor de lista 'Liquid Glass' (inset) --- */}
            <div className="h-96 max-h-[70vh] overflow-y-auto rounded-lg border border-white/50 bg-white/30 shadow-inner-lg">
              {loading ? (
                <LoadingSpinner />
              ) : matriculados.length === 0 ? (
                <EmptyState message={search || selectedMaestroId ? "No hay coincidencias." : "No hay estudiantes matriculados."} />
              ) : (
                <ul className="divide-y divide-white/50">
                  {matriculados.map(e => (
                    <EstudianteListItem key={e.id} estudiante={e} />
                  ))}
                </ul>
              )}
            </div>
          </div>

        </div>
      </div>
    </PremiumCard>
  );
}

// --- Sub-componentes para 'PanelConsultarEstudiantes' ---

function EstudianteListItem({ estudiante }: { estudiante: EstudianteInscrito }) {
  const { nombre, cedula, curso, maestro, inscripcion_id } = estudiante;
  return (
    // --- REFACTOR VISUAL: Hover sutil 'Liquid Glass' ---
    <li className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 p-4 transition-colors hover:bg-white/20">
      <div className="flex items-center gap-3">
        {/* --- REFACTOR VISUAL: Avatar 'Liquid Glass' --- */}
        <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full bg-white/30 text-gray-800 font-semibold">
          {nombre.split(' ').map(n => n[0]).slice(0, 2).join('')}
        </div>
        <div>
          <p className="font-medium text-gray-900">{nombre}</p>
          <p className="text-sm text-gray-700">C.C. {cedula && !cedula.startsWith('TEMP_') ? cedula : 'Temporal'}</p>
        </div>
      </div>
      
      <div className="flex flex-col items-start md:items-end gap-1.5 w-full md:w-auto pl-13 md:pl-0">
        {/* --- REFACTOR VISUAL: Tags adaptados (se mantienen bien) --- */}
        {curso ? (
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
            Curso: {curso.nombre}
          </span>
        ) : (
           <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">
            Pendiente de Matrícula
          </span>
        )}
        
        {maestro ? (
          <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-800">
            Maestro: {maestro.nombre}
          </span>
        ) : (
          inscripcion_id && (
            <span className="text-xs text-gray-500 italic">
              Maestro no asignado
            </span>
          )
        )}
      </div>
    </li>
  );
}

function LoadingSpinner() {
  return (
    <div className="p-6 text-center text-gray-700 flex items-center justify-center h-full">
      <Loader2 size={24} className="animate-spin text-blue-600 mr-2" />
      Cargando datos...
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="p-6 text-center text-gray-700 h-full flex items-center justify-center">
      {message}
    </div>
  );
}

/* ======================================================================
  COMPONENTES: "Matricular Estudiantes"
  (REFACTOR VISUAL: 'Liquid Glass' aplicado)
======================================================================
*/

function PanelMatricular({
  maestros,
  cursos,
  estudiantes,
  inscripciones,
  onMatriculaExitosa,
  loading
} : {
  maestros: MaestroConCursos[];
  cursos: Curso[];
  estudiantes: Estudiante[];
  inscripciones: Inscripcion[];
  onMatriculaExitosa: () => void;
  loading: boolean;
}) {
  const [selectedCursoId, setSelectedCursoId] = useState<string>('');
  const [selectedMaestroId, setSelectedMaestroId] = useState<string>('');
  const [selectedEstudiantes, setSelectedEstudiantes] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');

  // Lógica de carga, filtros y guardado (Sin cambios)
  useEffect(() => {
    const cursoRestauracion1 = cursos.find(c => c.nombre === 'Restauración 1');
    if (cursoRestauracion1) {
      setSelectedCursoId(String(cursoRestauracion1.id));
    }
  }, [cursos]);

  const maestrosDisponibles = useMemo(() => {
    if (!selectedCursoId) return [];
    const cursoIdNum = parseInt(selectedCursoId);
    return maestros.filter(m => 
      m.rol === 'Maestro Ptm' && m.asignaciones.some(a => a.curso_id === cursoIdNum)
    );
  }, [selectedCursoId, maestros]);

  const estudiantesDisponibles = useMemo(() => {
    if (!selectedCursoId) return [];
    const inscritosSet = new Set(
      inscripciones.map(i => i.entrevista_id)
    );
    return estudiantes.filter(e => {
      if (inscritosSet.has(e.id)) return false; 
      if (search && !e.nombre.toLowerCase().includes(search.toLowerCase()) && !(e.cedula && e.cedula.includes(search))) {
        return false;
      }
      return true;
    });
  }, [selectedCursoId, estudiantes, inscripciones, search]);

  const seleccionadosIds = useMemo(() => {
    return Object.entries(selectedEstudiantes).filter(([, v]) => v).map(([k]) => k);
  }, [selectedEstudiantes]);

  const handleToggleEstudiante = (id: string) => {
    setSelectedEstudiantes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleMatricular = async () => {
    if (!selectedCursoId || !selectedMaestroId || seleccionadosIds.length === 0) {
      alert("Por favor, selecciona un curso, un maestro y al menos un estudiante.");
      return;
    }
    setIsSaving(true);

    const nuevosRegistrosInscripcion = seleccionadosIds.map(estudianteId => ({
      entrevista_id: estudianteId,
      curso_id: parseInt(selectedCursoId),
      servidor_id: selectedMaestroId,
      estado: 'activo'
    }));

    try {
      const { data: dataInscripcion, error: errorInscripcion } = await supabase
        .from('inscripciones')
        .insert(nuevosRegistrosInscripcion)
        .select('id');
      
      if (errorInscripcion) throw errorInscripcion;
      
      if (dataInscripcion && dataInscripcion.length > 0) {
        const dataInscripcionTyped = dataInscripcion as { id: number }[];
        const nuevosRegistrosAsistencia = dataInscripcionTyped.map(insc => ({
          inscripcion_id: insc.id,
          asistencias: '{}'
        }));
        await supabase.from('asistencias_academia').insert(nuevosRegistrosAsistencia);
      }

      alert(`¡${seleccionadosIds.length} estudiante(s) matriculado(s) con éxito!`);
      setSelectedEstudiantes({});
      setSelectedMaestroId('');
      onMatriculaExitosa(); 

    } catch (err: any) {
      console.error("Error al matricular:", err);
      alert("Error al matricular: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };
  
  useEffect(() => {
    if (selectedMaestroId && !maestrosDisponibles.some(m => m.id === selectedMaestroId)) {
      setSelectedMaestroId('');
    }
  }, [selectedMaestroId, maestrosDisponibles]);

  return (
    <PremiumCard>
      <CardHeader
        IconComponent={UserPlus}
        title="Matricular Estudiantes"
        subtitle="Asigna estudiantes a un curso y un maestro."
      />
      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Columna 1: Cursos y Maestros */}
        <div className="space-y-4">
          {/* --- REFACTOR VISUAL: Selects con estilo 'Liquid Glass' --- */}
          <FormSelect
            label="Paso 1: Seleccionar Curso"
            value={selectedCursoId}
            onChange={(e) => {
              setSelectedCursoId(e.target.value);
              setSelectedMaestroId('');
            }}
          >
            {cursos.filter(c => c.nombre === 'Restauración 1').map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </FormSelect>

          <FormSelect
            label="Paso 2: Asignar Maestro"
            value={selectedMaestroId}
            onChange={(e) => setSelectedMaestroId(e.target.value)}
            disabled={!selectedCursoId}
          >
            <option value="">{selectedCursoId ? "Selecciona un maestro..." : "Selecciona un curso primero"}</option>
            {maestrosDisponibles.map(m => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </FormSelect>

          {/* --- REFACTOR VISUAL: Botón primario (se mantiene sólido) --- */}
          <button
            onClick={handleMatricular}
            disabled={isSaving || !selectedCursoId || !selectedMaestroId || seleccionadosIds.length === 0}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition-all hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-500/40 active:scale-[0.98] disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <UserCheck size={18} />
            )}
            {isSaving ? "Matriculando..." : `Matricular ${seleccionadosIds.length} Estudiante(s)`}
          </button>
        </div>

        {/* Columna 2: Estudiantes */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Paso 3: Seleccionar Estudiantes
          </label>
          <div className="relative mb-2">
            {/* --- REFACTOR VISUAL: Input de búsqueda 'Liquid Glass' --- */}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o cédula..."
              disabled={!selectedCursoId}
              className="w-full rounded-lg border border-white/50 bg-white/40 backdrop-blur-sm py-2 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
            />
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          </div>

          {/* --- REFACTOR VISUAL: Contenedor de lista 'Liquid Glass' (inset) --- */}
          <div className="h-96 max-h-[70vh] overflow-y-auto rounded-lg border border-white/50 bg-white/30 shadow-inner-lg">
            {loading ? ( 
              <div className="p-6 text-center text-gray-700">
                Cargando estudiantes...
              </div>
            ) : !selectedCursoId ? (
              <div className="p-6 text-center text-gray-700">
                Selecciona un curso para ver los estudiantes disponibles.
              </div>
            ) : estudiantesDisponibles.length === 0 ? (
              <div className="p-6 text-center text-gray-700">
                {search ? "No hay coincidencias." : "No hay estudiantes pendientes de matricular en este curso."}
              </div>
            ) : (
              <ul className="divide-y divide-white/50">
                {estudiantesDisponibles.map(e => (
                  <li 
                    key={e.id}
                    onClick={() => handleToggleEstudiante(e.id)}
                    // --- REFACTOR VISUAL: Estilos de selección y hover 'Liquid Glass' ---
                    className={classNames(
                      "flex items-center gap-3 p-3 cursor-pointer transition-colors",
                      selectedEstudiantes[e.id] 
                        ? 'bg-blue-50/70' // Selección con transparencia
                        : 'hover:bg-white/20'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={!!selectedEstudiantes[e.id]}
                      readOnly
                      className="h-4 w-4 rounded border-gray-400 text-blue-600 focus:ring-blue-500 bg-transparent"
                    />
                    <div>
                      <p className="font-medium text-gray-900">{e.nombre}</p>
                      <p className="text-sm text-gray-700">C.C. {e.cedula && !e.cedula.startsWith('TEMP_') ? e.cedula : 'Temporal'}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </PremiumCard>
  );
}

// --- Componente: Pestaña "Gestionar Maestros" ---
function PanelGestionarMaestros({
  maestros,
  loading,
  onCrearMaestro,
  onEditarMaestro,
  onAsignarCursos,
  onVerObservaciones,
  onDesactivarMaestro 
}: {
  maestros: MaestroConCursos[];
  loading: boolean;
  onCrearMaestro: () => void;
  onEditarMaestro: (maestro: MaestroConCursos) => void;
  onAsignarCursos: (maestro: MaestroConCursos) => void;
  onVerObservaciones: (maestro: MaestroConCursos) => void;
  onDesactivarMaestro: (maestro: MaestroConCursos) => void; 
}) {
  const [search, setSearch] = useState('');

  // Lógica de filtro y mapeo (Sin cambios)
  const maestrosFiltrados = useMemo(() => {
    if (!search) return maestros;
    const q = search.toLowerCase();
    return maestros.filter(m => 
      m.nombre.toLowerCase().includes(q) ||
      m.cedula.includes(q)
    );
  }, [search, maestros]);

  const mapRol = (rol: string | null): string | null => {
    if (rol === 'Contactos') return 'Timoteo';
    if (rol === 'Maestros') return 'Coordinador';
    return rol;
  };

  return (
    <PremiumCard>
      <CardHeader
        IconComponent={Users}
        title="Gestionar Maestros"
        subtitle="Crea, edita, asigna cursos y añade observaciones."
      >
        {/* --- REFACTOR VISUAL: Botón primario (sólido) --- */}
        <button
          onClick={onCrearMaestro}
          className="ml-auto flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition-all hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-500/40 active:scale-[0.98]"
        >
          <Plus size={18} />
          Crear Maestro
        </button>
      </CardHeader>
      
      <div className="px-6 pt-4 pb-2">
        <div className="relative">
          {/* --- REFACTOR VISUAL: Input de búsqueda 'Liquid Glass' --- */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar maestro por nombre o cédula..."
            className="w-full rounded-lg border border-white/50 bg-white/40 backdrop-blur-sm py-2 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white/60"
          />
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        </div>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex justify-center items-center py-10">
            <Loader2 size={24} className="animate-spin text-blue-600" />
            <span className="ml-2 text-gray-700">Cargando maestros...</span>
          </div>
        ) : (
          <ul className="divide-y divide-white/50">
            {maestrosFiltrados.map(maestro => (
              <li key={maestro.id} className="flex flex-col md:flex-row items-start md:items-center justify-between py-4 gap-4">
                <div className="flex items-center gap-4">
                  {/* --- REFACTOR VISUAL: Avatar 'Liquid Glass' --- */}
                  <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full bg-white/30 text-gray-800 font-semibold">
                    {maestro.nombre.split(' ').map(n => n[0]).slice(0, 2).join('')}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{maestro.nombre}</p>
                    <p className="text-sm text-gray-700">
                      C.C. {maestro.cedula} 
                      {/* --- REFACTOR VISUAL: Tag de Rol (se mantiene bien) --- */}
                      {maestro.rol && (
                        <span className="ml-2 rounded-full bg-gray-100/70 px-2 py-0.5 text-xs font-medium text-gray-700">
                          {mapRol(maestro.rol)}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-col md:items-end gap-2 w-full md:w-auto">
                  <div className="flex flex-wrap justify-start md:justify-end gap-2">
                    {maestro.asignaciones.length === 0 ? (
                      <span className="text-xs text-gray-600 italic">Sin cursos asignados</span>
                    ) : (
                      // --- REFACTOR VISUAL: Tags de Curso (se mantienen bien) ---
                      maestro.asignaciones.map(asig => (
                        <span 
                          key={asig.id}
                          className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800"
                        >
                          {asig.cursos?.nombre || 'Curso no encontrado'}
                        </span>
                      ))
                    )}
                  </div>
                  {/* --- REFACTOR VISUAL: Botones secundarios 'Liquid Glass' --- */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => onVerObservaciones(maestro)}
                      className="relative flex items-center gap-1 rounded-lg bg-white/40 border border-white/50 px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-white/60 transition-colors"
                    >
                      <MessageSquarePlus size={14} />
                      <span className="hidden md:inline">Observaciones</span>
                      <AnimatePresence>
                        {maestro.obs_count > 0 && (
                          <motion.span
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            className="
                              absolute -top-2 -right-2 
                              flex items-center justify-center 
                              min-w-[20px] h-5 px-1.5 
                              rounded-full 
                              bg-gradient-to-r from-pink-500 to-rose-500 
                              text-white text-xs font-bold 
                              shadow-lg shadow-rose-500/50 
                              ring-2 ring-white
                            "
                          >
                            {maestro.obs_count}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </button>
                    
                    <button
                      onClick={() => onEditarMaestro(maestro)}
                      className="flex items-center gap-1 rounded-lg bg-white/40 border border-white/50 px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-white/60 transition-colors"
                    >
                      <Edit2 size={14} />
                      <span className="hidden md:inline">Editar</span>
                    </button>
                    <button
                      onClick={() => onAsignarCursos(maestro)}
                      className="flex items-center gap-1 rounded-lg bg-white/40 border border-white/50 px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-white/60 transition-colors"
                    >
                      <BookOpen size={14} />
                      <span className="hidden md:inline">Asignar Cursos</span>
                    </button>

                    {/* --- REFACTOR VISUAL: Botón destructivo 'Liquid Glass' --- */}
                    <button
                      onClick={() => onDesactivarMaestro(maestro)}
                      className="flex items-center gap-1 rounded-lg bg-white/40 border border-white/50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50/50 transition-colors"
                    >
                      <Trash2 size={14} />
                      <span className="hidden md:inline">Desactivar</span>
                    </button>

                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PremiumCard>
  );
}

// --- Componente: Modal "Crear/Editar Maestro" ---
function ModalCrearEditarMaestro({ 
  maestroInicial,
  onClose, 
  onSuccess 
} : {
  maestroInicial: MaestroConCursos | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEditMode = !!maestroInicial;
  
  const [nombre, setNombre] = useState(maestroInicial?.nombre || '');
  const [cedula, setCedula] = useState(maestroInicial?.cedula || '');
  const [telefono, setTelefono] = useState(maestroInicial?.telefono || '');
  const [email, setEmail] = useState(maestroInicial?.email || '');
  
  const rolesDisponibles = [
    'Coordinador',
    'Timoteo',
    'Logistica',
    'Coordinador',
    'Director',
    'Timoteo',
    'Maestro Ptm',
    'Administrador' 
  ];
  const [rol, setRol] = useState(maestroInicial?.rol || 'Maestros');

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lógica de guardado (Sin cambios)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !cedula || !rol) { 
      setError("El nombre, la cédula y el rol son obligatorios.");
      return;
    }
    setIsSaving(true);
    setError(null);
    
    try {
      const { error: rpcError } = await supabase.rpc('fn_guardar_servidor_con_rol', {
        p_cedula: cedula,
        p_nombre: nombre,
        p_telefono: telefono || null,
        p_email: email || null,
        p_rol: rol
      });

      if (rpcError) throw rpcError;
      
      onSuccess();
      
    } catch (err: any) {
      console.error("Error guardando maestro:", err);
      if (err.message.includes('servidores_cedula_key')) { 
        setError("Ya existe un servidor con esa cédula.");
      } else if (err.message.includes('404')) {
         setError("Error: La función 'fn_guardar_servidor_con_rol' no se encontró. (404)");
      } else {
        setError(err.message || "No se pudo guardar el maestro.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      variants={backdropVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
      // --- REFACTOR VISUAL: Backdrop Premium ---
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        variants={modalVariants}
        // --- REFACTOR VISUAL: Contenedor del Modal Blanco Premium ---
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <X size={20} />
        </button>
        
        <div className="p-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditMode ? "Editar Maestro/Servidor" : "Crear Nuevo Maestro/Servidor"}
          </h2>
          <p className="mt-1 text-xs text-gray-700">
            {isEditMode 
              ? `Editando el registro de ${maestroInicial.nombre}`
              : "Este registro se guardará en `servidores` y se le asignará un rol."
            }
          </p>
        </div>
        
        <form onSubmit={handleSubmit}>
          {/* --- REFACTOR VISUAL: Inputs y Selects 'Liquid Glass' --- */}
          <div className="space-y-4 px-6 pb-6">
            <FormInput
              id="nombre"
              label="Nombre Completo"
              value={nombre}
              onChange={setNombre}
              required
            />
            <FormInput
              id="cedula"
              label="Cédula"
              value={cedula}
              onChange={setCedula}
              required
              disabled={isEditMode}
            />
            
            <FormSelect
              label="Rol Asignado"
              value={rol}
              onChange={(e) => setRol(e.target.value)}
              required
            >
              <option value="" disabled={rol !== ""}>Selecciona un rol...</option>
              {rolesDisponibles.map((r, index) => (
                <option key={`${r}-${index}`} value={r}>{r}</option>
              ))}
            </FormSelect>

            <FormInput
              id="telefono"
              label="Teléfono (Opcional)"
              value={telefono}
              onChange={setTelefono}
              type="tel"
            />
            <FormInput
              id="email"
              label="Email (Opcional)"
              value={email}
              onChange={setEmail}
              type="email"
            />
          </div>
          
          {/* --- REFACTOR VISUAL: Footer del Modal 'Liquid Glass' --- */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
            {error && <span className="text-sm text-red-700 mr-auto max-w-xs">{error}</span>}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-white/40 border border-white/50 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-white/60 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-500/30 transition-all hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60"
            >
              {isSaving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              {isSaving ? "Guardando..." : "Guardar Maestro"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// --- Componente: Modal "Asignar Cursos" ---
function ModalAsignarCursos({
  maestro,
  cursosDisponibles,
  onClose,
  onSuccess
}: {
  maestro: MaestroConCursos;
  cursosDisponibles: Curso[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [asignaciones, setAsignaciones] = useState<Record<string, boolean>>(() => {
    const inicial: Record<string, boolean> = {};
    for (const asig of maestro.asignaciones) {
      inicial[asig.curso_id] = true;
    }
    return inicial;
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleToggle = (cursoId: number) => {
    setAsignaciones(prev => ({
      ...prev,
      [cursoId]: !prev[cursoId]
    }));
  };

  // Lógica de guardado (Sin cambios)
  const handleSaveAssignments = async () => {
    setIsSaving(true);
    
    const cursosTargetIds = Object.entries(asignaciones)
      .filter(([, v]) => v)
      .map(([k]) => parseInt(k));
    
    const cursosActualesIds = maestro.asignaciones.map(a => a.curso_id);

    const paraAñadir = cursosTargetIds
      .filter(id => !cursosActualesIds.includes(id))
      .map(curso_id => ({
        servidor_id: maestro.id,
        curso_id: curso_id
      }));
      
    const paraBorrar = maestro.asignaciones
      .filter(asig => !cursosTargetIds.includes(asig.curso_id))
      .map(asig => asig.id);

    try {
      if (paraAñadir.length > 0) {
        const { error } = await supabase.from('asignaciones_academia').insert(paraAñadir);
        if (error) throw error;
      }
      if (paraBorrar.length > 0) {
        const { error } = await supabase.from('asignaciones_academia').delete().in('id', paraBorrar);
        if (error) throw error;
      }
      
      onSuccess();

    } catch (err: any) {
      console.error("Error asignando cursos:", err);
      alert("Error asignando cursos: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      variants={backdropVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-lg"
      onClick={onClose}
    >
      <motion.div
        variants={modalVariants}
        // --- REFACTOR VISUAL: Contenedor del Modal 'Liquid Glass' ---
        className="relative w-full max-w-lg rounded-2xl bg-white/30 backdrop-blur-2xl shadow-2xl overflow-hidden border border-white/50"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <X size={20} />
        </button>
        
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900">Asignar Cursos</h2>
          <p className="mt-1 text-sm text-gray-800">
            Selecciona los cursos que <strong className="text-blue-600">{maestro.nombre}</strong> puede dictar.
          </p>
        </div>
        
        {/* --- REFACTOR VISUAL: Opciones de 'checkbox' estilo 'Liquid Glass' --- */}
        <div className="max-h-60 overflow-y-auto px-6 pb-6 space-y-2">
          {cursosDisponibles.map(curso => (
            <label
              key={curso.id}
              className={classNames(
                "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer",
                asignaciones[curso.id] 
                  ? 'bg-blue-50/70 border-blue-200/50' 
                  : 'bg-white/30 hover:bg-white/50 border-white/50'
              )}
            >
              <input
                type="checkbox"
                checked={!!asignaciones[curso.id]}
                onChange={() => handleToggle(curso.id)}
                className="h-4 w-4 rounded border-gray-400 text-blue-600 focus:ring-blue-500 bg-transparent"
              />
              <span className="font-medium text-gray-800">{curso.nombre}</span>
            </label>
          ))}
        </div>
        
        {/* --- REFACTOR VISUAL: Footer del Modal 'Liquid Glass' --- */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-white/10 border-t border-white/50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/40 border border-white/50 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-white/60 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSaveAssignments}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-500/30 transition-all hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60"
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Check size={16} />
            )}
            {isSaving ? "Guardando..." : "Guardar Asignaciones"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// --- Componente: Modal "Observaciones del Maestro" ---
function ModalObservaciones({
  maestro,
  onClose
}: {
  maestro: MaestroConCursos;
  onClose: () => void;
}) {
  const [observaciones, setObservaciones] = useState<Observacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [nuevaObs, setNuevaObs] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Lógica de carga y guardado (Sin cambios)
  const loadObservaciones = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('servidores_observaciones') 
      .select(`
        id, created_at, observacion, 
        creador:servidores!creado_por ( nombre )
      `)
      .eq('servidor_id', maestro.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("Error cargando observaciones:", error);
      alert("Error cargando observaciones: " + error.message);
    } else {
      setObservaciones(data as any[] as Observacion[]);
    }
    setLoading(false);
  }, [maestro.id]);

  useEffect(() => {
    loadObservaciones();
  }, [loadObservaciones]);

  const handleSaveObservacion = async () => {
    if (nuevaObs.trim().length === 0) return;
    setIsSaving(true);
    
    const { error } = await supabase
      .from('servidores_observaciones') 
      .insert({
        servidor_id: maestro.id,
        observacion: nuevaObs, 
      });

    if (error) {
      alert("Error al guardar: " + error.message);
    } else {
      setNuevaObs('');
      await loadObservaciones();
    }
    setIsSaving(false);
  };

  return (
    <motion.div
      variants={backdropVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-lg"
      onClick={onClose}
    >
      <motion.div
        variants={modalVariants}
        // --- REFACTOR VISUAL: Contenedor del Modal 'Liquid Glass' ---
        className="relative w-full max-w-2xl rounded-2xl bg-white/30 backdrop-blur-2xl shadow-2xl flex flex-col border border-white/50"
        style={{ height: 'calc(100vh - 4rem)', maxHeight: '700px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <X size={20} />
        </button>
        
        <div className="p-6 border-b border-white/50">
          <h2 className="text-xl font-semibold text-gray-900">Observaciones</h2>
          <p className="mt-1 text-sm text-gray-800">
            Historial de observaciones para <strong className="text-blue-600">{maestro.nombre}</strong>
          </p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-black/5">
          {loading ? (
            <div className="text-center text-gray-700">Cargando historial...</div>
          ) : observaciones.length === 0 ? (
            <div className="text-center text-gray-700">No hay observaciones para este maestro.</div>
          ) : (
            // --- REFACTOR VISUAL: Items de observación 'Liquid Glass' (inset) ---
            observaciones.map(obs => (
              <div key={obs.id} className="p-3 rounded-lg bg-white/40 border border-white/50 shadow-sm">
                <p className="text-sm text-gray-800">{obs.observacion}</p>
                <p className="mt-2 text-xs text-gray-600">
                  {new Date(obs.created_at).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })}
                  {obs.creador && (
                    <span className="font-medium"> - Por: {obs.creador.nombre}</span>
                  )}
                </p>
              </div>
            ))
          )}
        </div>
        
        {/* --- REFACTOR VISUAL: Footer del Modal 'Liquid Glass' y textarea --- */}
        <div className="p-6 bg-white/30 border-t border-white/50">
          <label htmlFor="nuevaObs" className="block text-sm font-medium text-gray-700">
            Añadir Nueva Observación
          </label>
          <textarea
            id="nuevaObs"
            value={nuevaObs}
            onChange={(e) => setNuevaObs(e.target.value)}
            rows={3}
            // --- REFACTOR VISUAL: Textarea 'Liquid Glass' ---
            className="mt-1 block w-full rounded-lg border border-white/50 bg-white/40 backdrop-blur-sm shadow-sm text-gray-900 placeholder-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:bg-white/60 sm:text-sm"
            placeholder="Escribe una nota sobre el maestro..."
          />
          <div className="mt-3 flex justify-end">
            {/* --- REFACTOR VISUAL: Botón primario (sólido) --- */}
            <button
              type="button"
              onClick={handleSaveObservacion}
              disabled={isSaving || nuevaObs.trim().length === 0}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-500/30 transition-all hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60"
            >
              {isSaving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Plus size={16} />
              )}
              {isSaving ? "Guardando..." : "Guardar Observación"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}


{/* --- Componente: Modal "Confirmar Desactivar" --- */}
function ModalConfirmarDesactivar({
  maestro,
  onClose,
  onSuccess
}: {
  maestro: MaestroConCursos;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lógica de guardado (Sin cambios)
  const handleConfirmar = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('fn_desactivar_servidor', {
        p_servidor_id: maestro.id
      });
      if (rpcError) throw rpcError;
      onSuccess();
    } catch (err: any) {
      console.error("Error al desactivar maestro:", err);
      setError(err.message || "No se pudo desactivar el servidor.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      variants={backdropVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-lg"
      onClick={onClose}
    >
      <motion.div
        variants={modalVariants}
        // --- REFACTOR VISUAL: Contenedor del Modal 'Liquid Glass' ---
        className="relative w-full max-w-md rounded-2xl bg-white/30 backdrop-blur-2xl shadow-2xl overflow-hidden border border-white/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            {/* --- REFACTOR VISUAL: Icono de alerta 'Liquid Glass' --- */}
            <div className="flex-shrink-0 h-12 w-12 flex items-center justify-center rounded-full bg-red-100/70">
              <AlertTriangle size={24} className="text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Desactivar Servidor
              </h2>
              <p className="mt-1 text-sm text-gray-800">
                ¿Estás seguro de que quieres desactivar a <strong className="text-gray-900">{maestro.nombre}</strong>?
              </p>
              <p className="mt-2 text-sm text-red-700">
                Esta acción lo marcará como inactivo y removerá todas sus asignaciones vigentes. No podrá iniciar sesión.
              </p>
            </div>
          </div>
        </div>
        
        {/* --- REFACTOR VISUAL: Footer del Modal 'Liquid Glass' y botones --- */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-white/10 border-t border-white/50">
          {error && <span className="text-sm text-red-600 mr-auto">{error}</span>}
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg bg-white/40 border border-white/50 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-white/60 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-red-500/30 transition-all hover:bg-red-700 active:scale-[0.98] disabled:opacity-60"
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Trash2 size={16} />
            )}
            {isSaving ? "Desactivando..." : "Sí, Desactivar"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}


/* ======================================================================
  COMPONENTES DE UI GENÉRICOS
  (REFACTOR VISUAL: 'Liquid Glass' aplicado)
======================================================================
*/

function FormInput({ 
  id, 
  label, 
  value, 
  onChange, 
  type = 'text', 
  required = false,
  disabled = false
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {/* --- REFACTOR VISUAL: Input estilo 'Liquid Glass' --- */}
      <input
        type={type}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="mt-0.5 block w-full rounded-lg border border-white/50 bg-white/40 backdrop-blur-sm py-2 px-3 shadow-sm text-sm text-gray-900 placeholder-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white/60 disabled:bg-gray-50/20 disabled:opacity-70"
      />
    </div>
  );
}

function FormSelect({ 
  label, 
  value, 
  onChange, 
  disabled = false,
  required = false,
  children 
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  required?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  // Extract options from children
  const options = React.Children.toArray(children).map((ch: any) => {
    if (!ch || typeof ch !== 'object') return null;
    const val = ch.props?.value ?? '';
    const labelText = ch.props?.children ?? String(val);
    const disabledOpt = !!ch.props?.disabled;
    return { value: String(val), label: labelText, disabled: disabledOpt };
  }).filter(Boolean) as { value: string; label: React.ReactNode; disabled: boolean }[];

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  const handleSelect = (val: string) => {
    // synthesize a change event to preserve existing handlers
    const fakeEvent = { target: { value: val } } as unknown as React.ChangeEvent<HTMLSelectElement>;
    onChange(fakeEvent);
    setOpen(false);
  };

  const selectedLabel = options.find(o => o.value === value)?.label ?? '';

  return (
    <div className={!label ? 'w-full' : ''} ref={rootRef}>
      <label className={classNames(
        "block text-xs font-medium text-gray-700",
        !label ? "sr-only" : "mb-0.5"
      )}>
        {label || 'Seleccionar'} {required && <span className="text-red-500">*</span>}
      </label>

      <div className="relative">
        <button
          type="button"
          onClick={() => { if (!disabled) setOpen(prev => !prev); }}
          disabled={disabled}
          className={classNames(
            "w-full text-left rounded-lg border border-gray-200 px-3 py-2 pr-10 shadow-sm",
            "bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500",
            disabled ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-50'
          )}
        >
          <span className="truncate">{selectedLabel || (options[0]?.label ?? 'Seleccionar')}</span>
          <ChevronDown 
            size={16} 
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" 
          />
        </button>

        {open && (
          <div className="absolute mt-1 left-0 right-0 z-50 rounded-lg bg-white border border-gray-200 shadow-xl max-h-48 overflow-y-auto">
            {options.map(opt => (
              <div
                key={opt.value}
                onClick={() => !opt.disabled && handleSelect(opt.value)}
                className={classNames(
                  'px-3 py-1.5 cursor-pointer text-sm text-gray-900',
                  opt.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50',
                  opt.value === value ? 'bg-blue-50 font-medium' : ''
                )}
              >
                {opt.label}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({ 
  IconComponent,
  label, 
  isActive, 
  onClick,
  badgeCount
}: {
  IconComponent: LucideIcon;
  label: string;
  isActive: boolean;
  onClick: () => void;
  badgeCount?: number;
}) {
  return (
    // --- REFACTOR VISUAL: Botón de Pestaña 'Liquid Glass' (para barra lateral) ---
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        "relative inline-flex w-auto items-center whitespace-nowrap gap-2 rounded-md px-2 py-2 text-sm transition-all duration-200 overflow-hidden",
        isActive
          ? "bg-white/40 text-blue-700 font-semibold shadow-md border border-white/50" // Activo: 'Liquid Glass'
          : "text-gray-800 hover:bg-white/20 hover:text-gray-900" // Inactivo: 'Liquid Glass'
      )}
    >
      {/* --- Pseudo-elemento de barrido de luz (hover) --- */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0"
        animate={{ opacity: isActive ? 0.25 : 0 }}
        whileHover={{ opacity: isActive ? 0.25 : 0.15 }}
        transition={{ duration: 0.35 }}
        style={{ x: '-100%' }}
      />
      
      {/* --- Contenido con animación de barrido --- */}
      <motion.div
        className="relative flex items-center gap-2.5"
        animate={isActive ? { x: 0 } : { x: 0 }}
        initial={{ x: isActive ? -25 : 0 }}
        transition={{ duration: 0.4 }}
      >
        <IconComponent size={18} />
        {label}
        <AnimatePresence>
          {badgeCount && badgeCount > 0 && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className="absolute -top-1 -right-0 flex items-center justify-center min-w-[14px] h-3 px-0.5 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[9px] font-semibold"
            >
              {badgeCount}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </button>
  );
}

function PremiumCard({ children }: { children: React.ReactNode }) {
  // --- REFACTOR VISUAL: Componente 'PremiumCard' (Liquid Glass) ---
  // Reemplaza el estilo opaco por 'Liquid Glass'
  return (
    <div
      className="w-full rounded-2xl shadow-xl overflow-hidden bg-white/30 backdrop-blur-xl border border-white/50 min-h-[520px]"
    >
      {children}
    </div>
  );
}

function CardHeader({
  IconComponent,
  title,
  subtitle,
  children,
  className,
}: {
  IconComponent: LucideIcon;
  title: string;
  subtitle: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    // --- REFACTOR VISUAL: Cabecera 'Liquid Glass' (integrada) ---
    <div className={classNames(
      "flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 md:p-6 rounded-t-2xl bg-gradient-to-br from-indigo-50/30 via-white/70 to-white/50 backdrop-blur-md ring-1 ring-white/30 border-b border-white/60 shadow-sm",
      className
    )}>
      <div className="flex items-start gap-4">
        {/* --- REFACTOR VISUAL: Icono con 'Liquid Glass' --- */}
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-white/40 text-blue-600 shadow-md">
          <IconComponent size={24} />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-800">{subtitle}</p>
        </div>
      </div>
      {children && (
        <div className="w-full md:w-auto flex-shrink-0">
          {children}
        </div>
      )}
    </div>
  );
}