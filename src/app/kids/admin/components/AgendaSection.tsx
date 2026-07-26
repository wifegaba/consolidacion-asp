'use client'

import React, { useState, useEffect, useRef } from 'react'

interface GroupAssignment {
  coordinador: string
  maestros: string[]
  auxiliares: string[]
  timoteos: string[]
}

/* ── Fresh Subtle Colors for Group Headers ───────────────────────────────── */
const GROUP_HEADER_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  '4 a 6 años':   { bg: 'linear-gradient(135deg, rgba(224,242,254,0.75), rgba(186,230,253,0.45))', text: '#0369a1', border: 'rgba(56,189,248,0.30)', dot: '#38bdf8' },
  '7 a 9 años':   { bg: 'linear-gradient(135deg, rgba(240,253,244,0.80), rgba(187,247,208,0.50))', text: '#15803d', border: 'rgba(74,222,128,0.30)', dot: '#4ade80' },
  '9 años':       { bg: 'linear-gradient(135deg, rgba(254,243,199,0.75), rgba(253,230,138,0.45))', text: '#b45309', border: 'rgba(251,191,36,0.30)', dot: '#fbbf24' },
  'Timoteos':     { bg: 'linear-gradient(135deg, rgba(236,253,245,0.80), rgba(167,243,208,0.50))', text: '#047857', border: 'rgba(52,211,153,0.30)', dot: '#34d399' },
  'PTMD Kids':    { bg: 'linear-gradient(135deg, rgba(245,243,255,0.80), rgba(221,214,254,0.50))', text: '#6d28d9', border: 'rgba(167,139,250,0.30)', dot: '#a78bfa' },
}

const DEFAULT_GROUP_HEADER = { bg: 'linear-gradient(135deg, rgba(241,245,249,0.85), rgba(226,232,240,0.55))', text: '#334155', border: 'rgba(203,213,225,0.35)', dot: '#94a3b8' }

export default function AgendaSection({ servidores = [], isMobile: isMobileProp = false }: { servidores?: any[]; isMobile?: boolean }) {
  const [isMobile, setIsMobile] = useState(isMobileProp)

  useEffect(() => {
    setIsMobile(isMobileProp)
  }, [isMobileProp])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(max-width: 768px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches || isMobileProp)
    setIsMobile(mql.matches || isMobileProp)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [isMobileProp])

  const cultosOpciones: Record<string, string[]> = {
    'DOMINGO': ['7:00 AM', '9:00 AM', '11:00 AM', '5:30 PM'],
    'MIÉRCOLES': ['7:00 AM', '9:00 AM', '11:00 AM', '1:00 PM', '3:00 PM', '6:30 PM'],
    'VIERNES': ['9:00 AM', '6:30 PM'],
    'SÁBADO': ['Ayuno Familiar', 'Jóvenes'],
  }

  const [selectedDia, setSelectedDia] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('agenda_draft_dia') || 'DOMINGO'
    }
    return 'DOMINGO'
  })

  const [selectedCulto, setSelectedCulto] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('agenda_draft_culto') || '7:00 AM'
    }
    return '7:00 AM'
  })

  const [openDiaMenu, setOpenDiaMenu] = useState<string | null>(null)
  
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('agenda_draft_date') || '2026-07-26'
    }
    return '2026-07-26'
  })

  const gruposEdades = ['4 a 6 años', '7 a 9 años', '9 años', 'Timoteos', 'PTMD Kids']
  const areasApoyo = ['Consolidación', 'Disciplina']

  // Asignaciones por día, culto y grupo: key = `${selectedDia}_${selectedCulto}_${grupo}`
  const [assignments, setAssignments] = useState<Record<string, GroupAssignment>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('agenda_draft_assignments')
        if (saved) return JSON.parse(saved)
      } catch (e) {}
    }
    return {}
  })

  const [areaAssignments, setAreaAssignments] = useState<Record<string, string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('agenda_draft_area_assignments')
        if (saved) return JSON.parse(saved)
      } catch (e) {}
    }
    return {}
  })

  // Sincronizar en tiempo real en la memoria temporal (localStorage)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('agenda_draft_dia', selectedDia)
      localStorage.setItem('agenda_draft_culto', selectedCulto)
      localStorage.setItem('agenda_draft_date', selectedDate)
      localStorage.setItem('agenda_draft_assignments', JSON.stringify(assignments))
      localStorage.setItem('agenda_draft_area_assignments', JSON.stringify(areaAssignments))
    }
  }, [selectedDia, selectedCulto, selectedDate, assignments, areaAssignments])

  // Filtrar servidores por rol de manera diferenciada
  const coordinadoresList = (servidores || []).filter(s => 
    s.roles?.some((r: string) => r.startsWith('COORDINADOR'))
  )
  const maestrosList = (servidores || []).filter(s => 
    s.roles?.includes('MAESTRO') && !s.roles?.includes('MAESTRO AUXILIAR')
  )
  const auxiliaresList = (servidores || []).filter(s => 
    s.roles?.includes('MAESTRO AUXILIAR') || s.roles?.some((r: string) => r.includes('AUXILIAR'))
  )
  const timoteosList = (servidores || []).filter(s => 
    s.roles?.includes('TIMOTEOS')
  )

  // Obtener la lista de IDs de servidores asignados en el mismo día y horario
  const getAssignedIdsForCurrentSchedule = (excludeGroup?: string, excludeField?: string): Set<string> => {
    const assigned = new Set<string>()
    const prefix = `${selectedDia}_${selectedCulto}_`

    Object.entries(assignments).forEach(([key, assign]) => {
      if (key.startsWith(prefix)) {
        const groupName = key.substring(prefix.length)
        if (assign.coordinador) {
          if (!(groupName === excludeGroup && excludeField === 'coordinador')) {
            assigned.add(assign.coordinador)
          }
        }
        assign.maestros.forEach(id => {
          if (!(groupName === excludeGroup && excludeField === 'maestros')) {
            assigned.add(id)
          }
        })
        assign.auxiliares.forEach(id => {
          if (!(groupName === excludeGroup && excludeField === 'auxiliares')) {
            assigned.add(id)
          }
        })
        assign.timoteos.forEach(id => {
          if (!(groupName === excludeGroup && excludeField === 'timoteos')) {
            assigned.add(id)
          }
        })
      }
    })

    Object.entries(areaAssignments).forEach(([key, personId]) => {
      if (key.startsWith(prefix) && personId) {
        const areaName = key.substring(prefix.length)
        if (areaName !== excludeGroup) {
          assigned.add(personId)
        }
      }
    })

    return assigned
  }

  const getGroupData = (grupo: string): GroupAssignment => {
    const key = `${selectedDia}_${selectedCulto}_${grupo}`
    return assignments[key] || { coordinador: '', maestros: [], auxiliares: [], timoteos: [] }
  }

  const updateGroupData = (grupo: string, updater: (prev: GroupAssignment) => GroupAssignment) => {
    const key = `${selectedDia}_${selectedCulto}_${grupo}`
    setAssignments(prev => ({
      ...prev,
      [key]: updater(prev[key] || { coordinador: '', maestros: [], auxiliares: [], timoteos: [] })
    }))
  }

  const handleAddPerson = (grupo: string, field: 'maestros' | 'auxiliares' | 'timoteos', id: string) => {
    updateGroupData(grupo, prev => {
      if (prev[field].includes(id)) return prev
      return { ...prev, [field]: [...prev[field], id] }
    })
  }

  const handleRemovePerson = (grupo: string, field: 'maestros' | 'auxiliares' | 'timoteos', id: string) => {
    updateGroupData(grupo, prev => ({
      ...prev,
      [field]: prev[field].filter(item => item !== id)
    }))
  }

  const [isFullscreen, setIsFullscreen] = useState(false)

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
        setIsFullscreen(false)
      }
    }
  }

  return (
    <div 
      className="no-scrollbar"
      style={{
        display: 'flex', flexDirection: 'column', height: '100%',
        padding: isMobile ? '8px 10px' : '8px 14px',
        gap: isMobile ? 10 : 8, overflowY: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
        .no-scrollbar {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
      `}</style>
      
      {/* ── Header Area ── */}
      <div style={{ 
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between', 
        alignItems: isMobile ? 'stretch' : 'center', 
        flexWrap: 'wrap', 
        gap: isMobile ? 10 : 6 
      }}>
        <div>
          <h2 style={{
            fontSize: isMobile ? 16 : 15, fontWeight: 800, color: '#111827', margin: 0,
            letterSpacing: '-0.4px'
          }}>
            Programación de Agenda
          </h2>
          <p style={{ fontSize: 9, color: '#64748b', margin: '1px 0 0 0' }}>
            Organiza los turnos y asignaciones de maestros para los cultos.
          </p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Fullscreen Button Liquid Glass Icon-Only */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            style={{
              position: 'relative', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: '50%',
              border: '1px solid rgba(255,255,255,.95)',
              background: isFullscreen 
                ? 'linear-gradient(145deg, rgba(224,242,254,.95), rgba(186,230,253,.75))' 
                : 'linear-gradient(145deg, rgba(255,255,255,.90), rgba(230,240,252,.60))',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,1), 0 2px 6px rgba(96,116,147,.08)',
              backdropFilter: 'blur(20px) saturate(140%)',
              color: isFullscreen ? '#0284c7' : '#0f172a',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={e => {
              const btn = e.currentTarget as HTMLButtonElement
              btn.style.transform = 'translateY(-1px)'
              btn.style.borderColor = 'rgba(56,189,248,.65)'
            }}
            onMouseLeave={e => {
              const btn = e.currentTarget as HTMLButtonElement
              btn.style.transform = 'none'
              btn.style.borderColor = 'rgba(255,255,255,.95)'
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              {isFullscreen ? (
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
              ) : (
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
              )}
            </svg>
          </button>

          {/* Date Picker (Liquid Glass style) */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'linear-gradient(145deg, rgba(255,255,255,.90), rgba(230,240,252,.60))',
            padding: '2.5px 8px', borderRadius: 30,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,1), 0 2px 6px rgba(96,116,147,.08)',
            border: '1px solid rgba(255,255,255,.95)',
            backdropFilter: 'blur(20px) saturate(140%)'
          }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: '#0f172a' }}>{selectedDia}</span>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                border: 'none', background: 'transparent', outline: 'none',
                fontSize: 9.5, fontWeight: 700, color: '#0284c7', cursor: 'pointer'
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Botones de Días Estilo Liquid Glass con Listados / Desplegables (Hover) ── */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', position: 'relative', zIndex: 30 }}>
        {Object.keys(cultosOpciones).map((dia) => {
          const isCurrentDia = selectedDia === dia
          const isOpen = openDiaMenu === dia
          return (
            <div 
              key={dia} 
              style={{ position: 'relative' }}
              onMouseEnter={() => setOpenDiaMenu(dia)}
              onMouseLeave={() => setOpenDiaMenu(null)}
            >
              <button
                onClick={() => {
                  setSelectedDia(dia)
                  setOpenDiaMenu(dia)
                }}
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: isMobile ? '5px 12px' : '3px 9px',
                  borderRadius: 20,
                  fontSize: isMobile ? 11 : 9.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                  letterSpacing: '0.2px',
                  border: isCurrentDia ? '1px solid rgba(56,189,248,.8)' : '1px solid rgba(255,255,255,.9)',
                  background: isCurrentDia
                    ? 'linear-gradient(145deg, rgba(255,255,255,.98), rgba(224,242,254,.90))'
                    : 'linear-gradient(145deg, rgba(255,255,255,.88), rgba(235,242,250,.60))',
                  boxShadow: isCurrentDia
                    ? 'inset 0 1px 0 rgba(255,255,255,1), 0 0 0 1.5px rgba(56,189,248,.35), 0 3px 8px rgba(14,165,233,.18)'
                    : 'inset 0 1px 0 rgba(255,255,255,.95), 0 2px 5px rgba(96,116,147,.08)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  color: isCurrentDia ? '#0284c7' : '#334155',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                onMouseEnter={(e) => {
                  const btn = e.currentTarget as HTMLButtonElement
                  if (!isCurrentDia) {
                    btn.style.transform = 'translateY(1.5px) scale(0.975)'
                    btn.style.background = 'rgba(224,242,254,0.75)'
                    btn.style.boxShadow = 'inset 0 1.5px 3px rgba(0,0,0,0.12), inset 0 -1px 0 rgba(255,255,255,0.8)'
                  }
                }}
                onMouseLeave={(e) => {
                  const btn = e.currentTarget as HTMLButtonElement
                  if (!isCurrentDia) {
                    btn.style.transform = 'none'
                    btn.style.background = 'linear-gradient(145deg, rgba(255,255,255,.88), rgba(235,242,250,.60))'
                    btn.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,.95), 0 2px 5px rgba(96,116,147,.08)'
                  }
                }}
              >
                <span>{dia}</span>
                <svg 
                  width="8" 
                  height="8" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2.8"
                  style={{
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                    opacity: 0.7
                  }}
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {/* Liquid Glass Dropdown Menu para los horarios del día */}
              {isOpen && (
                <div 
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    paddingTop: 4,
                    zIndex: 50,
                  }}
                >
                  <div style={{
                    minWidth: 110,
                    background: 'linear-gradient(145deg, rgba(255,255,255,0.96), rgba(240,246,255,0.92))',
                    backdropFilter: 'blur(20px) saturate(160%)',
                    WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.95)',
                    boxShadow: '0 12px 28px rgba(15,23,42,0.14), inset 0 1px 0 rgba(255,255,255,1)',
                    padding: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    animation: 'aspSlideInRight 0.15s cubic-bezier(0.16, 1, 0.3, 1) both'
                  }}>
                  {cultosOpciones[dia].map((opcion) => {
                    const isSelected = selectedDia === dia && selectedCulto === opcion
                    return (
                      <button
                        key={opcion}
                        onClick={() => {
                          setSelectedDia(dia)
                          setSelectedCulto(opcion)
                          setOpenDiaMenu(null)
                        }}
                        style={{
                          textAlign: 'left',
                          padding: '4px 8px',
                          borderRadius: 6,
                          fontSize: 9.5,
                          fontWeight: isSelected ? 800 : 600,
                          border: 'none',
                          cursor: 'pointer',
                          background: isSelected 
                            ? 'linear-gradient(145deg, rgba(56,189,248,0.18), rgba(14,165,233,0.08))' 
                            : 'transparent',
                          boxShadow: isSelected ? 'inset 0 1px 0 rgba(255,255,255,1)' : 'none',
                          color: isSelected ? '#0284c7' : '#334155',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                        onMouseEnter={(e) => {
                          const btn = e.currentTarget as HTMLButtonElement
                          if (!isSelected) {
                            btn.style.transform = 'translateY(1.5px) scale(0.97)'
                            btn.style.background = 'rgba(56,189,248,0.12)'
                            btn.style.boxShadow = 'inset 0 1.5px 3px rgba(0,0,0,0.10)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          const btn = e.currentTarget as HTMLButtonElement
                          if (!isSelected) {
                            btn.style.transform = 'none'
                            btn.style.background = 'transparent'
                            btn.style.boxShadow = 'none'
                          }
                        }}
                      >
                        <span>{opcion}</span>
                        {isSelected && (
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
          )
        })}

        {/* Separador vertical sutil */}
        <div style={{ width: 1, height: 16, background: 'rgba(0,0,0,0.08)', margin: '0 1px' }} />

        {/* Horarios reducidos de tamaño */}
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
          {cultosOpciones[selectedDia]?.map(culto => {
            const active = selectedCulto === culto
            return (
              <button
                key={culto}
                onClick={() => setSelectedCulto(culto)}
                style={{
                  position: 'relative', overflow: 'hidden', padding: isMobile ? '4px 10px' : '2.5px 8px',
                  borderRadius: 20, fontSize: isMobile ? 10.5 : 8.5, fontWeight: 700, cursor: 'pointer',
                  border: active ? '1px solid rgba(56,189,248,.75)' : '1px solid rgba(255,255,255,.87)',
                  background: active 
                    ? 'linear-gradient(145deg, rgba(255,255,255,.96), rgba(224,242,254,.80))'
                    : 'linear-gradient(145deg, rgba(255,255,255,.85), rgba(223,229,237,.45))',
                  boxShadow: active
                    ? 'inset 0 1px 0 rgba(255,255,255,1), 0 0 0 1px rgba(56,189,248,.32), 0 2px 5px rgba(14,165,233,.15)'
                    : 'inset 0 1px 0 rgba(255,255,255,.95), 0 1px 3px rgba(96,116,147,.05)',
                  color: active ? '#0284c7' : '#475569',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  const btn = e.currentTarget as HTMLButtonElement
                  if (!active) {
                    btn.style.transform = 'translateY(1.5px) scale(0.97)'
                    btn.style.boxShadow = 'inset 0 1.5px 3px rgba(0,0,0,0.12), inset 0 -1px 0 rgba(255,255,255,0.8)'
                    btn.style.background = 'rgba(224,242,254,0.65)'
                  }
                }}
                onMouseLeave={(e) => {
                  const btn = e.currentTarget as HTMLButtonElement
                  if (!active) {
                    btn.style.transform = 'none'
                    btn.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,.95), 0 1px 3px rgba(96,116,147,.05)'
                    btn.style.background = 'linear-gradient(145deg, rgba(255,255,255,.85), rgba(223,229,237,.45))'
                  }
                }}
              >
                <span style={{ position: 'relative', zIndex: 2 }}>{culto}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Kanban / Grid de Asignaciones ── */}
      <div 
        className="no-scrollbar"
        style={{
          background: 'radial-gradient(circle at 11% 75%, rgba(224,242,254,.18), transparent 35%), linear-gradient(135deg, #f8fafc 0%, #fafafa 50%, #f1f5f9 100%)',
          borderRadius: 20, padding: isMobile ? '10px 10px 80px 10px' : '12px 16px 40px 16px', flex: 1, overflowY: 'auto',
          boxShadow: 'inset 0 1px 1px rgba(255,255,255,.9), 0 12px 24px rgba(54,69,95,.06)',
          border: '1px solid rgba(255,255,255,0.6)',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {/* Grupos por Edades */}
          {gruposEdades.map(grupo => {
            const data = getGroupData(grupo)
            const gStyle = GROUP_HEADER_COLORS[grupo] || DEFAULT_GROUP_HEADER
            return (
              <div key={grupo} style={{
                background: 'linear-gradient(145deg, rgba(255,255,255,1), rgba(248,250,252,.85))',
                borderRadius: 12, padding: 10, border: '1px solid rgba(255,255,255,0.9)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03), inset 0 2px 4px rgba(255,255,255,0.8)',
                display: 'flex', flexDirection: 'column', gap: 8
              }}>
                {/* Header Fresco Sutil */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 9px', borderRadius: 8,
                  background: gStyle.bg,
                  border: `1px solid ${gStyle.border}`,
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 1.5px 4px rgba(0,0,0,0.02)',
                  marginBottom: 2
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: gStyle.dot,
                    boxShadow: `0 0 6px ${gStyle.dot}`,
                    flexShrink: 0
                  }} />
                  <h3 style={{ margin: 0, fontSize: isMobile ? 13 : 11.5, color: gStyle.text, fontWeight: 800, letterSpacing: '-0.2px' }}>
                    {grupo}
                  </h3>
                </div>
                
                {/* 1. Coordinador de Clase */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: isMobile ? 10 : 8.5, color: '#dc2626', fontWeight: 700 }}>
                      Coordinador de Clase
                    </span>
                  </div>
                  <GlassSelect 
                    isMobile={isMobile}
                    placeholder="Seleccionar coordinador..."
                    value={data.coordinador}
                    options={coordinadoresList
                      .filter(c => c.id === data.coordinador || !getAssignedIdsForCurrentSchedule(grupo, 'coordinador').has(c.id))
                      .map(c => ({ id: c.id, label: `${c.nombre} ${c.apellido}` }))}
                    onSelect={(id) => updateGroupData(grupo, prev => ({ ...prev, coordinador: id }))}
                  />
                </div>

                {/* 2. Maestros (Múltiples) */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: isMobile ? 10 : 8.5, color: '#0284c7', fontWeight: 700 }}>
                      Maestros
                    </span>
                  </div>
                  
                  <GlassSelect 
                    isMobile={isMobile}
                    placeholder="Seleccionar maestro..."
                    options={maestrosList
                      .filter(m => !data.maestros.includes(m.id) && !getAssignedIdsForCurrentSchedule(grupo, 'maestros').has(m.id))
                      .map(m => ({ id: m.id, label: `${m.nombre} ${m.apellido}` }))}
                    onSelect={(id) => handleAddPerson(grupo, 'maestros', id)}
                  />

                  {/* Selected maestros pills */}
                  {data.maestros.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                      {data.maestros.map(id => {
                        const person = servidores.find(s => s.id === id)
                        if (!person) return null
                        return (
                          <span key={id} style={{
                            fontSize: 9, background: 'rgba(2,132,199,0.1)', color: '#0284c7',
                            padding: '2px 6px', borderRadius: 12, fontWeight: 700,
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            border: '1px solid rgba(2,132,199,0.2)'
                          }}>
                            {person.nombre} {person.apellido}
                            <button 
                              onClick={() => handleRemovePerson(grupo, 'maestros', id)}
                              style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: '#ef4444', fontWeight: 800, fontSize: 10 }}
                            >×</button>
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* 3. Maestras Auxiliares (Múltiples) */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: isMobile ? 10 : 8.5, color: '#7c3aed', fontWeight: 700 }}>
                      Maestras Auxiliares
                    </span>
                  </div>

                  <GlassSelect 
                    isMobile={isMobile}
                    placeholder="Seleccionar maestr@ auxiliar..."
                    options={auxiliaresList
                      .filter(m => !data.auxiliares.includes(m.id) && !getAssignedIdsForCurrentSchedule(grupo, 'auxiliares').has(m.id))
                      .map(m => ({ id: m.id, label: `${m.nombre} ${m.apellido}` }))}
                    onSelect={(id) => handleAddPerson(grupo, 'auxiliares', id)}
                  />

                  {/* Selected auxiliares pills */}
                  {data.auxiliares.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                      {data.auxiliares.map(id => {
                        const person = servidores.find(s => s.id === id)
                        if (!person) return null
                        return (
                          <span key={id} style={{
                            fontSize: 9, background: 'rgba(124,58,237,0.1)', color: '#7c3aed',
                            padding: '2px 6px', borderRadius: 12, fontWeight: 700,
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            border: '1px solid rgba(124,58,237,0.2)'
                          }}>
                            {person.nombre} {person.apellido}
                            <button 
                              onClick={() => handleRemovePerson(grupo, 'auxiliares', id)}
                              style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: '#ef4444', fontWeight: 800, fontSize: 10 }}
                            >×</button>
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* 4. Timoteos (Múltiples) */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: isMobile ? 10 : 8.5, color: '#059669', fontWeight: 700 }}>
                      Timoteos
                    </span>
                  </div>

                  <GlassSelect 
                    isMobile={isMobile}
                    placeholder="Seleccionar timoteo..."
                    options={timoteosList
                      .filter(t => !data.timoteos.includes(t.id) && !getAssignedIdsForCurrentSchedule(grupo, 'timoteos').has(t.id))
                      .map(t => ({ id: t.id, label: `${t.nombre} ${t.apellido}` }))}
                    onSelect={(id) => handleAddPerson(grupo, 'timoteos', id)}
                  />

                  {/* Selected timoteos pills */}
                  {data.timoteos.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                      {data.timoteos.map(id => {
                        const person = servidores.find(s => s.id === id)
                        if (!person) return null
                        return (
                          <span key={id} style={{
                            fontSize: 9, background: 'rgba(5,150,105,0.1)', color: '#059669',
                            padding: '2px 6px', borderRadius: 12, fontWeight: 700,
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            border: '1px solid rgba(5,150,105,0.2)'
                          }}>
                            {person.nombre} {person.apellido}
                            <button 
                              onClick={() => handleRemovePerson(grupo, 'timoteos', id)}
                              style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: '#ef4444', fontWeight: 800, fontSize: 10 }}
                            >×</button>
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>

              </div>
            )
          })}

          {/* Card: Áreas de Apoyo (posicionada enseguida de PTMD Kids) */}
          <div style={{
            background: 'linear-gradient(145deg, rgba(255,255,255,1), rgba(248,250,252,.85))',
            borderRadius: 12, padding: 10, border: '1px solid rgba(255,255,255,0.9)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03), inset 0 2px 4px rgba(255,255,255,0.8)',
            display: 'flex', flexDirection: 'column', gap: 8
          }}>
            {/* Header Fresco Sutil */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 9px', borderRadius: 8,
              background: 'linear-gradient(135deg, rgba(238,242,254,0.85), rgba(224,231,255,0.50))',
              border: '1px solid rgba(199,210,254,0.6)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 1.5px 4px rgba(0,0,0,0.02)',
              marginBottom: 2
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', boxShadow: '0 0 6px #6366f1', flexShrink: 0 }} />
              <h3 style={{ margin: 0, fontSize: isMobile ? 13 : 11.5, color: '#4338ca', fontWeight: 800, letterSpacing: '-0.2px' }}>
                Áreas de Apoyo
              </h3>
            </div>

            {areasApoyo.map(area => (
              <div key={area}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: isMobile ? 10 : 8.5, color: '#4f46e5', fontWeight: 700 }}>
                    {area}
                  </span>
                </div>
                <GlassSelect 
                  isMobile={isMobile}
                  placeholder="Asignar servidor..."
                  value={areaAssignments[`${selectedDia}_${selectedCulto}_${area}`] || ''}
                  options={servidores
                    .filter(s => {
                      const currentAssigned = areaAssignments[`${selectedDia}_${selectedCulto}_${area}`]
                      return s.id === currentAssigned || !getAssignedIdsForCurrentSchedule(area).has(s.id)
                    })
                    .map(s => ({ id: s.id, label: `${s.nombre} ${s.apellido}` }))}
                  onSelect={(id) => setAreaAssignments(prev => ({ ...prev, [`${selectedDia}_${selectedCulto}_${area}`]: id }))}
                />
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}

/* ── Custom Liquid Glass Select Component ───────────────────────────────── */
function GlassSelect({
  placeholder,
  options,
  value,
  onSelect,
  isMobile = false
}: {
  placeholder: string
  options: { id: string; label: string }[]
  value?: string
  onSelect: (id: string) => void
  isMobile?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [openUp, setOpenUp] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selectedOption = options.find(o => o.id === value)
  const displayText = selectedOption ? selectedOption.label : placeholder

  const handleMouseEnter = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      setOpenUp(spaceBelow < 210)
    }
    setOpen(true)
  }

  return (
    <div 
      ref={ref}
      style={{ position: 'relative', width: '100%' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isMobile ? '6px 10px' : '4px 8px',
          marginTop: 2,
          borderRadius: 6,
          border: '1px solid rgba(255,255,255,0.95)',
          fontSize: isMobile ? 11.5 : 10,
          outline: 'none',
          background: 'linear-gradient(145deg, rgba(255,255,255,0.95), rgba(240,244,248,0.75))',
          color: selectedOption ? '#0284c7' : '#64748b',
          fontWeight: 600,
          height: isMobile ? 32 : 26,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,1), 0 1.5px 4px rgba(0,0,0,0.04)',
          cursor: 'pointer',
          transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onMouseEnter={(e) => {
          const btn = e.currentTarget as HTMLButtonElement
          btn.style.transform = 'translateY(1px) scale(0.985)'
          btn.style.background = 'rgba(224,242,254,0.75)'
          btn.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.08)'
        }}
        onMouseLeave={(e) => {
          const btn = e.currentTarget as HTMLButtonElement
          btn.style.transform = 'none'
          btn.style.background = 'linear-gradient(145deg, rgba(255,255,255,0.95), rgba(240,244,248,0.75))'
          btn.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,1), 0 1.5px 4px rgba(0,0,0,0.04)'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayText}
        </span>
        <svg 
          width="8" 
          height="8" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2.8"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease', opacity: 0.6, flexShrink: 0, marginLeft: 4 }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && options.length > 0 && (
        <div style={{
          position: 'absolute',
          top: openUp ? 'auto' : '100%',
          bottom: openUp ? '100%' : 'auto',
          left: 0, right: 0,
          paddingTop: openUp ? 0 : 3,
          paddingBottom: openUp ? 3 : 0,
          zIndex: 60
        }}>
          <div style={{
            background: 'linear-gradient(145deg, rgba(255,255,255,0.98), rgba(244,248,255,0.95))',
            backdropFilter: 'blur(20px) saturate(160%)',
            WebkitBackdropFilter: 'blur(20px) saturate(160%)',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.95)',
            boxShadow: openUp
              ? '0 -10px 24px rgba(15,23,42,0.16), inset 0 1px 0 rgba(255,255,255,1)'
              : '0 10px 24px rgba(15,23,42,0.14), inset 0 1px 0 rgba(255,255,255,1)',
            padding: '3px',
            maxHeight: 160,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            animation: 'aspSlideInRight 0.15s cubic-bezier(0.16, 1, 0.3, 1) both'
          }}>
            {options.map(opt => {
              const isOptSelected = opt.id === value
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onSelect(opt.id)
                    setOpen(false)
                  }}
                  style={{
                    textAlign: 'left',
                    padding: isMobile ? '6px 10px' : '4px 8px',
                    borderRadius: 6,
                    fontSize: isMobile ? 11 : 9.5,
                    fontWeight: isOptSelected ? 800 : 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: isOptSelected 
                      ? 'linear-gradient(145deg, rgba(56,189,248,0.18), rgba(14,165,233,0.08))' 
                      : 'transparent',
                    color: isOptSelected ? '#0284c7' : '#334155',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.14s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
                  }}
                  onMouseEnter={(e) => {
                    const btn = e.currentTarget as HTMLButtonElement
                    btn.style.transform = 'translateY(1.5px) scale(0.98)'
                    btn.style.boxShadow = 'inset 0 2.5px 5px rgba(81,105,139,0.22), inset 0 1px 2px rgba(0,0,0,0.10)'
                    if (!isOptSelected) {
                      btn.style.background = 'linear-gradient(145deg, rgba(224,242,254,0.90), rgba(186,230,253,0.65))'
                    }
                  }}
                  onMouseLeave={(e) => {
                    const btn = e.currentTarget as HTMLButtonElement
                    btn.style.transform = 'none'
                    btn.style.boxShadow = 'none'
                    if (!isOptSelected) {
                      btn.style.background = 'transparent'
                    }
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.label}</span>
                  {isOptSelected && (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
