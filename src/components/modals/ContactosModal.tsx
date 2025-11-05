"use client";

import React from 'react';
import { supabase } from '@/lib/supabaseClient';

// Definición del tipo de dato para un contacto
type Persona = {
    id: string;
    nombre: string;
    telefono: string | null;
    observaciones: string | null;
    estudio_dia: string | null;
    etapa: string | null;
    semana: number | null;
};

// Definición de las props que el modal recibirá
type ContactosModalProps = {
    onClose: () => void;
};

export default function ContactosModal({ onClose }: ContactosModalProps) {
    const [q, setQ] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [results, setResults] = React.useState<Persona[]>([]);
    const [selected, setSelected] = React.useState<Persona | null>(null);

    // Función para formatear el día de estudio
    function diaBonito(d: string | null) {
        if (!d) return '—';
        const s = d.toString().toLowerCase();
        if (s.includes('dom')) return 'Domingo';
        if (s.includes('mar')) return 'Martes';
        if (s.includes('vir')) return 'Virtual';
        return d;
    }

    // Función para formatear la etapa
    function etapaBonita(etapa: string | null) {
        if (!etapa || etapa.trim() === '') return 'No asignado a ninguna etapa de Estudio';
        return etapa;
    }

    // Lógica de búsqueda (aún por implementar completamente)
    // ...

    return (
        <>
            <div className="mac-overlay" onClick={onClose} />
            <div className="mac-modal" role="dialog" aria-modal="true" aria-label="Contactos Consolidación">
                <div className="mac-head">
                    <h3 className="mac-title">Contactos Consolidación</h3>
                    <button className="mac-close" onClick={onClose} aria-label="Cerrar">✕</button>
                </div>
                <div className="mac-search-wrap">
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Buscar por nombre o teléfono…"
                        className="mac-search"
                        autoFocus
                    />
                </div>
                <div className="mac-content">
                    <div className="mac-results">
                        {/* Aquí iría el listado de resultados de la búsqueda */}
                    </div>
                    <div className="mac-detail">
                        {selected && (
                            <div className="mac-stack">
                                {/* Datos Personales */}
                                <section className="mac-card">
                                    <div className="mac-card-title">Datos Personales</div>
                                    <div className="mac-item">
                                        <span className="mac-item-key">Nombre</span>
                                        <span className="mac-item-val">{selected.nombre}</span>
                                    </div>
                                    <div className="mac-item">
                                        <span className="mac-item-key">Teléfono</span>
                                        <span className="mac-item-val">{selected.telefono ?? '—'}</span>
                                    </div>
                                </section>
                                {/* Información Académica */}
                                <section className="mac-card">
                                    <div className="mac-card-title">Información Académica</div>
                                    <div className="mac-item">
                                        <span className="mac-item-key">Etapa</span>
                                        <span className="mac-item-val">{etapaBonita(selected.etapa)}</span>
                                    </div>
                                    <div className="mac-item">
                                        <span className="mac-item-key">Día de estudio</span>
                                        <span className="mac-item-val">{diaBonito(selected.estudio_dia)}</span>
                                    </div>
                                    {selected.semana ? (
                                        <div className="mac-item">
                                            <span className="mac-item-key">Semana</span>
                                            <span className="mac-item-val">{selected.semana}</span>
                                        </div>
                                    ) : null}
                                </section>
                                {/* Observaciones */}
                                <section className="mac-card">
                                    <div className="mac-card-title">Observaciones</div>
                                    <div className="mac-note">{selected.observaciones ?? '—'}</div>
                                </section>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {/* Estilos JSX Global: Contienen todo el CSS necesario para el modal */}
            <style jsx global>{`
                .mac-overlay {
                    position: fixed; inset: 0; background: rgba(0,0,0,.3); backdrop-filter: blur(2px);
                    z-index: 60;
                }
                .mac-modal {
                    position: fixed; inset: 0; display: grid; place-items: center; z-index: 61;
                    pointer-events: none;
                }
                .mac-modal > * { pointer-events: auto; }
                .mac-modal {
                    padding: 24px;
                }
                .mac-modal .mac-head,
                .mac-modal .mac-content {
                    width: min(1280px, 92vw);
                }
                .mac-head {
                    margin: 0 auto 14px auto;
                    width: 100%;
                    position: relative;
                    text-align: center;
                }
                .mac-title {
                    font-size: 20px;
                    font-weight: 600;
                    color: #0f172a;
                }
                .mac-close {
                    position: absolute;
                    right: 0;
                    top: 0;
                    border: 0;
                    background: #f1f5f9;
                    width: 32px;
                    height: 32px;
                    border-radius: 10px;
                    cursor: pointer;
                }
                .mac-search-wrap { display: grid; place-items: center; margin-bottom: 14px; }
                .mac-search {
                    width: min(920px, 92vw);
                    height: 44px;
                    padding: 0 14px;
                    border-radius: 12px;
                    border: 1px solid #e5e7eb;
                    background: #fff;
                    box-shadow: 0 8px 30px rgba(0,0,0,.06);
                    font-size: 15px;
                }
                .mac-content {
                    display: grid;
                    grid-template-columns: 320px 1fr;
                    gap: 16px;
                    margin: 0 auto;
                    background: #ffffff;
                    border: 1px solid #e5e7eb;
                    border-radius: 18px;
                    box-shadow: 0 20px 60px rgba(0,0,0,.08);
                    padding: 16px;
                }
                @media (max-width: 860px) {
                    .mac-content { grid-template-columns: 1fr; }
                }
                .mac-results {
                    border-right: 1px solid #eef2f7;
                    padding-right: 8px;
                    max-height: 60vh;
                    overflow: auto;
                }
                @media (max-width: 860px) {
                    .mac-results { border-right: 0; border-bottom: 1px solid #eef2f7; padding-bottom: 8px; margin-bottom: 8px; }
                }
                .mac-result {
                    width: 100%;
                    display: flex; justify-content: space-between; align-items: center;
                    padding: 10px 12px; border-radius: 10px; border: 1px solid transparent;
                    background: #fff; cursor: pointer; margin-bottom: 8px;
                }
                .mac-result:hover { border-color: #e5e7eb; background: #fafafa; }
                .mac-result.active { border-color: #d1d5db; background: #f8fafc; }
                .mac-result-name { font-weight: 600; color: #0f172a; }
                .mac-result-phone { color: #334155; font-size: 13px; }

                .mac-detail { min-height: 240px; }
                .mac-stack { display: grid; gap: 12px; }
                .mac-card {
                    background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 14px;
                }
                .mac-card-title {
                    font-weight: 600; color: #111827; margin-bottom: 10px;
                }
                .mac-item {
                    display: grid; grid-template-columns: 160px 1fr; gap: 10px;
                    padding: 8px 0; border-bottom: 1px dashed #eef2f7;
                }
                .mac-item:last-child { border-bottom: 0; }
                .mac-item-key { color: #6b7280; }
                .mac-item-val { color: #0f172a; font-weight: 500; }
                .mac-note { white-space: pre-wrap; color: #0f172a; background: #fafafa; border: 1px dashed #e5e7eb; padding: 10px; border-radius: 10px; }
                .mac-hint { color: #64748b; font-size: 14px; padding: 10px; }
            `}</style>
        </>
    );
}