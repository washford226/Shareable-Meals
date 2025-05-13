import { Router, Request, Response } from "express";
import authMiddleware from "../authMiddleware"; // Adjust the path as needed

const router = Router();

// Extend the Request type to include user and db properties
interface CustomRequest extends Request {
  user?: {
    id: number;
    username: string;
  };
  db?: {
    query: (sql: string, params: any[]) => Promise<any>;
  };
}

// Get all pantry items for the authenticated user
router.get("/pantry", authMiddleware, async (req: CustomRequest, res: Response): Promise<void> => {
  const user = req.user; // Authenticated user
  const db = req.db; // Database connection

  if (!user) {
    res.status(401).json({ message: "User is not authenticated" });
    return;
  }

  if (!db) {
    res.status(500).json({ message: "Database connection is not available" });
    return;
  }

  try {
    const [rows] = await db.query(
      "SELECT pantry_id, food, quantity, unit, expiration_date, added_at, updated_at FROM Pantry WHERE user_id = ?",
      [user.id]
    );
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching pantry items:", error);
    res.status(500).json({ message: "Error fetching pantry items" });
  }
});

// Add a new item to the pantry
router.post("/pantry", authMiddleware, async (req: CustomRequest, res: Response): Promise<void> => {
  const { food, quantity, unit, expiration_date } = req.body;
  const user = req.user; // Authenticated user
  const db = req.db; // Database connection

  if (!food) {
    res.status(400).json({ message: "Food name is required" });
    return;
  }

  if (!user) {
    res.status(401).json({ message: "User is not authenticated" });
    return;
  }

  if (!db) {
    res.status(500).json({ message: "Database connection is not available" });
    return;
  }

  try {
    await db.query(
      "INSERT INTO Pantry (user_id, food, quantity, unit, expiration_date) VALUES (?, ?, ?, ?, ?)",
      [user.id, food, quantity || null, unit, expiration_date]
    );
    res.status(201).json({ message: "Pantry item added successfully" });
  } catch (error) {
    console.error("Error adding pantry item:", error);
    res.status(500).json({ message: "Error adding pantry item" });
  }
});

// Update an existing pantry item
router.put("/pantry/:id", authMiddleware, async (req: CustomRequest, res: Response): Promise<void> => {
  const pantryId = req.params.id;
  const { food, quantity, unit, expiration_date } = req.body;
  const user = req.user; // Authenticated user
  const db = req.db; // Database connection

  if (!user) {
    res.status(401).json({ message: "User is not authenticated" });
    return;
  }

  if (!db) {
    res.status(500).json({ message: "Database connection is not available" });
    return;
  }

  try {
    const [result] = await db.query(
      "UPDATE Pantry SET food = ?, quantity = ?, unit = ?, expiration_date = ? WHERE pantry_id = ? AND user_id = ?",
      [food, quantity || null, unit, expiration_date, pantryId, user.id]
    );

    if ((result as any).affectedRows === 0) {
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
router.delete("/pantry/:id", authMiddleware, async (req: CustomRequest, res: Response): Promise<void> => {
  const pantryId = req.params.id;
  const user = req.user; // Authenticated user
  const db = req.db; // Database connection

  if (!user) {
    res.status(401).json({ message: "User is not authenticated" });
    return;
  }

  if (!db) {
    res.status(500).json({ message: "Database connection is not available" });
    return;
  }

  try {
    const [result] = await db.query(
      "DELETE FROM Pantry WHERE pantry_id = ? AND user_id = ?",
      [pantryId, user.id]
    );

    if ((result as any).affectedRows === 0) {
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
router.get("/pantry/:id", authMiddleware, async (req: CustomRequest, res: Response): Promise<void> => {
  const pantryId = req.params.id;
  const user = req.user; // Authenticated user
  const db = req.db; // Database connection

  if (!user) {
    res.status(401).json({ message: "User is not authenticated" });
    return;
  }

  if (!db) {
    res.status(500).json({ message: "Database connection is not available" });
    return;
  }

  try {
    const [rows] = await db.query(
      "SELECT pantry_id, food, quantity, unit, expiration_date, added_at, updated_at FROM Pantry WHERE pantry_id = ? AND user_id = ?",
      [pantryId, user.id]
    );

    if (rows.length === 0) {
      res.status(404).json({ message: "Pantry item not found" });
      return;
    }

    res.status(200).json(rows[0]); // Return the single pantry item
  } catch (error) {
    console.error("Error fetching pantry item:", error);
    res.status(500).json({ message: "Error fetching pantry item" });
  }
});

export default router;