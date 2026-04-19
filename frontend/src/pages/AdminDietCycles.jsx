// Admin interface for managing diet cycles

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Ban, CheckCircle } from "lucide-react"; 

const API_BASE = `${import.meta.env.VITE_API_BASE || "http://localhost:5050/api"}/diet-cycles`;

// Helper to get auth headers for API requests
const getAuthHeaders = () => { 
  const token = sessionStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
};

// Rich theme colors for consistency
const STATUS_STYLE = {
  active: "bg-success text-success-foreground hover:bg-success border-transparent font-medium",
  inactive: "bg-error-bg text-destructive hover:bg-error-bg border-transparent font-medium",
};

const AdminDietCycles = () => {
  const { toast } = useToast();   // For showing success/error messages
  const [cycles, setCycles] = useState([]); // List of diet cycles
  const [edit, setEdit] = useState(null); // Currently edited cycle (null if none)
  const [isNew, setIsNew] = useState(false); // Flag to indicate if we're adding a new cycle or editing an existing one 
  const [loading, setLoading] = useState(true); // Track if data is loading
  const [saving, setSaving] = useState(false); // Track if save operation is in progress

  // Fetch diet cycles from API
  const fetchCycles = async () => {
    try { 
      setLoading(true);
      const res = await fetch(API_BASE, {  // Get all diet cycles
        headers: getAuthHeaders(),
      });

      const data = await res.json(); 

      if (!res.ok) throw new Error(data.message || "Failed to fetch diet cycles");
      setCycles(data.cycles || []);
    } 
  // Show error toast if fetch fails
    catch (error) {
      toast({
        title: "Error",
        description: error.message || "Could not load diet cycles",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  // Fetch cycles on component mount
  useEffect(() => {
    fetchCycles();
  }, []);

  // Open dialog for adding new cycle
  const openNew = () => {  
    setIsNew(true);
    setEdit({ code: "", nameEn: "", nameSi: "", active: true });
  };

  const save = async () => { // Save new or edited cycle to API
    if (!edit) return;

    try {
      setSaving(true);
      
      const payload = { // Only send relevant fields in the payload
        code: edit.code,
        nameEn: edit.nameEn,
        nameSi: edit.nameSi,
        active: edit.active
      };

      let res; // Response variable to hold the result of either POST or PUT request
      if (isNew) {
        res = await fetch(API_BASE, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`${API_BASE}/${edit.id}`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json(); // Parse response

      if (!res.ok) throw new Error(data.message || "Save failed");

      toast({
        title: isNew ? "Diet Cycle Added" : "Diet Cycle Updated",
        description: data.message,
      });

      setEdit(null);
      setIsNew(false);
      fetchCycles();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Could not save diet cycle",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };
 
  const toggleStatus = async (cycle) => { // Toggle active/inactive status of a cycle
    try {
      const res = await fetch(`${API_BASE}/${cycle.id}/status`, { // Endpoint to toggle status
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ active: !cycle.active }),
      });

      const data = await res.json(); // Parse response

      if (!res.ok) throw new Error(data.message || "Status update failed");

      toast({
        title: "Status Updated",
        description: data.message,
      });

      fetchCycles();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Could not update status",
        variant: "destructive",
      });
    }
  };

  // Sort cycles, Active at the top, Inactive at the bottom
  const sortedCycles = [...cycles].sort((a, b) => {
    if (a.active && !b.active) return -1;
    if (!a.active && b.active) return 1;
    return 0;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-heading-md font-bold text-foreground">Diet Cycle Management</h1>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> Add Cycle
        </Button>
      </div>
      
      <Card>
        <CardContent className="pt-4 overflow-x-auto">
          {loading ? (
            <div className="py-6 text-center text-muted-foreground">Loading diet cycles...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="text-lg">
                  <TableHead className="font-semibold text-foreground text-center">Code</TableHead>
                  <TableHead className="font-semibold text-foreground text-center">Name (EN)</TableHead>
                  <TableHead className="font-semibold text-foreground text-center">Name (SI)</TableHead>
                  <TableHead className="font-semibold text-foreground text-center">Status</TableHead>
                  <TableHead className="font-semibold text-foreground text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* 👇 Mapped over sortedCycles */}
                {sortedCycles.map((c) => (
                  <TableRow 
                    key={c.id} 
                    className={`text-lg hover:bg-muted/50 transition-colors cursor-pointer ${!c.active ? "opacity-60" : ""}`}
                  >
                    <TableCell className="font-medium py-5 text-center">{c.code}</TableCell>
                    <TableCell className="py-5 text-center">{c.nameEn}</TableCell>
                    <TableCell className="text-muted-foreground py-5 text-center">{c.nameSi}</TableCell>
                    <TableCell className="py-5 text-center">
                      <Badge 
                        className={`text-base px-3 py-1 ${
                          c.active ? STATUS_STYLE.active : STATUS_STYLE.inactive
                        }`}
                      >
                        {c.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-5">
                      <div className="flex justify-center gap-2">
                        <Button 
                          title="Edit Diet Cycle"
                          variant="ghost" 
                          size="icon" 
                          onClick={() => { setIsNew(false); setEdit(c); }}
                        >
                          <Edit2 className="h-5 w-5" />
                        </Button>
                        
                        {/* Updated to dynamically switch activation icons */}
                        <Button 
                          title={c.active ? "Deactivate Cycle" : "Activate Cycle"}
                          variant="ghost" 
                          size="icon" 
                          onClick={() => toggleStatus(c)}
                        >
                          {c.active ? (
                            <Ban className="h-5 w-5 text-destructive" />
                          ) : (
                            <CheckCircle className="h-5 w-5 text-primary" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {cycles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                      No diet cycles found
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
          <DialogHeader>
            <DialogTitle>{isNew ? "Add Diet Cycle" : "Edit Diet Cycle"}</DialogTitle>
          </DialogHeader>
          {edit && (
            <div className="space-y-4">
              <div>
                <Label>Code</Label>
                <Input value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value })} />
              </div>
              <div>
                <Label>Name (EN)</Label>
                <Input value={edit.nameEn} onChange={(e) => setEdit({ ...edit, nameEn: e.target.value })} />
              </div>
              <div>
                <Label>Name (SI)</Label>
                <Input value={edit.nameSi} onChange={(e) => setEdit({ ...edit, nameSi: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving..." : isNew ? "Add" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDietCycles;