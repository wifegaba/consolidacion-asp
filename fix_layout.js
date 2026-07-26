const fs = require('fs');
const file = 'C:/Users/WFSYSTEM/Documents/Consolidacion-asp/src/app/kids/admin/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove floating bubbles in Mobile Logo (Administradores, Coordinadores)
content = content.replace(/\{\/\* ── Items izquierda: Admin, Coordinadores ── \*\/\}[\s\S]*?\{\/\* ── Círculo Central ── \*\/\}/, '{/* ── Círculo Central ── */}');

// 2. Remove floating bubbles in Mobile Logo (Maestros, Auxiliares)
content = content.replace(/\{\/\* ── Items derecha: Maestros, Auxiliares ── \*\/\}[\s\S]*?<\/div>\r?\n\s*<\/div>\r?\n\s*<\/div>/, '</div>\n            </div>\n          )}');

// 3. Fix headers and stats text
content = content.replace(/\{isMaestrosView \? 'Equipo de Maestros' : isCoordinadoresView \? 'Equipo de Coordinadores' : 'Equipo de Administración'\}/g, "'Equipo de Servidores'");
content = content.replace(/\{isMaestrosView \? 'Maestros' : isCoordinadoresView \? 'Coordinadores' : 'Administradores'\}/g, "'Servidores'");
content = content.replace(/sub:\s*isMaestrosView \? 'Maestros' : isCoordinadoresView \? 'Coordinadores' : 'Administradores',/g, "sub:    'Servidores',");

// 4. Update the layout padding to ensure proper spacing
content = content.replace(/padding: isMobile \? '10px 14px 12px' : '10px 14px 12px',/g, "padding: isMobile ? '8px 12px 16px' : '12px 20px 24px',");
content = content.replace(/padding: isMobile \? '14px 14px 50px' : '16px 24px 65px',/g, "padding: isMobile ? '14px 14px 60px' : '16px 24px 75px',");

// 5. Increase dock height per user request "dale mas altura a este panel"
content = content.replace(/height:\s*isMobile \? 42 : 46,/g, "height:        isMobile ? 50 : 54,");
content = content.replace(/width: isMobile \? 32 : 36/g, "width: isMobile ? 38 : 42");
content = content.replace(/height: isMobile \? 32 : 36/g, "height: isMobile ? 38 : 42");
content = content.replace(/size=\{isMobile \? 30 : 34\}/g, "size={isMobile ? 36 : 40}");

// 6. Fix Top Bar Fullscreen button (move to upper right corner)
const topBarPattern = /\{\/\* ── Top bar \+ Scroll area.*? \*\/\}\r?\n\s*\{displayNav !== 'ninos'.*?\(<>\r?\n\s*<div style=\{\{\r?\n\s*display:\s*'flex',[\s\S]*?padding:\s*isMobile \? '8px 20px 0' : '28px 36px 0',/m;
if (topBarPattern.test(content)) {
  content = content.replace(topBarPattern, `{/* ── Top bar + Scroll area ── */}
          {/* Fullscreen Button Top Right */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            style={{
              position:       'absolute',
              top:            isMobile ? 12 : 24,
              right:          isMobile ? 12 : 24,
              zIndex:         60,
              width:          36,
              height:         36,
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
              backdropFilter: 'blur(17px)',
              WebkitBackdropFilter: 'blur(17px)',
              color:          isFullscreen ? '#0284c7' : '#283449',
              cursor:         'pointer',
              transition:     'all .24s cubic-bezier(0.25,0.46,0.45,0.94)',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              {isFullscreen ? (
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
              ) : (
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
              )}
            </svg>
          </button>

          {displayNav !== 'ninos' && displayNav !== 'asistencias' && displayNav !== 'seguimientos' && displayNav !== 'agenda' && (<>
          <div style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            padding:        isMobile ? '8px 20px 0' : '28px 36px 0',`);
}

fs.writeFileSync(file, content);
console.log('Script executed');
