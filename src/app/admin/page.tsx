/*
  ARCHIVO: app/admin/page.tsx
  ROL: Panel de Administrador (Contenedor)
  (ACTUALIZADO para importar los estilos de servidores.css)
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
  type LucideIcon
} from 'lucide-react';

// Importamos 'classNames'
import { classNames } from '../restauracion/estudiante/components/academia.utils';

// --- 1. IMPORTAR LOS ESTILOS DEL MÓDULO DE SERVIDORES ---
// Asumiendo que el CSS está en la ruta relativa correcta
// Ajusta esta ruta si es necesario.

// --- FIN DE LA MODIFICACIÓN ---


// --- 2. IMPORTAR EL NUEVO COMPONENTE ---
import GestionServidores from './components/GestionServidores'; 

// --- Tipos de Datos ---
// ... (El resto del archivo es exactamente igual al que te envié) ...
// (Tipos para las pestañas 'Maestros' y 'Matricular')
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
};
type MaestroConCursos = Maestro & {
  asignaciones: AsignacionMaestro[];
  obs_count: number;
};
type Estudiante = {
  id: string;
  nombre: string;
  cedula: string;
};
type Inscripcion = {
  entrevista_id: string;
  curso_id: number;
};

// --- MODIFICAR EL TIPO DE TAB ---
type AdminTab = 'matricular' | 'maestros' | 'servidores'; // <-- Añadir 'servidores'

// --- Animaciones de Framer Motion ---
const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};
const modalVariants = {
  hidden: { scale: 0.9, opacity: 0, y: 50 },
  visible: { scale: 1, opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 30 } },
  exit: { scale: 0.9, opacity: 0, y: 50 },
};

// --- Componente Principal: Panel de Administrador ---
export default function AdminPage() {
  // --- CAMBIAR EL ESTADO INICIAL ---
  const [activeTab, setActiveTab] = useState<AdminTab>('servidores');

  // --- Estados de Datos (Solo para 'Maestros' y 'Matricular') ---
  const [maestros, setMaestros] = useState<MaestroConCursos[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  
  const [loadingMaestros, setLoadingMaestros] = useState(true);
  const [loadingCursos, setLoadingCursos] = useState(true);
  const [loadingEstudiantes, setLoadingEstudiantes] = useState(true);

  // --- Estados de Modales (Solo para 'Maestros') ---
  const [modalMaestro, setModalMaestro] = useState<MaestroConCursos | 'new' | null>(null);
  const [modalAsignar, setModalAsignar] = useState<MaestroConCursos | null>(null);
  const [modalObservacion, setModalObservacion] = useState<MaestroConCursos | null>(null); 

  // --- Carga de Datos (Solo para 'Maestros' y 'Matricular') ---
  // El componente 'GestionServidores' cargará sus propios datos.
  const loadData = useCallback(async () => {
    setLoadingMaestros(true);
    setLoadingCursos(true);
    setLoadingEstudiantes(true);

    const { data: maestrosData, error: maestrosError } = await supabase
      .from('servidores')
      .select(`
        id, nombre, cedula, telefono, email, activo,
        asignaciones:asignaciones_academia (
          id,
          servidor_id,
          curso_id,
          cursos ( nombre, color )
        ),
        observaciones_count:servidores_observaciones!servidor_id(count)
      `)
      .order('nombre', { ascending: true });

    if (maestrosError) {
      console.error("Error cargando maestros:", maestrosError);
    }
    
    const processedMaestros = (maestrosData as unknown as MaestroDataRaw[] || []).map(m => ({
      ...m,
      obs_count: m.observaciones_count.length > 0 ? m.observaciones_count[0].count : 0,
    }));
    
    setMaestros(processedMaestros);
    setLoadingMaestros(false);

    // Cargar Cursos
    const { data: cursosData, error: cursosError } = await supabase
      .from('cursos')
      .select('id, nombre, color')
      .order('orden', { ascending: true });
    
    if (cursosError) console.error("Error cargando cursos:", cursosError);
    setCursos((cursosData as Curso[]) || []);
    setLoadingCursos(false);

    // Cargar Estudiantes
    const { data: estudiantesData, error: estudiantesError } = await supabase
      .from('entrevistas')
      .select('id, nombre, cedula')
      .order('nombre', { ascending: true });

    if (estudiantesError) console.error("Error cargando estudiantes:", estudiantesError);
    setEstudiantes((estudiantesData as Estudiante[]) || []);
    setLoadingEstudiantes(false);

    // Cargar Inscripciones
    const { data: inscripcionesData, error: inscripcionesError } = await supabase
      .from('inscripciones')
      .select('entrevista_id, curso_id');
    
    if (inscripcionesError) console.error("Error cargando inscripciones:", inscripcionesError);
    setInscripciones((inscripcionesData as Inscripcion[]) || []);

  }, []);

  useEffect(() => {
    // Solo carga estos datos si la pestaña activa lo requiere
    if (activeTab === 'maestros' || activeTab === 'matricular') {
      loadData();
    }
  }, [loadData, activeTab]);
  
  const onDataUpdated = () => {
    loadData(); 
  };

  const estudiantesPendientesCount = useMemo(() => {
    const cursoRestauracion1 = cursos.find(c => c.nombre === 'Restauración 1');
    if (!cursoRestauracion1) return 0;
    
    const inscritosSet = new Set(
      inscripciones
        .filter(i => i.curso_id === cursoRestauracion1.id)
        .map(i => i.entrevista_id)
    );
    
    const count = estudiantes.filter(e => !inscritosSet.has(e.id)).length;
    return count;

  }, [cursos, estudiantes, inscripciones]);


  return (
    <main className="relative min-h-screen w-full bg-gray-50 p-4 md:p-6 lg:p-8">
      {/* --- Fondo Degradado Premium --- */}
      <div 
        className="absolute inset-0 -z-10 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute left-[50%] top-[-10rem] h-[50rem] w-[80rem] -translate-x-1/2 rounded-full bg-gradient-to-tr from-indigo-100/70 via-sky-100/70 to-purple-100/70 opacity-60 blur-3xl" />
      </div>

      {/* --- Header --- */}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Panel de Administrador
          </h1>
          <p className="mt-1 text-lg text-gray-600">
            Gestiona servidores, maestros y matrículas de la academia.
          </p>
        </div>
      </header>
      
      {/* --- AÑADIR EL NUEVO BOTÓN DE TAB --- */}
      <nav className="flex flex-wrap items-center gap-2 mb-6">
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
      </nav>

      {/* --- AÑADIR EL NUEVO PANEL --- */}
      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            
            // Hacemos que el panel ocupe todo el ancho
            className="w-full" 
          >
            {/* Este es el nuevo panel. Carga tu componente de servidores */}
            {activeTab === 'servidores' && (
              <GestionServidores />
            )}

            {/* Este es el panel original de Matricular */}
            {activeTab === 'matricular' && (
              <PanelMatricular
                maestros={maestros}
                cursos={cursos}
                estudiantes={estudiantes} 
                inscripciones={inscripciones} 
                onMatriculaExitosa={onDataUpdated}
                loading={loadingCursos || loadingEstudiantes || loadingMaestros}
              />
            )}
            
            {/* Este es el panel original de Maestros */}
            {activeTab === 'maestros' && (
              <PanelGestionarMaestros
                maestros={maestros}
                loading={loadingMaestros}
                onCrearMaestro={() => setModalMaestro('new')}
                onEditarMaestro={(m) => setModalMaestro(m)}
                onAsignarCursos={(m) => setModalAsignar(m)}
                onVerObservaciones={(m) => setModalObservacion(m)}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* --- Modales --- */}
      {/* (Estos modales solo pertenecen a la pestaña 'Gestionar Maestros') */}
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
      </AnimatePresence>
      
    </main>
  );
}


/* ======================================================================
  COMPONENTES ANTIGUOS (Para 'Maestros' y 'Matricular')
======================================================================
*/

// --- Componente: Pestaña "Matricular Estudiantes" ---
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

  useEffect(() => {
    const cursoRestauracion1 = cursos.find(c => c.nombre === 'Restauración 1');
    if (cursoRestauracion1) {
      setSelectedCursoId(String(cursoRestauracion1.id));
    }
  }, [cursos]);

  // Maestros que pueden dictar el curso seleccionado
  const maestrosDisponibles = useMemo(() => {
    if (!selectedCursoId) return [];
    const cursoIdNum = parseInt(selectedCursoId);
    return maestros.filter(m => 
      m.asignaciones.some(a => a.curso_id === cursoIdNum)
    );
  }, [selectedCursoId, maestros]);

  // Estudiantes que NO están matriculados en el curso seleccionado
  const estudiantesDisponibles = useMemo(() => {
    if (!selectedCursoId) return [];
    const cursoIdNum = parseInt(selectedCursoId);
    
    const inscritosSet = new Set(
      inscripciones
        .filter(i => i.curso_id === cursoIdNum)
        .map(i => i.entrevista_id)
    );
    
    return estudiantes.filter(e => {
      if (inscritosSet.has(e.id)) return false;
      if (search && !e.nombre.toLowerCase().includes(search.toLowerCase()) && !e.cedula.includes(search)) {
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
        const nuevosRegistrosAsistencia = dataInscripcion.map(insc => ({
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
    <GlassCard>
      <CardHeader
        IconComponent={UserPlus}
        title="Matricular Estudiantes"
        subtitle="Asigna estudiantes a un curso y un maestro."
      />
      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* --- Columna 1: Cursos y Maestros --- */}
        <div className="space-y-4">
          <FormSelect
            label="Paso 1: Seleccionar Curso"
            value={selectedCursoId}
            onChange={(e) => {
              setSelectedCursoId(e.target.value);
              setSelectedMaestroId('');
            }}
          >
            {/* Lógica de negocio: Solo se matricula en Restauración 1 */}
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

          <button
            onClick={handleMatricular}
            disabled={isSaving || !selectedCursoId || !selectedMaestroId || seleccionadosIds.length === 0}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-500/40 active:scale-[0.98] disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <UserCheck size={18} />
            )}
            {isSaving ? "Matriculando..." : `Matricular ${seleccionadosIds.length} Estudiante(s)`}
          </button>
        </div>

        {/* --- Columna 2: Estudiantes --- */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Paso 3: Seleccionar Estudiantes
          </label>
          <div className="relative mb-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o cédula..."
              disabled={!selectedCursoId}
              className="w-full rounded-lg border border-gray-300 bg-white/50 py-2 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            />
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>

          <div className="h-96 overflow-y-auto rounded-lg border border-gray-200 bg-white/30">
            {loading ? ( 
              <div className="p-6 text-center text-gray-500">
                Cargando estudiantes...
              </div>
            ) : !selectedCursoId ? (
              <div className="p-6 text-center text-gray-500">
                Selecciona un curso para ver los estudiantes disponibles.
              </div>
            ) : estudiantesDisponibles.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                {search ? "No hay coincidencias." : "No hay estudiantes pendientes de matricular en este curso."}
              </div>
            ) : (
              <ul className="divide-y divide-gray-200/70">
                {estudiantesDisponibles.map(e => (
                  <li 
                    key={e.id}
                    onClick={() => handleToggleEstudiante(e.id)}
                    className={classNames(
                      "flex items-center gap-3 p-3 cursor-pointer transition-colors",
                      selectedEstudiantes[e.id] ? 'bg-indigo-100/70' : 'hover:bg-gray-50/70'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={!!selectedEstudiantes[e.id]}
                      readOnly
                      className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <p className="font-medium text-gray-900">{e.nombre}</p>
                      <p className="text-sm text-gray-600">C.C. {e.cedula.startsWith('TEMP_') ? 'Temporal' : e.cedula}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

// --- Componente: Pestaña "Gestionar Maestros" ---
function PanelGestionarMaestros({
  maestros,
  loading,
  onCrearMaestro,
  onEditarMaestro,
  onAsignarCursos,
  onVerObservaciones
}: {
  maestros: MaestroConCursos[];
  loading: boolean;
  onCrearMaestro: () => void;
  onEditarMaestro: (maestro: MaestroConCursos) => void;
  onAsignarCursos: (maestro: MaestroConCursos) => void;
  onVerObservaciones: (maestro: MaestroConCursos) => void;
}) {
  const [search, setSearch] = useState('');

  const maestrosFiltrados = useMemo(() => {
    if (!search) return maestros;
    const q = search.toLowerCase();
    return maestros.filter(m => 
      m.nombre.toLowerCase().includes(q) ||
      m.cedula.includes(q)
    );
  }, [search, maestros]);

  return (
    <GlassCard>
      <CardHeader
        IconComponent={Users}
        title="Gestionar Maestros"
        subtitle="Crea, edita, asigna cursos y añade observaciones."
      >
        <button
          onClick={onCrearMaestro}
          className="ml-auto flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-500/40 active:scale-[0.98]"
        >
          <Plus size={18} />
          Crear Maestro
        </button>
      </CardHeader>
      
      {/* --- Barra de Búsqueda --- */}
      <div className="px-6 pt-4 pb-2">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar maestro por nombre o cédula..."
            className="w-full rounded-lg border border-gray-300 bg-white/50 py-2 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      {/* --- Lista de Maestros --- */}
      <div className="p-6">
        {loading ? (
          <div className="flex justify-center items-center py-10">
            <Loader2 size={24} className="animate-spin text-indigo-600" />
            <span className="ml-2 text-gray-600">Cargando maestros...</span>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {maestrosFiltrados.map(maestro => (
              <li key={maestro.id} className="flex flex-col md:flex-row items-start md:items-center justify-between py-4 gap-4">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full bg-gradient-to-br from-indigo-200 to-purple-200 text-indigo-700 font-semibold">
                    {maestro.nombre.split(' ').map(n => n[0]).slice(0, 2).join('')}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{maestro.nombre}</p>
                    <p className="text-sm text-gray-600">C.C. {maestro.cedula}</p>
                  </div>
                </div>
                
                <div className="flex flex-col md:items-end gap-2 w-full md:w-auto">
                  <div className="flex flex-wrap justify-start md:justify-end gap-2">
                    {maestro.asignaciones.length === 0 ? (
                      <span className="text-xs text-gray-500 italic">Sin cursos asignados</span>
                    ) : (
                      maestro.asignaciones.map(asig => (
                        <span 
                          key={asig.id}
                          className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-800"
                        >
                          {asig.cursos?.nombre || 'Curso no encontrado'}
                        </span>
                      ))
                    )}
                  </div>
                  {/* --- (ACTUALIZADO) Grupo de Botones CON el contador --- */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => onVerObservaciones(maestro)}
                      className="relative flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
                    >
                      <MessageSquarePlus size={14} />
                      <span>Observaciones</span>
                      
                      {/* --- (NUEVO) Badge Contador "Premium" --- */}
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
                      className="flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
                    >
                      <Edit2 size={14} />
                      Editar
                    </button>
                    <button
                      onClick={() => onAsignarCursos(maestro)}
                      className="flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
                    >
                      <BookOpen size={14} />
                      Asignar Cursos
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </GlassCard>
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
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !cedula) {
      setError("El nombre y la cédula son obligatorios.");
      return;
    }
    setIsSaving(true);
    setError(null);
    
    try {
      // Usamos la RPC 'fn_upsert_servidor'
      const { error: rpcError } = await supabase.rpc('fn_upsert_servidor', {
        p_cedula: cedula,
        p_nombre: nombre,
        p_telefono: telefono || null,
        p_email: email || null
      });

      if (rpcError) throw rpcError;
      
      onSuccess();
      
    } catch (err: any) {
      console.error("Error guardando maestro:", err);
      if (err.code === '23505') { 
        setError("Ya existe un servidor con esa cédula.");
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        variants={modalVariants}
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={20} />
        </button>
        
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEditMode ? "Editar Maestro" : "Crear Nuevo Maestro"}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {isEditMode 
              ? `Editando el registro de ${maestroInicial.nombre}`
              : "Este maestro será añadido a la tabla `servidores`."
            }
          </p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-6 px-6 pb-6">
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
          
          <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
            {error && <span className="text-sm text-red-600">{error}</span>}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60"
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        variants={modalVariants}
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={20} />
        </button>
        
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900">Asignar Cursos</h2>
          <p className="mt-1 text-sm text-gray-600">
            Selecciona los cursos que <strong className="text-indigo-600">{maestro.nombre}</strong> puede dictar.
          </p>
        </div>
        
        <div className="max-h-60 overflow-y-auto px-6 pb-6 space-y-2">
          {cursosDisponibles.map(curso => (
            <label
              key={curso.id}
              className={classNames(
                "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer",
                asignaciones[curso.id] 
                  ? 'bg-indigo-50 border-indigo-200' 
                  : 'bg-white hover:bg-gray-50 border-gray-200'
              )}
            >
              <input
                type="checkbox"
                checked={!!asignaciones[curso.id]}
                onChange={() => handleToggle(curso.id)}
                className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-medium text-gray-800">{curso.nombre}</span>
            </label>
          ))}
        </div>
        
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSaveAssignments}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60"
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

  // Cargar historial de observaciones
  const loadObservaciones = useCallback(async () => {
    setLoading(true);
    
    // (CORREGIDO) Apunta a 'servidores_observaciones'
    const { data, error } = await supabase
      .from('servidores_observaciones') 
      .select(`
        id,
        created_at,
        observacion, 
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

  // Guardar nueva observación
  const handleSaveObservacion = async () => {
    if (nuevaObs.trim().length === 0) return;
    
    setIsSaving(true);
    
    // (CORREGIDO) Apunta a 'servidores_observaciones'
    const { error } = await supabase
      .from('servidores_observaciones') 
      .insert({
        servidor_id: maestro.id,
        observacion: nuevaObs, 
        // creado_por: adminServidorId // (Opcional: ID del admin logueado)
      });

    if (error) {
      alert("Error al guardar: " + error.message);
    } else {
      setNuevaObs('');
      await loadObservaciones(); // Recargar la lista interna
    }
    setIsSaving(false);
  };

  return (
    <motion.div
      variants={backdropVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        variants={modalVariants}
        className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col"
        style={{ height: 'calc(100vh - 4rem)', maxHeight: '700px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={20} />
        </button>
        
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Observaciones</h2>
          <p className="mt-1 text-sm text-gray-600">
            Historial de observaciones para <strong className="text-indigo-600">{maestro.nombre}</strong>
          </p>
        </div>
        
        {/* Historial (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="text-center text-gray-500">Cargando historial...</div>
          ) : observaciones.length === 0 ? (
            <div className="text-center text-gray-500">No hay observaciones para este maestro.</div>
          ) : (
            observaciones.map(obs => (
              <div key={obs.id} className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <p className="text-sm text-gray-800">{obs.observacion}</p>
                <p className="mt-2 text-xs text-gray-500">
                  {new Date(obs.created_at).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })}
                  {obs.creador && (
                    <span className="font-medium"> - Por: {obs.creador.nombre}</span>
                  )}
                </p>
              </div>
            ))
          )}
        </div>
        
        {/* Formulario para nueva observación */}
        <div className="p-6 bg-gray-50 border-t border-gray-200">
          <label htmlFor="nuevaObs" className="block text-sm font-medium text-gray-700">
            Añadir Nueva Observación
          </label>
          <textarea
            id="nuevaObs"
            value={nuevaObs}
            onChange={(e) => setNuevaObs(e.target.value)}
            rows={3}
            className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="Escribe una nota sobre el maestro..."
          />
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={handleSaveObservacion}
              disabled={isSaving || nuevaObs.trim().length === 0}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60"
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


// --- Componentes de UI Genéricos ---

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
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm disabled:bg-gray-100 py-3"
      />
    </div>
  );
}

function FormSelect({ 
  label, 
  value, 
  onChange, 
  disabled = false,
  children 
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm disabled:opacity-60 py-3"
      >
        {children}
      </select>
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
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        "relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200",
        isActive
          ? "bg-white text-indigo-600 shadow-md"
          : "text-gray-600 hover:bg-white/60 hover:text-gray-900"
      )}
    >
      <IconComponent size={18} />
      {label}

      {/* --- Badge "Premium" con Animación --- */}
      <AnimatePresence>
        {badgeCount && badgeCount > 0 && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="
              absolute -top-2 -right-2 
              flex items-center justify-center 
              min-w-[22px] h-5 px-1.5 
              rounded-full 
              bg-gradient-to-r from-pink-500 to-rose-500 
              text-white text-xs font-bold 
              shadow-lg shadow-rose-500/50 
              ring-2 ring-white
            "
          >
            {badgeCount}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full rounded-2xl bg-white/60 backdrop-blur-lg shadow-xl ring-1 ring-black/5 overflow-hidden">
      {children}
    </div>
  );
}

function CardHeader({
  IconComponent,
  title,
  subtitle,
  children
}: {
  IconComponent: LucideIcon;
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/80 bg-white/50 p-4 md:p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg">
          <IconComponent size={24} />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-600">{subtitle}</p>
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