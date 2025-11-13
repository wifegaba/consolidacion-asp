'use client';

// --- CAMBIO: Imports actualizados ---
import React, { useState, useEffect, useRef, useMemo } from 'react';
import '../../panel/panel.css';
import {
  BarChart3,
  Search,
  ArrowLeft,
  X,
  Edit2, // <-- CAMBIO: Importado
  FileText,
  UserCheck,
  Check,
  Phone,
  MessageCircle,
  Loader2,
  Lock, 
} from 'lucide-react'; // <-- Se eliminó UserPlus
import { supabase } from '../../../lib/supabaseClient';
import { useToast } from '../../../components/ToastProvider'; 

// --- CAMBIO: Importar el hook de autenticación ---
import { useAuth } from '../../../hooks/useAuth';

// --- Importaciones de Utils (sin cambios) ---
import {
  Entrevista,
  GradePlaceholder,
  CourseTopic,
  StudentGrades,
  ActiveTab,
  MainPanelState,
  Course,
  classNames,
  bustUrl,
  generateAvatar,
  chunkArray,
} from './components/academia.utils';

// --- Importaciones de Paneles (sin cambios) ---
import { HojaDeVidaPanel } from './components/HojaDeVidaPanel';
import { 
  WelcomePanel, 
  CourseWelcomeMessage 
} from './components/PanelesBienvenida';

// --- TIPO ACTUALIZADO ---
type EstudianteInscrito = Entrevista & {
  inscripcion_id: string;
  estado_inscripcion: string;
};

// ... (Funciones de utilidad iniciales sin cambios) ...
function createDefaultGradePlaceholders(count = 5): GradePlaceholder[] {
  return Array.from({ length: count }).map((_, i) => ({ id: i + 1 }));
}
const initialCourseTopics: CourseTopic[] = [
  { id: 1, title: 'Asistencia', grades: createDefaultGradePlaceholders(12) },
];
const TAB_INDICES: Record<ActiveTab, number> = { hojaDeVida: 1, grades: 2, reports: 3 }; 
const STATE_LEVELS: Record<MainPanelState, number> = { 'welcome': 0, 'courseWelcome': 1, 'creating': 2, 'viewing': 2 };
const fixedContentBg = 'bg-[radial-gradient(1300px_900px_at_95%_5%,rgba(59,130,246,0.35),transparent_70%)]';


/** Página — Panel del Maestro Ptm */
export default function EstudiantePage() {
  // --- CAMBIO: Usar hook de autenticación ---
  const { user, loading: authLoading, error: authError } = useAuth();
  
  // --- Estados ---
  const [activeTab, setActiveTab] = useState<ActiveTab>('hojaDeVida');
  const [prevTab, setPrevTab] = useState<ActiveTab>('hojaDeVida');
  
  const [courses, setCourses] = useState<Course[]>([]); 
  const [students, setStudents] = useState<EstudianteInscrito[]>([]); 
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(true);
  
  const [selectedInscripcionId, setSelectedInscripcionId] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<EstudianteInscrito | null>(null);
  
  const [mainState, setMainState] = useState<MainPanelState>('welcome');
  const [prevMainState, setPrevMainState] = useState<MainPanelState>('welcome');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null); 
  
  // --- CAMBIO: Se eliminó 'isMatriculaOpen' ---
  
  // ... (Estados de notas, refs, etc. sin cambios) ...
  const [courseTopics, setCourseTopics] = useState<CourseTopic[]>([]);
  const [studentGrades, setStudentGrades] = useState<StudentGrades>({});
  const topicsContainerRef = useRef<HTMLDivElement | null>(null);
  const [lastAddedTopicId] = useState<number | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [fotoUrls, setFotoUrls] = useState<Record<string, string | 'loading'>>({});
  // --- CAMBIO: Se eliminó 'pendientesCount' ---
  const toast = useToast(); 
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [isAttendanceModeActive, setIsAttendanceModeActive] = useState(false);
  const [attendanceClassId, setAttendanceClassId] = useState<number | null>(null);
  // ...

  // ... (useMemo de asistenciasPendientes sin cambios) ...
  const asistenciasPendientes = useMemo(() => {
    let count = 0;
    for (const topic of courseTopics) {
      const grades = studentGrades[topic.id] || {};
      for (const placeholder of topic.grades) {
        if (!grades[placeholder.id] || grades[placeholder.id] === '') {
          count++;
        }
      }
    }
    return count;
  }, [studentGrades, courseTopics]);


  // --- CAMBIO: Lógica de Carga Inicial (FILTRADA POR MAESTRO) ---
  useEffect(() => {
    // --- CAMBIO: Guard check para 'user' y 'authLoading' ---
    // No hacer nada si el usuario (maestro) no se ha cargado
    if (authLoading || !user) return; 

    async function loadCourses() {
      setLoadingCourses(true);
      
      // --- CAMBIO: Usar alias singular 'curso:cursos' ---
      const servidorId = user!.servidorId;

      const { data, error } = await supabase
        .from('asignaciones_academia')
        .select(`
          curso_id,
          curso:cursos ( id, nombre, color, orden )
        `)
        .eq('servidor_id', servidorId)
        .eq('vigente', true);
        
      if (error) {
        console.error("Error cargando cursos asignados:", error);
        toast.error("Error al cargar tus cursos.");
        setLoadingCourses(false);
        return;
      }
      
      // --- CAMBIO: Lógica de mapeo corregida para usar 'asig.curso' ---
      // Esto corrige todos los errores 'Property ... does not exist'
      // data can be any[] from Supabase; normalize safely
      const asignaciones = (data as any[]) || [];
      const cursosRaw = asignaciones.map(a => a?.curso).filter(Boolean) as Array<{
        id: number;
        nombre: string;
        color?: string | null;
        orden?: number | null;
      }>;

      const loadedCourses: Course[] = cursosRaw
        .slice()
        .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
        .map(curso => ({ id: curso.id, title: curso.nombre, color: curso.color || 'blue' }));
      // --- FIN CAMBIO ---
        
      setCourses(loadedCourses);
      setLoadingCourses(false);
    }
    
    loadCourses();
  }, [user, authLoading, toast]); // Depende del usuario


  // --- CAMBIO: Se eliminó 'loadPendientesCount' ---

  // ... (getSignedUrlCached, onUpdated, handleHojaDeVidaDelete sin cambios) ...
  async function getSignedUrlCached(path?: string | null) {
    if (!path) return null;
    if (fotoUrls[path]) return fotoUrls[path];
    
    if (fotoUrls[path] === 'loading') {
      await new Promise(r => setTimeout(r, 300));
      return getSignedUrlCached(path);
    }
    
    setFotoUrls((m) => ({ ...m, [path]: 'loading' }));
    
    try {
      const { data } = await supabase.storage
        .from("entrevistas-fotos")
        .createSignedUrl(path, 60 * 10);
      const url = bustUrl(data?.signedUrl) ?? null;
      if (url) {
        setFotoUrls((m) => ({ ...m, [path]: url }));
      }
      return url;
    } catch (e) {
      console.error("Error firmando URL:", e);
      setFotoUrls((m) => ({ ...m, [path]: '' }));
      return null;
    }
  }

  function onUpdated(r: Entrevista & { _tempPreview?: string | null }) {
    setStudents((xs) => xs.map((x) => (x.id === r.id ? { ...x, ...r } : x)));
    setSelectedStudent(prev => prev ? { ...prev, ...r } : null);
    
    if (selectedStudent?.id === r.id) {
      if (r._tempPreview) {
        setSignedUrl(r._tempPreview);
        return;
      }
      if (r.foto_path) {
        supabase.storage
          .from("entrevistas-fotos")
          .createSignedUrl(r.foto_path, 60 * 10)
          .then(({ data }) => {
            const url = bustUrl(data?.signedUrl) ?? null;
            if (url) {
              setFotoUrls((m) => ({ ...m, [r.foto_path as string]: url }));
              if (selectedStudent?.id === r.id) setSignedUrl(url);
            }
          })
          .catch(() => {});
      }
    }
  }

  function handleHojaDeVidaDelete(id: string) {
    setStudents((xs) => xs.filter((x) => x.id !== id));
    setPrevMainState(mainState); 
    setMainState('courseWelcome');
    setSelectedInscripcionId(null);
    setSelectedStudent(null);
  }


  // --- CAMBIO: loadStudents AHORA FILTRA POR MAESTRO ---
  const loadStudents = async (course: Course) => {
    // --- CAMBIO: Guard check para 'user' ---
    if (!user) {
      toast.error("No se pudo identificar al maestro. Refresca la página.");
      return;
    }

    const servidorId = user!.servidorId;

    setLoadingStudents(true);
    setStudents([]);
    setSelectedInscripcionId(null);
    setSelectedStudent(null);
    setFotoUrls({});
  
    try {
      const { data, error } = await supabase
        .from('inscripciones')
        .select(`
          id, 
          estado,
          entrevistas ( * ) 
        `) 
        .eq('curso_id', course.id)
        .eq('servidor_id', servidorId) // <-- EL FILTRO CLAVE
        .order('created_at', { ascending: true }); 

      if (error) {
        console.error("Error cargando estudiantes inscritos:", error);
        throw error;
      }
      
      const loadedStudents: EstudianteInscrito[] = data
        .filter(item => item.entrevistas) 
        .map(item => ({
        ...(item.entrevistas as unknown as Entrevista),
        inscripcion_id: item.id, 
        estado_inscripcion: item.estado,
      }));
      
      setStudents(loadedStudents); 
  
      if (loadedStudents.length > 0) {
        const fotoPaths = [
          ...new Set(loadedStudents.map((s) => s.foto_path).filter(Boolean) as string[]),
        ];

        if (fotoPaths.length > 0) {
          const { data: signedUrlsData, error: signError } = await supabase.storage
            .from("entrevistas-fotos")
            .createSignedUrls(fotoPaths, 60 * 10);

          if (signError) console.error("Error firmando URLs por lotes:", signError);

          if (signedUrlsData) {
            const urlMap = signedUrlsData.reduce(
              (acc, item) => {
                if (item.error) {
                  // console.warn(`Error al firmar path individual: ${item.path}`, item.error);
                } else if (item.signedUrl && item.path) {
                  const signedUrl = item.signedUrl ? bustUrl(item.signedUrl) : null;
                  if (signedUrl) acc[item.path] = signedUrl;
                }
                return acc;
              },
              {} as Record<string, string>
            );
            setFotoUrls(urlMap);
          }
        }
      }
    } catch (error) {
      console.error("Error en loadStudents:", error);
    } finally {
      setLoadingStudents(false);
    }
  };

  const clearDebounceTimer = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  };

  // --- Lógica de Navegación y Estado (sin cambios) ---
  const handleTabClick = (newTab: ActiveTab) => {
    if (newTab !== activeTab) {
      setPrevTab(activeTab);
      setActiveTab(newTab);
    }
  };

  const handleSelectCourse = async (course: Course) => {
    setPrevMainState(mainState); 
    setSelectedCourse(course); 
    setMainState('courseWelcome');
    setSelectedInscripcionId(null);
    setSelectedStudent(null);
    
    const loadedTopics = JSON.parse(JSON.stringify(initialCourseTopics));
    setCourseTopics(loadedTopics);
    setStudentGrades({});
    
    await loadStudents(course); 
  };

  const handleGoBackToWelcome = () => {
    clearDebounceTimer(); 
    setPrevMainState(mainState); 
    setMainState('welcome');
    setSelectedCourse(null);
    setSelectedInscripcionId(null);
    setSelectedStudent(null);
    setCourseTopics([]);
    setStudentGrades({});
    setStudents([]); 
    setSignedUrl(null); 
  };

  const handleGoBackToStudentList = () => {
    clearDebounceTimer(); 
    setPrevMainState(mainState); 
    setMainState('courseWelcome');
    setSelectedInscripcionId(null);
    setSelectedStudent(null);
    setSignedUrl(null); 
  };

  const handleSelectStudent = async (student: EstudianteInscrito) => { 
    clearDebounceTimer(); 
    if (isAttendanceModeActive) {
      toast.error("Termina de tomar la asistencia actual o cancélala para ver a otro estudiante.");
      return;
    }

    setPrevMainState(mainState); 
    setSelectedInscripcionId(student.inscripcion_id); 
    setSelectedStudent(student); 
    setMainState('viewing');
    setActiveTab('hojaDeVida');
    setPrevTab('hojaDeVida');
    
    setSignedUrl(null);
    if (student.foto_path) {
      const url = await getSignedUrlCached(student.foto_path);
      if (url) setSignedUrl(url);
    }

    const { data: asistenciaData, error } = await supabase
      .from('asistencias_academia') 
      .select('asistencias')
      .eq('inscripcion_id', student.inscripcion_id) 
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error("Error cargando asistencias:", error);
    }

    const savedGrades = (asistenciaData?.asistencias as StudentGrades) || {};
    const initialGradesForStudent: StudentGrades = {};
    
    courseTopics.forEach(topic => {
      initialGradesForStudent[topic.id] = {};
      const savedTopicGrades = savedGrades[topic.id] || {};
      
      topic.grades.forEach(gradePlaceholder => {
        initialGradesForStudent[topic.id][gradePlaceholder.id] = 
          savedTopicGrades[gradePlaceholder.id] || '';
      });
    });
    
    setStudentGrades(initialGradesForStudent);
  };

  // --- Lógica de Asistencias (Grades) (sin cambios) ---
  const saveGradesToDb = async (gradesToSave: StudentGrades) => {
    if (!selectedInscripcionId) {
      console.error("No se puede autoguardar, no hay ID de inscripción.");
      return; 
    }
    
    try {
      const { error } = await supabase
        .from('asistencias_academia')
        .upsert({
          inscripcion_id: selectedInscripcionId,
          asistencias: gradesToSave,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'inscripcion_id'
        });

      if (error) throw error;
      toast.success("Asistencia guardada automáticamente");

    } catch (error: unknown) {
      console.error("Error en autoguardado de asistencias:", error);
      const message = error instanceof Error ? error.message : "Error desconocido";
      toast.error("Error de autoguardado: " + message);
    }
  };

  const handleGradeChange = (topicId: number, gradeId: number, value: string) => {
    const newGradesForTopic = { ...(studentGrades[topicId] || {}), [gradeId]: value };
    const newStudentGrades = { ...studentGrades, [topicId]: newGradesForTopic };

    setStudentGrades(newStudentGrades);

    clearDebounceTimer();

    debounceTimerRef.current = setTimeout(() => {
      saveGradesToDb(newStudentGrades);
    }, 750); // 750ms de espera
  };
  
  const handleMarkAttendanceDB = async (inscripcion_id: string, status: 'si' | 'no') => {
    const topicId = 1; // ID 1 es "Asistencia"
    const classId = attendanceClassId;
    
    console.log('handleMarkAttendanceDB called with:', { inscripcion_id, status, topicId, classId });

    if (!classId || !inscripcion_id) {
      const errorMsg = `ID de clase o de inscripción no encontrado. classId: ${classId}, inscripcion_id: ${inscripcion_id}`;
      console.error(errorMsg);
      toast.error(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      console.log('Fetching current grades for inscripcion_id:', inscripcion_id);
      const { data: currentData, error: getError } = await supabase
        .from('asistencias_academia')
        .select('asistencias')
        .eq('inscripcion_id', inscripcion_id)
        .single();
      
      if (getError && getError.code !== 'PGRST116') {
        console.error('Error fetching current grades:', getError);
        throw getError;
      }
      
      const currentGrades = (currentData?.asistencias as StudentGrades) || {};
      console.log('Current grades:', currentGrades);
      
      const newTopicGrades = { ...(currentGrades[topicId] || {}), [classId]: status };
      const newStudentGrades = { ...currentGrades, [topicId]: newTopicGrades };
      console.log('New grades to be saved:', newStudentGrades);

      console.log('Upserting new grades...');
      const { error: upsertError } = await supabase
        .from('asistencias_academia')
        .upsert({
          inscripcion_id: inscripcion_id,
          asistencias: newStudentGrades,
          updated_at: new Date().toISOString()
        }, { onConflict: 'inscripcion_id' });

      if (upsertError) {
        console.error('Error upserting grades:', upsertError);
        throw upsertError;
      }
      
      console.log('Successfully saved attendance for inscripcion_id:', inscripcion_id);
      
    } catch (error: unknown) {
      const e = error as { message?: string };
      console.error('Full error in handleMarkAttendanceDB:', e);
      toast.error(`Error al marcar: ${e.message ?? 'Error desconocido'}`);
      throw error;
    }
  };

  const cancelAttendanceMode = () => {
    setIsAttendanceModeActive(false);
    setAttendanceClassId(null);
  };

  const completeAttendanceMode = () => {
    toast.success("Asistencia finalizada correctamente");
    cancelAttendanceMode();
  };
  
  // --- Helpers de UI (sin cambios) ---
  const getTabPanelClasses = (tabName: ActiveTab): string => {
    const base =
      'w-full h-full flex flex-col min-h-0 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] [grid-area:1/1]';
    
    // activeIndex must reflect the currently active tab (from state),
    // not the tabName of the panel being rendered. Using the wrong
    // value made every panel think it was active.
    const activeIndex = TAB_INDICES[activeTab];
    const prevIndex = TAB_INDICES[prevTab];
    const currentIndex = TAB_INDICES[tabName];

    if (currentIndex === activeIndex) return `${base} opacity-100 translate-x-0 pointer-events-auto`;
    if (currentIndex === prevIndex && activeTab !== prevTab) {
      const exit =
        activeIndex > prevIndex ? '-translate-x-8 scale-[0.985]' : 'translate-x-8 scale-[0.985]';
      return `${base} opacity-0 ${exit} pointer-events-none`;
    }
    const hidden = currentIndex > activeIndex ? 'translate-x-8' : '-translate-x-8';
    return `${base} opacity-0 ${hidden} pointer-events-none`;
  };

  const getContentPanelClasses = (activeStates: MainPanelState | MainPanelState[]): string => {
    const base = 'transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]'; 
    const statesArray = Array.isArray(activeStates) ? activeStates : [activeStates];
    
    const isActive = statesArray.includes(mainState);
    const wasActive = statesArray.includes(prevMainState); 

    const currentLevel = STATE_LEVELS[mainState];
    const prevLevel = STATE_LEVELS[prevMainState];
    const myLevel = statesArray.length > 0 ? STATE_LEVELS[statesArray[0]] : -1; 

    if (isActive) {
      return `${base} opacity-100 translate-x-0 scale-100 pointer-events-auto`;
    } 
    
    if (wasActive && mainState !== prevMainState) {
      const exitDir = (currentLevel > prevLevel) ? '-translate-x-8' : 'translate-x-8';
      return `${base} opacity-0 ${exitDir} scale-[0.985] pointer-events-none`;
    }
    
    const hiddenDir = myLevel > currentLevel ? 'translate-x-8' : '-translate-x-8';
    return `${base} opacity-0 ${hiddenDir} pointer-events-none`;
  };

  useEffect(() => {
    if (!lastAddedTopicId) return;
    const id = lastAddedTopicId;
    requestAnimationFrame(() => {
      const container = topicsContainerRef.current;
      const el = container?.querySelector(`#topic-${id}`) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        container?.scrollBy({ top: -8, left: 0, behavior: 'smooth' });
      }
    });
  }, [lastAddedTopicId]);

  
  const isDetailView = mainState === 'creating' || mainState === 'viewing';
  
  // --- RENDER ---

  // --- CAMBIO: Estado de Carga Global por Autenticación ---
  if (authLoading) {
    return (
      <main className="flex h-screen w-full items-center justify-center bg-gray-100">
        <Loader2 size={32} className="animate-spin text-indigo-600" />
        <span className="ml-3 text-lg font-medium text-gray-700">Verificando sesión...</span>
      </main>
    );
  }
  
  // --- CAMBIO: Estado de Error Global por Autenticación ---
  if (authError || !user) {
     return (
      <main className="flex h-screen w-full items-center justify-center bg-gray-100">
        <div className="flex flex-col items-center gap-4 p-8 bg-white rounded-lg shadow-xl">
          <Lock size={32} className="text-red-500" />
          <h1 className="text-lg font-semibold text-gray-800">Acceso Denegado</h1>
          <p className="text-gray-600">{authError || "No estás autenticado."}</p>
          <a
            href="/login"
            className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700"
          >
            Ir al Login
          </a>
        </div>
      </main>
    );
  }

  // Si todo está bien, renderiza la página del maestro
  return (
    <main
      className="
        relative flex h-screen w-full items-stretch justify-stretch p-0
        text-gray-900 selection:bg-indigo-300/40 selection:text-gray-900
        bg-[conic-gradient(from_210deg_at_50%_0%,#EEF2FF_0%,#FAF5FF_40%,#F9FAFB_85%)]
      "
    >
      {/* ... (Estilos, gradientes, etc. sin cambios) ... */}
      <style>{`
        :root{
          --mac-glass: rgba(255,255,255,0.55);
          --mac-glass-strong: rgba(255,255,255,0.70);
        }
        @keyframes slide-in-left {
          from { transform: translateX(-100%); opacity: 0; flex-basis: 0; }
          to   { transform: translateX(0); opacity: 1; flex-basis: 25%; }
        }
        @media (min-width: 768px) {
          .md\\:animate-slide-in-left { 
            animation: slide-in-left 0.6s cubic-bezier(0.32,0.72,0,1) forwards; 
          }
        }
        @media (min-width: 768px) and (max-width: 1024px) {
          .md\\:animate-slide-in-left { animation-name: slide-in-left-md; }
          @keyframes slide-in-left-md {
            from { flex-basis: 0; } to { flex-basis: 33.333333%; }
          }
        }
        
        html { scroll-behavior: smooth; }
        @media (prefers-reduced-motion: reduce) {
          * { 
            animation-duration: 0.01ms !important; 
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important; 
            scroll-behavior: auto !important;
          }
        }
        
        html { scroll-behavior: smooth; }
        @media (prefers-reduced-motion: reduce) {
          * { 
            animation-duration: 0.01ms !important; 
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important; 
            scroll-behavior: auto !important; 
          }
        }

        .chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.5rem 1.25rem;
          border-radius: 9999px;
          font-size: 0.95rem;
          font-weight: 700;
          border: 1.5px solid transparent;
          transition: all 0.2s ease-out;
          cursor: pointer;
          user-select: none;
        }
        .chip[data-checked="false"] {
          color: #374151; background-color: #ffffff; border-color: #E5E7EB;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.03), 0 2px 4px -2px rgba(0, 0, 0, 0.03);
        }
        .chip[data-checked="false"]:hover {
          background-color: #F9FAFB; border-color: #D1D5DB;
        }
        .chip[data-checked="true"] {
          color: #ffffff;
          background-image: linear-gradient(to right, #3B82F6, #60A5FA);
          border-color: transparent;
          box-shadow: 0 8px 15px -3px rgba(59, 130, 246, 0.25), 0 3px 6px -3px rgba(59, 130, 246, 0.2);
        }
        .chip[data-checked="true"]:hover { filter: brightness(1.1); }
        .chip:focus-visible { outline: none; ring: 4px; ring-color: rgba(96, 165, 250, 0.4); }
        .chip[disabled] { opacity: 0.6; cursor: not-allowed; filter: grayscale(0.5); }

        .chip-circle {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 1.75rem; height: 1.75rem;
          border-radius: 9999px;
          font-size: 0.8125rem; font-weight: 500;
          border: 1.5px solid transparent;
          transition: all 0.2s ease-out;
          cursor: pointer;
          user-select: none;
        }
        .chip-circle[data-checked="false"] {
          color: #374151; background-color: #ffffff; border-color: #E5E7EB;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.03), 0 2px 4px -2px rgba(0, 0, 0, 0.03);
        }
        .chip-circle[data-checked="false"]:hover {
          background-color: #F9FAFB; border-color: #D1D5DB;
        }
        .chip-circle[data-checked="true"] {
          color: #ffffff;
          background-image: linear-gradient(to right, #3B82F6, #60A5FA);
          border-color: transparent;
          box-shadow: 0 8px 15px -3px rgba(59, 130, 246, 0.25), 0 3px 6px -3px rgba(59, 130, 246, 0.2);
        }
        .chip-circle[data-checked="true"]:hover { filter: brightness(1.1); }
        .chip-circle:focus-visible { outline: none; ring: 4px; ring-color: rgba(96, 165, 250, 0.4); }
        .chip-circle[disabled] { opacity: 0.6; cursor: not-allowed; filter: grayscale(0.5); }
      `}</style>
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background:radial-gradient(circle,_#000_1px,_transparent_1px)] [background-size:22px_22px]" />

      <div
        className="
          relative flex w-full min-h-0
          overflow-hidden
          rounded-none border-none bg-white/40 backdrop-blur-2xl
          ring-0 shadow-none
          bg-[linear-gradient(145deg,rgba(99,102,241,0.08),rgba(255,255,255,0.07))]
          md:flex-row 
        "
      >
        {/* === Barra Lateral (ACTUALIZADA) === */}
        {selectedCourse !== null && (
          <StudentSidebar
            className="md:animate-slide-in-left"
            students={students} 
            loading={loadingStudents}
            selectedStudentId={selectedStudent?.id || null} 
            mainState={mainState}
            courseName={selectedCourse.title} 
            onSelectStudent={handleSelectStudent} 
            onGoBackToWelcome={handleGoBackToWelcome}
            fotoUrls={fotoUrls}
            isAttendanceModeActive={isAttendanceModeActive}
            onStartAttendance={() => setIsAttendanceModalOpen(true)}
            onMarkAttendanceDB={handleMarkAttendanceDB}
            onCancelAttendance={cancelAttendanceMode}
            onCompleteAttendance={completeAttendanceMode}
          />
        )}


        {/* Contenido principal */}
        <div
          
          className={`
            absolute inset-0 md:relative 
            w-full h-full md:h-auto 
            flex 
            flex-1 flex-col min-w-0 min-h-0 
            ${fixedContentBg} 
            transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] 
            ${isDetailView || mainState === 'welcome' ? 'translate-x-0' : 'translate-x-full'} 
            md:translate-x-0 
          `}
        >
          {/* Topbar (sin cambios) */}
          <div
            className="
              sticky top-0 z-10 flex items-end justify-start gap-4
              border-b border-white/60 bg-gradient-to-b from-white/70 to-white/40 px-6 pt-3 backdrop-blur-xl
            "
          >
            {isDetailView && (
              <button
                type="button"
                onClick={handleGoBackToStudentList}
                className="
                  flex md:hidden items-center justify-center gap-1.5 p-2
                  rounded-full border border-white/70 bg-white/25 backdrop-blur-2xl
                  text-gray-700
                  shadow-[0_4px_12px_-4px_rgba(2,6,23,0.2)]
                  active:scale-95 transition-transform
                "
                aria-label="Volver a la lista de estudiantes"
              >
                <ArrowLeft size={18} />
              </button>
            )}

            {(mainState === 'viewing') && (
              <nav
                className="
                  flex items-center gap-1.5 p-1
                  rounded-full border border-white/70 bg-white/25 backdrop-blur-2xl
                  shadow-[0_8px_28px_-10px_rgba(2,6,23,0.28),inset_0_1px_0_rgba(255,255,255,0.65)]
                "
              >
                <TabButton
                  icon={<FileText className="h-4 w-4" />}
                  label="Hoja de Vida"
                  isActive={activeTab === 'hojaDeVida'}
                  onClick={() => handleTabClick('hojaDeVida')}
                />
                <TabButton
                  icon={<UserCheck className="h-4 w-4" />}
                  label="Asistencias"
                  isActive={activeTab === 'grades'}
                  onClick={() => handleTabClick('grades')}
                />
                <TabButton
                  icon={<BarChart3 className="h-4 w-4" />}
                  label="Reportes"
                  isActive={activeTab === 'reports'}
                  onClick={() => handleTabClick('reports')}
                />
              </nav>
            )}
          </div>

          {/* Body apilado */}
          <div className="flex-1 min-h-0 grid grid-cols-1 [grid-template-areas:'stack'] overflow-hidden">

            {/* Paneles de Bienvenida (ACTUALIZADO CON LOADING) */}
            <WelcomePanel 
              onSelectCourse={handleSelectCourse} 
              className={getContentPanelClasses('welcome')}
              isActive={mainState === 'welcome'}
              courses={courses}
              loading={loadingCourses || authLoading} // <-- CAMBIO: Pasar prop
            />

            {/* ... (Resto de los paneles sin cambios) ... */}
            {mainState === 'courseWelcome' && (
              <div className="md:hidden flex items-center justify-center p-8 text-center text-gray-500 [grid-area:stack]">
                Selecciona un estudiante de la lista.
              </div>
            )}
            
            {mainState === 'courseWelcome' && (
              <CourseWelcomeMessage 
                courseName={selectedCourse?.title || 'Curso'} 
                className={getContentPanelClasses('courseWelcome')}
              />
            )}


            {(mainState === 'viewing') && (
              <div
                className={`[grid-area:stack] w-full h-full grid grid-cols-1 [grid-template-areas:'stack'] overflow-hidden ${getContentPanelClasses(['creating', 'viewing'])}`}
              >

                {/* Registrar notas (Asistencias) */}
                <div className={getTabPanelClasses('grades')}>
                  <section className="p-4 md:p-6 lg:p-8 overflow-y-auto flex-1 min-h-0">
                    <div
                      className="
                        relative rounded-[22px]
                        border border-white/80
                        bg-white/25 backdrop-blur-[22px]
                        shadow-[0_30px_80px_-35px_rgba(2,6,23,0.45),inset_0_1px_0_0_#fff]
                        ring-1 ring-black/5
                        p-5 md:p-7
                      "
                    >
                      <div className="pointer-events-none absolute -top-16 -left-16 h-44 w-44 rounded-full bg-gradient-to-br from-indigo-500/12 to-white/12 blur-3xl" />
                      <div className="pointer-events-none absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-tl from-indigo-400/15 to-gray-200/20 blur-3xl" />
                    
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-[20px] md:text-[22px] font-semibold text-gray-900 tracking-[-0.015em] flex flex-col md:flex-row md:items-center">
                          <span>Asistencias del Estudiante:</span>
                          <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent md:ml-2">
                            {selectedStudent?.nombre ?? 'N/A'}
                          </span>
                        </h2>

                        <div className="flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.05)] ring-1 ring-black/5 backdrop-blur-md">
                          <span className="text-sm font-medium text-gray-700">Pendientes</span>
                          <span className={classNames(
                            "grid h-6 w-6 place-items-center rounded-full text-xs font-bold text-white ring-2 ring-white transition-all",
                            asistenciasPendientes > 0 ? "bg-red-500" : "bg-green-500"
                          )}>
                            {asistenciasPendientes}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-6" ref={topicsContainerRef}>
                        {courseTopics.length === 0 && (
                          <p className="text-sm text-gray-700 text-center py-4">
                            No hay temas definidos para este curso.
                          </p>
                        )}

                        {courseTopics.map((topic) => (
                          <div id={`topic-${topic.id}`} key={`wrap-${topic.id}`}>
                            <div className="flex items-center gap-2 mb-4">
                              <UserCheck size={16} className="text-indigo-900/70" />
                              <h3 className="text-base md:text-[17px] font-semibold tracking-tight text-indigo-900">{topic.title}</h3>
                            </div>
                            
                            <GradeGrid
                              gradePlaceholders={topic.grades}
                              studentGradesForTopic={studentGrades[topic.id] || {}}
                              topicId={topic.id}
                              onGradeChange={handleGradeChange}
                            />
                          </div>
                        ))}
                      </div>
                      
                    </div>
                  </section>
                </div>

                {/* Hoja de Vida (Importada) */}
                <div className={getTabPanelClasses('hojaDeVida')}>
                  {selectedStudent ? (
                    <HojaDeVidaPanel
                      key={selectedStudent.id}
                      row={selectedStudent} 
                      signedUrl={signedUrl}
                      onUpdated={onUpdated} 
                      onDeleted={handleHojaDeVidaDelete}
                      className="animate-slideIn"
                    />
                  ) : (
                    <div className="p-6 text-center text-gray-600">
                      No se ha seleccionado ningún estudiante.
                    </div>
                  )}
                </div>


                {/* Reportes */}
                <div className={getTabPanelClasses('reports')}>
                  <section className="p-6 md:p-8 overflow-y-auto flex-1 min-h-0">
                    <CardSection title="Reportes de Estudiantes">
                      <p className="text-gray-700 text-[15px]">
                        Aquí se mostrarán gráficos y estadísticas.
                      </p>
                    </CardSection>
                  </section>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* === CAMBIO: ELIMINADO ModalMatricular === */}
      
      {/* Modal de Asistencia (sin cambios) */}
      {isAttendanceModalOpen && (
        <ModalTomarAsistencia
          topics={courseTopics}
          onClose={() => setIsAttendanceModalOpen(false)}
          onSelectClass={(classId) => {
            setIsAttendanceModalOpen(false);
            setIsAttendanceModeActive(true);
            setAttendanceClassId(classId);
          }}
        />
      )}
    </main>
  );
}

// --- SUBCOMPONENTES (ACTUALIZADOS) ---

/* =======================
    SIDEBAR (ACTUALIZADO)
   ======================= */
function StudentSidebar({
  students,
  selectedStudentId, 
  mainState,
  onSelectStudent, 
  // --- CAMBIO: Se eliminó 'onCreateNew' y 'pendientesCount' ---
  className = '',
  onGoBackToWelcome,
  courseName,
  loading,
  fotoUrls,
  isAttendanceModeActive,
  onStartAttendance,
  onCancelAttendance,
  onCompleteAttendance,
  onMarkAttendanceDB,
}: {
  students: EstudianteInscrito[]; 
  selectedStudentId: string | null;
  mainState: MainPanelState;
  onSelectStudent: (student: EstudianteInscrito) => void; 
  className?: string;
  onGoBackToWelcome: () => void;
  courseName?: string;
  loading: boolean;
  fotoUrls: Record<string, string | 'loading'>;
  isAttendanceModeActive: boolean;
  onStartAttendance: () => void;
  onCancelAttendance: () => void;
  onCompleteAttendance: () => void;
  onMarkAttendanceDB: (inscripcion_id: string, status: 'si' | 'no') => Promise<void>;
}) {
  const isDetailView = mainState === 'creating' || mainState === 'viewing';

  const [currentAttendanceStudentIndex, setCurrentAttendanceStudentIndex] = useState(0);
  const [isMarkingStudentId, setIsMarkingStudentId] = useState<string | null>(null);
  
  useEffect(() => {
    if (isAttendanceModeActive) {
      setCurrentAttendanceStudentIndex(0);
      setIsMarkingStudentId(null);
    }
  }, [isAttendanceModeActive]);
  
  const [searchQuery, setSearchQuery] = useState('');
  
  const filteredStudents = useMemo(() => {
    if (!searchQuery) return students;
    const q = searchQuery.toLowerCase();
    return students.filter(s => 
      s.nombre?.toLowerCase().includes(q) ||
      s.cedula?.includes(q)
    );
  }, [students, searchQuery]);


  return (
    <aside
      className={`
        absolute inset-0 md:relative
        w-full h-full md:h-full md:w-1/3 lg:w-1/4
        flex-shrink-0 flex flex-col 
        border-b md:border-b-0 md:border-r border-white/60
        bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,255,255,0.56))]
        backdrop-blur-2xl
        [box-shadow:inset_0_1px_0_rgba(255,255,255,0.9),0_20px_60px_-30px_rgba(2,6,23,0.25)]
        before:content-[''] before:absolute before:inset-y-0 before:-left-20 before:w-60
        before:bg-[radial-gradient(160px_220px_at_10%_20%,rgba(99,102,241,0.18),transparent_60%)]
        before:pointer-events-none
        
        after:content-[''] after:absolute after:inset-0 after:-z-10
        after:opacity-20
        after:[background:radial-gradient(circle,_rgba(199,210,254,0.3)_1px,_transparent_1px)] 
        after:[background-size:18px_18px] 

        transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
        ${isDetailView ? 'translate-x-[-100%] md:translate-x-0' : 'translate-x-0'}
        ${className}
      `}
      aria-label="Barra lateral de estudiantes"
    >
      {/* Header */}
      <div className="flex-shrink-0 p-3 pb-2 border-b border-white/60 bg-white/60 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
        <button
          type="button"
          onClick={onGoBackToWelcome}
          className="flex items-center gap-1.5 px-2 py-1 text-sm font-medium text-gray-700 hover:text-indigo-600 rounded-lg hover:bg-white/70 transition-colors duration-150"
        >
          <ArrowLeft size={16} />
          <span className="text-[13px]">Volver a Cursos</span>
        </button>

        {courseName && (
          <div className="pt-2 text-center">
            <h2 className="text-xl font-bold tracking-[-0.03em] bg-gradient-to-r from-indigo-700 to-purple-600 bg-clip-text text-transparent">
              {courseName}
            </h2>
          </div>
        )}
      </div>

      {/* Buscador */}
      <div className="flex-shrink-0 p-4 border-b border-white/60">
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar estudiante…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={isAttendanceModeActive}
            className="w-full rounded-2xl border border-white/70 bg-white/75 backdrop-blur-xl py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-600 shadow-[inset_0_2px_6px_rgba(0,0,0,0.03)] focus:outline-none focus:ring-4 focus:ring-indigo-400/25 focus:border-white transition disabled:opacity-70"
            aria-label="Buscar estudiante"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
        </div>
      </div>

      {isAttendanceModeActive && (
        <div className="flex-shrink-0 p-3 border-b border-white/60 bg-red-50/50">
          <button
            onClick={onCancelAttendance}
            className="w-full text-center text-sm font-medium text-red-600 hover:text-red-800 transition-colors"
          >
            Cancelar Asistencia
          </button>
        </div>
      )}

      {/* Lista */}
      <nav className="overflow-y-auto p-3 space-y-2 max-h-80 md:flex-1 md:max-h-none [scrollbar-width:thin] [scrollbar-color:rgba(0,0,0,.15)_transparent]">
        {loading ? (
          <div className="p-4 text-center text-gray-600">Cargando...</div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-4 text-center text-gray-600">
            {students.length > 0 ? "Nadie coincide con la búsqueda." : "No hay estudiantes asignados a ti en este curso."}
          </div>
        ) : (
          filteredStudents.map((student, index) => { 
            const isCurrent = index === currentAttendanceStudentIndex;
            const isCompleted = index < currentAttendanceStudentIndex;
            
            return (
              <StudentSidebarItem
                key={student.inscripcion_id}
                student={student}
                fotoUrls={fotoUrls}
                isActive={selectedStudentId === student.id && !isAttendanceModeActive}
                isAttendanceModeActive={isAttendanceModeActive}
                isCurrentAttendanceTarget={isCurrent}
                isCompleted={isCompleted}
                isLoading={isMarkingStudentId === student.inscripcion_id}
                onMarkAttendance={async (status) => {
                  setIsMarkingStudentId(student.inscripcion_id);
                  try {
                    await onMarkAttendanceDB(student.inscripcion_id, status);
                    
                    const nextIndex = currentAttendanceStudentIndex + 1;
                    setCurrentAttendanceStudentIndex(nextIndex);

                    if (nextIndex >= filteredStudents.length) {
                      onCompleteAttendance();
                    }
                  } catch (e) {
                    console.error("Fallo al marcar, no se avanza", e);
                  } finally {
                    setIsMarkingStudentId(null);
                  }
                }}
                onSelectStudent={onSelectStudent}
              />
            );
          })
        )}
      </nav>


      {/* --- CAMBIO: Footer (Botones) simplificado --- */}
      <div className="flex-shrink-0 p-4 border-t border-white/60 min-h-[90px] flex flex-col items-center justify-center gap-3">
        {/* Se eliminó el botón de Matricular */}
        <button
          onClick={onStartAttendance}
          disabled={isAttendanceModeActive}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-medium backdrop-blur-sm transition-all
            border-emerald-300/50 bg-gradient-to-br from-emerald-100 via-white to-teal-100 text-emerald-900 shadow-lg hover:shadow-[0_15px_35px_-15px_rgba(16,185,129,0.5)]
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <UserCheck size={18} />
          <span>Tomar Asistencia</span>
        </button>
      </div>
      
    </aside>
  );
}

/* =======================
    StudentSidebarItem (sin cambios)
   ======================= */
function StudentSidebarItem({
  student,
  fotoUrls,
  isActive,
  isAttendanceModeActive,
  isCurrentAttendanceTarget,
  isCompleted,
  isLoading,
  onMarkAttendance,
  onSelectStudent,
}: {
  student: EstudianteInscrito;
  fotoUrls: Record<string, string | 'loading'>;
  isActive: boolean;
  isAttendanceModeActive: boolean;
  isCurrentAttendanceTarget: boolean;
  isCompleted: boolean;
  isLoading: boolean;
  onMarkAttendance: (status: 'si' | 'no') => void;
  onSelectStudent: (student: EstudianteInscrito) => void;
}) {
  
  const gradientClasses = [
    'bg-gradient-to-br from-teal-100/95 to-emerald-100/95 shadow shadow-teal-200/50 hover:shadow-md hover:shadow-teal-300/60',
    'bg-gradient-to-br from-orange-100/95 to-amber-100/95 shadow shadow-orange-200/50 hover:shadow-md hover:shadow-orange-300/60',
    'bg-gradient-to-br from-pink-100/95 to-rose-100/95 shadow shadow-pink-200/50 hover:shadow-md hover:shadow-pink-300/60',
    'bg-gradient-to-br from-sky-100/95 to-cyan-100/95 shadow shadow-sky-200/50 hover:shadow-md hover:shadow-sky-300/60',
  ];
  const gradientStyle = gradientClasses[Number(student.id.replace(/\D/g,'')) % gradientClasses.length]; // Usa el ID para un color consistente

  const containerClasses = [
    'group relative flex items-center gap-4 md:gap-3 rounded-2xl p-4 md:p-3 transition-all border overflow-hidden',
  ];

  if (isAttendanceModeActive) {
    if (isCurrentAttendanceTarget) {
      containerClasses.push('border-transparent text-indigo-950 bg-gradient-to-r from-white/90 to-white/70 shadow-[0_12px_28px_-18px_rgba(76,29,149,0.35)] ring-2 ring-indigo-500');
    } else if (isCompleted) {
      containerClasses.push('border-transparent bg-gray-100/60 opacity-50');
    } else {
      containerClasses.push(`${gradientStyle} border-transparent text-gray-900 opacity-70`);
    }
  } else {
    if (isActive) {
      containerClasses.push('border-transparent text-indigo-950 bg-gradient-to-r from-white/90 to-white/70 shadow-[0_12px_28px_-18px_rgba(76,29,149,0.35)] ring-1 ring-indigo-500/30');
    } else {
      containerClasses.push(`${gradientStyle} border-transparent text-gray-900 hover:brightness-105 cursor-pointer`);
    }
  }

  return (
    <div
      onClick={(e) => {
        if (!isAttendanceModeActive) {
          e.preventDefault();
          onSelectStudent(student);
        }
      }} 
      className={classNames(...containerClasses)}
    >
      <StudentAvatar
        fotoPath={student.foto_path}
        nombre={student.nombre}
        fotoUrls={fotoUrls}
      />
      
      <div className="flex-1">
        <span className="block text-base md:text-[13.5px] font-semibold leading-tight tracking-[-0.01em]">
          {student.nombre ?? 'Sin Nombre'}
        </span>
        <span className={classNames(
            "block text-sm md:text-[11.5px]",
            isActive && !isAttendanceModeActive ? "text-gray-600/90" : "text-gray-700/80"
          )}>
          C.C {student.cedula?.startsWith('TEMP_') ? 'Cédula Pendiente' : student.cedula}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {isAttendanceModeActive ? (
          isCurrentAttendanceTarget ? (
            isLoading ? (
              <Loader2 size={24} className="text-indigo-500 animate-spin" />
            ) : (
              // Botones Cupertino
              <>
                <button
                  type="button"
                  onClick={() => onMarkAttendance('no')}
                  className="flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 text-gray-700 shadow-md ring-1 ring-black/5 hover:from-gray-300 active:scale-95 transition-all"
                  title="No"
                >
                  <X size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => onMarkAttendance('si')}
                  className="flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 text-white shadow-lg shadow-green-500/30 hover:from-green-500 active:scale-95 transition-all"
                  title="Sí"
                >
                  <Check size={20} />
                </button>
              </>
            )
          ) : isCompleted ? (
            <Check size={24} className="text-green-600" />
          ) : null // Estudiantes futuros en la lista no muestran nada
        ) : (
          // Vista normal
          <>
            <button
              type="button"
              disabled={!student.telefono}
              onClick={(e) => {
                e.stopPropagation(); 
                if (student.telefono) {
                  window.location.href = `tel:${student.telefono.replace(/\s+/g, '')}`;
                }
              }}
              className="p-2 rounded-full bg-white/70 hover:bg-white text-gray-600 hover:text-indigo-600 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title={student.telefono ? "Llamar" : "No hay teléfono"}
            >
              <Phone size={18} />
            </button>
            <button
              type="button"
              disabled={!student.telefono}
              onClick={(e) => {
                e.stopPropagation(); 
                if (student.telefono) {
                  const phone = student.telefono.replace(/\D/g, ''); 
                  window.open(`httpsa://wa.me/${phone}`, '_blank');
                }
              }}
              className="p-2 rounded-full bg-white/70 hover:bg-white text-gray-600 hover:text-green-600 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title={student.telefono ? "WhatsApp" : "No hay teléfono"}
            >
              <MessageCircle size={18} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}


/* =======================
    ModalTomarAsistencia (sin cambios)
   ======================= */
function ModalTomarAsistencia({
  topics,
  onClose,
  onSelectClass,
}: {
  topics: CourseTopic[];
  onClose: () => void;
  onSelectClass: (classId: number) => void;
}) {
  const asistenciaTopic = topics.find(t => t.id === 1);
  const clases = asistenciaTopic ? asistenciaTopic.grades : [];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="
          relative w-full max-w-lg flex flex-col
          rounded-3xl border border-white/70 bg-white/70 backdrop-blur-2xl
          shadow-2xl overflow-hidden
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 p-5 border-b border-white/60">
          <h2 className="text-xl font-semibold text-gray-900">Tomar Asistencia</h2>
          <p className="text-sm text-gray-700">
            Selecciona la clase para la cual deseas tomar asistencia:
          </p>
        </div>

        {/* Lista de Clases (Scrollable) */}
        <div className="flex-1 overflow-y-auto max-h-[50vh] p-4">
          <div className="grid grid-cols-4 gap-3">
            {clases.map((clase, index) => (
              <button
                key={clase.id}
                onClick={() => onSelectClass(clase.id)}
                className="flex items-center justify-center h-16 rounded-2xl bg-white/70 text-indigo-700 font-semibold shadow-md ring-1 ring-black/5 hover:bg-white hover:ring-indigo-500/50 transition-all active:scale-95"
              >
                Clase #{index + 1}
              </button>
            ))}
            {clases.length === 0 && (
              <p className="col-span-4 text-center text-gray-600">No hay clases de asistencia definidas.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 p-4 border-t border-white/60 bg-white/40 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white/70 rounded-lg ring-1 ring-black/10 hover:bg-white"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}


/* =======================
    MODAL MATRICULAR (ELIMINADO)
   ======================= */
// --- CAMBIO: Se eliminó el componente 'ModalMatricular'. ---


/* --- OTROS SUBCOMPONENTES (Sin cambios) --- */

function StudentAvatar({
  fotoPath,
  nombre,
  fotoUrls
}: {
  fotoPath?: string | null;
  nombre?: string | null;
  fotoUrls: Record<string, string | 'loading'>;
}) {
  const url = (fotoPath ? fotoUrls[fotoPath] : null) ?? generateAvatar(nombre ?? 'NN');

  return (
    <img
      key={url} 
      src={url} 
      alt={nombre ?? 'Estudiante'}
      className="h-12 w-12 md:h-10 md:w-10 rounded-full border-2 border-white/80 ring-1 ring-black/5 object-cover shadow-[0_4px_10px_-6px_rgba(2,6,23,.35)]"
      onError={(e) => {
        const t = e.currentTarget;
        const fallbackSrc = generateAvatar(nombre ?? 'NN');
        if (t.src !== fallbackSrc) {
          t.src = fallbackSrc;
        }
      }}
    />
  );
}

function TabButton({
  icon,
  label,
  isActive,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center justify-center rounded-full p-2 md:px-4 md:py-2 md:gap-2 text-sm font-medium transition-all duration-200 focus:outline-none',
        isActive
          ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_8px_24px_-10px_rgba(76,29,149,0.45)]'
          : 'text-gray-700 bg-white/28 hover:bg-white/40 backdrop-blur-xl border border-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]',
      ].join(' ')}
      aria-current={isActive ? 'page' : undefined}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

function CardSection({
  title,
  children,
  actions,
  icon,
  isEditable = false,
  onTitleChange,
  autoFocus,
  onAutoFocus,
}: {
  title?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  isEditable?: boolean;
  onTitleChange?: (newTitle: string) => void;
  autoFocus?: boolean;
  onAutoFocus?: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentTitle, setCurrentTitle] = useState(title || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (autoFocus) setIsEditing(true); }, [autoFocus]);
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
  if (onAutoFocus) { requestAnimationFrame(() => onAutoFocus()); }
    }
  }, [isEditing, onAutoFocus]);
  useEffect(() => { if (!isEditing) setCurrentTitle(title || ''); }, [title, isEditing]);

  const saveTitle = () => { setIsEditing(false); if (onTitleChange && currentTitle !== title) onTitleChange(currentTitle); };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') saveTitle();
    else if (e.key === 'Escape') { setCurrentTitle(title || ''); setIsEditing(false); }
  };

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/70 bg-white/30 p-5 md:p-6 shadow-[0_10px_30px_-15px_rgba(2,6,23,0.2),inset_0_1px_0_0_#fff] backdrop-blur-xl">
      <div className="pointer-events-none absolute -top-16 -left-16 h-40 w-40 rounded-full bg-gradient-to-br from-indigo-500/15 to-white/15 blur-2xl" />
      {(title || actions) && (
        <div className="flex justify-between items-center mb-4 -mx-5 -mt-5 md:-mx-6 md:-mt-6 p-3 bg-gradient-to-r from-blue-100 to-indigo-100">
          <div className="flex items-center gap-2">
            {icon}
            {title && isEditable ? (
              isEditing ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={currentTitle}
                  onChange={(e) => setCurrentTitle(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={handleKeyDown}
                  className="text-base md:text-[17px] font-semibold tracking-tight text-indigo-900 bg-white/80 rounded-lg px-2 py-0"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="group flex items-center gap-2 cursor-text rounded-lg px-2 py-0"
                >
                  <h3 className="text-base md:text-[17px] font-semibold tracking-tight text-indigo-900">{currentTitle}</h3>
                  <Edit2 size={14} className="text-indigo-400/70 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )
            ) : title ? (
              <h3 className="text-base md:text-[17px] font-semibold tracking-tight text-indigo-900">{title}</h3>
            ) : null}
          </div>
          {actions && <div className="flex-shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

function FormInput({ label, id, type, icon }: { label: string; id: string; type: string; icon: React.ReactNode; }) {
  return (
    <div className="group relative">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">{icon}</span>
      <input
        type={type}
        id={id}
        name={id}
        className="w-full rounded-2xl border border-white/70 bg-white/70 p-3.5 pl-10 text-[15px] text-gray-900 placeholder-gray-500 shadow-inner backdrop-blur-sm focus:outline-none focus:ring-4 focus:ring-indigo-400/25 focus:border-white transition"
        placeholder={label}
      />
    </div>
  );
}

function GradeGrid({
  gradePlaceholders,
  studentGradesForTopic,
  topicId,
  onGradeChange,
}: {
  gradePlaceholders: GradePlaceholder[];
  studentGradesForTopic: Record<number, string>;
  topicId: number;
  onGradeChange: (topicId: number, gradeId: number, value: string) => void;
}) {
  const gradeRows = chunkArray(gradePlaceholders, 5);
  return (
    <div>
      <div className="max-h-[320px] space-y-4 overflow-y-auto pr-1.5">
        {gradePlaceholders.length === 0 && (
          <p className="text-sm text-gray-700 text-center py-4">No hay campos de nota definidos para este tema.</p>
        )}
        {gradeRows.map((row, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {row.map((placeholder, colIndex) => {
              const noteNumber = rowIndex * 5 + colIndex + 1;
              const gradeValue = studentGradesForTopic[placeholder.id] ?? '';
              
              return (
                <PremiumAttendanceButton
                  key={placeholder.id}
                  noteNumber={noteNumber}
                  value={gradeValue}
                  onChange={(newValue) => onGradeChange(topicId, placeholder.id, newValue)}
                />
              );
            })}
            {Array.from({ length: Math.max(0, 5 - row.length) }).map((_, i) => <div key={`empty-${i}`} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

function PremiumAttendanceButton({ 
  noteNumber, 
  value, 
  onChange 
}: {
  noteNumber: number;
  value: string;
  onChange: (newValue: string) => void;
}) {
  const handleClick = () => {
    if (value === 'si') {
      onChange('no');
    } else if (value === 'no') {
      onChange('');
    } else {
      onChange('si');
    }
  };

  const baseClasses = `
    relative group flex flex-col items-center justify-center h-16
    rounded-[18px] border 
    ring-1 ring-black/5
    shadow-[0_12px_30px_-18px_rgba(2,6,23,0.35),inset_0_1px_0_0_rgba(255,255,255,0.65)]
    transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] 
    hover:-translate-y-[2px]
    hover:shadow-[0_20px_40px_-18px_rgba(2,6,23,0.45)]
    active:scale-[0.97] active:translate-y-0
    p-2 overflow-hidden cursor-pointer
  `;

  let stateClasses, icon, labelColor;

  if (value === 'si') {
    stateClasses = `
      border-blue-300/50
      bg-gradient-to-br from-blue-100 via-white to-indigo-100
      text-indigo-900
      shadow-[0_20px_40px_-18px_rgba(59,130,246,0.3)]
      hover:shadow-[0_22px_45px_-18px_rgba(59,130,246,0.4)]
    `;
    icon = <Check size={20} className="mb-0.5" />;
    labelColor = "text-indigo-900/70";
  } else if (value === 'no') {
    stateClasses = `
      border-white/60 
      bg-gradient-to-br from-gray-500 to-gray-600
      text-white
      shadow-[0_15px_35px_-18px_rgba(107,114,128,0.6)]
      hover:shadow-[0_18px_40px_-18px_rgba(107,114,128,0.7)]
    `;
    icon = <X size={20} className="mb-0.5" />;
    labelColor = "text-white/80";
  } else {
    stateClasses = `
      border-white/60 
      bg-white/40 
      backdrop-blur-xl
      hover:bg-white/55
      bg-[linear-gradient(145deg,rgba(99,102,241,0.06),rgba(255,255,255,0.05))]
    `;
    icon = null;
    labelColor = "text-gray-600/90";
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`${baseClasses} ${stateClasses}`}
      aria-label={`Marcar asistencia para Clase #${noteNumber}. Estado actual: ${value || 'vacío'}`}
    >
      <div className="pointer-events-none absolute inset-0 rounded-[18px] opacity-70 bg-[radial-gradient(140px_90px_at_8%_-8%,rgba(99,102,241,0.18),transparent),radial-gradient(140px_90px_at_110%_120%,rgba(200,200,200,0.08),transparent)]" />
      
      <span className={`relative text-[11px] uppercase tracking-wide select-none ${labelColor}`}>
        Clase # {noteNumber}
      </span>
      <div className="relative h-5">
        {icon}
      </div>
    </button>
  );
}