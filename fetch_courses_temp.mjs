import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const content = fs.readFileSync('.env.local', 'utf8');
const SUPABASE_URL = content.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const SUPABASE_ANON_KEY = content.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
    const { data, error } = await supabase.from('inscripciones').select('*').limit(1);
    if (error) console.error(error);
    else console.log(JSON.stringify(data, null, 2));
}

main();
