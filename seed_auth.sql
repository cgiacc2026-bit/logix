-- بما أن تفريغ قاعدة البيانات شمل جدول الشركات (companies)، فقدنا رمز الدخول واسم المستخدم
-- هذا السكربت يقوم بإنشاء أو إعادة تأسيس شركة مطحنة الوليد ببيانات الدخول الافتراضية
INSERT INTO public.companies (
    id, 
    company_name, 
    owner_email, 
    password_hash, 
    login_code, 
    status, 
    type, 
    created_at
) VALUES (
    '20000000-0000-0000-0000-000000000001', 
    'مطحنة الوليد المتحدة (ذ.م.م)', 
    'cgiacc2026@gmail.com', 
    '1234', 
    '450912', 
    'active', 
    'client', 
    NOW()
) ON CONFLICT (id) DO UPDATE SET login_code = '450912', password_hash = '1234';

