import { useState } from "react";
import { Clock, ChefHat, Heart, Star, ArrowLeft, Users, AlertCircle, MessageCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { motion, AnimatePresence } from "motion/react";

interface Recipe {
  id: string;
  name: string;
  description: string;
  fullDescription?: string;
  difficulty: number;
  prepTime?: string;
  workTime?: number;
  totalTime?: number;
  servings?: number;
  ingredients: string[];
  instructions: string[];
  isVegan: boolean;
  isVegetarian: boolean;
  allergens?: string[];
}

interface ChatMessage {
  type: 'user' | 'ai';
  query?: string;
  recipes?: Recipe[];
  timestamp: Date;
}

interface RecipeResultsProps {
  chatHistory: ChatMessage[];
  onAddToFavorites: (recipe: Recipe) => void;
  onBack?: () => void;
}

export function RecipeResults({ chatHistory, onAddToFavorites, onBack }: RecipeResultsProps) {
  const [expandedRecipeId, setExpandedRecipeId] = useState<string | null>(null);

  if (!chatHistory || chatHistory.length === 0) {
    return null;
  }

  const toggleRecipe = (recipeId: string) => {
    setExpandedRecipeId(expandedRecipeId === recipeId ? null : recipeId);
  };

  return (
    <div className="w-full flex flex-col py-4">
      {/* Header with Back Button */}
      <div className="w-full max-w-5xl mx-auto px-6 pb-3">
        <div className="bg-gradient-to-br from-white to-orange-50/30 rounded-xl shadow-lg p-4 border-2 border-primary/20">
          <div className="flex items-center gap-3">
            {onBack && (
              <Button
                onClick={onBack}
                variant="ghost"
                size="icon"
                className="hover:bg-primary/10 text-primary h-8 w-8"
              >
                <ArrowLeft size={20} />
              </Button>
            )}
            <div className="flex-1">
              <h2 className="text-xl bg-gradient-to-r from-[#ff6b35] via-[#ff8c5a] to-[#ff9966] bg-clip-text text-transparent">
                Rezept-Assistent
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Frage mich nach deinen Lieblings-Suppenrezepten
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="w-full max-w-5xl mx-auto px-6">
        <div className="space-y-4 pb-6">
          {chatHistory.map((message, index) => (
            <div key={index}>
              {message.type === 'user' ? (
                // User Message
                <div className="flex justify-end">
                  <div className="bg-gradient-to-r from-[#ff6b35] to-[#ff8c5a] text-white rounded-xl rounded-tr-sm px-4 py-3 max-w-xl shadow-lg">
                    <div className="flex items-start gap-2">
                      <MessageCircle size={16} className="mt-0.5 flex-shrink-0" />
                      <p className="text-sm">{message.query}</p>
                    </div>
                  </div>
                </div>
              ) : message.recipes && message.recipes.length > 0 ? (
                // AI Response with Multiple Recipe Cards
                <div className="flex justify-start">
                  <div className="max-w-4xl w-full space-y-3">
                    {message.recipes.map((recipe) => (
                      <motion.div
                        key={recipe.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <Card className="bg-gradient-to-br from-white to-orange-50/30 border-2 border-primary/20 shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300">
                          {/* Compact Card Header - Always Visible */}
                          <div 
                            className="p-4 cursor-pointer hover:bg-orange-50/30 transition-colors"
                            onClick={() => toggleRecipe(recipe.id)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 space-y-2">
                                {/* Title and Rating */}
                                <div className="flex items-center gap-3 flex-wrap">
                                  <h3 className="text-lg bg-gradient-to-r from-[#ff6b35] to-[#ff8c5a] bg-clip-text text-transparent">
                                    {recipe.name}
                                  </h3>
                                  <div className="flex items-center gap-0.5">
                                    {[...Array(5)].map((_, i) => (
                                      <Star
                                        key={i}
                                        size={14}
                                        className={i < recipe.difficulty ? "text-primary fill-primary" : "text-primary/30"}
                                      />
                                    ))}
                                  </div>
                                </div>

                                {/* Quick Info */}
                                <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                                  {recipe.workTime && (
                                    <div className="flex items-center gap-1">
                                      <ChefHat size={14} className="text-primary" />
                                      <span>{recipe.workTime}m</span>
                                    </div>
                                  )}
                                  {recipe.totalTime && (
                                    <div className="flex items-center gap-1">
                                      <Clock size={14} className="text-primary" />
                                      <span>{recipe.totalTime}m</span>
                                    </div>
                                  )}
                                  {recipe.servings && (
                                    <div className="flex items-center gap-1">
                                      <Users size={14} className="text-primary" />
                                      <span>{recipe.servings}P</span>
                                    </div>
                                  )}
                                </div>

                                {/* Short Description */}
                                <p className="text-sm text-muted-foreground line-clamp-2">{recipe.description}</p>

                                {/* Tags */}
                                <div className="flex flex-wrap gap-1.5">
                                  {recipe.isVegan && (
                                    <Badge className="bg-gradient-to-r from-green-500 to-green-600 text-white border-none text-xs">
                                      🌱 Vegan
                                    </Badge>
                                  )}
                                  {recipe.isVegetarian && !recipe.isVegan && (
                                    <Badge className="bg-gradient-to-r from-green-400 to-green-500 text-white border-none text-xs">
                                      🥬 Vegetarisch
                                    </Badge>
                                  )}
                                  {recipe.allergens && recipe.allergens.length > 0 && recipe.allergens.slice(0, 2).map((allergen, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs border-orange-300 text-orange-700">
                                      <AlertCircle size={10} className="mr-1" />
                                      {allergen}
                                    </Badge>
                                  ))}
                                  {recipe.allergens && recipe.allergens.length > 2 && (
                                    <Badge variant="outline" className="text-xs border-orange-300 text-orange-700">
                                      +{recipe.allergens.length - 2}
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {/* Right Side: Favorite Button and Expand Icon */}
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAddToFavorites({
                                      id: recipe.id,
                                      name: recipe.name,
                                      difficulty: recipe.difficulty,
                                      diet: recipe.isVegan ? "vegan" : recipe.isVegetarian ? "vegetarisch" : "alle"
                                    });
                                  }}
                                  variant="ghost"
                                  size="icon"
                                  className="hover:bg-primary/10 text-primary hover:scale-110 transition-all duration-300 h-8 w-8"
                                >
                                  <Heart size={18} />
                                </Button>
                                
                                <div className="text-primary">
                                  {expandedRecipeId === recipe.id ? (
                                    <ChevronUp size={20} />
                                  ) : (
                                    <ChevronDown size={20} />
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Expanded Details */}
                          <AnimatePresence>
                            {expandedRecipeId === recipe.id && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                className="overflow-hidden"
                              >
                                <div className="px-4 pb-4 border-t border-primary/10">
                                  <Tabs defaultValue="ingredients" className="w-full mt-4">
                                    <TabsList className="grid w-full grid-cols-3 bg-orange-50/50">
                                      <TabsTrigger value="description" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-white">
                                        Beschreibung
                                      </TabsTrigger>
                                      <TabsTrigger value="ingredients" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-white">
                                        Zutaten
                                      </TabsTrigger>
                                      <TabsTrigger value="instructions" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-white">
                                        Anleitung
                                      </TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="description" className="mt-3 space-y-2">
                                      {recipe.fullDescription && (
                                        <div className="bg-white/50 rounded-lg p-3 border border-primary/10">
                                          <p className="text-sm text-muted-foreground leading-relaxed">{recipe.fullDescription}</p>
                                        </div>
                                      )}
                                    </TabsContent>

                                    <TabsContent value="ingredients" className="mt-3 space-y-2">
                                      <div className="bg-white/50 rounded-lg p-3 border border-primary/10">
                                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                                          {recipe.ingredients.map((ingredient, idx) => (
                                            <li key={idx} className="flex items-start gap-2 text-sm">
                                              <span className="text-primary mt-0.5">•</span>
                                              <span className="text-muted-foreground">{ingredient}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    </TabsContent>

                                    <TabsContent value="instructions" className="mt-3 space-y-2">
                                      <div className="space-y-2">
                                        {recipe.instructions.map((instruction, idx) => (
                                          <div 
                                            key={idx} 
                                            className="flex gap-2 p-2.5 bg-white/50 rounded-lg border border-primary/10"
                                          >
                                            <div className="flex-shrink-0 w-6 h-6 bg-gradient-to-r from-[#ff6b35] to-[#ff8c5a] text-white rounded-full flex items-center justify-center text-xs">
                                              {idx + 1}
                                            </div>
                                            <p className="flex-1 text-sm text-muted-foreground leading-relaxed">
                                              {instruction}
                                            </p>
                                          </div>
                                        ))}
                                      </div>
                                    </TabsContent>
                                  </Tabs>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
