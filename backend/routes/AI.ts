import { Router, Request, Response } from 'express';
import authMiddleware from '../authMiddleware';
import axios from 'axios';

const router = Router();

router.post('/generate-meal', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { prompt, dietaryRestrictions, allergies } = req.body; // Include allergies in the request body

  if (!prompt) {
    res.status(400).json({ error: 'Prompt is required to generate a meal.' });
    return;
  }

  const fullPrompt = `Create a meal based on the following prompt: ${prompt}. ${
    dietaryRestrictions ? `Dietary restrictions: ${dietaryRestrictions}.` : ''
  } ${
    allergies ? `Avoid the following allergens: ${allergies}.` : ''
  } Please provide the output in the following format:
  - Name: [Meal Name]
  - Description: [Meal Description]
  - Ingredients: [List of Ingredients]
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
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!rawText) {
      console.error('Gemini response did not include meal text:', response.data);
      res.status(500).json({ error: 'Failed to generate meal text from Gemini API.' });
      return;
    }

    // Parse the AI response into structured fields
    const meal = parseMealResponse(rawText);

    if (!meal) {
      console.error('Failed to parse meal response:', rawText);
      res.status(500).json({ error: 'Failed to parse meal response from Gemini API.' });
      return;
    }

    res.status(200).json(meal);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error('Error from Gemini API:', error.response.data);
      res.status(error.response.status).json({
        error: error.response.data.error?.message || 'Error from Gemini API',
      });
    } else {
      console.error('Unexpected error generating meal:', error);
      res.status(500).json({ error: 'An internal server error occurred.' });
    }
  }
});

// Helper function to parse the AI response into structured fields
function parseMealResponse(rawText: string) {
  const meal: {
    name?: string;
    description?: string;
    ingredients?: string;
    instructions?: string;
  } = {};

  const nameMatch = rawText.match(/- Name:\s*(.+)/i);
  const descriptionMatch = rawText.match(/- Description:\s*(.+)/i);
  const ingredientsMatch = rawText.match(/- Ingredients:\s*([\s\S]*?)(?=- Instructions:|$)/i); // Capture all ingredients until the next section
  const instructionsMatch = rawText.match(/- Instructions:\s*(.+)/i);

  meal.name = nameMatch ? nameMatch[1].trim() : undefined;
  meal.description = descriptionMatch ? descriptionMatch[1].trim() : undefined;

  // Process ingredients to ensure they are separated by commas
  if (ingredientsMatch) {
    const ingredients = ingredientsMatch[1]
      .split(/\n|,/g) // Split by newlines or commas
      .map((item) => item.trim()) // Trim whitespace
      .filter((item) => item); // Remove empty items
    meal.ingredients = ingredients.join(", "); // Join ingredients with commas
  }

  meal.instructions = instructionsMatch ? instructionsMatch[1].trim() : undefined;

  return meal;
}

export default router;