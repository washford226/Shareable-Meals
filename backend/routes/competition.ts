import { Router, Request, Response } from "express";
import authMiddleware from "../authMiddleware";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client for backend (use service role key for full access)
const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const router = Router();

// Create a new competition
router.post("/competitions", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { start_date, end_date, theme } = req.body;

  if (!start_date || !end_date) {
    res.status(400).json({ error: "Start date and end date are required." });
    return;
  }

  try {
    const { error } = await supabase
      .from("weekly_competitions")
      .insert([{ start_date, end_date, theme }]);

    if (error) throw error;

    res.status(201).json({ message: "Competition created successfully." });
  } catch (err) {
    console.error("Error creating competition:", err);
    res.status(500).json({ error: "Error creating competition." });
  }
});

// Add a meal to the current competition
router.post("/competitions/current/meals", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { meal_id } = req.body;
  const user_id = (req as any).user?.id;

  if (!meal_id) {
    res.status(400).json({ error: "Meal ID is required." });
    return;
  }

  try {
    // Fetch the most recent competition
    const { data: competitions, error: compError } = await supabase
      .from("weekly_competitions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);

    if (compError) throw compError;

    const currentCompetition = competitions && competitions[0];

    if (!currentCompetition) {
      res.status(404).json({ error: "No active competition found." });
      return;
    }

    const competition_id = currentCompetition.competition_id;

    // Check for duplicate entry
    const { data: existingEntry, error: dupError } = await supabase
      .from("meal_votes")
      .select("*")
      .eq("competition_id", competition_id)
      .eq("meal_id", meal_id);

    if (dupError) throw dupError;

    if (existingEntry && existingEntry.length > 0) {
      res.status(400).json({ error: "Meal is already added to the competition." });
      return;
    }

    // Insert the meal into the competition
    const { error: insertError } = await supabase
      .from("meal_votes")
      .insert([{ competition_id, meal_id, user_id }]);

    if (insertError) throw insertError;

    res.status(201).json({ message: "Meal added to the competition successfully." });
  } catch (err) {
    console.error("Error adding meal to competition:", err);
    res.status(500).json({ error: "Internal server error. Please try again later." });
  }
});

// Vote for a meal in a competition
router.post("/competitions/:competition_id/vote", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { competition_id } = req.params;
  const { meal_id } = req.body;
  const user_id = (req as any).user?.id;

  if (!meal_id) {
    res.status(400).json({ error: "Meal ID is required to vote." });
    return;
  }

  try {
    // Check if the user has already voted for this meal in this competition
    const { data: existingVote, error: voteError } = await supabase
      .from("meal_votes")
      .select("*")
      .eq("user_id", user_id)
      .eq("competition_id", competition_id)
      .eq("meal_id", meal_id);

    if (voteError) throw voteError;

    if (existingVote && existingVote.length > 0) {
      res.status(400).json({ error: "You have already voted for this meal in this competition." });
      return;
    }

    // Add the vote
    const { error: insertError } = await supabase
      .from("meal_votes")
      .insert([{ user_id, meal_id, competition_id }]);

    if (insertError) throw insertError;

    res.status(201).json({ message: "Vote cast successfully." });
  } catch (err) {
    console.error("Error casting vote:", err);
    res.status(500).json({ error: "Error casting vote." });
  }
});

// Get all meals in a competition
router.get("/competitions/:competition_id/meals", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { competition_id } = req.params;

  try {
    // Get all meals and their vote counts for this competition
    const { data, error } = await supabase
      .from("meal_votes")
      .select(`
        meal_id,
        meals (
          id,
          name,
          description,
          picture
        ),
        vote_id
      `)
      .eq("competition_id", competition_id);

    if (error) throw error;

    // Aggregate votes per meal
    const mealMap: Record<string, any> = {};
    (data || []).forEach((vote: any) => {
      const mealId = vote.meal_id;
      if (!mealMap[mealId]) {
        mealMap[mealId] = {
          meal_id: mealId,
          name: vote.meals?.name,
          description: vote.meals?.description,
          picture: vote.meals?.picture,
          votes: 0,
        };
      }
      mealMap[mealId].votes += 1;
    });

    const meals = Object.values(mealMap).sort((a: any, b: any) => b.votes - a.votes);

    res.status(200).json(meals);
  } catch (err) {
    console.error("Error fetching competition meals:", err);
    res.status(500).json({ error: "Error fetching competition meals." });
  }
});

// Get the winner of a competition
router.get("/competitions/:competition_id/winner", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { competition_id } = req.params;

  try {
    // Get all meals and their vote counts for this competition
    const { data, error } = await supabase
      .from("meal_votes")
      .select(`
        meal_id,
        meals (
          id,
          name,
          description,
          picture
        ),
        vote_id
      `)
      .eq("competition_id", competition_id);

    if (error) throw error;

    // Aggregate votes per meal
    const mealMap: Record<string, any> = {};
    (data || []).forEach((vote: any) => {
      const mealId = vote.meal_id;
      if (!mealMap[mealId]) {
        mealMap[mealId] = {
          meal_id: mealId,
          name: vote.meals?.name,
          description: vote.meals?.description,
          picture: vote.meals?.picture,
          votes: 0,
        };
      }
      mealMap[mealId].votes += 1;
    });

    const meals = Object.values(mealMap).sort((a: any, b: any) => b.votes - a.votes);

    if (meals.length === 0) {
      res.status(404).json({ error: "No winner found for this competition." });
      return;
    }

    res.status(200).json(meals[0]);
  } catch (err) {
    console.error("Error fetching competition winner:", err);
    res.status(500).json({ error: "Error fetching competition winner." });
  }
});

// Get all competitions
router.get("/competitions", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from("weekly_competitions")
      .select(`
        competition_id,
        start_date,
        end_date,
        theme,
        created_at
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.status(200).json(data);
  } catch (err) {
    console.error("Error fetching competitions:", err);
    res.status(500).json({ error: "Error fetching competitions." });
  }
});

export default router;