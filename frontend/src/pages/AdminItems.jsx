//  Admin interface for managing items

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit2, FolderPlus } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5050/api";

// Helper function to get authorization headers with JWT token from session storage
const getAuthHeaders = () => {
  const token = sessionStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
};

// Default units for items, can be extended by the user
const DEFAULT_UNITS = [
  "Kg", "g", "One", "1 loaf", "Cup", "Bottle", "Pk",
  "100g", "400g", "L", "180ml", "375ml", "Pcs", "Fruit", "Pkt",
];

// Main component for managing items and categories
const AdminItems = () => {
  const { toast } = useToast(); // For showing success/error messages
  const [categories, setCategories] = useState([]); // List of item categories
  const [selectedCat, setSelectedCat] = useState(null); // Currently selected category for filtering items
  const [items, setItems] = useState([]); // List of all items
  const [units, setUnits] = useState([...DEFAULT_UNITS]); // List of measurement units, can be extended by user
  const [dietCycles, setDietCycles] = useState([]); // List of diet cycles for protein items
  const [loading, setLoading] = useState(true); // Track if data is loading  
  const [saving, setSaving] = useState(false); // Track if save operation is in progress
  const [itemDialogOpen, setItemDialogOpen] = useState(false); // Control visibility of add/edit item dialog
  const [newItem, setNewItem] = useState({}); // Form state for new/edit item, structure: { nameEn, nameSi, unit, defaultPrice, categoryId, isProtein, dietCycle, isVegetable, vegCategory, isExtra, calcType }
  const [editingItem, setEditingItem] = useState(null); // If editing an existing item, this holds the original item data for reference
  const [isProteinOn, setIsProteinOn] = useState(false); // Separate state for protein switch to handle conditional logic in the form
  const [isVegOn, setIsVegOn] = useState(false); // Separate state for vegetable switch to handle conditional logic in the form
  const [isExtraOn, setIsExtraOn] = useState(false); // Separate state for extra item switch to handle conditional logic in the form
  const [dietCycle, setDietCycle] = useState(""); // Selected diet cycle for protein items, stored separately for easier handling in the form
  const [catDialogOpen, setCatDialogOpen] = useState(false); // Control visibility of add/edit category dialog
  const [catForm, setCatForm] = useState({ name: "" }); // Form state for category dialog, structure: { name }
  const [editingCat, setEditingCat] = useState(null); // If editing an existing category, this holds the original category data for reference
  const [deleteCatDialog, setDeleteCatDialog] = useState(null); // Control visibility of delete category confirmation dialog, holds the category to be deleted
  const [unitDialogOpen, setUnitDialogOpen] = useState(false); // Control visibility of add custom unit dialog
  const [newUnit, setNewUnit] = useState(""); // Form state for new custom unit, just a string input

  // Fetch categories from API
  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_BASE}/categories`, { headers: getAuthHeaders() }); 
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch categories");
      setCategories(data.categories || []); 
    } 
    catch (error) {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" });
    }
  };

  // Fetch items from API
  const fetchItems = async () => {
    try {
      const res = await fetch(`${API_BASE}/items`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch items");
      setItems(data.items || []);
    } 
    catch (error) {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" });
    }
  };

  // Fetch diet cycles from API
  const fetchDietCycles = async () => {
    try {
      const res = await fetch(`${API_BASE}/diet-cycles`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch diet cycles");
      setDietCycles((data.cycles || []).filter((c) => c.active));
    } 
    catch (error) {
      console.error("Failed to fetch diet cycles:", error);
    }
  };

  // Fetch all necessary data on component mount
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchCategories(), fetchItems(), fetchDietCycles()]);
      setLoading(false);
    };
    loadAll();
  }, []);

  // Filter items based on selected category, if any
  const filtered = selectedCat
    ? items.filter((i) => i.categoryId === selectedCat)
    : items;

  // Sorting logic: Alphabetical by English name
  const sortedItems = [...filtered].sort((a, b) => {
    return (a.nameEn || "").localeCompare(b.nameEn || "");
  });

  // Generate vegetable category options based on existing categories and items
  const vegCatOptions = (() => {
    const options = new Map();
    const vegKeywords = ["vegetable", "palaa", "gedi", "piti", "pishta", "elawalu"];
    
    // add categories that have vegetable-related keywords in their name
    for (const cat of categories) {
      const nameLower = (cat.name || "").toLowerCase();
      if (vegKeywords.some((kw) => nameLower.includes(kw))) {
        let key = nameLower;
        if (nameLower.includes("palaa")) key = "palaa";
        else if (nameLower.includes("gedi") || nameLower.includes("elawalu")) key = "gedi";
        else if (nameLower.includes("piti") || nameLower.includes("pishta") || nameLower.includes("starchy")) key = "piti";
        else if (nameLower.includes("other")) key = "other";
        else key = nameLower.replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");

        options.set(key, { value: key, label: cat.name, categoryId: cat.id });
      }
    }

    // add veg categories from items that are not already included from categories
    for (const item of items) {
      if (item.vegCategory && !options.has(item.vegCategory)) {
        options.set(item.vegCategory, {
          value: item.vegCategory,
          label: item.vegCategory.charAt(0).toUpperCase() + item.vegCategory.slice(1),
        });
      }
    }

    // add a default "other" category if no vegetable categories are found
    if (options.size === 0) {
      options.set("other", { value: "other", label: "Other" });
    }

    return Array.from(options.values());
  })();

  // Open dialog for adding a new category with empty form
  const openAddCategory = () => {
    setEditingCat(null);
    setCatForm({ name: "" });
    setCatDialogOpen(true);
  };

  // Open dialog for editing an existing category, pre-filling the form with the category's current name
  const openEditCategory = (cat) => {
    setEditingCat(cat);
    setCatForm({ name: cat.name });
    setCatDialogOpen(true);
  };

  // Save category (both add and edit)
  const saveCategory = async () => {
    if (!catForm.name?.trim()) return;
    try {
      setSaving(true);
      const url = editingCat // If editing, use the category's ID in the URL; if adding, use the base categories endpoint
        ? `${API_BASE}/categories/${editingCat.id}`
        : `${API_BASE}/categories`;
      const method = editingCat ? "PUT" : "POST";

      // Make API request to save the category with the name from the form, trimming whitespace
      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: catForm.name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save category");

      toast({
        title: editingCat ? "Category Updated" : "Category Added",
        description: `${catForm.name} saved successfully`,
      });
      setCatDialogOpen(false);
      fetchCategories();
    } 
    catch (error) {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" });
    } 
    finally {
      setSaving(false);
    }
  };

  // Delete category after confirming with the user, ensuring that any items in that category are handled appropriately
  const deleteCategory = async (cat) => {
    try {
      const res = await fetch(`${API_BASE}/categories/${cat.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete category"); // The API should return an error if there are active items in this category, so we can show that message to the user

      toast({ 
        title: "Category Deleted", 
        description: `${cat.name} removed` });
      
      // Close the delete confirmation dialog and if the deleted category was currently selected for filtering, reset the filter to show all items. Then refresh the categories list to reflect the deletion.
      setDeleteCatDialog(null);
      if (selectedCat === cat.id) setSelectedCat(null);
      fetchCategories();
    } 
    catch (error) {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" });
    }
  };

  // Helper function to create an empty item object with default values, used when opening the add item dialog. It takes an optional categoryId parameter to pre-fill the category for the new item based on the current selection or defaults to the first category if available. The structure of the item includes all necessary fields for the form, such as name, unit, price, category, and flags for protein/vegetable/extra status. This ensures that when the add item dialog is opened, the form is initialized with a consistent structure and sensible defaults.
  const emptyItem = (categoryId) => ({
    nameEn: "", nameSi: "", unit: "Kg", defaultPrice: 0,
    categoryId: categoryId || selectedCat || (categories[0]?.id) || 1,
    isProtein: false, dietCycle: null, isVegetable: false,
    vegCategory: null, isExtra: false, calcType: "norm_weight",
  });

  // Open dialog for adding a new item, initializing the form with default values and resetting any editing state. It also sets the protein/vegetable/extra switches to off and defaults the diet cycle selection to the first available cycle if there are any. This prepares the form for creating a new item without any residual data from previous edits.
  const openItemDialog = (catId) => {
    setEditingItem(null);
    setNewItem(emptyItem(catId));
    setIsProteinOn(false);
    setIsVegOn(false);
    setIsExtraOn(false);
    setDietCycle(dietCycles.length > 0 ? dietCycles[0].nameEn : "");
    setItemDialogOpen(true);
  };

  // Open dialog for editing an existing item, pre-filling the form with the item's current data. It also sets the protein/vegetable/extra switches based on the item's properties and defaults the diet cycle selection to the item's current diet cycle or the first available cycle if there are any. This allows for seamless editing of an item with all relevant data pre-populated in the form.
  const openEditItem = (item) => {
    setEditingItem(item);
    setNewItem({
      nameEn: item.nameEn,
      nameSi: item.nameSi,
      unit: item.unit,
      defaultPrice: item.defaultPrice,
      categoryId: item.categoryId,
      vegCategory: item.vegCategory,
      calcType: item.calcType,
    });
    setIsProteinOn(item.isProtein || false);
    setIsVegOn(item.isVegetable || false);
    setIsExtraOn(item.isExtra || false);
    setDietCycle(item.dietCycle || (dietCycles.length > 0 ? dietCycles[0].nameEn : ""));
    setItemDialogOpen(true);
  };

  // Handle item deletion with user confirmation, making an API call to delete the item and refreshing the items list upon success. It also shows appropriate success or error messages based on the outcome of the API call.
  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Delete "${item.nameSi} / ${item.nameEn}"? This will deactivate the item.`)) return;
    try {
      const res = await fetch(`${API_BASE}/items/${item.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete item");
      toast({ 
        title: "Item Removed", 
        description: `${item.nameEn} deactivated` });
      fetchItems();
    } 
    catch (error) {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" });
    }
  };

  // Handle saving an item (both add and edit) by making an API call with the form data. It constructs the payload based on the form state, including conditional fields for protein/vegetable/extra items. After a successful save, it shows a success message, closes the dialog, and refreshes the items list. If there's an error during the API call, it shows an error message to the user.
  const handleSaveItem = async () => {
    if (!newItem.nameEn?.trim() || !newItem.nameSi?.trim()) return;
    try {
      setSaving(true);
      const payload = {
        nameEn: newItem.nameEn,
        nameSi: newItem.nameSi,
        unit: newItem.unit || "Kg",
        defaultPrice: newItem.defaultPrice || 0,
        categoryId: newItem.categoryId,
        isProtein: isProteinOn,
        dietCycle: isProteinOn ? dietCycle : null,
        isVegetable: isVegOn,
        vegCategory: isVegOn ? newItem.vegCategory || (vegCatOptions[0]?.value) || "other" : null,
        isExtra: isExtraOn,
        calcType: isExtraOn ? newItem.calcType || "raw_sum" : "norm_weight",
      };

      const url = editingItem ? `${API_BASE}/items/${editingItem.id}` : `${API_BASE}/items`;
      const method = editingItem ? "PUT" : "POST";

      // Make API request to save the item with the data from the form, trimming whitespace from the names
      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      // Parse response and check for errors, showing appropriate messages to the user based on the outcome
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save item");

      toast({
        title: editingItem ? "Item Updated" : "Item Added",
        description: `${newItem.nameSi} / ${newItem.nameEn} saved successfully`,
      });

      setItemDialogOpen(false);
      setEditingItem(null);
      fetchItems();
    } 
    catch (error) {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" });
    } 
    finally {
      setSaving(false);
    }
  };

  // Handle adding a new custom unit to the units list, ensuring that it is not empty and does not already exist in the list. It shows appropriate success or error messages based on the outcome and resets the form state after adding the unit.
  const addCustomUnit = () => {
    if (!newUnit.trim()) return;
    if (units.includes(newUnit.trim())) {
      toast({ 
        title: "Unit exists", 
        description: `"${newUnit}" is already in the list` });
      return;
    }
    setUnits((prev) => [...prev, newUnit.trim()]); // Add the new unit to the list of units
    toast({ 
      title: "Unit Added", 
      description: `"${newUnit}" added to unit options` });
    setNewUnit("");
    setUnitDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-heading-md font-bold text-foreground">
          Item & Category Management
        </h1>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* ─── Category Sidebar ─── */}
        <Card className="md:w-82 shrink-0">
          <CardContent className="pt-4 space-y-1">
            <div className="flex items-center justify-between mb-3">
              <span className="text-label font-semibold text-muted-foreground">Categories</span>
              <Button size="sm" onClick={openAddCategory}>
                <FolderPlus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>

            <Button
              variant={!selectedCat ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => setSelectedCat(null)}
            >
              All Items ({items.length})
            </Button>

            {categories.map((c) => {
              const count = items.filter((i) => i.categoryId === c.id).length;
              const isActive = selectedCat === c.id;
              return (
                <div key={c.id} className="flex items-center">
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    className="flex-1 justify-start text-sm"
                    onClick={() => setSelectedCat(c.id)}
                  >
                    {c.name}
                    <span className="ml-auto text-xs">({count})</span>
                  </Button>
                  <div className="flex gap-0.5 shrink-0">
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); openEditCategory(c); }}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={(e) => { e.stopPropagation(); setDeleteCatDialog(c); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* ─── Items Table ─── */}
        <Card className="flex-1">
          <CardContent className="pt-4 overflow-x-auto">
            <div className="flex justify-end mb-3">
              <Button onClick={() => openItemDialog()} className="touch-target">
                <Plus className="h-4 w-4 mr-2" /> Add New Item
              </Button>
            </div>

            {loading ? (
              <div className="py-6 text-center text-muted-foreground">Loading items...</div>
            ) : (
              <Table>
                <TableHeader>
                  {/* 👇 Upgraded text-lg and text-center headers */}
                  <TableRow className="text-lg">
                    <TableHead className="font-semibold text-foreground text-center w-8">#</TableHead>
                    <TableHead className="font-semibold text-foreground text-center">Item (EN)</TableHead>
                    <TableHead className="font-semibold text-foreground text-center">Item (SI)</TableHead>
                    <TableHead className="font-semibold text-foreground text-center">Unit</TableHead>
                    <TableHead className="font-semibold text-foreground text-center">Price</TableHead>
                    <TableHead className="font-semibold text-foreground text-center">Protein</TableHead>
                    <TableHead className="hidden lg:table-cell font-semibold text-foreground text-center">Veg Cat.</TableHead>
                    <TableHead className="font-semibold text-foreground text-center">Calc Type</TableHead>
                    <TableHead className="font-semibold text-foreground text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* 👇 Mapped over sortedItems */}
                  {sortedItems.map((item, idx) => (
                    <TableRow 
                      key={item.id} 
                      className="text-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <TableCell className="text-muted-foreground py-5 text-center">{idx + 1}</TableCell>
                      <TableCell className="font-medium py-5 text-center">{item.nameEn}</TableCell>
                      <TableCell className="text-muted-foreground py-5 text-center">{item.nameSi}</TableCell>
                      <TableCell className="py-5 text-center">{item.unit}</TableCell>
                      <TableCell className="py-5 text-center">Rs. {item.defaultPrice}</TableCell>
                      <TableCell className="py-5 text-center">
                        {item.isProtein && (
                          <Badge className="bg-destructive/20 text-destructive text-base px-3 py-1">
                            {item.dietCycle || "Yes"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell py-5 text-center">
                        {item.vegCategory && (
                          <Badge className="bg-primary/20 text-primary capitalize text-base px-3 py-1">
                            {item.vegCategory}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-5 text-center">
                        <Badge className="bg-muted text-muted-foreground text-base px-3 py-1">
                          {item.calcType === "norm_weight" ? "Norm Weight" : "Raw Sum"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-5">
                        <div className="flex justify-center gap-2">
                          <Button 
                            title="Edit Item"
                            variant="ghost" 
                            size="icon" 
                            onClick={() => openEditItem(item)}
                          >
                            <Edit2 className="h-5 w-5" />
                          </Button>
                          <Button 
                            title="Delete Item"
                            variant="ghost" 
                            size="icon" 
                            className="text-destructive" 
                            onClick={() => handleDeleteItem(item)}
                          >
                            <Trash2 className="h-5 w-5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}

                  {sortedItems.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-4">
                        <Button variant="ghost" size="sm" className="text-primary"
                          onClick={() => openItemDialog(selectedCat || undefined)}>
                          <Plus className="h-4 w-4 mr-2" /> Add Item
                        </Button>
                      </TableCell>
                    </TableRow>
                  )}

                  {sortedItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-6">
                        No items found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Add/Edit Category Dialog ─── */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCat ? "Edit Category" : "Add Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-label font-semibold">Category Name</Label>
              <Input
                value={catForm.name}
                onChange={(e) => setCatForm({ name: e.target.value })}
                className="h-11"
                placeholder="e.g. Rice / Bread / Noodles"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveCategory} disabled={saving || !catForm.name?.trim()}>
              {saving ? "Saving..." : editingCat ? "Update" : "Add Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Category Confirmation ─── */}
      <Dialog open={!!deleteCatDialog} onOpenChange={() => setDeleteCatDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Category?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteCatDialog?.name}"?
              This will fail if there are items still assigned to this category.
              Move or delete those items first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCatDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteCategory(deleteCatDialog)}>
              Delete Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Add/Edit Item Dialog ─── */}
      <Dialog open={itemDialogOpen} onOpenChange={(open) => { setItemDialogOpen(open); if (!open) setEditingItem(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Item" : "Add New Item"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-label font-semibold">Category</Label>
              <Select
                value={String(newItem.categoryId || "")}
                onValueChange={(v) => setNewItem((p) => ({ ...p, categoryId: Number(v) }))}
              >
                <SelectTrigger className="h-11"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-label font-semibold">Item Name (English) *</Label>
                <Input value={newItem.nameEn || ""} onChange={(e) => setNewItem((p) => ({ ...p, nameEn: e.target.value }))}
                  className="h-11" placeholder="e.g. Rice Nadu" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-label font-semibold">Item Name (Sinhala) *</Label>
                <Input value={newItem.nameSi || ""} onChange={(e) => setNewItem((p) => ({ ...p, nameSi: e.target.value }))}
                  className="h-11" placeholder="e.g. හාල්" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-label font-semibold">Unit</Label>
                <div className="flex gap-2">
                  <Select value={newItem.unit || "Kg"} onValueChange={(v) => setNewItem((p) => ({ ...p, unit: v }))}>
                    <SelectTrigger className="h-11 flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {units.map((u) => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" className="h-11 w-11 shrink-0"
                    onClick={() => setUnitDialogOpen(true)} title="Add custom unit">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-label font-semibold">Default Price (Rs.)</Label>
                <Input type="number" min={0} step="0.01" value={newItem.defaultPrice || ""}
                  onChange={(e) => setNewItem((p) => ({ ...p, defaultPrice: parseFloat(e.target.value) || 0 }))}
                  className="h-11 text-right [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
              </div>
            </div>

            <div className="space-y-3 border-t pt-3">
              <div className="flex items-center justify-between">
                <Label className="text-label font-semibold">Is Protein Item</Label>
                <Switch checked={isProteinOn} onCheckedChange={setIsProteinOn} />
              </div>
              {isProteinOn && (
                <div className="ml-4 space-y-1.5">
                  <Label className="text-label text-muted-foreground">Diet Cycle</Label>
                  <Select value={dietCycle} onValueChange={setDietCycle}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Select diet cycle" /></SelectTrigger>
                    <SelectContent>
                      {dietCycles.map((c) => (
                        <SelectItem key={c.id} value={c.nameEn}>
                          {c.nameSi ? `${c.nameSi} / ` : ""}{c.nameEn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {dietCycles.length === 0 && (
                    <p className="text-xs text-destructive">No diet cycles found. Add them in Diet Cycles page first.</p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label className="text-label font-semibold">Is Vegetable</Label>
                <Switch checked={isVegOn} onCheckedChange={setIsVegOn} />
              </div>
              {isVegOn && (
                <div className="ml-4 space-y-1.5">
                  <Label className="text-label text-muted-foreground">Vegetable Category</Label>
                  <Select value={newItem.vegCategory || ""} onValueChange={(v) => setNewItem((p) => ({ ...p, vegCategory: v }))}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Select vegetable category" /></SelectTrigger>
                    <SelectContent>
                      {vegCatOptions.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {vegCatOptions.length === 0 && (
                    <p className="text-xs text-destructive">No vegetable categories found. Create vegetable categories first.</p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label className="text-label font-semibold">Is Extra Item</Label>
                <Switch checked={isExtraOn} onCheckedChange={setIsExtraOn} />
              </div>
              {isExtraOn && (
                <div className="ml-4 space-y-1.5">
                  <Label className="text-label text-muted-foreground">Calculation Type</Label>
                  <Select value={newItem.calcType || "raw_sum"} onValueChange={(v) => setNewItem((p) => ({ ...p, calcType: v }))}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="raw_sum">Raw Sum</SelectItem>
                      <SelectItem value="norm_weight">Norm Weight</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => { setItemDialogOpen(false); setEditingItem(null); }} className="touch-target">
              Cancel
            </Button>
            <Button onClick={handleSaveItem} disabled={saving || !newItem.nameEn?.trim() || !newItem.nameSi?.trim()} className="touch-target">
              {saving ? "Saving..." : editingItem ? "Update Item" : "Save Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Add Custom Unit Dialog ─── */}
      <Dialog open={unitDialogOpen} onOpenChange={setUnitDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Custom Unit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-label font-semibold">Unit Name</Label>
              <Input value={newUnit} onChange={(e) => setNewUnit(e.target.value)}
                className="h-11" placeholder="e.g. 500ml, 250g, Tray" />
            </div>
            <p className="text-xs text-muted-foreground">
              Custom units are added to the dropdown for this session.
              For permanent units, contact the system administrator.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnitDialogOpen(false)}>Cancel</Button>
            <Button onClick={addCustomUnit} disabled={!newUnit.trim()}>Add Unit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminItems;