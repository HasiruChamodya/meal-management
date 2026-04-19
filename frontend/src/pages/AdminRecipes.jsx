import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Save, Plus, Trash2, Edit2, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = `${import.meta.env.VITE_API_BASE || "http://localhost:5050/api"}/recipes`;

// Helper function to get auth headers with token from sessionStorage for API requests
const getAuthHeaders = () => {
  const token = sessionStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
};

// Mapping to enforce base unit entry for bulk items
const UNIT_TO_BASE_LABEL = {
  "Kg": "g (Grams)",
  "g": "g (Grams)",
  "L": "ml (Milliliters)",
  "ml": "ml (Milliliters)",
};

const getBaseUnitLabel = (displayUnit) => {
  return UNIT_TO_BASE_LABEL[displayUnit] || displayUnit;
};

// Helper function to display the correct short unit in the table and form box
const getBaseUnitShort = (displayUnit) => {
  if (!displayUnit) return "";
  const map = {
    "Kg": "g",
    "L": "ml",
  };
  return map[displayUnit] || displayUnit;
};

// Main component for managing recipes and their ingredients, allowing admins to create, edit, and delete recipes and ingredients with a user-friendly interface. It includes dialogs for adding/editing recipes and ingredients, as well as a searchable dropdown for selecting items when adding/editing ingredients.
const AdminRecipes = () => {
  const { toast } = useToast();
  const [recipes, setRecipes] = useState([]); // List of all recipes
  const [selectedRecipeId, setSelectedRecipeId] = useState(""); // ID of the currently selected recipe
  const [ingredients, setIngredients] = useState([]); // List of ingredients for the selected recipe
  const [items, setItems] = useState([]); // List of all items available for selection as ingredients
  const [loading, setLoading] = useState(true); // Loading state for API calls
  const [recipeDialogOpen, setRecipeDialogOpen] = useState(false); // State to control visibility of the recipe add/edit dialog
  const [ingredientDialogOpen, setIngredientDialogOpen] = useState(false); // State to control visibility of the ingredient add/edit dialog
  const [ingredientSearchOpen, setIngredientSearchOpen] = useState(false);  // State to control visibility of the ingredient search dropdown
  const [editingRecipe, setEditingRecipe] = useState(null); // State to hold the recipe being edited, null when adding a new recipe
  const [newRecipe, setNewRecipe] = useState({ recipeKey: "", name: "" }); // State to hold the form data for adding/editing a recipe
  const [ingredientForm, setIngredientForm] = useState({itemId: "",
    normPerPatient: 0,
    unit: "g",
    editId: null,
  });

  const selectedRecipe = recipes.find((r) => String(r.id) === String(selectedRecipeId));
  const selectedIngredientItem = items.find((i) => String(i.id) === String(ingredientForm.itemId));

  const fetchRecipes = async () => {
    try {
      const res = await fetch(API_BASE, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch recipes");

      setRecipes(data.recipes || []);

      if (!selectedRecipeId && data.recipes?.length) {
        setSelectedRecipeId(String(data.recipes[0].id));
      }
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const fetchRecipeIngredients = async (recipeId) => {
    if (!recipeId) return;
    try {
      const res = await fetch(`${API_BASE}/${recipeId}/ingredients`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch ingredients");
      setIngredients(data.ingredients || []);
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const fetchItems = async () => {
    try {
      const res = await fetch(`${API_BASE}/items/list`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch items");
      setItems(data.items || []);
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchRecipes(), fetchItems()]);
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    if (selectedRecipeId) fetchRecipeIngredients(selectedRecipeId);
  }, [selectedRecipeId]);

  const openAddRecipe = () => {
    setEditingRecipe(null);
    setNewRecipe({ recipeKey: "", name: "" });
    setRecipeDialogOpen(true);
  };

  const openEditRecipe = () => {
    if (!selectedRecipe) return;
    setEditingRecipe(selectedRecipe);
    setNewRecipe({
      recipeKey: selectedRecipe.recipeKey,
      name: selectedRecipe.name,
    });
    setRecipeDialogOpen(true);
  };

  const saveRecipe = async () => {
    try {
      const url = editingRecipe ? `${API_BASE}/${editingRecipe.id}` : API_BASE;
      const method = editingRecipe ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(newRecipe),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save recipe");

      toast({
        title: editingRecipe ? "Recipe Updated" : "Recipe Added",
        description: data.message,
      });

      setRecipeDialogOpen(false);
      await fetchRecipes();

      if (!editingRecipe && data.recipe?.id) {
        setSelectedRecipeId(String(data.recipe.id));
      }
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const openAddIngredient = () => {
    setIngredientForm({
      itemId: "",
      normPerPatient: 0,
      unit: "g",
      editId: null,
    });
    setIngredientDialogOpen(true);
  };

  const openEditIngredient = (ingredient) => {
    setIngredientForm({
      itemId: String(ingredient.itemId),
      normPerPatient: ingredient.normPerPatient,
      unit: ingredient.unit,
      editId: ingredient.id,
    });
    setIngredientDialogOpen(true);
  };

  const saveIngredient = async () => {
    try {
      let res;

      if (ingredientForm.editId) {
        res = await fetch(`${API_BASE}/ingredients/${ingredientForm.editId}`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            normPerPatient: ingredientForm.normPerPatient,
            unit: ingredientForm.unit,
          }),
        });
      } else {
        res = await fetch(`${API_BASE}/${selectedRecipeId}/ingredients`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            itemId: Number(ingredientForm.itemId),
            normPerPatient: Number(ingredientForm.normPerPatient),
            unit: ingredientForm.unit,
          }),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save ingredient");

      toast({
        title: ingredientForm.editId ? "Ingredient Updated" : "Ingredient Added",
        description: data.message,
      });

      setIngredientDialogOpen(false);
      fetchRecipeIngredients(selectedRecipeId);
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const deleteIngredient = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/ingredients/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete ingredient");

      toast({ title: "Ingredient Removed", description: data.message });
      fetchRecipeIngredients(selectedRecipeId);
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const sortedRecipes = [...recipes].sort((a, b) => 
    (a.name || "").localeCompare(b.name || "")
  );

  const sortedIngredients = [...ingredients].sort((a, b) => 
    (a.itemNameEn || "").localeCompare(b.itemNameEn || "")
  );

  const sortedItems = [...items].sort((a, b) => 
    (a.nameEn || "").localeCompare(b.nameEn || "")
  );

  return (
    <div className="space-y-6">
      <h1 className="text-heading-md font-bold text-foreground">Recipe Formula Editor</h1>

      <Card>
        <CardContent className="pt-4 flex flex-wrap gap-3">
          <Select value={selectedRecipeId} onValueChange={setSelectedRecipeId}>
            <SelectTrigger className="w-72 h-12 text-base touch-target cursor-pointer">
              <SelectValue placeholder="Select recipe" />
            </SelectTrigger>
            <SelectContent>
              {sortedRecipes.map((recipe) => (
                <SelectItem key={recipe.id} value={String(recipe.id)} className="text-base cursor-pointer">
                  {recipe.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" className="h-12 px-5 text-base touch-target" onClick={openAddRecipe}>
            <Plus className="h-5 w-5 mr-2" />
            Add Recipe
          </Button>

          <Button variant="outline" className="h-12 px-5 text-base touch-target" onClick={openEditRecipe} disabled={!selectedRecipe}>
            <Edit2 className="h-5 w-5 mr-2" />
            Edit Recipe
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-heading-sm">
            {selectedRecipe ? `${selectedRecipe.name} — Ingredients` : "Ingredients"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-6 text-center text-muted-foreground text-lg">Loading...</div>
          ) : (
            <>
              <div className="flex justify-end mb-3">
                <Button onClick={openAddIngredient} disabled={!selectedRecipe} className="touch-target">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Ingredient
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow className="text-lg">
                    <TableHead className="font-semibold text-foreground text-center">Ingredient (EN)</TableHead>
                    <TableHead className="font-semibold text-foreground text-center">Ingredient (SI)</TableHead>
                    <TableHead className="font-semibold text-foreground text-center">Norm Per Patient</TableHead>
                    <TableHead className="font-semibold text-foreground text-center">Unit</TableHead>
                    <TableHead className="font-semibold text-foreground text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedIngredients.map((ing) => (
                    <TableRow 
                      key={ing.id} 
                      className="text-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <TableCell className="font-medium py-5 text-center">{ing.itemNameEn}</TableCell>
                      <TableCell className="text-muted-foreground py-5 text-center">{ing.itemNameSi}</TableCell>
                      <TableCell className="py-5 text-center">{ing.normPerPatient}</TableCell>
                      
                      {/* 👇 Visually translated to the correct base unit in the table */}
                      <TableCell className="text-muted-foreground py-5 text-center">{getBaseUnitShort(ing.unit)}</TableCell>
                      
                      <TableCell className="py-5">
                        <div className="flex justify-center gap-2">
                          <Button 
                            title="Edit Ingredient"
                            variant="ghost" 
                            size="icon" 
                            onClick={() => openEditIngredient(ing)}
                          >
                            <Edit2 className="h-5 w-5" />
                          </Button>
                          <Button 
                            title="Delete Ingredient"
                            variant="ghost" 
                            size="icon" 
                            onClick={() => deleteIngredient(ing.id)}
                          >
                            <Trash2 className="h-5 w-5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}

                  {sortedIngredients.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-6 text-lg">
                        No ingredients found for this recipe.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button 
          className="h-12 px-6 text-base touch-target" 
          onClick={() => fetchRecipeIngredients(selectedRecipeId)} 
          disabled={!selectedRecipe}
        >
          <Save className="h-5 w-5 mr-2" />
          Refresh Recipe
        </Button>
      </div>

      <Dialog open={recipeDialogOpen} onOpenChange={setRecipeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRecipe ? "Edit Recipe" : "Add Recipe"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-base font-semibold">Recipe Key</Label>
              <Input
                value={newRecipe.recipeKey}
                onChange={(e) => setNewRecipe((p) => ({ ...p, recipeKey: e.target.value }))}
                placeholder="e.g. polSambola"
                className="h-11 text-base"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-base font-semibold">Recipe Name</Label>
              <Input
                value={newRecipe.name}
                onChange={(e) => setNewRecipe((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Pol Sambola"
                className="h-11 text-base"
              />
            </div>
          </div>

          <DialogFooter className="mt-2 gap-2">
            <Button variant="outline" onClick={() => setRecipeDialogOpen(false)} className="touch-target">
              Cancel
            </Button>
            <Button onClick={saveRecipe} className="touch-target">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={ingredientDialogOpen} onOpenChange={setIngredientDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{ingredientForm.editId ? "Edit Ingredient" : "Add Ingredient"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label className="text-base font-semibold">Item</Label>
              
              <Popover open={ingredientSearchOpen} onOpenChange={setIngredientSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={ingredientSearchOpen}
                    className="w-full justify-between h-11 text-base border-slate-300 focus:ring-primary/20 font-normal bg-background"
                    disabled={!!ingredientForm.editId}
                  >
                    <span className="truncate pr-2">
                      {selectedIngredientItem 
                        ? `${selectedIngredientItem.nameEn} (${selectedIngredientItem.nameSi})`
                        : "Search and select an item..."}
                    </span>
                    <ChevronsUpDown className="ml-2 h-5 w-5 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 shadow-xl border border-slate-300 z-[100] bg-background" align="start">
                  <Command>
                    <CommandInput placeholder="Search item by English or Sinhala name..." className="h-11 text-base border-none focus:ring-0" />
                    <CommandList className="max-h-[250px]">
                      <CommandEmpty className="py-6 text-center text-base">No item found.</CommandEmpty>
                      <CommandGroup>
                        {sortedItems.map((item) => (
                          <CommandItem
                            key={item.id}
                            value={`${item.nameEn} ${item.nameSi}`}
                            onSelect={() => {
                              setIngredientForm((p) => ({
                                ...p,
                                itemId: String(item.id),
                                unit: item.unit,
                              }));
                              setIngredientSearchOpen(false);
                            }}
                            className="text-base py-2.5 cursor-pointer"
                          >
                            <Check
                              className={cn(
                                "mr-3 h-5 w-5 text-primary flex-shrink-0",
                                ingredientForm.itemId === String(item.id) ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="truncate">
                              {item.nameEn} <span className="text-muted-foreground ml-1">({item.nameSi})</span>
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-[1fr_80px] gap-4">
              <div className="space-y-2">
                <Label className="text-base font-semibold flex items-center flex-wrap gap-2">
                  Norm Per Patient
                  {ingredientForm.unit && (
                    <span className="text-primary bg-primary/10 px-2 py-0.5 rounded text-sm">
                      (Enter in: {getBaseUnitLabel(ingredientForm.unit)})
                    </span>
                  )}
                </Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={ingredientForm.normPerPatient}
                  onChange={(e) =>
                    setIngredientForm((p) => ({
                      ...p,
                      normPerPatient: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="h-11 text-base border-slate-300 focus:border-primary"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-base font-semibold">Unit</Label>
                {/* 👇 Display translated Base Unit, readOnly */}
                <Input
                  value={getBaseUnitShort(ingredientForm.unit)}
                  className="h-11 text-base bg-muted/50 border-slate-300 text-center"
                  readOnly
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setIngredientDialogOpen(false)} className="touch-target">
              Cancel
            </Button>
            <Button onClick={saveIngredient} disabled={!ingredientForm.itemId} className="touch-target">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminRecipes;