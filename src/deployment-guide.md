# 🚀 SoupMate Deployment Guide für IntelliJ IDEA

> **Hinweis:** Dieser Guide zeigt dir, wie du die UI in IntelliJ einrichtest. Für das Backend-Setup siehe **[BACKEND_SETUP.md](./BACKEND_SETUP.md)**.

## 📦 1. Projekt Setup

### 1.1 Neues Vite Projekt erstellen

```bash
npm create vite@latest soupmate -- --template react-ts
cd soupmate
```

### 1.2 Package.json erstellen

Erstelle eine `package.json` mit folgenden Dependencies:

```json
{
  "name": "soupmate",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "lucide-react": "^0.263.1",
    "@radix-ui/react-accordion": "^1.1.2",
    "@radix-ui/react-alert-dialog": "^1.0.5",
    "@radix-ui/react-aspect-ratio": "^1.0.3",
    "@radix-ui/react-avatar": "^1.0.4",
    "@radix-ui/react-checkbox": "^1.0.4",
    "@radix-ui/react-collapsible": "^1.0.3",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-hover-card": "^1.0.7",
    "@radix-ui/react-label": "^2.0.2",
    "@radix-ui/react-menubar": "^1.0.4",
    "@radix-ui/react-navigation-menu": "^1.1.4",
    "@radix-ui/react-popover": "^1.0.7",
    "@radix-ui/react-progress": "^1.0.3",
    "@radix-ui/react-radio-group": "^1.1.3",
    "@radix-ui/react-scroll-area": "^1.0.5",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-separator": "^1.0.3",
    "@radix-ui/react-slider": "^1.1.2",
    "@radix-ui/react-slot": "^1.0.2",
    "@radix-ui/react-switch": "^1.0.3",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-toast": "^1.1.5",
    "@radix-ui/react-toggle": "^1.0.3",
    "@radix-ui/react-toggle-group": "^1.0.4",
    "@radix-ui/react-tooltip": "^1.0.7",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "cmdk": "^0.2.0",
    "date-fns": "^2.30.0",
    "embla-carousel-react": "^8.0.0",
    "input-otp": "^1.2.4",
    "react-day-picker": "^8.9.1",
    "react-hook-form": "^7.55.0",
    "react-resizable-panels": "^1.0.7",
    "recharts": "^2.9.0",
    "sonner": "^1.2.0",
    "tailwind-merge": "^2.0.0",
    "tailwindcss-animate": "^1.0.7",
    "vaul": "^0.9.0",
    "@hookform/resolvers": "^3.3.2",
    "zod": "^3.22.4",
    "@supabase/supabase-js": "^2.49.8"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.3",
    "vite": "^5.4.1",
    "tailwindcss": "^4.0.0"
  }
}
```

### 1.3 Dependencies installieren

```bash
npm install
```

---

## 🎨 2. Projekt-Dateien kopieren

### 2.1 Ordnerstruktur erstellen

```bash
mkdir -p src/components/ui
mkdir -p src/components/figma
mkdir -p src/styles
mkdir -p src/utils/supabase
mkdir -p supabase/functions/server
```

### 2.2 Alle Dateien aus Figma Make kopieren

Kopiere folgende Dateien aus deinem Figma Make Projekt:

**Frontend:**
- `App.tsx` → `src/App.tsx`
- `config.tsx` → `src/config.tsx` ⭐ **NEU: Konfigurationsdatei**
- `components/*.tsx` → `src/components/*.tsx`
- `components/ui/*.tsx` → `src/components/ui/*.tsx`
- `components/figma/*.tsx` → `src/components/figma/*.tsx`
- `styles/globals.css` → `src/styles/globals.css`

**Backend (Optional - nur wenn du Supabase verwendest):**
- `supabase/functions/server/index.tsx` → `supabase/functions/server/index.tsx`
- `supabase/functions/server/kv_store.tsx` → `supabase/functions/server/kv_store.tsx`

**Dokumentation:**
- `BACKEND_SETUP.md` - Detaillierte Anleitung für dein eigenes Backend

---

## 🖼️ 3. Figma Assets behandeln

### 3.1 Problem: Figma Asset Imports

Dein Code hat Imports wie:
```typescript
import logo from "figma:asset/233fb2be3ee3381c91775cbcdd4d5d0ccf5122a5.png";
```

Diese funktionieren nur in Figma Make. Für IntelliJ musst du sie ersetzen.

### 3.2 Lösung: Assets lokal speichern

1. **Erstelle einen Assets-Ordner:**
```bash
mkdir -p src/assets
```

2. **Lade das Logo herunter** und speichere es als `src/assets/logo.png`

3. **Ersetze alle Figma-Imports** in deinem Code:

**Vorher:**
```typescript
import logo from "figma:asset/233fb2be3ee3381c91775cbcdd4d5d0ccf5122a5.png";
```

**Nachher:**
```typescript
import logo from "./assets/logo.png";
```

**Betroffene Dateien:**
- `src/App.tsx` (Zeile 7)
- `src/components/Header.tsx`
- `src/components/LoginPage.tsx`

---

## ⚙️ 4. Vite Konfiguration

### 4.1 `vite.config.ts` erstellen

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  css: {
    postcss: './postcss.config.js',
  },
})
```

### 4.2 `postcss.config.js` erstellen

```javascript
export default {
  plugins: {
    tailwindcss: {},
  },
}
```

### 4.3 `tsconfig.json` anpassen

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

---

## ⚙️ 5. Backend-Konfiguration

### 5.1 Entwicklungsmodus (empfohlen für den Start)

Die App läuft standardmäßig im **Mock-Modus** - du brauchst kein Backend!

In `src/config.tsx`:
```typescript
export const DEV_MODE = {
  useMockData: true,  // ✅ Mock-Daten verwenden
  mockDelay: 1000
};
```

**Vorteile:**
- ✅ Keine Backend-Setup erforderlich
- ✅ Funktioniert sofort nach Installation
- ✅ Favoriten werden in localStorage gespeichert
- ✅ Perfekt zum Testen der UI

### 5.2 Eigenes Backend konfigurieren

**Siehe [BACKEND_SETUP.md](./BACKEND_SETUP.md) für die vollständige Anleitung!**

Kurzfassung:
1. Erstelle dein Backend (Node.js, Spring Boot, etc.)
2. Implementiere die 4 API Endpoints (siehe BACKEND_SETUP.md)
3. Konfiguriere in `src/config.tsx`:

```typescript
export const API_CONFIG = {
  baseUrl: "http://localhost:3000",  // Deine Backend-URL
  endpoints: {
    search: "/api/search",
    favorites: "/api/favorites",
    health: "/api/health"
  }
};

export const DEV_MODE = {
  useMockData: false,  // ❌ Echtes Backend verwenden
  mockDelay: 1000
};
```

### 5.3 Optional: Supabase Backend (Referenz-Implementierung)

Falls du das mitgelieferte Supabase-Backend verwenden möchtest:

1. Folge den Schritten in **BACKEND_SETUP.md** Abschnitt "Supabase Setup"
2. Die Referenz-Implementierung findest du in `/supabase/functions/server/`

---

## 🎨 6. Import-Pfade anpassen

Alle Component-Imports müssen angepasst werden:

**Vorher:**
```typescript
import { Button } from "./components/ui/button";
```

**Nachher (wenn in src/components/):**
```typescript
import { Button } from "./ui/button";
```

**Oder mit Alias:**
```typescript
import { Button } from "@/components/ui/button";
```

---

## 🚀 7. Entwicklung starten

### 7.1 `index.html` erstellen (im Root)

```html
<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SoupMate</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### 7.2 `src/main.tsx` erstellen

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

### 7.3 Development Server starten

```bash
npm run dev
```

Öffne: http://localhost:5173

---

## 📦 8. Production Build

### 8.1 Build erstellen

```bash
npm run build
```

### 8.2 Build testen

```bash
npm run preview
```

### 8.3 Deployment Optionen

**Option A: Vercel**
```bash
npm install -g vercel
vercel
```

**Option B: Netlify**
```bash
npm install -g netlify-cli
netlify deploy
```

**Option C: GitHub Pages**
- Push zu GitHub
- Aktiviere GitHub Pages in den Repo-Settings

---

## 🔧 9. Wichtige Anpassungen

### 9.1 ImageWithFallback Component

Da du keine Unsplash-Integration in Production hast, ändere `src/components/figma/ImageWithFallback.tsx`:

```typescript
export function ImageWithFallback({ 
  src, 
  alt, 
  className,
  ...props 
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img 
      src={src || '/placeholder.png'} 
      alt={alt} 
      className={className}
      {...props}
    />
  );
}
```

### 9.2 Fehlerbehandlung verbessern

Füge in `src/App.tsx` Error Boundaries hinzu.

---

## ✅ 10. Checkliste

### Frontend (erforderlich):
- [ ] Node.js & npm installiert
- [ ] Vite Projekt erstellt
- [ ] Dependencies installiert (`npm install`)
- [ ] Alle Frontend-Dateien kopiert
- [ ] `config.tsx` kopiert
- [ ] Figma Assets durch lokale Bilder ersetzt
- [ ] Import-Pfade angepasst
- [ ] `npm run dev` funktioniert
- [ ] `npm run build` erfolgreich

### Backend (optional - später):
- [ ] Mock-Modus getestet (`useMockData: true`)
- [ ] Backend-Setup-Anleitung gelesen (BACKEND_SETUP.md)
- [ ] Eigenes Backend implementiert (optional)
- [ ] `config.tsx` angepasst (`useMockData: false`)
- [ ] API Endpoints getestet

---

## 🐛 Troubleshooting

### Problem: "Cannot find module"
→ Prüfe Import-Pfade und `tsconfig.json` Alias-Konfiguration

### Problem: "figma:asset not found"
→ Ersetze alle Figma-Imports durch lokale Assets

### Problem: "Supabase connection failed"
→ Prüfe Credentials in `info.tsx` und `.env`

### Problem: "Edge Function 404"
→ Deploye die Function: `supabase functions deploy server`

### Problem: "CORS Error"
→ Edge Function hat bereits CORS enabled, prüfe die URL

---

## 📚 Nützliche Links

- Vite Docs: https://vitejs.dev/
- Supabase Docs: https://supabase.com/docs
- Tailwind CSS V4: https://tailwindcss.com/
- React Docs: https://react.dev/

---

## 🎉 Fertig!

Deine SoupMate-App läuft jetzt in IntelliJ IDEA!
