import { Router, Request, Response } from 'express';
import authMiddleware from '../authMiddleware';
import { createClient } from '@supabase/supabase-js';

const router = Router();

// Initialize Supabase client for backend (use service role key for full access)
const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

router.post('/report', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { meal_id, reason } = req.body;
  const user = (req as any).user; // Authenticated user

  if (!meal_id || !reason) {
    res.status(400).json({ message: 'Meal ID and reason are required' });
    return;
  }

  if (!user) {
    res.status(401).json({ message: 'User is not authenticated' });
    return;
  }

  try {
    const { error } = await supabase
      .from("reports")
      .insert([
        {
          user_id: user.id,
          meal_id,
          reason,
        },
      ]);

    if (error) throw error;

    res.status(201).json({ message: 'Report submitted successfully' });
  } catch (error) {
    console.error('Error submitting report:', error);
    res.status(500).json({ message: 'Error submitting report' });
  }
});

export default router;