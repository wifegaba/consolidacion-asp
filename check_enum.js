const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split(/[\r\n]+/).forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim().replace(/['"]/g, '');
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim().replace(/['"]/g, '');
});

(async () => {
    try {
        const res = await fetch(url + '/rest/v1/?apikey=' + key, { headers: { 'Authorization': 'Bearer ' + key } });
        const data = await res.json();
        const obj = data.definitions.entrevistas.properties.estado_civil;
        console.log(JSON.stringify(obj.enum));
    } catch(e) {
        console.error(e);
    }
})();
