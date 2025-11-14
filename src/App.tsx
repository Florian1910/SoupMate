import { useState, useEffect, useRef, useCallback } from "react";
import { Header } from "./components/Header";
import { SearchBar } from "./components/SearchBar";
import { Sidebar, Recipe, RecipeFilters } from "./components/Sidebar";
import { LoginPage } from "./components/LoginPage";
import { ProfileSetup } from "./components/ProfileSetup";
import { RecipeResults } from "./components/RecipeResults";
import { RecipeSkeleton } from "./components/RecipeSkeleton";
import logo from "figma:asset/233fb2be3ee3381c91775cbcdd4d5d0ccf5122a5.png";
import { API_CONFIG, DEV_MODE } from './config';
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner@2.0.3";
import { ArrowUp } from "lucide-react";
import { Button } from "./components/ui/button";
import { publicAnonKey, projectId } from './utils/supabase/info';

// Error Boundary Komponente - VOR der App Komponente
const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  const [errorInfo, setErrorInfo] = useState<string>('');

  useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      console.error('Error caught by boundary:', error);
      setErrorInfo(error.error?.toString() || 'Unknown error');
      setHasError(true);
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="flex items-center justify-center h-screen bg-red-50">
        <div className="text-center p-8">
          <h2 className="text-2xl text-red-600 mb-4">Ein Fehler ist aufgetreten</h2>
          <pre className="text-sm text-red-800 bg-white p-4 rounded mb-4 overflow-auto max-w-2xl">
            {errorInfo}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-white rounded"
          >
            Seite neu laden
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default function App() {
  const [showLogin, setShowLogin] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [accessToken, setAccessToken] = useState<string | undefined>(undefined);
  const [userName, setUserName] = useState<string | undefined>(undefined);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [favorites, setFavorites] = useState<Recipe[]>([]);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [filters, setFilters] = useState<RecipeFilters>({
    dietType: "alle",
    difficulty: 0,
    workTime: [0, 120],
    totalTime: [0, 240],
    allergies: [],
    ingredients: ""
  });

  // KORRIGIERTE removeFavorite Funktion - VOR der JSX definiert
  const removeFavorite = async (recipeId: string) => {
    console.log('🔄 removeFavorite called:', { recipeId, userId, accessToken });

    if (!userId || !accessToken) {
      console.log('❌ No user ID or access token');
      return;
    }

    try {
      console.log('📤 Sending delete request to server...');

      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-b187574e/favorites`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          recipe_id: recipeId
        }),
      });

      console.log('📥 Server response:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Server error:', errorData);
        throw new Error(`Failed to remove favorite: ${response.status}`);
      }

      // Entferne lokal
      const newFavorites = favorites.filter(f => f.id !== recipeId);
      setFavorites(newFavorites);
      toast.success("Aus Favoriten entfernt");

    } catch (error) {
      console.error('❌ Error removing favorite:', error);
      toast.error("Fehler beim Entfernen aus Favoriten");
    }
  };

  // In App.tsx - KORRIGIERTE addFavorite Funktion
  const addFavorite = async (recipe: Recipe) => {
    console.log('🔄 addFavorite called:', { recipe, userId, accessToken });

    if (!userId || !accessToken) {
      console.log('❌ No user ID or access token');
      toast.error("Bitte melde dich an, um Favoriten zu speichern");
      return;
    }

    // Check if already favorited
    if (favorites.some(f => f.id === recipe.id)) {
      toast.info("Dieses Rezept ist bereits in deinen Favoriten");
      return;
    }

    try {
      console.log('📤 Sending favorite to server...');

      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-b187574e/favorites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          recipe_id: recipe.id,
          recipe_data: recipe // Optional: Falls du die Rezeptdaten speichern willst
        }),
      });

      console.log('📥 Server response:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Server error:', errorData);
        throw new Error(`Failed to add favorite: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Favorite added successfully:', data);

      // Füge lokal hinzu für sofortiges Feedback
      const newFavorites = [...favorites, recipe];
      setFavorites(newFavorites);
      toast.success(`${recipe.name} zu Favoriten hinzugefügt! ❤️`);

    } catch (error) {
      console.error('❌ Error adding favorite:', error);
      toast.error("Fehler beim Hinzufügen zu Favoriten");
    }
  };

  const handleFilterChange = useCallback((newFilters: RecipeFilters) => {
    console.log('🎯 Global filters updated:', newFilters);
    setFilters(newFilters);
  }, []);

  // Handle successful login/registration
  const handleLoginSuccess = async (newUserId: string, newAccessToken: string, needsProfile: boolean) => {
    setUserId(newUserId);
    setAccessToken(newAccessToken);
    setShowLogin(false);

    if (needsProfile) {
      // New user - show profile setup
      setShowProfileSetup(true);
    } else {
      // Existing user - load profile from database
      await loadUserProfile(newUserId, newAccessToken);
    }
  };

  // Load user profile from database
  const loadUserProfile = async (uid: string, token: string) => {
    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-b187574e/auth/profile/${uid}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok && data.profile) {
        setUserName(data.profile.full_name);
        // Load favorites using user_id
        await loadFavoritesFromDb(uid, token);
      } else {
        // Profile doesn't exist, show setup
        setShowProfileSetup(true);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('Fehler beim Laden des Profils');
    }
  };

  // Handle profile setup completion
  const handleProfileComplete = (fullName: string) => {
    setUserName(fullName);
    setShowProfileSetup(false);
  };

  const handleLogout = () => {
    setUserId(undefined);
    setAccessToken(undefined);
    setUserName(undefined);
    setFavorites([]);
    setChatHistory([]);
    localStorage.removeItem('soupmate_session');
    toast.info('Erfolgreich abgemeldet');
  };

  const handleSearchResults = (results: any) => {
    console.log('📦 APP: Search results received:', {
      query: results.query,
      recipeCount: results.recipes?.length,
      recipes: results.recipes
    });

    if (!results.recipes || results.recipes.length === 0) {
      console.log('❌ APP: No recipes found - checking data structure:', {
        results: results,
        hasRecipes: !!results.recipes,
        recipesType: typeof results.recipes,
        recipesLength: results.recipes?.length
      });
      toast.error('Keine Rezepte gefunden');
      return;
    }

    // Füge die neue Suche zum Chat-Verlauf hinzu
    setChatHistory(prev => [
      ...prev,
      {
        type: 'user',
        query: results.query,
        timestamp: new Date()
      },
      {
        type: 'ai',
        recipes: results.recipes,
        timestamp: new Date()
      }
    ]);

    console.log('✅ APP: Chat history updated with new search results');
  };

  const handleBackToHome = () => {
    setChatHistory([]);
  };

  // Scroll-to-Top functionality
  useEffect(() => {
    const handleScroll = () => {
      if (contentRef.current) {
        setShowScrollTop(contentRef.current.scrollTop > 300);
      }
    };

    const content = contentRef.current;
    if (content) {
      content.addEventListener('scroll', handleScroll);
      return () => content.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const scrollToTop = () => {
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load favorites when user logs in
  useEffect(() => {
    if (userId && accessToken) {
      loadFavoritesFromDb(userId, accessToken);
    }
  }, [userId, accessToken]);

  // Load favorites from database using user_id
  const loadFavoritesFromDb = async (uid: string, token: string) => {
    try {
      console.log('🔄 Loading favorites for user:', uid);
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-b187574e/favorites/${uid}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Favorites loaded:', data.favorites);
        setFavorites(data.favorites || []);
      } else {
        console.error('❌ Failed to load favorites:', response.status);
      }
    } catch (error) {
      console.error('❌ Error loading favorites:', error);
    }
  };

  if (showLogin) {
    return (
      <LoginPage
        onBack={() => setShowLogin(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  if (showProfileSetup && userId && accessToken) {
    return (
      <ProfileSetup
        userId={userId}
        accessToken={accessToken}
        onComplete={handleProfileComplete}
      />
    );
  }

  return (
    <ErrorBoundary>
      <Toaster position="top-center" richColors />
      <div className={`flex h-screen overflow-hidden ${isMobile ? 'flex-col' : ''}`}>
        {/* Sidebar - Drawer on Mobile */}
        {isMobile ? (
          isSidebarOpen && (
            <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setIsSidebarOpen(false)}>
              <div className="absolute bottom-0 left-0 right-0 max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
                <Sidebar
                  isOpen={isSidebarOpen}
                  favorites={favorites}
                  onRemoveFavorite={removeFavorite}
                  onFilterChange={handleFilterChange}
                />
              </div>
            </div>
          )
        ) : (
          <Sidebar
            isOpen={isSidebarOpen}
            favorites={favorites}
            onRemoveFavorite={removeFavorite}
            onFilterChange={handleFilterChange}
          />
        )}

        <div className="flex-1 flex flex-col min-w-0">
          <Header
            onLoginClick={() => setShowLogin(true)}
            userName={userName}
            onLogout={handleLogout}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            isSidebarOpen={isSidebarOpen}
          />

          <main
            className="flex-1 flex flex-col bg-gradient-to-br from-[#fef7f3] via-[#ffede6] to-[#ffe8d6] relative overflow-hidden"
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

            {/* Content Area - Scrollable */}
            <div ref={contentRef} className="flex-1 overflow-y-auto relative z-10 scroll-smooth">
              {isSearching ? (
                <div className="w-full max-w-5xl mx-auto px-6 pt-4">
                  <RecipeSkeleton />
                </div>
              ) : chatHistory.length > 0 ? (
                <RecipeResults
                  chatHistory={chatHistory}
                  onAddToFavorites={addFavorite}
                  onBack={handleBackToHome}
                />
              ) : userName ? (
                <div className="h-full flex flex-col items-center justify-center gap-6 px-8">
                  <h2
                    className="text-3xl md:text-5xl bg-gradient-to-r from-[#ff6b35] via-[#ff8c5a] to-[#ff9966] bg-clip-text text-transparent drop-shadow-2xl animate-fade-in text-center"
                    style={{ fontFamily: 'var(--font-welcome)' }}
                  >
                    Willkommen {userName}!
                  </h2>
                  <p className="text-base md:text-lg text-muted-foreground max-w-2xl text-center animate-fade-in-delayed">
                    Suche nach deinen Lieblingsrezepten oder entdecke neue kulinarische Inspirationen
                  </p>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-6 px-8">
                  <h2
                    className="text-2xl md:text-4xl bg-gradient-to-r from-[#ff6b35] via-[#ff8c5a] to-[#ff9966] bg-clip-text text-transparent drop-shadow-2xl text-center animate-fade-in"
                    style={{ fontFamily: 'var(--font-welcome)' }}
                  >
                    Entdecke köstliche Rezepte
                  </h2>
                  <p className="text-base md:text-lg text-muted-foreground max-w-2xl text-center animate-fade-in-delayed">
                    Melde dich an, um deine Favoriten zu speichern und personalisierte Empfehlungen zu erhalten
                  </p>
                </div>
              )}
            </div>

            {/* Scroll to Top Button */}
            {showScrollTop && (
              <Button
                onClick={scrollToTop}
                size="icon"
                className="fixed bottom-24 right-8 z-20 rounded-full shadow-2xl bg-gradient-to-r from-[#ff6b35] to-[#ff8c5a] hover:from-[#ff8c5a] hover:to-[#ffb085] animate-fade-in"
              >
                <ArrowUp size={20} />
              </Button>
            )}

            {/* Search Bar - Always Visible at Bottom */}
            <div className="relative z-10 border-t border-primary/10 bg-gradient-to-b from-transparent via-[#fef7f3]/80 to-[#fef7f3]/95 backdrop-blur-sm">
              <div className="w-full max-w-3xl mx-auto px-4 md:px-8 py-4">
                <SearchBar
                  userName={userName}
                  onSearchResults={handleSearchResults}
                  filters={filters}
                  onSearchStart={() => setIsSearching(true)}
                  onSearchEnd={() => setIsSearching(false)}
                />
              </div>
            </div>
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}