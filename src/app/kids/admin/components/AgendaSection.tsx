'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface GroupAssignment {
  coordinador: string
  maestros: string[]
  auxiliares: string[]
  timoteos: string[]
}

/* Fresh subtle colors for group headers */
const GROUP_HEADER_COLORS: Record<string, { bg: string; text: string; border: string; dot: string; badgeBg: string }> = {
  '4 a 6 años':   { bg: '#f5f3ff', text: '#7e22ce', border: '#e9d5ff', dot: '#a855f7', badgeBg: '#f3e8ff' },
  '7 a 9 años':   { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', dot: '#22c55e', badgeBg: '#dcfce7' },
  '9 años':       { bg: '#fffbeb', text: '#b45309', border: '#fef08a', dot: '#f59e0b', badgeBg: '#fef3c7' },
  'Timoteos':     { bg: '#f0f9ff', text: '#0284c7', border: '#bae6fd', dot: '#0284c7', badgeBg: '#e0f2fe' },
  'PTMD Kids':    { bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe', dot: '#8b5cf6', badgeBg: '#ede9fe' },
  'Áreas de Apoyo': { bg: '#f8fafc', text: '#475569', border: '#e2e8f0', dot: '#64748b', badgeBg: '#f1f5f9' },
}

const DEFAULT_GROUP_HEADER = { bg: '#f8fafc', text: '#475569', border: '#e2e8f0', dot: '#64748b', badgeBg: '#f1f5f9' }

export default function AgendaSection({ servidores = [], isMobile: isMobileProp = false }: { servidores?: any[]; isMobile?: boolean }) {
  const [isMobile, setIsMobile] = useState(isMobileProp)
  const [isCompact, setIsCompact] = useState(false)

  useEffect(() => {
    setIsMobile(isMobileProp)
  }, [isMobileProp])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(max-width: 768px)')
    const handler = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches || isMobileProp)
      setIsCompact(window.innerWidth < 1600)
    }
    setIsMobile(mql.matches || isMobileProp)
    setIsCompact(window.innerWidth < 1600)
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
  const [scheduleMotion, setScheduleMotion] = useState<'idle' | 'leaving' | 'entering'>('idle')
  const scheduleTransitionTimers = useRef<number[]>([])

  
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('agenda_draft_date') || '2026-07-26'
    }
    return '2026-07-26'
  })

  const clearScheduleTransitionTimers = () => {
    scheduleTransitionTimers.current.forEach(timer => window.clearTimeout(timer))
    scheduleTransitionTimers.current = []
  }

  const changeSchedule = (day: string, time: string) => {
    if (day === selectedDia && time === selectedCulto) return

    clearScheduleTransitionTimers()
    setScheduleMotion('leaving')
    const changeTimer = window.setTimeout(() => {
      setSelectedDia(day)
      setSelectedCulto(time)
      setScheduleMotion('entering')
      const settleTimer = window.setTimeout(() => setScheduleMotion('idle'), 420)
      scheduleTransitionTimers.current = [settleTimer]
    }, 180)
    scheduleTransitionTimers.current = [changeTimer]
  }

  useEffect(() => () => clearScheduleTransitionTimers(), [])

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

  const agendaGroupsSummary = gruposEdades.map(grupo => {
    const data = getGroupData(grupo)
    const assigned = [data.coordinador, ...data.maestros, ...data.auxiliares, ...data.timoteos].filter(Boolean).length
    return { grupo, assigned, hasCoordinator: Boolean(data.coordinador) }
  })
  const totalAssignments = agendaGroupsSummary.reduce((total, group) => total + group.assigned, 0)
  const activeGroups = agendaGroupsSummary.filter(group => group.assigned > 0).length
  const readyCoordinators = agendaGroupsSummary.filter(group => group.hasCoordinator).length
  const supportAssignments = areasApoyo.filter(area => areaAssignments[`${selectedDia}_${selectedCulto}_${area}`]).length

  return (
    <div 
      className="no-scrollbar"
      style={{
        display: 'flex', flexDirection: 'column', height: '100%',
        padding: isMobile ? '8px 10px' : isCompact ? '7px 12px' : '8px 14px',
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
      
      {/* Header area */}
      <div style={{ 
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between', 
        alignItems: isMobile ? 'stretch' : 'center', 
        flexWrap: 'wrap', 
        gap: isMobile ? 10 : 6 
      }}>
        <div>
          <h2 className="kids-panel-title" style={{
            fontSize: isMobile ? 16 : isCompact ? 14 : 15, fontWeight: 800, color: '#111827', margin: 0,
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
              width: isCompact ? 26 : 28, height: isCompact ? 26 : 28, borderRadius: '50%',
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
            padding: isCompact ? '2px 7px' : '2.5px 8px', borderRadius: 30,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,1), 0 2px 6px rgba(96,116,147,.08)',
            border: '1px solid rgba(255,255,255,.95)',
            backdropFilter: 'blur(20px) saturate(140%)'
          }}>
            <span style={{ fontSize: isCompact ? 8.5 : 9, fontWeight: 800, color: '#0f172a' }}>{selectedDia}</span>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                border: 'none', background: 'transparent', outline: 'none',
                fontSize: isCompact ? 9 : 9.5, fontWeight: 700, color: '#0284c7', cursor: 'pointer'
              }}
            />
          </div>
        </div>
      </div>

      {/* Botones de días estilo Liquid Glass con listados / desplegables (hover) */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', position: 'relative', zIndex: 30 }}>
        {Object.keys(cultosOpciones).map((dia) => {
          const isCurrentDia = selectedDia === dia
          const isOpen = false
          return (
            <div 
              key={dia} 
              style={{ position: 'relative' }}
            >
              <button
                onClick={() => {
                  changeSchedule(dia, cultosOpciones[dia].includes(selectedCulto) ? selectedCulto : cultosOpciones[dia][0])
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
                          changeSchedule(dia, opcion)
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
                onClick={() => changeSchedule(selectedDia, culto)}
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

      {/* Kanban / grid de asignaciones */}
      <div 
        className="no-scrollbar"
        style={{
          background: 'transparent',
          borderRadius: 0,
          padding: isMobile ? '8px 4px 80px 4px' : '8px 0 40px 0',
          flex: 1,
          overflowY: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <div className={`agenda-board-layout${isMobile ? ' is-mobile' : ''}`}>
          <div className="agenda-board-cards">
          {/* Grupos por Edades */}
          {gruposEdades.map(grupo => {
            const data = getGroupData(grupo)
            const gStyle = GROUP_HEADER_COLORS[grupo] || DEFAULT_GROUP_HEADER
            return (
              <ProgramacionFlipShell
                key={grupo}
                title={grupo}
                isMobile={isMobile}
                scheduleMotion={scheduleMotion}
                accent={gStyle}
                summary={`Programa el turno de ${grupo.toLowerCase()}`}
                note={`${[data.coordinador, ...data.maestros, ...data.auxiliares, ...data.timoteos].filter(Boolean).length} asignaciones activas`}
                frontMeta={[
                  { label: 'Coordinador', value: data.coordinador ? 'Listo' : 'Pendiente' },
                  { label: 'Maestros', value: `${data.maestros.length}` },
                  { label: 'Auxiliares', value: `${data.auxiliares.length}` },
                  { label: 'Timoteos', value: `${data.timoteos.length}` },
                ]}
              >
                {/* Header Fresco Sutil */}
                <div className="agenda-assignment-summary" style={{
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
                <div className="agenda-assignment-section">
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
                <div className="agenda-assignment-section">
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
                            fontSize: 9, background: 'rgba(255,255,255,.88)', color: '#0369a1',
                            padding: '2px 6px', borderRadius: 12, fontWeight: 700,
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            border: '1px solid rgba(56,189,248,.55)',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,1), 0 2px 6px rgba(15,23,42,.05)',
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
                <div className="agenda-assignment-section">
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: isMobile ? 10 : 8.5, color: '#7c3aed', fontWeight: 700 }}>
                      Maestras Auxiliares
                    </span>
                  </div>

                  <GlassSelect 
                    isMobile={isMobile}
                    multiple
                    selectedIds={data.auxiliares}
                    placeholder="Seleccionar maestr@ auxiliar..."
                    options={auxiliaresList
                      .filter(m => data.auxiliares.includes(m.id) || !getAssignedIdsForCurrentSchedule(grupo, 'auxiliares').has(m.id))
                      .map(m => ({ id: m.id, label: `${m.nombre} ${m.apellido}` }))}
                    onSelect={(id) => handleAddPerson(grupo, 'auxiliares', id)}
                    onRemove={(id) => handleRemovePerson(grupo, 'auxiliares', id)}
                  />

                  {/* Selected auxiliares pills */}
                  {data.auxiliares.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                      {data.auxiliares.map(id => {
                        const person = servidores.find(s => s.id === id)
                        if (!person) return null
                        return (
                          <span key={id} style={{
                            fontSize: 9, background: 'rgba(255,255,255,.9)', color: '#5b21b6',
                            padding: '2px 6px', borderRadius: 12, fontWeight: 700,
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            border: '1px solid rgba(167,139,250,.65)',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,1), 0 2px 6px rgba(15,23,42,.05)',
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
                <div className="agenda-assignment-section">
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: isMobile ? 10 : 8.5, color: '#059669', fontWeight: 700 }}>
                      Timoteos
                    </span>
                  </div>

                  <GlassSelect 
                    isMobile={isMobile}
                    multiple
                    selectedIds={data.timoteos}
                    placeholder="Seleccionar timoteo..."
                    options={timoteosList
                      .filter(t => data.timoteos.includes(t.id) || !getAssignedIdsForCurrentSchedule(grupo, 'timoteos').has(t.id))
                      .map(t => ({ id: t.id, label: `${t.nombre} ${t.apellido}` }))}
                    onSelect={(id) => handleAddPerson(grupo, 'timoteos', id)}
                    onRemove={(id) => handleRemovePerson(grupo, 'timoteos', id)}
                  />

                  {/* Selected timoteos pills */}
                  {data.timoteos.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                      {data.timoteos.map(id => {
                        const person = servidores.find(s => s.id === id)
                        if (!person) return null
                        return (
                          <span key={id} style={{
                            fontSize: 9, background: 'rgba(255,255,255,.9)', color: '#047857',
                            padding: '2px 6px', borderRadius: 12, fontWeight: 700,
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            border: '1px solid rgba(52,211,153,.62)',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,1), 0 2px 6px rgba(15,23,42,.05)',
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

              </ProgramacionFlipShell>
            )
          })}

          {/* Card: Áreas de Apoyo (posicionada enseguida de PTMD Kids) */}
          <ProgramacionFlipShell
            key="areas-apoyo"
            title="Áreas de Apoyo"
            isMobile={isMobile}
            scheduleMotion={scheduleMotion}
            accent={DEFAULT_GROUP_HEADER}
            summary="Asignaciones complementarias del servicio"
            note={`${areasApoyo.length} áreas activas`}
            frontMeta={[
              { label: 'Consolidación', value: areaAssignments[`${selectedDia}_${selectedCulto}_Consolidación`] ? 'Asignado' : 'Libre' },
              { label: 'Disciplina', value: areaAssignments[`${selectedDia}_${selectedCulto}_Disciplina`] ? 'Asignado' : 'Libre' },
            ]}
          >
            {areasApoyo.map(area => (
              <div key={area} className="agenda-assignment-section">
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
          </ProgramacionFlipShell>

          </div>
          <AgendaSummaryCard
            day={selectedDia}
            time={selectedCulto}
            date={selectedDate}
            totalAssignments={totalAssignments}
            activeGroups={activeGroups}
            readyCoordinators={readyCoordinators}
            supportAssignments={supportAssignments}
            scheduleMotion={scheduleMotion}
          />
        </div>
      </div>
    </div>
  )
}

function AgendaSummaryCard({
  day,
  time,
  date,
  totalAssignments,
  activeGroups,
  readyCoordinators,
  supportAssignments,
  scheduleMotion,
}: {
  day: string
  time: string
  date: string
  totalAssignments: number
  activeGroups: number
  readyCoordinators: number
  supportAssignments: number
  scheduleMotion: 'idle' | 'leaving' | 'entering'
}) {
  const formattedDate = new Date(`${date}T12:00:00`).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
  const completion = Math.round(((readyCoordinators + activeGroups) / 10) * 100)

  return (
    <aside className={`agenda-summary-card agenda-info-transition is-${scheduleMotion} lgx-content-card lgx-content-card--static`} aria-label="Resumen de la agenda">
      <div className="agenda-summary-card__glow" />
      <div className="agenda-summary-card__header">
        <div className="agenda-summary-card__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="3" />
            <path d="M8 3v4M16 3v4M3 10h18M8 14h3M8 18h7" />
          </svg>
        </div>
        <div>
          <div className="agenda-summary-card__eyebrow">Vista del turno</div>
          <h3>Resumen de agenda</h3>
        </div>
      </div>

      <div className="agenda-summary-card__schedule">
        <span>{day}</span>
        <strong>{time}</strong>
        <small>{formattedDate}</small>
      </div>

      <div className="agenda-summary-card__progress" aria-label={`${completion}% de preparación`}>
        <div className="agenda-summary-card__progress-label"><span>Preparación</span><strong>{completion}%</strong></div>
        <div className="agenda-summary-card__progress-track"><span style={{ width: `${completion}%` }} /></div>
      </div>

      <div className="agenda-summary-card__metrics">
        <div><strong>{totalAssignments}</strong><span>Asignaciones</span></div>
        <div><strong>{activeGroups}/5</strong><span>Grupos activos</span></div>
        <div><strong>{readyCoordinators}/5</strong><span>Coordinadores</span></div>
      </div>

      <div className="agenda-summary-card__footer">
        <span className={supportAssignments === 2 ? 'is-ready' : ''}>{supportAssignments}/2</span>
        <p>Áreas de apoyo asignadas</p>
      </div>
    </aside>
  )
}

function ProgramacionFlipShell({
  title,
  accent,
  summary,
  note,
  frontMeta,
  isMobile = false,
  scheduleMotion = 'idle',
  children,
}: {
  title: string
  accent: { bg: string; text: string; border: string; dot: string; badgeBg?: string }
  summary: string
  note: string
  frontMeta: { label: string; value: string }[]
  isMobile?: boolean
  scheduleMotion?: 'idle' | 'leaving' | 'entering'
  children: React.ReactNode
}) {
  const [flipped, setFlipped] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [closingExpanded, setClosingExpanded] = useState(false)
  const [aladdinOrigin, setAladdinOrigin] = useState<Record<string, string>>({})
  const cardRef = useRef<HTMLDivElement>(null)
  const panelHeight = isMobile ? 378 : 420
  const frontHeight = Math.round(panelHeight * 0.52)
  const [coordinadorMeta, ...restMeta] = frontMeta
  const contentNodes = React.Children.toArray(children)
  const firstContentNode = contentNodes[0]
  const hasAssignmentHeader = React.isValidElement<{ className?: string }>(firstContentNode)
    && firstContentNode.props.className === 'agenda-assignment-summary'
  const assignmentHeader = hasAssignmentHeader ? firstContentNode : null
  const assignmentFields = hasAssignmentHeader ? contentNodes.slice(1) : contentNodes

  function openExpanded() {
    const rect = cardRef.current?.getBoundingClientRect()
    if (!rect) return

    const modalWidth = Math.min(window.innerWidth * .88, 560)
    const modalHeight = Math.min(window.innerHeight * .86, 680)
    setAladdinOrigin({
      '--server-origin-x': `${rect.left + rect.width / 2 - window.innerWidth / 2}px`,
      '--server-origin-y': `${rect.top + rect.height / 2 - window.innerHeight / 2}px`,
      '--server-scale-x': `${Math.max(.1, rect.width / modalWidth)}`,
      '--server-scale-y': `${Math.max(.1, rect.height / modalHeight)}`,
    })
    setClosingExpanded(false)
    setExpanded(true)
  }

  function closeExpanded() {
    if (closingExpanded) return
    setClosingExpanded(true)
    window.setTimeout(() => {
      setExpanded(false)
      setClosingExpanded(false)
      setFlipped(false)
    }, 500)
  }

  return (
    <>
    <div
      ref={cardRef}
      onClick={openExpanded}
      style={{
        perspective: 1200,
        minHeight: frontHeight,
        height: frontHeight,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          minHeight: flipped ? panelHeight : frontHeight,
          height: '100%',
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          transition: 'transform .68s cubic-bezier(.2,.9,.18,1)',
          borderRadius: 20,
        }}
      >
        {/* Front side of Card */}
        <div
          className={`lgx-content-card lgx-content-card--static agenda-program-card agenda-info-transition is-${scheduleMotion}`}
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            borderRadius: 20,
            overflow: 'hidden',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            padding: isMobile ? 12 : 14,
            gap: 8,
            justifyContent: 'space-between',
            background: '#ffffff',
            border: '1px solid rgba(226, 232, 240, 0.85)',
            boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.06), 0 2px 6px rgba(0, 0, 0, 0.03)',
            opacity: 1,
            transition: 'opacity .34s ease, box-shadow .35s ease',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: accent.badgeBg || '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: accent.dot }} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: isMobile ? 14.5 : 14, color: '#172033', fontWeight: 800, letterSpacing: '-0.3px' }}>
                  {title}
                </h3>
                <p style={{ margin: 0, fontSize: 9.5, color: '#52637a', fontWeight: 600 }}>
                  Toca para programar
                </p>
              </div>
            </div>
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              color: accent.text,
              background: accent.badgeBg || '#f1f5f9',
              borderRadius: 999,
              padding: '3px 9px',
            }}>
              Programación
            </div>
          </div>

          {/* Title & Subtitle */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 8,
            padding: '2px 0 0',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ fontSize: isMobile ? 13.5 : 13, fontWeight: 800, color: '#172033', letterSpacing: '-0.3px', lineHeight: 1.15 }}>
                {summary}
              </div>
              <div style={{ fontSize: 10, color: accent.text, fontWeight: 600, opacity: .9 }}>
                {note}
              </div>
            </div>

            {/* Role status cards with SVG icons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {/* Coordinador Box (if age group card) */}
              {coordinadorMeta && (
                <div style={{
                  padding: '8px 4px',
                  borderTop: '1px solid rgba(100,116,139,.16)',
                  borderBottom: '1px solid rgba(100,116,139,.16)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: accent.badgeBg || '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: accent.text,
                    flexShrink: 0,
                  }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 9.5, color: '#52637a', fontWeight: 650 }}>
                      {coordinadorMeta.label}
                    </div>
                    <div style={{
                      fontSize: 11.5,
                      fontWeight: 800,
                      color: coordinadorMeta.value === 'Listo' || (coordinadorMeta.value !== 'Pendiente' && coordinadorMeta.value !== 'Libre') ? '#15803d' : '#b85c00'
                    }}>
                      {coordinadorMeta.value}
                    </div>
                  </div>
                </div>
              )}

              {/* Roles Grid (Maestros, Auxiliares, Timoteos) or Áreas de Apoyo */}
              {title !== 'Áreas de Apoyo' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                  {restMeta.map((item, index) => {
                    let iconEl = null;
                    if (item.label === 'Maestros') {
                      iconEl = (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                          <path d="M6 12v5c3 3 9 3 12 0v-5" />
                        </svg>
                      );
                    } else if (item.label === 'Auxiliares') {
                      iconEl = (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="8.5" cy="7" r="4" />
                          <polyline points="17 11 19 13 23 9" />
                        </svg>
                      );
                    } else {
                      iconEl = (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="7" r="4" />
                          <path d="M12 14c-4.42 0-8 1.79-8 4v2h16v-2c0-2.21-3.58-4-8-4z" />
                        </svg>
                      );
                    }

                    return (
                      <div key={item.label} style={{
                        padding: '4px 8px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 2,
                        borderLeft: index === 0 ? '0' : '1px solid rgba(100,116,139,.16)',
                      }}>
                        <div style={{
                          width: 20,
                          height: 20,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: accent.text,
                          flexShrink: 0,
                        }}>
                          {iconEl}
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 9, color: '#52637a', fontWeight: 650, lineHeight: 1.1 }}>
                            {item.label}
                          </div>
                          <div style={{ fontSize: 13, color: item.value !== '0' ? accent.text : '#334155', fontWeight: 800, lineHeight: 1.15 }}>
                            {item.value}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Áreas de Apoyo stacked layout */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {frontMeta.map((item) => (
                    <div key={item.label} style={{
                      borderRadius: 14,
                      padding: '7px 10px',
                      background: '#f8fafc',
                      border: '1px solid #f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}>
                      <div style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: '#f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#475569',
                        flexShrink: 0,
                      }}>
                        {item.label === 'Consolidación' ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: 9.5, color: '#64748b', fontWeight: 600 }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: 11.5, color: item.value === 'Libre' ? '#334155' : '#0284c7', fontWeight: 800 }}>
                          {item.value}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Back side of Card (Edit Mode) */}
        <div
          className="lgx-content-card lgx-content-card--static"
          inert
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            borderRadius: 20,
            overflow: 'hidden',
            cursor: 'default',
            display: 'flex',
            flexDirection: 'column',
            padding: 10,
            gap: 8,
            background: '#ffffff',
            border: '1px solid rgba(226, 232, 240, 0.85)',
            boxShadow: '0 10px 28px -4px rgba(0, 0, 0, 0.08)',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            paddingBottom: 4,
            borderBottom: '1px solid #f1f5f9',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: accent.badgeBg || '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: accent.dot }} />
              </div>
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: '#1e293b', letterSpacing: '-0.25px' }}>
                  {title}
                </div>
                <div style={{ fontSize: 9, color: '#64748b', fontWeight: 500 }}>
                  Ajusta los responsables y asignaciones
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFlipped(false)}
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                color: '#334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {children}
          </div>
        </div>
      </div>
    </div>
    {expanded && typeof document !== 'undefined' && createPortal(
      <div
        className={`server-aladdin-backdrop agenda-aladdin-backdrop ${closingExpanded ? 'is-closing' : 'is-opening'}`}
        onClick={closeExpanded}
        role="presentation"
      >
        <section
          className={`server-aladdin-modal agenda-aladdin-modal ${closingExpanded ? 'is-closing' : 'is-opening'}`}
          style={aladdinOrigin as React.CSSProperties}
          onClick={event => event.stopPropagation()}
          aria-label={`Programación de ${title}`}
        >
          <div className="server-aladdin-modal__shine" />
          <header className="agenda-aladdin-modal__header">
            {assignmentHeader && <div className="agenda-aladdin-modal__group-header">{assignmentHeader}</div>}
            <div className="agenda-aladdin-modal__legacy-header" style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
              <div style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: accent.badgeBg || '#f1f5f9',
                display: 'grid',
                placeItems: 'center',
                flex: '0 0 auto',
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: accent.dot }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="agenda-aladdin-modal__eyebrow">Programación de agenda</div>
              </div>
            </div>
            <button type="button" onClick={closeExpanded} className="agenda-aladdin-modal__close" aria-label="Cerrar programación">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </header>
          <div className={`agenda-aladdin-modal__content${hasAssignmentHeader ? ' agenda-assignment-grid' : ''}`}>
            {assignmentFields}
          </div>
        </section>
      </div>,
      document.body,
    )}
    </>
  )
}

/* Custom Liquid Glass Select Component */
function GlassSelect({
  placeholder,
  options,
  value,
  onSelect,
  multiple = false,
  selectedIds = [],
  onRemove,
  isMobile = false
}: {
  placeholder: string
  options: { id: string; label: string }[]
  value?: string
  onSelect: (id: string) => void
  multiple?: boolean
  selectedIds?: string[]
  onRemove?: (id: string) => void
  isMobile?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [openUp, setOpenUp] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selectedOption = options.find(o => o.id === value)
  const displayText = multiple && selectedIds.length > 0
    ? `${selectedIds.length} ${selectedIds.length === 1 ? 'seleccionado' : 'seleccionados'}`
    : selectedOption ? selectedOption.label : placeholder

  return (
    <div
      className="agenda-glass-select"
      ref={ref}
      style={{ position: 'relative', width: '100%' }}
      onClick={(e) => e.stopPropagation()}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="agenda-glass-select__trigger"
        onClick={() => {
          if (!open && ref.current) {
            const rect = ref.current.getBoundingClientRect()
            setOpenUp(window.innerHeight - rect.bottom < 210)
          }
          setOpen(prev => !prev)
        }}
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
          <div className="agenda-glass-select__menu" style={{
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
            animation: 'agenda-select-reveal .34s cubic-bezier(.16, 1, .3, 1) both'
          }}>
            {options.map((opt, index) => {
              const isOptSelected = multiple ? selectedIds.includes(opt.id) : opt.id === value
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    if (multiple) {
                      if (isOptSelected) onRemove?.(opt.id)
                      else onSelect(opt.id)
                    } else {
                      onSelect(opt.id)
                      setOpen(false)
                    }
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
                    transition: 'transform .2s cubic-bezier(.16, 1, .3, 1), background .2s ease, box-shadow .2s ease',
                    animation: `agenda-select-option-in .28s ${Math.min(index, 7) * 32}ms cubic-bezier(.16, 1, .3, 1) both`,
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



