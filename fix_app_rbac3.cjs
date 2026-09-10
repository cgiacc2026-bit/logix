const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes("if (!isAuthenticated || !currentUser)")) {
  code = code.replace(
    "if (!isAuthenticated) {",
    "if (!isAuthenticated || !currentUser) {"
  );
}

fs.writeFileSync('src/App.tsx', code);
