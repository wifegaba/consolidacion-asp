const fs = require('fs');
const file = 'C:/Users/WFSYSTEM/Documents/Consolidacion-asp/src/app/kids/admin/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add CSS style rule for dock tooltip hover
if (!content.includes('.dock-item:hover .dock-tooltip')) {
  content = content.replace(
    '.btn-logout-premium:hover svg {',
    '.dock-item:hover .dock-tooltip {\n        opacity: 1 !important;\n        transform: translateY(0) !important;\n      }\n      .btn-logout-premium:hover svg {'
  );
}

// 2. Replace aside block with iPad dock
const asideStart = '{/* ════════════════════════════════════════\r\n            SIDEBAR\r\n        ════════════════════════════════════════ */}';
const asideStartUnix = '{/* ════════════════════════════════════════\n            SIDEBAR\n        ════════════════════════════════════════ */}';
const asideEnd = '</aside>';

let startIdx = content.indexOf(asideStart);
if (startIdx === -1) startIdx = content.indexOf(asideStartUnix);

const endIdx = content.indexOf(asideEnd, startIdx) + asideEnd.length;

if (startIdx !== -1 && endIdx > startIdx) {
  const newDock = `        {/* ════════════════════════════════════════
            DOCK (iPad style)
        ════════════════════════════════════════ */}
        <aside style={{
          position:      'absolute',
          bottom:        isMobile ? 8 : 14,
          left:          '50%',
          transform:     'translateX(-50%)',
          height:        isMobile ? 42 : 46,
          background:    'rgba(255, 255, 255, 0.65)',
          backdropFilter: 'blur(30px) saturate(200%)',
          WebkitBackdropFilter: 'blur(30px) saturate(200%)',
          display:       'flex',
          flexDirection: 'row',
          alignItems:    'center',
          padding:       '0 12px',
          gap:           isMobile ? 6 : 8,
          borderRadius:  30,
          boxShadow:     '0 8px 30px rgba(0,0,0,0.12), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(255,255,255,0.5)',
          zIndex:        100,
          transition:    'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)',
        }}>
          {/* Glass sheen overlay */}
          <div style={{
            position: 'absolute', inset: 1, pointerEvents: 'none', borderRadius: 'inherit',
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.6) 0%, transparent 40%, rgba(255, 255, 255, 0.1) 100%)',
            opacity: .8, zIndex: -1
          }} />

          {/* Logo (opcional, oculto en móvil) */}
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', marginRight: 4, paddingRight: 10, borderRight: '1px solid rgba(0,0,0,0.1)' }}>
               <LogoCircle size={30} />
            </div>
          )}

          {/* Nav Items */}
          {NAV_ITEMS.map((item) => {
            const isActive = item.section === activeNav;
            return (
              <div
                key={item.num}
                onClick={() => handleNavClick(item.section)}
                className="dock-item"
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: isMobile ? 32 : 36,
                  height: isMobile ? 32 : 36,
                  borderRadius: 12,
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: isActive ? 'linear-gradient(145deg, rgba(56,189,248,0.2), rgba(14,165,233,0.1))' : 'transparent',
                  boxShadow: isActive ? 'inset 0 1px 1px rgba(255,255,255,0.4), 0 3px 8px rgba(56,189,248,0.2)' : 'none',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget;
                  el.style.transform = 'translateY(-4px) scale(1.05)';
                  if (!isActive) el.style.background = 'rgba(255, 255, 255, 0.4)';
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget;
                  el.style.transform = 'none';
                  if (!isActive) el.style.background = 'transparent';
                }}
              >
                <NavIcon section={item.section} active={isActive} color={isActive ? '#0284c7' : '#64748b'} />
                
                {/* Indicador activo */}
                {isActive && (
                  <div style={{
                    position: 'absolute',
                    bottom: -4,
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: '#0ea5e9',
                    boxShadow: '0 0 6px rgba(14,165,233,0.8)'
                  }} />
                )}
                {/* Tooltip texto */}
                <div className="dock-tooltip" style={{
                  position: 'absolute',
                  top: -34,
                  background: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(10px)',
                  color: 'white',
                  padding: '3px 8px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  opacity: 0,
                  pointerEvents: 'none',
                  transition: 'opacity 0.2s, transform 0.2s',
                  transform: 'translateY(6px)',
                  whiteSpace: 'nowrap',
                }}>
                  {item.label}
                </div>
              </div>
            );
          })}

          <div style={{ width: 1, height: '45%', background: 'rgba(15,23,42,0.15)', margin: '0 2px' }} />

          {/* User Avatar + Logout */}
          <div 
            style={{ 
              position: 'relative', 
              width: isMobile ? 32 : 36, 
              height: isMobile ? 32 : 36, 
              borderRadius: '50%', 
              cursor: 'pointer',
              boxShadow: '0 3px 8px rgba(0,0,0,0.1), inset 0 1px 1px rgba(255,255,255,0.8)',
              transition: 'transform 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#fff',
              marginLeft: 2,
            }}
            onClick={handleLogout}
            title="Cerrar sesión"
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
             <AvatarImg src={usuario.foto_url} nombre={usuario.nombre} apellido={usuario.apellido} grad="linear-gradient(135deg, #0284c7 0%, #0d9488 50%, #38bdf8 100%)" size={isMobile ? 30 : 34} />
             <div className="status-online-dot" style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 8,
                height: 8,
                zIndex: 4,
                boxShadow: '0 0 4px rgba(16, 185, 129, 0.8), 0 0 0 1.5px #ffffff',
              }} />
          </div>
        </aside>`;

  content = content.substring(0, startIdx) + newDock + content.substring(endIdx);
  console.log('Dock updated successfully');
} else {
  console.log('Aside block not found');
}

// 3. Layout padding & border-radius adjustments
content = content.replace(
  "padding: isMobile ? '20px 16px 32px' : '24px 36px 32px',",
  "padding: isMobile ? '12px 12px 16px' : '14px 20px 16px',"
);
content = content.replace(
  "borderRadius: isMobile ? 20 : 54,",
  "borderRadius: isMobile ? 18 : 24,"
);
content = content.replace(
  "padding: isMobile ? '14px 14px 18px' : '16px 24px 20px',",
  "padding: isMobile ? '14px 14px 50px' : '16px 24px 65px',"
);

fs.writeFileSync(file, content, 'utf8');
console.log('Restore script finished');
