const fs = require('fs');
const file = 'C:/Users/WFSYSTEM/Documents/Consolidacion-asp/src/app/kids/admin/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Reposition Fullscreen button and eliminate top bar empty space
const topBarPattern = /{\/\* ── Top bar \+ Scroll area .*? \*\/}\r?\n\s*{displayNav !== 'ninos'.*?\(<>\r?\n\s*<div style={{\r?\n\s*display:\s*'flex',[\s\S]*?<\/div>\r?\n\s*<\/div>/;

const topBarReplacement = `{/* ── Fullscreen Button in Upper Right ── */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            style={{
              position:       'absolute',
              top:            isMobile ? 10 : 14,
              right:          isMobile ? 10 : 16,
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

if (topBarPattern.test(content)) {
  content = content.replace(topBarPattern, topBarReplacement);
  console.log('Top bar replaced successfully');
} else {
  console.log('Top bar pattern not matched');
}

// 2. Reduce outer container padding & white card border radius
content = content.replace(
  "padding: isMobile ? '20px 16px 32px' : '24px 36px 32px',",
  "padding: isMobile ? '8px 8px 12px' : '10px 14px 12px',"
);
content = content.replace(
  "borderRadius: isMobile ? 20 : 54,",
  "borderRadius: isMobile ? 18 : 24,"
);

// 3. Strips container height & bottom padding
content = content.replace(
  "padding: isMobile ? '10px 12px 14px' : '10px 16px 14px',",
  "padding: isMobile ? '10px 12px 60px' : '12px 18px 70px',"
);
content = content.replace(
  "flex: '0 1 auto',",
  "flex: 1,"
);
content = content.replace(
  "maxHeight: isMobile ? 352 : 408,",
  "maxHeight: 'none',"
);

fs.writeFileSync(file, content, 'utf8');
console.log('Script finished');
