-- =====================================================
-- AUTO-CONFIRM EMAIL FÜR NEUE BENUTZER
-- =====================================================
-- Da kein E-Mail-Server konfiguriert ist, bestätigen wir
-- E-Mails automatisch bei der Registrierung
-- =====================================================

-- WICHTIG: Dies ist nur für Entwicklung/Testing!
-- In Produktion sollte ein echter E-Mail-Bestätigungsprozess verwendet werden.

-- Trigger-Funktion: Bestätigt E-Mail automatisch
CREATE OR REPLACE FUNCTION auto_confirm_user_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Setze email_confirmed_at auf jetzt, falls NULL
  IF NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at = NOW();
  END IF;
  
  -- Setze confirmed_at auf jetzt, falls NULL  
  IF NEW.confirmed_at IS NULL THEN
    NEW.confirmed_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger auf auth.users Tabelle
-- WICHTIG: Dies funktioniert nur wenn du Zugriff auf auth.users hast
-- Falls nicht, muss die Auto-Confirm in den Supabase Dashboard Settings aktiviert werden

-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created
--   BEFORE INSERT ON auth.users
--   FOR EACH ROW
--   EXECUTE FUNCTION auto_confirm_user_email();

-- =====================================================
-- ALTERNATIVE: Supabase Dashboard Settings
-- =====================================================
-- Wenn der Trigger nicht funktioniert, aktiviere in Supabase:
-- 1. Gehe zu: Authentication → Settings
-- 2. Unter "Email Auth" → Disable "Confirm Email"
-- ODER
-- 3. Setze "GOTRUE_MAILER_AUTOCONFIRM" = true in den Server Settings

-- =====================================================
-- FÜR TESTING: Alle existierenden Benutzer bestätigen
-- =====================================================
-- Falls du bereits Benutzer hast, die nicht bestätigt sind:

-- UPDATE auth.users
-- SET 
--   email_confirmed_at = NOW(),
--   confirmed_at = NOW()
-- WHERE email_confirmed_at IS NULL;
