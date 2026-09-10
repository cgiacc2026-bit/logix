const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes('DataSyncService')) {
  code = code.replace("import { DataService } from './services/dataService';", "import { DataService } from './services/dataService';\nimport { DataSyncService } from './services/dataSyncService';");
  
  const target = `    fetchData();
  }, [isSupabaseConfigured, company?.id]);`;
  
  const replacement = `    fetchData();
    
    // Start Realtime Data Sync
    if (isSupabaseConfigured && company?.id) {
      DataSyncService.startRealtimeSync((tableName) => {
        // Trigger a background re-fetch for all essential data without showing the loading spinner
        console.log(\`Realtime update received for \${tableName}. Refreshing data...\`);
        fetchData(true);
      });
      return () => {
        DataSyncService.stopRealtimeSync();
      };
    }
  }, [isSupabaseConfigured, company?.id]);`;
  
  code = code.replace(target, replacement);
  fs.writeFileSync('src/App.tsx', code);
}
