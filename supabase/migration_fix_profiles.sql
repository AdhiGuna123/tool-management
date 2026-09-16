-- ============================================
-- TOOL MANAGEMENT SYSTEM - FIX MIGRATION
-- Fix profiles kosong + RLS + auto-create profile
-- ============================================

-- 1. Fungsi auto-create profile saat user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'ADMIN'),
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger: auto-create profile saat user baru signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Insert profile untuk user yang sudah ada tapi belum punya profile
INSERT INTO public.profiles (id, full_name, email, role, active)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
  au.email,
  COALESCE(au.raw_user_meta_data->>'role', 'ADMIN'),
  true
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 4. Buat profile default SUPER_ADMIN jika belum ada
-- Ganti EMAIL_DENGAN_EMAIL_YANG_KAMU_PAKAI LOGIN
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN 
    SELECT au.id, au.email
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
    WHERE p.id IS NULL
  LOOP
    INSERT INTO public.profiles (id, full_name, email, role, active)
    VALUES (user_record.id, split_part(user_record.email, '@', 1), user_record.email, 'SUPER_ADMIN', true)
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;

-- 5. Fix RLS: buat authenticated users bisa insert transactions
-- (tanpa harus cek profiles)
DROP POLICY IF EXISTS "Admins can insert transactions" ON transactions;
CREATE POLICY "Authenticated users can insert transactions" ON transactions 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can update transactions" ON transactions;
CREATE POLICY "Authenticated users can update transactions" ON transactions 
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can insert transaction items" ON transaction_items;
CREATE POLICY "Authenticated users can insert transaction items" ON transaction_items 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can view stock movements" ON stock_movements;
CREATE POLICY "Authenticated users can view stock movements" ON stock_movements 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can insert stock movements" ON stock_movements;
CREATE POLICY "Authenticated users can insert stock movements" ON stock_movements 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can view attachments" ON attachments;
CREATE POLICY "Authenticated users can view attachments" ON attachments 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert attachments" ON attachments;
CREATE POLICY "Authenticated users can insert attachments" ON attachments 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can view audit logs" ON audit_logs;
CREATE POLICY "Authenticated users can view audit logs" ON audit_logs 
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;
CREATE POLICY "System can insert audit logs" ON audit_logs 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 6. Fix technicians INSERT/UPDATE policies (tanpa cek profiles)
DROP POLICY IF EXISTS "Admins can insert technicians" ON technicians;
CREATE POLICY "Authenticated users can insert technicians" ON technicians 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can update technicians" ON technicians;
CREATE POLICY "Authenticated users can update technicians" ON technicians 
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- 7. Fix items INSERT/UPDATE policies
DROP POLICY IF EXISTS "Admins can insert items" ON items;
CREATE POLICY "Authenticated users can insert items" ON items 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can update items" ON items;
CREATE POLICY "Authenticated users can update items" ON items 
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- 8. Fix projects INSERT/UPDATE policies
DROP POLICY IF EXISTS "Admins can insert projects" ON projects;
CREATE POLICY "Authenticated users can insert projects" ON projects 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can update projects" ON projects;
CREATE POLICY "Authenticated users can update projects" ON projects 
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- 9. Fix technician_default_items policies
DROP POLICY IF EXISTS "Admins can insert default items" ON technician_default_items;
CREATE POLICY "Authenticated users can insert default items" ON technician_default_items 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can update default items" ON technician_default_items;
CREATE POLICY "Authenticated users can update default items" ON technician_default_items 
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can delete default items" ON technician_default_items;
CREATE POLICY "Authenticated users can delete default items" ON technician_default_items 
  FOR DELETE USING (auth.uid() IS NOT NULL);
