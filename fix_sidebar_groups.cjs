const fs = require('fs');
let code = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

// The error is `groups is not defined`
// Inside Sidebar.tsx, it's trying to filter `groups`, but `groups` is defined inside `Navigation.tsx` or not at all in `Sidebar.tsx`.
// In Sidebar.tsx, the array of navigation sections is usually called `navigationGroups` or `navItems`. Let's check what it's actually called.

const i1 = code.indexOf('const navigationGroups: NavGroup[]');
if (i1 > -1) {
    code = code.replace('const filteredGroups = groups.map(group => {', 'const filteredGroups = navigationGroups.map(group => {');
    fs.writeFileSync('src/components/Sidebar.tsx', code);
    console.log("Fixed navigationGroups");
} else {
    // Let's check what the array is actually called in Sidebar.tsx
    const lines = code.split('\\n');
    const match = code.match(/const ([a-zA-Z0-9_]+)[\s:]*(?:NavGroup\[\])?\s*=\s*\[/);
    if(match) {
        console.log("Array name:", match[1]);
        code = code.replace('const filteredGroups = groups.map(group => {', \`const filteredGroups = \${match[1]}.map(group => {\`);
        fs.writeFileSync('src/components/Sidebar.tsx', code);
    }
}
