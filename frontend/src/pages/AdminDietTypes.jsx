// Admin interface for managing diet types

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Ban, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = `${import.meta.env.VITE_API_BASE || "http://localhost:5050/api"}/diet-types`;

// Helper function to get auth headers with token from session storage
const getAuthHeaders = () => ({ 
  "Content-Type": "application/json",
  Authorization: `Bearer ${sessionStorage.getItem("token")}`,
});

// Added rich theme colors for consistency
const STATUS_STYLE = {
  active: "bg-success text-success-foreground hover:bg-success border-transparent font-medium",
  inactive: "bg-error-bg text-destructive hover:bg-error-bg border-transparent font-medium",
};

// Template for a new diet type with default values
const emptyDietType = { // Template for a new diet type
  id: "", code: "", nameEn: "", nameSi: "", ageRange: "All", type: "Patient", displayOrder: 1, active: true,
};

// Main component for managing diet types
const AdminDietTypes = () => {
  const { toast } = useToast(); // For showing success/error messages
  const [types, setTypes] = useState([]); // List of diet types
  const [edit, setEdit] = useState(null); // Currently edited diet type, null if not editing
  const [isNew, setIsNew] = useState(false); // Flag to indicate if the dialog is for creating a new diet type or editing an existing one
  const [loading, setLoading] = useState(true); // Loading state for fetching diet types
  const [saving, setSaving] = useState(false); // Saving state for when a diet type is being saved to the API

  // Fetch diet types from API
  const fetchDietTypes = async () => { 
    try { // Show loading state while fetching data
      setLoading(true);
      const res = await fetch(API_BASE, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch diet types");
      setTypes(data.dietTypes || []);
    } 
    catch (error) {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" });
    } 
    finally {
      setLoading(false);
    }
  };

  // Fetch diet types on component mount
  useEffect(() => { fetchDietTypes(); }, []);

  // Open dialog to create a new diet type with default values
  const openNew = () => {  
    setIsNew(true);
    setEdit({ ...emptyDietType, displayOrder: types.filter(t => t.active).length + 1 });
  };

  const save = async () => { // Save new or edited diet type to API
    if (!edit) return;
    try {
      setSaving(true);
      const payload = { // Only send relevant fields in the payload
        code: edit.code, nameEn: edit.nameEn, nameSi: edit.nameSi,
        ageRange: edit.ageRange, type: edit.type, displayOrder: Number(edit.displayOrder) || 1, active: edit.active
      };
      
      const url = isNew ? API_BASE : `${API_BASE}/${edit.id}`; 
      const res = await fetch(url, { // Endpoint for creating or updating diet type
        method: isNew ? "POST" : "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      // Parse response and check for errors
      const data = await res.json(); 
      if (!res.ok) throw new Error(data.message || "Save failed");

      toast({ 
        title: isNew ? "Diet Type Added" : "Diet Type Updated", 
        description: data.message });

      setEdit(null);
      setIsNew(false);
      fetchDietTypes();
    } 
    catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } 
    finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (dietType) => { // Toggle active/inactive status of a diet type
    try {
      const res = await fetch(`${API_BASE}/${dietType.id}/status`, { // Endpoint to toggle status
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ active: !dietType.active }),
      });

      const data = await res.json(); 
      if (!res.ok) throw new Error(data.message || "Status update failed");

      toast({ title: "Status Updated", description: `${dietType.nameEn} is now ${!dietType.active ? "Active" : "Inactive"}` });
      fetchDietTypes();
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };
  
  // Sort types: Active at the top, Inactive at the bottom. Also sorts by displayOrder.
  const sortedTypes = [...types].sort((a, b) => {
    if (a.active && !b.active) return -1;
    if (!a.active && b.active) return 1;
    return (a.displayOrder || 0) - (b.displayOrder || 0);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-heading-md font-bold text-foreground">Diet Type Management</h1>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Add Diet Type</Button>
      </div>

      <Card>
        <CardContent className="pt-4 overflow-x-auto">
          {loading ? (
            <div className="py-6 text-center text-muted-foreground">Loading diet types...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="text-lg">
                  <TableHead className="font-semibold text-foreground text-center">Code</TableHead>
                  <TableHead className="font-semibold text-foreground text-center">Name (EN)</TableHead>
                  <TableHead className="font-semibold text-foreground text-center">Name (SI)</TableHead>
                  <TableHead className="font-semibold text-foreground text-center">Type</TableHead>
                  <TableHead className="font-semibold text-foreground text-center">Order</TableHead>
                  <TableHead className="font-semibold text-foreground text-center">Status</TableHead>
                  <TableHead className="font-semibold text-foreground text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTypes.map((t) => (
                  <TableRow 
                    key={t.id} 
                    className={cn(
                      "text-lg hover:bg-muted/50 transition-colors cursor-pointer", 
                      !t.active && "opacity-60 grayscale"
                    )}
                  >
                    <TableCell className={cn("font-medium py-5 text-center", !t.active && "text-muted-foreground")}>{t.code}</TableCell>
                    <TableCell className={cn("py-5 text-center", !t.active && "text-muted-foreground")}>{t.nameEn}</TableCell>
                    <TableCell className="text-muted-foreground py-5 text-center">{t.nameSi}</TableCell>
                    <TableCell className="py-5 text-center">
                      <Badge className="bg-muted text-muted-foreground hover:bg-muted border-transparent text-base px-3 py-1">
                        {t.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground py-5 text-center">{t.displayOrder}</TableCell>
                    <TableCell className="py-5 text-center">
                      <Badge 
                        className={`text-base px-3 py-1 ${
                          t.active ? STATUS_STYLE.active : STATUS_STYLE.inactive
                        }`}
                      >
                        {t.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-5">
                      <div className="flex justify-center gap-2">
                        <Button 
                          title="Edit Diet Type"
                          variant="ghost" 
                          size="icon" 
                          onClick={() => { setIsNew(false); setEdit(t); }} 
                        >
                          <Edit2 className="h-5 w-5" />
                        </Button>
                        <Button 
                          title={t.active ? "Deactivate Diet Type" : "Activate Diet Type"}
                          variant="ghost" 
                          size="icon" 
                          onClick={() => toggleStatus(t)}
                        >
                          {t.active ? (
                            <Ban className="h-5 w-5 text-destructive" />
                          ) : (
                            <CheckCircle className="h-5 w-5 text-primary" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {types.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                      No diet types found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!edit} onOpenChange={() => setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{isNew ? "Add Diet Type" : "Edit Diet Type"}</DialogTitle></DialogHeader>
          {edit && (
             <div className="space-y-4">
               <div className="grid grid-cols-2 gap-4">
                 <div><Label>Code</Label><Input value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value })} /></div>
                 <div><Label>Name (EN)</Label><Input value={edit.nameEn} onChange={(e) => setEdit({ ...edit, nameEn: e.target.value })} /></div>
                 <div><Label>Name (SI)</Label><Input value={edit.nameSi} onChange={(e) => setEdit({ ...edit, nameSi: e.target.value })} /></div>
                 <div><Label>Age Range</Label><Input value={edit.ageRange} onChange={(e) => setEdit({ ...edit, ageRange: e.target.value })} /></div>
                 <div>
                   <Label>Type</Label>
                   <Select value={edit.type} onValueChange={(value) => setEdit({ ...edit, type: value })}>
                     <SelectTrigger><SelectValue /></SelectTrigger>
                     <SelectContent>
                       <SelectItem value="Patient">Patient</SelectItem>
                       <SelectItem value="Staff">Staff</SelectItem>
                       <SelectItem value="Special">Special</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
                 <div><Label>Display Order</Label><Input type="number" min={1} value={edit.displayOrder} onChange={(e) => setEdit({ ...edit, displayOrder: parseInt(e.target.value, 10) || 1 })} /></div>
               </div>
             </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDietTypes;