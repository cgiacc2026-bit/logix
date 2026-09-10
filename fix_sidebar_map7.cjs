const fs = require('fs');
let content = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

// The error means "sections" was already defined. Let's find it.
const regex = /const sections = .*/g;
content = content.replace(regex, ''); // Remove all declarations of "const sections ="

fs.writeFileSync('src/components/Sidebar.tsx', content);
