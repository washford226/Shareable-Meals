import { Router, Request, Response } from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import { createClient } from "@supabase/supabase-js";
import authMiddleware from "../authMiddleware";

// Initialize Supabase client for backend (use service role key for full access)
const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const router = Router();

// Fetch and parse a recipe from a URL, and optionally save to Supabase
router.post("/fetch-recipe", authMiddleware, async (req: any, res: Response) => {
  const { url, save } = req.body;
  const user = req.user;

  if (!url) {
    res.status(400).json({ error: "URL is required." });
    return;
  }

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    res.status(400).json({ error: "Invalid URL format. URL must start with http:// or https://." });
    return;
  }

  try {
    const { data: html, headers } = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MealPlannerBot/1.0; +https://yourapp.com)",
      },
    });

    if (!headers["content-type"]?.includes("text/html")) {
      res.status(400).json({ error: "The provided URL does not return an HTML page." });
      return;
    }

    const $ = cheerio.load(html);

    const name = $("meta[property='og:title']").attr("content") || $("title").text();
    const description = $("meta[property='og:description']").attr("content") || "";

    let ingredients: string[] = [];
    let instructions: string[] = [];
    let servings: string | undefined;

    // Parse ALL JSON-LD script blocks
    $('script[type="application/ld+json"]').each((_, el) => {
      const ldJsonRaw = $(el).html();
      if (!ldJsonRaw) return;

      try {
        const jsonData = JSON.parse(ldJsonRaw);
        const candidates = Array.isArray(jsonData)
          ? jsonData
          : jsonData["@graph"] ?? [jsonData];

        for (const item of candidates) {
          if (item["@type"] === "Recipe") {
            if (!ingredients.length && item.recipeIngredient) {
              ingredients = item.recipeIngredient;
            }

            const steps = item.recipeInstructions;
            if (!instructions.length && steps) {
              if (Array.isArray(steps)) {
                instructions = steps.map((step: any) =>
                  typeof step === "string" ? step : step.text || ""
                );
              } else if (typeof steps === "string") {
                instructions = [steps];
              }
            }

            // Get servings from recipeYield
            if (!servings && item.recipeYield) {
              if (typeof item.recipeYield === "string") {
                servings = item.recipeYield.replace(/[^\d]/g, "") || item.recipeYield;
              } else if (Array.isArray(item.recipeYield)) {
                servings = item.recipeYield[0].replace(/[^\d]/g, "") || item.recipeYield[0];
              }
            }

            break; // Stop after the first valid recipe
          }
        }
      } catch (e) {
        console.warn("Error parsing JSON-LD block", e);
      }
    });

    // Fallback: known HTML selectors
    if (ingredients.length === 0) {
      $("li.ingredient, span.ingredient, .recipe-ingredients__item, ul.ingredients li").each((_, el) => {
        const text = $(el).text().trim();
        if (text) ingredients.push(text);
      });
    }

    if (instructions.length === 0) {
      $("li.instruction, .step, .instructions-section-item, ol.instructions li").each((_, el) => {
        const text = $(el).text().trim();
        if (text) instructions.push(text);
      });
    }

    // Fallback: try to find servings in common HTML elements if not found in JSON-LD
    if (!servings) {
      const servingsSelectors = [
        '[itemprop="recipeYield"]',
        '.servings',
        '.recipe-servings',
        '.yield',
        'span:contains("Servings")',
        'span:contains("Yield")'
      ];
      for (const selector of servingsSelectors) {
        const text = $(selector).first().text().trim();
        if (text) {
          servings = text.replace(/[^\d]/g, "") || text;
          if (servings) break;
        }
      }
    }

    const unique = (arr: string[]) => [...new Set(arr.map((s) => s.trim()).filter(Boolean))];

    // If save=true, insert the meal into Supabase
    let savedMeal = null;
    if (save && user) {
      try {
        const { data, error } = await supabase
          .from("meals")
          .insert([{
            name: name?.trim() || "Untitled Recipe",
            description: description?.trim() || "",
            ingredients: unique(ingredients),
            instructions: unique(instructions).join(" "),
            servings: servings || "1",
            user_id: user.id,
            recipeLink: url,
            visibility: false,
            created_by: "URL Import"
          }])
          .select()
          .single();

        if (error) throw error;
        savedMeal = data;
      } catch (err) {
        console.error("Error saving meal to Supabase:", err);
        // Don't fail the whole request if save fails, just don't return savedMeal
      }
    }

    res.status(200).json({
      name: name?.trim() || "Untitled Recipe",
      description: description?.trim(),
      ingredients: unique(ingredients),
      instructions: unique(instructions).join(" "),
      servings: servings || "1",
      savedMeal,
    });
  } catch (error) {
    console.error("Error fetching recipe:", error);
    res.status(500).json({ error: "Failed to fetch recipe data." });
  }
});

export default router;