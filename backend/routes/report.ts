import { Router, Request, Response } from 'express';
import authMiddleware from '../authMiddleware'; // Adjust the path as needed

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

router.post('/report', authMiddleware, async (req: CustomRequest, res: Response): Promise<void> => {
  const { meal_id, reason } = req.body;
  const user = req.user; // Authenticated user
  const db = req.db; // Database connection

  if (!meal_id || !reason) {
    res.status(400).json({ message: 'Meal ID and reason are required' });
    return;
  }

  if (!user) {
    res.status(401).json({ message: 'User is not authenticated' });
    return;
  }

  if (!db) {
    res.status(500).json({ message: 'Database connection is not available' });
    return;
  }

  try {
    await db.query(
      'INSERT INTO REPORTS (user_id, meal_id, reason) VALUES (?, ?, ?)',
      [user.id, meal_id, reason]
    );
    res.status(201).json({ message: 'Report submitted successfully' });
  } catch (error) {
    console.error('Error submitting report:', error);
    res.status(500).json({ message: 'Error submitting report' });
  }
});

export default router;