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

// --- MOCK DATA ---
const mockStudents: Student[] = [
  { id: '1', name: 'Olivia Chen', avatarUrl: 'https://placehold.co/100x100/F9F871/4A4A4A?text=OC' },
  { id: '2', name: 'Ethan Sato',  avatarUrl: 'https://placehold.co/100x100/A3E4D7/4A4A4A?text=ES' },
  { id: '3', name: 'Staya Patel', avatarUrl: 'https://placehold.co/100x100/D7BDE2/4A4A4A?text=SP' },
  { id: '4', name: 'Maya Singh',  avatarUrl: 'https://placehold.co/100x100/F5B7B1/4A4A4A?text=MS' },
  { id: '5', name: 'Alex Thompson', avatarUrl: 'https://placehold.co/100x100/AED6F1/4A4A4A?text=AT' },
];

function createDefaultGradePlaceholders(count = 5): GradePlaceholder[] {
  const base = Date.now();
  return Array.from({ length: count }).map((_, i) => ({ id: base + i + Math.floor(Math.random() * 1000) }));
}

const initialCourseTopics: CourseTopic[] = [
  { id: 1, title: 'Actividades Generales', grades: createDefaultGradePlaceholders(5) },
];

// --- CONSTANTES ---
const TABS: ActiveTab[] = ['create', 'grades', 'reports'];
const TAB_INDICES: Record<ActiveTab, number> = { create: 0, grades: 1, reports: 2 };

const folderColors = {
  blue: 'text-blue-500/80 fill-blue-500/20',
  indigo: 'text-indigo-500/80 fill-indigo-500/20',
  teal: 'text-teal-500/80 fill-teal-500/20',
  purple: 'text-purple-500/80 fill-purple-500/20',
  pink: 'text-pink-500/80 fill-pink-500/20',
};

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

  const topicsContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [lastAddedTopicId, setLastAddedTopicId] = useState<number | null>(null);

  const [mainState, setMainState] = useState<MainPanelState>('welcome');
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);

  const handleTabClick = (newTab: ActiveTab) => {
    if (newTab !== activeTab) {
      setPrevTab(activeTab);
      setActiveTab(newTab);
    }
  };

  const handleSelectCourse = (courseTitle: string) => {
    setSelectedCourse(courseTitle);
    setMainState('courseWelcome');
    setSelectedStudentId(null);
    const loadedTopics = JSON.parse(JSON.stringify(initialCourseTopics));
    setCourseTopics(loadedTopics);
    setStudentGrades({});
  };

  const handleGoBackToWelcome = () => {
    setMainState('welcome');
    setSelectedCourse(null);
    setSelectedStudentId(null);
    setCourseTopics([]);
    setStudentGrades({});
  };

  const handleSelectStudent = (id: string) => {
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
        const { [topicId]: _, ...rest } = prev;
        return rest;
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

  return (
    <main
      className="
        relative flex h-screen w-screen items-stretch justify-stretch p-0
        text-gray-900 selection:bg-indigo-300/40 selection:text-gray-900
        bg-[radial-gradient(1200px_800px_at_80%_-10%,rgba(99,102,241,0.22),transparent_60%),radial-gradient(900px_600px_at_0%_110%,rgba(236,72,153,0.18),transparent_60%),conic-gradient(from_210deg_at_50%_0%,#EEF2FF_0%,#FAF5FF_40%,#F9FAFB_85%)]
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
        .animate-slide-in-left { animation: slide-in-left 0.6s cubic-bezier(0.32,0.72,0,1) forwards; }
        @media (min-width: 768px) and (max-width: 1024px) {
          .animate-slide-in-left { animation-name: slide-in-left-md; }
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
          relative flex h-full w-full overflow-hidden
          rounded-none border-none bg-white/40 backdrop-blur-2xl
          ring-0 shadow-none
          bg-[linear-gradient(145deg,rgba(99,102,241,0.08),rgba(236,72,153,0.07))]
        "
      >
        {/* Sidebar */}
        {selectedCourse !== null && (
          <StudentSidebar
            className="animate-slide-in-left"
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
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {/* Topbar CON TABS estilo glass flotantes */}
          <div
            className="
              sticky top-0 z-10 flex items-end justify-start gap-4
              border-b border-white/60 bg-gradient-to-b from-white/70 to-white/40 px-6 pt-3 backdrop-blur-xl
            "
          >
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

            {mainState === 'welcome' && (
              <WelcomePanel onSelectCourse={handleSelectCourse} />
            )}

            {mainState === 'courseWelcome' && (
              <CourseWelcomeMessage courseName={selectedCourse || 'Curso'} />
            )}

            {(mainState === 'creating' || mainState === 'viewing') && (
              <form
                onSubmit={handleSaveStudent}
                className="[grid-area:stack] w-full h-full grid grid-cols-1 [grid-template-areas:'stack'] overflow-hidden"
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
                    {/* CONTENEDOR GLASS del panel de Notas */}
                    <div
                      className="
                        relative rounded-[22px]
                        border border-white/80 bg-white/35 backdrop-blur-[22px]
                        shadow-[0_30px_80px_-35px_rgba(2,6,23,0.45),inset_0_1px_0_rgba(255,255,255,0.7)]
                        ring-1 ring-black/5
                        p-5 md:p-7
                      "
                    >
                      {/* Halo suave */}
                      <div className="pointer-events-none absolute -top-16 -left-16 h-44 w-44 rounded-full bg-gradient-to-br from-indigo-500/12 to-fuchsia-500/12 blur-3xl" />
                      <div className="pointer-events-none absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-tl from-indigo-400/15 to-fuchsia-400/15 blur-3xl" />

                      {/* Encabezado */}
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-[20px] md:text-[22px] font-semibold text-gray-900 tracking-[-0.015em]">
                          Registrar Notas para:{' '}
                          <span className="bg-gradient-to-r from-indigo-600 to-fuchsia-600 bg-clip-text text-transparent">
                            {selectedStudent?.name ?? 'N/A'}
                          </span>
                        </h2>

                        {/* Botón Añadir Tema (glass) */}
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

                      {/* Temas */}
                      <div className="space-y-6" ref={topicsContainerRef}>
                        {courseTopics.length === 0 && (
                          <CardSection>
                            <p className="text-sm text-gray-700 text-center py-4">
                              No hay temas definidos para este curso. Haz clic en "Añadir Tema" para empezar.
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

function WelcomePanel({ onSelectCourse }: { onSelectCourse: (title: string) => void; }) {
  return (
    <div className="flex w-full h-full flex-col items-center justify-start pt-6 pb-10 px-12 text-center [grid-area:stack] overflow-y-auto">
      <div className="group relative overflow-hidden rounded-3xl border border-white/70 bg-white/55 px-10 py-12 shadow-xl backdrop-blur-xl">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-gradient-to-br from-indigo-500/25 to-fuchsia-500/25 blur-3xl" />
        <BookMarked size={64} className="mx-auto text-indigo-500/90" />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-gray-900">Bienvenido al Gestor Académico</h1>
        <p className="mt-2 max-w-sm text-base text-gray-700">Selecciona un curso para empezar a gestionar estudiantes y registrar calificaciones.</p>
      </div>
      <h2 className="text-xl font-semibold mt-10 mb-8 text-gray-800">Cursos Disponibles</h2>
      <div className="flex flex-wrap items-center justify-center gap-6 w-full">
        <CourseFolder title="Restauración" color="blue" onSelect={() => onSelectCourse('Restauración')} />
        <CourseFolder title="Fundamentos 1" color="indigo" onSelect={() => onSelectCourse('Fundamentos 1')} />
        <CourseFolder title="Fundamentos 2" color="teal" onSelect={() => onSelectCourse('Fundamentos 2')} />
        <CourseFolder title="Restauración 2" color="purple" onSelect={() => onSelectCourse('Restauración 2')} />
        <CourseFolder title="Escuela de Siervos" color="pink" onSelect={() => onSelectCourse('Escuela de Siervos')} />
      </div>
    </div>
  );
}

function CourseWelcomeMessage({ courseName }: { courseName: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-10 text-center [grid-area:stack] overflow-y-auto h-full">
      <div className="group relative overflow-hidden rounded-3xl border border-white/70 bg-white/55 px-10 py-12 shadow-xl backdrop-blur-xl">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-gradient-to-br from-indigo-500/25 to-fuchsia-500/25 blur-3xl" />
        <Folder size={64} className="mx-auto text-indigo-500/90" />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-gray-900">
          Bienvenido al panel de <br />
          <span className="bg-gradient-to-r from-indigo-600 to-fuchsia-600 bg-clip-text text-transparent">{courseName}</span>
        </h1>
        <p className="mt-4 max-w-sm text-base text-gray-700">Selecciona un estudiante de la lista para ver sus notas o crea un nuevo registro para este curso.</p>
      </div>
    </div>
  );
}

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
  return (
    <aside
      className={`w-1/3 lg:w-1/4 h-full flex-shrink-0 flex flex-col border-r border-white/60 bg-gradient-to-b from-white/65 to-white/40 backdrop-blur-2xl ${className}`}
      aria-label="Barra lateral de estudiantes"
    >
      <div className="flex-shrink-0 p-3 border-b border-white/60 flex items-center bg-white/40 backdrop-blur">
        <button
          type="button"
          onClick={onGoBackToWelcome}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-indigo-600 transition-colors duration-150 rounded-lg p-2 hover:bg-white/60 w-full"
        >
          <ArrowLeft size={18} />
          <span>Volver a Cursos</span>
        </button>
      </div>
      {courseName && (
        <div className="px-4 py-3 border-b border-white/60">
          <p className="text-xs text-gray-600">Módulo:</p>
          <p className="mt-1 text-sm font-semibold bg-gradient-to-r from-indigo-600 to-fuchsia-600 bg-clip-text text-transparent truncate">
            {courseName}
          </p>
        </div>
      )}
      <div className="flex-shrink-0 p-4 border-b border-white/60">
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar estudiante…"
            className="w-full rounded-xl border border-white/70 bg-white/70 py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-600 shadow-inner backdrop-blur-sm focus:outline-none focus:ring-4 focus:ring-indigo-400/25 focus:border-white transition"
            aria-label="Buscar estudiante"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-2">
        {students.map((student) => {
          const active = selectedStudentId === student.id;
          return (
            <a
              key={student.id}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onSelectStudent(student.id);
              }}
              className={`group flex items-center gap-3 rounded-2xl p-3 transition-all border ${active ? 'border-indigo-200/80 bg-gradient-to-r from-indigo-50/80 to-fuchsia-50/70 text-indigo-900 shadow-sm' : 'border-white/70 bg-white/60 text-gray-700 hover:bg-white/80'}`}
            >
              <img
                src={student.avatarUrl}
                alt={student.name}
                className="h-10 w-10 rounded-full border-2 border-white/80 ring-1 ring-black/5 object-cover shadow-sm"
                onError={(e) => {
                  const t = e.target as HTMLImageElement;
                  t.src = `https://placehold.co/100x100/CCC/666?text=${student.name.split(' ').map(n => n[0]).join('')}`;
                }}
              />
              <div className="flex-1">
                <span className="block text-sm font-medium leading-tight">{student.name}</span>
                <span className="block text-xs text-gray-600">ID #{student.id}</span>
              </div>
              <span className="opacity-0 group-hover:opacity-100 text-[10px] rounded-md px-2 py-0.5 border border-white/70 bg-white/70 text-gray-600">
                Ver
              </span>
            </a>
          );
        })}
      </nav>
      <div className="flex-shrink-0 p-4 border-t border-white/60">
        <button
          onClick={onCreateNew}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-medium backdrop-blur-sm transition-all ${mainState === 'creating' ? 'border-transparent bg-gradient-to-r from-indigo-500 to-fuchsia-600 text-white shadow-lg hover:shadow-[0_15px_35px_-15px_rgba(99,102,241,0.65)]' : 'border-white/70 bg-white/60 text-indigo-700 hover:bg-white/80'}`}
        >
          <Plus size={18} />
          <span>Nuevo Estudiante</span>
        </button>
      </div>
    </aside>
  );
}

/** TAB estilo ‘segmented’ glass */
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
          ? 'bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_8px_24px_-10px_rgba(76,29,149,0.45)]'
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
  /** When true the section will enter edit mode and focus the title input */
  autoFocus,
  /** Called once the component has auto-focused so the parent can clear any transient flag */
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
  // If parent requests autoFocus, switch to editing mode
  useEffect(() => {
    if (autoFocus) {
      setIsEditing(true);
    }
  }, [autoFocus]);

  // When editing becomes active, focus/select the input and notify parent (if provided)
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
      if (onAutoFocus) {
        // ensure DOM/layout has applied; use rAF for a safe microtask
        requestAnimationFrame(() => onAutoFocus());
      }
    }
  }, [isEditing, onAutoFocus]);
  useEffect(() => { if (!isEditing) { setCurrentTitle(title || ''); } }, [title, isEditing]);
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => { setCurrentTitle(e.target.value); };
  const saveTitle = () => { setIsEditing(false); if (onTitleChange && currentTitle !== title) { onTitleChange(currentTitle); } };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { saveTitle(); } else if (e.key === 'Escape') { setCurrentTitle(title || ''); setIsEditing(false); } };
  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/70 bg-white/55 p-5 md:p-6 shadow-[0_10px_30px_-15px_rgba(2,6,23,0.2),inset_0_1px_0_0_#fff] backdrop-blur-xl">
      <div className="pointer-events-none absolute -top-16 -left-16 h-40 w-40 rounded-full bg-gradient-to-br from-indigo-500/15 to-fuchsia-500/15 blur-2xl" />
      {(title || actions) && (
        <div className="flex justify-between items-center mb-4">
          {title && isEditable ? (
            isEditing ? (
              <input
                ref={inputRef}
                type="text"
                value={currentTitle}
                onChange={handleTitleChange}
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

function FormInput({
  label,
  id,
  type,
  icon,
}: {
  label: string;
  id: string;
  type: string;
  icon: React.ReactNode;
}) {
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
                bg-[linear-gradient(145deg,rgba(99,102,241,0.06),rgba(236,72,153,0.05))]
              `;
              return (
                <div key={placeholder.id} className={boxClasses}>
                  <div className="pointer-events-none absolute inset-0 rounded-[18px] opacity-70 bg-[radial-gradient(140px_90px_at_8%_-8%,rgba(99,102,241,0.18),transparent),radial-gradient(140px_90px_at_110%_120%,rgba(236,72,153,0.12),transparent)]" />
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
            {Array.from({ length: Math.max(0, 5 - row.length) }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
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
        className="inline-flex items-center justify-center gap-2 rounded-full h-12 px-8 bg-gradient-to-r from-indigo-500 to-fuchsia-600 text-sm font-semibold text-white shadow-[0_12px_30px_-12px_rgba(99,102,241,0.6)] transition-all hover:shadow-[0_18px_40px_-14px_rgba(99,102,241,0.7)] focus:outline-none focus:ring-4 focus:ring-indigo-400/25 active:scale-[0.99]"
      >
        Guardar
      </button>
    </div>
  );
}

function CourseFolder({
  title,
  color = 'blue',
  onSelect,
}: {
  title: string;
  color?: keyof typeof folderColors;
  onSelect: () => void;
}) {
  const colorClasses = folderColors[color] || folderColors.blue;
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex flex-col items-center justify-start w-44 h-44 rounded-3xl p-4 transition-all duration-200 hover:scale-[1.05] active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-indigo-400/25 group text-center"
    >
      <Folder
        size={100}
        className={`mb-3 ${colorClasses} transition-all duration-200 drop-shadow-md group-hover:drop-shadow-lg`}
        strokeWidth={1}
      />
      <h4 className="text-sm font-semibold text-gray-800 w-full transition-colors group-hover:text-indigo-600">{title}</h4>
    </button>
  );
}
