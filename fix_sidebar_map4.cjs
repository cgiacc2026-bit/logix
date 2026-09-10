const fs = require('fs');
let content = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

const regex = /sections\.map\(/g;
content = content.replace(regex, 'filteredGroups.map(');

fs.writeFileSync('src/components/Sidebar.tsx', content);
