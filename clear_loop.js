import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envFile = fs.readFileSync(resolve(__dirname, '.env'), 'utf-8');
const env = Object.fromEntries(envFile.split('\n').map(line => line.split('=')));

const supabaseUrl = env.VITE_SUPABASE_URL.trim();
const supabaseKey = env.VITE_SUPABASE_ANON_KEY.trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  setInterval(async () => {
    const { data: session } = await supabase.from('sessions').select('*').order('created_at', { ascending: false }).limit(1).single();
    if (session && session.current_question_id) {
      await supabase.from('sessions').update({ current_question_id: null }).eq('id', session.id);
      console.log("Cleared session", session.game_code);
    }
  }, 1000);
}
run();
