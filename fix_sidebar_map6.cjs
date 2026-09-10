const fs = require('fs');
let content = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

const target1 = `  const sections = groups; // Fallback mapping`;
content = content.replace(target1, '');

const target2 = `  const filteredGroups = groups.map(group => {`;
const replace2 = `  const sections = groups; // Reference
  const filteredGroups = groups.map(group => {`;
  
content = content.replace(target2, replace2);

fs.writeFileSync('src/components/Sidebar.tsx', content);
