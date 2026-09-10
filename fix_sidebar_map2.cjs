const fs = require('fs');
let content = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');
content = content.replace(
  '          {groups.map((group, groupIdx) => (',
  '          {filteredGroups.map((group, groupIdx) => ('
);
content = content.replace(
  '        {groups.map((group) => (',
  '        {filteredGroups.map((group) => ('
);
content = content.replace(
  '      {groups.map((group, groupIdx) => (',
  '      {filteredGroups.map((group, groupIdx) => ('
);
fs.writeFileSync('src/components/Sidebar.tsx', content);
