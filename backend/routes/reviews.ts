import { Router, Request, Response } from 'express';
import authMiddleware from '../authMiddleware'; // Adjust the path as needed

const router = Router();

//make a review
router.post('/reviews', authMiddleware, (req: Request, res: Response) => {
    const { meal_id, rating, comment } = req.body;
    const user_id = req.user?.id ?? (() => { throw new Error('User is not authenticated'); })(); // Ensure user is defined
    const db = (req as any).db; // Retrieve the db instance from the request object
  
    const query = `
      INSERT INTO Reviews (meal_id, user_id, rating, comment)
      VALUES (?, ?, ?, ?)
    `;
  
    db.query(query, [meal_id, user_id, rating, comment])
      .then(() => res.status(201).send('Review created successfully'))
      .catch((err: Error) => {
        console.error('Error creating review:', err);
        res.status(500).send('Error creating review');
      });
  });
  
  // Get reviews for a meal
  router.get('/reviews', authMiddleware, (req: Request, res: Response) => {
    const { meal_id } = req.query;
    const db = (req as any).db; // Retrieve the db instance from the request object
  
    const query = `
      SELECT r.review_id AS id, r.rating, r.comment, r.created_at, u.username AS userName
      FROM Reviews r
      INNER JOIN users u ON r.user_id = u.id
      WHERE r.meal_id = ?
      ORDER BY r.created_at DESC
    `;
  
    db.query(query, [meal_id])
      .then(([rows]: [any[], any]) => res.status(200).json(rows))
      .catch((err: Error) => {
        console.error('Error fetching reviews:', err);
        res.status(500).send('Error fetching reviews');
      });
  });

export default router;