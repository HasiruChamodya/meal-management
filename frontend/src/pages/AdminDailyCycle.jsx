// Administrator: configure the Daily Meal Cycle

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getTodaySL } from "@/lib/date-utils";
import { CalendarDays, Leaf, Drumstick, Save, Loader2 } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5050/api";

// Function to get auth headers with token from sessionStorage
const getAuthHeaders = () => ({ //
  "Content-Type": "application/json",
  Authorization: `Bearer ${sessionStorage.getItem("token")}`,
});

const AdminDailyCycle = () => {
  const { toast } = useToast(); // For showing success/error messages
  const today = getTodaySL();  // Get today's date in YYYY-MM-DD format (Sri Lanka timezone)
  const [date, setDate] = useState(today); // Selected date for which to set the cycle
  const [patientCycle, setPatientCycle] = useState(""); // Selected patient cycle
  const [staffCycle, setStaffCycle] = useState(""); // Selected staff cycle
  const [saved, setSaved] = useState(true); // Track if current selections are saved
  const [saving, setSaving] = useState(false); // Track if save operation is in progress
  const [loading, setLoading] = useState(true); // Track if data is loading
  const [dietCycles, setDietCycles] = useState([]); // List of active diet cycles to choose from 
  const [currentCycle, setCurrentCycle] = useState(null); // Current saved cycle for the selected date

  // Fetch diet cycles from API
  useEffect(() => {
    const fetchAll = async () => {
      try { // Fetch both diet cycles and today's daily cycle in parallel
        setLoading(true);
        const [cyclesRes, dailyRes] = await Promise.all([  // Fetch both diet cycles and today's daily cycle in parallel
          fetch(`${API_BASE}/diet-cycles`, { headers: getAuthHeaders() }), // Get all diet cycles
          fetch(`${API_BASE}/daily-cycle?date=${today}`, { headers: getAuthHeaders() }), // Get today's daily cycle to pre-fill the form if it exists
        ]);

        const cyclesData = await cyclesRes.json(); // Parse diet cycles response
        const dailyData = await dailyRes.json(); // Parse daily cycle response

        // Only show active cycles
        const activeCycles = (cyclesData.cycles || []).filter((c) => c.active);
        setDietCycles(activeCycles);

        // Set current saved values
        if (dailyData.cycle) {
          setCurrentCycle(dailyData.cycle);
          setPatientCycle(dailyData.cycle.patientCycle || "");
          setStaffCycle(dailyData.cycle.staffCycle || "");
        } else if (activeCycles.length > 0) {
          // Default to first cycle if nothing is set
          setPatientCycle(activeCycles[0].nameEn);
          setStaffCycle(activeCycles[0].nameEn);
        }
      } 
      catch (error) { 
        toast({ 
          title: "Error", 
          description: error.message, 
          variant: "destructive" });
      } 
      finally { // Ensure loading state is turned off regardless of success or failure
        setLoading(false); 
      }
    };

    fetchAll(); //
  }, [today, toast]); // Fetch diet cycles and today's daily cycle on component mount

  // Refetch daily cycle when date changes
  useEffect(() => {
    const fetchForDate = async () => {
      try {
        const res = await fetch(`${API_BASE}/daily-cycle?date=${date}`, {
          headers: getAuthHeaders(),
        });
        const data = await res.json();

        if (data.cycle) { // If there's a saved cycle for the selected date, pre-fill the form with those values
          setPatientCycle(data.cycle.patientCycle || ""); 
          setStaffCycle(data.cycle.staffCycle || "");
          setSaved(true);
        }
      } catch (error) {
        console.error("Failed to fetch cycle for date:", error);
      }
    };

    if (date) fetchForDate();
  }, [date]);

  // Handle save button click - send selected cycles to API to save for the selected date
  const handleSave = async () => {
    if (!patientCycle || !staffCycle) {
      toast({ title: "Error", description: "Both patient and staff cycles are required", variant: "destructive" });
      return;
    }

    try {
      setSaving(true);// Show loading state on button

      // save the cycle for that date
      const res = await fetch(`${API_BASE}/daily-cycle`, { 
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ date, patientCycle, staffCycle }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save cycle");

      setCurrentCycle({ patientCycle, staffCycle, date });
      setSaved(true);
      toast({ title: "Cycle Selection Saved", description: `Diet cycles set for ${date}` });
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-lg text-muted-foreground">Loading cycle data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-heading-md font-bold text-foreground">Daily Meal Cycle</h1>

      {/* Current active cycles */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-5">
          <p className="text-base font-semibold text-muted-foreground mb-3">Today's Active Cycles</p>
          <div className="flex flex-wrap gap-3">
            {/* 👇 Bumped text to text-base and icons to h-5 w-5 */}
            <Badge className="bg-primary text-primary-foreground text-base px-4 py-2 gap-2">
              <Leaf className="h-5 w-5" /> Patient: {currentCycle?.patientCycle || patientCycle || "Not Set"}
            </Badge>
            <Badge className="bg-badge-hospital text-primary-foreground text-base px-4 py-2 gap-2">
              <Drumstick className="h-5 w-5" /> Staff: {currentCycle?.staffCycle || staffCycle || "Not Set"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Cycle selection form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-heading-sm">Set Diet Cycles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2 max-w-xs">
            {/* 👇 Bumped Label text sizes to text-base */}
            <Label className="text-base font-semibold flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-muted-foreground" /> Date
            </Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => { setDate(e.target.value); setSaved(false); }}
              className="h-12 text-base"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Leaf className="h-5 w-5 text-primary" /> Patient Diet Cycle
              </Label>
              <Select
                value={patientCycle}
                onValueChange={(v) => { setPatientCycle(v); setSaved(false); }}
              >
                <SelectTrigger className="h-12 text-base touch-target cursor-pointer">
                  <SelectValue placeholder="Select cycle" />
                </SelectTrigger>
                <SelectContent>
                  {dietCycles.map((c) => (
                    <SelectItem key={c.id} value={c.nameEn} className="text-base cursor-pointer">
                      {c.nameSi ? `${c.nameSi} / ` : ""}{c.nameEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Drumstick className="h-5 w-5 text-badge-hospital" /> Staff Diet Cycle
              </Label>
              <Select
                value={staffCycle}
                onValueChange={(v) => { setStaffCycle(v); setSaved(false); }}
              >
                <SelectTrigger className="h-12 text-base touch-target cursor-pointer">
                  <SelectValue placeholder="Select cycle" />
                </SelectTrigger>
                <SelectContent>
                  {dietCycles.map((c) => (
                    <SelectItem key={c.id} value={c.nameEn} className="text-base cursor-pointer">
                      {c.nameSi ? `${c.nameSi} / ` : ""}{c.nameEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {dietCycles.length === 0 && (
            <p className="text-sm text-destructive font-medium bg-destructive/10 p-3 rounded-md">
              No diet cycles found. Please add cycles in the Diet Cycles management page first.
            </p>
          )}

          <div className="flex justify-end pt-4 border-t mt-6">
            <Button
              onClick={handleSave}
              disabled={saved || saving || !patientCycle || !staffCycle}
              className="h-12 px-8 touch-target text-base font-medium"
            >
              {saving ? (
                <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Saving...</>
              ) : (
                <><Save className="h-5 w-5 mr-2" /> Save Cycle Selection</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDailyCycle;