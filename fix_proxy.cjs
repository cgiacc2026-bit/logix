const fs = require('fs');
let code = fs.readFileSync('src/services/supabaseClient.ts', 'utf8');

// The proxy caches getActiveSupabaseClient().
// Let's modify getActiveSupabaseClient to ALWAYS inject the header if activeCompanyId changes.
// Because activeClientInstance is cached.

const target = `export const getActiveSupabaseClient = (): SupabaseClient => {
  const { url, key } = getSupabaseConfig();
  if (checkIsSupabaseConfigured()) {
    if (!activeClientInstance || activeClientUrl !== url || activeClientKey !== key) {`;

const repl = `export const getActiveSupabaseClient = (): SupabaseClient => {
  const { url, key } = getSupabaseConfig();
  const currentTenant = typeof window !== 'undefined' ? window.localStorage.getItem('activeCompanyId') || '' : '';
  
  if (checkIsSupabaseConfigured()) {
    // We must recreate the client if the tenant changes because global headers are immutable in JS client
    if (!activeClientInstance || activeClientUrl !== url || activeClientKey !== key || (activeClientInstance as any)._tenantId !== currentTenant) {
      try {
        activeClientInstance = createClient(url, key, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
          },
          global: {
            headers: {
              'x-tenant-id': currentTenant
            }
          }
        });
        (activeClientInstance as any)._tenantId = currentTenant;
        activeClientUrl = url;
        activeClientKey = key;
      } catch (err) {
        console.warn('Failed to initialize live Supabase client, falling back to local mode:', err);
      }
    }
    if (activeClientInstance) return activeClientInstance;
  }
  return fallbackMockClient;
};`;

const t1 = `export const getActiveSupabaseClient = (): SupabaseClient => {`;
const t2 = `  return fallbackMockClient;\n};`;

const i1 = code.indexOf(t1);
const i2 = code.indexOf(t2, i1);

if (i1 > -1 && i2 > -1) {
  code = code.substring(0, i1) + repl + code.substring(i2 + t2.length);
  fs.writeFileSync('src/services/supabaseClient.ts', code);
  console.log("Rewrote getActiveSupabaseClient proxy");
}
