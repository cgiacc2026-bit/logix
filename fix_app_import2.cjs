const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes("import { DataSyncService }")) {
  code = code.replace("import { DataService } from './services/dataService.ts';", "import { DataService } from './services/dataService.ts';\nimport { DataSyncService } from './services/dataSyncService.ts';");
  fs.writeFileSync('src/App.tsx', code);
}
