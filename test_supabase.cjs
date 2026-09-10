const fs = require('fs');
const code = fs.readFileSync('src/services/supabaseClient.ts', 'utf8');
console.log(code.includes('set_config'));
