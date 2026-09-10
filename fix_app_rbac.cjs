const fs = require('fs');
let appCode = fs.readFileSync('src/App.tsx', 'utf8');

// Ensure Sidebar is getting currentUser
if (!appCode.includes("currentUser={currentUser}")) {
  appCode = appCode.replace(
    "<Sidebar\n          activeTab={activeTab}",
    "<Sidebar\n          currentUser={currentUser}\n          activeTab={activeTab}"
  );
  fs.writeFileSync('src/App.tsx', appCode);
}
