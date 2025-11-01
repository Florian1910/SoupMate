# 🚀 SoupMate - Schnellstart Anleitung

## ⚡ In 3 Schritten zur laufenden App

### Schritt 1: Dependencies installieren
```bash
npm install
```

### Schritt 2: Entwicklungsserver starten
```bash
npm run dev
```

### Schritt 3: Browser öffnen
```
http://localhost:5173
```

**Das war's! 🎉** Die App läuft im Mock-Modus und benötigt kein Backend.

---

## 🎮 App nutzen

### 1. **Ohne Login (Gast-Modus)**
- Suche nach Rezepten in der unteren Suchleiste
- Verwende die Filter in der linken Sidebar
- Entdecke verschiedene Rezept-Vorschläge

**Beispiel-Suchen:**
- "Pasta"
- "Suppe"
- "Vegan"
- "Schnell und einfach"

### 2. **Mit Login**
- Klicke oben rechts auf "Anmelden"
- Gib einen Namen ein (z.B. "Max")
- Jetzt kannst du Favoriten speichern! ⭐

### 3. **Filter verwenden**

**Sidebar öffnen/schließen:**
- Klicke auf das Burger-Menü oben links

**Verfügbare Filter:**
- 🥗 **Ernährung:** Vegan / Vegetarisch / Alles
- ⭐ **Schwierigkeit:** 1-5 Sterne
- ⏱️ **Arbeitszeit:** Wie lange du aktiv kochst
- 🕐 **Gesamtzeit:** Inklusive Wartezeiten
- 🚫 **Allergien:** Schließe Allergene aus
- 🥕 **Meine Zutaten:** Was du zu Hause hast
- 👥 **Portionen:** Für wie viele Personen

**Filter zurücksetzen:**
- Jeder Filter hat ein kleines ❌ zum Zurücksetzen
- Oder nutze den "Alle Filter zurücksetzen" Button unten in der Sidebar

---

## 🔧 Modi

### 📦 Mock-Modus (Standard)

**Status:** ✅ Aktiviert (Standard-Einstellung)

**Was bedeutet das?**
- Die App verwendet lokale Test-Daten
- Keine Backend-Verbindung erforderlich
- Favoriten werden im Browser gespeichert (localStorage)
- Perfekt zum Ausprobieren und Testen!

**Konfiguration:** In `config.tsx`
```typescript
export const DEV_MODE = {
  useMockData: true  // ✅ Mock-Modus aktiv (Standard)
};

export const API_CONFIG = {
  baseUrl: "http://localhost:3000",  // Wird im Mock-Modus ignoriert
  // ...
};
```

**Keine Backend-Konfiguration erforderlich!** Die App funktioniert sofort mit Mock-Daten.

### 🚀 Produktiv-Modus (mit Backend)

**Status:** ❌ Nicht aktiviert (benötigt Backend-Setup)

**Was benötigst du?**
1. Ein laufendes Backend (siehe BACKEND_SETUP.md)
2. Gemini API Key für AI-Rezepte
3. Datenbank für Favoriten

**Aktivierung:**
1. Backend implementieren (siehe [BACKEND_SETUP.md](./BACKEND_SETUP.md))
2. In `config.tsx` anpassen:
```typescript
export const API_CONFIG = {
  baseUrl: "http://localhost:3000",  // Deine Backend-URL
  // Für Produktion: "https://api.soupmate.com"
};

export const DEV_MODE = {
  useMockData: false  // ❌ Backend verwenden
};
```

---

## 💡 Tipps & Tricks

### Filter effektiv nutzen

**Szenario 1: "Ich habe nur 20 Minuten Zeit"**
1. Öffne Sidebar
2. Setze Arbeitszeit auf 0-20 Min
3. Wähle Schwierigkeit 1-2 Sterne
4. Suche nach "schnell"

**Szenario 2: "Ich bin Veganer und habe Glutenallergie"**
1. Wähle "Vegan"
2. Aktiviere "Gluten" bei Allergien
3. Suche nach deinem Lieblingsgericht

**Szenario 3: "Ich habe Tomaten und Basilikum zu Hause"**
1. Gib bei "Meine Zutaten" ein: "Tomaten, Basilikum"
2. Suche nach "Pasta" oder "Suppe"
3. Die Rezepte bevorzugen deine vorhandenen Zutaten

### Favoriten verwalten

1. **Favorit hinzufügen:**
   - Suche nach Rezepten
   - Klicke auf das ❤️ Icon bei einem Rezept

2. **Favoriten anzeigen:**
   - Öffne die Sidebar
   - Scrolle zu "Favoriten"
   - Alle gespeicherten Rezepte werden angezeigt

3. **Favorit entfernen:**
   - Klicke auf das 🗑️ Icon beim Favoriten

**Hinweis:** Im Mock-Modus bleiben Favoriten nur bis zum Browser-Refresh gespeichert!

---

## 🐛 Häufige Probleme

### Problem: "Die Seite lädt nicht"

**Lösung:**
```bash
# Stoppe den Server (Ctrl+C)
# Starte neu:
npm run dev
```

### Problem: "Ich sehe keine Rezepte bei der Suche"

**Mögliche Ursachen:**
1. Filter sind zu restriktiv gesetzt
   → Setze alle Filter zurück
2. Suchbegriff zu spezifisch
   → Versuche allgemeinere Begriffe wie "Pasta" statt "Spaghetti Carbonara mit Speck"

### Problem: "Meine Favoriten sind weg"

**Im Mock-Modus:**
- Favoriten werden im Browser gespeichert
- Nach Browser-Cache löschen sind sie weg
- Für dauerhafte Speicherung → Backend einrichten

### Problem: "Filter funktionieren nicht"

**Prüfe:**
1. Sind die Filter richtig gesetzt? (Kleine ❌ Icons sollten sichtbar sein)
2. Klicke auf "Alle Filter zurücksetzen" und setze sie neu

---

## 📚 Nächste Schritte

### Als Entwickler:

1. **Code erkunden:**
   - Schaue in `App.tsx` für die Hauptlogik
   - Alle Komponenten sind in `/components`
   - UI-Bibliothek in `/components/ui`

2. **Backend einrichten:**
   - Lies [BACKEND_SETUP.md](./BACKEND_SETUP.md)
   - Implementiere die 4 API Endpoints
   - Verbinde mit Gemini AI

3. **Deployment:**
   - Lies [deployment-guide.md](./deployment-guide.md)
   - Deploye auf Vercel, Netlify oder eigenem Server

### Als Nutzer:

1. **Mehr Rezepte entdecken:**
   - Probiere verschiedene Suchbegriffe
   - Kombiniere unterschiedliche Filter
   - Speichere deine Favoriten

2. **Feedback geben:**
   - Was funktioniert gut?
   - Was könnte besser sein?
   - Welche Features fehlen?

---

## 🎯 Zusammenfassung

```bash
# Installation
npm install

# App starten (Mock-Modus)
npm run dev

# Browser öffnen
http://localhost:5173

# Los geht's! 🍜
```

**Mock-Modus:** Alles funktioniert sofort, keine weitere Konfiguration nötig!

**Produktiv-Modus:** Backend-Setup erforderlich → siehe BACKEND_SETUP.md

---

Viel Spaß mit SoupMate! 🍲

**Fragen?** Lies die anderen Dokumentationen:
- 📖 [README.md](./README.md) - Vollständige Übersicht
- 🔧 [BACKEND_SETUP.md](./BACKEND_SETUP.md) - Backend einrichten
- 🚀 [deployment-guide.md](./deployment-guide.md) - IntelliJ Deployment
