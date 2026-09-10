const fs = require('fs');

let sbCode = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');
sbCode = sbCode.replace(
  "groups.map((group, groupIdx) => (",
  "filteredGroups.map((group, groupIdx) => ("
);
sbCode = sbCode.replace(
  "groups.map((group) => (",
  "filteredGroups.map((group) => ("
);
fs.writeFileSync('src/components/Sidebar.tsx', sbCode);
