type CourseReference = {
  nivel: string | null; etapa: string | null; modulo: number | null; cursoId: number | null;
  estado?: string | null;
};
export type HistoryCandidate = CourseReference & {
  id: string; fuente: 'persona' | 'entrevista'; nombre: string;
  telefono: string | null; cedula: string | null; email: string | null;
  confianza: 'segura' | 'probable'; motivo: string;
  fecha: string | null; activo: boolean;
  cursos?: CourseReference[];
  siguiente?: CourseReference | null;
};
export function lastCourseLabel(level: string, status?: string | null) {
  return status && ['finalizado', 'completado', 'promovido', 'graduado'].includes(status)
    ? `${level} finalizado` : `Último curso: ${level}`;
}
export type IntakeGroup = {
  key: string; fuente: 'persona' | 'entrevista'; etapa: string | null;
  modulo: number | null; dia: string; cursoId: number | null;
  maestroId: string | null; label: string;
};
export function normalizeIntakePhone(value: string | null | undefined): string {
  const digits = (value || '').replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('57') ? digits.slice(2) : digits;
}
export function historyLabel(candidates: HistoryCandidate[]): string {
  if (!candidates.length) return 'PERSONA NUEVA';
  if (candidates.length !== 1 || candidates[0].confianza !== 'segura') return 'Posible historial encontrado';
  const c = candidates[0];
  if (c.activo) return `PERSONA EXISTENTE · ${c.nivel || 'Proceso activo'}`;
  return c.nivel ? `REINGRESO · Último curso: ${c.nivel}` : 'PERSONA EXISTENTE · Sin cursos registrados';
}
export function courseKey(source: IntakeGroup['fuente'], course: Pick<CourseReference, 'etapa' | 'modulo' | 'cursoId'>) {
  return source === 'entrevista' ? `curso:${course.cursoId}` : `${course.etapa}:${course.modulo}`;
}

export function intakeCourses(groups: IntakeGroup[], candidate?: HistoryCandidate) {
  type Option = { key: string; label: string; detail: string; kind: 'next' | 'history' | 'other'; groups: IntakeGroup[] };
  const source = candidate?.fuente || 'persona';
  const options = new Map<string, Option>();
  function add(course: CourseReference, kind: Option['kind'], detail: string) {
    const key = courseKey(source, course);
    if (course.nivel && !options.has(key)) options.set(key, { key, label: course.nivel, kind, detail, groups: [] });
  }
  if (candidate?.siguiente) add(candidate.siguiente, 'next', 'Siguiente en la ruta');
  for (const course of [candidate, ...(candidate?.cursos ?? [])]) {
    if (!course?.nivel) continue;
    const finished = lastCourseLabel(course.nivel, course.estado) === `${course.nivel} finalizado`;
    add(course, 'history', course === candidate
      ? (finished ? 'Último curso · Finalizado' : 'Último curso registrado')
      : (finished ? 'Finalizado' : 'Curso anterior'));
  }
  for (const group of groups) {
    if (group.fuente !== source) continue;
    const key = courseKey(source, group);
    if (!options.has(key)) options.set(key, { key, label: group.label.split(' – ')[0], kind: 'other', detail: 'Otro curso', groups: [] });
    options.get(key)!.groups.push(group);
  }
  return [...options.values()];
}
