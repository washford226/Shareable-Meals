import { Router, Request, Response } from "express";

// Extend the Request interface to include the 'db' property
declare global {
  namespace Express {
    interface Request {
      db?: any; // Replace 'any' with the actual type of your database connection if known
    }
  }
}
import authMiddleware from "../authMiddleware";
import axios from "axios";

const router = Router();

router.post("/generate-meal", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { prompt, dietaryRestrictions, allergies, usePantry } = req.body;
  const user = req.user;
  const db = req.db;

  if (!prompt) {
    res.status(400).json({ error: "Prompt is required to generate a meal." });
    return;
  }

  let pantryItems = [];

  // Fetch pantry items if `usePantry` is true
  if (usePantry) {
    if (!db) {
      res.status(500).json({ error: "Database connection is not available." });
      return;
    }

    try {
      if (!user) {
        res.status(401).json({ error: "User is not authenticated." });
        return;
      }

      const [rows] = await db.query(
        "SELECT food, quantity, unit FROM Pantry WHERE user_id = ?",
        [user.id]
      );
      pantryItems = rows.map(
        (item: any) => `${item.food} (${item.quantity || ""} ${item.unit || ""})`
      );
    } catch (error) {
      console.error("Error fetching pantry items:", error);
      res.status(500).json({ error: "Failed to fetch pantry items." });
      return;
    }
  }

  // Construct the AI prompt
  const fullPrompt = `Create a meal based on the following prompt: ${prompt}. ${
  dietaryRestrictions ? `Dietary restrictions: ${dietaryRestrictions}.` : ""
} ${allergies ? `Avoid the following allergens: ${allergies}.` : ""} ${
  usePantry && pantryItems.length > 0
    ? `Use only these ingredients: ${pantryItems.join(", ")}.`
    : ""
} Please provide the output in the following format:
- Name: [Meal Name]
- Description: [Meal Description]
- Servings: [Number of servings]
- Ingredients: List each ingredient on a new line with quantity and unit (eg. beef 1 lb). Avoid alternatives.
- Instructions: [Cooking Instructions]`;

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [{ text: fullPrompt }],
          },
        ],
      },
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!rawText) {
      console.error("Gemini response did not include meal text:", response.data);
      res.status(500).json({ error: "Failed to generate meal text from Gemini API." });
      return;
    }

    // Parse the AI response into structured fields
    const meal = parseMealResponse(rawText);

    if (!meal) {
      console.error("Failed to parse meal response:", rawText);
      res.status(500).json({ error: "Failed to parse meal response from Gemini API." });
      return;
    }

    res.status(200).json(meal);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error("Error from Gemini API:", error.response.data);
      res.status(error.response.status).json({
        error: error.response.data.error?.message || "Error from Gemini API",
      });
    } else {
      console.error("Unexpected error generating meal:", error);
      res.status(500).json({ error: "An internal server error occurred." });
    }
  }
});

// Helper function to parse the AI response into structured fields
function parseMealResponse(rawText: string) {
  const meal: {
    name?: string;
    description?: string;
    servings?: string;
    ingredients?: { name: string; quantity: string; unit: string }[];
    instructions?: string;
  } = {};

  const nameMatch = rawText.match(/- Name:\s*(.+)/i);
  const descriptionMatch = rawText.match(/- Description:\s*(.+)/i);
  const servingsMatch = rawText.match(/- Servings:\s*(.+)/i); // <-- Add this line
  const ingredientsMatch = rawText.match(/- Ingredients:\s*([\s\S]*?)(?=- Instructions:|$)/i);
  const instructionsMatch = rawText.match(/- Instructions:\s*([\s\S]*)/i);

  meal.name = nameMatch ? nameMatch[1].trim() : undefined;
  meal.description = descriptionMatch ? descriptionMatch[1].trim() : undefined;
  meal.servings = servingsMatch ? servingsMatch[1].trim() : undefined;

  // Parse ingredients into array of objects: { name, quantity, unit }
  if (ingredientsMatch) {
    const ingredientLines = ingredientsMatch[1]
      .split(/\n|,/g)
      .map((item) => {
        let cleaned = item.trim();
        // If the ingredient contains " or ", only keep the first option
        if (/ or /i.test(cleaned)) {
          cleaned = cleaned.split(/ or /i)[0].trim();
        }
        // Remove leading bullets or asterisks
        cleaned = cleaned.replace(/^[\*\-\d\.\s]+/, "");
        return cleaned;
      })
      .filter((item) => item);

    meal.ingredients = ingredientLines.map(line => {
      // Try to match "name quantity unit" or "name unit quantity"
      // We'll use a simple regex: (name) (quantity) (unit)
      // Example: "beef sirloin 1 lb"
      const match = line.match(/^(.+?)\s+([\d\/\.]+)\s*([a-zA-Z]+)?$/);
      if (match) {
        return {
          name: match[1].trim(),
          quantity: match[2].trim(),
          unit: match[3]?.trim() || "",
        };
      } else {
        // fallback: just name
        return { name: line, quantity: "", unit: "" };
      }
    });
  } else {
    meal.ingredients = [];
  }

  if (instructionsMatch) {
    const instructions = instructionsMatch[1]
      .split(/\n/g)
      .map((step) => step.trim())
      .filter((step) => step);
    meal.instructions = instructions.join("\n");
  }

  return meal;
}

export default router;