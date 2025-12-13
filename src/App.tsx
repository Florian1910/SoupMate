import { useState, useEffect, useRef, useCallback } from "react";
import { Header } from "./components/Header";
import { SearchBar } from "./components/SearchBar";
import { Sidebar, Recipe, RecipeFilters } from "./components/Sidebar";
import { LoginPage } from "./components/LoginPage";
import { ProfileSetup } from "./components/ProfileSetup";
import { RecipeResults } from "./components/RecipeResults";
import { RecipeSkeleton } from "./components/RecipeSkeleton";
import logo from "figma:asset/233fb2be3ee3381c91775cbcdd4d5d0ccf5122a5.png";
import { API_CONFIG } from "./config";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner@2.0.3";
import { ArrowUp } from "lucide-react";
import { Button } from "./components/ui/button";
import { supabase } from "./utils/supabase/client";

// ---------------------------
// Error Boundary
// ---------------------------
const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
    const [hasError, setHasError] = useState(false);
    const [errorInfo, setErrorInfo] = useState<string>("");

    useEffect(() => {
        const handleError = (error: ErrorEvent) => {
            console.error("Error caught by boundary:", error);
            setErrorInfo(error.error?.toString() || error.message || "Unknown error");
            setHasError(true);
        };

        const handleRejection = (event: PromiseRejectionEvent) => {
            console.error("Unhandled promise rejection:", event.reason);
            setErrorInfo(event.reason?.toString?.() || "Unhandled promise rejection");
            setHasError(true);
        };

        window.addEventListener("error", handleError);
        window.addEventListener("unhandledrejection", handleRejection);

        return () => {
            window.removeEventListener("error", handleError);
            window.removeEventListener("unhandledrejection", handleRejection);
        };
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

// ---------------------------
// fetch with timeout helper
// ---------------------------
const fetchWithTimeout = async (
    input: RequestInfo | URL,
    init: RequestInit,
    timeoutMs = 8000
) => {
    const controller = new AbortController();
    const id = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(input, { ...init, signal: controller.signal });
    } finally {
        window.clearTimeout(id);
    }
};

export default function App() {
    const [showLogin, setShowLogin] = useState(false);
    const [showProfileSetup, setShowProfileSetup] = useState(false);

    const [userId, setUserId] = useState<string | undefined>(undefined);
    const [accessToken, setAccessToken] = useState<string | undefined>(undefined);
    const [userName, setUserName] = useState<string | undefined>(undefined);

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const [favorites, setFavorites] = useState<Recipe[]>([]);
    const [favoritesLoading, setFavoritesLoading] = useState(false);
    const [favoritesError, setFavoritesError] = useState<string | null>(null);

    const [chatHistory, setChatHistory] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showScrollTop, setShowScrollTop] = useState(false);

    // Fullscreen Loader: nur für Auth-Init
    const [isLoading, setIsLoading] = useState(true);

    const contentRef = useRef<HTMLDivElement>(null);

    // ---------------------------
    // ---------------------------
    const [filters, setFilters] = useState<RecipeFilters>({
        dietType: "alle",
        difficulty: 0,
        totalTime: [0, 240],
        allergies: [],
        ingredients: "",
    });

    // ---------------------------
    // URLs
    // ---------------------------
    const favoritesUrl = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.favorites}`;

    // ---------------------------
    // Always get fresh token
    // ---------------------------
    const getFreshAccessToken = async (): Promise<string> => {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const token = data.session?.access_token;
        if (!token) throw new Error("No session token");
        return token;
    };

    // ---------------------------
    // Favorites
    // ---------------------------
    const loadFavoritesFromDb = async () => {
        setFavoritesLoading(true);
        setFavoritesError(null);

        try {
            const token = await getFreshAccessToken();

            console.log("🔄 Loading favorites from:", favoritesUrl);

            const response = await fetchWithTimeout(
                favoritesUrl,
                {
                    method: "GET",
                    headers: { Authorization: `Bearer ${token}` },
                },
                8000
            );

            const text = await response.text().catch(() => "");
            console.log("✅ Favorites response:", response.status, text);

            if (!response.ok) {
                setFavorites([]);
                setFavoritesError(`${response.status} ${text}`);
                return;
            }

            const data = text ? JSON.parse(text) : {};
            setFavorites(Array.isArray(data.favorites) ? data.favorites : []);
        } catch (e: any) {
            console.error("❌ Error loading favorites:", e);
            setFavorites([]);
            setFavoritesError(String(e?.message ?? e));
        } finally {
            setFavoritesLoading(false);
        }
    };

    const addFavorite = async (recipe: Recipe) => {
        if (!userId) {
            toast.error("Bitte melde dich an, um Favoriten zu speichern");
            return;
        }

        try {
            const token = await getFreshAccessToken();

            const response = await fetchWithTimeout(
                favoritesUrl,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ recipe_id: recipe.id }),
                },
                8000
            );

            const text = await response.text().catch(() => "");
            if (!response.ok) {
                console.error("❌ Failed to add favorite:", response.status, text);
                throw new Error(text || `Failed to add favorite: ${response.status}`);
            }

            await loadFavoritesFromDb();
            toast.success(`${recipe.name} zu Favoriten hinzugefügt! ❤️`);
        } catch (e) {
            console.error("❌ Error adding favorite:", e);
            toast.error("Fehler beim Hinzufügen zu Favoriten");
        }
    };

    const removeFavorite = async (recipeId: string) => {
        if (!userId) return;

        try {
            const token = await getFreshAccessToken();

            const response = await fetch(favoritesUrl, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ recipe_id: recipeId }),
            });

            const text = await response.text().catch(() => "");
            if (!response.ok) {
                console.error("❌ Failed to remove favorite:", response.status, text);
                throw new Error(text || `Failed to remove favorite: ${response.status}`);
            }

            await loadFavoritesFromDb();
            toast.success("Aus Favoriten entfernt");
        } catch (e) {
            console.error("❌ Error removing favorite:", e);
            toast.error("Fehler beim Entfernen aus Favoriten");
        }
    };

    // ---------------------------
    // Profile
    // ---------------------------
    const loadUserProfile = async (uid: string) => {
        try {
            console.log("👤 Loading user profile for:", uid);

            const { data: userProfile, error } = await supabase
                .from("user_profiles")
                .select("full_name")
                .eq("user_id", uid)
                .single();

            if (error || !userProfile) {
                console.log("📝 No profile found, showing setup", error);
                setShowProfileSetup(true);
                return;
            }

            setUserName(userProfile.full_name);
            console.log("✅ Profile loaded:", userProfile.full_name);
        } catch (e) {
            console.error("Error loading profile:", e);
            toast.error("Fehler beim Laden des Profils");
        }
    };

    // ---------------------------
    // Auth init
    // ---------------------------
    useEffect(() => {
        let mounted = true;

        const initializeAuth = async () => {
            console.log("🔍 Initializing auth...");
            setIsLoading(true);

            try {
                const { data, error } = await supabase.auth.getSession();
                if (error) throw error;

                const session = data.session;
                if (!mounted) return;

                if (session?.user) {
                    setUserId(session.user.id);
                    setAccessToken(session.access_token);
                    loadUserProfile(session.user.id);
                } else {
                    setUserId(undefined);
                    setAccessToken(undefined);
                    setUserName(undefined);
                    setFavorites([]);
                    setShowProfileSetup(false);
                }
            } catch (e) {
                console.error("Error in auth initialization:", e);
            } finally {
                if (mounted) setIsLoading(false);
            }
        };

        initializeAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log("🔐 Auth state changed:", event);

            if (event === "SIGNED_IN" && session?.user) {
                setUserId(session.user.id);
                setAccessToken(session.access_token);
                loadUserProfile(session.user.id);
            } else if (event === "TOKEN_REFRESHED" && session) {
                setAccessToken(session.access_token);
            } else if (event === "SIGNED_OUT") {
                setUserId(undefined);
                setAccessToken(undefined);
                setUserName(undefined);
                setFavorites([]);
                setChatHistory([]);
                setShowProfileSetup(false);
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    // ---------------------------
    // Load favorites when token changes (with guard)
    // ---------------------------
    const lastFavTokenRef = useRef<string | null>(null);
    useEffect(() => {
        if (!accessToken || accessToken.trim().length < 20) return;
        if (lastFavTokenRef.current === accessToken) return;
        lastFavTokenRef.current = accessToken;

        loadFavoritesFromDb();
    }, [accessToken]);

    // ---------------------------
    // Login/Profile handlers
    // ---------------------------
    const handleLoginSuccess = async (newUserId: string, newAccessToken: string) => {
        setUserId(newUserId);
        setAccessToken(newAccessToken);
        setShowLogin(false);
        loadUserProfile(newUserId);
    };

    const handleProfileComplete = (fullName: string) => {
        setUserName(fullName);
        setShowProfileSetup(false);
        toast.success(`Willkommen ${fullName}!`);
    };

    const handleLogout = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) toast.error("Fehler beim Abmelden");
        } catch (e) {
            console.error("Logout error:", e);
            toast.error("Fehler beim Abmelden");
        }
    };

    // ---------------------------
    // Filters + Search
    // ---------------------------
    const handleFilterChange = useCallback((newFilters: RecipeFilters) => {
        setFilters(newFilters);
    }, []);

    const handleSearchResults = (results: any) => {
        if (!results.recipes || results.recipes.length === 0) return;

        const finalSeenNames = new Set<string>();
        const finalUniqueRecipes = results.recipes.filter((recipe: Recipe) => {
            if (finalSeenNames.has(recipe.name)) return false;
            finalSeenNames.add(recipe.name);
            return true;
        });

        setChatHistory((prev) => [
            ...prev,
            { type: "user", query: results.query, timestamp: new Date() },
            { type: "ai", recipes: finalUniqueRecipes, timestamp: new Date() },
        ]);
    };

    const handleBackToHome = () => setChatHistory([]);

    // Scroll-to-Top
    useEffect(() => {
        const handleScroll = () => {
            if (contentRef.current) setShowScrollTop(contentRef.current.scrollTop > 300);
        };

        const content = contentRef.current;
        if (content) {
            content.addEventListener("scroll", handleScroll);
            return () => content.removeEventListener("scroll", handleScroll);
        }
    }, []);

    const scrollToTop = () => {
        contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    };

    // Mobile detection
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    // ---------------------------
    // Screens
    // ---------------------------
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gradient-to-br from-[#fef7f3] via-[#ffede6] to-[#ffe8d6]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6b35] mx-auto mb-4" />
                    <p className="text-muted-foreground">Lade...</p>
                </div>
            </div>
        );
    }

    if (showLogin) {
        return <LoginPage onBack={() => setShowLogin(false)} onLoginSuccess={handleLoginSuccess} />;
    }

    if (showProfileSetup && userId && accessToken) {
        return <ProfileSetup userId={userId} accessToken={accessToken} onComplete={handleProfileComplete} />;
    }

    return (
        <ErrorBoundary>
            <Toaster position="top-center" richColors />

            <div className={`flex h-screen overflow-hidden ${isMobile ? "flex-col" : ""}`}>
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
                            backgroundPosition: "center",
                            backgroundSize: "50%",
                            backgroundRepeat: "no-repeat",
                            backgroundBlendMode: "overlay",
                        }}
                    >
                        <div
                            className="absolute inset-0 bg-gradient-to-br from-[#fef7f3]/95 via-[#ffede6]/90 to-[#ffe8d6]/95"
                            style={{ zIndex: 0 }}
                        />

                        <div ref={contentRef} className="flex-1 overflow-y-auto relative z-10 scroll-smooth">
                            {isSearching ? (
                                <div className="w-full max-w-5xl mx-auto px-6 pt-4">
                                    <RecipeSkeleton />
                                </div>
                            ) : chatHistory.length > 0 ? (
                                <RecipeResults chatHistory={chatHistory} onAddToFavorites={addFavorite} onBack={handleBackToHome} />
                            ) : userName ? (
                                <div className="h-full flex flex-col items-center justify-center gap-6 px-8">
                                    <h2
                                        className="text-3xl md:text-5xl bg-gradient-to-r from-[#ff6b35] via-[#ff8c5a] to-[#ff9966] bg-clip-text text-transparent drop-shadow-2xl animate-fade-in text-center"
                                        style={{ fontFamily: "var(--font-welcome)" }}
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
                                        style={{ fontFamily: "var(--font-welcome)" }}
                                    >
                                        Entdecke köstliche Rezepte
                                    </h2>
                                    <p className="text-base md:text-lg text-muted-foreground max-w-2xl text-center animate-fade-in-delayed">
                                        Melde dich an, um deine Favoriten zu speichern und personalisierte Empfehlungen zu erhalten
                                    </p>
                                </div>
                            )}
                        </div>

                        {showScrollTop && (
                            <Button
                                onClick={scrollToTop}
                                size="icon"
                                className="fixed bottom-24 right-8 z-20 rounded-full shadow-2xl bg-gradient-to-r from-[#ff6b35] to-[#ff8c5a] hover:from-[#ff8c5a] hover:to-[#ffb085] animate-fade-in"
                            >
                                <ArrowUp size={20} />
                            </Button>
                        )}

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