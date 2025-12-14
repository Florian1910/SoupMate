import { useState, useCallback } from "react";
import {
  Star,
  Leaf,
  Heart,
  X,
  Clock,
  AlertCircle,
  ChefHat,
  UtensilsCrossed,
  Utensils,
} from "lucide-react";
import { Slider } from "./ui/slider";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";

type DietType = "alle" | "vegetarisch" | "vegan";

export interface Recipe {
  // WICHTIG: DB liefert recipe_id (PK)
  recipe_id?: string;

  // falls du irgendwo im Frontend noch id verwendest
  id?: string;

  name: string;
  difficulty: number;
  diet: DietType;
}

export interface RecipeFilters {
  dietType: DietType;
  difficulty: number;
  workTime: number[];
  totalTime: number[];
  allergies: string[];
  ingredients: string;
}

interface SidebarProps {
  isOpen: boolean;
  favorites: Recipe[];
  onRemoveFavorite: (recipeId: string) => void;
  onFilterChange?: (filters: RecipeFilters) => void;
}

export function Sidebar({
  isOpen,
  favorites,
  onRemoveFavorite,
  onFilterChange,
}: SidebarProps) {
  const [selectedDiet, setSelectedDiet] = useState<DietType>("alle");
  const [selectedDifficulty, setSelectedDifficulty] = useState<number>(0);
  const [workTime, setWorkTime] = useState<number[]>([0, 120]);
  const [totalTime, setTotalTime] = useState<number[]>([0, 240]);
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [ingredients, setIngredients] = useState<string>("");

  const notifyFilterChange = useCallback(
    (updates: Partial<RecipeFilters> = {}) => {
      if (onFilterChange) {
        const newFilters: RecipeFilters = {
          dietType: selectedDiet,
          difficulty: selectedDifficulty,
          workTime,
          totalTime,
          allergies: selectedAllergies,
          ingredients,
          ...updates,
        };
        console.log("🔄 Filter changed:", newFilters);
        onFilterChange(newFilters);
      }
    },
    [
      selectedDiet,
      selectedDifficulty,
      workTime,
      totalTime,
      selectedAllergies,
      ingredients,
      onFilterChange,
    ]
  );

  const handleDietChange = (diet: DietType) => {
    setSelectedDiet(diet);
    notifyFilterChange({ dietType: diet });
  };

  const handleDifficultyChange = (difficulty: number) => {
    setSelectedDifficulty(difficulty);
    notifyFilterChange({ difficulty });
  };

  const handleWorkTimeChange = (value: number[]) => {
    setWorkTime(value);
    notifyFilterChange({ workTime: value });
  };

  const handleTotalTimeChange = (value: number[]) => {
    setTotalTime(value);
    notifyFilterChange({ totalTime: value });
  };

  const handleAllergyToggle = (allergy: string) => {
    const newAllergies = selectedAllergies.includes(allergy)
      ? selectedAllergies.filter((a) => a !== allergy)
      : [...selectedAllergies, allergy];
    setSelectedAllergies(newAllergies);
    notifyFilterChange({ allergies: newAllergies });
  };

  const handleIngredientsChange = (value: string) => {
    setIngredients(value);
    notifyFilterChange({ ingredients: value });
  };

  const dietOptions: { value: DietType; label: string; icon: typeof Leaf }[] = [
    { value: "alle", label: "Alles", icon: Utensils },
    { value: "vegetarisch", label: "Vegetarisch", icon: Leaf },
    { value: "vegan", label: "Vegan", icon: Leaf },
  ];

  const commonAllergies = [
    "Gluten",
    "Laktose",
    "Nüsse",
    "Soja",
    "Eier",
    "Fisch",
    "Schalentiere",
    "Sellerie",
  ];

  const activeFilterCount = [
    selectedDiet !== "alle",
    selectedDifficulty > 0,
    workTime[0] !== 0 || workTime[1] !== 120,
    totalTime[0] !== 0 || totalTime[1] !== 240,
    selectedAllergies.length > 0,
    ingredients.trim() !== "",
  ].filter(Boolean).length;

  // ✅ Hilfsfunktion: immer eine echte ID für Favorites verwenden
  const getRecipeId = (recipe: Recipe) => recipe.recipe_id ?? recipe.id ?? "";

  return (
    <aside
      className={`${
        isOpen ? "w-80" : "w-0"
      } bg-gradient-to-b from-[#3d2817] via-[#5a3d2b] to-[#3d2817] text-white h-screen shadow-2xl overflow-x-hidden overflow-y-auto transition-all duration-300 ease-in-out relative`}
    >
      {isOpen && (
        <div className="px-5 pt-5 pb-3 border-b border-white/10 bg-gradient-to-r from-[#ff6b35]/10 to-transparent sticky top-0 z-10 bg-[#3d2817]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#ff8c5a]">Filter</h2>
            {activeFilterCount > 0 && (
              <Badge className="bg-[#ff6b35] hover:bg-[#ff6b35] text-white">
                {activeFilterCount}
              </Badge>
            )}
          </div>
        </div>
      )}

      <div
        className={`${
          isOpen ? "opacity-100" : "opacity-0"
        } transition-opacity duration-300`}
      >
        <Tabs defaultValue="filters" className="w-full">
          <TabsList className="w-full flex bg-white/5 mx-2 mt-3 mb-2 p-1">
            <TabsTrigger
              value="filters"
              className="data-[state=active]:bg-[#ff6b35] text-sm py-2 flex-1 flex items-center justify-center gap-1.5"
            >
              <UtensilsCrossed className="h-4 w-4 flex-shrink-0" />
              <span>Filter</span>
            </TabsTrigger>
            <TabsTrigger
              value="favorites"
              className="data-[state=active]:bg-[#ff6b35] text-sm py-2 flex-1 flex items-center justify-center gap-1.5"
            >
              <Heart className="h-4 w-4 flex-shrink-0" />
              <span>Favoriten</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="filters" className="mt-0">
            <nav className="space-y-4 px-4 py-3 pb-6">
              {/* Ernährung */}
              <div className="flex-shrink-0">
                <h3 className="mb-2 text-sm font-bold text-[#ff8c5a] tracking-wide uppercase">
                  Ernährung
                </h3>
                <div className="flex gap-2">
                  {dietOptions.map((option) => {
                    const IconComponent = option.icon;
                    return (
                      <button
                        key={option.value}
                        onClick={() => handleDietChange(option.value)}
                        className={`flex-1 px-3 py-2 rounded-lg transition-all duration-300 group ${
                          selectedDiet === option.value
                            ? "bg-[#ff6b35] text-white shadow-lg"
                            : "bg-white/5 hover:bg-white/10"
                        }`}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <IconComponent
                            size={18}
                            className={`${
                              selectedDiet === option.value
                                ? "text-white"
                                : option.value === "vegan"
                                ? "text-green-400"
                                : option.value === "vegetarisch"
                                ? "text-green-300"
                                : "text-orange-300"
                            } group-hover:scale-110 transition-transform`}
                          />
                          <span className="text-xs">{option.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Schwierigkeit */}
              <div className="flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-[#ff8c5a] tracking-wide uppercase flex-1">
                    Schwierigkeit
                  </h3>
                  {selectedDifficulty > 0 && (
                    <button
                      onClick={() => handleDifficultyChange(0)}
                      className="text-xs text-white/60 hover:text-[#ff6b35] transition-colors ml-2"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-center gap-1 px-3 py-2 bg-white/5 rounded-lg">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      key={`diff-${level}`}
                      onClick={() =>
                        handleDifficultyChange(level === selectedDifficulty ? 0 : level)
                      }
                      className="transition-transform duration-200 hover:scale-125 active:scale-110"
                    >
                      <Star
                        size={22}
                        className={`${
                          level <= selectedDifficulty
                            ? "fill-[#ff6b35] text-[#ff6b35]"
                            : "text-white/40 hover:text-[#ff6b35]/60"
                        } transition-all duration-200`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Zeit */}
              <div className="flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-[#ff8c5a] tracking-wide uppercase flex items-center gap-2 flex-1">
                    <Clock size={16} />
                    Zeit
                  </h3>
                  {((workTime[0] !== 0 || workTime[1] !== 120) ||
                    (totalTime[0] !== 0 || totalTime[1] !== 240)) && (
                    <button
                      onClick={() => {
                        handleWorkTimeChange([0, 120]);
                        handleTotalTimeChange([0, 240]);
                      }}
                      className="text-xs text-white/60 hover:text-[#ff6b35] transition-colors"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <div className="bg-white/5 rounded-lg p-3 space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-white/90 flex items-center gap-1.5">
                        <ChefHat size={14} />
                        Arbeitszeit
                      </span>
                      <span className="text-xs text-white/70">
                        {workTime[0]}-{workTime[1] === 120 ? "120+" : workTime[1]} Min
                      </span>
                    </div>
                    <Slider
                      value={workTime}
                      onValueChange={handleWorkTimeChange}
                      max={120}
                      min={0}
                      step={5}
                      className="[&_[role=slider]]:bg-[#ff6b35] [&_[role=slider]]:border-[#ff6b35]"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-white/90 flex items-center gap-1.5">
                        <Clock size={14} />
                        Gesamtzeit
                      </span>
                      <span className="text-xs text-white/70">
                        {totalTime[0]}-{totalTime[1] === 240 ? "240+" : totalTime[1]} Min
                      </span>
                    </div>
                    <Slider
                      value={totalTime}
                      onValueChange={handleTotalTimeChange}
                      max={240}
                      min={0}
                      step={10}
                      className="[&_[role=slider]]:bg-[#ff6b35] [&_[role=slider]]:border-[#ff6b35]"
                    />
                  </div>
                </div>
              </div>

              {/* Allergien */}
              <div className="flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-[#ff8c5a] tracking-wide uppercase flex items-center gap-2 flex-1">
                    <AlertCircle size={16} />
                    Allergien
                  </h3>
                  {selectedAllergies.length > 0 && (
                    <button
                      onClick={() => {
                        setSelectedAllergies([]);
                        notifyFilterChange({ allergies: [] });
                      }}
                      className="text-xs text-white/60 hover:text-[#ff6b35] transition-colors"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <div className="px-2 py-2 bg-white/5 rounded-lg space-y-2">
                  {commonAllergies.map((allergy) => (
                    <div key={allergy} className="flex items-center gap-2">
                      <Checkbox
                        id={allergy}
                        checked={selectedAllergies.includes(allergy)}
                        onCheckedChange={() => handleAllergyToggle(allergy)}
                        className="border-white/30 data-[state=checked]:bg-[#ff6b35] data-[state=checked]:border-[#ff6b35]"
                      />
                      <Label htmlFor={allergy} className="text-sm text-white/90 cursor-pointer">
                        {allergy}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Zutaten */}
              <div className="flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-[#ff8c5a] tracking-wide uppercase flex-1">
                    Zutaten
                  </h3>
                  {ingredients.trim() && (
                    <button
                      onClick={() => handleIngredientsChange("")}
                      className="text-xs text-white/60 hover:text-[#ff6b35] transition-colors"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <Input
                  type="text"
                  placeholder="z.B. Tomaten, Nudeln, Käse..."
                  value={ingredients}
                  onChange={(e) => handleIngredientsChange(e.target.value)}
                  className="bg-white/5 border-white/20 text-white placeholder:text-white/40 focus:border-[#ff6b35] focus:ring-[#ff6b35]"
                />
              </div>

              {/* Reset */}
              <div className="flex-shrink-0">
                <button
                  onClick={() => {
                    setSelectedDiet("alle");
                    setSelectedDifficulty(0);
                    setWorkTime([0, 120]);
                    setTotalTime([0, 240]);
                    setSelectedAllergies([]);
                    setIngredients("");
                    notifyFilterChange({
                      dietType: "alle",
                      difficulty: 0,
                      workTime: [0, 120],
                      totalTime: [0, 240],
                      allergies: [],
                      ingredients: "",
                    });
                  }}
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-[#ff6b35]/20 to-[#ff8c5a]/20 hover:from-[#ff6b35]/30 hover:to-[#ff8c5a]/30 text-white rounded-lg transition-all duration-300 border border-[#ff6b35]/30 hover:scale-105"
                >
                  <div className="flex items-center justify-center gap-2">
                    <X size={16} />
                    <span className="text-sm">Alle zurücksetzen</span>
                  </div>
                </button>
              </div>
            </nav>
          </TabsContent>

          <TabsContent value="favorites" className="mt-0">
            <div className="p-4 space-y-2 pb-6">
              {favorites.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <Heart size={48} className="mx-auto text-white/20" />
                  <p className="text-sm text-white/60 italic">Keine Favoriten gespeichert</p>
                  <p className="text-xs text-white/40">Klicke auf das Herz bei einem Rezept</p>
                </div>
              ) : (
                favorites.map((recipe) => {
                  const rid = getRecipeId(recipe);
                  return (
                    <div
                      key={`fav-${rid}`} // ✅ stable unique key
                      className="bg-white/5 hover:bg-white/10 rounded-lg p-3 transition-all duration-300 group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0 space-y-2">
                          <p className="text-sm truncate">{recipe.name}</p>

                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              {Array.from({ length: recipe.difficulty }).map((_, i) => (
                                <Star
                                  key={`star-${rid}-${i}`} // ✅ unique key
                                  size={12}
                                  className="fill-[#ff6b35] text-[#ff6b35]"
                                />
                              ))}
                            </div>

                            {recipe.diet === "vegan" && (
                              <span className="text-[10px] px-2 py-0.5 bg-green-500/80 rounded-full">
                                V
                              </span>
                            )}
                            {recipe.diet === "vegetarisch" && (
                              <span className="text-[10px] px-2 py-0.5 bg-green-400/80 rounded-full">
                                VG
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => onRemoveFavorite(rid)} // ✅ sends recipe_id
                          className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-white/60 hover:text-red-400 flex-shrink-0"
                          disabled={!rid}
                          title={!rid ? "Kein recipe_id vorhanden" : "Entfernen"}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </aside>
  );
}
