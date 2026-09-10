const fs = require('fs');
const content = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('filteredGroups.map')) console.log(i + ':', l);
});
