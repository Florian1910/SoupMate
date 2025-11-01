import { Search, Clock, X, History, Loader2 } from "lucide-react";
import { Input } from "./ui/input";
import { useState, useEffect, useRef } from "react";
import { RecipeFilters } from "./Sidebar";
import { API_CONFIG, DEV_MODE } from '../config';
import { toast } from "sonner@2.0.3";
import { publicAnonKey } from '../utils/supabase/info';

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
    if (onSearchStart) onSearchStart();

    try {
      let data;

      if (DEV_MODE.useMockData) {
        // Mock-Modus: Verwende Test-Daten
        await new Promise(resolve => setTimeout(resolve, DEV_MODE.mockDelay));
        data = getMockRecipes(term, filters);
      } else {
        // Produktiv-Modus: Rufe dein eigenes Backend auf
        const response = await fetch(
          `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.search}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${publicAnonKey}`
            },
            body: JSON.stringify({
              query: term,
              filters: filters
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          console.error(`Search API error: ${response.status} - ${errorData.error}`);
          throw new Error(errorData.error || 'Suche fehlgeschlagen');
        }

        data = await response.json();
      }

      if (onSearchResults) {
        onSearchResults({
          query: term,
          recipes: data.recipes || [data.recipe] // Support both multiple recipes and single recipe
        });
      }
    } catch (error) {
      console.error(`Error during search: ${error}`);
      toast.error(`Fehler bei der Suche: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsSearching(false);
      if (onSearchEnd) onSearchEnd();
    }
  };

  // Mock-Daten für Entwicklung/Testing
  const getMockRecipes = (query: string, filters: RecipeFilters | null) => {
    const allMockRecipes = [
      {
        id: "1",
        name: "Cremige Tomatensuppe",
        description: "Eine klassische, samtige Tomatensuppe mit frischen Kräutern und einem Hauch von Knoblauch. Diese Suppe ist perfekt für kalte Tage und wird mit frischen Tomaten zubereitet, die mit aromatischem Basilikum und würzigem Knoblauch kombiniert werden. Die cremige Textur wird durch die Zugabe von Sahne erreicht, die der Suppe eine seidige Konsistenz verleiht.",
        fullDescription: "Diese cremige Tomatensuppe ist ein zeitloser Klassiker, der sowohl einfach zuzubereiten als auch unglaublich schmackhaft ist. Die Kombination aus frischen Tomaten, aromatischem Basilikum und einer Prise Knoblauch schafft ein harmonisches Geschmackserlebnis. Die Suppe wird zunächst mit einer Basis aus angeschwitzten Zwiebeln und Knoblauch vorbereitet, was ihr eine tiefe, würzige Note verleiht. Anschließend werden die Tomaten hinzugefügt und sanft gekocht, bis sie ihre natürliche Süße freisetzen. Nach dem Pürieren wird die Suppe mit frischer Sahne verfeinert, die ihr eine luxuriöse, samtige Textur verleiht. Diese Suppe ist perfekt als Vorspeise oder als leichtes Hauptgericht und lässt sich wunderbar mit frischem Baguette oder Knoblauchbrot servieren.",
        difficulty: 2,
        workTime: 15,
        totalTime: 30,
        servings: 4,
        ingredients: ["400g frische Tomaten", "200ml Sahne", "3 Stängel frisches Basilikum", "2 Knoblauchzehen", "1 große Zwiebel", "500ml Gemüsebrühe", "2 EL Olivenöl", "Salz und Pfeffer nach Geschmack", "1 Prise Zucker"],
        instructions: [
          "Die Zwiebeln schälen und fein würfeln. Den Knoblauch schälen und fein hacken.",
          "In einem großen Topf das Olivenöl bei mittlerer Hitze erhitzen. Die Zwiebeln darin glasig anschwitzen (ca. 3-4 Minuten).",
          "Den gehackten Knoblauch hinzufügen und weitere 1-2 Minuten unter Rühren anschwitzen, bis er duftet.",
          "Die Tomaten grob würfeln und zusammen mit der Gemüsebrühe in den Topf geben. Eine Prise Zucker hinzufügen, um die natürliche Säure der Tomaten auszugleichen.",
          "Alles zum Kochen bringen, dann die Hitze reduzieren und die Suppe bei niedriger Hitze 15 Minuten köcheln lassen, bis die Tomaten weich sind.",
          "Die Basilikumblätter von den Stängeln zupfen und zur Suppe geben (ein paar Blätter für die Garniture beiseitelegen).",
          "Die Suppe mit einem Pürierstab fein pürieren, bis eine glatte Konsistenz erreicht ist. Alternativ kann auch ein Standmixer verwendet werden.",
          "Die Sahne einrühren und die Suppe nochmals kurz erwärmen, aber nicht mehr kochen lassen.",
          "Mit Salz und Pfeffer abschmecken und nach Bedarf nachwürzen.",
          "Die Suppe in vorgewärmte Schalen füllen, mit den beiseitegelegten Basilikumblättern garnieren und heiß servieren."
        ],
        isVegan: false,
        isVegetarian: true,
        allergens: ["Laktose"]
      },
      {
        id: "2",
        name: "Karottensuppe mit Ingwer",
        description: "Eine wärmende Karottensuppe mit einem Hauch von frischem Ingwer und Kokosmilch. Diese Suppe ist nicht nur köstlich, sondern auch reich an Vitaminen und perfekt für eine gesunde Ernährung.",
        fullDescription: "Diese aromatische Karottensuppe vereint die natürliche Süße von Karotten mit der würzigen Schärfe von frischem Ingwer und der Cremigkeit von Kokosmilch. Die Suppe ist ein perfektes Beispiel dafür, wie einfache Zutaten zu einem außergewöhnlichen Geschmackserlebnis werden können. Die Karotten werden mit Zwiebeln und Ingwer angebraten, was ihnen eine tiefere Geschmacksebene verleiht, bevor sie in aromatischer Gemüsebrühe gegart werden. Die Zugabe von Kokosmilch am Ende verleiht der Suppe eine seidige Textur und einen exotischen Touch. Diese Suppe ist ideal als Vorspeise oder als leichtes Hauptgericht und lässt sich hervorragend mit Koriander und gerösteten Kürbiskernen garnieren.",
        difficulty: 2,
        workTime: 15,
        totalTime: 35,
        servings: 4,
        ingredients: ["600g Karotten", "1 große Zwiebel", "3cm frischer Ingwer", "400ml Kokosmilch", "600ml Gemüsebrühe", "2 EL Olivenöl", "1 Knoblauchzehe", "Salz und Pfeffer", "Frischer Koriander zum Garnieren", "Geröstete Kürbiskerne optional"],
        instructions: [
          "Die Karotten schälen und in gleichmäßige Stücke schneiden. Die Zwiebel schälen und würfeln. Den Ingwer schälen und fein reiben oder hacken.",
          "In einem großen Topf das Olivenöl bei mittlerer Hitze erhitzen. Die Zwiebeln darin 4-5 Minuten glasig anschwitzen.",
          "Den geriebenen Ingwer und den gehackten Knoblauch hinzufügen und 1-2 Minuten unter Rühren anschwitzen, bis der Duft aufsteigt.",
          "Die Karottenstücke hinzufügen und 3-4 Minuten mitbraten, dabei gelegentlich umrühren.",
          "Mit der Gemüsebrühe ablöschen und alles zum Kochen bringen. Die Hitze reduzieren und die Suppe zugedeckt 20 Minuten köcheln lassen, bis die Karotten sehr weich sind.",
          "Die Kokosmilch hinzufügen und alles mit einem Pürierstab fein pürieren, bis eine cremige, glatte Konsistenz erreicht ist.",
          "Mit Salz und Pfeffer abschmecken. Bei Bedarf noch etwas Gemüsebrühe hinzufügen, wenn die Suppe zu dick ist.",
          "Die Suppe in Schalen füllen, mit frisch gehacktem Koriander bestreuen und optional mit gerösteten Kürbiskernen garnieren.",
          "Heiß servieren, am besten mit frischem Brot oder Naan."
        ],
        isVegan: true,
        isVegetarian: true,
        allergens: []
      },
      {
        id: "3",
        name: "Klassische Kürbissuppe",
        description: "Eine herbstliche Kürbissuppe mit einem Hauch von Muskatnuss und cremiger Kokosmilch. Diese Suppe ist perfekt für die kalte Jahreszeit und vereint süßliche und würzige Aromen.",
        fullDescription: "Diese klassische Kürbissuppe ist der Inbegriff von Herbstkomfort. Der Hokkaido-Kürbis, der nicht geschält werden muss, verleiht der Suppe eine natürliche Süße und eine wunderschöne orange Farbe. Die Kombination aus aromatischen Gewürzen wie Muskatnuss und Kreuzkümmel sowie der cremigen Kokosmilch schafft ein perfektes Gleichgewicht zwischen süß und würzig. Die Suppe wird durch das Rösten des Kürbisses intensiviert, was ihm eine tiefere, karamellisierte Note verleiht. Diese Suppe ist nicht nur lecker, sondern auch sehr nahrhaft und reich an Vitaminen. Sie eignet sich hervorragend als Vorspeise oder als leichtes Hauptgericht und kann mit gerösteten Kürbiskernen, Croutons oder einem Klecks Schmand serviert werden.",
        difficulty: 2,
        workTime: 20,
        totalTime: 45,
        servings: 4,
        ingredients: ["1 Hokkaido-Kürbis (ca. 1kg)", "1 große Zwiebel", "2 Knoblauchzehen", "800ml Gemüsebrühe", "200ml Kokosmilch", "2 EL Olivenöl", "1/2 TL Muskatnuss", "1/2 TL Kreuzkümmel", "Salz und Pfeffer", "Kürbiskerne zum Garnieren", "Petersilie optional"],
        instructions: [
          "Den Backofen auf 200°C vorheizen. Den Hokkaido-Kürbis waschen, halbieren und die Kerne entfernen (die Schale kann dranbleiben).",
          "Den Kürbis in ca. 3cm große Würfel schneiden und auf einem Backblech mit 1 EL Olivenöl, Salz und Pfeffer vermengen.",
          "Den Kürbis im Ofen 25-30 Minuten rösten, bis er weich und leicht karamellisiert ist.",
          "Währenddessen die Zwiebel schälen und würfeln, den Knoblauch schälen und hacken.",
          "In einem großen Topf das restliche Olivenöl erhitzen und die Zwiebeln darin 4-5 Minuten glasig anschwitzen.",
          "Den Knoblauch, Muskatnuss und Kreuzkümmel hinzufügen und 1-2 Minuten unter Rühren anschwitzen.",
          "Den gerösteten Kürbis in den Topf geben und mit der Gemüsebrühe ablöschen. Alles zum Kochen bringen.",
          "Die Suppe 10 Minuten köcheln lassen, dann die Kokosmilch hinzufügen.",
          "Alles mit einem Pürierstab fein pürieren, bis eine cremige Konsistenz erreicht ist.",
          "Mit Salz, Pfeffer und eventuell noch etwas Muskatnuss abschmecken.",
          "Die Suppe in Schalen füllen und mit gerösteten Kürbiskernen und frischer Petersilie garnieren. Heiß servieren."
        ],
        isVegan: true,
        isVegetarian: true,
        allergens: []
      },
      {
        id: "4",
        name: "Französische Zwiebelsuppe",
        description: "Eine herzhafte französische Zwiebelsuppe mit karamellisierten Zwiebeln und überbackenem Käse. Ein klassisches Bistro-Gericht, das warm und sättigend ist.",
        fullDescription: "Die französische Zwiebelsuppe ist ein zeitloser Klassiker der französischen Küche. Das Geheimnis dieser Suppe liegt in den langsam karamellisierten Zwiebeln, die eine tiefe, süßliche Note entwickeln. Dieser Prozess dauert zwar etwas länger, ist aber entscheidend für den authentischen Geschmack. Die Zwiebeln werden mit Weißwein abgelöscht und dann mit einer kräftigen Rinderbrühe aufgegossen. Die Suppe wird traditionell mit einer Scheibe geröstetem Baguette und reichlich Gruyère-Käse überbacken, was ihr eine knusprige, goldene Kruste verleiht. Diese Suppe ist perfekt für kalte Winterabende und ein echtes Comfort Food.",
        difficulty: 3,
        workTime: 25,
        totalTime: 50,
        servings: 4,
        ingredients: ["6 große Zwiebeln", "3 EL Butter", "1 EL Zucker", "150ml Weißwein", "1,5L Rinderbrühe oder Gemüsebrühe", "2 Lorbeerblätter", "1 TL Thymian", "4 Scheiben Baguette", "200g Gruyère-Käse gerieben", "Salz und Pfeffer", "2 Knoblauchzehen"],
        instructions: [
          "Die Zwiebeln schälen und in dünne Halbringe schneiden.",
          "In einem großen, ofenfesten Topf die Butter bei mittlerer Hitze schmelzen lassen.",
          "Die Zwiebelringe hinzufügen und mit dem Zucker bestreuen. Dies hilft beim Karamellisieren.",
          "Die Zwiebeln unter häufigem Rühren 25-30 Minuten garen, bis sie goldbraun und karamellisiert sind. Geduld ist hier wichtig!",
          "Den gehackten Knoblauch hinzufügen und 1-2 Minuten mitbraten.",
          "Mit dem Weißwein ablöschen und die Flüssigkeit um die Hälfte reduzieren lassen (ca. 3-4 Minuten).",
          "Die Brühe, Lorbeerblätter und Thymian hinzufügen. Alles zum Kochen bringen, dann die Hitze reduzieren und 20 Minuten köcheln lassen.",
          "Mit Salz und Pfeffer abschmecken. Die Lorbeerblätter entfernen.",
          "Den Backofen-Grill auf höchster Stufe vorheizen.",
          "Das Baguette in Scheiben schneiden und kurz toasten. Optional mit Knoblauch einreiben.",
          "Die Suppe in ofenfeste Schalen füllen, eine Baguettescheibe darauflegen und großzügig mit geriebenem Gruyère bestreuen.",
          "Die Schalen unter dem Grill 3-5 Minuten überbacken, bis der Käse geschmolzen und goldbraun ist.",
          "Heiß servieren und vorsichtig genießen!"
        ],
        isVegan: false,
        isVegetarian: false,
        allergens: ["Gluten", "Laktose"]
      },
      {
        id: "5",
        name: "Thailändische Tom Kha Gai Suppe",
        description: "Eine aromatische thailändische Kokossuppe mit Hühnchen, Galgant und Zitronengras. Diese Suppe vereint süße, saure, salzige und scharfe Aromen in perfekter Balance.",
        fullDescription: "Tom Kha Gai ist eine der beliebtesten thailändischen Suppen und ein wahres Geschmackserlebnis. Die cremige Kokosmilch bildet die Basis dieser Suppe und wird mit aromatischen Zutaten wie Galgant, Zitronengras und Kaffernlimettenblättern verfeinert. Das Hühnchen wird sanft in der Suppe gegart und nimmt alle Aromen auf. Die Kombination aus der Säure des Limettensafts, der Schärfe der Chilischoten und der süßlichen Kokosmilch schafft ein perfektes Gleichgewicht. Pilze und Kirschtomaten fügen zusätzliche Textur und Frische hinzu. Diese Suppe ist ein perfektes Beispiel für die komplexe, aber harmonische Geschmackspalette der thailändischen Küche.",
        difficulty: 3,
        workTime: 20,
        totalTime: 35,
        servings: 4,
        ingredients: ["400g Hähnchenbrustfilet", "600ml Kokosmilch", "400ml Hühnerbrühe", "3 Stängel Zitronengras", "4cm Galgant (oder Ingwer)", "6 Kaffernlimettenblätter", "200g Champignons", "150g Kirschtomaten", "3 Thai-Chilis", "3 EL Fischsauce", "2 EL Zucker", "Saft von 2 Limetten", "Frischer Koriander"],
        instructions: [
          "Das Hähnchenbrustfilet in mundgerechte Stücke schneiden und beiseitestellen.",
          "Das Zitronengras in ca. 5cm lange Stücke schneiden und mit einem Messerrücken leicht andrücken, um die Aromen freizusetzen.",
          "Den Galgant (oder Ingwer) in dünne Scheiben schneiden. Die Kaffernlimettenblätter leicht einreißen.",
          "Die Pilze in Scheiben schneiden, die Kirschtomaten halbieren.",
          "In einem großen Topf die Hühnerbrühe zum Kochen bringen. Das Zitronengras, den Galgant und die Kaffernlimettenblätter hinzufügen.",
          "Die Hitze reduzieren und 5 Minuten köcheln lassen, damit sich die Aromen entfalten können.",
          "Die Kokosmilch hinzufügen und vorsichtig erwärmen (nicht kochen, da die Kokosmilch sonst gerinnen kann).",
          "Die Hähnchenstücke und Pilze hinzufügen und 8-10 Minuten bei niedriger Hitze garen, bis das Hühnchen durchgegart ist.",
          "Die Kirschtomaten, Thai-Chilis (ganz oder in Scheiben geschnitten, je nach gewünschter Schärfe), Fischsauce und Zucker hinzufügen.",
          "Weitere 3-4 Minuten köcheln lassen. Die Suppe sollte nicht mehr kochen.",
          "Vom Herd nehmen und den Limettensaft einrühren. Mit Fischsauce und Zucker abschmecken.",
          "Die großen Aromastoffe (Zitronengras, Galgant, Kaffernlimettenblätter) können drin bleiben, sollten aber nicht mitgegessen werden.",
          "Die Suppe in Schalen füllen und mit frischem Koriander garnieren. Mit Jasminreis servieren."
        ],
        isVegan: false,
        isVegetarian: false,
        allergens: ["Fisch"]
      },
      {
        id: "6",
        name: "Linsensuppe nach Dal-Art",
        description: "Eine würzige indische Linsensuppe mit Kurkuma, Kreuzkümmel und Kokosmilch. Diese nahrhafte Suppe ist reich an Proteinen und voller aromatischer Gewürze.",
        fullDescription: "Diese indisch inspirierte Linsensuppe, auch bekannt als Dal, ist ein Grundnahrungsmittel der indischen Küche. Die roten Linsen zerfallen beim Kochen und schaffen eine natürlich cremige Textur. Die Suppe wird mit einer Vielzahl von Gewürzen wie Kurkuma, Kreuzkümmel, Koriander und Garam Masala zubereitet, die ihr ein komplexes, wärmendes Aroma verleihen. Die Zugabe von Kokosmilch macht die Suppe besonders cremig und mildert die Schärfe ab. Ein Tempern (Tadka) aus Zwiebeln, Knoblauch und Gewürzen am Ende verleiht der Suppe eine zusätzliche Geschmacksebene. Diese Suppe ist nicht nur unglaublich lecker, sondern auch sehr nahrhaft und perfekt für eine gesunde, pflanzliche Ernährung.",
        difficulty: 2,
        workTime: 15,
        totalTime: 35,
        servings: 4,
        ingredients: ["250g rote Linsen", "1 große Zwiebel", "3 Knoblauchzehen", "2cm frischer Ingwer", "400ml Kokosmilch", "600ml Gemüsebrühe", "2 EL Olivenöl oder Ghee", "1 TL Kurkuma", "1 TL Kreuzkümmel gemahlen", "1 TL Koriander gemahlen", "1/2 TL Garam Masala", "1 Dose gehackte Tomaten (400g)", "1 Handvoll Spinat", "Salz und Cayennepfeffer", "Frischer Koriander und Limettensaft zum Servieren"],
        instructions: [
          "Die roten Linsen in einem Sieb gründlich unter fließendem Wasser abspülen, bis das Wasser klar ist.",
          "Die Zwiebel schälen und fein würfeln. Knoblauch und Ingwer schälen und fein hacken.",
          "In einem großen Topf das Öl oder Ghee bei mittlerer Hitze erhitzen. Die Zwiebeln darin 5-6 Minuten anschwitzen, bis sie weich und leicht goldbraun sind.",
          "Knoblauch und Ingwer hinzufügen und 1-2 Minuten unter Rühren anschwitzen.",
          "Alle Gewürze (Kurkuma, Kreuzkümmel, Koriander, Garam Masala) hinzufügen und 30 Sekunden unter ständigem Rühren anrösten, damit sich die Aromen entfalten.",
          "Die abgespülten Linsen, die gehackten Tomaten und die Gemüsebrühe hinzufügen. Alles zum Kochen bringen.",
          "Die Hitze reduzieren und die Suppe 20-25 Minuten köcheln lassen, bis die Linsen sehr weich sind und beginnen zu zerfallen. Gelegentlich umrühren.",
          "Die Kokosmilch einrühren und weitere 5 Minuten köcheln lassen.",
          "Den Spinat hinzufügen und unterheben, bis er zusammengefallen ist.",
          "Mit Salz und Cayennepfeffer abschmecken. Für eine cremigere Konsistenz kann ein Teil der Suppe püriert werden.",
          "Die Suppe in Schalen füllen, mit frischem Koriander bestreuen und mit einem Spritzer Limettensaft servieren. Hervorragend mit Naan-Brot oder Basmatireis."
        ],
        isVegan: true,
        isVegetarian: true,
        allergens: []
      }
    ];

    // Filter anwenden
    let filteredRecipes = allMockRecipes;

    // Suchbegriff-Filter
    const searchLower = query.toLowerCase();
    filteredRecipes = filteredRecipes.filter(r => 
      r.name.toLowerCase().includes(searchLower) || 
      r.description.toLowerCase().includes(searchLower) ||
      r.ingredients.some(i => i.toLowerCase().includes(searchLower))
    );

    // Diet type filter
    if (filters?.dietType === "vegan") {
      filteredRecipes = filteredRecipes.filter(r => r.isVegan);
    } else if (filters?.dietType === "vegetarisch") {
      filteredRecipes = filteredRecipes.filter(r => r.isVegetarian);
    }

    // Difficulty filter
    if (filters?.difficulty && filters.difficulty > 0) {
      filteredRecipes = filteredRecipes.filter(r => r.difficulty === filters.difficulty);
    }

    // Work time filter
    if (filters?.workTime && (filters.workTime[0] !== 0 || filters.workTime[1] !== 120)) {
      filteredRecipes = filteredRecipes.filter(r => 
        r.workTime >= filters.workTime[0] && r.workTime <= filters.workTime[1]
      );
    }

    // Total time filter
    if (filters?.totalTime && (filters.totalTime[0] !== 0 || filters.totalTime[1] !== 240)) {
      filteredRecipes = filteredRecipes.filter(r => 
        r.totalTime >= filters.totalTime[0] && r.totalTime <= filters.totalTime[1]
      );
    }

    // Allergies filter
    if (filters?.allergies && filters.allergies.length > 0) {
      filteredRecipes = filteredRecipes.filter(r => 
        !r.allergens.some(allergen => filters.allergies.includes(allergen))
      );
    }

    // Ingredients filter
    if (filters?.ingredients && filters.ingredients.trim()) {
      const userIngredients = filters.ingredients.toLowerCase().split(',').map(i => i.trim());
      filteredRecipes = filteredRecipes.filter(r =>
        r.ingredients.some(ingredient =>
          userIngredients.some(ui => ingredient.toLowerCase().includes(ui))
        )
      );
    }

    // Servings filter - find recipes that can serve the requested number of people
    // We allow recipes with the same or more servings
    if (filters?.servings && filters.servings > 0) {
      filteredRecipes = filteredRecipes.filter(r => 
        r.servings && r.servings >= filters.servings
      );
    }

    // Wenn keine Rezepte den Filtern entsprechen, gib eine Fehlermeldung zurück
    if (filteredRecipes.length === 0) {
      return {
        recipe: {
          id: "no-results",
          name: "Keine Rezepte gefunden",
          description: "Leider wurden keine Rezepte gefunden, die alle deine Filter erfüllen. Versuche, einige Filter zurückzusetzen.",
          fullDescription: "Mit den aktuellen Filtereinstellungen konnten wir leider kein passendes Rezept finden. Bitte versuche Folgendes:\n\n• Setze einige Filter zurück\n• Erweitere deine Suchkriterien\n• Versuche eine andere Suchanfrage",
          difficulty: 0,
          workTime: 0,
          totalTime: 0,
          servings: 0,
          ingredients: [],
          instructions: ["Bitte passe deine Filtereinstellungen an und versuche es erneut."],
          isVegan: false,
          isVegetarian: false,
          allergens: []
        }
      };
    }
    
    // Return top 5 matching recipes
    const topMatches = filteredRecipes.slice(0, 5);
    
    return {
      recipes: topMatches
    };
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

      {/* Search History Dropdown */}
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
