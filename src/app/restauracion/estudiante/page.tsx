'use client';

import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';

// --- TIPOS DE DATOS ---
type Student = {
  id: string;
  name: string;
  avatarUrl: string;
};

type GradePlaceholder = { id: number };
type CourseTopic = { id: number; title: string; grades: GradePlaceholder[] };
type StudentGrades = Record<number, Record<number, string>>;
type ActiveTab = 'create' | 'grades' | 'reports';
type MainPanelState = 'welcome' | 'courseWelcome' | 'creating' | 'viewing';

// MODIFICADO: Definición del tipo Course con hasSpecialBadge opcional
type Course = {
  title: string;
  color: keyof typeof folderColors;
  hasSpecialBadge?: boolean; // <-- Propiedad opcional
  onSelect: () => void;
};

// --- MOCK DATA ---
const mockStudents: Student[] = [
    { id: '1', name: 'Olivia Chen', avatarUrl: 'https://placehold.co/100x100/F9F871/4A4A4A?text=OC' },
    { id: '2', name: 'Ethan Sato',  avatarUrl: 'https://placehold.co/100x100/A3E4D7/4A4A4A?text=ES' },
    { id: '3', name: 'Staya Patel', avatarUrl: 'https://placehold.co/100x100/D7BDE2/4A4A4A?text=SP' },
    { id: '4', name: 'Maya Singh',  avatarUrl: 'https://placehold.co/100x100/F5B7B1/4A4A4A?text=MS' },
    { id: '5', name: 'Alex Thompson', avatarUrl: 'https://placehold.co/100x100/AED6F1/4A4A4A?text=AT' },
    { id: '6', name: 'Liam Garcia', avatarUrl: 'https://placehold.co/100x100/FAD7A0/4A4A4A?text=LG' },
    { id: '7', name: 'Sophia Kim',  avatarUrl: 'https://placehold.co/100x100/82E0AA/4A4A4A?text=SK' },
    { id: '8', name: 'Noah Brown',  avatarUrl: 'https://placehold.co/100x100/D2B4DE/4A4A4A?text=NB' },
];

function createDefaultGradePlaceholders(count = 5): GradePlaceholder[] {
  const base = Date.now();
  return Array.from({ length: count }).map((_, i) => ({ id: base + i + Math.floor(Math.random() * 1000) }));
}

const initialCourseTopics: CourseTopic[] = [
  { id: 1, title: 'Actividades Generales', grades: createDefaultGradePlaceholders(5) },
];

// --- CONSTANTES ---
const TAB_INDICES: Record<ActiveTab, number> = { create: 0, grades: 1, reports: 2 };

// Niveles para la animación de paneles
const STATE_LEVELS: Record<MainPanelState, number> = { 'welcome': 0, 'courseWelcome': 1, 'creating': 2, 'viewing': 2 };

const folderColors = {
  blue: 'text-blue-500/80 fill-blue-500/20',
  indigo: 'text-indigo-500/80 fill-indigo-500/20',
  teal: 'text-teal-500/80 fill-teal-500/20',
  purple: 'text-purple-500/80 fill-purple-500/20',
  pink: 'text-pink-500/80 fill-pink-500/20',
};

// --- Fondos dinámicos "Cupertino" para el panel de contenido ---
const fixedContentBg = 'bg-[radial-gradient(1300px_900px_at_95%_5%,rgba(59,130,246,0.35),transparent_70%)]';


function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size));
  return chunks;
}

/** Página — Fullscreen + Mac 2025 */
export default function EstudiantePage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('grades');
  const [prevTab, setPrevTab] = useState<ActiveTab>('grades');

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const [courseTopics, setCourseTopics] = useState<CourseTopic[]>([]);
  const [studentGrades, setStudentGrades] = useState<StudentGrades>({});

  const topicsContainerRef = useRef<HTMLDivElement | null>(null);
  const [lastAddedTopicId, setLastAddedTopicId] = useState<number | null>(null);

  const [mainState, setMainState] = useState<MainPanelState>('welcome');
  const [prevMainState, setPrevMainState] = useState<MainPanelState>('welcome');
  
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  

  const handleTabClick = (newTab: ActiveTab) => {
    if (newTab !== activeTab) {
      setPrevTab(activeTab);
      setActiveTab(newTab);
    }
  };

  
  const handleSelectCourse = (courseTitle: string) => {
    setPrevMainState(mainState); 
    setSelectedCourse(courseTitle);
    setMainState('courseWelcome');
    setSelectedStudentId(null);
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
  };

  const handleGoBackToStudentList = () => {
    setPrevMainState(mainState); 
    setMainState('courseWelcome');
    setSelectedStudentId(null);
  };

  const handleSelectStudent = (id: string) => {
    setPrevMainState(mainState); 
    setSelectedStudentId(id);
    setMainState('viewing');
    setActiveTab('grades');
    setPrevTab('grades');
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
  };

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
    // MODIFICADO: Se usa la misma curva y duración que las tabs
    const base = 'transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]'; 
    const statesArray = Array.isArray(activeStates) ? activeStates : [activeStates];
    
    const isActive = statesArray.includes(mainState);
    const wasActive = statesArray.includes(prevMainState); 

    const currentLevel = STATE_LEVELS[mainState];
    const prevLevel = STATE_LEVELS[prevMainState];
    // Asegurarse de que myLevel siempre tenga un valor válido, incluso si activeStates está vacío (aunque no debería pasar)
    const myLevel = statesArray.length > 0 ? STATE_LEVELS[statesArray[0]] : -1; 

    if (isActive) {
      // Estado activo: entra sin translate y escala normal
      return `${base} opacity-100 translate-x-0 scale-100 pointer-events-auto`;
    } 
    
    // Estado de salida (era activo pero ya no lo es)
    if (wasActive && mainState !== prevMainState) {
      // Determina dirección de salida basado en si el nuevo estado es "más profundo" o "más superficial"
      const exitDir = (currentLevel > prevLevel) ? '-translate-x-8' : 'translate-x-8';
      // Aplica la dirección de salida y la escala reducida
      return `${base} opacity-0 ${exitDir} scale-[0.985] pointer-events-none`;
    }
    
    // Estado oculto inicial (nunca fue activo)
    // Determina dirección inicial basado en si está "más allá" o "antes" del estado actual
    const hiddenDir = myLevel > currentLevel ? 'translate-x-8' : '-translate-x-8';
    // Comienza fuera de la pantalla (translate) y opaco
    return `${base} opacity-0 ${hiddenDir} pointer-events-none`;
};

  const selectedStudent = mockStudents.find(s => s.id === selectedStudentId);

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

  // MODIFICADO: Lista de cursos definida fuera, con el tipo correcto
  const courses: Course[] = [
    { title: "Restauración", color: "blue", onSelect: () => handleSelectCourse('Restauración') },
    { title: "Fundamentos 1", color: "indigo", onSelect: () => handleSelectCourse('Fundamentos 1') },
    { title: "Fundamentos 2", color: "teal", onSelect: () => handleSelectCourse('Fundamentos 2') },
    { title: "Restauración 2", color: "purple", onSelect: () => handleSelectCourse('Restauración 2') },
    { title: "Escuela de Siervos", color: "indigo", hasSpecialBadge: true, onSelect: () => handleSelectCourse('Escuela de Siervos') },
  ];

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
      `}</style>

      {/* Grid sutil */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background:radial-gradient(circle,_#000_1px,_transparent_1px)] [background-size:22px_22px]" />

      <div
        className="
          relative flex w-full min-h-0
          overflow-hidden /* Scroll manejado por paneles internos */
          rounded-none border-none bg-white/40 backdrop-blur-2xl
          ring-0 shadow-none
          bg-[linear-gradient(145deg,rgba(99,102,241,0.08),rgba(255,255,255,0.07))]
          md:flex-row 
        "
      >
        {/* Sidebar */}
        {selectedCourse !== null && (
          <StudentSidebar
            className="md:animate-slide-in-left"
            students={mockStudents}
            selectedStudentId={selectedStudentId}
            mainState={mainState}
            courseName={selectedCourse} 
            onSelectStudent={handleSelectStudent}
            onCreateNew={handleCreateNew}
            onGoBackToWelcome={handleGoBackToWelcome}
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
                      icon={<BookMarked className="h-4 w-4" />}
                      label="Registrar Notas"
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

            
            <WelcomePanel 
              onSelectCourse={handleSelectCourse} 
              className={getContentPanelClasses('welcome')}
              isActive={mainState === 'welcome'}
              courses={courses} // MODIFICADO: Se pasa la lista de cursos
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
                // MODIFICADO: Se aplica getContentPanelClasses directamente al form
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

                {/* Registrar notas — GLASSMORPHISM MAC 2025 */}
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
                        <h2 className="text-[20px] md:text-[22px] font-semibold text-gray-900 tracking-[-0.015em]">
                          Registrar Notas para:{' '}
                          <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                            {selectedStudent?.name ?? 'N/A'}
                          </span>
                        </h2>

                        <button
                          type="button"
                          onClick={handleAddTopic}
                          className="
                            flex items-center justify-center gap-2 rounded-[14px]
                            border border-white/70 bg-white/55 backdrop-blur-xl
                            px-3.5 py-2 text-sm font-medium text-gray-800
                            shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_24px_-10px_rgba(2,6,23,0.25)]
                            hover:bg-white/80 hover:shadow-[inset_0_1px_0_rgba(255,255,255,1),0_12px_30px_-12px_rgba(2,6,23,0.32)]
                            active:scale-[0.99] transition-all
                          "
                          aria-label="Añadir nuevo tema"
                        >
                          <Plus size={16} />
                          <span>Añadir Tema</span>
                        </button>
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
                              isEditable={true}
                              onTitleChange={(newTitle) => handleTopicTitleChange(topic.id, newTitle)}
                              autoFocus={topic.id === lastAddedTopicId}
                              onAutoFocus={() => setLastAddedTopicId(null)}
                              actions={
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteTopic(topic.id)}
                                    className="flex items-center justify-center p-1.5 rounded-full border border-white/70 bg-white/60 text-gray-600 transition-all shadow-sm hover:bg-white/80 hover:text-red-500"
                                    aria-label={`Eliminar tema ${topic.title}`}
                                  >
                                    <X size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteLastGrade(topic.id)}
                                    disabled={topic.grades.length === 0}
                                    className="flex items-center justify-center p-1.5 rounded-full border border-white/70 bg-white/60 text-gray-600 transition-all shadow-sm hover:bg-white/80 hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                    aria-label={`Eliminar última nota de ${topic.title}`}
                                  >
                                    <Minus size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAddGrade(topic.id)}
                                    className="flex items-center justify-center p-1.5 rounded-full border border-white/70 bg-white/60 text-gray-600 transition-all shadow-sm hover:bg-white/80 hover:text-indigo-600"
                                    aria-label={`Añadir nota a ${topic.title}`}
                                  >
                                    <Plus size={16} />
                                  </button>
                                </div>
                              }
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

// --- SUBCOMPONENTES ---
function WelcomePanel({
  onSelectCourse,
  className = '',
  isActive, 
  courses 
}: {
  onSelectCourse: (title: string) => void; 
  className?: string;
  isActive: boolean; 
  courses: readonly Course[]; 
}) {
  const cardDelay = 100;
  const foldersContainerDelay = cardDelay + 100; // 200ms
  const folderStagger = 75; 
  const animationDuration = 500; 
  const easing = 'cubic-bezier(0.25, 0.1, 0.25, 1)';

  return (
    <div className={`flex w-full h-full flex-col items-center justify-start pt-6 pb-10 px-4 md:px-12 text-center [grid-area:stack] overflow-y-auto overflow-x-hidden ${className}`}>
      {/* Tarjeta de Bienvenida */}
      <div 
        className={`
          group relative overflow-hidden rounded-3xl border border-white/70 bg-white/55 px-6 md:px-10 py-8 md:py-12 shadow-xl backdrop-blur-xl w-full max-w-md md:max-w-sm
          transition-all duration-${animationDuration} ease-[${easing}]
          ${isActive ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}
        `}
        style={{ transitionDelay: `${isActive ? cardDelay : 0}ms` }} 
      >
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-gradient-to-br from-indigo-500/25 to-white/25 blur-3xl" />
        <BookMarked className="w-14 h-14 md:w-16 md:h-16 mx-auto text-indigo-500/90" />
        <h1 className="mt-6 text-xl md:text-2xl font-semibold tracking-tight text-gray-900">Bienvenido al Gestor Académico</h1>
        <p className="mt-2 max-w-sm text-sm md:text-base text-gray-700 mx-auto">Selecciona un curso para empezar a gestionar estudiantes y registrar calificaciones.</p>
      </div>
      
      {/* Título Cursos */}
      <h2 
         className={`
          text-lg md:text-xl font-semibold mt-8 md:mt-10 mb-6 md:mb-8 text-gray-800
          transition-all duration-${animationDuration} ease-[${easing}]
          ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}
        `}
        style={{ transitionDelay: `${isActive ? foldersContainerDelay - 50 : 0}ms` }} 
      >
        Cursos Disponibles
      </h2>

      {/* Contenedor Carpetas */}
      <div className="w-full max-w-full md:max-w-5xl lg:max-w-7xl px-4 md:px-0"> 
        <div 
          className={`
            flex flex-wrap md:flex-nowrap items-center justify-center 
            gap-4 md:gap-6 w-full 
            pb-4 px-1 md:pb-4 md:px-4 
            overflow-x-auto 
            transition-opacity duration-${animationDuration} ease-[${easing}]
            ${isActive ? 'opacity-100' : 'opacity-0'}
            [scrollbar-width:thin] [scrollbar-color:rgba(0,0,0,.15)_transparent] 
          `}
          style={{ transitionDelay: `${isActive ? foldersContainerDelay : 0}ms` }}
        >
          
          {courses.map((course, index) => (
            <CourseFolder 
              key={course.title}
              title={course.title} 
              color={course.color} 
              hasSpecialBadge={course.hasSpecialBadge} 
              onSelect={course.onSelect} 
              className={`
                transition-all duration-300 ease-out 
                ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
              `}
              style={{ transitionDelay: `${isActive ? foldersContainerDelay + index * folderStagger : 0}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CourseWelcomeMessage({
  courseName,
  className = '',
}: {
  courseName: string;
  className?: string;
}) {
  const isActive = className.includes('opacity-100');
  const animationDuration = 500; 
  const easing = 'cubic-bezier(0.25, 0.1, 0.25, 1)';

  return (
    <div className={`hidden md:flex flex-col items-center justify-center p-10 text-center [grid-area:stack] overflow-y-auto h-full ${className}`}>
      <div 
        className={`
          group relative overflow-hidden rounded-3xl border border-white/70 bg-white/55 px-10 py-12 shadow-xl backdrop-blur-xl
          transition-all duration-${animationDuration} ease-[${easing}] delay-100 
          ${isActive ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}
        `}
      >
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-gradient-to-br from-indigo-500/25 to-white/25 blur-3xl" />
        <Folder size={64} className="mx-auto text-indigo-500/90" />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-gray-900">
          Bienvenido al panel de <br />
          <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            {courseName}
          </span>
        </h1>
        <p className="mt-4 max-w-sm text-base text-gray-700">Selecciona un estudiante de la lista para ver sus notas o crea un nuevo registro para este curso.</p>
      </div>
    </div>
  );
}

/* =======================
    SIDEBAR “APPLE PREMIUM”
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
}: {
  students: Student[];
  selectedStudentId: string | null;
  mainState: MainPanelState;
  onSelectStudent: (id: string) => void;
  onCreateNew: () => void;
  className?: string;
  onGoBackToWelcome: () => void;
  courseName?: string;
}) {
  const isDetailView = mainState === 'creating' || mainState === 'viewing';

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
      {/* Header */}
      <div className="flex-shrink-0 p-3 border-b border-white/60 flex items-center bg-white/60 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
        <button
          type="button"
          onClick={onGoBackToWelcome}
          className="flex items-center gap-2 text-sm font-medium text-gray-800 hover:text-indigo-600 rounded-lg p-2 hover:bg-white/70 transition-colors duration-150 w-full"
        >
          <ArrowLeft size={18} />
          <span>Volver a Cursos</span>
        </button>
      </div>

      {/* Módulo */}
      {courseName && (
        <div className="px-4 py-3 border-b border-white/60">
          <p className="text-xs text-gray-600">Módulo:</p>
          <p className="mt-1 text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent truncate">
            {courseName}
          </p>
        </div>
      )}

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
        {students.map((student) => {
          const active = selectedStudentId === student.id;
          return (
            <a
              key={student.id}
              href="#"
              onClick={(e) => { e.preventDefault(); onSelectStudent(student.id); }}
              className={[
                'group relative flex items-center gap-3 rounded-2xl p-3 transition-all border overflow-hidden',
                'before:absolute before:inset-0 before:pointer-events-none before:opacity-0',
                'before:bg-[radial-gradient(300px_180px_at_0%_0%,rgba(99,102,241,0.10),transparent_60%)]',
                'hover:before:opacity-100',
                active
                  ? 'border-transparent text-indigo-950 bg-gradient-to-r from-white/90 to-white/70 shadow-[0_12px_28px_-18px_rgba(76,29,149,0.35)] ring-1 ring-indigo-500/30'
                  : 'border-white/70 bg-white/55 text-gray-800 hover:bg-white/75 shadow-[0_8px_20px_-16px_rgba(2,6,23,0.25)] hover:shadow-[0_16px_28px_-18px_rgba(2,6,23,0.35)]',
              ].join(' ')}
            >
              <img
                src={student.avatarUrl}
                alt={student.name}
                className="h-10 w-10 rounded-full border-2 border-white/80 ring-1 ring-black/5 object-cover shadow-[0_4px_10px_-6px_rgba(2,6,23,.35)]"
                onError={(e) => {
                  const t = e.currentTarget;
                  t.src = `https://placehold.co/100x100/CCC/666?text=${student.name.split(' ').map(n => n[0]).join('')}`;
                }}
              />
              <div className="flex-1">
                <span className="block text-[13.5px] font-semibold leading-tight tracking-[-0.01em]">
                  {student.name}
                </span>
                <span className="block text-[11.5px] text-gray-600/90">ID #{student.id}</span>
              </div>
              <span className="opacity-0 group-hover:opacity-100 text-[10px] rounded-md px-2 py-0.5 border border-white/70 bg-white/70 text-gray-700 transition">
                Ver
              </span>
            </a>
          );
        })}
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
        'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 focus:outline-none',
        isActive
          ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_8px_24px_-10px_rgba(76,29,149,0.45)]'
          : 'text-gray-700 bg-white/28 hover:bg-white/40 backdrop-blur-xl border border-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]',
      ].join(' ')}
      aria-current={isActive ? 'page' : undefined}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function CardSection({
  title,
  children,
  actions,
  isEditable = false,
  onTitleChange,
  autoFocus,
  onAutoFocus,
}: {
  title?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
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
      onAutoFocus && requestAnimationFrame(() => onAutoFocus());
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
        <div className="flex justify-between items-center mb-4">
          {title && isEditable ? (
            isEditing ? (
              <input
                ref={inputRef}
                type="text"
                value={currentTitle}
                onChange={(e) => setCurrentTitle(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={handleKeyDown}
                className="text-base md:text-[17px] font-semibold tracking-tight text-gray-900 bg-white/80 rounded-lg px-2 py-0 -ml-2"
              />
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="group flex items-center gap-2 cursor-text rounded-lg px-2 py-0 -ml-2 hover:bg-white/50"
              >
                <h3 className="text-base md:text-[17px] font-semibold tracking-tight text-gray-900">{currentTitle}</h3>
                <Edit2 size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )
          ) : title ? (
            <h3 className="text-base md:text-[17px] font-semibold tracking-tight text-gray-900">{title}</h3>
          ) : null}
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
              const hasValue = (gradeValue ?? '') !== '';
              const boxClasses = `
                relative group flex flex-col items-center justify-center h-14
                rounded-[18px] border border-white/60 bg-white/40 backdrop-blur-xl
                ring-1 ring-black/5
                shadow-[0_12px_30px_-18px_rgba(2,6,23,0.35),inset_0_1px_0_0_rgba(255,255,255,0.65)]
                transition-all duration-300 hover:-translate-y-[1px]
                hover:bg-white/55 hover:shadow-[0_20px_40px_-18px_rgba(2,6,23,0.45)]
                ${hasValue ? 'ring-2 ring-indigo-500/35 shadow-[0_22px_45px_-18px_rgba(99,102,241,0.35)]' : ''}
                p-1 overflow-hidden
                bg-[linear-gradient(145deg,rgba(99,102,241,0.06),rgba(255,255,255,0.05))]
              `;
              return (
                <div key={placeholder.id} className={boxClasses}>
                  <div className="pointer-events-none absolute inset-0 rounded-[18px] opacity-70 bg-[radial-gradient(140px_90px_at_8%_-8%,rgba(99,102,241,0.18),transparent),radial-gradient(140px_90px_at_110%_120%,rgba(200,200,200,0.08),transparent)]" />
                  <span className="relative text-[11px] uppercase tracking-wide text-gray-600/90 mb-1 select-none">
                    Nota {noteNumber}
                  </span>
                  <input
                    id={`grade-${topicId}-${placeholder.id}`}
                    type="number"
                    min="0"
                    max="100"
                    value={gradeValue}
                    onChange={(e) => onGradeChange(topicId, placeholder.id, e.target.value)}
                    className="relative w-10 text-sm md:text-base font-semibold text-center tabular-nums bg-transparent text-gray-900 placeholder-gray-500 rounded-md outline-none focus:ring-4 focus:ring-indigo-500/40 focus:bg-white/70 transition-transform duration-200 focus:scale-[1.02]"
                    placeholder="--"
                    inputMode="numeric"
                  />
                </div>
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

{/* ================================================================== */}
{/* --- COMPONENTE COURSEFOLDER MODIFICADO CON ANIMACIÓN "APPLE 2025" --- */}
{/* ================================================================== */}
function CourseFolder({
  title,
  color = 'blue',
  hasSpecialBadge = false,
  onSelect,
  className = '', 
  style = {}      
}: {
  title: string;
  color?: keyof typeof folderColors;
  hasSpecialBadge?: boolean;
  onSelect: () => void;
  className?: string; 
  style?: React.CSSProperties; 
}) {
  const colorClasses = folderColors[color] || folderColors.blue;
  
  // Define una curva de easing personalizada para esa sensación "Apple"
  const appleEase = 'ease-[cubic-bezier(0.2,0.8,0.2,1)]';
  const duration = 'duration-300'; // Un poco más lento para más fluidez

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        relative flex flex-col items-center justify-start w-36 h-36 md:w-44 md:h-44 
        rounded-3xl p-4 
        
        /* --- MODIFICACIONES CLAVE --- */
        
        /* 1. Sombra base sutil */
        shadow-lg shadow-black/5
        
        /* 2. Transición fluida para transform y sombra con easing personalizado */
        transition-all ${duration} ${appleEase}
        
        /* 3. Efecto hover: levanta, escala sutilmente y expande la sombra */
        hover:scale-[1.03] hover:-translate-y-1.5 
        hover:shadow-xl hover:shadow-indigo-500/20
        
        /* 4. Efecto active: se presiona (reseteando el translate-y) */
        active:scale-[0.98] active:translate-y-0
        
        /* --- FIN DE MODIFICACIONES --- */

        focus:outline-none focus:ring-4 focus:ring-indigo-400/25 group text-center 
        flex-shrink-0 
        ${className} 
      `}
      style={style} 
    >
      <Folder 
        className={`
          w-20 h-20 md:w-24 md:h-24 mb-2 md:mb-3 ${colorClasses} 
          
          /* --- MODIFICACIONES ICONO --- */
          transition-all ${duration} ${appleEase} /* Sincroniza la animación */
          drop-shadow-md 
          group-hover:drop-shadow-lg 
          group-hover:-translate-y-1 /* El icono se levanta un poco (parallax) */
          /* --- FIN DE MODIFICACIONES --- */
        `} 
        strokeWidth={1} 
      />
      
      <h4 
        className={`
          text-xs md:text-sm font-semibold text-gray-800 w-full 
          
          /* --- MODIFICACIONES TEXTO --- */
          transition-colors ${duration} ease-out /* Transición de color suave */
          group-hover:text-indigo-600
          /* --- FIN DE MODIFICACIONES --- */
        `}
      >
        {title}
      </h4>
      
      {hasSpecialBadge && (
        <div className="absolute top-8 right-8 z-10 p-1.5 rounded-full bg-white/70 border border-yellow-300 shadow-lg backdrop-blur-md">
          <Star size={20} className="text-yellow-500 fill-yellow-400/30 drop-shadow-sm" strokeWidth={1.5}/>
        </div>
      )}
    </button>
  );
}