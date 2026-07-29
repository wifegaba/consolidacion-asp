'use client'

import { useEffect, useRef, useState } from 'react'
import { LiquidGlassSweepTransition } from '@kids/liquid-glass-ui'
import type { KidsServidor } from './ServidorModal'

interface Props {
  servidores: KidsServidor[]
}

const GROUPS = Array.from({ length: 6 }, (_, index) => ({
  number: index + 1,
  name: `Grupo ${index + 1}`,
}))

const GROUP_ACCENTS = [
  ['#6757e8', '#9d8cff'],
  ['#0f9b8e', '#42d3bd'],
  ['#1688d4', '#58c2ff'],
  ['#d46c18', '#ffad55'],
  ['#c33d8e', '#f47fc6'],
  ['#53647f', '#91a3c1'],
] as const

function isTimoteosCoordinator(servidor: KidsServidor) {
  return servidor.activo !== false && servidor.roles?.some(
    role => role.replace(/_/g, ' ').trim().toUpperCase() === 'COORDINADOR DE TIMOTEOS',
  )
}

function isTimoteoMember(servidor: KidsServidor) {
  return servidor.activo !== false && servidor.roles?.some(
    role => role.replace(/_/g, ' ').trim().toUpperCase() === 'TIMOTEOS',
  )
}

function assignedGroupNumber(servidor: KidsServidor) {
  const assignedGroup =
    servidor.grupo_timoteos_asignado
    ?? servidor.grupo_asignado
    ?? servidor.grupo
    ?? ''
  const match = assignedGroup.match(/\b([1-6])\b/)
  if (match) return Number(match[1])

  // La primera ficha importada corresponde íntegramente al Grupo 1. Este
  // respaldo también corrige registros creados antes de guardar el grupo.
  return isTimoteoMember(servidor) ? 1 : null
}

function displayName(servidor: KidsServidor) {
  return `${servidor.nombre} ${servidor.apellido}`.trim()
}

function initials(servidor: KidsServidor) {
  return `${servidor.nombre?.[0] ?? ''}${servidor.apellido?.[0] ?? ''}`.toUpperCase()
}

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .trim()
}

type FocusPhase =
  | 'idle'
  | 'expanding'
  | 'open'
  | 'closing'

const DESKTOP_TIMOTEO_PAGE_SIZE = 6
const MOBILE_TIMOTEO_PAGE_SIZE = 4

interface FocusGeometry {
  left: number
  top: number
  width: number
  height: number
  fromX: number
  fromY: number
  scaleX: number
  scaleY: number
}

function Portrait({
  servidor,
  index,
  accent,
}: {
  servidor: KidsServidor
  index: number
  accent: readonly [string, string]
}) {
  return (
    <div
      className="timoteos-portrait"
      style={{
        zIndex: 5 - index,
        marginLeft: index === 0 ? 0 : -14,
        background: servidor.foto_url
          ? 'rgba(255,255,255,.9)'
          : `linear-gradient(145deg, ${accent[0]}, ${accent[1]})`,
      }}
      title={displayName(servidor)}
    >
      {servidor.foto_url ? (
        <img src={servidor.foto_url} alt={displayName(servidor)} />
      ) : (
        <span>{initials(servidor)}</span>
      )}
    </div>
  )
}

export default function TimoteosSection({ servidores }: Props) {
  const sectionRef = useRef<HTMLElement>(null)
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [selectedGroupNumber, setSelectedGroupNumber] = useState<number | null>(null)
  const [focusPhase, setFocusPhase] = useState<FocusPhase>('idle')
  const [focusGeometry, setFocusGeometry] = useState<FocusGeometry | null>(null)
  const [hasInteracted, setHasInteracted] = useState(false)
  const [memberPage, setMemberPage] = useState(1)
  const [memberPageSize, setMemberPageSize] = useState(DESKTOP_TIMOTEO_PAGE_SIZE)
  const [memberSearch, setMemberSearch] = useState('')

  const coordinadores = servidores.filter(isTimoteosCoordinator)
  const timoteos = servidores.filter(isTimoteoMember)
  const grouped = GROUPS.map(group => ({
    ...group,
    coordinadores: coordinadores.filter(
      servidor => assignedGroupNumber(servidor) === group.number,
    ),
    timoteos: timoteos.filter(
      servidor => assignedGroupNumber(servidor) === group.number,
    ),
  }))
  const coveredGroups = grouped.filter(group => group.coordinadores.length > 0).length
  const selectedGroup = grouped.find(group => group.number === selectedGroupNumber) ?? null
  const focusActive = focusPhase !== 'idle'
  const normalizedMemberSearch = normalizeSearchText(memberSearch)
  const filteredTimoteos = selectedGroup?.timoteos.filter(servidor => {
    if (!normalizedMemberSearch) return true
    return normalizeSearchText([
      displayName(servidor),
      servidor.telefono ?? '',
      servidor.cumpleanos ?? '',
    ].join(' ')).includes(normalizedMemberSearch)
  }) ?? []
  const memberPageCount = Math.max(
    1,
    Math.ceil(filteredTimoteos.length / memberPageSize),
  )
  const visibleTimoteos = filteredTimoteos.slice(
    (memberPage - 1) * memberPageSize,
    memberPage * memberPageSize,
  )

  useEffect(() => () => {
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current)
  }, [])

  useEffect(() => {
    setMemberPage(1)
    setMemberSearch('')
  }, [selectedGroupNumber])

  useEffect(() => {
    setMemberPage(1)
  }, [memberSearch])

  useEffect(() => {
    const compactViewport = window.matchMedia('(max-width: 720px)')
    const syncPageSize = () => {
      setMemberPageSize(
        compactViewport.matches
          ? MOBILE_TIMOTEO_PAGE_SIZE
          : DESKTOP_TIMOTEO_PAGE_SIZE,
      )
    }

    syncPageSize()
    compactViewport.addEventListener('change', syncPageSize)
    return () => compactViewport.removeEventListener('change', syncPageSize)
  }, [])

  useEffect(() => {
    setMemberPage(current => Math.min(current, memberPageCount))
  }, [memberPageCount])

  const scheduleLabels = (servidor: KidsServidor) => {
    const labels = [
      servidor.disponibilidad_domingo_7 && '7:00 AM',
      servidor.disponibilidad_domingo_9 && '9:00 AM',
      servidor.disponibilidad_domingo_11 && '11:00 AM',
    ].filter(Boolean) as string[]
    if (labels.length === 0 && servidor.horario_servicio) labels.push(servidor.horario_servicio)
    return labels
  }

  const openGroup = (
    groupNumber: number,
    card: HTMLElement,
  ) => {
    if (focusPhase !== 'idle' || !sectionRef.current) return

    const source = card.getBoundingClientRect()
    const section = sectionRef.current.getBoundingClientRect()
    const inset = window.innerWidth <= 720 ? 10 : 16
    const target = {
      left: inset,
      top: inset,
      width: Math.max(0, section.width - inset * 2),
      height: Math.max(0, section.height - inset * 2),
    }

    setSelectedGroupNumber(groupNumber)
    setHasInteracted(true)
    setFocusGeometry({
      ...target,
      fromX: source.left - section.left - target.left,
      fromY: source.top - section.top - target.top,
      scaleX: source.width / target.width,
      scaleY: source.height / target.height,
    })
    setFocusPhase('expanding')
    transitionTimerRef.current = setTimeout(() => setFocusPhase('open'), 880)
  }

  const closeGroup = () => {
    if (!focusActive || focusPhase === 'closing') return
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current)
    setFocusPhase('closing')
    transitionTimerRef.current = setTimeout(() => {
      setFocusPhase('idle')
      setSelectedGroupNumber(null)
      setFocusGeometry(null)
    }, 820)
  }

  return (
    <section
      ref={sectionRef}
      className={`timoteos-section ${focusActive ? 'has-focused-group' : ''} ${hasInteracted ? 'has-interacted' : ''}`}
      aria-labelledby="timoteos-title"
    >
      <style>{`
        @keyframes timoteosCardArrival {
          0% {
            opacity: 0;
            transform: translate3d(38px, 6px, 0) scale(.975);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }
        @keyframes timoteosSweepAway {
          0% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate3d(104vw, -5px, 0) scale(.965);
          }
        }
        @keyframes timoteosSweepBack {
          0% {
            opacity: 0;
            transform: translate3d(104vw, -5px, 0) scale(.965);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }
        @keyframes timoteosFocusExpand {
          0% {
            transform:
              translate3d(var(--focus-from-x), var(--focus-from-y), 0)
              scale(var(--focus-scale-x), var(--focus-scale-y));
          }
          100% {
            transform: translate3d(0, 0, 0) scale(1);
          }
        }
        @keyframes timoteosFocusCollapse {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          100% {
            transform:
              translate3d(var(--focus-from-x), var(--focus-from-y), 0)
              scale(var(--focus-scale-x), var(--focus-scale-y));
          }
        }
        @keyframes timoteosDetailReveal {
          0% {
            opacity: 0;
            transform: translate3d(-18px, 0, 0);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }
        @keyframes timoteosRowReveal {
          0% {
            opacity: 0;
            transform: translate3d(-30px, 8px, 0) scale(.985);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }
        .timoteos-section {
          position: relative;
          isolation: isolate;
          flex: 1;
          min-height: 0;
          overflow: auto;
          padding: clamp(18px, 2.2vw, 34px);
          color: #111a31;
          scrollbar-width: thin;
          scrollbar-color: rgba(64,78,112,.3) transparent;
        }
        .timoteos-section.has-focused-group {
          overflow: hidden;
        }
        .timoteos-section.has-focused-group .timoteos-header {
          opacity: 0;
          transform: translate3d(0, -18px, 0);
          transition: opacity .28s ease, transform .5s cubic-bezier(.16,1,.3,1);
        }
        .timoteos-section:not(.has-focused-group) .timoteos-header {
          opacity: 1;
          transform: translate3d(0, 0, 0);
          transition: opacity .32s .18s ease, transform .55s .12s cubic-bezier(.16,1,.3,1);
        }
        .timoteos-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: clamp(18px, 2vw, 28px);
        }
        .timoteos-eyebrow {
          margin: 0 0 5px;
          color: #0d817c;
          font-size: clamp(.66rem, .8vw, .76rem);
          font-weight: 850;
          letter-spacing: .19em;
          text-transform: uppercase;
        }
        .timoteos-title {
          margin: 0;
          font-size: clamp(1.65rem, 2.6vw, 2.65rem);
          line-height: 1;
          letter-spacing: -.055em;
        }
        .timoteos-subtitle {
          margin: 8px 0 0;
          color: #60708b;
          font-size: clamp(.76rem, 1vw, .94rem);
        }
        .timoteos-summary {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          border: 1px solid rgba(255,255,255,.7);
          border-radius: 999px;
          background: rgba(244,249,255,.52);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.92),
            0 9px 28px rgba(45,59,92,.1);
          backdrop-filter: blur(22px) saturate(145%);
        }
        .timoteos-summary-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #24bca9;
          box-shadow: 0 0 0 5px rgba(36,188,169,.12);
        }
        .timoteos-summary strong {
          font-size: .78rem;
        }
        .timoteos-summary span {
          color: #748098;
          font-size: .7rem;
        }
        .timoteos-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr));
          gap: clamp(12px, 1.45vw, 20px);
        }
        .timoteos-group-card {
          position: relative;
          min-height: 142px;
          display: grid;
          grid-template-columns: 148px minmax(0, 1fr) auto;
          align-items: center;
          gap: clamp(12px, 1.4vw, 20px);
          overflow: hidden;
          padding: clamp(15px, 1.65vw, 22px);
          border: 1px solid rgba(255,255,255,.76);
          border-radius: clamp(22px, 2vw, 28px);
          background:
            radial-gradient(circle at 12% 4%, rgba(255,255,255,.96), transparent 34%),
            linear-gradient(125deg, rgba(255,255,255,.86), rgba(247,250,255,.64) 55%, rgba(255,255,255,.5));
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.96),
            inset 0 -1px 0 rgba(255,255,255,.5),
            0 18px 46px rgba(44,56,94,.15),
            0 2px 8px rgba(32,42,72,.06);
          backdrop-filter: blur(30px) saturate(135%);
          -webkit-backdrop-filter: blur(30px) saturate(135%);
          animation: timoteosCardArrival .58s cubic-bezier(.16,1,.3,1) both;
          animation-delay: calc(var(--card-index) * 48ms);
          will-change: transform, opacity;
          transition:
            transform .42s cubic-bezier(.16,1,.3,1),
            box-shadow .42s ease,
            border-color .42s ease;
          cursor: pointer;
          user-select: none;
        }
        .timoteos-group-card:focus-visible {
          outline: 3px solid color-mix(in srgb, var(--accent-a) 64%, white);
          outline-offset: 4px;
        }
        .timoteos-section.has-interacted .timoteos-grid:not(.is-departing):not(.is-returning) .timoteos-group-card {
          animation: none;
        }
        .timoteos-grid.is-departing .timoteos-group-card:not(.is-source) {
          animation: timoteosSweepAway .68s cubic-bezier(.4,0,.2,1) both;
          animation-delay: calc(var(--sweep-order) * 14ms);
          backdrop-filter: none;
          -webkit-backdrop-filter: none;
          box-shadow: 0 12px 30px rgba(44,56,94,.12);
          pointer-events: none;
        }
        .timoteos-grid.is-departing .timoteos-group-card.is-source {
          animation: none !important;
          opacity: 0;
          pointer-events: none;
          transition: opacity .1s linear;
        }
        .timoteos-grid.is-returning .timoteos-group-card:not(.is-source) {
          animation: timoteosSweepBack .72s cubic-bezier(.16,1,.3,1) both;
          animation-delay: calc((5 - var(--sweep-order)) * 12ms);
          backdrop-filter: none;
          -webkit-backdrop-filter: none;
          box-shadow: 0 12px 30px rgba(44,56,94,.12);
          pointer-events: none;
        }
        .timoteos-grid.is-returning .timoteos-group-card.is-source {
          animation: none !important;
          opacity: 0;
          pointer-events: none;
        }
        .timoteos-group-card::before {
          content: '';
          position: absolute;
          inset: 0 auto 0 0;
          width: 4px;
          background: linear-gradient(180deg, var(--accent-a), var(--accent-b));
          box-shadow: 0 0 22px color-mix(in srgb, var(--accent-a) 50%, transparent);
        }
        .timoteos-group-card::after {
          content: '';
          position: absolute;
          inset: 1px;
          border-radius: inherit;
          pointer-events: none;
          background:
            linear-gradient(145deg, rgba(255,255,255,.44), transparent 34%, transparent 72%, rgba(255,255,255,.18));
          opacity: .7;
        }
        .timoteos-group-card:hover {
          transform: translateY(-4px) scale(1.008);
          border-color: rgba(255,255,255,.98);
          box-shadow:
            inset 0 1px 0 #fff,
            0 24px 58px rgba(44,56,94,.18),
            0 4px 12px rgba(32,42,72,.07);
        }
        .timoteos-portrait-stack {
          min-width: 138px;
          display: flex;
          align-items: center;
          padding-left: 5px;
        }
        .timoteos-portrait {
          width: 76px;
          height: 76px;
          flex: 0 0 76px;
          display: grid;
          place-items: center;
          overflow: hidden;
          border: 4px solid rgba(255,255,255,.98);
          border-radius: 50%;
          box-shadow:
            0 12px 28px rgba(29,44,76,.2),
            0 0 0 1px color-mix(in srgb, var(--accent-a) 42%, transparent),
            0 0 0 6px rgba(255,255,255,.2);
          color: white;
          font-size: 1.08rem;
          font-weight: 850;
        }
        .timoteos-portrait img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          object-position: center 14%;
          filter: saturate(.96) contrast(1.02);
        }
        .timoteos-empty-portraits {
          display: flex;
          align-items: center;
        }
        .timoteos-empty-portrait {
          width: 70px;
          height: 70px;
          display: grid;
          place-items: center;
          border: 1px dashed rgba(91,106,139,.28);
          border-radius: 50%;
          background: rgba(255,255,255,.48);
          color: #8e9ab0;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.9);
        }
        .timoteos-empty-portrait + .timoteos-empty-portrait {
          margin-left: -16px;
        }
        .timoteos-card-copy {
          min-width: 0;
        }
        .timoteos-group-kicker {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 5px;
          color: var(--accent-a);
          font-size: .65rem;
          font-weight: 850;
          letter-spacing: .12em;
          text-transform: uppercase;
        }
        .timoteos-group-kicker::before {
          content: '';
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--accent-a);
          box-shadow: 0 0 0 5px color-mix(in srgb, var(--accent-a) 12%, transparent);
        }
        .timoteos-group-name {
          margin: 0;
          overflow: hidden;
          color: #172038;
          font-size: clamp(1.08rem, 1.55vw, 1.42rem);
          line-height: 1.1;
          letter-spacing: -.035em;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .timoteos-teacher-names {
          margin: 8px 0 0;
          overflow: hidden;
          color: #64718a;
          font-size: .75rem;
          line-height: 1.35;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .timoteos-card-count {
          min-width: 62px;
          padding: 10px 9px;
          border: 1px solid rgba(255,255,255,.72);
          border-radius: 18px;
          background: rgba(255,255,255,.43);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.9);
          text-align: center;
        }
        .timoteos-card-count strong {
          display: block;
          color: var(--accent-a);
          font-size: 1.35rem;
          line-height: 1;
        }
        .timoteos-card-count span {
          display: block;
          margin-top: 4px;
          color: #748098;
          font-size: .58rem;
          font-weight: 750;
          letter-spacing: .04em;
          text-transform: uppercase;
        }
        .timoteos-focus-scrim {
          position: absolute;
          inset: 0;
          z-index: 129;
          border: 0;
          background: rgba(18,27,50,.24);
          animation: timoteosDetailReveal .24s ease-out both;
          cursor: default;
        }
        .timoteos-focus-card {
          position: absolute;
          z-index: 130;
          display: flex;
          min-width: 0;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.88);
          border-radius: 32px;
          background:
            radial-gradient(ellipse 62% 74% at 1% 104%, color-mix(in srgb, var(--accent-a) 19%, transparent), transparent 72%),
            radial-gradient(ellipse 58% 64% at 101% -7%, rgba(56,213,207,.17), transparent 68%),
            radial-gradient(ellipse 92% 48% at 50% 42%, rgba(255,255,255,.4), transparent 74%),
            linear-gradient(138deg, rgba(249,250,255,.74), rgba(225,234,250,.5) 48%, rgba(229,251,248,.46));
          box-shadow:
            inset 0 1px 0 #fff,
            inset 0 -1px 0 rgba(255,255,255,.48),
            inset 16px 0 34px rgba(255,255,255,.12),
            0 42px 110px rgba(18,29,62,.26),
            0 8px 30px color-mix(in srgb, var(--accent-a) 12%, transparent);
          transform-origin: top left;
          will-change: transform;
          contain: layout paint;
          backface-visibility: hidden;
        }
        .timoteos-focus-card.is-expanding {
          animation: timoteosFocusExpand .88s cubic-bezier(.22,.72,.18,1) both;
        }
        .timoteos-focus-card.is-closing {
          animation: timoteosFocusCollapse .82s cubic-bezier(.4,0,.24,1) both;
          pointer-events: none;
        }
        .timoteos-focus-card.is-open {
          backdrop-filter: blur(24px) saturate(142%);
          -webkit-backdrop-filter: blur(24px) saturate(142%);
          will-change: auto;
        }
        .timoteos-focus-card::before {
          content: '';
          position: absolute;
          inset: 0 auto 0 0;
          width: 5px;
          background: linear-gradient(180deg, var(--accent-a), var(--accent-b));
          box-shadow: 0 0 30px color-mix(in srgb, var(--accent-a) 34%, transparent);
        }
        .timoteos-focus-card::after {
          content: '';
          position: absolute;
          inset: 1px;
          z-index: 1;
          border-radius: 31px;
          pointer-events: none;
          background:
            linear-gradient(112deg, rgba(255,255,255,.64), transparent 15% 78%, rgba(255,255,255,.25)),
            radial-gradient(ellipse at 50% -14%, rgba(255,255,255,.72), transparent 34%);
          mask: linear-gradient(#000, transparent 30%);
          opacity: .52;
        }
        .timoteos-focus-preview {
          position: absolute;
          inset: 0;
          z-index: 2;
          display: grid;
          grid-template-columns: minmax(130px, .72fr) minmax(0, 1.55fr) auto;
          align-items: center;
          gap: 22px;
          padding: clamp(20px, 3vw, 42px);
          opacity: 1;
        }
        .timoteos-focus-preview .timoteos-portrait-stack {
          visibility: hidden;
          opacity: 0;
        }
        .timoteos-focus-content {
          position: relative;
          z-index: 2;
          min-height: 0;
          display: flex;
          flex: 1;
          flex-direction: column;
          padding: clamp(12px, 1.35vw, 18px);
          opacity: 0;
          overflow: hidden;
          pointer-events: none;
        }
        .timoteos-detail-header {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          min-height: 40px;
          padding: 7px 10px;
          border: 1px solid rgba(255,255,255,.72);
          border-radius: 17px;
          background:
            radial-gradient(circle at 6% 20%, color-mix(in srgb, var(--accent-a) 18%, transparent), transparent 38%),
            radial-gradient(circle at 96% 15%, rgba(37,195,190,.15), transparent 42%),
            linear-gradient(108deg, rgba(244,241,255,.62), rgba(228,246,249,.52));
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.92),
            inset 0 -1px 0 rgba(255,255,255,.28),
            0 8px 24px rgba(43,57,91,.08);
          backdrop-filter: blur(22px) saturate(145%);
          -webkit-backdrop-filter: blur(22px) saturate(145%);
        }
        .timoteos-detail-header > div:first-child {
          min-width: 0;
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 5px 13px;
        }
        .timoteos-detail-search {
          width: clamp(170px, 22vw, 300px);
          height: 32px;
          display: flex;
          flex: 0 1 auto;
          align-items: center;
          gap: 8px;
          margin-left: auto;
          padding: 0 11px;
          border: 1px solid rgba(255,255,255,.82);
          border-radius: 999px;
          background:
            linear-gradient(112deg, rgba(255,255,255,.68), rgba(235,242,251,.54));
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.96),
            inset 0 -1px 0 rgba(107,121,151,.08),
            0 7px 20px rgba(37,51,82,.07);
          color: #718097;
          transition:
            border-color .24s ease,
            box-shadow .24s ease,
            background .24s ease;
        }
        .timoteos-detail-search:focus-within {
          border-color: color-mix(in srgb, var(--accent-a) 36%, white);
          background: rgba(255,255,255,.78);
          box-shadow:
            inset 0 1px 0 #fff,
            0 0 0 3px color-mix(in srgb, var(--accent-a) 10%, transparent),
            0 10px 24px rgba(37,51,82,.09);
        }
        .timoteos-detail-search svg {
          flex: 0 0 auto;
          color: var(--accent-a);
        }
        .timoteos-detail-search input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: #172038;
          font: inherit;
          font-size: .66rem;
          font-weight: 650;
        }
        .timoteos-detail-search input::placeholder {
          color: #8a95aa;
          font-weight: 560;
        }
        .timoteos-search-clear {
          width: 20px;
          height: 20px;
          display: grid;
          flex: 0 0 20px;
          place-items: center;
          border: 0;
          border-radius: 50%;
          background: rgba(102,115,145,.12);
          color: #66728a;
          cursor: pointer;
        }
        .timoteos-detail-eyebrow {
          display: flex;
          align-items: center;
          gap: 7px;
          margin: 0;
          color: var(--accent-a);
          font-size: .58rem;
          font-weight: 850;
          letter-spacing: .16em;
          text-transform: uppercase;
        }
        .timoteos-detail-eyebrow i {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--accent-a);
          box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent-a) 12%, transparent);
        }
        .timoteos-detail-title {
          margin: 0;
          color: #111a31;
          font-size: clamp(1.15rem, 1.65vw, 1.55rem);
          line-height: 1;
          letter-spacing: -.045em;
        }
        .timoteos-detail-subtitle {
          margin: 0;
          color: #68758d;
          font-size: clamp(.62rem, .8vw, .74rem);
        }
        .timoteos-detail-close {
          width: 34px;
          height: 34px;
          display: grid;
          flex: 0 0 34px;
          place-items: center;
          border: 1px solid rgba(255,255,255,.86);
          border-radius: 50%;
          background: rgba(231,238,248,.8);
          box-shadow:
            inset 0 1px 0 #fff,
            0 10px 24px rgba(38,51,82,.12);
          color: #38445c;
          cursor: pointer;
          transition: transform .32s cubic-bezier(.16,1,.3,1), background .25s ease;
        }
        .timoteos-detail-close:hover {
          transform: scale(.92) rotate(4deg);
          background: rgba(218,227,240,.92);
        }
        .timoteos-member-list {
          min-height: 0;
          flex: 1;
          overflow: hidden;
          margin-top: clamp(8px, .9vw, 12px);
          border: 1px solid rgba(255,255,255,.72);
          border-radius: 19px;
          background:
            linear-gradient(112deg, rgba(249,251,255,.58), rgba(230,241,250,.42));
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.86),
            0 18px 48px rgba(31,45,78,.08);
          backdrop-filter: blur(24px) saturate(132%);
          -webkit-backdrop-filter: blur(24px) saturate(132%);
        }
        .timoteos-list-head,
        .timoteos-member-row {
          display: grid;
          grid-template-columns: minmax(240px, 1.45fr) minmax(150px, .72fr) minmax(220px, 1fr);
          align-items: center;
          column-gap: clamp(14px, 1.4vw, 24px);
        }
        .timoteos-list-head {
          position: sticky;
          z-index: 4;
          top: 0;
          min-height: 34px;
          padding: 0 clamp(14px, 1.25vw, 20px);
          border-bottom: 1px solid rgba(98,112,143,.14);
          background:
            linear-gradient(102deg, rgba(238,242,253,.94), rgba(224,241,247,.9));
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.92),
            0 5px 16px rgba(40,54,88,.06);
          backdrop-filter: blur(28px) saturate(140%);
          -webkit-backdrop-filter: blur(28px) saturate(140%);
          color: #657189;
          font-size: .55rem;
          font-weight: 820;
          letter-spacing: .12em;
          text-transform: uppercase;
        }
        .timoteos-member-row {
          position: relative;
          min-width: 0;
          min-height: 55px;
          padding: 5px clamp(14px, 1.25vw, 20px);
          border-bottom: 1px solid rgba(99,113,142,.12);
          background: transparent;
          animation: timoteosRowReveal .56s cubic-bezier(.16,1,.3,1) both;
          animation-delay: calc(var(--member-index) * 42ms);
          transition:
            background .24s ease,
            box-shadow .24s ease;
        }
        .timoteos-member-row:nth-child(odd) {
          background: rgba(255,255,255,.1);
        }
        .timoteos-member-row:last-child {
          border-bottom: 0;
        }
        .timoteos-member-row:hover {
          background:
            linear-gradient(90deg, color-mix(in srgb, var(--accent-a) 7%, rgba(255,255,255,.58)), rgba(255,255,255,.22));
          box-shadow:
            inset 3px 0 0 color-mix(in srgb, var(--accent-a) 62%, white);
        }
        .timoteos-member-cell {
          min-width: 0;
        }
        .timoteos-member-identity {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: center;
          gap: 11px;
        }
        .timoteos-detail-avatar {
          width: clamp(35px, 2.8vw, 41px);
          height: clamp(35px, 2.8vw, 41px);
          display: grid;
          place-items: center;
          overflow: hidden;
          border: 2px solid rgba(255,255,255,.98);
          border-radius: 50%;
          background: linear-gradient(145deg, var(--accent-a), var(--accent-b));
          box-shadow:
            0 7px 18px rgba(31,44,76,.13),
            0 0 0 1px color-mix(in srgb, var(--accent-a) 34%, transparent);
          color: #fff;
          font-size: .68rem;
          font-weight: 850;
        }
        .timoteos-detail-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center 14%;
        }
        .timoteos-member-name {
          margin: 0;
          color: #172038;
          overflow: hidden;
          font-size: clamp(.72rem, .84vw, .84rem);
          font-weight: 720;
          letter-spacing: -.025em;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .timoteos-member-role {
          margin: 1px 0 0;
          overflow: hidden;
          color: #6a768d;
          font-size: .58rem;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .timoteos-member-contact {
          color: #5d6980;
          overflow: hidden;
          font-size: .66rem;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .timoteos-member-meta {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 5px 12px;
        }
        .timoteos-member-schedule {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: var(--accent-a);
          font-size: .61rem;
          font-weight: 760;
          white-space: nowrap;
        }
        .timoteos-member-schedule::before {
          width: 5px;
          height: 5px;
          flex: 0 0 5px;
          border-radius: 50%;
          background: currentColor;
          box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 11%, transparent);
          content: '';
        }
        .timoteos-member-schedule.is-pending {
          color: #9a6a18;
        }
        .timoteos-member-pagination {
          min-height: 42px;
          display: flex;
          flex: 0 0 auto;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 7px 4px 0;
        }
        .timoteos-page-button {
          min-width: 29px;
          height: 29px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255,255,255,.72);
          border-radius: 10px;
          background: rgba(241,246,253,.58);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.9),
            0 5px 13px rgba(37,51,83,.07);
          color: #66728a;
          font: inherit;
          font-size: .62rem;
          font-weight: 760;
          cursor: pointer;
          transition:
            transform .22s cubic-bezier(.16,1,.3,1),
            background .22s ease,
            color .22s ease;
        }
        .timoteos-page-button:hover:not(:disabled) {
          transform: translateY(-1px);
          background: rgba(255,255,255,.78);
          color: var(--accent-a);
        }
        .timoteos-page-button.is-current {
          border-color: color-mix(in srgb, var(--accent-a) 34%, white);
          background: color-mix(in srgb, var(--accent-a) 13%, rgba(255,255,255,.9));
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.92),
            0 7px 17px color-mix(in srgb, var(--accent-a) 13%, transparent);
          color: var(--accent-a);
        }
        .timoteos-page-button:disabled {
          opacity: .32;
          cursor: default;
        }
        .timoteos-page-status {
          margin-left: 5px;
          color: #758198;
          font-size: .58rem;
          font-weight: 680;
          white-space: nowrap;
        }
        .timoteos-empty-detail {
          min-height: 210px;
          display: grid;
          place-items: center;
          padding: 24px;
          color: #718097;
          text-align: center;
        }
        @media (max-width: 720px) {
          .timoteos-section {
            padding: 14px 12px 18px;
          }
          .timoteos-header {
            align-items: flex-start;
            flex-direction: column;
            gap: 12px;
          }
          .timoteos-summary {
            align-self: stretch;
            justify-content: center;
          }
          .timoteos-grid {
            grid-template-columns: 1fr;
          }
          .timoteos-group-card {
            min-height: 126px;
            grid-template-columns: 112px minmax(0, 1fr) 54px;
            gap: 10px;
            padding: 14px 12px;
            border-radius: 22px;
          }
          .timoteos-portrait {
            width: 60px;
            height: 60px;
            flex-basis: 60px;
          }
          .timoteos-portrait-stack {
            min-width: 106px;
            padding-left: 2px;
          }
          .timoteos-empty-portrait {
            width: 56px;
            height: 56px;
          }
          .timoteos-group-card:hover {
            transform: none;
          }
          .timoteos-focus-card {
            border-radius: 25px;
          }
          .timoteos-focus-content {
            padding: 10px;
          }
          .timoteos-detail-header {
            gap: 12px;
          }
          .timoteos-detail-search {
            width: clamp(126px, 34vw, 174px);
            margin-left: 0;
          }
          .timoteos-detail-close {
            width: 32px;
            height: 32px;
            flex-basis: 32px;
          }
          .timoteos-member-list {
            border-radius: 16px;
          }
          .timoteos-list-head {
            display: none;
          }
          .timoteos-member-row {
            grid-template-columns: minmax(0, 1fr);
            gap: 3px;
            min-height: 72px;
            padding-block: 8px;
          }
          .timoteos-member-meta {
            justify-content: flex-start;
            padding-left: 46px;
          }
          .timoteos-member-contact {
            padding-left: 46px;
          }
          .timoteos-focus-preview {
            grid-template-columns: 102px minmax(0, 1fr) 52px;
            gap: 10px;
            padding: 14px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .timoteos-group-card,
          .timoteos-group-card::after,
          .timoteos-focus-card,
          .timoteos-member-row {
            animation: none;
          }
        }
      `}</style>

      <header className="timoteos-header">
        <div>
          <p className="timoteos-eyebrow">Ministerio Kids · Coordinación</p>
          <h1 id="timoteos-title" className="timoteos-title">Equipos de Timoteos</h1>
          <p className="timoteos-subtitle">
            Coordinadores organizados automáticamente según su grupo asignado.
          </p>
        </div>
        <div className="timoteos-summary" aria-label={`${coordinadores.length} coordinadores en ${coveredGroups} grupos`}>
          <i className="timoteos-summary-dot" aria-hidden="true" />
          <strong>{coordinadores.length} coordinadores</strong>
          <span>{coveredGroups} de 6 grupos cubiertos</span>
        </div>
      </header>

      <div
        className={`timoteos-grid ${
          focusPhase === 'closing'
            ? 'is-returning'
            : focusActive
              ? 'is-departing'
              : ''
        }`}
      >
        {grouped.map((group, index) => {
          const accent = GROUP_ACCENTS[index]
          const visibleCoordinadores = group.coordinadores.slice(0, 3)
          const extra = Math.max(0, group.coordinadores.length - visibleCoordinadores.length)
          const names = group.coordinadores.map(displayName).join(' · ')

          return (
            <article
              key={group.number}
              className={`timoteos-group-card ${
                selectedGroupNumber === group.number ? 'is-source' : ''
              }`}
              style={{
                '--card-index': index,
                '--sweep-order': index,
                '--accent-a': accent[0],
                '--accent-b': accent[1],
              } as React.CSSProperties}
              role="button"
              tabIndex={focusActive ? -1 : 0}
              aria-label={`Abrir integrantes de ${group.name}`}
              onClick={event => openGroup(group.number, event.currentTarget)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  openGroup(group.number, event.currentTarget)
                }
              }}
            >
              <div className="timoteos-portrait-stack" aria-label={`Coordinadores de ${group.name}`}>
                {visibleCoordinadores.length > 0 ? (
                  <>
                    {visibleCoordinadores.map((servidor, portraitIndex) => (
                      <Portrait
                        key={servidor.id}
                        servidor={servidor}
                        index={portraitIndex}
                        accent={accent}
                      />
                    ))}
                    {extra > 0 && (
                      <div
                        className="timoteos-portrait"
                        style={{ zIndex: 1, marginLeft: -14, background: `linear-gradient(145deg, ${accent[0]}, ${accent[1]})` }}
                        title={`${extra} coordinadores adicionales`}
                      >
                        <span>+{extra}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="timoteos-empty-portraits" aria-hidden="true">
                    <div className="timoteos-empty-portrait">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                        <circle cx="12" cy="8" r="3.5" />
                        <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
                      </svg>
                    </div>
                    <div className="timoteos-empty-portrait" />
                  </div>
                )}
              </div>

              <div className="timoteos-card-copy">
                <div className="timoteos-group-kicker">Coordinación Timoteos</div>
                <h2 className="timoteos-group-name">{group.name}</h2>
                <p className="timoteos-teacher-names">
                  {names || 'Sin coordinador asignado'}
                </p>
              </div>

              <div className="timoteos-card-count">
                <strong>{group.coordinadores.length}</strong>
                <span>{group.coordinadores.length === 1 ? 'Maestro' : 'Maestros'}</span>
              </div>
            </article>
          )
        })}
      </div>

      {selectedGroup && focusGeometry && (
        <>
          <button
            type="button"
            className="timoteos-focus-scrim"
            aria-label="Cerrar detalle del grupo"
            onClick={closeGroup}
          />
          <article
            className={`timoteos-focus-card ${
              focusPhase === 'closing'
                ? 'is-closing'
                : focusPhase === 'open'
                  ? 'is-open'
                  : 'is-expanding'
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="timoteos-focused-title"
            style={{
              left: focusGeometry.left,
              top: focusGeometry.top,
              width: focusGeometry.width,
              height: focusGeometry.height,
              '--focus-from-x': `${focusGeometry.fromX}px`,
              '--focus-from-y': `${focusGeometry.fromY}px`,
              '--focus-scale-x': focusGeometry.scaleX,
              '--focus-scale-y': focusGeometry.scaleY,
              '--accent-a': GROUP_ACCENTS[selectedGroup.number - 1][0],
              '--accent-b': GROUP_ACCENTS[selectedGroup.number - 1][1],
            } as React.CSSProperties}
          >
            <LiquidGlassSweepTransition
              state={
                focusPhase === 'open'
                  ? 'active'
                  : focusPhase === 'closing'
                    ? 'closing'
                    : 'idle'
              }
              outgoingClassName="timoteos-focus-preview"
              incomingClassName="timoteos-focus-content"
              outgoing={
                <>
              <div className="timoteos-portrait-stack">
                {selectedGroup.coordinadores.slice(0, 3).map((servidor, index) => (
                  <Portrait
                    key={servidor.id}
                    servidor={servidor}
                    index={index}
                    accent={GROUP_ACCENTS[selectedGroup.number - 1]}
                  />
                ))}
              </div>
              <div className="timoteos-card-copy">
                <div className="timoteos-group-kicker">Coordinación Timoteos</div>
                <h2 className="timoteos-group-name">{selectedGroup.name}</h2>
              </div>
              <div className="timoteos-card-count">
                <strong>{selectedGroup.coordinadores.length}</strong>
                <span>Integrantes</span>
              </div>
                </>
              }
              incoming={
                <>
              <header className="timoteos-detail-header">
                <div>
                  <p className="timoteos-detail-eyebrow">
                    <i aria-hidden="true" />
                    Equipo de Timoteos
                  </p>
                  <h2 id="timoteos-focused-title" className="timoteos-detail-title">
                    {selectedGroup.name}
                  </h2>
                  <p className="timoteos-detail-subtitle">
                    {memberSearch.trim()
                      ? `${filteredTimoteos.length} ${filteredTimoteos.length === 1 ? 'resultado' : 'resultados'}`
                      : selectedGroup.timoteos.length === 1
                        ? '1 Timoteo asignado a este grupo'
                        : `${selectedGroup.timoteos.length} Timoteos asignados a este grupo`}
                  </p>
                </div>
                <div className="timoteos-detail-search" role="search">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.4-3.4" />
                  </svg>
                  <input
                    type="search"
                    value={memberSearch}
                    onChange={event => setMemberSearch(event.target.value)}
                    placeholder="Buscar Timoteo..."
                    aria-label={`Buscar Timoteo en ${selectedGroup.name}`}
                  />
                  {memberSearch && (
                    <button
                      type="button"
                      className="timoteos-search-clear"
                      onClick={() => setMemberSearch('')}
                      aria-label="Limpiar búsqueda"
                    >
                      ×
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  className="timoteos-detail-close"
                  onClick={closeGroup}
                  aria-label="Cerrar detalle del grupo"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </header>

              <div className="timoteos-member-list" role="table" aria-label={`Timoteos de ${selectedGroup.name}`}>
                {filteredTimoteos.length > 0 && (
                  <div className="timoteos-list-head" role="row">
                    <span role="columnheader">Timoteo</span>
                    <span role="columnheader">Contacto</span>
                    <span role="columnheader">Disponibilidad</span>
                  </div>
                )}
                {filteredTimoteos.length > 0 ? (
                  visibleTimoteos.map((servidor, index) => {
                    const schedules = scheduleLabels(servidor)
                    return (
                      <div
                        key={servidor.id}
                        className="timoteos-member-row"
                        style={{ '--member-index': index } as React.CSSProperties}
                        role="row"
                      >
                        <div className="timoteos-member-cell timoteos-member-identity" role="cell">
                          <div className="timoteos-detail-avatar">
                          {servidor.foto_url ? (
                            <img src={servidor.foto_url} alt={displayName(servidor)} />
                          ) : (
                            <span>{initials(servidor)}</span>
                          )}
                          </div>
                          <div>
                          <h3 className="timoteos-member-name">{displayName(servidor)}</h3>
                          <p className="timoteos-member-role">
                            Timoteo
                          </p>
                          </div>
                        </div>
                        <div className="timoteos-member-cell timoteos-member-contact" role="cell">
                          {servidor.telefono || 'Sin teléfono registrado'}
                        </div>
                        <div className="timoteos-member-cell timoteos-member-meta" role="cell">
                          {schedules.length > 0 ? (
                            schedules.map(schedule => (
                              <span key={schedule} className="timoteos-member-schedule">
                                {/^\s*domingo\b/i.test(schedule) ? schedule : `Domingo ${schedule}`}
                              </span>
                            ))
                          ) : (
                            <span className="timoteos-member-schedule is-pending">Horario pendiente</span>
                          )}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="timoteos-empty-detail">
                    <div>
                      <strong>
                        {memberSearch.trim()
                          ? 'No encontramos coincidencias'
                          : 'Aún no hay Timoteos asignados'}
                      </strong>
                      <p>
                        {memberSearch.trim()
                          ? 'Prueba con otro nombre o número de teléfono.'
                          : 'Los servidores con rol Timoteos vinculados a este grupo aparecerán aquí automáticamente.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              {filteredTimoteos.length > 0 && (
                <nav className="timoteos-member-pagination" aria-label="Páginas del listado de Timoteos">
                  <button
                    type="button"
                    className="timoteos-page-button"
                    onClick={() => setMemberPage(page => Math.max(1, page - 1))}
                    disabled={memberPage === 1}
                    aria-label="Página anterior"
                  >
                    ‹
                  </button>
                  {Array.from({ length: memberPageCount }, (_, index) => index + 1).map(page => (
                    <button
                      type="button"
                      key={page}
                      className={`timoteos-page-button ${page === memberPage ? 'is-current' : ''}`}
                      onClick={() => setMemberPage(page)}
                      aria-label={`Ir a la página ${page}`}
                      aria-current={page === memberPage ? 'page' : undefined}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="timoteos-page-button"
                    onClick={() => setMemberPage(page => Math.min(memberPageCount, page + 1))}
                    disabled={memberPage === memberPageCount}
                    aria-label="Página siguiente"
                  >
                    ›
                  </button>
                  <span className="timoteos-page-status">
                    {memberPage} de {memberPageCount}
                  </span>
                </nav>
              )}
                </>
              }
            />
          </article>
        </>
      )}
    </section>
  )
}
