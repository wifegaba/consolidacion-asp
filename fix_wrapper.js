const fs = require('fs');
let content = fs.readFileSync('C:/Users/WFSYSTEM/Documents/Consolidacion-asp/src/app/kids/admin/page.tsx', 'utf8');

content = content.replace(/\{\/\* ── Admin list card ── \*\/\}[\s\S]*?flexDirection:'column',\r?\n\s*\}\}>/, `{/* ── Admin list card ── */}
            <div style={{
              background:   '#fff',
              borderRadius: isMobile ? 18 : 24,
              boxShadow:    '0 4px 16px rgba(0,0,0,.08)',
              padding:      isMobile ? '8px 8px 12px' : '10px 14px 12px',
              flex:         1,
              minHeight:    0,
              display:      'flex',
              flexDirection:'column',
            }}>`);
            
fs.writeFileSync('C:/Users/WFSYSTEM/Documents/Consolidacion-asp/src/app/kids/admin/page.tsx', content);
console.log('Fixed wrapper background');
