import { useState, FormEvent } from "react";
import { User, Leaf, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { toast } from "sonner@2.0.3";
import logo from "figma:asset/233fb2be3ee3381c91775cbcdd4d5d0ccf5122a5.png";
import { projectId, publicAnonKey } from '../utils/supabase/info';

interface ProfileSetupProps {
  userId: string;
  accessToken: string;
  onComplete: (fullName: string) => void;
}

export function ProfileSetup({ userId, accessToken, onComplete }: ProfileSetupProps) {
  const [fullName, setFullName] = useState("");
  const [isVegan, setIsVegan] = useState(false);
  const [isVegetarian, setIsVegetarian] = useState(false);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const commonAllergies = [
    "Gluten",
    "Laktose",
    "Nüsse",
    "Soja",
    "Eier",
    "Fisch",
    "Schalentiere",
    "Sesam",
  ];

  const handleAllergyToggle = (allergy: string) => {
    setAllergies(prev => 
      prev.includes(allergy) 
        ? prev.filter(a => a !== allergy)
        : [...prev, allergy]
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      toast.error("Bitte gib deinen Namen ein");
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: Create user profile
      const profileResponse = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-b187574e/auth/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          userId,
          fullName: fullName.trim()
        })
      });

      const profileData = await profileResponse.json();

      if (!profileResponse.ok) {
        throw new Error(profileData.error || 'Profil konnte nicht erstellt werden');
      }

      // Step 2: Save preferences if any
      if (isVegan || isVegetarian || allergies.length > 0) {
        const preferencesResponse = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-b187574e/auth/preferences`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            userId,
            isVegan,
            isVegetarian,
            allergies: allergies.join(','),
            dietType: isVegan ? 'vegan' : isVegetarian ? 'vegetarian' : 'omnivore'
          })
        });

        const preferencesData = await preferencesResponse.json();

        if (!preferencesResponse.ok) {
          console.error('Preferences save error:', preferencesData.error);
          // Don't fail the whole process if preferences fail
          toast.warning('Profil erstellt, aber Präferenzen konnten nicht gespeichert werden');
        }
      }

      toast.success(`Willkommen, ${fullName}! 🎉`);
      onComplete(fullName.trim());
    } catch (error: any) {
      console.error('Profile setup error:', error);
      toast.error(error.message || 'Profil konnte nicht erstellt werden');
    } finally {
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
        
        <div className="w-full max-w-lg bg-gradient-to-br from-white to-orange-50/30 rounded-2xl shadow-2xl p-8 border-2 border-primary/20 relative z-10 animate-fade-in">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#ff6b35] to-[#ff8c5a] mb-4">
              <User className="text-white" size={32} />
            </div>
            <h2 className="text-3xl bg-gradient-to-r from-[#ff6b35] via-[#ff8c5a] to-[#ff9966] bg-clip-text text-transparent drop-shadow-lg" style={{ fontFamily: 'var(--font-welcome)' }}>
              Vervollständige dein Profil
            </h2>
            <p className="text-muted-foreground mt-2">
              Fast geschafft! Sag uns ein bisschen über dich
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Input */}
            <div className="space-y-2">
              <Label htmlFor="fullName" className="flex items-center gap-2">
                <User size={16} />
                Dein Name *
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Max Mustermann"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={isLoading}
                className="border-primary/30 focus-visible:border-primary bg-gradient-to-r from-white to-orange-50/30"
              />
            </div>

            {/* Diet Preferences */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Leaf size={16} />
                Ernährungspräferenzen (optional)
              </Label>
              <div className="space-y-2 pl-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="vegan"
                    checked={isVegan}
                    onCheckedChange={(checked) => {
                      setIsVegan(!!checked);
                      if (checked) setIsVegetarian(false);
                    }}
                    disabled={isLoading}
                    className="border-primary/30 data-[state=checked]:bg-[#ff6b35] data-[state=checked]:border-[#ff6b35]"
                  />
                  <Label htmlFor="vegan" className="cursor-pointer text-sm">
                    Vegan
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="vegetarian"
                    checked={isVegetarian}
                    onCheckedChange={(checked) => {
                      setIsVegetarian(!!checked);
                      if (checked) setIsVegan(false);
                    }}
                    disabled={isLoading}
                    className="border-primary/30 data-[state=checked]:bg-[#ff6b35] data-[state=checked]:border-[#ff6b35]"
                  />
                  <Label htmlFor="vegetarian" className="cursor-pointer text-sm">
                    Vegetarisch
                  </Label>
                </div>
              </div>
            </div>

            {/* Allergies */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <AlertCircle size={16} />
                Allergien (optional)
              </Label>
              <div className="grid grid-cols-2 gap-2 pl-2">
                {commonAllergies.map((allergy) => (
                  <div key={allergy} className="flex items-center gap-2">
                    <Checkbox
                      id={`allergy-${allergy}`}
                      checked={allergies.includes(allergy)}
                      onCheckedChange={() => handleAllergyToggle(allergy)}
                      disabled={isLoading}
                      className="border-primary/30 data-[state=checked]:bg-[#ff6b35] data-[state=checked]:border-[#ff6b35]"
                    />
                    <Label htmlFor={`allergy-${allergy}`} className="cursor-pointer text-sm">
                      {allergy}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4">
              <Button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-[#ff6b35] to-[#ff8c5a] hover:from-[#ff8c5a] hover:to-[#ffb085] transition-all duration-300 shadow-lg hover:shadow-xl text-white py-6 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Speichern...
                  </>
                ) : (
                  "Profil vervollständigen"
                )}
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              * Pflichtfeld
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
