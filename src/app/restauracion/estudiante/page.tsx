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
  // --- REQ 1: Icono añadido para la nueva pestaña ---
  FileText,
  // --- INICIO MODIFICACIÓN APPLE SENIOR DEV ---
  SquarePen, // Icono de edición estilo macOS
  Check, // Icono de guardado
  Trash2, // Icono de papelera
  Landmark, // Icono para congregación
  BookOpen, // Icono para datos espirituales
  HeartPulse, // Icono para salud
  ClipboardList, // Icono para evaluación
  NotebookPen, // Icono para notas
  UserCheck, // Icono para asistencias
  // --- FIN MODIFICACIÓN APPLE SENIOR DEV ---
} from 'lucide-react';
// --- REQ 3: Añadidas importaciones de Supabase y removeBackground ---
import { supabase } from '../../../lib/supabaseClient';
import { removeBackground } from "@imgly/background-removal";

// --- INICIO MODIFICACIÓN: Tipo 'Entrevista' y Helpers copiados de 'consultar/page.tsx' ---

// ---------------------- Tipos ----------------------
export type Entrevista = {
  id: string;
  created_at?: string | null;
  updated_at?: string | null;

  // Identificación
  nombre?: string | null;
  cedula?: string | null;
  email?: string | null;
  telefono?: string | null;
  foto_path?: string | null;

  // Datos personales
  fecha_nac?: string | null;
  lugar_nac?: string | null;
  direccion?: string | null;
  estado_civil?: "soltero" | "casado" | "union" | "viudo" | null;
  ocupacion?: string | null;
  escolaridad?: string | null;

  // Iglesia
  se_congrega?: "si" | "no" | null;
  dia_congrega?:
    | "Domingo"
    | "Lunes"
    | "Martes"
    | "Miércoles"
    | "Jueves"
    | "Viernes"
    | "Sábado"
    | null;
  tiempo_iglesia?: string | null;
  invito?: string | null;
  pastor?: string | null;

  // Vida espiritual
  nacimiento_espiritu?: "si" | "no" | "no_sabe" | null;
  bautizo_agua?: "si" | "no" | null;
  bautismo_espiritu?: "si" | "no" | null;
  tiene_biblia?: boolean | null;
  ayuna?: "si" | "no" | null;

  // Evaluación / observaciones
  aspecto_feliz?: boolean | null;
  muy_interesado?: boolean | null;
  interviene?: boolean | null;
  cambios_fisicos?: string | null;
  notas?: string | null;
  promovido?: "si" | "no" | null;

  // --- REQ 3: Añadidos los 17 campos nuevos ---
  labora_actualmente?: "si" | "no" | null;
  viene_otra_iglesia?: "si" | "no" | null;
  otra_iglesia_nombre?: string | null;
  tiempo_oracion?: string | null;
  frecuencia_lectura_biblia?: string | null;
  motivo_ayuno?: string | null;
  meta_personal?: string | null;
  enfermedad?: string | null;
  tratamiento_clinico?: "si" | "no" | null;
  motivo_tratamiento?: string | null;
  retiros_asistidos?: string | null;
  convivencia?: "solo" | "pareja" | "hijos" | "padres" | "otro" | null;
  recibe_consejeria?: "si" | "no" | null;
  motivo_consejeria?: string | null;
  cambios_emocionales?: string | null;
  desempeno_clase?: string | null;
  maestro_encargado?: string | null;
  
  // Campo efímero para preview local inmediato (no se guarda en BD)
  _tempPreview?: string | null;

  [k: string]: any;
};

// ---------------------- Utils ----------------------
function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function formatDateTime(s?: string | null) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

function extFromMime(mime?: string) {
  if (!mime) return ".jpg";
  if (mime.includes("png")) return ".png";
  if (mime.includes("webp")) return ".webp";
  if (mime.includes("jpeg")) return ".jpg";
  if (mime.includes("jpg")) return ".jpg";
  return ".jpg";
}

function bustUrl(u?: string | null) {
  if (!u) return u ?? null;
  const sep = u.includes("?") ? "&" : "?";
  return `${u}${sep}v=${Date.now()}`;
}

/** Placeholder inline (evita 404 a /avatar-placeholder.svg) */
const PLACEHOLDER_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#a855f7"/>
      </linearGradient></defs>
      <rect width="64" height="64" rx="999" fill="url(#g)"/>
      <circle cx="32" cy="24" r="12" fill="rgba(255,255,255,.85)"/>
      <path d="M8,60a24,24 0 0 1 48,0" fill="rgba(255,255,255,.85)"/>
    </svg>`
  );

// ---------------------- Campo editable (CE refs) ----------------------
type CEProps = {
  value?: string | null;
  edit: boolean;
  placeholder?: string;
  onInput?: (e: React.FormEvent<HTMLSpanElement>) => void;
  className?: string;
};
function CEField({
  value = "",
  edit,
  placeholder = "",
  onInput,
  className,
}: CEProps) {
  const ref = useRef<HTMLSpanElement>(null);

  // Carga externa sin romper el caret durante la edición
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const current = el.innerText ?? "";
    const next = value ?? "";
    if (current !== next && !document.activeElement?.isSameNode(el)) {
      el.innerText = next;
    }
  }, [value, edit]);

  // Sanitiza pegado
  function onPaste(e: React.ClipboardEvent<HTMLSpanElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  }

  return (
    <span
      ref={ref}
      contentEditable={edit}
      suppressContentEditableWarning
      onInput={onInput}
      onPaste={onPaste}
      spellCheck={false}
      className={classNames(
        "inline min-w-[2ch]",
        edit
          ? "px-1 rounded-md ring-1 ring-indigo-200 bg-white/70 supports-[backdrop-filter]:bg-white/40 focus:outline-none"
          : "",
        className
      )}
      data-placeholder={placeholder}
    />
  );
}

// ---------------------- Fila editable util ----------------------
function EditableRow({
  label,
  value,
  edit,
  onInput,
}: {
  label: string;
  value?: string | null;
  edit: boolean;
  onInput: (e: React.FormEvent<HTMLSpanElement>) => void;
}) {
  return (
    <div className="grid grid-cols-[160px_1fr] items-start gap-3 py-1.5">
      <div className="text-sm text-zinc-500">{label}</div>
      <div className="text-sm text-zinc-800">
        {edit ? (
          <CEField value={value ?? ""} edit={edit} onInput={onInput} />
        ) : (
          <span className="text-zinc-800">
            {value && value.trim() ? value : "—"}
          </span>
        )}
      </div>
    </div>
  );
}

// --------- COMPRESIÓN CLIENTE ----------
function downscaleImage(file: File, maxSide = 720, quality = 0.82): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const { width, height } = img;
      let w = width;
      let h = height;
      if (w > h && w > maxSide) {
        h = Math.round((h * maxSide) / w);
        w = maxSide;
      } else if (h >= w && h > maxSide) {
        w = Math.round((w * maxSide) / h);
        h = maxSide;
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (!blob) return resolve(file);
          const f = new File([blob], file.name.replace(/\.\w+$/, ".webp"), {
            type: "image/webp",
            lastModified: Date.now(),
          });
          resolve(f);
        },
        "image/webp",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

// --------- QUITAR FONDO Y PEGAR EN BLANCO (cliente, sin cambiar UI) ----------
async function toWhiteBackground(file: File): Promise<File> {
  // 1) Recorte con transparencia (PNG) — todo en el cliente
  const cutBlob = await removeBackground(file, { output: { format: "image/png" } });
  // 2) Pegar sobre fondo blanco (JPEG)
  const img = await createImageBitmap(cutBlob as Blob);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  const whiteBlob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b as Blob), "image/jpeg", 0.95)
  );
  const base = file.name.replace(/\.[^/.]+$/, "");
  return new File([whiteBlob], `${base}_white.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}
// --- FIN MODIFICACIÓN: Componentes y utils copiados ---


// --- TIPOS DE DATOS (del archivo 11) ---
type GradePlaceholder = { id: number };
type CourseTopic = { id: number; title: string; grades: GradePlaceholder[] };
type StudentGrades = Record<number, Record<number, string>>;
type ActiveTab = 'create' | 'grades' | 'reports' | 'hojaDeVida';
type MainPanelState = 'welcome' | 'courseWelcome' | 'creating' | 'viewing';

type Course = {
  title: string;
  color: keyof typeof folderColors;
  hasSpecialBadge?: boolean; 
  onSelect: () => void;
};

// --- MOCK DATA ---
const mockStudents: Entrevista[] = [
  // Vaciado según la solicitud
];

function createDefaultGradePlaceholders(count = 5): GradePlaceholder[] {
  const base = Date.now();
  return Array.from({ length: count }).map((_, i) => ({ id: base + i + Math.floor(Math.random() * 1000) }));
}

const initialCourseTopics: CourseTopic[] = [
  { id: 1, title: 'Asistencia', grades: createDefaultGradePlaceholders(12) },
];

// --- CONSTANTES ---
// --- REQ 1: 'TAB_INDICES' actualizado ---
const TAB_INDICES: Record<ActiveTab, number> = { create: 0, hojaDeVida: 1, grades: 2, reports: 3 };

// --- REQ 3: Constantes para selects (copiadas de file 10) ---
const DIAS: ("Domingo" | "Lunes" | "Martes" | "Miércoles" | "Jueves" | "Viernes" | "Sábado")[] = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const ESTADOS: ("soltero" | "casado" | "union" | "viudo")[] = ["soltero","casado","union","viudo"];
const TIEMPO_ORACION = ["Menos de 15 min", "15-30 min", "30-60 min", "Más de 1 hora", "No oro"];
const LECTURA_BIBLIA = ["Diariamente", "Varias veces por semana", "Semanalmente", "Ocasionalmente", "Casi nunca"];
const CONVIVENCIA = ["solo", "pareja", "hijos", "padres", "otro"];
// --- FIN REQ 3 ---

const STATE_LEVELS: Record<MainPanelState, number> = { 'welcome': 0, 'courseWelcome': 1, 'creating': 2, 'viewing': 2 };

const folderColors = {
  blue: 'text-blue-500/80 fill-blue-500/20',
  indigo: 'text-indigo-500/80 fill-indigo-500/20',
  teal: 'text-teal-500/80 fill-teal-500/20',
  purple: 'text-purple-500/80 fill-purple-500/20',
  pink: 'text-pink-500/80 fill-pink-500/20',
};

const fixedContentBg = 'bg-[radial-gradient(1300px_900px_at_95%_5%,rgba(59,130,246,0.35),transparent_70%)]';

// Helper para generar Avatares (ya existía)
function generateAvatar(name: string): string {
  const initials = (name || 'NN').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  return `https://placehold.co/100x100/AED6F1/4A4A4A?text=${initials}`;
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size));
  return chunks;
}


/** Página — Fullscreen + Mac 2025 */
export default function EstudiantePage() {
  // --- REQ 1: Pestaña por defecto actualizada ---
  const [activeTab, setActiveTab] = useState<ActiveTab>('hojaDeVida');
  const [prevTab, setPrevTab] = useState<ActiveTab>('hojaDeVida');

  const [students, setStudents] = useState<Entrevista[]>([]); // Estado para estudiantes dinámicos
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

  async function getSignedUrlCached(path?: string | null) {
    if (!path) return null;
    if (fotoUrls[path]) return fotoUrls[path];
    
    // --- REQ 2: Lógica de cache optimizada ---
    // Previene múltiples peticiones si ya hay una en curso para esta URL
    if ((fotoUrls as any)[path] === 'loading') {
      // Si ya está cargando, espera un poco y reintenta
      await new Promise(r => setTimeout(r, 300));
      return getSignedUrlCached(path); // Re-llama, podría estar en cache ahora
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
      setFotoUrls((m) => ({ ...m, [path]: '' })); // Cachear como '' para no reintentar
      return null;
    }
  }

  // Actualizaciones desde modal
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

  // Wrapper para el 'onDelete' de la Hoja de Vida
  function handleHojaDeVidaDelete(id: string) {
    setStudents((xs) => xs.filter((x) => x.id !== id));
    setPrevMainState(mainState); 
    setMainState('courseWelcome');
    setSelectedStudentId(null);
  }


  // --- INICIO OPTIMIZACIÓN: Función `loadStudents` refactorizada para carga por lotes ---
  const loadStudents = async (courseTitle: string) => {
    setLoadingStudents(true);
    setStudents([]);
    setSelectedStudentId(null);
    setFotoUrls({}); // Limpiar caché de URLs al cambiar de curso
  
    try {
      let loadedStudents: Entrevista[] = []; // Variable temporal

      if (courseTitle === 'Restauración 1') {
        console.log("Cargando estudiantes de: public.entrevistas");
        
        const { data, error } = await supabase
          .from('entrevistas')
          .select('*') // Cargar todos los datos
          .order('nombre', { ascending: true });
  
        if (error) {
          console.error("Error cargando entrevistas:", error);
          throw error;
        }
  
        loadedStudents = (data as Entrevista[]) || [];
        // Establecer estudiantes inmediatamente para que la UI se renderice
        setStudents(loadedStudents); 
  
      } else {
        console.log(`Curso "${courseTitle}" seleccionado. No hay carga de datos implementada.`);
        setStudents([]);
      }

      // --- OPTIMIZACIÓN: Carga por lotes de URLs firmadas ---
      if (loadedStudents.length > 0) {
        // 1. Obtener todos los paths de fotos únicos y válidos
        const fotoPaths = [
          ...new Set(loadedStudents.map((s) => s.foto_path).filter(Boolean) as string[]),
        ];

        if (fotoPaths.length > 0) {
          // 2. Llamar a Supabase UNA SOLA VEZ para firmar todos los paths
          const { data: signedUrlsData, error: signError } = await supabase.storage
            .from("entrevistas-fotos")
            .createSignedUrls(fotoPaths, 60 * 10); // 10 minutos de expiración

          if (signError) {
            console.error("Error firmando URLs por lotes:", signError);
            // Continuar de todos modos, los avatares usarán el fallback
          }

          if (signedUrlsData) {
            // 3. Crear un mapa de path -> signedUrl
            const urlMap = signedUrlsData.reduce(
              (acc, item) => {
                if (item.error) {
                  console.warn(`Error al firmar path individual: ${item.path}`, item.error);
                } else if (item.signedUrl && item.path) {
                  // El 'item.path' devuelto por Supabase es la clave que necesitamos
                  const signedUrl = item.signedUrl ? bustUrl(item.signedUrl) : null;
                  if (signedUrl) acc[item.path] = signedUrl;
                }
                return acc;
              },
              {} as Record<string, string>
            );

            // 4. Actualizar el estado de fotoUrls UNA SOLA VEZ
            setFotoUrls(urlMap);
          }
        }
      }
      // --- FIN DE OPTIMIZACIÓN DE CARGA POR LOTES ---

    } catch (error) {
      console.error("Error en loadStudents:", error);
    } finally {
      setLoadingStudents(false); // Mover esto al final
    }
  };
  // --- FIN OPTIMIZACIÓN ---


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

  // --- INICIO REQ 1: 'handleSelectStudent' actualizado ---
  const handleSelectStudent = async (id: string) => {
    setPrevMainState(mainState); 
    setSelectedStudentId(id);
    setMainState('viewing');
    setActiveTab('hojaDeVida'); // <-- Pestaña por defecto
    setPrevTab('hojaDeVida');  // <-- Pestaña por defecto
    
    const student = students.find(s => s.id === id);
    if (!student) return;

    // Cargar Signed URL para la Hoja de Vida
    setSignedUrl(null);
    if (student.foto_path) {
      // --- INICIO OPTIMIZACIÓN ---
      // Esta llamada ahora será casi instantánea porque la URL
      // ya fue cargada en el 'loadStudents' y está en 'fotoUrls'.
      // 'getSignedUrlCached' la encontrará en el caché.
      // --- FIN OPTIMIZACIÓN ---
      const url = await getSignedUrlCached(student.foto_path);
      if (url) setSignedUrl(url);
    }

    // Cargar notas (lógica existente)
    const initialGradesForStudent: StudentGrades = {};
    courseTopics.forEach(topic => {
      initialGradesForStudent[topic.id] = {};
      topic.grades.forEach(gradePlaceholder => {
        initialGradesForStudent[topic.id][gradePlaceholder.id] = '';
      });
    });
    setStudentGrades(initialGradesForStudent);
  };
  // --- FIN REQ 1 ---

  const handleCreateNew = () => {
    setPrevMainState(mainState); 
    setSelectedStudentId(null);
    setMainState('creating');
    setActiveTab('create');
    setPrevTab('create');
    setStudentGrades({});
    setSignedUrl(null); // Limpiar URL
  };

  // ... (Funciones de manejo de notas sin cambios) ...
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
  // ... (Fin de funciones de manejo de notas) ...


  const getTabPanelClasses = (tabName: ActiveTab): string => {
    const base =
      'w-full h-full flex flex-col min-h-0 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] [grid-area:1/1]';
    // --- REQ 1: 'TAB_INDICES' actualizado ---
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

  return (
    <main
      className="
        relative flex h-screen w-full items-stretch justify-stretch p-0
        text-gray-900 selection:bg-indigo-300/40 selection:text-gray-900
        bg-[conic-gradient(from_210deg_at_50%_0%,#EEF2FF_0%,#FAF5FF_40%,#F9FAFB_85%)]
      "
    >
      {/* ... (estilos y grid sin cambios) ... */}
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

        /* --- INICIO REQ 1: Estilos de Chip actualizados (tipo imagen) --- */
        .chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.5rem 1.25rem; /* 8px 20px */
          border-radius: 9999px; /* pill shape */
          font-size: 0.95rem; /* 15px */
          font-weight: 700; /* bold */
          border: 1.5px solid transparent;
          transition: all 0.2s ease-out;
          cursor: pointer;
          user-select: none;
        }
        /* Estilo NO seleccionado (como 'No' en la imagen) */
        .chip[data-checked="false"] {
          color: #374151; /* gray-700 */
          background-color: #ffffff;
          border-color: #E5E7EB; /* gray-200 */
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.03), 0 2px 4px -2px rgba(0, 0, 0, 0.03);
        }
        .chip[data-checked="false"]:hover {
          background-color: #F9FAFB; /* gray-50 */
          border-color: #D1D5DB; /* gray-300 */
        }
        /* Estilo SELECCIONADO (como 'Sí' en la imagen) */
        .chip[data-checked="true"] {
          color: #ffffff;
          background-image: linear-gradient(to right, #3B82F6, #60A5FA); /* blue-500 to blue-400 */
          border-color: transparent;
          box-shadow: 0 8px 15px -3px rgba(59, 130, 246, 0.25), 0 3px 6px -3px rgba(59, 130, 246, 0.2);
        }
        .chip[data-checked="true"]:hover {
           filter: brightness(1.1);
        }
        .chip:focus-visible {
           outline: none;
           ring: 4px;
           ring-color: rgba(96, 165, 250, 0.4); /* blue-400 opacity 40% */
        }
        .chip[disabled] {
          opacity: 0.6;
          cursor: not-allowed;
          filter: grayscale(0.5);
        }
        /* --- FIN REQ 1 --- */

        /* --- INICIO REQ 4: Estilos de Chip circular --- */
        .chip-circle {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 1.75rem; /* 28px */
          height: 1.75rem; /* 28px */
          border-radius: 9999px; /* circle */
          font-size: 0.8125rem; /* 13px */
          font-weight: 500;
          border: 1.5px solid transparent;
          transition: all 0.2s ease-out;
          cursor: pointer;
          user-select: none;
        }
        /* Estilo NO seleccionado */
        .chip-circle[data-checked="false"] {
          color: #374151; /* gray-700 */
          background-color: #ffffff;
          border-color: #E5E7EB; /* gray-200 */
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.03), 0 2px 4px -2px rgba(0, 0, 0, 0.03);
        }
        .chip-circle[data-checked="false"]:hover {
          background-color: #F9FAFB; /* gray-50 */
          border-color: #D1D5DB; /* gray-300 */
        }
        /* Estilo SELECCIONADO */
        .chip-circle[data-checked="true"] {
          color: #ffffff;
          background-image: linear-gradient(to right, #3B82F6, #60A5FA); /* blue-500 to blue-400 */
          border-color: transparent;
          box-shadow: 0 8px 15px -3px rgba(59, 130, 246, 0.25), 0 3px 6px -3px rgba(59, 130, 246, 0.2);
        }
        .chip-circle[data-checked="true"]:hover {
           filter: brightness(1.1);
        }
        .chip-circle:focus-visible {
           outline: none;
           ring: 4px;
           ring-color: rgba(96, 165, 250, 0.4); /* blue-400 opacity 40% */
        }
        .chip-circle[disabled] {
          opacity: 0.6;
          cursor: not-allowed;
          filter: grayscale(0.5);
        }
        /* --- FIN REQ 4 --- */

        /* --- INICIO MODIFICACIÓN: Estilos del switch de asistencia ELIMINADOS --- */
        /* Los estilos .attendance-switch han sido removidos */
        /* --- FIN MODIFICACIÓN --- */
      `}</style>
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
            students={students} 
            loading={loadingStudents}
            selectedStudentId={selectedStudentId}
            mainState={mainState}
            courseName={selectedCourse} 
            onSelectStudent={handleSelectStudent}
            onCreateNew={handleCreateNew}
            onGoBackToWelcome={handleGoBackToWelcome}
            // --- REQ 2: Pasar props al Sidebar ---
            fotoUrls={fotoUrls}
            // --- INICIO OPTIMIZACIÓN: `getSignedUrlCached` ya no es necesario aquí ---
            // getSignedUrlCached={getSignedUrlCached}
            // --- FIN OPTIMIZACIÓN ---
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
                    {/* --- INICIO REQ 1: Nueva pestaña "Hoja de Vida" --- */}
                    <TabButton
                      icon={<FileText className="h-4 w-4" />}
                      label="Hoja de Vida"
                      isActive={activeTab === 'hojaDeVida'}
                      onClick={() => handleTabClick('hojaDeVida')}
                    />
                    {/* --- FIN REQ 1 --- */}
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

                {/* --- INICIO REQ 3: Nuevo panel "Hoja de Vida" --- */}
                <div className={getTabPanelClasses('hojaDeVida')}>
                  {selectedStudent ? (
                    <HojaDeVidaPanel
                      key={selectedStudent.id} // Forzar re-renderizado
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
                {/* --- FIN REQ 3 --- */}


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
// --- INICIO OPTIMIZACIÓN: `getSignedUrlCached` eliminado de las props ---
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
  // --- REQ 2: Recibir props ---
  fotoUrls,
  // getSignedUrlCached, // <-- ELIMINADO
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
  // --- REQ 2: Tipos de props ---
  fotoUrls: Record<string, string>;
  // getSignedUrlCached: (path?: string | null) => Promise<string | null>; // <-- ELIMINADO
}) {
// --- FIN OPTIMIZACIÓN ---
  const isDetailView = mainState === 'creating' || mainState === 'viewing';

  // --- INICIO MODIFICACIÓN: Estilos Gradiente "Frescos y Suaves" ---
  const gradientClasses = [
    // Paleta 1: Azul/Púrpura Suave (como en la foto)
    'bg-gradient-to-br from-blue-100/95 to-purple-100/95 shadow-lg shadow-blue-200/50 hover:shadow-xl hover:shadow-blue-300/60',
    // Paleta 2: Turquesa/Verde Suave (como en la foto)
    'bg-gradient-to-br from-teal-100/95 to-emerald-100/95 shadow-lg shadow-teal-200/50 hover:shadow-xl hover:shadow-teal-300/60',
    // Paleta 3: Naranja/Durazno Suave (como en la foto)
    'bg-gradient-to-br from-orange-100/95 to-amber-100/95 shadow-lg shadow-orange-200/50 hover:shadow-xl hover:shadow-orange-300/60',
    // Paleta 4: Rosa/Rosado Suave
    'bg-gradient-to-br from-pink-100/95 to-rose-100/95 shadow-lg shadow-pink-200/50 hover:shadow-xl hover:shadow-pink-300/60',
    // Paleta 5: Cielo/Cian Suave (Tono "fresco")
    'bg-gradient-to-br from-sky-100/95 to-cyan-100/95 shadow-lg shadow-sky-200/50 hover:shadow-xl hover:shadow-sky-300/60',
  ];
  // --- FIN MODIFICACIÓN ---

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
        {loading ? (
          <div className="p-4 text-center text-gray-600">Cargando...</div>
        ) : students.length === 0 ? (
          <div className="p-4 text-center text-gray-600">No hay estudiantes en este curso.</div>
        ) : (
          students.map((student, index) => { // <-- 'index' añadido
            const active = selectedStudentId === student.id;
            
            // --- INICIO MODIFICACIÓN: Estilos Gradiente Cupertino 2025 ---
            const gradientStyle = gradientClasses[index % gradientClasses.length];
            // --- FIN MODIFICACIÓN ---
            
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
                    ? 'border-transparent text-indigo-950 bg-gradient-to-r from-white/90 to-white/70 shadow-[0_12px_28px_-18px_rgba(76,29,149,0.35)] ring-1 ring-indigo-500/30'
                    // --- INICIO MODIFICACIÓN: Aplicar gradiente suave y texto oscuro ---
                    : `${gradientStyle} border-transparent text-gray-900 hover:brightness-105`,
                  // --- FIN MODIFICACIÓN ---
                ].join(' ')}
              >
                {/* --- INICIO REQ 2: Usar 'StudentAvatar' --- */}
                {/* --- INICIO OPTIMIZACIÓN: `getSignedUrlCached` eliminado de la llamada --- */}
                <StudentAvatar
                  fotoPath={student.foto_path}
                  nombre={student.nombre}
                  fotoUrls={fotoUrls}
                  // getSignedUrlCached={getSignedUrlCached} // <-- ELIMINADO
                />
                {/* --- FIN OPTIMIZACIÓN --- */}
                {/* --- FIN REQ 2 --- */}
                
                <div className="flex-1">
                  <span className="block text-base md:text-[13.5px] font-semibold leading-tight tracking-[-0.01em]">
                    {student.nombre ?? 'Sin Nombre'}
                  </span>
                  {/* --- INICIO MODIFICACIÓN: Color de texto condicional (oscuro) --- */}
                  <span className={classNames(
                      "block text-sm md:text-[11.5px]",
                      active ? "text-gray-600/90" : "text-gray-700/80"
                    )}>
                  {/* --- FIN MODIFICACIÓN --- */}
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

// --- INICIO REQ 2: Nuevo componente 'StudentAvatar' ---
// --- INICIO OPTIMIZACIÓN: 'StudentAvatar' simplificado (sin estado ni useEffect) ---
function StudentAvatar({
  fotoPath,
  nombre,
  fotoUrls
}: {
  fotoPath?: string | null;
  nombre?: string | null;
  fotoUrls: Record<string, string>;
}) {
  // La URL se deriva directamente de las props.
  // Si fotoPath existe y está en fotoUrls, úsalo.
  // De lo contrario, genera el avatar de fallback.
  const url = (fotoPath ? fotoUrls[fotoPath] : null) ?? generateAvatar(nombre ?? 'NN');

  return (
    <img
      // Usamos `key` para forzar a React a recargar la imagen si la URL cambia
      // (aunque en este caso, el fallback es estable)
      key={url} 
      src={url} 
      alt={nombre ?? 'Estudiante'}
      className="h-12 w-12 md:h-10 md:w-10 rounded-full border-2 border-white/80 ring-1 ring-black/5 object-cover shadow-[0_4px_10px_-6px_rgba(2,6,23,.35)]"
      onError={(e) => {
        const t = e.currentTarget;
        const fallbackSrc = generateAvatar(nombre ?? 'NN');
        // Si la URL que falló no es ya el fallback,
        // establece el fallback.
        if (t.src !== fallbackSrc) {
          t.src = fallbackSrc;
        }
      }}
    />
  );
}
// --- FIN OPTIMIZACIÓN ---
// --- FIN REQ 2 ---

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
              
              // --- INICIO MODIFICACIÓN: Usar el nuevo PremiumAttendanceButton ---
              return (
                <PremiumAttendanceButton
                  key={placeholder.id}
                  noteNumber={noteNumber}
                  value={gradeValue}
                  onChange={(newValue) => onGradeChange(topicId, placeholder.id, newValue)}
                />
              );
              // --- FIN MODIFICACIÓN ---
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
  const appleEase = 'ease-[cubic-bezier(0.2,0.8,0.2,1)]';
  const duration = 'duration-300'; 

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        relative flex flex-col items-center justify-start w-36 h-36 md:w-44 md:h-44 
        rounded-3xl p-4 
        shadow-lg shadow-black/5
        transition-all ${duration} ${appleEase}
        hover:scale-[1.03] hover:-translate-y-1.5 
        hover:shadow-xl hover:shadow-indigo-500/20
        active:scale-[0.98] active:translate-y-0
        focus:outline-none focus:ring-4 focus:ring-indigo-400/25 group text-center 
        flex-shrink-0 
        ${className} 
      `}
      style={style} 
    >
      <Folder 
        className={`
          w-20 h-20 md:w-24 md:h-24 mb-2 md:mb-3 ${colorClasses} 
          transition-all ${duration} ${appleEase}
          drop-shadow-md 
          group-hover:drop-shadow-lg 
          group-hover:-translate-y-1
        `} 
        strokeWidth={1} 
      />
      
      <h4 
        className={`
          text-xs md:text-sm font-semibold text-gray-800 w-full 
          transition-colors ${duration} ease-out
          group-hover:text-indigo-600
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

// --- INICIO REQ 1: Componente Chip (para los botones Sí/No) ---
function Chip({ checked, onClick, children, disabled, variant = 'pill' }: { checked: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean; variant?: 'pill' | 'circle' }) {
  return (
    <button
      type="button"
      className={variant === 'circle' ? 'chip-circle' : 'chip'}
      data-checked={checked}
      onClick={onClick}
      aria-pressed={checked}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

// --- INICIO MODIFICACIÓN: Switch de Asistencia Premium "Cupertino 2025" ---
/**
 * Reemplaza el 'AttendanceSwitch' por un botón de estado premium.
 * Estados: '' (vacío) -> 'si' (presente) -> 'no' (ausente) -> '' (vacío)
 */
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
      onChange(''); // Volver a vacío
    } else {
      onChange('si');
    }
  };

  // Clases base para el botón
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

  // Clases y contenido dinámico según el estado
  let stateClasses, icon, labelColor;

  if (value === 'si') {
    // --- Estado "Presente" (Activo) ---
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
    // --- Estado "Ausente" (Inactivo/Gris) ---
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
    // --- Estado "Vacío" (Glass) ---
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
      {/* Gradiente radial sutil (del diseño original) */}
      <div className="pointer-events-none absolute inset-0 rounded-[18px] opacity-70 bg-[radial-gradient(140px_90px_at_8%_-8%,rgba(99,102,241,0.18),transparent),radial-gradient(140px_90px_at_110%_120%,rgba(200,200,200,0.08),transparent)]" />
      
      {/* Contenido */}
      <span className={`relative text-[11px] uppercase tracking-wide select-none ${labelColor}`}>
        Clase # {noteNumber}
      </span>
      <div className="relative h-5"> {/* Contenedor para el icono, mantiene la altura */}
        {icon}
      </div>
    </button>
  );
}
// --- FIN MODIFICACIÓN ---

// --- INICIO REQ 3: Nuevos componentes Editables ---
function EditableRowSelect({
  label,
  value,
  edit,
  onChange,
  options,
  placeholder = "Seleccione",
  disabled = false
}: {
  label: string;
  value?: string | null;
  edit: boolean;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-[160px_1fr] items-center gap-3 py-1.5">
      <div className={classNames("text-sm", disabled ? "text-zinc-400" : "text-zinc-500")}>{label}</div>
      <div className="text-sm text-zinc-800">
        {edit ? (
          <select
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="w-full rounded-md ring-1 ring-indigo-200 bg-white/70 supports-[backdrop-filter]:bg-white/40 focus:outline-none p-1 text-sm"
          >
            <option value="">{placeholder}</option>
            {options.map((op) => (
              <option key={op} value={op}>{op.charAt(0).toUpperCase() + op.slice(1)}</option>
            ))}
          </select>
        ) : (
          <span className="text-zinc-800">
            {value && value.trim() ? (value.charAt(0).toUpperCase() + value.slice(1)) : "—"}
          </span>
        )}
      </div>
    </div>
  );
}

function EditableRowBool({
  label,
  value,
  edit,
  onChange,
  disabled = false
}: {
  label: string;
  value?: boolean | "si" | "no" | null;
  edit: boolean;
  onChange: (value: "si" | "no" | null) => void;
  disabled?: boolean;
}) {
  const val = value === true ? "si" : value === false ? "no" : value;
  return (
    <div className="grid grid-cols-[160px_1fr] items-center gap-3 py-1.5">
      <div className={classNames("text-sm", disabled ? "text-zinc-400" : "text-zinc-500")}>{label}</div>
      <div className="text-sm text-zinc-800">
        {edit ? (
          <div className="flex gap-2">
            <Chip variant="circle" checked={val === "si"} onClick={() => onChange("si")} disabled={disabled}>Sí</Chip>
            <Chip variant="circle" checked={val === "no"} onClick={() => onChange("no")} disabled={disabled}>No</Chip>
          </div>
        ) : (
          <span className="text-zinc-800">
            {val === "si" ? "Sí" : val === "no" ? "No" : "—"}
          </span>
        )}
      </div>
    </div>
  );
}

function EditableRowBool_SNNS({
  label,
  value,
  edit,
  onChange,
  disabled = false
}: {
  label: string;
  value?: "si" | "no" | "no_sabe" | null;
  edit: boolean;
  onChange: (value: "si" | "no" | "no_sabe" | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-[160px_1fr] items-center gap-3 py-1.5">
      <div className={classNames("text-sm", disabled ? "text-zinc-400" : "text-zinc-500")}>{label}</div>
      <div className="text-sm text-zinc-800">
        {edit ? (
          <div className="flex gap-2 flex-wrap">
            <Chip variant="circle" checked={value === "si"} onClick={() => onChange("si")} disabled={disabled}>Sí</Chip>
            <Chip variant="circle" checked={value === "no"} onClick={() => onChange("no")} disabled={disabled}>No</Chip>
            <Chip variant="circle" checked={value === "no_sabe"} onClick={() => onChange("no_sabe")} disabled={disabled}>No Sabe</Chip>
          </div>
        ) : (
          <span className="text-zinc-800">
            {value === "si" ? "Sí" : value === "no" ? "No" : value === "no_sabe" ? "No Sabe" : "—"}
          </span>
        )}
      </div>
    </div>
  );
}

// --- FIN REQ 3 ---

// --- INICIO REQ 3: Componente 'HojaDeVidaPanel' (extraído de 'DetalleEntrevista') ---
function HojaDeVidaPanel({
  row,
  signedUrl,
  onUpdated,
  onDeleted,
  className,
}: {
  row: Entrevista;
  signedUrl: string | null;
  onUpdated: (r: Entrevista) => void;
  onDeleted: (id: string) => void;
  className?: string;
}) {
  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [form, setForm] = useState<Entrevista>(row);

  const [localSignedUrl, setLocalSignedUrl] = useState<string | null>(signedUrl);
  useEffect(() => setLocalSignedUrl(signedUrl), [signedUrl]);

  const inputFotoRef = useRef<HTMLInputElement>(null);
  const tempObjUrlRef = useRef<string | null>(null);

  useEffect(() => setForm(row), [row?.id]);

  function setF<K extends keyof Entrevista>(k: K, v: Entrevista[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const onCE =
    (k: keyof Entrevista) => (e: React.FormEvent<HTMLSpanElement>) => {
      const t = (e.currentTarget.innerText || "").trim();
      setF(k, t as any);
    };

  // --- REQ 3: Handler para boolean (Sí/No) ---
  const onBool =
    (k: keyof Entrevista) => (v: "si" | "no" | null) => {
      setF(k, v === "si" ? true : v === "no" ? false : null);
    };
    
  // --- REQ 3: Handler para boolean (Sí/No) con tipo string ---
  const onBoolString =
    (k: keyof Entrevista) => (v: "si" | "no" | null) => {
      setF(k, v);
    };

  // --- REQ 3: Handler para (Sí/No/No Sabe) ---
  const onBoolSNNS =
    (k: keyof Entrevista) => (v: "si" | "no" | "no_sabe" | null) => {
      setF(k, v);
    };

  async function handleUpdate() {
    if (!edit) {
      setEdit(true);
      return;
    }
    
    try {
      setSaving(true);
      // --- INICIO REQ 3: Payload actualizado con TODOS los campos ---
      const payload = {
        nombre: form.nombre ?? null,
        cedula: form.cedula ?? null,
        email: form.email ?? null,
        telefono: form.telefono ?? null,
        fecha_nac: form.fecha_nac ?? null,
        lugar_nac: form.lugar_nac ?? null,
        direccion: form.direccion ?? null,
        escolaridad: form.escolaridad ?? null,
        ocupacion: form.ocupacion ?? null,
        estado_civil: form.estado_civil ?? null,
        se_congrega: form.se_congrega ?? null,
        dia_congrega: form.se_congrega === 'si' ? form.dia_congrega : null,
        tiempo_iglesia: form.tiempo_iglesia ?? null,
        invito: form.invito ?? null,
        pastor: form.pastor ?? null,
        nacimiento_espiritu: form.nacimiento_espiritu ?? null,
        bautizo_agua: form.bautizo_agua ?? null,
        bautismo_espiritu: form.bautismo_espiritu ?? null,
        tiene_biblia: form.tiene_biblia ?? null,
        ayuna: form.ayuna ?? null,
        aspecto_feliz: form.aspecto_feliz ?? null,
        muy_interesado: form.muy_interesado ?? null,
        interviene: form.interviene ?? null,
        cambios_fisicos: form.cambios_fisicos ?? null,
        notas: form.notas ?? null,
        promovido: form.promovido ?? null,
        foto_path: form.foto_path ?? null,
        updated_at: new Date().toISOString(),

        // 17 Nuevos campos
        labora_actualmente: form.labora_actualmente ?? null,
        viene_otra_iglesia: form.viene_otra_iglesia ?? null,
        otra_iglesia_nombre: form.viene_otra_iglesia === 'si' ? form.otra_iglesia_nombre : null,
        tiempo_oracion: form.tiempo_oracion ?? null,
        frecuencia_lectura_biblia: form.frecuencia_lectura_biblia ?? null,
        motivo_ayuno: form.ayuna === 'si' ? form.motivo_ayuno : null,
        meta_personal: form.meta_personal ?? null,
        enfermedad: form.enfermedad ?? null,
        tratamiento_clinico: form.tratamiento_clinico ?? null,
        motivo_tratamiento: form.tratamiento_clinico === 'si' ? form.motivo_tratamiento : null,
        retiros_asistidos: form.retiros_asistidos ?? null,
        convivencia: form.convivencia ?? null,
        recibe_consejeria: form.recibe_consejeria ?? null,
        motivo_consejeria: form.recibe_consejeria === 'si' ? form.motivo_consejeria : null,
        cambios_emocionales: form.cambios_emocionales ?? null,
        desempeno_clase: form.desempeno_clase ?? null,
        maestro_encargado: form.maestro_encargado ?? null,
      };
      // --- FIN REQ 3 ---

      const { data, error } = await supabase
        .from("entrevistas")
        .update(payload)
        .eq("id", form.id)
        .select("*")
        .single();

      if (error) throw error;
      onUpdated(data as Entrevista); // Notifica al padre
      setEdit(false);
    } catch (e: any) {
      alert(e?.message ?? "Error actualizando");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("¿Eliminar definitivamente esta entrevista?")) return;
    try {
      setSaving(true);
      if (form.foto_path) {
        await supabase.storage
          .from("entrevistas-fotos")
          .remove([form.foto_path]);
      }
      const { error } = await supabase
        .from("entrevistas")
        .delete()
        .eq("id", form.id);
      if (error) throw error;
      onDeleted(form.id); // Notifica al padre para que navegue
    } catch (e: any) {
      alert(e?.message ?? "Error eliminando");
    } finally {
      setSaving(false);
    }
  }
  
  async function handleChangeFoto(file: File) {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 12 * 1024 * 1024) return;

    setUploadingFoto(true);
    let whiteFile;
    try {
      whiteFile = await toWhiteBackground(file);
    } catch (e) {
      console.warn("Background removal falló, uso original:", e);
      whiteFile = file;
    }

    const compact = await downscaleImage(whiteFile, 720, 0.82);

    const tempUrl = URL.createObjectURL(compact);
    tempObjUrlRef.current = tempUrl;
    setLocalSignedUrl(tempUrl);
    onUpdated({ ...form, _tempPreview: tempUrl }); // Preview inmediato

    const oldPath = form.foto_path || undefined;
    const path = `fotos/${row.id}-${Date.now()}${extFromMime(compact.type)}`;

    try {
      const up = await supabase.storage
        .from("entrevistas-fotos")
        .upload(path, compact, { cacheControl: "0", upsert: true, contentType: compact.type || "image/webp" });
      if (up.error) throw up.error;

      const { data: updated, error: upErr } = await supabase
        .from("entrevistas")
        .update({ foto_path: path, updated_at: new Date().toISOString() })
        .eq("id", row.id)
        .select("*")
        .single();
      if (upErr) throw upErr;

      const signed = await supabase.storage
        .from("entrevistas-fotos")
        .createSignedUrl(path, 60 * 10);
      if (signed.error) throw signed.error;

      const signedBusted = bustUrl(signed.data?.signedUrl) ?? null;

      if (oldPath) {
        await supabase.storage.from("entrevistas-fotos").remove([oldPath]);
      }

      setF("foto_path", path);
      setLocalSignedUrl(signedBusted);
      onUpdated({ ...(updated as Entrevista), _tempPreview: null });
    } catch (e: any) {
      onUpdated({ ...row, _tempPreview: null }); // Revertir preview
      alert(e?.message ?? "No se pudo subir la foto");
    } finally {
      setUploadingFoto(false);
      if (tempObjUrlRef.current) {
        URL.revokeObjectURL(tempObjUrlRef.current);
        tempObjUrlRef.current = null;
      }
    }
  }

  // --- INICIO CORRECCIÓN DISEÑO APPLE ---
  // Se ajusta la jerarquía visual de los botones de acción.
  const btnUpdateClass = edit
    ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-[0_12px_30px_-12px_rgba(99,102,241,0.6)] hover:shadow-[0_18px_40px_-14px_rgba(99,102,241,0.7)] active:scale-[.98]" // Primario: Usa el acento principal
    : "bg-white/50 text-gray-800 border border-white/70 backdrop-blur-xl shadow-[0_6px_16px_-12px_rgba(2,6,23,.25)] hover:bg-white/75 active:scale-[.98]"; // Neutral: "Vidrio"
  // --- FIN CORRECCIÓN DISEÑO APPLE ---

  // El return AHORA es un panel scrolleable, no un modal.
  return (
    <div className={`flex-1 min-h-0 overflow-y-auto ${className || ''}`}>
      {/* Header (re-creado sin el onClose) */}
      <header className="px-6 pt-5 pb-3">
        <div className="flex items-start gap-6">
          <div className="relative">
            <img
              src={localSignedUrl ?? PLACEHOLDER_SVG}
              alt={form.nombre ?? "avatar"}
              width={80}
              height={80}
              className={classNames(
                "rounded-full object-cover ring-1 ring-white/70 shadow",
                uploadingFoto ? "opacity-60" : "opacity-100",
                "cursor-pointer"
              )}
              onClick={() => inputFotoRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  inputFotoRef.current?.click();
                }
              }}
              role="button"
              aria-label="Cambiar foto"
              title="Cambiar foto"
            />
            {uploadingFoto && (
              <div className="absolute inset-0 grid place-items-center rounded-full bg-black/30 text-white text-[10px]">
                Subiendo…
              </div>
            )}
            <input
              ref={inputFotoRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleChangeFoto(f);
                e.currentTarget.value = "";
              }}
            />
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-semibold text-zinc-800">
                {edit ? (
                  <CEField
                    value={form.nombre}
                    edit={edit}
                    onInput={onCE("nombre")}
                    placeholder="Nombre completo"
                    className="text-lg font-semibold"
                  />
                ) : (
                  form.nombre ?? "Consulta de entrevista"
                )}
              </h3>
              
              {/* --- INICIO MODIFICACIÓN APPLE SENIOR DEV --- */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="flex items-center justify-center h-9 w-9 rounded-full transition-all disabled:opacity-60 active:scale-[.98] bg-gradient-to-br from-red-400 to-rose-400 text-white shadow-md hover:shadow-lg hover:shadow-red-200/50"
                  title="Eliminar"
                >
                  <Trash2 size={16} />
                </button>
                
                {/* Botón Premium "Editar" / "Guardar" */}
                <button
                  onClick={handleUpdate}
                  disabled={saving}
                  className={classNames(
                    "flex items-center justify-center h-9 w-9 rounded-full transition-all disabled:opacity-60 active:scale-[.98]", // Botón circular
                    btnUpdateClass // Reutiliza la lógica de estilo
                  )}
                  title={edit ? "Guardar cambios" : "Editar"}
                >
                  {edit ? (
                    saving ? (
                      <span className="text-xs">...</span> // Simple spinner
                    ) : (
                      <Check size={18} /> // Icono Guardar
                    )
                  ) : (
                    <SquarePen size={16} /> // Icono Editar
                  )}
                </button>
              </div>
              {/* --- FIN MODIFICACIÓN APPLE SENIOR DEV --- */}

            </div>
            {/* Información adicional horizontal */}
            <div className="mt-2 flex items-center gap-4 text-sm text-zinc-700 flex-wrap">
              <span className="flex items-center gap-1">
                Cédula:{" "}
                {edit ? (
                  <CEField
                    value={form.cedula}
                    edit={edit}
                    onInput={onCE("cedula")}
                    placeholder="Cédula"
                  />
                ) : (
                  form.cedula || 'N/A'
                )}
              </span>
              {form.estado_civil && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200">
                  {form.estado_civil}
                </span>
              )}
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200">
                Promovido: {form.promovido || 'No'}
              </span>
            </div>
          </div>
        </div>
      </header>
      
      {/* Body (scrollable) */}
      <div className="px-6 py-6 overflow-y-auto flex-1 min-h-0">
  {/* --- INICIO REQ 2 y 3: Grid de 2 columnas con todos los campos --- */}
  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
        
          <section className="rounded-2xl ring-1 ring-black/5 bg-zinc-50 overflow-hidden">
            {/* --- INICIO MODIFICACIÓN APPLE SENIOR DEV --- */}
            <div className="flex items-center justify-between bg-gradient-to-r from-blue-100 to-indigo-100 p-3">
                <div className="flex items-center gap-2">
                    <User size={16} className="text-indigo-900/70" />
                    <h4 className="text-sm font-semibold text-indigo-900">Información personal</h4>
                </div>
                {edit && <Edit2 size={14} className="text-indigo-400/70" />}
            </div>
            {/* --- FIN MODIFICACIÓN APPLE SENIOR DEV --- */}
            <div className="p-4">
                <EditableRow label="Email" value={form.email} edit={edit} onInput={onCE("email")} />
                <EditableRow label="Teléfono" value={form.telefono} edit={edit} onInput={onCE("telefono")} />
                <EditableRow label="Fecha de nacimiento" value={form.fecha_nac ?? ""} edit={edit} onInput={onCE("fecha_nac")} />
                <EditableRow label="Lugar de nacimiento" value={form.lugar_nac} edit={edit} onInput={onCE("lugar_nac")} />
                <EditableRow label="Dirección" value={form.direccion} edit={edit} onInput={onCE("direccion")} />
                <EditableRow label="Escolaridad" value={form.escolaridad} edit={edit} onInput={onCE("escolaridad")} />
                <EditableRow label="Ocupación" value={form.ocupacion} edit={edit} onInput={onCE("ocupacion")} />
                <EditableRowSelect
                  label="Estado Civil"
                  value={form.estado_civil}
                  edit={edit}
                  onChange={(v) => setF("estado_civil", v as any)}
                  options={ESTADOS}
                />
                <EditableRowBool
                  label="Labora actualmente"
                  value={form.labora_actualmente}
                  edit={edit}
                  onChange={onBoolString("labora_actualmente")}
                />
            </div>
          </section>

          <section className="rounded-2xl ring-1 ring-black/5 bg-zinc-50 overflow-hidden">
            {/* --- INICIO MODIFICACIÓN APPLE SENIOR DEV --- */}
            <div className="flex items-center justify-between bg-gradient-to-r from-blue-100 to-indigo-100 p-3">
                <div className="flex items-center gap-2">
                    <Landmark size={16} className="text-indigo-900/70" />
                    <h4 className="text-sm font-semibold text-indigo-900">Informacion Congregacional</h4>
                </div>
                {edit && <Edit2 size={14} className="text-indigo-400/70" />}
            </div>
            {/* --- FIN MODIFICACIÓN APPLE SENIOR DEV --- */}
            <div className="p-4">
                <EditableRowBool
                  label="Se congrega"
                  value={form.se_congrega}
                  edit={edit}
                  onChange={onBoolString("se_congrega")}
                />
                <EditableRowSelect
                  label="Día congrega"
                  value={form.dia_congrega}
                  edit={edit}
                  onChange={(v) => setF("dia_congrega", v as any)}
                  options={DIAS}
                  disabled={form.se_congrega !== 'si'}
                />
                <EditableRow label="Tiempo en la iglesia" value={form.tiempo_iglesia} edit={edit} onInput={onCE("tiempo_iglesia")} />
                <EditableRow label="Invitó" value={form.invito} edit={edit} onInput={onCE("invito")} />
                <EditableRow label="Pastor" value={form.pastor} edit={edit} onInput={onCE("pastor")} />
                <EditableRowBool
                  label="Viene de otra iglesia"
                  value={form.viene_otra_iglesia}
                  edit={edit}
                  onChange={onBoolString("viene_otra_iglesia")}
                />
                <EditableRow
                  label="Nombre otra iglesia"
                  value={form.otra_iglesia_nombre}
                  edit={edit}
                  onInput={onCE("otra_iglesia_nombre")}
                />
                <EditableRowSelect
                  label="Convivencia"
                  value={form.convivencia}
                  edit={edit}
                  onChange={(v) => setF("convivencia", v as any)}
                  options={CONVIVENCIA}
                />
            </div>
          </section>

          <section className="rounded-2xl ring-1 ring-black/5 bg-zinc-50 overflow-hidden">
            {/* --- INICIO MODIFICACIÓN APPLE SENIOR DEV --- */}
            <div className="flex items-center justify-between bg-gradient-to-r from-blue-100 to-indigo-100 p-3">
                <div className="flex items-center gap-2">
                    <BookOpen size={16} className="text-indigo-900/70" />
                    <h4 className="text-sm font-semibold text-indigo-900">Datos espirituales</h4>
                </div>
                {edit && <Edit2 size={14} className="text-indigo-400/70" />}
            </div>
            {/* --- FIN MODIFICACIÓN APPLE SENIOR DEV --- */}
            <div className="p-4">
                <EditableRowBool_SNNS
                  label="Nacimiento del Espíritu"
                  value={form.nacimiento_espiritu}
                  edit={edit}
                  onChange={onBoolSNNS("nacimiento_espiritu")}
                />
                <EditableRowBool
                  label="Bautizo en agua"
                  value={form.bautizo_agua}
                  edit={edit}
                  onChange={onBoolString("bautizo_agua")}
                />
                <EditableRowBool
                  label="Bautismo del Espíritu"
                  value={form.bautismo_espiritu}
                  edit={edit}
                  onChange={onBoolString("bautismo_espiritu")}
                />
                <EditableRowBool
                  label="Tiene Biblia"
                  value={form.tiene_biblia}
                  edit={edit}
                  onChange={onBool("tiene_biblia")}
                />
                <EditableRowBool
                  label="Ayuna"
                  value={form.ayuna}
                  edit={edit}
                  onChange={onBoolString("ayuna")}
                />
                <EditableRow
                  label="Motivo Ayuno"
                  value={form.motivo_ayuno}
                  edit={edit}
                  onInput={onCE("motivo_ayuno")}
                />
                <EditableRowSelect
                  label="Tiempo de oración"
                  value={form.tiempo_oracion}
                  edit={edit}
                  onChange={(v) => setF("tiempo_oracion", v)}
                  options={TIEMPO_ORACION}
                />
                <EditableRowSelect
                  label="Lectura Bíblica"
                  value={form.frecuencia_lectura_biblia}
                  edit={edit}
                  onChange={(v) => setF("frecuencia_lectvura_biblia", v)}
                  options={LECTURA_BIBLIA}
                />
            </div>
          </section>

          <section className="rounded-2xl ring-1 ring-black/5 bg-zinc-50 overflow-hidden">
            {/* --- INICIO MODIFICACIÓN APPLE SENIOR DEV --- */}
            <div className="flex items-center justify-between bg-gradient-to-r from-blue-100 to-indigo-100 p-3">
                <div className="flex items-center gap-2">
                    <HeartPulse size={16} className="text-indigo-900/70" />
                    <h4 className="text-sm font-semibold text-indigo-900">Salud y Consejería</h4>
                </div>
                {edit && <Edit2 size={14} className="text-indigo-400/70" />}
            </div>
            {/* --- FIN MODIFICACIÓN APPLE SENIOR DEV --- */}
            <div className="p-4">
                <EditableRow label="Meta Personal" value={form.meta_personal} edit={edit} onInput={onCE("meta_personal")} />
                <EditableRow label="Retiros Asistidos" value={form.retiros_asistidos} edit={edit} onInput={onCE("retiros_asistidos")} />
                <EditableRow label="Enfermedad" value={form.enfermedad} edit={edit} onInput={onCE("enfermedad")} />
                <EditableRowBool
                  label="Tratamiento clínico"
                  value={form.tratamiento_clinico}
                  edit={edit}
                  onChange={onBoolString("tratamiento_clinico")}
                />
                <EditableRow
                  label="Motivo tratamiento"
                  value={form.motivo_tratamiento}
                  edit={edit}
                  onInput={onCE("motivo_tratamiento")}
                />
                <EditableRowBool
                  label="Recibe consejería"
                  value={form.recibe_consejeria}
                  edit={edit}
                  onChange={onBoolString("recibe_consejeria")}
                />
                <EditableRow
                  label="Motivo consejería"
                  value={form.motivo_consejeria}
                  edit={edit}
                  onInput={onCE("motivo_consejeria")}
                />
            </div>
          </section>

          <section className="rounded-2xl ring-1 ring-black/5 bg-zinc-50 overflow-hidden">
            {/* --- INICIO MODIFICACIÓN APPLE SENIOR DEV --- */}
            <div className="flex items-center justify-between bg-gradient-to-r from-blue-100 to-indigo-100 p-3">
                <div className="flex items-center gap-2">
                    <ClipboardList size={16} className="text-indigo-900/70" />
                    <h4 className="text-sm font-semibold text-indigo-900">Evaluación y observaciones</h4>
                </div>
                {edit && <Edit2 size={14} className="text-indigo-400/70" />}
            </div>
            {/* --- FIN MODIFICACIÓN APPLE SENIOR DEV --- */}
            <div className="p-4">
                <EditableRowBool
                  label="Aspecto feliz"
                  value={form.aspecto_feliz}
                  edit={edit}
                  onChange={onBool("aspecto_feliz")}
                />
                <EditableRowBool
                  label="Muy interesado"
                  value={form.muy_interesado}
                  edit={edit}
                  onChange={onBool("muy_interesado")}
                />
                <EditableRowBool
                  label="Interviene"
                  value={form.interviene}
                  edit={edit}
                  onChange={onBool("interviene")}
                />
                <EditableRow label="Cambios físicos" value={form.cambios_fisicos} edit={edit} onInput={onCE("cambios_fisicos")} />
                <EditableRow label="Cambios emocionales" value={form.cambios_emocionales} edit={edit} onInput={onCE("cambios_emocionales")} />
                <EditableRow label="Desempeño en clase" value={form.desempeno_clase} edit={edit} onInput={onCE("desempeno_clase")}
                />
                <EditableRow label="Maestro encargado" value={form.maestro_encargado} edit={edit} onInput={onCE("maestro_encargado")}
                />
                <EditableRowBool
                  label="Promovido"
                  value={form.promovido}
                  edit={edit}
                  onChange={onBoolString("promovido")}
                />
            </div>
          </section>

          <section className="rounded-2xl ring-1 ring-black/5 bg-zinc-50 overflow-hidden">
            {/* --- INICIO MODIFICACIÓN APPLE SENIOR DEV --- */}
            <div className="flex items-center justify-between bg-gradient-to-r from-blue-100 to-indigo-100 p-3">
                <div className="flex items-center gap-2">
                    <NotebookPen size={16} className="text-indigo-900/70" />
                    <h4 className="text-sm font-semibold text-indigo-900">Notas Adicionales</h4>
                </div>
                {edit && <Edit2 size={14} className="text-indigo-400/70" />}
            </div>
            {/* --- FIN MODIFICACIÓN APPLE SENIOR DEV --- */}
            <div className="p-4">
                <EditableRow label="Notas del maestro" value={form.notas} edit={edit} onInput={onCE("notas")} />
            </div>
          </section>

        </div>
        {/* --- FIN REQ 2 y 3 --- */}

        <div className="mt-6 text-right text-xs text-zinc-500">
          Creada: {formatDateTime(row.created_at)}
        </div>
      </div>
    </div>
  );
}                                          
// --- FIN MODIFICACIÓN ---