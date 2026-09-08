import React, { ErrorInfo, ReactNode } from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Uncaught runtime error caught by ErrorBoundary:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[#F8F6F0] flex items-center justify-center p-4 dir-rtl text-right font-sans">
          <div className="bg-white border-2 border-rose-200 rounded-2xl shadow-xl max-w-lg w-full p-6 sm:p-8 space-y-6 text-neutral-900">
            {/* Header Icon */}
            <div className="flex items-center gap-3 border-b border-neutral-100 pb-4">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-black text-rose-900">
                  تنبيه: حدث خطأ غير متوقع في النظام
                </h2>
                <p className="text-xs text-neutral-500 font-medium">
                  تم رصد الخطأ بواسطة طبقة الحماية (Error Boundary) لمنع الشاشة البيضاء
                </p>
              </div>
            </div>

            {/* Error Message Box */}
            <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-2">
              <span className="text-xs font-bold text-neutral-700 block">
                تفاصيل رسالة الخطأ:
              </span>
              <p className="text-xs font-mono text-rose-700 bg-white p-2.5 rounded border border-rose-100 break-all leading-relaxed">
                {this.state.error?.message || 'خطأ غير معروف في معالجة البيانات أو العرض'}
              </p>
            </div>

            {/* Safety Tips */}
            <p className="text-xs text-neutral-600 leading-relaxed">
              لا تقلق، جميع بياناتك وقيودك المحاسبية محفوظة بأمان في قاعدة البيانات. يرجى الضغط على زر إعادة التحديث لاستئناف العمل.
            </p>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 px-4 py-3 bg-[#1A1A1A] hover:bg-black text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
              >
                <RefreshCw className="w-4 h-4 text-[#D4AF37]" />
                إعادة تحميل الصفحة والنظام
              </button>
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                className="px-4 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                محاولة المتابعة
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

