import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

// Extend the Request interface to include the user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        username?: string;
      };
    }
  }
}

// Initialize Supabase client for backend (use service role key for full access)
const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Access denied. Invalid token format.' });
    return;
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    // Validate the JWT with Supabase
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      res.status(401).json({ message: 'Invalid or expired token.' });
      return;
    }

    // Optionally fetch the user's profile for username
    let username: string | undefined = undefined;
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", data.user.id)
      .single();

    if (!profileError && profile?.username) {
      username = profile.username;
    }

    req.user = {
      id: data.user.id,
      email: data.user.email,
      username,
    };

    next();
  } catch (err) {
    console.error('Error verifying Supabase token:', err);
    res.status(401).json({ message: 'Invalid token.' });
  }
};

export default authMiddleware;