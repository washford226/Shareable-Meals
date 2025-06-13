import { Router, Request, Response } from "express";
import authMiddleware from "../authMiddleware";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client for backend (use service role key for full access)
const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const router = Router();

// Get all pantry items for the authenticated user
router.get("/pantry", authMiddleware, async (req: any, res: Response): Promise<void> => {
  const user = req.user;

  if (!user) {
    res.status(401).json({ message: "User is not authenticated" });
    return;
  }

  try {
    const { data, error } = await supabase
      .from("pantry")
      .select("pantry_id, food, quantity, unit, expiration_date, added_at, updated_at")
      .eq("user_id", user.id)
      .order("added_at", { ascending: false });

    if (error) throw error;

    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching pantry items:", error);
    res.status(500).json({ message: "Error fetching pantry items" });
  }
});

// Add a new item to the pantry
router.post("/pantry", authMiddleware, async (req: any, res: Response): Promise<void> => {
  const { food, quantity, unit, expiration_date } = req.body;
  const user = req.user;

  if (!food) {
    res.status(400).json({ message: "Food name is required" });
    return;
  }

  if (!user) {
    res.status(401).json({ message: "User is not authenticated" });
    return;
  }

  try {
    const { error } = await supabase
      .from("pantry")
      .insert([
        {
          user_id: user.id,
          food,
          quantity: quantity || null,
          unit,
          expiration_date,
        },
      ]);

    if (error) throw error;

    res.status(201).json({ message: "Pantry item added successfully" });
  } catch (error) {
    console.error("Error adding pantry item:", error);
    res.status(500).json({ message: "Error adding pantry item" });
  }
});

// Update an existing pantry item
router.put("/pantry/:id", authMiddleware, async (req: any, res: Response): Promise<void> => {
  const pantryId = req.params.id;
  const { food, quantity, unit, expiration_date } = req.body;
  const user = req.user;

  if (!user) {
    res.status(401).json({ message: "User is not authenticated" });
    return;
  }

  try {
    const { data, error } = await supabase
      .from("pantry")
      .update({
        food,
        quantity: quantity || null,
        unit,
        expiration_date,
      })
      .eq("pantry_id", pantryId)
      .eq("user_id", user.id)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      res.status(404).json({ message: "Pantry item not found" });
      return;
    }

    res.status(200).json({ message: "Pantry item updated successfully" });
  } catch (error) {
    console.error("Error updating pantry item:", error);
    res.status(500).json({ message: "Error updating pantry item" });
  }
});

// Delete a pantry item
router.delete("/pantry/:id", authMiddleware, async (req: any, res: Response): Promise<void> => {
  const pantryId = req.params.id;
  const user = req.user;

  if (!user) {
    res.status(401).json({ message: "User is not authenticated" });
    return;
  }

  try {
    const { data, error } = await supabase
      .from("pantry")
      .delete()
      .eq("pantry_id", pantryId)
      .eq("user_id", user.id)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      res.status(404).json({ message: "Pantry item not found" });
      return;
    }

    res.status(200).json({ message: "Pantry item deleted successfully" });
  } catch (error) {
    console.error("Error deleting pantry item:", error);
    res.status(500).json({ message: "Error deleting pantry item" });
  }
});

// Get a single pantry item by ID
router.get("/pantry/:id", authMiddleware, async (req: any, res: Response): Promise<void> => {
  const pantryId = req.params.id;
  const user = req.user;

  if (!user) {
    res.status(401).json({ message: "User is not authenticated" });
    return;
  }

  try {
    const { data, error } = await supabase
      .from("pantry")
      .select("pantry_id, food, quantity, unit, expiration_date, added_at, updated_at")
      .eq("pantry_id", pantryId)
      .eq("user_id", user.id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        res.status(404).json({ message: "Pantry item not found" });
      } else {
        throw error;
      }
      return;
    }

    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching pantry item:", error);
    res.status(500).json({ message: "Error fetching pantry item" });
  }
});

export default router;