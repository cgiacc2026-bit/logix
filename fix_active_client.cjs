const fs = require('fs');
let code = fs.readFileSync('src/services/supabaseClient.ts', 'utf8');

const targetStr = `        activeClientInstance = createClient(url, key, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
          },
        });`;

const replaceStr = `        
        const currentTenant = typeof window !== 'undefined' ? window.localStorage.getItem('activeCompanyId') || '' : '';
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
        });`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('src/services/supabaseClient.ts', code);
