const fs = require('fs');
let content = fs.readFileSync('C:/Users/WFSYSTEM/Documents/Consolidacion-asp/src/app/kids/admin/page.tsx', 'utf8');

const regex = /\{\/\* Filter tabs \*\/\}\r?\n\s*<div style=\{\{ display:'flex', gap:6 \}\}>[\s\S]*?\{\/\* Filter tabs \*\/\}\r?\n\s*<div style=\{\{ display:'flex', gap:6 \}\}>/;

if (regex.test(content)) {
  // We need to keep ONE of them. 
  // Let's replace the duplicate block with just the single block and the ONE closing div for Section Header.
  
  const singleBlock = `{/* Filter tabs */}
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
              
  // Let's just find the entire block that starts with the first filter tabs and ends with the second closing div.
  const badBlockRegex = /\{\/\* Filter tabs \*\/\}\r?\n\s*<div style=\{\{ display:'flex', gap:6 \}\}>[\s\S]*?<\/div>\r?\n\s*<\/div>\r?\n\s*\{\/\* Filter tabs \*\/\}\r?\n\s*<div style=\{\{ display:'flex', gap:6 \}\}>[\s\S]*?<\/div>\r?\n\s*<\/div>/;
  
  if (badBlockRegex.test(content)) {
      content = content.replace(badBlockRegex, singleBlock);
      fs.writeFileSync('C:/Users/WFSYSTEM/Documents/Consolidacion-asp/src/app/kids/admin/page.tsx', content);
      console.log('Fixed duplicate block with regex!');
  } else {
      console.log('Could not find bad block with strict regex');
  }
} else {
  console.log('No duplicate filter tabs found');
}
