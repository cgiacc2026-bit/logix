const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes("import { isSupabaseConfigured }")) {
  code = code.replace(
    "import { supabase, getCurrentCompanyId } from './services/supabaseClient.ts';",
    "import { supabase, getCurrentCompanyId, isSupabaseConfigured } from './services/supabaseClient.ts';"
  );
  if (!code.includes("import { supabase, getCurrentCompanyId, isSupabaseConfigured } from './services/supabaseClient.ts';")) {
     code = "import { isSupabaseConfigured } from './services/supabaseClient.ts';\n" + code;
  }
  fs.writeFileSync('src/App.tsx', code);
}
