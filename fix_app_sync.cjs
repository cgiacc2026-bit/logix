const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `  useEffect(() => {
    refreshAllData();

    const handleSync = () => {
      refreshAllData(true);
    };`;
    
const replacement = `  useEffect(() => {
    refreshAllData();

    const handleSync = () => {
      refreshAllData(true);
    };
    
    // Start Realtime Data Sync
    if (isSupabaseConfigured) {
      DataSyncService.startRealtimeSync((tableName) => {
        // Trigger a background re-fetch for all essential data without showing the loading spinner
        console.log(\`Realtime update received for \${tableName}. Refreshing data...\`);
        refreshAllData(true);
      });
    }`;

code = code.replace(target, replacement);

const target2 = `    return () => {
      window.removeEventListener('focus', handleSync);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isSupabaseConfigured]);`;
  
const replacement2 = `    return () => {
      window.removeEventListener('focus', handleSync);
      document.removeEventListener('visibilitychange', handleVisibility);
      DataSyncService.stopRealtimeSync();
    };
  }, [isSupabaseConfigured, company?.id]);`;

code = code.replace(target2, replacement2);

fs.writeFileSync('src/App.tsx', code);
