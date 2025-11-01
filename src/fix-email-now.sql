-- ====================================
-- 🚀 EMAIL FIX - Kopiere und führe aus!
-- ====================================

-- Bestätige ALLE unbestätigten Benutzer
UPDATE auth.users
SET 
  email_confirmed_at = NOW(),
  confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- ====================================
-- Kontrolle: Alle sollten ✅ zeigen
-- ====================================

SELECT 
  email,
  CASE 
    WHEN email_confirmed_at IS NOT NULL THEN '✅ Confirmed'
    ELSE '❌ Not Confirmed'
  END as status,
  created_at
FROM auth.users
ORDER BY created_at DESC;

-- ====================================
-- ✅ Fertig! Gehe zurück zur App
-- ====================================
