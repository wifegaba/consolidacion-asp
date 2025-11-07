'use client';

import React, { useState, useEffect, useRef } from 'react';
import '../../panel/panel.css';
import {
  User,
  BookMarked,
  BarChart3,
  Search,
  Plus,
  Folder,
  Mail,
  Calendar,
  ArrowLeft,
  Minus,
  X,
  Edit2,
  Star,
  FileText,
  UserCheck,
  Check,
} from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';

// --- NUESTRAS IMPORTACIONES DE UTILS ---
import {
  Entrevista,
  GradePlaceholder,
  CourseTopic,
  StudentGrades,
  ActiveTab,
  MainPanelState,
  Course,
  classNames,
  formatDateTime,
  bustUrl,
  generateAvatar,
  chunkArray,
  Chip,
  folderColors
} from './components/academia.utils';

// --- NUESTRAS IMPORTACIONES DE PANELES ---
import { HojaDeVidaPanel } from './components/HojaDeVidaPanel';
import { 
  WelcomePanel, 
  CourseWelcomeMessage 
} from './components/PanelesBienvenida';

// --- MOCK DATA ---
const mockStudents: Entrevista[] = [];

function createDefaultGradePlaceholders(count = 5): GradePlaceholder[] {
  const base = Date.now();
  return Array.from({ length: count }).map((_, i) => ({ id: base + i + Math.floor(Math.random() * 1000) }));
}

const initialCourseTopics: CourseTopic[] = [
  { id: 1, title: 'Asistencia', grades: createDefaultGradePlaceholders(12) },
];

// --- CONSTANTES ---
const TAB_INDICES: Record<ActiveTab, number> = { create: 0, hojaDeVida: 1, grades: 2, reports: 3 };

const STATE_LEVELS: Record<MainPanelState, number> = { 'welcome': 0, 'courseWelcome': 1, 'creating': 2, 'viewing': 2 };

const fixedContentBg = 'bg-[radial-gradient(1300px_900px_at_95%_5%,rgba(59,130,246,0.35),transparent_70%)]';


/** Página — Fullscreen + Mac 2025 */
export default function EstudiantePage() {
  // --- Estados ---
  const [activeTab, setActiveTab] = useState<ActiveTab>('hojaDeVida');
  const [prevTab, setPrevTab] = useState<ActiveTab>('hojaDeVida');
  const [students, setStudents] = useState<Entrevista[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [courseTopics, setCourseTopics] = useState<CourseTopic[]>([]);
  const [studentGrades, setStudentGrades] = useState<StudentGrades>({});
  const topicsContainerRef = useRef<HTMLDivElement | null>(null);
  const [lastAddedTopicId, setLastAddedTopicId] = useState<number | null>(null);
  const [mainState, setMainState] = useState<MainPanelState>('welcome');
  const [prevMainState, setPrevMainState] = useState<MainPanelState>('welcome');
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [fotoUrls, setFotoUrls] = useState<Record<string, string>>({});

  // --- Lógica de Datos ---
  async function getSignedUrlCached(path?: string | null) {
    if (!path) return null;
    if (fotoUrls[path]) return fotoUrls[path];
    
    if ((fotoUrls as any)[path] === 'loading') {
      await new Promise(r => setTimeout(r, 300));
      return getSignedUrlCached(path);
    }
    
    setFotoUrls((m) => ({ ...m, [path]: 'loading' as any }));
    
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

  function onUpdated(r: Entrevista) {
    setStudents((xs) => xs.map((x) => (x.id === r.id ? r : x)));
    
    if (selectedStudentId === r.id) {
      if ((r as any)._tempPreview) {
        setSignedUrl((r as any)._tempPreview);
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
              if (selectedStudentId === r.id) setSignedUrl(url);
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
    setSelectedStudentId(null);
  }

  const loadStudents = async (courseTitle: string) => {
    setLoadingStudents(true);
    setStudents([]);
    setSelectedStudentId(null);
    setFotoUrls({});
  
    try {
      let loadedStudents: Entrevista[] = [];

      if (courseTitle === 'Restauración 1') {
        console.log("Cargando estudiantes de: public.entrevistas");
        
        const { data, error } = await supabase
          .from('entrevistas')
          .select('*')
          .order('nombre', { ascending: true });
  
        if (error) {
          console.error("Error cargando entrevistas:", error);
          throw error;
        }
  
        loadedStudents = (data as Entrevista[]) || [];
        setStudents(loadedStudents); 
  
      } else {
        console.log(`Curso "${courseTitle}" seleccionado. No hay carga de datos implementada.`);
        setStudents([]);
      }

      if (loadedStudents.length > 0) {
        const fotoPaths = [
          ...new Set(loadedStudents.map((s) => s.foto_path).filter(Boolean) as string[]),
        ];

        if (fotoPaths.length > 0) {
          const { data: signedUrlsData, error: signError } = await supabase.storage
            .from("entrevistas-fotos")
            .createSignedUrls(fotoPaths, 60 * 10);

          if (signError) {
            console.error("Error firmando URLs por lotes:", signError);
          }

          if (signedUrlsData) {
            const urlMap = signedUrlsData.reduce(
              (acc, item) => {
                if (item.error) {
                  console.warn(`Error al firmar path individual: ${item.path}`, item.error);
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

  // --- Lógica de Navegación y Estado ---
  const handleTabClick = (newTab: ActiveTab) => {
    if (newTab !== activeTab) {
      setPrevTab(activeTab);
      setActiveTab(newTab);
    }
  };

  const handleSelectCourse = async (courseTitle: string) => {
    setPrevMainState(mainState); 
    setSelectedCourse(courseTitle);
    setMainState('courseWelcome');
    setSelectedStudentId(null);
    
    await loadStudents(courseTitle);
    
    const loadedTopics = JSON.parse(JSON.stringify(initialCourseTopics));
    setCourseTopics(loadedTopics);
    setStudentGrades({});
  };

  const handleGoBackToWelcome = () => {
    setPrevMainState(mainState); 
    setMainState('welcome');
    setSelectedCourse(null);
    setSelectedStudentId(null);
    setCourseTopics([]);
    setStudentGrades({});
    setStudents([]); 
    setSignedUrl(null); 
  };

  const handleGoBackToStudentList = () => {
    setPrevMainState(mainState); 
    setMainState('courseWelcome');
    setSelectedStudentId(null);
    setSignedUrl(null); 
  };

  const handleSelectStudent = async (id: string) => {
    setPrevMainState(mainState); 
    setSelectedStudentId(id);
    setMainState('viewing');
    setActiveTab('hojaDeVida');
    setPrevTab('hojaDeVida');
    
    const student = students.find(s => s.id === id);
    if (!student) return;

    setSignedUrl(null);
    if (student.foto_path) {
      const url = await getSignedUrlCached(student.foto_path);
      if (url) setSignedUrl(url);
    }

    const initialGradesForStudent: StudentGrades = {};
    courseTopics.forEach(topic => {
      initialGradesForStudent[topic.id] = {};
      topic.grades.forEach(gradePlaceholder => {
        initialGradesForStudent[topic.id][gradePlaceholder.id] = '';
      });
    });
    setStudentGrades(initialGradesForStudent);
  };

  const handleCreateNew = () => {
    setPrevMainState(mainState); 
    setSelectedStudentId(null);
    setMainState('creating');
    setActiveTab('create');
    setPrevTab('create');
    setStudentGrades({});
    setSignedUrl(null);
  };

  // --- Lógica de Asistencias (Grades) ---
  const handleGradeChange = (topicId: number, gradeId: number, value: string) => {
    setStudentGrades(prev => ({
      ...prev,
      [topicId]: { ...(prev[topicId] || {}), [gradeId]: value },
    }));
  };
  const handleAddGrade = (topicId: number) => {
    const newGradeId = Date.now() + Math.random();
    setCourseTopics(prev =>
      prev.map(topic =>
        topic.id === topicId ? { ...topic, grades: [...topic.grades, { id: newGradeId }] } : topic
      )
    );
    if (selectedStudentId) {
      setStudentGrades(prev => ({
        ...prev,
        [topicId]: { ...(prev[topicId] || {}), [newGradeId]: '' },
      }));
    }
  };
  const handleDeleteLastGrade = (topicId: number) => {
    let removed: number | null = null;
    setCourseTopics(prev =>
      prev.map(topic => {
        if (topic.id === topicId && topic.grades.length > 0) {
          removed = topic.grades[topic.grades.length - 1].id;
          return { ...topic, grades: topic.grades.slice(0, -1) };
        }
        return topic;
      })
    );
    if (removed !== null && selectedStudentId) {
      setStudentGrades(prev => {
        const topicGrades = { ...(prev[topicId] || {}) };
        delete topicGrades[removed!];
        return { ...prev, [topicId]: topicGrades };
      });
    }
  };
  const handleAddTopic = () => {
    const newTopic: CourseTopic = {
      id: Date.now(),
      title: 'Nuevo Tema',
      grades: createDefaultGradePlaceholders(5),
    };
    setCourseTopics(prev => [newTopic, ...prev]);
    if (selectedStudentId) {
      const init: Record<number, string> = {};
      newTopic.grades.forEach(g => (init[g.id] = ''));
      setStudentGrades(prev => ({ ...prev, [newTopic.id]: init }));
    }
    setLastAddedTopicId(newTopic.id);
  };
  const handleDeleteTopic = (topicId: number) => {
    setCourseTopics(prev => prev.filter(t => t.id !== topicId));
    if (selectedStudentId) {
      setStudentGrades(prev => {
        const copy = { ...prev };
        delete copy[topicId as unknown as keyof typeof copy];
        return copy;
      });
    }
  };
  const handleTopicTitleChange = (topicId: number, newTitle: string) => {
    setCourseTopics(prev => prev.map(t => (t.id === topicId ? { ...t, title: newTitle } : t)));
  };
  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Guardando estudiante:', selectedStudentId);
    console.log('Notas del estudiante:', studentGrades);
    console.log('Estructura del curso:', courseTopics);
  };

  // --- Helpers de UI ---
  const getTabPanelClasses = (tabName: ActiveTab): string => {
    const base =
      'w-full h-full flex flex-col min-h-0 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] [grid-area:1/1]';
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

  const selectedStudent = students.find(s => s.id === selectedStudentId);

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

  const courses: Course[] = [
    { title: "Restauración 1", color: "blue", onSelect: () => handleSelectCourse('Restauración 1') },
    { title: "Fundamentos 1", color: "indigo", onSelect: () => handleSelectCourse('Fundamentos 1') },
    { title: "Fundamentos 2", color: "teal", onSelect: () => handleSelectCourse('Fundamentos 2') },
    { title: "Restauración 2", color: "purple", onSelect: () => handleSelectCourse('Restauración 2') },
    { title: "Escuela de Siervos", color: "indigo", hasSpecialBadge: true, onSelect: () => handleSelectCourse('Escuela de Siervos') },
  ];

  // --- RENDER ---
  return (
    <main
      className="
        relative flex h-screen w-full items-stretch justify-stretch p-0
        text-gray-900 selection:bg-indigo-300/40 selection:text-gray-900
        bg-[conic-gradient(from_210deg_at_50%_0%,#EEF2FF_0%,#FAF5FF_40%,#F9FAFB_85%)]
      "
    >
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

        /* --- Estilos de Chip (Requeridos por PremiumAttendanceButton) --- */
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
        {/* --- MODIFICACIÓN DEL SIDEBAR APLICA AQUÍ --- */}
        {selectedCourse !== null && (
          <StudentSidebar
            className="md:animate-slide-in-left"
            students={students} 
            loading={loadingStudents}
            selectedStudentId={selectedStudentId}
            mainState={mainState}
            courseName={selectedCourse} 
            onSelectStudent={handleSelectStudent}
            onCreateNew={handleCreateNew}
            onGoBackToWelcome={handleGoBackToWelcome}
            fotoUrls={fotoUrls}
          />
        )}
        {/* --- FIN MODIFICACIÓN DEL SIDEBAR --- */}


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
          {/* Topbar CON TABS estilo glass flotantes */}
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

            {(mainState === 'creating' || mainState === 'viewing') && (
              <nav
                className="
                  flex items-center gap-1.5 p-1
                  rounded-full border border-white/70 bg-white/25 backdrop-blur-2xl
                  shadow-[0_8px_28px_-10px_rgba(2,6,23,0.28),inset_0_1px_0_rgba(255,255,255,0.65)]
                "
              >
                {mainState === 'creating' && (
                  <TabButton
                    icon={<User className="h-4 w-4" />}
                    label="Crear Estudiante"
                    isActive={activeTab === 'create'}
                    onClick={() => handleTabClick('create')}
                  />
                )}
                {mainState === 'viewing' && (
                  <>
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
                  </>
                )}
              </nav>
            )}
          </div>

          {/* Body apilado ocupa TODO */}
          <div className="flex-1 min-h-0 grid grid-cols-1 [grid-template-areas:'stack'] overflow-hidden">

            {/* Paneles de Bienvenida (Importados) */}
            <WelcomePanel 
              onSelectCourse={handleSelectCourse} 
              className={getContentPanelClasses('welcome')}
              isActive={mainState === 'welcome'}
              courses={courses}
            />

            {mainState === 'courseWelcome' && (
              <div className="md:hidden flex items-center justify-center p-8 text-center text-gray-500 [grid-area:stack]">
                Selecciona un estudiante de la lista.
              </div>
            )}
            
            {mainState === 'courseWelcome' && (
              <CourseWelcomeMessage 
                courseName={selectedCourse || 'Curso'} 
                className={getContentPanelClasses('courseWelcome')}
              />
            )}


            {(mainState === 'creating' || mainState === 'viewing') && (
              <form
                onSubmit={handleSaveStudent}
                className={`[grid-area:stack] w-full h-full grid grid-cols-1 [grid-template-areas:'stack'] overflow-hidden ${getContentPanelClasses(['creating', 'viewing'])}`}
              >
                {/* Crear estudiante */}
                <div className={getTabPanelClasses('create')}>
                  <section className="p-6 md:p-8 overflow-y-auto flex-1 min-h-0">
                    <CardSection title="Información del Estudiante">
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <FormInput label="Nombre Completo" id="full-name" type="text" icon={<User size={18} />} />
                        <FormInput label="ID de Estudiante" id="student-id" type="text" icon={<BookMarked size={18} />} />
                        <FormInput label="Email" id="email" type="email" icon={<Mail size={18} />} />
                        <FormInput label="Fecha de Nacimiento" id="dob" type="date" icon={<Calendar size={18} />} />
                      </div>
                    </CardSection>
                    <FormActions />
                  </section>
                </div>

                {/* Registrar notas */}
                <div className={getTabPanelClasses('grades')}>
                  <section className="p-4 md:p-6 lg:p-8 overflow-y-auto flex-1 min-h-0">
                    <div
                      className="
                        relative rounded-[22px]
                        border border-white/80
                        bg-white/25 backdrop-blur-[22px]
                        shadow-[0_30px_80px_-35px_rgba(2,6,23,0.45),inset_0_1px_0_rgba(255,255,255,0.7)]
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


                      </div>

                      <div className="space-y-6" ref={topicsContainerRef}>
                        {courseTopics.length === 0 && (
                          <CardSection>
                            <p className="text-sm text-gray-700 text-center py-4">
                              No hay temas definidos para este curso. Haz clic en &quot;Añadir Tema&quot; para empezar.
                            </p>
                          </CardSection>
                        )}

                        {courseTopics.map((topic) => (
                          <div id={`topic-${topic.id}`} key={`wrap-${topic.id}`}>
                            <CardSection
                              key={topic.id}
                              title={topic.title}
                              icon={<UserCheck size={16} className="text-indigo-900/70" />}
                              isEditable={true}
                              onTitleChange={(newTitle) => handleTopicTitleChange(topic.id, newTitle)}
                              autoFocus={topic.id === lastAddedTopicId}
                              onAutoFocus={() => setLastAddedTopicId(null)}

                            >
                              <GradeGrid
                                gradePlaceholders={topic.grades}
                                studentGradesForTopic={studentGrades[topic.id] || {}}
                                topicId={topic.id}
                                onGradeChange={handleGradeChange}
                              />
                            </CardSection>
                          </div>
                        ))}
                      </div>

                      <FormActions />
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
                        Aquí se mostrarán gráficos y estadísticas (Recharts, etc.).
                      </p>
                    </CardSection>
                  </section>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

// --- SUBCOMPONENTES (SOLO LOS QUE QUEDAN EN ESTE ARCHIVO) ---

/* =======================
    SIDEBAR “APPLE PREMIUM” (ACTUALIZADO)
    ======================= */
function StudentSidebar({
  students,
  selectedStudentId,
  mainState,
  onSelectStudent,
  onCreateNew,
  className = '',
  onGoBackToWelcome,
  courseName,
  loading,
  fotoUrls,
}: {
  students: Entrevista[];
  selectedStudentId: string | null;
  mainState: MainPanelState;
  onSelectStudent: (id: string) => void;
  onCreateNew: () => void;
  className?: string;
  onGoBackToWelcome: () => void;
  courseName?: string;
  loading: boolean;
  fotoUrls: Record<string, string>;
}) {
  const isDetailView = mainState === 'creating' || mainState === 'viewing';

  const gradientClasses = [
    'bg-gradient-to-br from-blue-100/95 to-purple-100/95 shadow shadow-blue-200/50 hover:shadow-md hover:shadow-blue-300/60',
    'bg-gradient-to-br from-teal-100/95 to-emerald-100/95 shadow shadow-teal-200/50 hover:shadow-md hover:shadow-teal-300/60',
    'bg-gradient-to-br from-orange-100/95 to-amber-100/95 shadow shadow-orange-200/50 hover:shadow-md hover:shadow-orange-300/60',
    'bg-gradient-to-br from-pink-100/95 to-rose-100/95 shadow shadow-pink-200/50 hover:shadow-md hover:shadow-pink-300/60',
    'bg-gradient-to-br from-sky-100/95 to-cyan-100/95 shadow shadow-sky-200/50 hover:shadow-md hover:shadow-sky-300/60',
  ];

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
        transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
        ${isDetailView ? 'translate-x-[-100%] md:translate-x-0' : 'translate-x-0'}
        ${className}
      `}
      aria-label="Barra lateral de estudiantes"
    >
      {/* Header - Compacto y Premium */}
      <div className="flex-shrink-0 p-3 pb-2 border-b border-white/60 bg-white/60 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
        <button
          type="button"
          onClick={onGoBackToWelcome}
          className="flex items-center gap-1.5 px-2 py-1 text-sm font-medium text-gray-700 hover:text-indigo-600 rounded-lg hover:bg-white/70 transition-colors duration-150"
        >
          <ArrowLeft size={16} />
          <span className="text-[13px]">Volver a Cursos</span>
        </button>

        {/* Título centrado tipo Mac */}
        {courseName && (
          <div className="pt-2 text-center">
            <h2 className="text-xl font-bold tracking-[-0.03em] bg-gradient-to-r from-indigo-700 to-purple-600 bg-clip-text text-transparent">
              {courseName}
            </h2>
          </div>
        )}
      </div>

      {/* Buscador iOS */}
      <div className="flex-shrink-0 p-4 border-b border-white/60">
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar estudiante…"
            className="w-full rounded-2xl border border-white/70 bg-white/75 backdrop-blur-xl py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-600 shadow-[inset_0_2px_6px_rgba(0,0,0,0.03)] focus:outline-none focus:ring-4 focus:ring-indigo-400/25 focus:border-white transition"
            aria-label="Buscar estudiante"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
        </div>
      </div>

      {/* Lista */}
      <nav className="overflow-y-auto p-3 space-y-2 max-h-80 md:flex-1 md:max-h-none [scrollbar-width:thin] [scrollbar-color:rgba(0,0,0,.15)_transparent]">
        {loading ? (
          <div className="p-4 text-center text-gray-600">Cargando...</div>
        ) : students.length === 0 ? (
          <div className="p-4 text-center text-gray-600">No hay estudiantes en este curso.</div>
        ) : (
          students.map((student, index) => {
            const active = selectedStudentId === student.id;
            const gradientStyle = gradientClasses[index % gradientClasses.length];
            
            return (
              <a
                key={student.id}
                href="#"
                onClick={(e) => { e.preventDefault(); onSelectStudent(student.id); }}
                className={[
                  'group relative flex items-center gap-4 md:gap-3 rounded-2xl p-4 md:p-3 transition-all border overflow-hidden',
                  'before:absolute before:inset-0 before:pointer-events-none before:opacity-0',
                  'before:bg-[radial-gradient(300px_180px_at_0%_0%,rgba(99,102,241,0.10),transparent_60%)]',
                  'hover:before:opacity-100',
                  active
                    ? 'border-transparent text-indigo-950 bg-gradient-to-r from-white/90 to-white/70 shadow-[0_6px_14px_-9px_rgba(76,29,149,0.35)] ring-1 ring-indigo-500/30'
                    : `${gradientStyle} border-transparent text-gray-900 hover:brightness-105`,
                ].join(' ')}
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
                      active ? "text-gray-600/90" : "text-gray-700/80"
                    )}>
                    C.C {student.cedula ? student.cedula : student.id.substring(0, 8) + '...'}
                  </span>
                </div>
                <span className="opacity-0 group-hover:opacity-100 text-[10px] rounded-md px-2 py-0.5 border border-white/70 bg-white/70 text-gray-700 transition">
                  Ver
                </span>
              </a>
            );
          })
        )}
      </nav>


      {/* Botón nuevo */}
      <div className="flex-shrink-0 p-4 border-t border-white/60">
        <button
          onClick={onCreateNew}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-medium backdrop-blur-sm transition-all ${
            mainState === 'creating'
              ? 'border-transparent bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg hover:shadow-[0_15px_35px_-15px_rgba(99,102,241,0.65)]'
              : 'border-white/70 bg-white/70 text-indigo-700 hover:bg-white/85 shadow-[0_6px_16px_-12px_rgba(2,6,23,.25)]'
          }`}
        >
          <Plus size={18} />
          <span>Nuevo Estudiante</span>
        </button>
      </div>
    </aside>
  );
}

function StudentAvatar({
  fotoPath,
  nombre,
  fotoUrls
}: {
  fotoPath?: string | null;
  nombre?: string | null;
  fotoUrls: Record<string, string>;
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

/** TAB style */
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

function StudentForm() {
  return (
    <div className="mb-8">
      <h2 className="sr-only">Formulario de estudiante</h2>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <FormInput label="Nombre Completo" id="full-name" type="text" icon={<User size={18} />} />
        <FormInput label="ID de Estudiante" id="student-id" type="text" icon={<BookMarked size={18} />} />
        <FormInput label="Email" id="email" type="email" icon={<Mail size={18} />} />
        <FormInput label="Fecha de Nacimiento" id="dob" type="date" icon={<Calendar size={18} />} />
      </div>
    </div>
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

function FormActions() {
  return (
    <div className="mt-8 pt-6 border-t border-white/60 flex justify-end">
      <button
        type="submit"
        className="inline-flex items-center justify-center gap-2 rounded-full h-12 px-8 bg-gradient-to-r from-indigo-500 to-purple-600 text-sm font-semibold text-white shadow-[0_12px_30px_-12px_rgba(99,102,241,0.6)] transition-all hover:shadow-[0_18px_40px_-14px_rgba(99,102,241,0.7)] focus:outline-none focus:ring-4 focus:ring-indigo-400/25 active:scale-[0.99]"
      >
        Guardar
      </button>
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

// (WelcomePanel, CourseWelcomeMessage, CourseFolder, HojaDeVidaPanel, etc. ya no están aquí)