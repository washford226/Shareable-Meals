import { Router } from 'express';

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import nodemailer from 'nodemailer';
import authMiddleware from '../authMiddleware';
import crypto from 'crypto';
import { Request, Response } from 'express';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

interface User {
  id: number;
  username: string;
  email: string;
  password: string;
  created_at: Date;
  profile_picture: string | Blob;
}

// Example route
router.get('/', (req, res) => {
    res.send('Meal endpoint');
});

// Signup user
router.post('/signup', upload.single('profile_picture'), async (req: import('express').Request, res: import('express').Response): Promise<void> => {
    const { username, email, password, calories_goal, dietary_restrictions } = req.body as { 
        username: string; 
        email: string; 
        password: string; 
        calories_goal?: number; 
        dietary_restrictions?: string; 
    };
    const profilePicture = req.file?.buffer;
    const db = (req as any).db;
  
    // Validate file type
    if (req.file && !['image/jpeg', 'image/png'].includes(req.file.mimetype)) {
      res.status(400).send({ message: 'Invalid file type. Only JPEG and PNG are allowed.' });
      return;
    }
  
    // Validate file size
    if (req.file && req.file.size > 5 * 1024 * 1024) { // 5 MB limit
      res.status(400).send({ message: 'File size exceeds the limit of 5 MB.' });
      return;
    }
  
    try {
      // Check if the username or email already exists
      const [existingUsers]: [User[], any] = await db.query('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
      if (existingUsers.length > 0) {
        res.status(400).send({ message: 'Username or email already exists' });
        return;
      }
  
      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);
  
      // Insert the new user into the database
      const query = `
        INSERT INTO users (username, email, password, calories_goal, dietary_restrictions, profile_picture)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      const [result]: any = await db.query(query, [username, email, hashedPassword, calories_goal, dietary_restrictions, profilePicture]);
  
      // Get the newly created user's ID
      const userId = result.insertId;
  
      // Define default meals
      const defaultMeals = [
        {
          name: 'Grilled Chicken Salad',
          description: 'A healthy grilled chicken salad with fresh vegetables.',
          ingredients: JSON.stringify(['Chicken', 'Lettuce', 'Tomatoes', 'Cucumber']),
          calories: 350,
          protein: 30,
          carbohydrates: 10,
          fat: 15,
          visibility: 0,
          instructions: 'Grill the chicken and mix with vegetables.',
          recipeLink: 'https://example.com/grilled-chicken-salad',
        },
        {
          name: 'Oatmeal with Fruits',
          description: 'A bowl of oatmeal topped with fresh fruits.',
          ingredients: JSON.stringify(['Oats', 'Milk', 'Banana', 'Strawberries']),
          calories: 300,
          protein: 10,
          carbohydrates: 50,
          fat: 5,
          visibility: 0,
          instructions: 'Cook oats with milk and top with fruits.',
          recipeLink: 'https://example.com/oatmeal-fruits',
        },
        {
          name: 'Spaghetti Bolognese',
          description: 'Classic spaghetti with a rich bolognese sauce.',
          ingredients: JSON.stringify(['Spaghetti', 'Ground Beef', 'Tomato Sauce', 'Onions', 'Garlic']),
          calories: 600,
          protein: 25,
          carbohydrates: 75,
          fat: 20,
          visibility: 0,
          instructions: 'Cook spaghetti and prepare the bolognese sauce.',
          recipeLink: 'https://example.com/spaghetti-bolognese',
        },
        {
          name: 'Vegetable Stir Fry',
          description: 'A quick and easy vegetable stir fry.',
          ingredients: JSON.stringify(['Broccoli', 'Carrots', 'Bell Peppers', 'Soy Sauce']),
          calories: 200,
          protein: 5,
          carbohydrates: 30,
          fat: 5,
          visibility: 0,
          instructions: 'Stir fry vegetables with soy sauce.',
          recipeLink: 'https://example.com/vegetable-stir-fry',
        },
        {
          name: 'Grilled Salmon',
          description: 'A simple grilled salmon with lemon.',
          ingredients: JSON.stringify(['Salmon', 'Lemon', 'Olive Oil', 'Garlic']),
          calories: 400,
          protein: 35,
          carbohydrates: 0,
          fat: 25,
          visibility: 0,
          instructions: 'Grill the salmon and serve with lemon.',
          recipeLink: 'https://example.com/grilled-salmon',
        },
      ];
  
      // Insert default meals into the database
      const mealQuery = `
        INSERT INTO meals (name, description, ingredients, calories, protein, carbohydrates, fat, visibility, user_id, instructions, recipeLink)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      for (const meal of defaultMeals) {
        await db.query(mealQuery, [
          meal.name,
          meal.description,
          meal.ingredients,
          meal.calories,
          meal.protein,
          meal.carbohydrates,
          meal.fat,
          meal.visibility,
          userId,
          meal.instructions,
          meal.recipeLink,
        ]);
      }
  
      res.status(200).send('User signed up successfully with default meals added');
    } catch (err) {
      console.error('Error during signup:', err);
      res.status(500).send('Error during signup');
    }
  });
  
// Login user
router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  const db = (req as any).db;

  db.query('SELECT * FROM users WHERE username = ?', [username])
    .then(([rows]: [User[], any]) => {
      if (rows.length === 0) {
        return res.status(404).send('User does not exist');
      }

      const user = rows[0];
      return bcrypt.compare(password, user.password)
        .then((isPasswordValid: boolean) => {
          if (!isPasswordValid) {
            return res.status(400).send('Password incorrect');
          }

          const secret: string | undefined = process.env.JWT_SECRET;
          if (!secret) {
            return res.status(500).send('JWT secret is not defined');
          }

          const token: string = jwt.sign({ id: user.id, username: user.username }, secret, { expiresIn: '1h' });
          res.status(200).json({ message: 'User logged in successfully', token });
        });
    })
    .catch((err: Error) => {
      console.error('Error logging in:', err);
      res.status(500).send('Error logging in');
    });
});
  
  // Forgot Password or username
  router.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body;
    const db = (req as any).db;
  
    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }
  
    try {
      // Check if the user exists
      const [rows] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
      if (rows.length === 0) {
        res.status(404).json({ error: 'User with this email does not exist' });
        return;
      }
  
      const userId = rows[0].id;
  
      // Generate a secure token
      const token = crypto.randomBytes(32).toString('hex');
      const tokenExpiration = new Date(Date.now() + 3600000); // Token valid for 1 hour
  
      // Save the token and expiration in the database
      await db.query('INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)', [
        userId,
        token,
        tokenExpiration,
      ]);
  
      // Send the reset link via email
      const transporter = nodemailer.createTransport({
        service: 'Gmail', // Or another email service
        auth: {
          user: 'your-email@gmail.com',
          pass: 'your-email-password',
        },
      });
  
      const resetLink = `http://localhost:3000/reset-password?token=${token}`;
      const mailOptions = {
        from: 'your-email@gmail.com',
        to: email,
        subject: 'Password Reset Request',
        text: `You requested a password reset. Click the link below to reset your password:\n\n${resetLink}\n\nIf you did not request this, please ignore this email.`,
      };
  
      await transporter.sendMail(mailOptions);
  
      res.status(200).json({ message: 'Password reset link sent to your email' });
    } catch (err) {
      console.error('Error sending password reset email:', err);
      res.status(500).json({ error: 'An error occurred while processing your request' });
    }
  });
  
  //reset password
  router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
    const { token, password } = req.body;
    const db = (req as any).db;
  
    if (!token || !password) {
      res.status(400).json({ error: 'Token and new password are required' });
      return;
    }
  
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long' });
      return;
    }
  
    try {
      // Validate the token
      const [rows] = await db.query('SELECT user_id, expires_at FROM password_resets WHERE token = ?', [token]);
      if (rows.length === 0) {
        res.status(400).json({ error: 'Invalid or expired token' });
        return;
      }
  
      const { user_id, expires_at } = rows[0];
      if (new Date() > new Date(expires_at)) {
        res.status(400).json({ error: 'Token has expired' });
        return;
      }
  
      // Hash the new password
      const hashedPassword = await bcrypt.hash(password, 10);
  
      // Update the user's password
      await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user_id]);
  
      // Delete the token
      await db.query('DELETE FROM password_resets WHERE token = ?', [token]);
  
      res.status(200).json({ message: 'Password reset successfully' });
    } catch (err) {
      console.error('Error resetting password:', err);
      res.status(500).json({ error: 'An error occurred while resetting the password' });
    }
  });
  
  // Update user information
  router.put('/user/:username', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    const { username } = req.params;
    const { calories_goal, dietary_restrictions } = req.body; // Only allow these fields to be updated
    const user = (req as any).user;
    const db = (req as any).db;
  
    if (username !== user.username) {
      res.status(403).send('You are not authorized to update this user');
      return;
    }
  
    // Only include fields that are allowed to be updated
    const fields = { calories_goal, dietary_restrictions };
    const { query, values } = buildUpdateQuery(fields);
  
    if (!query) {
      res.status(400).send('No fields provided to update');
      return;
    }
  
    try {
      const sql = `UPDATE users SET ${query} WHERE username = ?`;
      values.push(username);
  
      await db.query(sql, values);
      res.status(200).send('User updated successfully');
    } catch (err) {
      console.error('Error updating user:', err);
      res.status(500).send('Error updating user');
    }
  });
  
  // Delete user
  router.delete('/userdelete', authMiddleware, (req: Request, res: Response) => {
    const user = (req as any).user;
    const db = (req as any).db;
  
    const query = 'DELETE FROM users WHERE id = ?';
    db.query(query, [user.id])
      .then(() => {
        res.status(200).send('User deleted successfully');
      })
      .catch((err: Error) => {
        console.error('Error deleting user:', err);
        res.status(500).send('Error deleting user');
      });
  });
  
  // Get user information
  router.get('/user', authMiddleware, (req: Request, res: Response) => {
    const user = (req as any).user;
    const db = (req as any).db;
  
    db.query('SELECT * FROM users WHERE id = ?', [user.id])
      .then(([rows]: [User[], any]) => {
        if (rows.length === 0) {
          return res.status(404).send('User not found');
        }
  
        const userData = rows[0];
  
        // Convert the profile_picture BLOB to a Base64 string
        if (userData.profile_picture) {
          const buffer = Buffer.isBuffer(userData.profile_picture)
              ? userData.profile_picture
              : Buffer.from(userData.profile_picture as string);
          userData.profile_picture = `data:image/jpeg;base64,${buffer.toString('base64')}`;
        }
  
        res.status(200).json(userData);
      })
      .catch((err: Error) => {
        console.error('Error fetching user data:', err);
        res.status(500).send('Error fetching user data');
      });
  });
  
  // Upload profile picture
  router.post('/upload-profile-picture', authMiddleware, upload.single('profile_picture'), async (req: Request, res: Response): Promise<void> => {
    const user = (req as any).user;
    const db = (req as any).db;
    const profilePicture = req.file;
  
    try {
      // Validate file existence
      if (!profilePicture) {
        res.status(400).send({ message: 'No file uploaded' });
        return;
      }
  
      // Validate file type
      const allowedMimeTypes = ['image/jpeg', 'image/png'];
      if (!allowedMimeTypes.includes(profilePicture.mimetype)) {
        res.status(400).send({ message: 'Invalid file type. Only JPEG and PNG are allowed.' });
        return;
      }
  
      // Validate file size (limit to 5 MB)
      const maxFileSize = 5 * 1024 * 1024; // 5 MB
      if (profilePicture.size > maxFileSize) {
        res.status(400).send({ message: 'File size exceeds the limit of 5 MB.' });
        return;
      }
  
      // Save the profile picture to the database
      const query = 'UPDATE users SET profile_picture = ? WHERE id = ?';
      await db.query(query, [profilePicture.buffer, user.id]);
  
      res.status(200).send({ message: 'Profile picture uploaded successfully' });
    } catch (err) {
      console.error('Error uploading profile picture:', err);
      res.status(500).send({ message: 'Error uploading profile picture' });
    }
  });
  
  //Change password
  router.put('/user/:username/password', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    const { username } = req.params;
    const { currentPassword, password } = req.body;
    const user = (req as any).user; // Authenticated user
    const db = (req as any).db;
  
    if (!currentPassword || !password) {
      res.status(400).json({ error: 'Current password and new password are required' });
      return;
    }
  
    if (username !== user.username) {
      res.status(403).json({ error: 'You are not authorized to update this user' });
      return;
    }
  
    try {
      const [rows] = await db.query('SELECT password FROM users WHERE username = ?', [username]);
      if (rows.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
  
      const hashedPassword = rows[0].password;
      const isMatch = await bcrypt.compare(currentPassword, hashedPassword);
      if (!isMatch) {
        res.status(401).json({ error: 'Current password is incorrect' });
        return;
      }
  
      const newHashedPassword = await bcrypt.hash(password, 10);
      await db.query('UPDATE users SET password = ? WHERE username = ?', [newHashedPassword, username]);
  
      res.status(200).json({ message: 'Password updated successfully' });
    } catch (err) {
      console.error('Error updating password:', err);
      res.status(500).json({ error: 'An error occurred while updating the password' });
    }
  });
  
  //Change email
  router.put('/user/:username/email', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    const { username } = req.params;
    const { currentPassword, email } = req.body;
    const user = (req as any).user; // Authenticated user
    const db = (req as any).db;
  
    if (!currentPassword || !email) {
      res.status(400).json({ error: 'Current password and new email are required' });
      return;
    }
  
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'Invalid email format' });
      return;
    }
  
    if (username !== user.username) {
      res.status(403).json({ error: 'You are not authorized to update this user' });
      return;
    }
  
    try {
      // Fetch the user's current hashed password from the database
      const [rows] = await db.query('SELECT password FROM users WHERE username = ?', [username]);
      if (rows.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
  
      const hashedPassword = rows[0].password;
  
      // Compare the current password with the hashed password
      const isMatch = await bcrypt.compare(currentPassword, hashedPassword);
      if (!isMatch) {
        res.status(401).json({ error: 'Current password is incorrect' });
        return;
      }
  
      // Update the email in the database
      await db.query('UPDATE users SET email = ? WHERE username = ?', [email, username]);
  
      res.status(200).json({ message: 'Email updated successfully' });
    } catch (err) {
      console.error('Error updating email:', err);
      res.status(500).json({ error: 'An error occurred while updating the email' });
    }
  });
  
  const buildUpdateQuery = (fields: Record<string, any>) => {
    const fieldsToUpdate = [];
    const values = [];
  
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        fieldsToUpdate.push(`${key} = ?`);
        values.push(value);
      }
    }
  
    return { query: fieldsToUpdate.join(', '), values };
  };

  export default router;