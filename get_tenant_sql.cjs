const sql = `
-- الدالة تقرأ المعرف من الـ Header مباشرة بدلاً من current_setting المعقدة
CREATE OR REPLACE FUNCTION public.get_tenant_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT NULLIF(current_setting('request.headers', true)::json->>'x-tenant-id', '')::uuid;
$$;
`;
console.log("SQL TO RUN:", sql);
