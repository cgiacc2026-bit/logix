const fs = require('fs');
let appCode = fs.readFileSync('src/App.tsx', 'utf8');

appCode = appCode.replace(
  "<Sidebar\n        activeTab={activeTab}",
  "<Sidebar\n        currentUser={currentUser}\n        activeTab={activeTab}"
);
fs.writeFileSync('src/App.tsx', appCode);
