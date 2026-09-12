import React, { useEffect, useState } from 'react';
import { CompanyJsonBackupService } from '../services/companyJsonBackupService.js';
import { Download, CheckCircle2 } from 'lucide-react';

interface AutoBackupControllerProps {
  companyId?: string;
  companyName?: string;
}

export const AutoBackupController: React.FC<AutoBackupControllerProps> = ({ companyId, companyName }) => {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupComplete, setBackupComplete] = useState(false);

  useEffect(() => {
    if (!companyId) return;

    const checkAndRunBackup = async () => {
      const STORAGE_KEY = `last_auto_backup_${companyId}`;
      const lastBackupStr = localStorage.getItem(STORAGE_KEY);
      const lastBackup = lastBackupStr ? parseInt(lastBackupStr, 10) : 0;
      const now = Date.now();
      
      // 24 hours in ms
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

      if (now - lastBackup >= TWENTY_FOUR_HOURS) {
        // Trigger auto backup
        setIsBackingUp(true);
        setBackupComplete(false);
        
        try {
          // Slight delay to ensure UI shows up before blocking thread
          await new Promise(resolve => setTimeout(resolve, 800));
          
          // exportCompanyDataAsync queries Supabase directly and internally triggers the browser download
          await CompanyJsonBackupService.exportCompanyDataAsync(companyId, companyName || 'Company');
          
          localStorage.setItem(STORAGE_KEY, now.toString());
          setBackupComplete(true);
          
          // Hide message after 4 seconds
          setTimeout(() => {
            setIsBackingUp(false);
            setBackupComplete(false);
          }, 4000);
        } catch (error) {
          console.error("Auto backup failed:", error);
          setIsBackingUp(false);
        }
      }
    };

    // Check immediately on mount
    checkAndRunBackup();

    // Then check periodically every hour
    const interval = setInterval(checkAndRunBackup, 60 * 60 * 1000);
    return () => clearInterval(interval);

  }, [companyId, companyName]);

  if (!isBackingUp) return null;

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl p-4 flex items-center gap-4 min-w-[320px]">
        {backupComplete ? (
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
            <Download className="w-5 h-5 text-indigo-400 animate-bounce" />
          </div>
        )}
        <div>
          <h4 className="text-slate-100 font-bold text-sm">
            {backupComplete ? 'اكتمل التنزيل' : 'تنزيل إجباري للنسخة الاحتياطية'}
          </h4>
          <p className="text-slate-400 text-xs mt-0.5">
            {backupComplete 
              ? 'تم حفظ النسخة الاحتياطية لجهازك بنجاح.' 
              : 'مر 24 ساعة، جاري حفظ نسخة احتياطية آمنة...'}
          </p>
        </div>
      </div>
    </div>
  );
};
