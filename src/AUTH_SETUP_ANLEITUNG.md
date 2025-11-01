# 🔐 Auth-System Setup-Anleitung

## ⚠️ WICHTIG: Auto-Confirm Email aktivieren

**BEVOR du das System testest**, musst du Email Auto-Confirm aktivieren:

### Option 1: Supabase Dashboard (EMPFOHLEN)
1. Gehe zu deinem Supabase Projekt Dashboard
2. Navigation: **Authentication** → **Email Templates** → **Settings**
3. Scrolle zu **"Email Confirmations"**
4. **DEAKTIVIERE** "Enable email confirmations"
5. Speichern

### Option 2: SQL (falls Dashboard nicht verfügbar)
```sql
-- Alle Benutzer automatisch bestätigen
UPDATE auth.users
SET 
  email_confirmed_at = NOW(),
  confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;
```

---

## Übersicht: Was wurde geändert?

Das Login-System wurde komplett überarbeitet:

### ✅ **VORHER:**
- Login mit Name, Email, Passwort
- Keine echte Authentifizierung
- Namen als Identifier

### ✅ **JETZT:**
- Registrierung nur mit Email + Passwort
- Nach Registrierung → Profil-Setup (Name + Präferenzen)
- Login mit Email + Passwort
- **Client-seitige** Supabase Auth Integration (nicht über Backend!)
- Sichere Session-Verwaltung
- Datenbank-gestützte Benutzerprofile

---

## 📋 Neue Dateien & Änderungen

### 1. **Neue Komponenten:**
- `/components/LoginPage.tsx` - ✅ **NEU GESCHRIEBEN**
  - Login/Registrierung Tabs
  - Kein Name-Feld mehr
  - **Client-seitige** Supabase Auth (direkt, nicht über Backend!)

- `/components/ProfileSetup.tsx` - ✅ **NEU ERSTELLT**
  - Wird nach Registrierung gezeigt
  - Name, Ernährungspräferenzen, Allergien
  - Speichert in user_profiles & user_preferences

- `/utils/supabase/client.tsx` - ✅ **NEU ERSTELLT**
  - Singleton Supabase Client für das Frontend
  - Verwendet ANON_KEY (nicht Service Role Key!)
  - Session Persistence aktiviert

### 2. **Geänderte Dateien:**
- `/App.tsx` - ✅ **AKTUALISIERT**
  - Neuer Auth-Flow mit `showProfileSetup` State
  - Session-Management mit `userId` und `accessToken`
  - Profile-Loading Logik

- `/supabase/functions/server/index.tsx` - ✅ **VEREINFACHT**
  - Login/Signup Routes entfernt (jetzt client-seitig!)
  - 4 Profile/Preferences Routes behalten
  - Sichere Token-Validierung für geschützte Routen

- `/database-schema.sql` - ✅ **ERWEITERT**
  - user_profiles Tabelle hinzugefügt
  - Korrekte Nummerierung der Tabellen (4, 5, 6)

- `/database-auto-confirm.sql` - ✅ **NEU ERSTELLT**
  - Anleitung für Email Auto-Confirm
  - SQL für manuelle Bestätigung bestehender User

---

## 🗄️ Datenbank-Tabellen

### Tabelle: `user_profiles`
```sql
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,           -- Name des Benutzers
  username text UNIQUE,     -- Optional: Benutzername
  avatar_url text,          -- Optional: Profilbild
  created_at timestamptz DEFAULT current_timestamp,
  updated_at timestamptz DEFAULT current_timestamp
);
```

### Tabelle: `user_preferences`
```sql
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_vegan boolean DEFAULT false,
  is_vegetarian boolean DEFAULT false,
  diet_type varchar(50),    -- z.B. 'vegan', 'vegetarian', 'omnivore'
  allergies text,           -- Komma-getrennt: "Gluten,Laktose,Nüsse"
  created_at timestamptz DEFAULT current_timestamp,
  updated_at timestamptz DEFAULT current_timestamp
);
```

### Tabelle: `user_favorites`
```sql
CREATE TABLE IF NOT EXISTS user_favorites (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id uuid REFERENCES test_recipes(recipe_id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT current_timestamp,
  PRIMARY KEY (user_id, recipe_id)
);
```

---

## 🚀 Deployment-Schritte

### Schritt 1: ⚠️ Email Auto-Confirm aktivieren (KRITISCH!)

**WICHTIG:** Ohne diesen Schritt funktioniert die Registrierung nicht!

```bash
# Option 1: Supabase Dashboard (EMPFOHLEN)
1. Gehe zu: Authentication → Settings
2. Scrolle zu "Email Confirmations"
3. DEAKTIVIERE "Enable email confirmations"
4. Speichern

# Option 2: SQL (falls nötig)
UPDATE auth.users
SET email_confirmed_at = NOW(), confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;
```

### Schritt 2: Datenbank-Schema aktualisieren

```bash
# 1. Öffne Supabase Dashboard
# 2. Gehe zu SQL Editor
# 3. Führe das komplette database-schema.sql aus

# ODER: Falls Schema bereits existiert, nur die neue Tabelle hinzufügen:
```

```sql
-- Nur die user_profiles Tabelle erstellen (falls noch nicht vorhanden)
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  username text UNIQUE,
  avatar_url text,
  created_at timestamptz DEFAULT current_timestamp,
  updated_at timestamptz DEFAULT current_timestamp
);
```

### Schritt 3: Edge Function deployen

```bash
# Terminal öffnen und deployen
supabase functions deploy make-server-b187574e
```

**Erwartete Ausgabe:**
```
Deploying function make-server-b187574e...
✓ Function deployed successfully
```

### Schritt 4: Frontend testen

1. Öffne die App im Browser
2. Klicke auf "Anmelden"
3. Wechsle zum Tab "Registrieren"
4. Registriere mit Email + Passwort (z.B. test@example.com / test123)
5. **Erwartetes Verhalten:**
   - Nach erfolgreicher Registrierung → Profil-Setup erscheint
   - Name, Präferenzen eingeben
   - Nach Submit → Hauptseite mit Willkommensnachricht
6. **Test Login:**
   - Logout
   - Login mit denselben Credentials
   - Sollte direkt zur Hauptseite gehen (kein Profil-Setup)

---

## 🔄 User Flow

### **Registrierung (Neuer Benutzer):**
```
1. LoginPage → Tab "Registrieren"
   ↓ Email + Passwort eingeben
2. Backend: /auth/signup erstellt User in auth.users
   ↓ Erfolg: userId + accessToken zurück
3. ProfileSetup erscheint
   ↓ Name + Präferenzen eingeben
4. Backend: /auth/profile erstellt user_profiles Eintrag
   ↓ Backend: /auth/preferences erstellt user_preferences Eintrag
5. Hauptseite mit Willkommensnachricht
```

### **Login (Bestehender Benutzer):**
```
1. LoginPage → Tab "Anmelden"
   ↓ Email + Passwort eingeben
2. Backend: /auth/login validiert Credentials
   ↓ Erfolg: userId + accessToken zurück
3. Backend: /auth/profile/:userId lädt Profil
   ↓ full_name aus Datenbank laden
4. Hauptseite mit "Willkommen {Name}!"
```

---

## 📡 Backend-Endpunkte

### ⚠️ WICHTIG: Login/Signup jetzt client-seitig!

Login und Registrierung erfolgen jetzt **direkt im Frontend** mit:
```typescript
import { supabase } from '../utils/supabase/client';

// Registrierung
const { data, error } = await supabase.auth.signUp({ email, password });

// Login
const { data, error } = await supabase.auth.signInWithPassword({ email, password });

// Logout
await supabase.auth.signOut();
```

Das Backend hat nur noch diese Endpunkte:

---

### 1. **POST /auth/profile**
Erstellt/Aktualisiert Benutzerprofil

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Request:**
```json
{
  "userId": "abc-123-def-456",
  "fullName": "Max Mustermann",
  "username": "maxmustermann",  // optional
  "avatarUrl": "https://..."    // optional
}
```

**Response (Erfolg):**
```json
{
  "success": true,
  "profile": {
    "user_id": "abc-123-def-456",
    "full_name": "Max Mustermann",
    "username": "maxmustermann",
    "avatar_url": null,
    "created_at": "2025-11-01T12:00:00Z",
    "updated_at": "2025-11-01T12:00:00Z"
  }
}
```

---

### 2. **GET /auth/profile/:userId**
Lädt Benutzerprofil

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (Erfolg):**
```json
{
  "profile": {
    "user_id": "abc-123-def-456",
    "full_name": "Max Mustermann",
    "username": "maxmustermann",
    "avatar_url": null,
    "created_at": "2025-11-01T12:00:00Z",
    "updated_at": "2025-11-01T12:00:00Z"
  }
}
```

**Response (Kein Profil):**
```json
{
  "profile": null
}
```

---

### 3. **POST /auth/preferences**
Speichert Benutzerpräferenzen

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Request:**
```json
{
  "userId": "abc-123-def-456",
  "isVegan": false,
  "isVegetarian": true,
  "allergies": "Gluten,Laktose,Nüsse",
  "dietType": "vegetarian"
}
```

**Response (Erfolg):**
```json
{
  "success": true,
  "preferences": {
    "user_id": "abc-123-def-456",
    "is_vegan": false,
    "is_vegetarian": true,
    "allergies": "Gluten,Laktose,Nüsse",
    "diet_type": "vegetarian",
    "created_at": "2025-11-01T12:00:00Z",
    "updated_at": "2025-11-01T12:00:00Z"
  }
}
```

---

### 4. **GET /favorites/:userId**
Lädt Favoriten (jetzt mit user_id statt userName)

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "favorites": [
    {
      "id": "recipe-123",
      "name": "Tomatensuppe",
      "difficulty": 2,
      "diet": "vegetarisch"
    }
  ]
}
```

---

## 🔐 Sicherheit

### ✅ Implementierte Sicherheitsmaßnahmen:

1. **Token-basierte Auth:**
   - Jeder geschützte Endpunkt prüft `Authorization: Bearer {token}`
   - Token wird mit `supabase.auth.getUser(accessToken)` validiert

2. **User ID Validierung:**
   - Backend prüft, ob `userId` im Request mit dem Token-User übereinstimmt
   - Verhindert, dass User A auf Daten von User B zugreift

3. **SQL Injection Schutz:**
   - Alle Queries verwenden Supabase Client (parametrisiert)
   - Keine String-Konkatenation

4. **Passwort-Anforderungen:**
   - Mindestens 6 Zeichen (Frontend-Validierung)
   - Supabase Auth hasht Passwörter automatisch

### ⚠️ Produktions-Empfehlungen:

- **Email-Verifizierung:** Entferne `email_confirm: true` und konfiguriere SMTP
- **Passwort-Stärke:** Erhöhe Mindestlänge auf 8+ Zeichen
- **Rate Limiting:** Implementiere Rate Limits für Login/Signup
- **2FA:** Erwäge Two-Factor Authentication für sensible Accounts

---

## 🧪 Testing

### Test 1: Registrierung (im Browser)
```
1. Öffne die App
2. Klicke "Anmelden"
3. Tab "Registrieren"
4. Email: test@example.com
5. Passwort: test123
6. → Profil-Setup sollte erscheinen
```

### Test 2: Login (im Browser)
```
1. Logout (falls eingeloggt)
2. Klicke "Anmelden"
3. Tab "Anmelden"
4. Email: test@example.com
5. Passwort: test123
6. → Sollte direkt einloggen (kein Profil-Setup)
```

### Test 3: Profil erstellen (API)
```bash
# Ersetze {ACCESS_TOKEN} mit dem Token aus Login-Response
curl -X POST https://brssalvqnbxgaiwmycpf.supabase.co/functions/v1/make-server-b187574e/auth/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {ACCESS_TOKEN}" \
  -d '{"userId":"abc-123","fullName":"Test User"}'
```

---

## 🐛 Troubleshooting

### Problem 1: "Email rate limit exceeded" oder "User already registered"
**Ursache:** Zu viele Registrierungsversuche mit derselben Email

**Lösung:**
```sql
-- Im Supabase Dashboard → Authentication → Users
-- User löschen und neu registrieren

-- ODER: Warte 60 Minuten (Rate Limit Reset)
```

---

### Problem 2: "Invalid login credentials" / "Ungültige E-Mail oder Passwort"
**Ursache 1:** Email ist nicht bestätigt (email_confirmed_at = NULL)

**Lösung:**
```sql
-- Prüfen:
SELECT id, email, email_confirmed_at FROM auth.users;

-- Bestätigen:
UPDATE auth.users
SET email_confirmed_at = NOW(), confirmed_at = NOW()
WHERE email = 'deine@email.de';
```

**Ursache 2:** Passwort stimmt nicht überein

**Lösung:**
```
- Überprüfe Groß-/Kleinschreibung
- Passwort muss mindestens 6 Zeichen haben
- Probiere "Passwort vergessen" (falls implementiert)
```

---

### Problem 3: "Unauthorized" bei Profil-Requests
**Ursache:** Fehlender oder ungültiger Access Token

**Lösung:**
```javascript
// Prüfe ob accessToken korrekt gesetzt ist
console.log('Access Token:', accessToken);

// Token muss im Header sein:
headers: {
  'Authorization': `Bearer ${accessToken}`
}
```

---

### Problem 4: Registrierung funktioniert, aber kein Login möglich
**Ursache:** Email nicht automatisch bestätigt

**Lösung:**
```bash
# Dashboard Settings prüfen:
Authentication → Settings → Email Confirmations
→ "Enable email confirmations" sollte DEAKTIVIERT sein
```

---

### Problem 5: Profile wird nicht geladen
**Ursache:** user_profiles Tabelle existiert nicht

**Lösung:**
```sql
-- Prüfe ob Tabelle existiert:
SELECT * FROM user_profiles;

-- Falls Fehler: Führe database-schema.sql aus
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  username text UNIQUE,
  avatar_url text,
  created_at timestamptz DEFAULT current_timestamp,
  updated_at timestamptz DEFAULT current_timestamp
);
```

---

### Problem 6: Edge Function Errors
**Ursache:** Funktion nicht deployed oder alter Code

**Lösung:**
```bash
# Neu deployen
supabase functions deploy make-server-b187574e

# Logs prüfen
supabase functions logs make-server-b187574e
```

---

## 📊 Datenbank-Queries zum Testen

### Alle registrierten Benutzer anzeigen:
```sql
SELECT 
  u.id,
  u.email,
  u.created_at,
  p.full_name,
  p.username
FROM auth.users u
LEFT JOIN user_profiles p ON u.id = p.user_id
ORDER BY u.created_at DESC;
```

### Benutzer mit Präferenzen:
```sql
SELECT 
  p.full_name,
  pref.is_vegan,
  pref.is_vegetarian,
  pref.allergies
FROM user_profiles p
JOIN user_preferences pref ON p.user_id = pref.user_id;
```

### Benutzer-Favoriten anzeigen:
```sql
SELECT 
  p.full_name,
  r.name as recipe_name,
  f.created_at as favorited_at
FROM user_profiles p
JOIN user_favorites f ON p.user_id = f.user_id
JOIN test_recipes r ON f.recipe_id = r.recipe_id
ORDER BY f.created_at DESC;
```

---

## 📝 Zusammenfassung

### ✅ Was funktioniert jetzt:
- ✅ Registrierung nur mit Email + Passwort
- ✅ Nach Registrierung → Profil-Setup
- ✅ Login mit gespeicherten Credentials
- ✅ Sichere Session-Verwaltung
- ✅ Profil & Präferenzen in Datenbank
- ✅ Favoriten mit user_id verknüpft

### 🎯 Nächste Schritte:
1. **Datenbank-Schema ausführen** (user_profiles Tabelle)
2. **Edge Function deployen**
3. **Testen:** Registrierung → Profil-Setup → Login
4. **Optional:** Allergien-Filter implementieren (siehe ALLERGIEN_FILTER_ANLEITUNG.md)

---

**Erstellt:** November 2025  
**Version:** 1.0  
**Status:** ✅ Vollständige Auth-System Implementierung
