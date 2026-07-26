const fs = require('fs');
const file = 'C:/Users/WFSYSTEM/Documents/Consolidacion-asp/src/app/kids/admin/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Revert the Dark Blue Header
const darkBlueHeaderPattern = /\{\/\* Custom Dark Blue Header \*\/\}[\s\S]*?\{\/\* Nuevo Servidor \*\/\}[\s\S]*?<\/div>\r?\n\s*<\/div>/m;
const originalHeader = `{/* Section header */}
              <div style={{
                display:        'flex',
                alignItems:     isMobile ? 'flex-start' : 'center',
                flexDirection:  isMobile ? 'column' : 'row',
                justifyContent: 'space-between',
                padding:        isMobile ? '16px 18px 0' : '20px 24px 0',
                gap:            isMobile ? 12 : 0,
                flexShrink:     0,
              }}>
                <div>
                  <div style={{ fontSize: isMobile ? 14 : 15, fontWeight:700, color:'#111827' }}>
                    Equipo de Servidores
                  </div>
                  <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>
                    {filtered.length} de {servidores.length} perfiles
                  </div>
                </div>
                {/* Filter tabs */}
                <div style={{ display:'flex', gap:6 }}>
                  {(['todos','activos','inactivos'] as FilterTab[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setFilter(t)}
                      style={{
                        padding:     isMobile ? '5px 12px' : '5px 14px',
                        borderRadius: 50,
                        fontSize:    11,
                        fontWeight:  600,
                        border:      '1px solid',
                        cursor:      'pointer',
                        background:  filter === t ? '#0d9488' : 'transparent',
                        color:       filter === t ? '#fff'    : '#9ca3af',
                        borderColor: filter === t ? '#0d9488' : '#e5e7eb',
                        transition:  'all .15s',
                      }}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>`;

content = content.replace(darkBlueHeaderPattern, originalHeader);

// 2. Revert the Admin list card padding
content = content.replace(/padding:\s*isMobile \? '0px 14px 60px' : '0px 24px 75px',/g, "padding: isMobile ? '10px 12px 60px' : '12px 18px 70px',");

// 3. Revert the ServidorCard to the regular Editar/Desactivar buttons, because the user explicitly said "esto lo tenia el boton review" pointing to the update_layout.js, meaning they didn't want my custom new card. BUT wait, let me just leave the card as it is for now, or revert it if they complain. Actually, the regular ServidorCard with Editar/Desactivar is what they had.
const oldServidorCard = `function ServidorCard({
  s, idx, isDeleting, onEdit, onDelete,
}: {
  s: KidsServidor
  idx: number
  isDeleting: boolean
  onEdit: () => void
  onDelete: () => void
  compact?: boolean
}) {
  const [flipped, setFlipped] = useState(false)
  const [broken, setBroken] = useState(false)
  const showImg = s.foto_url && !broken
  const ini = \`\${s.nombre.charAt(0)}\${s.apellido.charAt(0)}\`.toUpperCase()
  return (
    <div style={{ height: 312, borderRadius: 20, background: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,.08)', padding: 16, display: 'flex', flexDirection: 'column', opacity: isDeleting ? 0.5 : 1 }}>
       <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#f3f4f6', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 'bold', color: '#9ca3af', overflow: 'hidden' }}>
         {showImg ? <img src={s.foto_url!} style={{width:'100%', height:'100%', objectFit:'cover'}} onError={()=>setBroken(true)}/> : ini}
       </div>
       <div style={{ textAlign: 'center', marginTop: 12, fontWeight: 'bold', fontSize: 16, color: '#111827' }}>
         {s.nombre} {s.apellido}
       </div>
       <div style={{ textAlign: 'center', marginTop: 4, fontSize: 12, color: '#6b7280', textTransform: 'uppercase' }}>
         {s.rol}
       </div>
       <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
         <button onClick={onEdit} style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: '#0d9488', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Editar</button>
         <button onClick={onDelete} style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: '#fff', color: '#ef4444', border: '1px solid #ef4444', cursor: 'pointer', fontWeight: 'bold' }}>Desactivar</button>
       </div>
    </div>
  )
}`;
content = content.replace(/function ServidorCard\(\{[\s\S]*?\}\s*\)\s*\{[\s\S]*?return \([\s\S]*?<\/div>\r?\n\s*\)/m, oldServidorCard);

// 4. Apply exactly what update_layout.js was supposed to do for the Top Bar!
const topBarReplacement = `{/* ── Top bar + Scroll area ── */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            style={{
              position:       'absolute',
              top:            isMobile ? 12 : 24,
              right:          isMobile ? 12 : 24,
              zIndex:         60,
              width:          34,
              height:         34,
              borderRadius:   '50%',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              border:         '1px solid rgba(255,255,255,.87)',
              background:     isFullscreen 
                ? 'linear-gradient(145deg, rgba(224,242,254,.95), rgba(186,230,253,.75))'
                : 'linear-gradient(145deg, rgba(255,255,255,.85), rgba(223,229,237,.45))',
              boxShadow:      isFullscreen 
                ? 'inset 0 1px 0 rgba(255,255,255,1), 0 0 0 1.5px rgba(56,189,248,.32), 0 4px 12px rgba(14,165,233,.20)'
                : 'inset 0 1px 0 rgba(255,255,255,.95), inset 0 -1px 0 rgba(81,105,139,.18), 0 4px 12px rgba(96,116,147,.10)',
              backdropFilter: 'blur(17px) saturate(135%)',
              WebkitBackdropFilter: 'blur(17px) saturate(135%)',
              color:          isFullscreen ? '#0284c7' : '#283449',
              cursor:         'pointer',
              transition:     'all .24s cubic-bezier(0.25,0.46,0.45,0.94)',
              flexShrink:     0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              {isFullscreen ? (
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
              ) : (
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
              )}
            </svg>
          </button>
          
          {displayNav !== 'ninos' && displayNav !== 'asistencias' && displayNav !== 'seguimientos' && displayNav !== 'agenda' && (<>
          {/* Hamburger — mobile only */}
          {isMobile && (
            <div style={{ padding: '8px 16px 0' }}>
              <button
                onClick={() => setSidebarOpen(true)}
                style={{
                  width: 38, height: 38, borderRadius: 11, border: '1px solid rgba(0,0,0,.08)',
                  background: 'rgba(255,255,255,.85)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.2">
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <line x1="3" y1="12" x2="21" y2="12"/>
                  <line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </button>
            </div>
          )}`;

const oldTopBarPattern = /\{\/\* ── Top bar \+ Scroll area ── \*\/\}[\s\S]*?\{displayNav !== 'ninos'.*?\(<>\r?\n\s*<div style=\{\{\r?\n\s*display:\s*'flex',[\s\S]*?padding:\s*isMobile \? '8px 20px 0' : '28px 36px 0',/;
content = content.replace(oldTopBarPattern, topBarReplacement);

fs.writeFileSync(file, content);
console.log('Successfully reverted everything and applied the review script!');
