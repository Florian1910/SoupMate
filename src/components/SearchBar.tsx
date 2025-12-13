import { Search, Clock, X, History, Loader2 } from "lucide-react";
import { Input } from "./ui/input";
import { useState, useEffect, useRef } from "react";
import { RecipeFilters } from "./Sidebar";
import { API_CONFIG } from '../config';
import { toast } from "sonner@2.0.3";
import { supabase } from '../utils/supabase/client';

interface SearchBarProps {
    userName?: string;
    onSearchResults?: (results: any) => void;
    filters?: RecipeFilters;
    onSearchStart?: () => void;
    onSearchEnd?: () => void;
}

export function SearchBar({ userName, onSearchResults, filters, onSearchStart, onSearchEnd }: SearchBarProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [searchHistory, setSearchHistory] = useState<string[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Load search history from localStorage
    useEffect(() => {
        const storageKey = userName ? `searchHistory_${userName}` : "searchHistory_guest";
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            try {
                setSearchHistory(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to load search history:", e);
            }
        }
    }, [userName]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowHistory(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSearch = async (term: string) => {
        if (!term.trim()) return;

        const storageKey = userName ? `searchHistory_${userName}` : "searchHistory_guest";
        const newHistory = [term, ...searchHistory.filter(h => h !== term)].slice(0, 10);
        setSearchHistory(newHistory);
        localStorage.setItem(storageKey, JSON.stringify(newHistory));
        setShowHistory(false);
        setIsSearching(true);
        onSearchStart?.();

        // 🔥 ERSTE MELDUNG: Abfrage gestartet
        toast.success('Abfrage gestartet – Datenbank wird angefragt…');

        let accessToken: string | undefined;

        try {
            // Geschützt: User-Token holen
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

            if (sessionError) {
                console.error('Session error:', sessionError);
                toast.error('Fehler beim Laden der Sitzung');
                return;
            }

            accessToken = sessionData?.session?.access_token;

            if (!accessToken) {
                console.warn('No access token found, user might not be logged in');
                toast.error('Bitte einloggen, um die Suche zu verwenden.');
                return;
            }

            const payload: any = {
                k: 5,
                type: 'text',
                query: term,
                filters: {
                    dietType: filters?.dietType || "alle",
                    difficulty: filters?.difficulty || 0,
                    totalTime: filters?.totalTime || [0, 240],
                    allergies: filters?.allergies || [],
                    ingredients: filters?.ingredients || ""
                }
            };

            console.log('🔍 Search request with filters:', payload);

            const url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.search}`;

            // Request an Edge Function
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (parseError) {
                    errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
                }

                console.error(`Search API error: ${response.status}`, errorData);

                if (response.status === 401) {
                    throw new Error('Nicht autorisiert. Bitte erneut einloggen.');
                } else if (response.status === 500) {
                    throw new Error('Server-Fehler. Bitte später erneut versuchen.');
                } else {
                    throw new Error(errorData.error || errorData.message || 'Suche fehlgeschlagen');
                }
            }

            // Antwort lesen & normalisieren
            const raw = await response.json();
            const items = (raw.recipes ?? raw.results ?? []) as any[];

            // Normalize Funktion
            const normalize = (r: any) => {
                // Verarbeite Zutaten - unterstütze verschiedene Formate
                let normalizedIngredients = [];

                if (r.ingredients && Array.isArray(r.ingredients)) {
                    normalizedIngredients = r.ingredients.map((ing: any) => {
                        if (typeof ing === 'string') {
                            return ing;
                        }
                        if (ing.name) {
                            let ingredientText = '';

                            if (ing.quantity_text) {
                                ingredientText = ing.quantity_text;
                            } else if (ing.amount && ing.unit) {
                                ingredientText = `${ing.amount} ${ing.unit} ${ing.name}`;
                            } else if (ing.amount) {
                                ingredientText = `${ing.amount} ${ing.name}`;
                            } else {
                                ingredientText = ing.name;
                            }

                            return {
                                name: ing.name,
                                display: ingredientText
                            };
                        }
                        return String(ing);
                    }).filter(Boolean);
                }

                return {
                    id: r.recipe_id ?? r.id ?? String(Math.random()),
                    name: r.name ?? 'Untitled',
                    description: r.description ?? '',
                    fullDescription: r.fullDescription ?? (Array.isArray(r.instructions) ? r.instructions.join('\n') : r.instructions),
                    difficulty: r.difficulty ?? 2,
                    workTime: r.work_time ?? r.workTime ?? undefined,
                    totalTime: r.total_time ?? r.totalTime ?? undefined,
                    servings: r.servings ?? undefined,
                    ingredients: normalizedIngredients,
                    instructions: Array.isArray(r.instructions) ? r.instructions : (r.instructions ? [r.instructions] : []),
                    isVegan: r.vegan ?? r.isVegan ?? false,
                    isVegetarian: r.vegetarian ?? r.isVegetarian ?? false,
                    allergens: r.allergens ?? [],
                    imageUrl: r.image_url,
                    calories: r.calories,
                    protein: r.protein,
                    carbohydrates: r.carbohydrates,
                    fat: r.fat
                };
            };

            const normalized = items.map(normalize);

            // 🔥 DUPLIKATE ENTFERNEN
            const seenNames = new Set();
            const uniqueNormalized = normalized.filter(recipe => {
                if (seenNames.has(recipe.name)) {
                    return false;
                }
                seenNames.add(recipe.name);
                return true;
            });

            // 🔥 ZWEITE MELDUNG: Datenbank-Abfrage OK
            toast.success(`Datenbank-Abfrage OK: ${uniqueNormalized.length} Treffer`);

            onSearchResults?.({
                query: term,
                recipes: uniqueNormalized
            });

        } catch (error) {
            console.error(`Error during search:`, error);
            let errorMessage = 'Unbekannter Fehler';
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === 'string') {
                errorMessage = error;
            }
            toast.error(`Fehler bei der Suche: ${errorMessage}`);
        } finally {
            setIsSearching(false);
            onSearchEnd?.();
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            handleSearch(searchTerm);
        }
    };

    const selectHistoryItem = (item: string) => {
        setSearchTerm(item);
        handleSearch(item);
    };

    const removeHistoryItem = (item: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const storageKey = userName ? `searchHistory_${userName}` : "searchHistory_guest";
        const newHistory = searchHistory.filter(h => h !== item);
        setSearchHistory(newHistory);
        localStorage.setItem(storageKey, JSON.stringify(newHistory));
    };

    const clearHistory = () => {
        const storageKey = userName ? `searchHistory_${userName}` : "searchHistory_guest";
        setSearchHistory([]);
        localStorage.removeItem(storageKey);
    };

    return (
        <div className="relative w-full max-w-2xl" ref={containerRef}>
            <div className="flex gap-3">
                <div className="relative flex-1">
                    {isSearching ? (
                        <Loader2 className="absolute left-5 top-1/2 -translate-y-1/2 text-primary z-10 animate-spin" size={20} />
                    ) : (
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-primary z-10" size={20} />
                    )}
                    <Input
                        type="text"
                        placeholder="Nach Rezepten suchen..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onFocus={() => setShowHistory(true)}
                        onKeyPress={handleKeyPress}
                        disabled={isSearching}
                        className="pl-14 pr-4 h-12 border-2 border-primary/30 focus-visible:border-primary rounded-xl shadow-xl bg-gradient-to-r from-white to-orange-50/50 focus-visible:shadow-2xl transition-all duration-300 disabled:opacity-60 w-full"
                    />
                </div>
                <button
                    onClick={() => handleSearch(searchTerm)}
                    disabled={isSearching || !searchTerm.trim()}
                    className="px-6 h-12 bg-gradient-to-r from-[#ff6b35] to-[#ff8c5a] hover:from-[#ff8c5a] hover:to-[#ffb085] text-white rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 whitespace-nowrap flex items-center gap-2"
                >
                    {isSearching ? (
                        <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Suchen...</span>
                        </>
                    ) : (
                        <span>Suchen</span>
                    )}
                </button>
            </div>

            {showHistory && searchHistory.length > 0 && (
                <div className="absolute top-full mt-2 left-0 bg-white rounded-xl shadow-2xl border-2 border-primary/20 overflow-hidden z-20" style={{ right: 'calc(5.5rem + 0.75rem)' }}>
                    <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-orange-50 to-orange-100/50 border-b border-primary/20">
                        <div className="flex items-center gap-2">
                            <History size={14} className="text-primary" />
                            <span className="text-xs text-primary/80">Suchverlauf</span>
                        </div>
                        <button
                            onClick={clearHistory}
                            className="text-xs text-primary/60 hover:text-primary transition-colors"
                        >
                            Löschen
                        </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                        {searchHistory.map((item, index) => (
                            <div
                                key={index}
                                onClick={() => selectHistoryItem(item)}
                                className="flex items-center justify-between px-4 py-2.5 hover:bg-orange-50/50 cursor-pointer transition-colors group"
                            >
                                <div className="flex items-center gap-3">
                                    <Clock size={14} className="text-primary/40" />
                                    <span className="text-sm text-foreground">{item}</span>
                                </div>
                                <button
                                    onClick={(e) => removeHistoryItem(item, e)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-primary/40 hover:text-primary"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}