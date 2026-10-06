export type HistoryCandidate = {
  id: string; fuente: 'persona' | 'entrevista'; nombre: string;
  telefono: string | null; cedula: string | null; email: string | null;
  confianza: 'segura' | 'probable'; motivo: string; nivel: string | null;
  etapa: string | null; modulo: number | null; cursoId: number | null;
  fecha: string | null; activo: boolean;
};
export type IntakeGroup = {
  key: string; fuente: 'persona' | 'entrevista'; etapa: string | null;
  modulo: number | null; dia: string; cursoId: number | null;
  maestroId: string | null; label: string;
};
export function historyLabel(candidates: HistoryCandidate[]): string {
  if (!candidates.length) return 'PERSONA NUEVA';
  if (candidates.length !== 1 || candidates[0].confianza !== 'segura') return 'Posible historial encontrado';
  const c = candidates[0];
  if (c.activo) return `PERSONA EXISTENTE · ${c.nivel || 'Proceso activo'}`;
  return c.nivel ? `REINGRESO · Último curso: ${c.nivel}` : 'PERSONA EXISTENTE · Sin cursos registrados';
}
export function compatibleGroups(groups: IntakeGroup[], candidate: HistoryCandidate): IntakeGroup[] {
  return groups.filter(g => g.fuente === candidate.fuente && (g.fuente === 'persona'
    ? g.etapa === candidate.etapa && g.modulo === candidate.modulo
    : g.cursoId === candidate.cursoId));
}
