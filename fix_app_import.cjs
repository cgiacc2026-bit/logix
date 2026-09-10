const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes("import { DataSyncService }")) {
  code = code.replace("import { DataService } from './services/dataService';", "import { DataService } from './services/dataService';\nimport { DataSyncService } from './services/dataSyncService';");
  fs.writeFileSync('src/App.tsx', code);
}
