import { useState, FormEvent } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { toast } from "sonner@2.0.3";
import logo from "figma:asset/233fb2be3ee3381c91775cbcdd4d5d0ccf5122a5.png";
import { supabase } from '../utils/supabase/client';
import { projectId, publicAnonKey } from '../utils/supabase/info';

interface LoginPageProps {
  onBack: () => void;
  onLoginSuccess: (userId: string, accessToken: string, needsProfile: boolean) => void;
}

export function LoginPage({ onBack, onLoginSuccess }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");

  // Login Handler
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      toast.error("Bitte fülle alle Felder aus");
      return;
    }

    setIsLoading(true);

    try {
      console.log('🔐 Starting login for:', email.trim());

      // Sign in with Supabase Auth (client-side)
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });

      if (error) {
        // User-friendly error messages
        let errorMessage = 'Login fehlgeschlagen';

        if (error.message.includes('Invalid login credentials') ||
            error.message.includes('Invalid') ||
            error.message.includes('credentials')) {
          errorMessage = 'E-Mail oder Passwort ist falsch';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = 'E-Mail wurde noch nicht bestätigt';
        } else if (error.message.includes('User not found')) {
          errorMessage = 'Benutzer nicht gefunden';
        }

        // Show toast and return (no throw needed)
        toast.error(errorMessage, {
          duration: 4000,
          style: {
            background: '#FEE2E2',
            border: '1px solid #FCA5A5',
            color: '#991B1B'
          }
        });
        setIsLoading(false);
        return;
      }

      if (!data.session || !data.user) {
        toast.error('Login fehlgeschlagen - bitte versuche es erneut', {
          duration: 4000,
          style: {
            background: '#FEE2E2',
            border: '1px solid #FCA5A5',
            color: '#991B1B'
          }
        });
        setIsLoading(false);
        return;
      }

      console.log('✅ Login successful:', data.user.id);

      // 🔥 PROFIL-ÜBERPRÜFUNG HINZUGEFÜGT
      // Prüfe ob User ein Profil hat
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      // Wenn kein Profil existiert, dann needsProfile = true
      const needsProfile = !profile || profileError?.code === 'PGRST116';

      console.log('📋 Profile check:', { hasProfile: !!profile, needsProfile });

      toast.success("Erfolgreich angemeldet!");

      // Session wird automatisch persistent gespeichert
      onLoginSuccess(data.user.id, data.session.access_token, needsProfile);
      setIsLoading(false);
    } catch (error: any) {
      console.error('❌ Unexpected login error:', error);
      toast.error('Ein unerwarteter Fehler ist aufgetreten', {
        duration: 4000,
        style: {
          background: '#FEE2E2',
          border: '1px solid #FCA5A5',
          color: '#991B1B'
        }
      });
      setIsLoading(false);
    }
  };

  // Registration Handler - uses backend route with auto email confirmation
  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      toast.error("Bitte fülle alle Felder aus");
      return;
    }

    if (password.length < 6) {
      toast.error("Passwort muss mindestens 6 Zeichen lang sein");
      return;
    }

    setIsLoading(true);

    try {
      console.log('🔐 Starting registration for:', email.trim());

      // Use backend route for signup with auto email confirmation
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b187574e/auth/signup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            email: email.trim(),
            password: password
          })
        }
      );

      const data = await response.json();

      if (!response.ok || data.error) {
        // User-friendly error message
        let errorMessage = 'Registrierung fehlgeschlagen';

        if (data.error === 'User already registered' ||
            data.error?.includes('already registered')) {
          errorMessage = 'Diese E-Mail ist bereits registriert';
        } else if (data.error) {
          errorMessage = data.error;
        }

        toast.error(errorMessage, {
          duration: 4000,
          style: {
            background: '#FEE2E2',
            border: '1px solid #FCA5A5',
            color: '#991B1B'
          }
        });
        setIsLoading(false);
        return;
      }

      console.log('✅ Registration successful:', data.user?.id);
      toast.success("Konto erfolgreich erstellt!");

      // If we have a session, login automatically
      if (data.session && data.access_token) {
        // 🔥 BEI REGISTRIERUNG IMMER PROFIL-SETUP ANZEIGEN
        onLoginSuccess(data.user.id, data.access_token, true);
      } else {
        // Otherwise show success and switch to login tab
        toast.success("Bitte melde dich jetzt an");
        setActiveTab("login");
      }
      setIsLoading(false);
    } catch (error: any) {
      console.error('❌ Unexpected registration error:', error);
      toast.error('Ein unerwarteter Fehler ist aufgetreten', {
        duration: 4000,
        style: {
          background: '#FEE2E2',
          border: '1px solid #FCA5A5',
          color: '#991B1B'
        }
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-gradient-to-r from-[#ff9966] via-[#ffb085] to-[#ff9966] text-primary-foreground px-8 py-8 shadow-2xl relative">
        <div className="flex items-center justify-center gap-6">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#ff6b35] via-[#ff8c5a] to-[#ffb085] blur-md opacity-60"></div>
            <img
              src={logo}
              alt="SoupMate Logo"
              className="w-20 h-20 rounded-full border-4 border-white shadow-2xl relative z-10 object-cover"
            />
          </div>
          <h1 className="text-5xl bg-gradient-to-br from-white via-orange-50 to-orange-100 bg-clip-text text-transparent drop-shadow-lg tracking-wide" style={{ fontFamily: 'var(--font-welcome)' }}>
            <span className="font-bold">S</span>oup<span className="font-bold">M</span>ate
          </h1>
        </div>
        <div className="absolute top-1/2 -translate-y-1/2 left-8">
          <Button
            onClick={onBack}
            variant="outline"
            className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white backdrop-blur-sm transition-all duration-300 hover:scale-105 shadow-lg"
          >
            <ArrowLeft size={18} className="mr-2" />
            Zurück
          </Button>
        </div>
      </header>

      <main
        className="flex-1 flex items-center justify-center p-8 bg-gradient-to-br from-[#fef7f3] via-[#ffede6] to-[#ffe8d6] relative"
        style={{
          backgroundImage: `url(${logo})`,
          backgroundPosition: 'center',
          backgroundSize: '50%',
          backgroundRepeat: 'no-repeat',
          backgroundBlendMode: 'overlay',
        }}
      >
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#fef7f3]/95 via-[#ffede6]/90 to-[#ffe8d6]/95"
          style={{ zIndex: 0 }}
        />

        <div className="w-full max-w-md space-y-4 relative z-10">
          <div className="bg-gradient-to-br from-white to-orange-50/30 rounded-2xl shadow-2xl p-8 border-2 border-primary/20 animate-fade-in">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "login" | "register")} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#ff6b35] data-[state=active]:to-[#ff8c5a] data-[state=active]:text-white">
                  Anmelden
                </TabsTrigger>
                <TabsTrigger value="register" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#ff6b35] data-[state=active]:to-[#ff8c5a] data-[state=active]:text-white">
                  Registrieren
                </TabsTrigger>
              </TabsList>

              {/* LOGIN TAB */}
              <TabsContent value="login">
                <h2 className="text-3xl text-center mb-8 bg-gradient-to-r from-[#ff6b35] via-[#ff8c5a] to-[#ff9966] bg-clip-text text-transparent drop-shadow-lg" style={{ fontFamily: 'var(--font-welcome)' }}>
                  Willkommen zurück!
                </h2>

                <form onSubmit={handleLogin} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">E-Mail</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="deine@email.de"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                      className="border-primary/30 focus-visible:border-primary bg-gradient-to-r from-white to-orange-50/30"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password">Passwort</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      className="border-primary/30 focus-visible:border-primary bg-gradient-to-r from-white to-orange-50/30"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-[#ff6b35] to-[#ff8c5a] hover:from-[#ff8c5a] hover:to-[#ffb085] transition-all duration-300 shadow-lg hover:shadow-xl text-white py-6 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Anmelden...
                      </>
                    ) : (
                      "Anmelden"
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* REGISTER TAB */}
              <TabsContent value="register">
                <h2 className="text-3xl text-center mb-8 bg-gradient-to-r from-[#ff6b35] via-[#ff8c5a] to-[#ff9966] bg-clip-text text-transparent drop-shadow-lg" style={{ fontFamily: 'var(--font-welcome)' }}>
                  Konto erstellen
                </h2>

                <form onSubmit={handleRegister} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="register-email">E-Mail</Label>
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="deine@email.de"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                      className="border-primary/30 focus-visible:border-primary bg-gradient-to-r from-white to-orange-50/30"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-password">Passwort</Label>
                    <Input
                      id="register-password"
                      type="password"
                      placeholder="Mindestens 6 Zeichen"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      minLength={6}
                      className="border-primary/30 focus-visible:border-primary bg-gradient-to-r from-white to-orange-50/30"
                    />
                    <p className="text-xs text-muted-foreground">
                      Mindestens 6 Zeichen
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-[#ff6b35] to-[#ff8c5a] hover:from-[#ff8c5a] hover:to-[#ffb085] transition-all duration-300 shadow-lg hover:shadow-xl text-white py-6 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Registrieren...
                      </>
                    ) : (
                      "Konto erstellen"
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    Nach der Registrierung kannst du dein Profil vervollständigen
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}