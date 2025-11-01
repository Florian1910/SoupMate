-- =====================================================
-- 🚨 QUICK FIX: Email not confirmed Error
-- =====================================================
-- Führe dieses SQL im Supabase SQL Editor aus
-- =====================================================

-- Schritt 1: Zeige alle unbestätigten User
SELECT 
  id,
  email,
  email_confirmed_at,
  confirmed_at,
  created_at
FROM auth.users
WHERE email_confirmed_at IS NULL
ORDER BY created_at DESC;

-- =====================================================

-- Schritt 2: Bestätige ALLE unbestätigten User
UPDATE auth.users
SET 
  email_confirmed_at = NOW(),
  confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- =====================================================

-- Schritt 3: Verify - sollte jetzt leer sein!
SELECT 
  email,
  email_confirmed_at
FROM auth.users
WHERE email_confirmed_at IS NULL;

-- Wenn leer = ✅ Erfolgreich!
-- Wenn User angezeigt werden = ❌ Nochmal ausführen

-- =====================================================

-- Optional: Zeige alle User mit Status
SELECT 
  email,
  CASE 
    WHEN email_confirmed_at IS NOT NULL THEN '✅ Bestätigt'
    ELSE '❌ Nicht bestätigt'
  END as status,
  email_confirmed_at,
  created_at
FROM auth.users
ORDER BY created_at DESC;

-- =====================================================
-- WICHTIG: Dashboard Settings auch ändern!
-- =====================================================
-- Gehe zu: Authentication → Providers → Email
-- Deaktiviere: "Confirm email" Checkbox
-- Speichern!
-- =====================================================
