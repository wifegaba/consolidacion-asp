'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import '../../panel/panel.css';
import {
  BarChart3,
  Search,
  ArrowLeft,
  X,
  Edit2,
  FileText,
  UserCheck,
  Check,
  Phone,
  MessageCircle,
  Loader2,
  Lock,
  LogOut,
  AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { supabase } from '../../../lib/supabaseClient';
import { useToast } from '../../../components/ToastProvider';
import { useAuth } from '../../../hooks/useAuth';

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
  getNextCourse
} from './components/academia.utils';

import { HojaDeVidaPanel } from './components/HojaDeVidaPanel';
import {
  WelcomePanel as WelcomePanelBase,
  CourseWelcomeMessage
} from './components/PanelesBienvenida';
import { GlobalPresenceProvider } from '../../../components/GlobalPresenceProvider';
import { ConfettiButton } from '../../../components/ConfettiButton';
import { GraduationModal } from '../../../components/GraduationModal';
import { PendingStudentsModal } from '../../../components/PendingStudentsModal';

// --- Memoización de Componentes ---
const WelcomePanel = memo(WelcomePanelBase);
const MemoizedHojaDeVida = memo(HojaDeVidaPanel);

// Animaciones premium para el sidebar de estudiantes
const EASE_SMOOTH = [0.16, 1, 0.3, 1] as const;

const STUDENT_LIST_WRAPPER_VARIANTS: Variants = {
  hidden: {
    transition: { staggerChildren: 0.035, staggerDirection: -1 }
  },
  visible: {
    transition: { delayChildren: 0.1, staggerChildren: 0.045 }
  }
};

const STUDENT_ITEM_VARIANTS: Variants = {
  hidden: { opacity: 0, x: -20, y: 12, scale: 0.97 },
  visible: {
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: EASE_SMOOTH }
  }
};

type EstudianteInscrito = Entrevista & {
  inscripcion_id: string;
  estado_inscripcion: string;
  progress?: number; // 0 - 100
  missedClasses?: number[]; // Array de números de clase perdidas (ej: [1, 3, 5])
  missedCount?: number; // Total de inasistencias
  missedDates?: Record<number, string>; // Mapa de clase_numero -> fecha real de inasistencia
};

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
  const { user, loading: authLoading, error: authError } = useAuth();
  const toast = useToast();

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

  const [courseTopics, setCourseTopics] = useState<CourseTopic[]>([]);
  const [studentGrades, setStudentGrades] = useState<StudentGrades>({});
  const [initialGrades, setInitialGrades] = useState<StudentGrades>({}); // Para detectar cambios

  // Control de imágenes y caché
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [fotoUrls, setFotoUrls] = useState<Record<string, string>>({});

  // Control de guardado (Debounce y Dirty Check)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isGradesDirty = useRef(false);

  // Estados de Asistencia (Attendance Mode)
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [isAttendanceModeActive, setIsAttendanceModeActive] = useState(false);
  const [attendanceClassId, setAttendanceClassId] = useState<number | null>(null);
  const [isAttendanceCompleted, setIsAttendanceCompleted] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showAttendanceAlreadyTakenModal, setShowAttendanceAlreadyTakenModal] = useState(false);

  // Estado para modal de graduación
  const [showGraduationModal, setShowGraduationModal] = useState(false);
  const [promotionData, setPromotionData] = useState<{ studentName: string; nextCourseName: string } | null>(null);

  // Estado para modal de pendientes
  const [showPendingModal, setShowPendingModal] = useState(false);

  // Estado para modal de nivelación individual (desde sidebar)
  const [showNivelarModal, setShowNivelarModal] = useState(false);
  const [nivelarStudent, setNivelarStudent] = useState<EstudianteInscrito | null>(null);


  const [currentUserName, setCurrentUserName] = useState('');

  useEffect(() => {
    if (user?.servidorId) {
      supabase.from('servidores').select('nombre').eq('id', user.servidorId).maybeSingle()
        .then(({ data }) => {
          if (data && data.nombre) setCurrentUserName(data.nombre);
        });
    }
  }, [user?.servidorId]);

  // --- Callbacks de Navegación ---
  const handleTabClick = useCallback((newTab: ActiveTab) => {
    setActiveTab(prev => {
      if (prev !== newTab) {
        setPrevTab(prev);
        return newTab;
      }
      return prev;
    });
  }, []);

  const handleGoBackToWelcome = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setPrevMainState(current => current);
    setMainState('welcome');
    setSelectedCourse(null);
    setSelectedInscripcionId(null);
    setSelectedStudent(null);
    setCourseTopics([]);
    setStudentGrades({});
    setStudents([]);
    setSignedUrl(null);
  }, []);

  const handleGoBackToStudentList = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setPrevMainState(current => current);
    setMainState('courseWelcome');
    setSelectedInscripcionId(null);
    setSelectedStudent(null);
    setSignedUrl(null);
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }, []);

  // --- Carga Inicial de Cursos ---
  useEffect(() => {
    if (authLoading || !user) return;

    async function loadCourses() {
      setLoadingCourses(true);
      const servidorId = user!.servidorId;
      const { data, error } = await supabase
        .from('asignaciones_academia')
        .select(`curso_id, curso:cursos ( id, nombre, color, orden )`)
        .eq('servidor_id', servidorId)
        .eq('vigente', true);

      if (error) {
        toast.error("Error al cargar tus cursos.");
        setLoadingCourses(false);
        return;
      }

      const asignaciones = (data as any[]) || [];
      const cursosRaw = asignaciones.map(a => a?.curso).filter(Boolean) as Array<{
        id: number; nombre: string; color?: string | null; orden?: number | null;
      }>;

      const loadedCourses: Course[] = cursosRaw
        .slice()
        .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
        .map(curso => ({ id: curso.id, title: curso.nombre, color: curso.color || 'blue' }));

      setCourses(loadedCourses);
      setLoadingCourses(false);
    }
    loadCourses();
  }, [user, authLoading, toast]);

  // --- Carga de Estudiantes y Fotos en Lote ---
  const loadStudents = useCallback(async (course: Course) => {
    if (!user) {
      toast.error("No se pudo identificar al maestro.");
      return;
    }
    const servidorId = user.servidorId;
    setLoadingStudents(true);
    setStudents([]);
    setSelectedInscripcionId(null);
    setSelectedStudent(null);
    setFotoUrls({});

    try {
      // Query 1: Cargar inscripciones y entrevistas
      const inscripcionesPromise = supabase
        .from('inscripciones')
        .select(`id, estado, entrevistas ( * )`)
        .eq('curso_id', course.id)
        .eq('servidor_id', servidorId)
        .eq('estado', 'activo')
        .order('created_at', { ascending: true });

      const { data, error } = await inscripcionesPromise;
      if (error) throw error;

      const loadedStudents: EstudianteInscrito[] = data
        .filter(item => item.entrevistas)
        .map(item => ({
          ...(item.entrevistas as unknown as Entrevista),
          inscripcion_id: item.id,
          estado_inscripcion: item.estado,
          progress: 0,
        }));

      // OPTIMIZACIÓN: Mostrar estudiantes inmediatamente (sin fotos ni progreso)
      setStudents(loadedStudents);
      setLoadingStudents(false);

      // Cargar asistencias y fotos EN PARALELO en segundo plano
      if (loadedStudents.length > 0) {
        const inscripcionIds = loadedStudents.map(s => s.inscripcion_id);
        const fotoPaths = [...new Set(loadedStudents.map((s) => s.foto_path).filter(Boolean) as string[])];

        // Ejecutar todas las queries en paralelo (asistencias, fotos, e inasistencias con fechas reales)
        const [asistenciasResult, fotosResult, inasistenciasResult] = await Promise.all([
          // Query asistencias
          supabase
            .from('asistencias_academia')
            .select('inscripcion_id, asistencias')
            .in('inscripcion_id', inscripcionIds),
          // Query fotos (solo si hay fotos)
          fotoPaths.length > 0
            ? supabase.storage.from("entrevistas-fotos").createSignedUrls(fotoPaths, 60 * 60)
            : Promise.resolve({ data: null }),
          // Query fechas reales de inasistencia
          (async () => {
            try {
              return await supabase
                .from('inasistencias_academia')
                .select('inscripcion_id, clase_numero, fecha_inasistencia')
                .in('inscripcion_id', inscripcionIds)
                .eq('nivelado', false);
            } catch {
              return { data: null };
            }
          })()
        ]);

        // Procesar asistencias
        const asistenciaMap = (asistenciasResult.data || []).reduce((acc, curr) => {
          acc[curr.inscripcion_id] = curr.asistencias;
          return acc;
        }, {} as Record<string, any>);

        // Procesar fechas reales de inasistencia
        const inasistenciaDateMap: Record<string, Record<number, string>> = {};
        if (inasistenciasResult && 'data' in inasistenciasResult && inasistenciasResult.data) {
          (inasistenciasResult.data as any[]).forEach((row: any) => {
            if (!inasistenciaDateMap[row.inscripcion_id]) {
              inasistenciaDateMap[row.inscripcion_id] = {};
            }
            inasistenciaDateMap[row.inscripcion_id][row.clase_numero] = row.fecha_inasistencia;
          });
        }

        // Calcular progreso y clases perdidas
        loadedStudents.forEach(student => {
          const grades = asistenciaMap[student.inscripcion_id] || {};
          let totalChecks = 0;
          const missedClasses: number[] = [];
          const topicGrades = grades['1'] || {};

          // Iterar sobre las 12 clases
          for (let i = 1; i <= 12; i++) {
            const val = topicGrades[i];
            if (val === 'si') totalChecks++;
            if (val === 'no') missedClasses.push(i); // Guardar número de clase perdida
          }

          const percentage = Math.min(100, Math.round((totalChecks / 12) * 100));
          student.progress = percentage;
          student.missedClasses = missedClasses;
          student.missedCount = missedClasses.length;
          student.missedDates = inasistenciaDateMap[student.inscripcion_id] || {};
        });

        // Procesar fotos
        if (fotosResult.data) {
          const urlMap = fotosResult.data.reduce((acc, item) => {
            if (item.signedUrl && item.path) {
              const url = bustUrl(item.signedUrl);
              if (url) acc[item.path] = url;
            }
            return acc;
          }, {} as Record<string, string>);
          setFotoUrls(urlMap);
        }

        // Actualizar estudiantes con progreso calculado
        setStudents([...loadedStudents]);
      }
    } catch (error) {
      console.error("Error en loadStudents:", error);
      setLoadingStudents(false);
    }
  }, [user, toast]);

  const handleSelectCourse = useCallback(async (course: Course) => {
    setPrevMainState(s => s);
    setSelectedCourse(course);
    setMainState('courseWelcome');
    setSelectedInscripcionId(null);
    setSelectedStudent(null);

    setCourseTopics(JSON.parse(JSON.stringify(initialCourseTopics)));
    setStudentGrades({});

    await loadStudents(course);
  }, [loadStudents]);

  // --- Selección de Estudiante ---
  const handleSelectStudent = useCallback(async (student: EstudianteInscrito) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    isGradesDirty.current = false;

    setPrevMainState(current => current);
    setSelectedInscripcionId(student.inscripcion_id);
    setSelectedStudent(student);
    setMainState('viewing');
    setActiveTab('hojaDeVida');
    setPrevTab('hojaDeVida');

    // Uso de caché para foto instantánea
    setSignedUrl(null);
    if (student.foto_path) {
      if (fotoUrls[student.foto_path]) {
        setSignedUrl(fotoUrls[student.foto_path]);
      } else {
        supabase.storage.from("entrevistas-fotos").createSignedUrl(student.foto_path, 60 * 60).then(({ data }) => {
          if (data?.signedUrl) setSignedUrl(bustUrl(data.signedUrl));
        });
      }
    }

    const { data: asistenciaData } = await supabase
      .from('asistencias_academia')
      .select('asistencias')
      .eq('inscripcion_id', student.inscripcion_id)
      .single();

    const savedGrades = (asistenciaData?.asistencias as StudentGrades) || {};

    const loadedGrades: StudentGrades = {};
    initialCourseTopics.forEach(topic => {
      loadedGrades[topic.id] = {};
      const savedTopicGrades = savedGrades[topic.id] || {};
      topic.grades.forEach(g => {
        loadedGrades[topic.id][g.id] = savedTopicGrades[g.id] || '';
      });
    });

    setStudentGrades(loadedGrades);
    setInitialGrades(loadedGrades); // Guardar estado inicial para detectar cambios
  }, [fotoUrls]);

  // --- Actualizaciones de Hoja de Vida ---
  const onUpdated = useCallback((r: Entrevista & { _tempPreview?: string | null }) => {
    console.log('[EstudiantePage] onUpdated recibido:', r);
    setStudents((xs) => {
      const updated = xs.map((x) => (x.id === r.id ? { ...x, ...r } : x));
      // console.log('[EstudiantePage] Students array actualizado. Longitud:', updated.length);
      return updated;
    });
    setSelectedStudent(prev => {
      const next = prev ? { ...prev, ...r } : null;
      console.log('[EstudiantePage] selectedStudent actualizado:', next);
      return next;
    });

    if (r._tempPreview) {
      setSignedUrl(r._tempPreview);
    } else if (r.foto_path) {
      supabase.storage.from("entrevistas-fotos").createSignedUrl(r.foto_path, 60 * 60).then(({ data }) => {
        if (data?.signedUrl) {
          const url = bustUrl(data.signedUrl);
          if (url) {
            setFotoUrls(prev => ({ ...prev, [r.foto_path!]: url }));
            setSignedUrl(url);
          }
        }
      });
    }
  }, []);

  const handleHojaDeVidaDelete = useCallback((id: string) => {
    setStudents((xs) => xs.filter((x) => x.id !== id));
    setPrevMainState(current => current);
    setMainState('courseWelcome');
    setSelectedInscripcionId(null);
    setSelectedStudent(null);
  }, []);

  // --- Lógica de Guardado de Notas ---
  const saveGradesToDb = useCallback(async (gradesToSave: StudentGrades, inscripcionId: string) => {
    if (!inscripcionId) return;
    try {
      // 1. Guardar asistencias normalmente
      await supabase
        .from('asistencias_academia')
        .upsert({
          inscripcion_id: inscripcionId,
          asistencias: gradesToSave,
          updated_at: new Date().toISOString()
        }, { onConflict: 'inscripcion_id' });

      // 2. Procesar inasistencias pendientes (solo para topic 1 = Asistencia)
      if (selectedCourse && gradesToSave[1]) {
        const topicGrades = gradesToSave[1];
        const initialTopicGrades = (initialGrades as any)?.[1] || {};

        // Encontrar cambios en el topic de Asistencia
        for (const [placeholderId, newValue] of Object.entries(topicGrades)) {
          const previousValue = initialTopicGrades[placeholderId];

          if (previousValue !== newValue) {
            // Encontrar número de clase
            const assistanceTopic = initialCourseTopics.find(t => t.id === 1);
            const claseIndex = assistanceTopic?.grades.findIndex(g => g.id === parseInt(placeholderId));

            if (claseIndex !== undefined && claseIndex >= 0) {
              const claseNumero = claseIndex + 1;

              // Si marca como 'no' -> registrar inasistencia
              if (newValue === 'no') {
                await supabase.rpc('fn_registrar_inasistencia', {
                  p_inscripcion_id: inscripcionId,
                  p_curso_id: selectedCourse.id,
                  p_clase_numero: claseNumero
                });
              }
              // Si cambia de 'no' a 'si' -> marcar como nivelado
              else if (previousValue === 'no' && newValue === 'si' && user?.servidorId) {
                await supabase.rpc('fn_nivelar_inasistencia', {
                  p_inscripcion_id: inscripcionId,
                  p_curso_id: selectedCourse.id,
                  p_clase_numero: claseNumero,
                  p_nivelado_por: user.servidorId
                });
              }
            }
          }
        }
      }

      // Actualizar initialGrades después de guardar exitosamente
      setInitialGrades(gradesToSave);
      isGradesDirty.current = false;
      toast.success("Asistencia guardada");
    } catch (error: any) {
      toast.error("Error de autoguardado: " + error.message);
    }
  }, [toast, supabase, selectedCourse, initialGrades, user]);

  const handleGradeChange = useCallback((topicId: number, gradeId: number, value: string) => {
    isGradesDirty.current = true;

    setStudentGrades(prev => {
      const newTopicGrades = { ...(prev[topicId] || {}), [gradeId]: value };
      const newState = { ...prev, [topicId]: newTopicGrades };

      // Actualizar progreso y missedCount en tiempo real en la lista de estudiantes (Sidebar)
      if (selectedInscripcionId) {
        let totalChecks = 0;
        const missed: number[] = [];
        // Calcular sobre el topic 1 (Asistencia) del nuevo estado
        const attendanceGrades = newState[1] || {};
        for (let i = 1; i <= 12; i++) {
          const val = attendanceGrades[i];
          if (val === 'si') totalChecks++;
          if (val === 'no') missed.push(i);
        }
        const progress = Math.min(100, Math.round((totalChecks / 12) * 100));

        setStudents(currentStudents =>
          currentStudents.map(s =>
            s.inscripcion_id === selectedInscripcionId
              ? { ...s, progress, missedClasses: missed, missedCount: missed.length }
              : s
          )
        );
      }

      return newState;
    });
  }, [selectedInscripcionId]);

  useEffect(() => {
    if (!selectedInscripcionId || !isGradesDirty.current) return;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(() => {
      saveGradesToDb(studentGrades, selectedInscripcionId);
    }, 1000);

    return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); };
  }, [studentGrades, selectedInscripcionId, saveGradesToDb]);

  // --- Lógica de Asistencia Masiva (CORREGIDA) ---
  const handleMarkAttendanceDB = useCallback(async (inscripcion_id: string, status: 'si' | 'no') => {
    const topicId = 1;
    if (!attendanceClassId) throw new Error("Clase no seleccionada");

    try {
      // 1. Obtener datos actuales para no sobrescribir otras notas
      const { data: currentData } = await supabase
        .from('asistencias_academia')
        .select('asistencias')
        .eq('inscripcion_id', inscripcion_id)
        .single();

      const currentGrades = (currentData?.asistencias as StudentGrades) || {};
      const newTopicGrades = { ...(currentGrades[topicId] || {}), [attendanceClassId]: status };
      const newStudentGrades = { ...currentGrades, [topicId]: newTopicGrades };

      // 2. Guardar en Base de Datos
      const { error } = await supabase
        .from('asistencias_academia')
        .upsert({
          inscripcion_id: inscripcion_id,
          asistencias: newStudentGrades,
          updated_at: new Date().toISOString()
        }, { onConflict: 'inscripcion_id' });

      if (error) throw error;

      // 3. ACTUALIZACIÓN OPTIMISTA DEL UI (La clave de la fluidez)
      // Recalcular progreso y missedCount inmediatamente
      let totalChecks = 0;
      const missedArr: number[] = [];
      const attendanceGrades = newStudentGrades[1] || {};
      for (let i = 1; i <= 12; i++) {
        const val = attendanceGrades[i];
        if (val === 'si') totalChecks++;
        if (val === 'no') missedArr.push(i);
      }
      const newProgress = Math.min(100, Math.round((totalChecks / 12) * 100));

      setStudents(prev => prev.map(s => s.inscripcion_id === inscripcion_id ? { ...s, progress: newProgress, missedClasses: missedArr, missedCount: missedArr.length } : s));

      // Si el estudiante que estamos marcando es el que tenemos abierto en el panel principal,
      // actualizamos el estado local 'studentGrades' inmediatamente.
      if (inscripcion_id === selectedInscripcionId) {
        setStudentGrades(prev => ({
          ...prev,
          [topicId]: {
            ...(prev[topicId] || {}),
            [attendanceClassId]: status
          }
        }));
        // Nota: No marcamos isGradesDirty.current = true para evitar un doble guardado innecesario.
      }

    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
      throw error;
    }
  }, [attendanceClassId, selectedInscripcionId, toast]);

  const handlePromoteStudent = useCallback(async () => {
    if (!selectedStudent || !selectedCourse) return;

    const nextCourse = getNextCourse(selectedCourse.id);
    if (!nextCourse) {
      toast.error("No hay siguiente nivel definido.");
      return;
    }

    // Esperar un momento para que el confetti sea visible antes de mostrar el modal
    setTimeout(() => {
      setPromotionData({
        studentName: selectedStudent.nombre || '',
        nextCourseName: nextCourse.name || ''
      });
      setShowGraduationModal(true);
    }, 600); // 600ms delay para que el confetti sea visible
  }, [selectedStudent, selectedCourse, toast]);

  // Función que se ejecuta cuando se confirma la promoción desde el modal
  const confirmPromotion = useCallback(async () => {
    if (!selectedStudent || !selectedCourse || !promotionData) return;

    const nextCourse = getNextCourse(selectedCourse.id);
    if (!nextCourse) return;

    setShowGraduationModal(false);

    try {
      const { error } = await supabase
        .from('inscripciones')
        .update({ estado: 'promovido' })
        .eq('id', selectedStudent.inscripcion_id);

      if (error) throw error;

      // ACTUALIZACIÓN DE ORIGEN: Si es Restauración 1, marcar origen como 'Maestros' para la siguiente matrícula
      if (selectedCourse.title === 'Restauración 1') {
        await supabase.from('entrevistas').update({ origen: 'Maestros' }).eq('id', selectedStudent.id);
      }

      toast.success(`Promovido a ${nextCourse.name}`);

      // Actualizar estado local
      setStudents(prev => prev.map(s => s.id === selectedStudent.id ? { ...s, estado_inscripcion: 'promovido' } : s));
      setSelectedStudent(prev => prev ? { ...prev, estado_inscripcion: 'promovido' } : null);

    } catch (e: any) {
      toast.error("Error al promover: " + e.message);
    }
  }, [selectedStudent, selectedCourse, promotionData, toast]);

  const cancelAttendanceMode = useCallback(() => {
    setIsAttendanceModeActive(false);
    setAttendanceClassId(null);
  }, []);

  const completeAttendanceMode = useCallback(() => {
    toast.success("Asistencia finalizada correctamente");
    cancelAttendanceMode();
    setIsAttendanceCompleted(true);
  }, [cancelAttendanceMode, toast]);

  // --- Nivelación Individual desde Sidebar ---
  const handleOpenNivelarModal = useCallback((student: EstudianteInscrito) => {
    setNivelarStudent(student);
    setShowNivelarModal(true);
  }, []);

  const handleNivelarClase = useCallback(async (student: EstudianteInscrito, claseNumero: number) => {
    if (!selectedCourse || !user?.servidorId) return;

    try {
      // 1. Obtener grades actuales de BD
      const { data: currentData } = await supabase
        .from('asistencias_academia')
        .select('asistencias')
        .eq('inscripcion_id', student.inscripcion_id)
        .single();

      const currentGrades = (currentData?.asistencias as StudentGrades) || {};
      const newTopicGrades = { ...(currentGrades[1] || {}), [claseNumero]: 'si' };
      const newStudentGrades = { ...currentGrades, [1]: newTopicGrades };

      // 2. Guardar en BD
      const { error: saveError } = await supabase
        .from('asistencias_academia')
        .upsert({
          inscripcion_id: student.inscripcion_id,
          asistencias: newStudentGrades,
          updated_at: new Date().toISOString()
        }, { onConflict: 'inscripcion_id' });

      if (saveError) throw saveError;

      // 3. Llamar RPC de nivelación
      await supabase.rpc('fn_nivelar_inasistencia', {
        p_inscripcion_id: student.inscripcion_id,
        p_curso_id: selectedCourse.id,
        p_clase_numero: claseNumero,
        p_nivelado_por: user.servidorId
      });

      // 4. Recalcular progreso y missedClasses
      let totalChecks = 0;
      const missedArr: number[] = [];
      const attendanceGrades = newStudentGrades[1] || {};
      for (let i = 1; i <= 12; i++) {
        const val = attendanceGrades[i];
        if (val === 'si') totalChecks++;
        if (val === 'no') missedArr.push(i);
      }
      const newProgress = Math.min(100, Math.round((totalChecks / 12) * 100));

      // 5. Calcular nuevas missedDates (quitando la clase nivelada)
      const prevMissedDates = student.missedDates || {};
      const newMissedDates = { ...prevMissedDates };
      delete newMissedDates[claseNumero];

      // 6. Actualizar UI optimista
      setStudents(prev => prev.map(s =>
        s.inscripcion_id === student.inscripcion_id
          ? { ...s, progress: newProgress, missedClasses: missedArr, missedCount: missedArr.length, missedDates: newMissedDates }
          : s
      ));

      // 6. Si este estudiante está seleccionado, actualizar también studentGrades
      if (selectedInscripcionId === student.inscripcion_id) {
        setStudentGrades(prev => ({
          ...prev,
          [1]: { ...(prev[1] || {}), [claseNumero]: 'si' }
        }));
        setInitialGrades(prev => ({
          ...prev,
          [1]: { ...(prev[1] || {}), [claseNumero]: 'si' }
        }));
      }

      // 8. Actualizar el nivelarStudent para que el modal refleje el cambio
      setNivelarStudent(prev => {
        if (!prev || prev.inscripcion_id !== student.inscripcion_id) return prev;
        return { ...prev, progress: newProgress, missedClasses: missedArr, missedCount: missedArr.length, missedDates: newMissedDates };
      });

      toast.success(`Clase #${claseNumero} nivelada correctamente`);
    } catch (err: any) {
      toast.error('Error al nivelar: ' + err.message);
    }
  }, [selectedCourse, user, supabase, toast, selectedInscripcionId]);

  // --- Helpers Visuales ---
  const getTabPanelClasses = (tabName: ActiveTab) => {
    const base = 'w-full h-full flex flex-col min-h-0 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] [grid-area:1/1]';
    const activeIndex = TAB_INDICES[activeTab];
    const prevIndex = TAB_INDICES[prevTab];
    const currentIndex = TAB_INDICES[tabName];

    if (currentIndex === activeIndex) return `${base} opacity-100 translate-x-0 pointer-events-auto`;
    if (currentIndex === prevIndex && activeTab !== prevTab) {
      const exit = activeIndex > prevIndex ? '-translate-x-8 scale-[0.985]' : 'translate-x-8 scale-[0.985]';
      return `${base} opacity-0 ${exit} pointer-events-none`;
    }
    const hidden = currentIndex > activeIndex ? 'translate-x-8' : '-translate-x-8';
    return `${base} opacity-0 ${hidden} pointer-events-none`;
  };

  const getContentPanelClasses = (activeStates: MainPanelState | MainPanelState[]) => {
    const base = 'transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]';
    const statesArray = Array.isArray(activeStates) ? activeStates : [activeStates];
    const isActive = statesArray.includes(mainState);
    const wasActive = statesArray.includes(prevMainState);
    const currentLevel = STATE_LEVELS[mainState];
    const prevLevel = STATE_LEVELS[prevMainState];
    const myLevel = statesArray.length > 0 ? STATE_LEVELS[statesArray[0]] : -1;

    if (isActive) return `${base} opacity-100 translate-x-0 scale-100 pointer-events-auto`;
    if (wasActive && mainState !== prevMainState) {
      const exitDir = (currentLevel > prevLevel) ? '-translate-x-8' : 'translate-x-8';
      return `${base} opacity-0 ${exitDir} scale-[0.985] pointer-events-none`;
    }
    const hiddenDir = myLevel > currentLevel ? 'translate-x-8' : '-translate-x-8';
    return `${base} opacity-0 ${hiddenDir} pointer-events-none`;
  };

  const isDetailView = mainState === 'creating' || mainState === 'viewing';

  // Estado para estudiantes pendientes desde BD (no depende del estudiante seleccionado)
  const [pendingStudentsFromDB, setPendingStudentsFromDB] = useState<any[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);

  // Cargar pendientes desde BD cuando cambia el curso
  useEffect(() => {
    if (!selectedCourse) {
      setPendingStudentsFromDB([]);
      return;
    }

    const fetchPending = async () => {
      setLoadingPending(true);
      try {
        // TEMPORAL: Función RPC no existe en Supabase
        // const { data, error } = await supabase.rpc('fn_obtener_pendientes_curso', {
        //   p_curso_id: selectedCourse.id
        // });
        //
        // if (!error && data) {
        //   console.log('📋 Pendientes cargados desde BD:', data);
        //   setPendingStudentsFromDB(data);
        // } else {
        //   console.error('Error cargando pendientes:', error);
        //   setPendingStudentsFromDB([]);
        // }

        setPendingStudentsFromDB([]); // Por ahora vacío
      } catch (err) {
        console.error('Error en fetchPending:', err);
        setPendingStudentsFromDB([]);
      } finally {
        setLoadingPending(false);
      }
    };

    fetchPending();
  }, [selectedCourse, supabase]); // Added supabase to dependency array

  // El botón aparece si hay pendientes en la BD (no depende del estudiante seleccionado)
  const hasPendingStudents = pendingStudentsFromDB.length > 0;

  if (authLoading) return <LoadingScreen text="Verificando sesión..." />;
  if (authError || !user) return <ErrorScreen message={authError || "No estás autenticado."} />;

  return (
    <GlobalPresenceProvider userName={currentUserName} userId={user?.servidorId || ''}>
      <main className="relative flex h-screen w-full items-stretch justify-stretch p-0 text-gray-900 selection:bg-indigo-300/40 selection:text-gray-900 bg-[#F8FAFC] overflow-hidden">
        {/* Fondo Ambiental Premium - Más Vibrante */}
        <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
          <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] rounded-full bg-indigo-500/30 blur-[100px]" />
          <div className="absolute top-[10%] right-[-20%] w-[60vw] h-[60vw] rounded-full bg-purple-500/25 blur-[100px]" />
          <div className="absolute bottom-[-20%] left-[20%] w-[60vw] h-[60vw] rounded-full bg-blue-500/30 blur-[100px]" />
        </div>
        <StyleDefinitions />
        <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background:radial-gradient(circle,_#000_1px,_transparent_1px)] [background-size:22px_22px]" />

        <div className="relative flex w-full min-h-0 overflow-hidden rounded-none border-none bg-white/20 backdrop-blur-3xl ring-0 shadow-none bg-[linear-gradient(145deg,rgba(99,102,241,0.05),rgba(255,255,255,0.05))] md:flex-row">

          {/* SIDEBAR MEMOIZADA */}
          {selectedCourse !== null && (
            <MemoizedStudentSidebar
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
              onStartAttendance={() => isAttendanceCompleted ? setShowAttendanceAlreadyTakenModal(true) : setIsAttendanceModalOpen(true)}
              onMarkAttendanceDB={handleMarkAttendanceDB}
              onCancelAttendance={cancelAttendanceMode}
              onCompleteAttendance={completeAttendanceMode}
              isAttendanceCompleted={isAttendanceCompleted}
              showConfirmation={showConfirmation}
              setShowConfirmation={setShowConfirmation}
              hasPendingStudents={hasPendingStudents}
              onShowPending={() => setShowPendingModal(true)}
              onNivelarModal={handleOpenNivelarModal}
            />
          )}

          <div className={`absolute inset-0 md:relative w-full h-full md:h-auto flex flex-1 flex-col min-w-0 min-h-0 ${fixedContentBg} transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isDetailView || mainState === 'welcome' ? 'translate-x-0' : 'translate-x-full'} md:translate-x-0`}>

            {/* Topbar */}
            <div className="sticky top-0 z-10 flex items-end justify-start gap-4 border-b border-white/60 bg-gradient-to-b from-white/70 to-white/40 px-6 pt-3 backdrop-blur-xl">
              {isDetailView && (
                <button type="button" onClick={handleGoBackToStudentList} className="flex md:hidden items-center justify-center gap-1.5 p-2 rounded-full border border-white/70 bg-white/25 backdrop-blur-2xl text-gray-700 shadow-[0_4px_12px_-4px_rgba(2,6,23,0.2)] active:scale-95 transition-transform" aria-label="Volver">
                  <ArrowLeft size={18} />
                </button>
              )}
              {(mainState === 'viewing') && (
                <nav className="flex items-center p-1.5 rounded-[2rem] border border-slate-200/60 bg-white/40 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-white/80">
                  <TabButton icon={<FileText className="h-4 w-4" />} label="Hoja de Vida" isActive={activeTab === 'hojaDeVida'} onClick={() => handleTabClick('hojaDeVida')} />
                  <TabButton icon={<UserCheck className="h-4 w-4" />} label="Asistencias" isActive={activeTab === 'grades'} onClick={() => handleTabClick('grades')} />
                  <TabButton icon={<BarChart3 className="h-4 w-4" />} label="Reportes" isActive={activeTab === 'reports'} onClick={() => handleTabClick('reports')} />
                </nav>
              )}
              {/* Logout Button (Desktop Topbar) */}
              <button onClick={handleLogout} className="ml-auto p-2 text-gray-500 hover:text-red-600 hover:bg-black/5 rounded-full transition-colors" title="Cerrar Sesión">
                <LogOut size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 grid grid-cols-1 [grid-template-areas:'stack'] overflow-hidden">
              <WelcomePanel
                onSelectCourse={handleSelectCourse}
                className={getContentPanelClasses('welcome')}
                isActive={mainState === 'welcome'}
                courses={courses}
                loading={loadingCourses || authLoading}
                userName={currentUserName}
              />

              {mainState === 'courseWelcome' && (
                <div className="md:hidden flex items-center justify-center p-8 text-center text-gray-500 [grid-area:stack]">Selecciona un estudiante.</div>
              )}

              {mainState === 'courseWelcome' && (
                <CourseWelcomeMessage courseName={selectedCourse?.title || 'Curso'} className={getContentPanelClasses('courseWelcome')} />
              )}

              {(mainState === 'viewing') && (
                <div className={`[grid-area:stack] w-full h-full grid grid-cols-1 [grid-template-areas:'stack'] overflow-hidden ${getContentPanelClasses(['creating', 'viewing'])}`}>

                  {/* Pestaña Notas: MEMOIZADA */}
                  <div className={getTabPanelClasses('grades')}>
                    <MemoizedGradesTabContent
                      selectedStudent={selectedStudent}
                      courseTopics={initialCourseTopics}
                      studentGrades={studentGrades}
                      onGradeChange={handleGradeChange}
                      selectedCourse={selectedCourse}
                      onPromote={handlePromoteStudent}
                    />
                  </div>

                  {/* Pestaña Hoja de Vida */}
                  <div className={getTabPanelClasses('hojaDeVida')}>
                    {selectedStudent ? (
                      <MemoizedHojaDeVida key={selectedStudent.id} row={selectedStudent} signedUrl={signedUrl} onUpdated={onUpdated} onDeleted={handleHojaDeVidaDelete} className="animate-slideIn" currentUserName={currentUserName} />
                    ) : (
                      <div className="p-6 text-center text-gray-600">No seleccionado.</div>
                    )}
                  </div>

                  {/* Pestaña Reportes */}
                  <div className={getTabPanelClasses('reports')}>
                    <section className="p-6 md:p-8 overflow-y-auto flex-1 min-h-0">
                      <CardSection title="Reportes de Estudiantes">
                        <p className="text-gray-700 text-[15px]">Próximamente.</p>
                      </CardSection>
                    </section>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isAttendanceModalOpen && (
            <ModalTomarAsistencia topics={courseTopics} onClose={() => setIsAttendanceModalOpen(false)} onSelectClass={(classId: number) => { setIsAttendanceModalOpen(false); setIsAttendanceModeActive(true); setAttendanceClassId(classId); }} />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showConfirmation && <CupertinoConfirmationDialog onConfirm={() => window.location.reload()} onCancel={() => setShowConfirmation(false)} />}
        </AnimatePresence>
        <AnimatePresence>
          {showAttendanceAlreadyTakenModal && <CupertinoAlertDialog title="Asistencia Registrada" message="Ya has registrado la asistencia para esta clase." onConfirm={() => setShowAttendanceAlreadyTakenModal(false)} />}
        </AnimatePresence>

        {/* Modal de Graduación */}
        <GraduationModal
          isOpen={showGraduationModal}
          studentName={promotionData?.studentName || ''}
          nextCourseName={promotionData?.nextCourseName || ''}
          onConfirm={confirmPromotion}
          onCancel={() => setShowGraduationModal(false)}
        />

        {/* Modal de Estudiantes Pendientes - Datos desde BD */}
        <PendingStudentsModal
          isOpen={showPendingModal}
          students={pendingStudentsFromDB.map(p => ({
            id: p.inscripcion_id,
            nombre: p.estudiante_nombre || 'Sin nombre',
            foto_path: null,
            missedClasses: p.clases_perdidas || [],
            missedDates: p.fechas_inasistencia || []
          }))}
          fotoUrls={fotoUrls}
          onClose={() => setShowPendingModal(false)}
          onMarkAsLeveled={async (inscripcionId, claseNumero) => {
            if (!selectedCourse || !user?.servidorId) return;

            try {
              const { error } = await supabase.rpc('fn_nivelar_inasistencia', {
                p_inscripcion_id: inscripcionId,
                p_curso_id: selectedCourse.id,
                p_clase_numero: claseNumero,
                p_nivelado_por: user.servidorId
              });

              if (!error) {
                toast.success('Estudiante nivelado correctamente');
                // Recargar pendientes desde BD
                // TEMPORAL: Comentado hasta que se cree la función
                // const { data } = await supabase.rpc('fn_obtener_pendientes_curso', {
                //   p_curso_id: selectedCourse.id
                // });
                // setPendingStudentsFromDB(data || []);
                setPendingStudentsFromDB([]); // Por ahora vacío
              } else {
                toast.error('Error al nivelar: ' + error.message);
              }
            } catch (err: any) {
              toast.error('Error: ' + err.message);
            }
          }}
        />

        {/* Modal de Nivelación Individual Premium */}
        <AnimatePresence>
          {showNivelarModal && nivelarStudent && (
            <NivelarIndividualModal
              student={nivelarStudent}
              fotoUrls={fotoUrls}
              onClose={() => { setShowNivelarModal(false); setNivelarStudent(null); }}
              onNivelarClase={handleNivelarClase}
            />
          )}
        </AnimatePresence>


      </main>
    </GlobalPresenceProvider>
  );
}

// ======================= COMPONENTES AUXILIARES OPTIMIZADOS =======================

const MemoizedGradesTabContent = memo(({
  selectedStudent,
  courseTopics,
  studentGrades,
  onGradeChange,
  selectedCourse,
  onPromote
}: {
  selectedStudent: EstudianteInscrito | null;
  courseTopics: CourseTopic[];
  studentGrades: StudentGrades;
  onGradeChange: (t: number, g: number, v: string) => void;
  selectedCourse: Course | null;
  onPromote: () => void;
}) => {
  const asistenciasPendientes = useMemo(() => {
    let count = 0;
    for (const topic of courseTopics) {
      const grades = studentGrades[topic.id] || {};
      for (const placeholder of topic.grades) {
        if (!grades[placeholder.id] || grades[placeholder.id] === '') count++;
      }
    }
    return count;
  }, [studentGrades, courseTopics]);

  return (
    <section className="p-4 md:p-6 lg:p-8 overflow-y-auto flex-1 min-h-0">
      <div className="relative rounded-[2rem] border border-white/90 bg-white/80 backdrop-blur-3xl shadow-[0_30px_60px_-12px_rgba(0,0,0,0.12)] ring-1 ring-white/60 p-6 md:p-8 overflow-hidden transition-all duration-300">
        {/* Premium Decorative Elements */}
        <div className="pointer-events-none absolute -top-32 -right-32 h-80 w-80 rounded-full bg-gradient-to-br from-indigo-100/40 to-purple-100/40 blur-[80px]" />
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-gradient-to-tr from-blue-100/40 to-teal-100/40 blur-[80px]" />

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[20px] md:text-[22px] font-semibold text-gray-900 tracking-[-0.015em] flex flex-col md:flex-row md:items-center">
            <span>Asistencias del Estudiante:</span>
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent md:ml-2">
              {selectedStudent?.nombre ?? 'N/A'}
            </span>
          </h2>
          <div className="flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.05)] ring-1 ring-black/5 backdrop-blur-md">
            <span className="text-sm font-medium text-gray-700">Pendientes</span>
            <span className={classNames("grid h-6 w-6 place-items-center rounded-full text-xs font-bold text-white ring-2 ring-white transition-all", asistenciasPendientes > 0 ? "bg-red-500" : "bg-green-500")}>
              {asistenciasPendientes}
            </span>
          </div>
        </div>

        {/* PROMOTION BANNER */}
        {asistenciasPendientes === 0 && selectedCourse && selectedStudent?.estado_inscripcion !== 'promovido' && (
          <div className="relative mb-6 p-4 rounded-2xl bg-gradient-to-r from-emerald-50/80 via-teal-50/80 to-cyan-50/80 backdrop-blur-xl border border-emerald-200/60 shadow-lg ring-1 ring-emerald-100/50 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 overflow-hidden">
            {/* Decorative Elements */}
            <div className="pointer-events-none absolute -top-10 -left-10 h-32 w-32 rounded-full bg-gradient-to-br from-emerald-400/10 to-teal-400/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-gradient-to-tl from-yellow-400/10 to-amber-400/10 blur-2xl" />

            <div className="relative z-10">
              <h3 className="text-emerald-900 font-bold text-lg flex items-center gap-2">
                🎉 ¡Felicitaciones!
              </h3>
              <p className="text-emerald-800 text-sm mt-1">
                {selectedStudent?.nombre} ha completado todas las asistencias.
              </p>
            </div>
            {getNextCourse(selectedCourse.id) && (
              <div className="relative z-10 flex flex-col items-end gap-1 w-full md:w-auto">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700/80 mr-1">
                  Promover a
                </span>
                <ConfettiButton
                  onClick={onPromote}
                  className="w-full md:w-auto px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold rounded-lg shadow-md transition-all active:scale-95 border border-emerald-400/20"
                  confettiOptions={{
                    particleCount: 150,
                    spread: 120,
                    startVelocity: 35,
                    colors: ['#10b981', '#14b8a6', '#22c55e', '#fbbf24', '#f59e0b'],
                    shapes: ['circle', 'square'],
                    scalar: 1.2,
                    zIndex: 10000,
                  }}
                >
                  {getNextCourse(selectedCourse.id)?.name}
                </ConfettiButton>
              </div>
            )}
          </div>
        )}

        {selectedStudent?.estado_inscripcion === 'promovido' && (
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-emerald-100 to-green-100 border border-emerald-200 shadow-sm text-center">
            <h3 className="text-emerald-900 font-bold text-lg">✅ Estudiante Promovido</h3>
            <p className="text-emerald-800 text-sm">Esperando matrícula en el siguiente nivel.</p>
          </div>
        )}


        <div className="space-y-6">
          {courseTopics.length === 0 && <p className="text-sm text-gray-700 text-center py-4">No hay temas.</p>}
          {courseTopics.map((topic) => (
            <div id={`topic-${topic.id}`} key={`wrap-${topic.id}`}>
              <div className="flex items-center gap-2 mb-4">
                <UserCheck size={16} className="text-indigo-900/70" />
                <h3 className="text-base md:text-[17px] font-semibold tracking-tight text-indigo-900">{topic.title}</h3>
              </div>
              <GradeGrid gradePlaceholders={topic.grades} studentGradesForTopic={studentGrades[topic.id] || {}} topicId={topic.id} onGradeChange={onGradeChange} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});
MemoizedGradesTabContent.displayName = 'GradesTabContent';

const MemoizedStudentSidebar = memo(StudentSidebar);

function StudentSidebar({
  students,
  selectedStudentId,
  mainState,
  onSelectStudent,
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
  isAttendanceCompleted,
  showConfirmation,
  setShowConfirmation,
  hasPendingStudents,
  onShowPending,
  onNivelarModal,
}: {
  students: EstudianteInscrito[];
  selectedStudentId: string | null;
  mainState: MainPanelState;
  onSelectStudent: (student: EstudianteInscrito) => void;
  className?: string;
  onGoBackToWelcome: () => void;
  courseName?: string;
  loading: boolean;
  fotoUrls: Record<string, string>;
  isAttendanceModeActive: boolean;
  onStartAttendance: () => void;
  onCancelAttendance: () => void;
  onCompleteAttendance: () => void;
  onMarkAttendanceDB: (inscripcion_id: string, status: 'si' | 'no') => Promise<void>;
  isAttendanceCompleted: boolean;
  showConfirmation: boolean;
  setShowConfirmation: (show: boolean) => void;
  hasPendingStudents: boolean;
  onShowPending: () => void;
  onNivelarModal: (student: EstudianteInscrito) => void;
}) {
  const isDetailView = mainState === 'creating' || mainState === 'viewing';
  const [currentAttendanceStudentIndex, setCurrentAttendanceStudentIndex] = useState(0);
  const [isMarkingStudentId, setIsMarkingStudentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  useEffect(() => {
    if (isAttendanceModeActive) {
      setCurrentAttendanceStudentIndex(0);
      setIsMarkingStudentId(null);
    }
  }, [isAttendanceModeActive]);

  const filteredStudents = useMemo(() => {
    if (!searchQuery) return students;
    const q = searchQuery.toLowerCase();
    return students.filter(s => s.nombre?.toLowerCase().includes(q) || s.cedula?.includes(q));
  }, [students, searchQuery]);

  return (
    <aside className={`absolute inset-0 md:relative w-full h-full md:h-full md:w-1/3 lg:w-1/4 flex-shrink-0 flex flex-col border-b md:border-b-0 md:border-r border-slate-800/40 bg-gradient-to-b from-[#0f172a] to-[#111827] backdrop-blur-2xl [box-shadow:inset_0_1px_0_rgba(255,255,255,0.05),0_20px_60px_-30px_rgba(2,6,23,0.5)] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isDetailView ? 'translate-x-[-100%] md:translate-x-0' : 'translate-x-0'} ${className}`}>
      <div className="flex-shrink-0 p-3 pb-2 border-b border-slate-800/50 bg-slate-900/40 backdrop-blur-xl">
        <button type="button" onClick={onGoBackToWelcome} className="flex items-center gap-1.5 px-2 py-1 text-sm font-medium text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors duration-150">
          <ArrowLeft size={16} />
          <span className="text-[13px]">Volver</span>
        </button>
        {courseName && <div className="pt-2 text-center relative flex justify-center items-center">
          <h2 className="text-xl font-bold tracking-[-0.03em] bg-gradient-to-r from-blue-100 to-indigo-100 bg-clip-text text-transparent uppercase text-[15px]">{courseName}</h2>
          <button onClick={handleLogout} className="absolute right-0 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors md:hidden">
            <LogOut size={16} />
          </button>
        </div>}
      </div>

      <div className="flex-shrink-0 p-4 border-b border-slate-800/50">
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar estudiante…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={isAttendanceModeActive}
            className="w-full rounded-xl border border-slate-800/60 bg-slate-950/40 backdrop-blur-xl py-2 px-10 text-sm text-slate-100 placeholder-slate-500 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 transition disabled:opacity-50"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
        </div>
      </div>

      {isAttendanceModeActive && (
        <div className="flex-shrink-0 p-3 border-b border-white/60 bg-red-50/50">
          <button onClick={onCancelAttendance} className="w-full text-center text-sm font-medium text-red-600 hover:text-red-800 transition-colors">Cancelar Asistencia</button>
        </div>
      )}

      <motion.nav
        className="flex-1 overflow-y-auto px-6 md:px-4 py-3 space-y-4 md:space-y-3 min-h-0 pb-28 md:pb-4 custom-scrollbar"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {loading ? (
          <div className="flex justify-center p-8"><span className="loader"></span></div>
        ) : filteredStudents.length === 0 ? (
          <div className="text-center p-8 text-slate-500 text-sm font-medium">No se encontraron estudiantes.</div>
        ) : (
          filteredStudents.map((student, index) => (
            <StudentSidebarItem
              index={index}
              key={student.id}
              student={student}
              fotoUrls={fotoUrls}
              isActive={selectedStudentId === student.id}
              isAttendanceModeActive={isAttendanceModeActive}
              isCurrentAttendanceTarget={isAttendanceModeActive && filteredStudents[currentAttendanceStudentIndex]?.id === student.id}
              isCompleted={false}
              isLoading={isMarkingStudentId === student.inscripcion_id}
              onMarkAttendance={async (status: 'si' | 'no') => {
                setIsMarkingStudentId(student.inscripcion_id);
                try {
                  await onMarkAttendanceDB(student.inscripcion_id, status);
                  const nextIndex = currentAttendanceStudentIndex + 1;
                  setCurrentAttendanceStudentIndex(nextIndex);
                  if (nextIndex >= filteredStudents.length) onCompleteAttendance();
                } catch (e) { console.error("Fallo al marcar", e); } finally { setIsMarkingStudentId(null); }
              }}
              onSelectStudent={onSelectStudent}
              onNivelar={(s: EstudianteInscrito) => {
                onNivelarModal(s);
              }}
            />
          ))
        )}
      </motion.nav>

      <div className="flex-shrink-0 p-4 border-t border-slate-800/50 min-h-[90px] flex flex-col items-center justify-center gap-3 bg-slate-900/60 backdrop-blur-xl absolute bottom-0 left-0 right-0 z-20 md:relative">
        {hasPendingStudents && (
          <button
            onClick={onShowPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-all border-orange-500/30 bg-orange-600/10 text-orange-100 shadow-[0_4px_20px_-8px_rgba(249,115,22,0.5)] hover:bg-orange-600/20 active:scale-95"
          >
            <AlertTriangle size={18} />
            <span>Pendientes por Nivelar</span>
          </button>
        )}
        <button onClick={onStartAttendance} className="flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-all border-blue-500/30 bg-blue-600/10 text-blue-100 shadow-[0_4px_20px_-8px_rgba(59,130,246,0.5)] hover:bg-blue-600/20 active:scale-95 disabled:opacity-50">
          <UserCheck size={18} />
          <span>{isAttendanceCompleted ? "Asistencia Tomada" : "Tomar Asistencia"}</span>
        </button>
      </div>
    </aside>
  );
}

function StudentSidebarItem({ student, fotoUrls, isActive, isAttendanceModeActive, isCurrentAttendanceTarget, isCompleted, isLoading, onMarkAttendance, onSelectStudent, onNivelar, index = 0 }: any) {
  // Helper: Acortar nombre a "Nombre Apellido"
  const getShortName = (fullName: string | null | undefined): string => {
    if (!fullName) return 'Sin Nombre';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 2) return fullName;
    return `${parts[0]} ${parts[1]}`;
  };

  const hasMissed = (student.missedCount ?? 0) > 0 && !isAttendanceModeActive;
  const containerClasses = [`group relative flex items-center gap-4 rounded-2xl ${hasMissed ? 'h-[88px] md:h-[76px]' : 'h-[72px] md:h-[62px]'} pl-0 pr-4 transition-all duration-300 ease-out cursor-pointer overflow-visible`];

  if (isAttendanceModeActive) {
    if (isCurrentAttendanceTarget) {
      containerClasses.push(
        'border border-blue-400/60 bg-gradient-to-br from-blue-500/15 via-indigo-500/10 to-blue-600/15',
        'text-white shadow-[0_0_24px_-6px_rgba(59,130,246,0.5),inset_0_1px_0_rgba(255,255,255,0.06)]',
        'ring-1 ring-blue-400/50 backdrop-blur-md'
      );
    } else if (isCompleted) {
      containerClasses.push('border border-slate-700/20 bg-slate-900/20 opacity-40 backdrop-blur-sm');
    } else {
      containerClasses.push('border border-slate-700/40 bg-slate-900/30 text-slate-100 opacity-70 backdrop-blur-sm');
    }
  } else {
    if (isActive) {
      containerClasses.push(
        'border border-indigo-400/50 bg-gradient-to-br from-indigo-500/20 via-blue-500/15 to-violet-500/10',
        'text-white backdrop-blur-xl',
        'shadow-[0_8px_32px_-8px_rgba(99,102,241,0.5),0_2px_8px_-2px_rgba(99,102,241,0.3),inset_0_1px_0_rgba(255,255,255,0.08)]',
        'ring-1 ring-indigo-400/40'
      );
    } else {
      containerClasses.push(
        'border border-slate-700/40 bg-gradient-to-br from-slate-800/50 via-slate-900/40 to-slate-800/50',
        'text-slate-300 backdrop-blur-md',
        'shadow-[0_2px_12px_-4px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.03)]',
        'hover:border-slate-500/50 hover:bg-gradient-to-br hover:from-slate-700/60 hover:via-slate-800/50 hover:to-slate-700/60',
        'hover:text-white hover:shadow-[0_8px_24px_-6px_rgba(99,102,241,0.25),0_2px_8px_-2px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)]',
        'hover:ring-1 hover:ring-slate-500/30'
      );
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      transition={{
        duration: 0.5,
        delay: 0.1 + (index * 0.045),
        ease: EASE_SMOOTH,
      }}
      onClick={(e) => { if (!isAttendanceModeActive) { e.preventDefault(); onSelectStudent(student); } }}
    >
      {/* Tarjeta con avatar integrado */}
      <div className={classNames(...containerClasses)}>
        {/* Avatar dentro de la tarjeta */}
        <div className="flex-shrink-0 pl-3 md:pl-2.5">
          <StudentAvatar fotoPath={student.foto_path} nombre={student.nombre} fotoUrls={fotoUrls} />
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5 pr-1">
          <span className="block text-[15px] md:text-[13.5px] font-semibold leading-tight tracking-[-0.01em] truncate">{getShortName(student.nombre)}</span>

          {/* Barra de Progreso Elegante */}
          <div className="w-full max-w-[160px] md:max-w-[120px] flex items-center gap-2">
            <div className="flex-1 h-2 md:h-1.5 bg-slate-700/30 rounded-full overflow-hidden backdrop-blur-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${student.progress || 0}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={classNames(
                  "h-full rounded-full shadow-[0_0_8px_rgba(99,102,241,0.4)] relative",
                  isActive
                    ? "bg-gradient-to-r from-blue-300 via-indigo-300 to-white"
                    : "bg-gradient-to-r from-blue-500 via-indigo-500 to-indigo-400"
                )}
              />
            </div>
            <span className={classNames("text-[10px] md:text-[9px] font-medium w-7 text-right tabular-nums", isActive ? "text-blue-100" : "text-slate-500")}>
              {student.progress || 0}%
            </span>
          </div>

          {/* Barra de Inasistencias Premium - Rojo Gradiente */}
          {(student.missedCount ?? 0) > 0 && !isAttendanceModeActive && (
            <div className="w-full max-w-[160px] md:max-w-[120px] flex items-center gap-1.5">
              <div className="flex-1 h-1.5 md:h-1 bg-slate-700/20 rounded-full overflow-hidden backdrop-blur-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, Math.round(((student.missedCount || 0) / 12) * 100))}%` }}
                  transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                  className={classNames(
                    "h-full rounded-full relative",
                    isActive
                      ? "bg-gradient-to-r from-red-300 via-rose-300 to-orange-200 shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                      : "bg-gradient-to-r from-red-500 via-rose-500 to-orange-400 shadow-[0_0_8px_rgba(239,68,68,0.35)]"
                  )}
                />
              </div>
              <span className={classNames("text-[9px] md:text-[8px] font-bold tabular-nums", isActive ? "text-red-200" : "text-red-400/80")}>
                {student.missedCount}
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onNivelar && onNivelar(student); }}
                className={classNames(
                  "flex-shrink-0 px-2 py-0.5 rounded-lg text-[8px] md:text-[7px] font-bold uppercase tracking-wider transition-all duration-300 active:scale-90",
                  "bg-gradient-to-r from-red-500 via-rose-500 to-orange-500 text-white",
                  "shadow-[0_2px_10px_-2px_rgba(239,68,68,0.5),0_0_0_1px_rgba(239,68,68,0.2)]",
                  "hover:shadow-[0_4px_16px_-2px_rgba(239,68,68,0.6),0_0_0_1px_rgba(239,68,68,0.3)]",
                  "hover:from-red-600 hover:via-rose-600 hover:to-orange-600",
                  "border border-red-400/20",
                  "backdrop-blur-sm"
                )}
              >
                Nivelar
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 pr-1">
          {isAttendanceModeActive ? (
            isCurrentAttendanceTarget ? (
              isLoading ? <Loader2 size={24} className="text-indigo-500 animate-spin" /> : (
                <>
                  <button type="button" onClick={() => onMarkAttendance('no')} className="flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 text-gray-700 shadow-md hover:from-gray-300 active:scale-95"><X size={20} /></button>
                  <button type="button" onClick={() => onMarkAttendance('si')} className="flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 text-white shadow-lg hover:from-green-500 active:scale-95"><Check size={20} /></button>
                </>
              )
            ) : isCompleted ? <Check size={24} className="text-green-600" /> : null
          ) : (
            <div className="flex items-center gap-2.5 transition-opacity">
              {/* Botón Llamar — Liquid Glass */}
              <button
                type="button"
                disabled={!student.telefono}
                onClick={(e) => { e.stopPropagation(); if (student.telefono) window.location.href = `tel:${student.telefono.replace(/\s+/g, '')}`; }}
                className="group/call relative p-3 md:p-2.5 rounded-2xl backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] hover:border-blue-400/40 text-blue-400 hover:text-blue-300 transition-all duration-300 disabled:opacity-20 active:scale-90 hover:scale-105 shadow-[0_2px_12px_-3px_rgba(0,0,0,0.3)] hover:shadow-[0_4px_20px_-4px_rgba(59,130,246,0.35)]"
              >
                {/* Glow radial de fondo */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/10 via-transparent to-cyan-500/5 opacity-0 group-hover/call:opacity-100 transition-opacity duration-300" />
                {/* Reflejo superior liquid */}
                <div className="absolute inset-x-0 top-0 h-1/2 rounded-t-2xl bg-gradient-to-b from-white/[0.07] to-transparent pointer-events-none" />
                <Phone size={20} className="md:w-[18px] md:h-[18px] relative z-10 drop-shadow-[0_0_6px_rgba(59,130,246,0.3)]" />
              </button>

              {/* Botón WhatsApp — Liquid Glass */}
              <button
                type="button"
                disabled={!student.telefono}
                onClick={(e) => { e.stopPropagation(); if (student.telefono) window.open(`https://wa.me/${student.telefono.replace(/\D/g, '')}`, '_blank'); }}
                className="group/wa relative p-3 md:p-2.5 rounded-2xl backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] hover:border-emerald-400/40 text-emerald-400 hover:text-emerald-300 transition-all duration-300 disabled:opacity-20 active:scale-90 hover:scale-105 shadow-[0_2px_12px_-3px_rgba(0,0,0,0.3)] hover:shadow-[0_4px_20px_-4px_rgba(16,185,129,0.35)]"
              >
                {/* Glow radial de fondo */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-transparent to-green-500/5 opacity-0 group-hover/wa:opacity-100 transition-opacity duration-300" />
                {/* Reflejo superior liquid */}
                <div className="absolute inset-x-0 top-0 h-1/2 rounded-t-2xl bg-gradient-to-b from-white/[0.07] to-transparent pointer-events-none" />
                <MessageCircle size={20} className="md:w-[18px] md:h-[18px] relative z-10 drop-shadow-[0_0_6px_rgba(16,185,129,0.3)]" />
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function StudentAvatar({ fotoPath, nombre, fotoUrls }: any) {
  const url = (fotoPath ? fotoUrls[fotoPath] : null) ?? generateAvatar(nombre ?? 'NN');
  return (
    <div className="relative flex-shrink-0">
      <img
        key={url}
        src={url}
        alt={nombre ?? 'Estudiante'}
        className="h-14 w-14 md:h-12 md:w-12 rounded-full border-2 border-slate-600/50 ring-2 ring-slate-500/20 object-cover shadow-[0_4px_16px_-4px_rgba(0,0,0,0.4)]"
        onError={(e) => { const t = e.currentTarget; const fb = generateAvatar(nombre ?? 'NN'); if (t.src !== fb) t.src = fb; }}
      />
      {/* Halo premium */}
      <div className="absolute inset-0 rounded-full ring-1 ring-blue-400/20 pointer-events-none" />
    </div>
  );
}

function TabButton({ icon, label, isActive, onClick }: any) {
  // Estilo Premium "Apple 2025" - Segmented Control Refinado
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        "relative group flex items-center justify-center rounded-3xl px-5 py-2 text-[13px] font-semibold tracking-wide transition-all duration-300 ease-out select-none focus:outline-none",
        "gap-2.5", // Espaciado elegante
        isActive
          ? "bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 text-white shadow-[0_6px_20px_-6px_rgba(99,102,241,0.4),inset_0_1px_0_rgba(255,255,255,0.3)] ring-1 ring-white/20 scale-[1.02]"
          : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/50 active:scale-95 bg-transparent"
      )}
    >
      {/* Icono con micro-interacción */}
      <span className={classNames("transition-transform duration-300", isActive ? "scale-110 drop-shadow-sm" : "group-hover:scale-110 opacity-70")}>
        {icon}
      </span>

      {/* Texto */}
      <span className="hidden md:block">
        {label}
      </span>
    </button>
  );
}

function GradeGrid({ gradePlaceholders, studentGradesForTopic, topicId, onGradeChange }: any) {
  const gradeRows = chunkArray(gradePlaceholders, 5);
  return (
    <div className="max-h-[320px] space-y-4 overflow-y-auto pr-1.5">
      {gradeRows.map((row: any, rowIndex: number) => (
        <div key={rowIndex} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {row.map((placeholder: any, colIndex: number) => (
            <PremiumAttendanceButton key={placeholder.id} noteNumber={rowIndex * 5 + colIndex + 1} value={studentGradesForTopic[placeholder.id] ?? ''} onChange={(v: string) => onGradeChange(topicId, placeholder.id, v)} />
          ))}
          {Array.from({ length: Math.max(0, 5 - row.length) }).map((_, i) => <div key={`empty-${i}`} />)}
        </div>
      ))}
    </div>
  );
}

function PremiumAttendanceButton({ noteNumber, value, onChange }: any) {
  const handleClick = () => onChange(value === 'si' ? 'no' : value === 'no' ? '' : 'si');

  // Estados con Glassmorphism Premium
  let stateClasses = 'border-white/40 bg-gradient-to-br from-white/60 via-slate-50/50 to-white/60 backdrop-blur-xl hover:from-white/70 hover:to-white/70 text-slate-600 shadow-[0_4px_1 2px_rgba(0,0,0,0.05)]';
  let icon = null;
  let glowClass = '';

  if (value === 'si') {
    // Completada: Gradiente esmeralda con glow
    stateClasses = 'border-emerald-400/40 bg-gradient-to-br from-emerald-50/90 via-teal-50/80 to-emerald-100/70 backdrop-blur-xl text-emerald-900 shadow-[0_8px_30px_-8px_rgba(16,185,129,0.35),0_4px_16px_-4px_rgba(20,184,166,0.25)] ring-1 ring-emerald-200/50';
    icon = <Check size={22} className="drop-shadow-sm" />;
    glowClass = 'from-emerald-400/20 to-teal-400/15';
  } else if (value === 'no') {
    // Rechazada: Gradiente gris oscuro premium
    stateClasses = 'border-slate-400/30 bg-gradient-to-br from-slate-300/80 via-slate-400/70 to-slate-500/60 backdrop-blur-md text-white shadow-[0_6px_24px_-6px_rgba(71,85,105,0.4)] ring-1 ring-slate-300/40';
    icon = <X size={22} className="drop-shadow-md" />;
    glowClass = 'from-slate-600/15 to-slate-700/10';
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`group relative flex flex-col items-center justify-center h-20 md:h-18 rounded-2xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.12)] active:scale-95 p-3 overflow-hidden cursor-pointer ${stateClasses}`}
    >
      {/* Fondo decorativo con gradiente radial premium */}
      <div className={`pointer-events-none absolute inset-0 rounded-2xl opacity-60 bg-[radial-gradient(160px_120px_at_20%_-10%,${glowClass || 'rgba(148,163,184,0.12)'},transparent)] group-hover:opacity-80 transition-opacity duration-300`} />

      {/* Brillo superior glassmorphism */}
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-[40%] rounded-t-2xl bg-gradient-to-b from-white/40 to-transparent opacity-50" />

      {/* Número de clase */}
      <span className="relative z-10 text-[10.5px] md:text-[10px] uppercase tracking-[0.08em] font-bold select-none mb-1.5 transition-transform group-hover:scale-105">
        Clase # {noteNumber}
      </span>

      {/* Icono con animación */}
      <div className="relative z-10 h-6 flex items-center justify-center transition-transform group-hover:scale-110 duration-200">
        {icon}
      </div>

      {/* Ring de enfoque en hover */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-black/5 group-hover:ring-black/10 transition-all" />
    </button>
  );
}

// ======================= MODAL NIVELAR INDIVIDUAL - APPLE 2026 =======================
function NivelarIndividualModal({ student, fotoUrls, onClose, onNivelarClase }: {
  student: EstudianteInscrito;
  fotoUrls: Record<string, string>;
  onClose: () => void;
  onNivelarClase: (student: EstudianteInscrito, claseNumero: number) => Promise<void>;
}) {
  const [levelingClass, setLevelingClass] = useState<number | null>(null);
  const missedClasses = student.missedClasses || [];
  const missedDates = student.missedDates || {};

  // Obtener fecha real de inasistencia o fecha actual del sistema
  const getClassDate = (classNum: number): string => {
    try {
      // Prioridad 1: Fecha real de la tabla inasistencias_academia
      if (missedDates[classNum]) {
        const realDate = new Date(missedDates[classNum]);
        if (!isNaN(realDate.getTime())) {
          return realDate.toLocaleDateString('es-CO', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          });
        }
      }
      // Fallback: Fecha actual del sistema
      return new Date().toLocaleDateString('es-CO', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return 'Fecha no disponible';
    }
  };

  const handleNivelar = async (claseNum: number) => {
    setLevelingClass(claseNum);
    try {
      await onNivelarClase(student, claseNum);
    } finally {
      setLevelingClass(null);
    }
  };

  // Foto del estudiante
  const photoUrl = (student.foto_path ? fotoUrls[student.foto_path] : null) ?? generateAvatar(student.nombre ?? 'NN');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop Premium */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-xl"
      />

      {/* Modal Container */}
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ type: 'spring', duration: 0.55, bounce: 0.25 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg max-h-[85vh] overflow-hidden rounded-[2rem] bg-gradient-to-b from-white via-white to-gray-50/95 backdrop-blur-3xl shadow-[0_25px_80px_-15px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.6)] ring-1 ring-white/30"
      >
        {/* Decorative Background Orbs */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-gradient-to-br from-rose-200/40 via-pink-200/30 to-red-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-gradient-to-tr from-emerald-200/40 via-green-200/30 to-teal-200/20 blur-3xl" />
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-40 w-40 rounded-full bg-gradient-to-br from-indigo-100/20 to-blue-100/10 blur-3xl" />

        {/* Header - Student Info */}
        <div className="relative px-6 pt-5 md:pt-7 pb-5 border-b border-gray-200/60 bg-gradient-to-b from-gray-50/80 to-transparent">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 md:top-6 md:right-6 p-2.5 rounded-2xl bg-gray-100/90 text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition-all duration-200 active:scale-90 ring-1 ring-gray-200/50"
          >
            <X size={16} strokeWidth={2.5} />
          </button>

          <div className="flex items-center gap-4">
            {/* Avatar Premium */}
            <div className="relative flex-shrink-0">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-rose-400/30 via-pink-400/20 to-indigo-400/30 blur-md opacity-60" />
              <img
                src={photoUrl}
                alt={student.nombre || ''}
                className="relative h-16 w-16 md:h-[72px] md:w-[72px] rounded-2xl object-cover shadow-[0_8px_24px_-4px_rgba(0,0,0,0.15)] ring-[3px] ring-white"
                onError={(e) => { const t = e.currentTarget; const fb = generateAvatar(student.nombre ?? 'NN'); if (t.src !== fb) t.src = fb; }}
              />
              {/* Badge de fallas con pulse */}
              <div className="absolute -top-2 -right-2">
                <div className="absolute inset-0 h-7 w-7 rounded-full bg-red-500 animate-ping opacity-20" />
                <div className="relative h-7 w-7 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-[0_4px_12px_-2px_rgba(239,68,68,0.5)] ring-[3px] ring-white">
                  <span className="text-[11px] font-black text-white">{missedClasses.length}</span>
                </div>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-xl md:text-2xl font-black tracking-tight text-gray-900 truncate">
                {student.nombre || 'Sin Nombre'}
              </h2>
              <p className="text-[13px] text-gray-500 mt-0.5 font-medium">
                {missedClasses.length} {missedClasses.length === 1 ? 'clase pendiente' : 'clases pendientes'} de nivelación
              </p>
            </div>
          </div>

          {/* Progress Summary - Glassmorphism Cards */}
          <div className="mt-5 flex items-stretch gap-3">
            <div className="flex-1 rounded-2xl bg-white/70 backdrop-blur-sm border border-gray-200/50 p-3 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.8)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.08em]">Progreso</span>
                <span className="text-[13px] font-black text-indigo-600">{student.progress || 0}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden ring-1 ring-gray-200/30">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.4)] transition-all duration-500"
                  style={{ width: `${student.progress || 0}%` }}
                />
              </div>
            </div>
            <div className="flex-1 rounded-2xl bg-white/70 backdrop-blur-sm border border-gray-200/50 p-3 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.8)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.08em]">Inasistencias</span>
                <span className="text-[13px] font-black text-red-500">{Math.round((missedClasses.length / 12) * 100)}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden ring-1 ring-gray-200/30">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-red-500 via-rose-500 to-orange-400 shadow-[0_0_12px_rgba(239,68,68,0.4)] transition-all duration-500"
                  style={{ width: `${Math.round((missedClasses.length / 12) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Classes List */}
        <div className="relative overflow-y-auto max-h-[calc(90vh-380px)] md:max-h-[calc(85vh-400px)] px-4 md:px-6 py-4 space-y-3">
          <AnimatePresence mode="popLayout">
            {missedClasses.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-10"
              >
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center shadow-sm">
                  <Check className="h-8 w-8 text-emerald-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">¡Completamente Nivelado!</h3>
                <p className="text-sm text-gray-500 mt-1">No quedan clases pendientes.</p>
              </motion.div>
            ) : (
              missedClasses.map((classNum, idx) => {
                const isLeveling = levelingClass === classNum;

                return (
                  <motion.div
                    key={`missed-${classNum}`}
                    layout
                    initial={{ opacity: 0, y: 16, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 80, scale: 0.95, transition: { duration: 0.3 } }}
                    transition={{ delay: idx * 0.04, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="relative group rounded-2xl bg-white border border-gray-200/70 p-4 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.9)] hover:shadow-[0_8px_30px_-8px_rgba(239,68,68,0.15),0_2px_8px_-2px_rgba(0,0,0,0.06)] hover:border-red-200/60 transition-all duration-300"
                  >
                    {/* Glow on hover */}
                    <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 bg-gradient-to-r from-red-50/60 via-transparent to-emerald-50/40 transition-opacity duration-300" />

                    <div className="relative flex items-center gap-3">
                      {/* Class Icon */}
                      <div className="flex-shrink-0 h-12 w-12 md:h-13 md:w-13 rounded-xl bg-gradient-to-br from-red-100 via-rose-50 to-red-100 flex items-center justify-center shadow-[0_2px_8px_-2px_rgba(239,68,68,0.15),inset_0_1px_0_rgba(255,255,255,0.8)] ring-1 ring-red-200/40">
                        <span className="text-red-600 font-black text-sm">#{classNum}</span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900 text-[14px] md:text-[15px]">
                          Clase #{classNum}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <svg className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-[12px] text-gray-500 truncate">
                            {getClassDate(classNum)}
                          </span>
                        </div>
                      </div>

                      {/* Nivelar Button Premium */}
                      <button
                        type="button"
                        onClick={() => handleNivelar(classNum)}
                        disabled={isLeveling}
                        className={classNames(
                          "flex-shrink-0 flex items-center gap-1.5 px-5 py-2.5 md:px-6 md:py-3 rounded-xl text-[12px] md:text-[13px] font-bold transition-all duration-300 active:scale-90 disabled:cursor-not-allowed",
                          isLeveling
                            ? "bg-gray-100 text-gray-400 shadow-none"
                            : "bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 text-white shadow-[0_4px_20px_-4px_rgba(16,185,129,0.5),0_0_0_1px_rgba(16,185,129,0.15)] hover:shadow-[0_8px_30px_-4px_rgba(16,185,129,0.6)] hover:from-emerald-600 hover:via-green-600 hover:to-teal-600 border border-emerald-400/20"
                        )}
                      >
                        {isLeveling ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            <span>Nivelando...</span>
                          </>
                        ) : (
                          <>
                            <Check size={14} strokeWidth={3} />
                            <span>Nivelar</span>
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="relative border-t border-gray-200/60 bg-gradient-to-t from-gray-50/80 to-white/60 backdrop-blur-md px-6 py-4">
          <button
            onClick={onClose}
            className="w-full rounded-2xl bg-gradient-to-b from-gray-800 to-gray-900 px-4 py-3.5 font-bold text-white shadow-[0_4px_16px_-4px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] ring-1 ring-gray-700/50 transition-all hover:from-gray-700 hover:to-gray-800 hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.4)] active:scale-[0.98]"
          >
            Cerrar
          </button>
        </div>

        {/* Bottom Accent Line - Animated */}
        <div className="h-1.5 w-full bg-gradient-to-r from-red-400 via-rose-500 via-50% to-emerald-500" />
      </motion.div>
    </motion.div>
  );
}

function ModalTomarAsistencia({ topics, onClose, onSelectClass }: any) {
  const clases = topics.find((t: any) => t.id === 1)?.grades || [];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} transition={{ duration: 0.2 }} className="relative w-full max-w-lg flex flex-col rounded-3xl border border-white/70 bg-white/70 backdrop-blur-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex-shrink-0 p-5 border-b border-white/60"><h2 className="text-xl font-semibold text-gray-900">Tomar Asistencia</h2><p className="text-sm text-gray-700">Selecciona la clase:</p></div>
        <div className="flex-1 overflow-y-auto max-h-[50vh] p-4"><div className="grid grid-cols-4 gap-3">{clases.map((clase: any, index: number) => (<button key={clase.id} onClick={() => onSelectClass(clase.id)} className="flex items-center justify-center h-16 rounded-2xl bg-white/70 text-indigo-700 font-semibold shadow-md ring-1 ring-black/5 hover:bg-white active:scale-95">Clase #{index + 1}</button>))}</div></div>
        <div className="flex-shrink-0 p-4 border-t border-white/60 bg-white/40 flex justify-end"><button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white/70 rounded-lg hover:bg-white">Cancelar</button></div>
      </motion.div>
    </motion.div>
  );
}
function CupertinoConfirmationDialog({ onConfirm, onCancel }: any) { return (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/30 backdrop-blur-sm" /><motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-sm flex flex-col rounded-3xl border border-white/70 bg-white/70 backdrop-blur-2xl shadow-2xl overflow-hidden"><div className="p-6 text-center"><h3 className="text-lg font-semibold text-gray-900">Asistencia ya registrada</h3><p className="mt-2 text-sm text-gray-700">¿Desea tomarla de nuevo?</p></div><div className="grid grid-cols-2 border-t border-white/60"><button onClick={onCancel} className="p-4 text-sm font-semibold text-blue-600 hover:bg-white/20">Cancelar</button><button onClick={onConfirm} className="p-4 text-sm font-semibold text-blue-600 border-l border-white/60 hover:bg-white/20">Tomar de nuevo</button></div></motion.div></motion.div>); }
function CupertinoAlertDialog({ title, message, onConfirm }: any) { return (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/30 backdrop-blur-sm" /><motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-sm flex flex-col rounded-3xl border border-white/70 bg-white/70 backdrop-blur-2xl shadow-2xl overflow-hidden"><div className="p-6 text-center"><h3 className="text-lg font-semibold text-gray-900">{title}</h3><p className="mt-2 text-sm text-gray-700">{message}</p></div><div className="grid grid-cols-1 border-t border-white/60"><button onClick={onConfirm} className="p-4 text-sm font-semibold text-blue-600 hover:bg-white/20">Entendido</button></div></motion.div></motion.div>); }
function LoadingScreen({ text }: { text: string }) { return (<main className="flex h-screen w-full items-center justify-center bg-gray-100"><Loader2 size={32} className="animate-spin text-indigo-600" /><span className="ml-3 text-lg font-medium text-gray-700">{text}</span></main>); }
function ErrorScreen({ message }: { message: string }) { return (<main className="flex h-screen w-full items-center justify-center bg-gray-100"><div className="flex flex-col items-center gap-4 p-8 bg-white rounded-lg shadow-xl"><Lock size={32} className="text-red-500" /><h1 className="text-lg font-semibold text-gray-800">Acceso Denegado</h1><p className="text-gray-600">{message}</p><a href="/login" className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700">Ir al Login</a></div></main>); }
function CardSection({ title, children }: any) { return (<section className="relative overflow-hidden rounded-3xl border border-white/70 bg-white/30 p-5 md:p-6 shadow-sm backdrop-blur-xl"><div className="mb-4 -mx-5 -mt-5 p-3 bg-gradient-to-r from-blue-100 to-indigo-100"><h3 className="text-base md:text-[17px] font-semibold tracking-tight text-indigo-900">{title}</h3></div>{children}</section>); }
function StyleDefinitions() { return (<style>{`:root{--mac-glass:rgba(255,255,255,0.55);--mac-glass-strong:rgba(255,255,255,0.70);}@keyframes slide-in-left{from{transform:translateX(-100%);opacity:0;flex-basis:0}to{transform:translateX(0);opacity:1;flex-basis:25%}}@media(min-width:768px){.md\\:animate-slide-in-left{animation:slide-in-left .6s cubic-bezier(.32,.72,0,1) forwards}}html{scroll-behavior:smooth}`}</style>); }