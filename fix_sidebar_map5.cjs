const fs = require('fs');
let content = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');
content = content.replace(
  'const filteredGroups = groups.map(group => {',
  'const sections = groups; // Fallback mapping\n  const filteredGroups = groups.map(group => {'
);
fs.writeFileSync('src/components/Sidebar.tsx', content);
