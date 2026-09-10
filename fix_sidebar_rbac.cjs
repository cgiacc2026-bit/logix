const fs = require('fs');

// Add currentUser to Sidebar Props
let sbCode = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

if (!sbCode.includes("currentUser:")) {
  sbCode = sbCode.replace(
    "interface SidebarProps {",
    "import { SystemUser } from '../types.js';\n\ninterface SidebarProps {\n  currentUser?: SystemUser | null;"
  );
  
  sbCode = sbCode.replace(
    "export const Sidebar: React.FC<SidebarProps> = ({",
    "export const Sidebar: React.FC<SidebarProps> = ({\n  currentUser,"
  );
  
  // Inject filtering logic based on currentUser.role inside Sidebar
  const filterLogic = `
  // [ARCHITECT] Strict RBAC Filtering
  const isCashier = currentUser?.role === 'SALES';
  const isAccountant = currentUser?.role === 'ACCOUNTANT' || currentUser?.role === 'CHIEF_ACCOUNTANT';
  const isManager = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'GENERAL_MANAGER';
  
  const filteredGroups = groups.map(group => {
    return {
      ...group,
      items: group.items.filter(item => {
        if (isManager) return true; // Manager sees everything
        
        if (isCashier) {
          // Cashier ONLY sees POS, Invoices (basic view), and maybe their own dashboard
          return ['pos', 'dashboard', 'invoices', 'quotations'].includes(item.id);
        }
        
        if (isAccountant) {
          // Accountant sees financials, ledgers, journals, vouchers, statements, etc.
          // Probably shouldn't see system settings (users, company setup) unless authorized
          if (['users', 'system-reset'].includes(item.id)) return false;
          return true;
        }
        
        return true; // Default fallback
      })
    };
  }).filter(g => g.items.length > 0);
  `;
  
  sbCode = sbCode.replace(
    "return (",
    filterLogic + "\n  return ("
  );
  
  sbCode = sbCode.replace(
    "groups.map((group) => (",
    "filteredGroups.map((group) => ("
  );

  fs.writeFileSync('src/components/Sidebar.tsx', sbCode);
}

// Update App.tsx to pass currentUser to Sidebar
let appCode = fs.readFileSync('src/App.tsx', 'utf8');
if (!appCode.includes("currentUser={currentUser}") && appCode.includes("<Sidebar")) {
  appCode = appCode.replace(
    "<Sidebar\n          activeTab={activeTab}",
    "<Sidebar\n          currentUser={currentUser}\n          activeTab={activeTab}"
  );
  fs.writeFileSync('src/App.tsx', appCode);
}
