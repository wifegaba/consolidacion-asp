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
} from 'lucide-react';
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
} from './components/academia.utils';

import { HojaDeVidaPanel } from './components/HojaDeVidaPanel';
import {
  WelcomePanel as WelcomePanelBase,
  CourseWelcomeMessage
} from './components/PanelesBienvenida';
import { GlobalPresenceProvider } from '../../../components/GlobalPresenceProvider';

// --- Memoización de Componentes ---
const WelcomePanel = memo(WelcomePanelBase);
const MemoizedHojaDeVida = memo(HojaDeVidaPanel);

type EstudianteInscrito = Entrevista & {
  inscripcion_id: string;
  estado_inscripcion: string;
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
      const { data, error } = await supabase
        .from('inscripciones')
        .select(`id, estado, entrevistas ( * )`)
        .eq('curso_id', course.id)
        .eq('servidor_id', servidorId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const loadedStudents: EstudianteInscrito[] = data
        .filter(item => item.entrevistas)
        .map(item => ({
          ...(item.entrevistas as unknown as Entrevista),
          inscripcion_id: item.id,
          estado_inscripcion: item.estado,
        }));

      setStudents(loadedStudents);

      if (loadedStudents.length > 0) {
        const fotoPaths = [...new Set(loadedStudents.map((s) => s.foto_path).filter(Boolean) as string[])];
        if (fotoPaths.length > 0) {
          const { data: signedUrlsData } = await supabase.storage
            .from("entrevistas-fotos")
            .createSignedUrls(fotoPaths, 60 * 60);

          if (signedUrlsData) {
            const urlMap = signedUrlsData.reduce((acc, item) => {
              if (item.signedUrl && item.path) {
                const url = bustUrl(item.signedUrl);
                if (url) acc[item.path] = url;
              }
              return acc;
            }, {} as Record<string, string>);
            setFotoUrls(urlMap);
          }
        }
      }
    } catch (error) {
      console.error("Error en loadStudents:", error);
    } finally {
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

    const initialGrades: StudentGrades = {};
    initialCourseTopics.forEach(topic => {
      initialGrades[topic.id] = {};
      const savedTopicGrades = savedGrades[topic.id] || {};
      topic.grades.forEach(g => {
        initialGrades[topic.id][g.id] = savedTopicGrades[g.id] || '';
      });
    });

    setStudentGrades(initialGrades);
  }, [fotoUrls]);

  // --- Actualizaciones de Hoja de Vida ---
  const onUpdated = useCallback((r: Entrevista & { _tempPreview?: string | null }) => {
    setStudents((xs) => xs.map((x) => (x.id === r.id ? { ...x, ...r } : x)));
    setSelectedStudent(prev => prev ? { ...prev, ...r } : null);

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
      await supabase
        .from('asistencias_academia')
        .upsert({
          inscripcion_id: inscripcionId,
          asistencias: gradesToSave,
          updated_at: new Date().toISOString()
        }, { onConflict: 'inscripcion_id' });

      isGradesDirty.current = false;
      toast.success("Asistencia guardada");
    } catch (error: any) {
      toast.error("Error de autoguardado: " + error.message);
    }
  }, [toast]);

  const handleGradeChange = useCallback((topicId: number, gradeId: number, value: string) => {
    isGradesDirty.current = true;

    setStudentGrades(prev => {
      const newTopicGrades = { ...(prev[topicId] || {}), [gradeId]: value };
      const newState = { ...prev, [topicId]: newTopicGrades };
      return newState;
    });
  }, []);

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

  const cancelAttendanceMode = useCallback(() => {
    setIsAttendanceModeActive(false);
    setAttendanceClassId(null);
  }, []);

  const completeAttendanceMode = useCallback(() => {
    toast.success("Asistencia finalizada correctamente");
    cancelAttendanceMode();
    setIsAttendanceCompleted(true);
  }, [cancelAttendanceMode, toast]);

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

  if (authLoading) return <LoadingScreen text="Verificando sesión..." />;
  if (authError || !user) return <ErrorScreen message={authError || "No estás autenticado."} />;

  return (
    <GlobalPresenceProvider userName={currentUserName} userId={user?.servidorId || ''}>
      <main className="relative flex h-screen w-full items-stretch justify-stretch p-0 text-gray-900 selection:bg-indigo-300/40 selection:text-gray-900 bg-[conic-gradient(from_210deg_at_50%_0%,#EEF2FF_0%,#FAF5FF_40%,#F9FAFB_85%)]">
        <StyleDefinitions />
        <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background:radial-gradient(circle,_#000_1px,_transparent_1px)] [background-size:22px_22px]" />

        <div className="relative flex w-full min-h-0 overflow-hidden rounded-none border-none bg-white/40 backdrop-blur-2xl ring-0 shadow-none bg-[linear-gradient(145deg,rgba(99,102,241,0.08),rgba(255,255,255,0.07))] md:flex-row">

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
                <nav className="flex items-center gap-1.5 p-1 rounded-full border border-white/70 bg-white/25 backdrop-blur-2xl shadow-[0_8px_28px_-10px_rgba(2,6,23,0.28),inset_0_1px_0_rgba(255,255,255,0.65)]">
                  <TabButton icon={<FileText className="h-4 w-4" />} label="Hoja de Vida" isActive={activeTab === 'hojaDeVida'} onClick={() => handleTabClick('hojaDeVida')} />
                  <TabButton icon={<UserCheck className="h-4 w-4" />} label="Asistencias" isActive={activeTab === 'grades'} onClick={() => handleTabClick('grades')} />
                  <TabButton icon={<BarChart3 className="h-4 w-4" />} label="Reportes" isActive={activeTab === 'reports'} onClick={() => handleTabClick('reports')} />
                </nav>
              )}
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 grid grid-cols-1 [grid-template-areas:'stack'] overflow-hidden">
              <WelcomePanel
                onSelectCourse={handleSelectCourse}
                className={getContentPanelClasses('welcome')}
                isActive={mainState === 'welcome'}
                courses={courses}
                loading={loadingCourses || authLoading}
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
                      courseTopics={courseTopics}
                      studentGrades={studentGrades}
                      onGradeChange={handleGradeChange}
                    />
                  </div>

                  {/* Pestaña Hoja de Vida */}
                  <div className={getTabPanelClasses('hojaDeVida')}>
                    {selectedStudent ? (
                      <MemoizedHojaDeVida key={selectedStudent.id} row={selectedStudent} signedUrl={signedUrl} onUpdated={onUpdated} onDeleted={handleHojaDeVidaDelete} className="animate-slideIn" />
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

        {isAttendanceModalOpen && (
          <ModalTomarAsistencia topics={courseTopics} onClose={() => setIsAttendanceModalOpen(false)} onSelectClass={(classId: number) => { setIsAttendanceModalOpen(false); setIsAttendanceModeActive(true); setAttendanceClassId(classId); }} />
        )}
        {showConfirmation && <CupertinoConfirmationDialog onConfirm={() => window.location.reload()} onCancel={() => setShowConfirmation(false)} />}
        {showAttendanceAlreadyTakenModal && <CupertinoAlertDialog title="Asistencia Registrada" message="Ya has registrado la asistencia para esta clase." onConfirm={() => setShowAttendanceAlreadyTakenModal(false)} />}
      </main>
    </GlobalPresenceProvider>
  );
}

// ======================= COMPONENTES AUXILIARES OPTIMIZADOS =======================

const MemoizedGradesTabContent = memo(({
  selectedStudent,
  courseTopics,
  studentGrades,
  onGradeChange
}: {
  selectedStudent: EstudianteInscrito | null;
  courseTopics: CourseTopic[];
  studentGrades: StudentGrades;
  onGradeChange: (t: number, g: number, v: string) => void;
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
      <div className="relative rounded-[22px] border border-white/80 bg-white/25 backdrop-blur-[22px] shadow-[0_30px_80px_-35px_rgba(2,6,23,0.45),inset_0_1px_0_0_#fff] ring-1 ring-black/5 p-5 md:p-7">
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
            <span className={classNames("grid h-6 w-6 place-items-center rounded-full text-xs font-bold text-white ring-2 ring-white transition-all", asistenciasPendientes > 0 ? "bg-red-500" : "bg-green-500")}>
              {asistenciasPendientes}
            </span>
          </div>
        </div>

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
}) {
  const isDetailView = mainState === 'creating' || mainState === 'viewing';
  const [currentAttendanceStudentIndex, setCurrentAttendanceStudentIndex] = useState(0);
  const [isMarkingStudentId, setIsMarkingStudentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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
    <aside className={`absolute inset-0 md:relative w-full h-full md:h-full md:w-1/3 lg:w-1/4 flex-shrink-0 flex flex-col border-b md:border-b-0 md:border-r border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,255,255,0.56))] backdrop-blur-2xl [box-shadow:inset_0_1px_0_rgba(255,255,255,0.9),0_20px_60px_-30px_rgba(2,6,23,0.25)] before:content-[''] before:absolute before:inset-y-0 before:-left-20 before:w-60 before:bg-[radial-gradient(160px_220px_at_10%_20%,rgba(99,102,241,0.18),transparent_60%)] before:pointer-events-none after:content-[''] after:absolute after:inset-0 after:-z-10 after:opacity-20 after:[background:radial-gradient(circle,_rgba(199,210,254,0.3)_1px,_transparent_1px)] after:[background-size:18px_18px] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isDetailView ? 'translate-x-[-100%] md:translate-x-0' : 'translate-x-0'} ${className}`}>
      <div className="flex-shrink-0 p-3 pb-2 border-b border-white/60 bg-white/60 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
        <button type="button" onClick={onGoBackToWelcome} className="flex items-center gap-1.5 px-2 py-1 text-sm font-medium text-gray-700 hover:text-indigo-600 rounded-lg hover:bg-white/70 transition-colors duration-150">
          <ArrowLeft size={16} />
          <span className="text-[13px]">Volver a Cursos</span>
        </button>
        {courseName && <div className="pt-2 text-center"><h2 className="text-xl font-bold tracking-[-0.03em] bg-gradient-to-r from-indigo-700 to-purple-600 bg-clip-text text-transparent">{courseName}</h2></div>}
      </div>

      <div className="flex-shrink-0 p-4 border-b border-white/60">
        <div className="relative">
          <input type="text" placeholder="Buscar estudiante…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} disabled={isAttendanceModeActive} className="w-full rounded-2xl border border-white/70 bg-white/75 backdrop-blur-xl py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-600 shadow-[inset_0_2px_6px_rgba(0,0,0,0.03)] focus:outline-none focus:ring-4 focus:ring-indigo-400/25 focus:border-white transition disabled:opacity-70" />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
        </div>
      </div>

      {isAttendanceModeActive && (
        <div className="flex-shrink-0 p-3 border-b border-white/60 bg-red-50/50">
          <button onClick={onCancelAttendance} className="w-full text-center text-sm font-medium text-red-600 hover:text-red-800 transition-colors">Cancelar Asistencia</button>
        </div>
      )}

      <nav className="overflow-y-auto p-3 space-y-2 max-h-80 md:flex-1 md:max-h-none [scrollbar-width:thin] [scrollbar-color:rgba(0,0,0,.15)_transparent]">
        {loading ? <div className="p-4 text-center text-gray-600">Cargando...</div> : filteredStudents.length === 0 ? <div className="p-4 text-center text-gray-600">Vacío.</div> : (
          filteredStudents.map((student, index) => (
            <StudentSidebarItem
              key={student.inscripcion_id}
              student={student}
              fotoUrls={fotoUrls}
              isActive={selectedStudentId === student.id && !isAttendanceModeActive}
              isAttendanceModeActive={isAttendanceModeActive}
              isCurrentAttendanceTarget={index === currentAttendanceStudentIndex}
              isCompleted={index < currentAttendanceStudentIndex}
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
            />
          ))
        )}
      </nav>

      <div className="flex-shrink-0 p-4 border-t border-white/60 min-h-[90px] flex flex-col items-center justify-center gap-3">
        <button onClick={onStartAttendance} className="flex w-full items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-medium backdrop-blur-sm transition-all border-emerald-300/50 bg-gradient-to-br from-emerald-100 via-white to-teal-100 text-emerald-900 shadow-lg hover:shadow-[0_15px_35px_-15px_rgba(16,185,129,0.5)] disabled:opacity-50 disabled:cursor-not-allowed">
          <UserCheck size={18} />
          <span>{isAttendanceCompleted ? "Asistencia Tomada" : "Tomar Asistencia"}</span>
        </button>
      </div>
    </aside>
  );
}

function StudentSidebarItem({ student, fotoUrls, isActive, isAttendanceModeActive, isCurrentAttendanceTarget, isCompleted, isLoading, onMarkAttendance, onSelectStudent }: any) {
  const gradientClasses = ['bg-gradient-to-br from-teal-100/95 to-emerald-100/95 shadow shadow-teal-200/50 hover:shadow-md', 'bg-gradient-to-br from-orange-100/95 to-amber-100/95 shadow shadow-orange-200/50 hover:shadow-md', 'bg-gradient-to-br from-pink-100/95 to-rose-100/95 shadow shadow-pink-200/50 hover:shadow-md', 'bg-gradient-to-br from-sky-100/95 to-cyan-100/95 shadow shadow-sky-200/50 hover:shadow-md'];
  const gradientStyle = gradientClasses[Number(student.id.replace(/\D/g, '')) % gradientClasses.length];
  const containerClasses = ['group relative flex items-center gap-4 md:gap-3 rounded-2xl p-4 md:p-3 transition-all border overflow-hidden'];

  if (isAttendanceModeActive) {
    if (isCurrentAttendanceTarget) containerClasses.push('border-transparent text-indigo-950 bg-gradient-to-r from-white/90 to-white/70 shadow-[0_12px_28px_-18px_rgba(76,29,149,0.35)] ring-2 ring-indigo-500');
    else if (isCompleted) containerClasses.push('border-transparent bg-gray-100/60 opacity-50');
    else containerClasses.push(`${gradientStyle} border-transparent text-gray-900 opacity-70`);
  } else {
    if (isActive) containerClasses.push('border-transparent text-indigo-950 bg-gradient-to-r from-white/90 to-white/70 shadow-[0_12px_28px_-18px_rgba(76,29,149,0.35)] ring-1 ring-indigo-500/30');
    else containerClasses.push(`${gradientStyle} border-transparent text-gray-900 hover:brightness-105 cursor-pointer`);
  }

  return (
    <div onClick={(e) => { if (!isAttendanceModeActive) { e.preventDefault(); onSelectStudent(student); } }} className={classNames(...containerClasses)}>
      <StudentAvatar fotoPath={student.foto_path} nombre={student.nombre} fotoUrls={fotoUrls} />
      <div className="flex-1">
        <span className="block text-base md:text-[13.5px] font-semibold leading-tight tracking-[-0.01em]">{student.nombre ?? 'Sin Nombre'}</span>
        <span className={classNames("block text-sm md:text-[11.5px]", isActive && !isAttendanceModeActive ? "text-gray-600/90" : "text-gray-700/80")}>C.C {student.cedula?.startsWith('TEMP_') ? 'Pendiente' : student.cedula}</span>
      </div>
      <div className="flex items-center gap-2">
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
          <>
            <button type="button" disabled={!student.telefono} onClick={(e) => { e.stopPropagation(); if (student.telefono) window.location.href = `tel:${student.telefono.replace(/\s+/g, '')}`; }} className="p-2 rounded-full bg-white/70 hover:bg-white text-gray-600 hover:text-indigo-600 shadow-sm transition-all disabled:opacity-50"><Phone size={18} /></button>
            <button type="button" disabled={!student.telefono} onClick={(e) => { e.stopPropagation(); if (student.telefono) window.open(`https://wa.me/${student.telefono.replace(/\D/g, '')}`, '_blank'); }} className="p-2 rounded-full bg-white/70 hover:bg-white text-gray-600 hover:text-green-600 shadow-sm transition-all disabled:opacity-50"><MessageCircle size={18} /></button>
          </>
        )}
      </div>
    </div>
  );
}

function StudentAvatar({ fotoPath, nombre, fotoUrls }: any) {
  const url = (fotoPath ? fotoUrls[fotoPath] : null) ?? generateAvatar(nombre ?? 'NN');
  return <img key={url} src={url} alt={nombre ?? 'Estudiante'} className="h-12 w-12 md:h-10 md:w-10 rounded-full border-2 border-white/80 ring-1 ring-black/5 object-cover shadow-[0_4px_10px_-6px_rgba(2,6,23,.35)]" onError={(e) => { const t = e.currentTarget; const fb = generateAvatar(nombre ?? 'NN'); if (t.src !== fb) t.src = fb; }} />;
}

function TabButton({ icon, label, isActive, onClick }: any) {
  return (
    <button type="button" onClick={onClick} className={['inline-flex items-center justify-center rounded-full p-2 md:px-4 md:py-2 md:gap-2 text-sm font-medium transition-all duration-200 focus:outline-none', isActive ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_8px_24px_-10px_rgba(76,29,149,0.45)]' : 'text-gray-700 bg-white/28 hover:bg-white/40 backdrop-blur-xl border border-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]'].join(' ')}>
      {icon} <span className="hidden md:inline">{label}</span>
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
  let stateClasses = 'border-white/60 bg-white/40 backdrop-blur-xl hover:bg-white/55 text-gray-600/90';
  let icon = null;
  if (value === 'si') { stateClasses = 'border-blue-300/50 bg-gradient-to-br from-blue-100 via-white to-indigo-100 text-indigo-900 shadow-md'; icon = <Check size={20} />; }
  else if (value === 'no') { stateClasses = 'border-white/60 bg-gradient-to-br from-gray-500 to-gray-600 text-white shadow-md'; icon = <X size={20} />; }

  return (
    <button type="button" onClick={handleClick} className={`relative group flex flex-col items-center justify-center h-16 rounded-[18px] border ring-1 ring-black/5 shadow-sm transition-all hover:-translate-y-[2px] active:scale-95 p-2 overflow-hidden cursor-pointer ${stateClasses}`}>
      <div className="pointer-events-none absolute inset-0 rounded-[18px] opacity-70 bg-[radial-gradient(140px_90px_at_8%_-8%,rgba(99,102,241,0.18),transparent)]" />
      <span className="relative text-[11px] uppercase tracking-wide select-none">Clase # {noteNumber}</span>
      <div className="relative h-5">{icon}</div>
    </button>
  );
}

function ModalTomarAsistencia({ topics, onClose, onSelectClass }: any) {
  const clases = topics.find((t: any) => t.id === 1)?.grades || [];
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg flex flex-col rounded-3xl border border-white/70 bg-white/70 backdrop-blur-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex-shrink-0 p-5 border-b border-white/60"><h2 className="text-xl font-semibold text-gray-900">Tomar Asistencia</h2><p className="text-sm text-gray-700">Selecciona la clase:</p></div>
        <div className="flex-1 overflow-y-auto max-h-[50vh] p-4"><div className="grid grid-cols-4 gap-3">{clases.map((clase: any, index: number) => (<button key={clase.id} onClick={() => onSelectClass(clase.id)} className="flex items-center justify-center h-16 rounded-2xl bg-white/70 text-indigo-700 font-semibold shadow-md ring-1 ring-black/5 hover:bg-white active:scale-95">Clase #{index + 1}</button>))}</div></div>
        <div className="flex-shrink-0 p-4 border-t border-white/60 bg-white/40 flex justify-end"><button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white/70 rounded-lg hover:bg-white">Cancelar</button></div>
      </div>
    </div>
  );
}
function CupertinoConfirmationDialog({ onConfirm, onCancel }: any) { return (<div className="fixed inset-0 z-[100] flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/30 backdrop-blur-sm" /><div className="relative w-full max-w-sm flex flex-col rounded-3xl border border-white/70 bg-white/70 backdrop-blur-2xl shadow-2xl overflow-hidden"><div className="p-6 text-center"><h3 className="text-lg font-semibold text-gray-900">Asistencia ya registrada</h3><p className="mt-2 text-sm text-gray-700">¿Desea tomarla de nuevo?</p></div><div className="grid grid-cols-2 border-t border-white/60"><button onClick={onCancel} className="p-4 text-sm font-semibold text-blue-600 hover:bg-white/20">Cancelar</button><button onClick={onConfirm} className="p-4 text-sm font-semibold text-blue-600 border-l border-white/60 hover:bg-white/20">Tomar de nuevo</button></div></div></div>); }
function CupertinoAlertDialog({ title, message, onConfirm }: any) { return (<div className="fixed inset-0 z-[100] flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/30 backdrop-blur-sm" /><div className="relative w-full max-w-sm flex flex-col rounded-3xl border border-white/70 bg-white/70 backdrop-blur-2xl shadow-2xl overflow-hidden"><div className="p-6 text-center"><h3 className="text-lg font-semibold text-gray-900">{title}</h3><p className="mt-2 text-sm text-gray-700">{message}</p></div><div className="grid grid-cols-1 border-t border-white/60"><button onClick={onConfirm} className="p-4 text-sm font-semibold text-blue-600 hover:bg-white/20">Entendido</button></div></div></div>); }
function LoadingScreen({ text }: { text: string }) { return (<main className="flex h-screen w-full items-center justify-center bg-gray-100"><Loader2 size={32} className="animate-spin text-indigo-600" /><span className="ml-3 text-lg font-medium text-gray-700">{text}</span></main>); }
function ErrorScreen({ message }: { message: string }) { return (<main className="flex h-screen w-full items-center justify-center bg-gray-100"><div className="flex flex-col items-center gap-4 p-8 bg-white rounded-lg shadow-xl"><Lock size={32} className="text-red-500" /><h1 className="text-lg font-semibold text-gray-800">Acceso Denegado</h1><p className="text-gray-600">{message}</p><a href="/login" className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700">Ir al Login</a></div></main>); }
function CardSection({ title, children }: any) { return (<section className="relative overflow-hidden rounded-3xl border border-white/70 bg-white/30 p-5 md:p-6 shadow-sm backdrop-blur-xl"><div className="mb-4 -mx-5 -mt-5 p-3 bg-gradient-to-r from-blue-100 to-indigo-100"><h3 className="text-base md:text-[17px] font-semibold tracking-tight text-indigo-900">{title}</h3></div>{children}</section>); }
function StyleDefinitions() { return (<style>{`:root{--mac-glass:rgba(255,255,255,0.55);--mac-glass-strong:rgba(255,255,255,0.70);}@keyframes slide-in-left{from{transform:translateX(-100%);opacity:0;flex-basis:0}to{transform:translateX(0);opacity:1;flex-basis:25%}}@media(min-width:768px){.md\\:animate-slide-in-left{animation:slide-in-left .6s cubic-bezier(.32,.72,0,1) forwards}}html{scroll-behavior:smooth}`}</style>); }