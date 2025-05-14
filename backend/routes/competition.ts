import { Router, Request, Response } from "express";
import authMiddleware from "../authMiddleware";

const router = Router();

// Create a new competition
router.post("/competitions", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { start_date, end_date } = req.body;
  const db = (req as any).db;

  if (!start_date || !end_date) {
    res.status(400).json({ error: "Start date and end date are required." });
    return;
  }

  try {
    const query = `
      INSERT INTO weekly_competitions (start_date, end_date)
      VALUES (?, ?)
    `;
    await db.query(query, [start_date, end_date]);
    res.status(201).json({ message: "Competition created successfully." });
  } catch (err) {
    console.error("Error creating competition:", err);
    res.status(500).json({ error: "Error creating competition." });
  }
});

// Add a meal to a competition
router.post("/competitions/current/meals", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const db = (req as any).db;
  const { meal_id } = req.body;
  const user_id = (req as any).user?.id;

  if (!meal_id) {
    res.status(400).json({ error: "Meal ID is required." });
    return;
  }

  try {
    // Fetch the current competition ID
    const [competitionRows] = await db.query(
      `SELECT competition_id, theme FROM weekly_competitions ORDER BY created_at DESC LIMIT 1`
    );
    const currentCompetition = competitionRows[0];

    if (!currentCompetition) {
      res.status(404).json({ error: "No active competition found." });
      return;
    }

    const { competition_id, theme } = currentCompetition;

    // Check for duplicate entry
    const [existingEntry] = await db.query(
      "SELECT * FROM meal_votes WHERE competition_id = ? AND meal_id = ?",
      [competition_id, meal_id]
    );
    if (existingEntry.length > 0) {
      res.status(400).json({ error: "Meal is already added to the competition." });
      return;
    }

    // Insert the meal into the competition
    const query = `
      INSERT INTO meal_votes (competition_id, meal_id, user_id)
      VALUES (?, ?, ?)
    `;
    await db.query(query, [competition_id, meal_id, user_id]);

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
  const db = (req as any).db;

  if (!meal_id) {
    res.status(400).json({ error: "Meal ID is required to vote." });
    return;
  }

  try {
    // Check if the user has already voted for this meal in this competition
    const [existingVote] = await db.query(
      "SELECT * FROM meal_votes WHERE user_id = ? AND competition_id = ? AND meal_id = ?",
      [req.user?.id, competition_id, meal_id]
    );

    if (existingVote.length > 0) {
      res.status(400).json({ error: "You have already voted for this meal in this competition." });
      return;
    }

    // Add the vote
    const query = `
      INSERT INTO meal_votes (user_id, meal_id, competition_id)
      VALUES (?, ?, ?)
    `;
    await db.query(query, [req.user?.id, meal_id, competition_id]);
    res.status(201).json({ message: "Vote cast successfully." });
  } catch (err) {
    console.error("Error casting vote:", err);
    res.status(500).json({ error: "Error casting vote." });
  }
});

// Get all meals in a competition
router.get("/competitions/:competition_id/meals", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { competition_id } = req.params;
  const db = (req as any).db;

  try {
    const query = `
      SELECT 
        meals.id AS meal_id,
        meals.name,
        meals.description,
        meals.picture,
        COUNT(meal_votes.vote_id) AS votes
      FROM meal_votes
      INNER JOIN meals ON meal_votes.meal_id = meals.id
      WHERE meal_votes.competition_id = ?
      GROUP BY meals.id
      ORDER BY votes DESC
    `;
    const [rows] = await db.query(query, [competition_id]);
    res.status(200).json(rows);
  } catch (err) {
    console.error("Error fetching competition meals:", err);
    res.status(500).json({ error: "Error fetching competition meals." });
  }
});

// Get the winner of a competition
router.get("/competitions/:competition_id/winner", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { competition_id } = req.params;
  const db = (req as any).db;

  try {
    const query = `
      SELECT 
        meals.id AS meal_id,
        meals.name,
        meals.description,
        meals.picture,
        COUNT(meal_votes.vote_id) AS votes
      FROM meal_votes
      INNER JOIN meals ON meal_votes.meal_id = meals.id
      WHERE meal_votes.competition_id = ?
      GROUP BY meals.id
      ORDER BY votes DESC
      LIMIT 1
    `;
    const [rows] = await db.query(query, [competition_id]);

    if (rows.length === 0) {
      res.status(404).json({ error: "No winner found for this competition." });
      return;
    }

    res.status(200).json(rows[0]);
  } catch (err) {
    console.error("Error fetching competition winner:", err);
    res.status(500).json({ error: "Error fetching competition winner." });
  }
});

// Get all competitions
router.get("/competitions", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const db = (req as any).db;

  try {
    const query = `
      SELECT 
        competition_id,
        start_date,
        end_date,
        theme,
        created_at
      FROM weekly_competitions
      ORDER BY created_at DESC
    `;
    const [rows] = await db.query(query);
    res.status(200).json(rows);
  } catch (err) {
    console.error("Error fetching competitions:", err);
    res.status(500).json({ error: "Error fetching competitions." });
  }
});

export default router;