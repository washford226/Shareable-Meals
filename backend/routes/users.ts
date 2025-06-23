import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import nodemailer from 'nodemailer';
import authMiddleware from '../authMiddleware';
import crypto from 'crypto';
import { Request, Response } from 'express';
import axios from 'axios';
import { calculateAndStoreMealNutrition } from './usda_linking';
import { createClient } from '@supabase/supabase-js';
import { profile } from 'console';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

// Helper: Parse AI ingredient line
function parseAIIngredientLine(line: string) {
  let cleaned = line.replace(/^[\*\-\d\.\s]+/, '').trim();
  if (/ or /i.test(cleaned)) {
    cleaned = cleaned.split(/ or /i)[0].trim();
  }
  cleaned = cleaned.replace(/\(.*?\)/g, '').trim();
  if (/for the|optional|instructions?/i.test(cleaned)) {
    return null;
  }
  const match = cleaned.match(/^([\d¼½¾⅓⅔⅛⅜⅝⅞\/\.]+)\s+([a-zA-Z]+)\s+(.+)$/);
  if (match) {
    const quantity = !isNaN(Number(match[1])) ? match[1] : "1";
    return {
      quantity,
      unit: match[2],
      name: match[3],
      raw_name: match[3],
    };
  }
  return { quantity: "1", unit: "", name: cleaned, raw_name: cleaned };
}

// Helper: Parse multiple meals from AI
function parseMultipleMealResponses(rawText: string): any[] {
  const meals: any[] = [];
  const normalizedText = rawText.replace(/\*\*\d+\.\s*Name:/g, '**Name:**');
  const mealSections = normalizedText.split(/\*\*Name:\*\*/g);
  for (const section of mealSections) {
    if (section.trim()) {
      const meal = parseMealResponse(`**Name:**${section.trim()}`);
      if (meal.name && meal.description && meal.ingredients && meal.instructions) {
        meals.push(meal);
      }
    }
  }
  return meals;
}

// Helper: Parse a single meal from AI
function parseMealResponse(rawText: string) {
  const meal: {
    name?: string;
    description?: string;
    ingredients?: string[];
    instructions?: string[];
  } = {};

  const nameMatch = rawText.match(/\*\*Name:\*\*\s*(.+)/i);
  const descriptionMatch = rawText.match(/\*\*Description:\*\*\s*(.+)/i);
  const ingredientsMatch = rawText.match(/\*\*Ingredients:\*\*\s*([\s\S]*?)(?=\*\*Instructions:|$)/i);
  const instructionsMatch = rawText.match(/\*\*Instructions:\*\*\s*([\s\S]*)/i);

  meal.name = nameMatch ? nameMatch[1].trim() : undefined;
  meal.description = descriptionMatch ? descriptionMatch[1].trim() : undefined;

  if (ingredientsMatch) {
    const ingredients = ingredientsMatch[1]
      .split(/\n|-/g)
      .map((item) => item.trim())
      .filter((item) => item);
    meal.ingredients = ingredients;
  }

  if (instructionsMatch) {
    const instructions = instructionsMatch[1]
      .split(/\n|^\d+\.\s+/gm)
      .map((step) => step.trim())
      .filter((step) => step);
    meal.instructions = instructions;
  }

  return meal;
}

// Generate AI meals
const generateAIMeals = async (dietary_restrictions?: string, allergies?: string): Promise<any[]> => {
  try {
    const prompt = `
      Generate 5 meal ideas based on the following criteria:
      - Dietary restrictions: ${dietary_restrictions || 'None'}
      - Allergies: ${allergies || 'None'}
      Each meal should include:
      - Name: [Meal Name]
      - Description: [Meal Description]
      - Ingredients: [List of Ingredients]
      - Instructions: [Cooking Instructions]
    `;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      },
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!rawText) throw new Error("Failed to generate meal text from Gemini API.");

    const meals = parseMultipleMealResponses(rawText);

    if (!meals || meals.length === 0) throw new Error("Failed to parse meal response from Gemini API.");

    return meals;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error?.message || "Error from Gemini API");
    } else {
      throw new Error("An internal server error occurred.");
    }
  }
};

// Check if a username is already taken
router.get('/check-username', async (req: Request, res: Response) => {
  const { username } = req.query;

  if (!username || typeof username !== "string") {
    res.status(400).json({ error: "Username is required" });
    return;
  }

  try {
    const { data, error } = await supabase
      .from("users")
      .select("id")
      .eq("username", username)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    res.json({ taken: !!data });
  } catch (err) {
    console.error("Error checking username:", err);
    res.status(500).json({ error: "Error checking username" });
  }
});

// Signup route
router.post('/signup', upload.single('profile_picture'), async (req: Request, res: Response): Promise<void> => {
  const {
    username,
    email,
    password,
    dietary_restrictions,
    allergies
  } = req.body as {
    username: string;
    email: string;
    password: string;
    dietary_restrictions?: string;
    allergies?: string;
  };
  const profilePicture = req.file?.buffer;

  try {
    // Check if username or email exists
    const { data: existingUser, error: existingError } = await supabase
      .from("users")
      .select("id")
      .or(`username.eq.${username},email.eq.${email}`)
      .maybeSingle();

    if (existingUser) {
      res.status(400).send({ message: 'Username or email already exists' });
      return;
    }

    // Create user in Supabase Auth
    const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (signUpError || !signUpData?.user) {
      res.status(500).send({ message: signUpError?.message || 'Failed to create user' });
      return;
    }

    const userId = signUpData.user.id;

    // Upload profile picture if provided
    let profilePictureUrl: string | null = null;
    if (profilePicture) {
      const fileName = `profile_${userId}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("profile-pictures")
        .upload(fileName, profilePicture, { upsert: true, contentType: "image/jpeg" });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("profile-pictures").getPublicUrl(fileName);
      profilePictureUrl = urlData.publicUrl;
    } else {
      profilePictureUrl = null; // No profile picture uploaded
    }

    // Insert profile row
    const { error: profileError } = await supabase.from("users").insert([{
      id: userId,
      username,
      email,
      dietary_restrictions,
      allergies,
      profile_picture: profilePictureUrl,
    }]);
    if (profileError) throw profileError;

    // Use AI to generate meals
    const aiMeals = await generateAIMeals(dietary_restrictions, allergies);

    // Insert AI-generated meals into the database
    for (const meal of aiMeals) {
      const parsedIngredients = meal.ingredients
        .map((ingText: string) => parseAIIngredientLine(ingText))
        .filter((ing: any) => !!ing && typeof ing.name === 'string' && ing.name.length > 0);

      const { data: mealData, error: mealError } = await supabase
        .from("meals")
        .insert([{
          name: meal.name,
          description: meal.description,
          ingredients: parsedIngredients,
          visibility: false,
          user_id: userId,
          instructions: Array.isArray(meal.instructions) ? meal.instructions.join('\n') : meal.instructions
        }])
        .select()
        .single();

      if (mealError) {
        console.warn("Error inserting AI meal:", mealError);
        continue;
      }

      // Insert each ingredient into meal_ingredients (best match logic can be added here)
      for (const ing of parsedIngredients) {
        if (!ing.name || !ing.quantity) continue;
        // Optionally, implement best food match logic here if needed
        await supabase.from("meal_ingredients").insert([{
          meal_id: mealData.id,
          food_id: null, // Set to null or implement food matching logic
          quantity: Number(ing.quantity),
          unit: ing.unit,
          raw_name: ing.raw_name
        }]);
      }

      // Calculate nutrition for this meal after ingredients inserted
      //await calculateAndStoreMealNutrition(mealData.id);
    }

    res.status(200).send('User signed up successfully with AI-generated meals added');
  } catch (err) {
    console.error('Error during signup:', err);
    res.status(500).send('Error during signup');
  }
});

// Login user
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      return res.status(400).send('Invalid email or password');
    }

    res.status(200).json({ message: 'User logged in successfully', token: data.session.access_token });
  } catch (err) {
    console.error('Error logging in:', err);
    res.status(500).send('Error logging in');
  }
});

// Forgot Password
router.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: process.env.PASSWORD_RESET_REDIRECT_URL || undefined,
    });

    if (error) throw error;

    res.status(200).json({ message: 'Password reset link sent to your email' });
  } catch (err) {
    console.error('Error sending password reset email:', err);
    res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});

// Reset password (handled by Supabase magic link, so not needed here)

// Update user information
router.put('/user/:username', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { username } = req.params;
  const {
    calories_goal,
    protein_goal,
    carbohydrates_goal,
    fat_goal,
    dietary_restrictions,
    allergies
  } = req.body;
  const user = (req as any).user;

  if (username !== user.username) {
    res.status(403).send('You are not authorized to update this user');
    return;
  }

  const fields: Record<string, any> = {
    calories_goal,
    protein_goal,
    carbohydrates_goal,
    fat_goal,
    dietary_restrictions,
    allergies
  };

  const updates: Record<string, any> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) updates[key] = value;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).send('No fields provided to update');
    return;
  }

  try {
    const { error } = await supabase
      .from("users")
      .update(updates)
      .eq("username", username);

    if (error) throw error;

    res.status(200).send('User updated successfully');
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).send('Error updating user');
  }
});

// Delete user
router.delete('/userdelete', authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user;

  try {
    // Delete from users table
    const { error: profileError } = await supabase
      .from("users")
      .delete()
      .eq("id", user.id);

    if (profileError) throw profileError;

    // Delete from Supabase Auth
    const { error: authError } = await supabase.auth.admin.deleteUser(user.id);
    if (authError) throw authError;

    res.status(200).send('User deleted successfully');
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).send('Error deleting user');
  }
});

// Get user information
router.get('/user', authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user;

  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error || !data) {
      return res.status(404).send('User not found');
    }

    res.status(200).json(data);
  } catch (err) {
    console.error('Error fetching user data:', err);
    res.status(500).send('Error fetching user data');
  }
});

// Upload profile picture
router.post('/upload-profile-picture', authMiddleware, upload.single('profile_picture'), async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const profilePicture = req.file;

  try {
    if (!profilePicture) {
      res.status(400).send({ message: 'No file uploaded' });
      return;
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png'];
    if (!allowedMimeTypes.includes(profilePicture.mimetype)) {
      res.status(400).send({ message: 'Invalid file type. Only JPEG and PNG are allowed.' });
      return;
    }

    const maxFileSize = 5 * 1024 * 1024;
    if (profilePicture.size > maxFileSize) {
      res.status(400).send({ message: 'File size exceeds the limit of 5 MB.' });
      return;
    }

    const fileName = `profile_${user.id}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("profile-pictures")
      .upload(fileName, profilePicture.buffer, { upsert: true, contentType: profilePicture.mimetype });
    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage.from("profile-pictures").getPublicUrl(fileName);
    const profilePictureUrl = urlData.publicUrl;

    const { error } = await supabase
      .from("users")
      .update({ profile_picture: profilePictureUrl })
      .eq("id", user.id);

    if (error) throw error;

    res.status(200).send({ message: 'Profile picture uploaded successfully', url: profilePictureUrl });
  } catch (err) {
    console.error('Error uploading profile picture:', err);
    res.status(500).send({ message: 'Error uploading profile picture' });
  }
});

// Change password
router.put('/user/:username/password', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { username } = req.params;
  const { currentPassword, password } = req.body;
  const user = (req as any).user;

  if (!currentPassword || !password) {
    res.status(400).json({ error: 'Current password and new password are required' });
    return;
  }

  if (username !== user.username) {
    res.status(403).json({ error: 'You are not authorized to update this user' });
    return;
  }

  try {
    // Re-authenticate user
    const { data, error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (error || !data.session) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    // Update password
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, { password });
    if (updateError) throw updateError;

    res.status(200).json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Error updating password:', err);
    res.status(500).json({ error: 'An error occurred while updating the password' });
  }
});

// Change email
router.put('/user/:username/email', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { username } = req.params;
  const { currentPassword, email } = req.body;
  const user = (req as any).user;

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
    // Re-authenticate user
    const { data, error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (error || !data.session) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    // Update email
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, { email });
    if (updateError) throw updateError;

    // Update email in users table as well
    const { error: profileError } = await supabase
      .from("users")
      .update({ email })
      .eq("id", user.id);

    if (profileError) throw profileError;

    res.status(200).json({ message: 'Email updated successfully' });
  } catch (err) {
    console.error('Error updating email:', err);
    res.status(500).json({ error: 'An error occurred while updating the email' });
  }
});

export default router;