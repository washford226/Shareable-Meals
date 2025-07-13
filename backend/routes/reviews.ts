import { Router, Request, Response } from 'express';
import authMiddleware from '../authMiddleware';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for backend (use service role key for full access)
const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const router = Router();

// Create a review
router.post('/reviews', authMiddleware, async (req: Request, res: Response) => {
  const { meal_id, rating, comment } = req.body;
  const user_id = (req as any).user?.id;

  if (!user_id) {
    res.status(401).json({ message: 'User is not authenticated' });
    return;
  }
  if (!meal_id || !rating) {
    res.status(400).json({ message: 'Meal ID and rating are required' });
    return;
  }

  try {
    const { error } = await supabase
      .from("reviews")
      .insert([{ meal_id, user_id, rating, comment }]);

    if (error) throw error;

    res.status(201).json({ message: 'Review created successfully' });
  } catch (err) {
    console.error('Error creating review:', err);
    res.status(500).json({ message: 'Error creating review' });
  }
});

// Get reviews for a meal
router.get('/reviews', authMiddleware, async (req: Request, res: Response) => {
  const { meal_id } = req.query;

  if (!meal_id) {
    res.status(400).json({ message: 'Meal ID is required' });
    return;
  }

  try {
    const { data, error } = await supabase
      .from("reviews")
      .select(`
        review_id AS id,
        rating,
        comment,
        created_at,
        profiles:user_id (
          username
        )
      `)
      .eq("meal_id", meal_id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Format username for frontend compatibility
    const formatted = (data || []).map((r: any) => ({
      ...r,
      userName: r.profiles?.username || "Anonymous"
    }));

    res.status(200).json(formatted);
  } catch (err) {
    console.error('Error fetching reviews:', err);
    res.status(500).json({ message: 'Error fetching reviews' });
  }
});

export default router;