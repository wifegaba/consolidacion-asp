import type { ReactNode, Ref } from 'react';

export function DashboardMetric({ tone, label, value, detail, burst, ref }: {
    tone: 'contactos' | 'servidores' | 'asistencias' | 'agendados'; label: string; value: string; detail?: ReactNode;
    burst?: boolean; ref?: Ref<HTMLButtonElement>;
}) {
    return <button ref={ref} type="button" data-key={tone} aria-controls="consolidation-metric-detail"
        className={`kpi-card ${tone}`}>
        <span className="metric-label">{label}</span>
        <span className={`metric-value ${burst ? 'burst' : ''}`}>{value}</span>
        {detail && <span className="metric-detail">{detail}</span>}
    </button>;
}
