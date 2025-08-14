export interface Meal {
  id: number | string; // Allow both number and string to support macro meal IDs like "macro_123"
  name: string;
  description: string;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  userName: string;
  visibility: boolean; // Indicates if the meal is public or private
  averageRating: number;
  reviewCount?: number;
  meal_type: "Breakfast" | "Lunch" | "Dinner" | "Other" | "Scanned";
  picture: string | Blob | null; // Allow null if no picture is provided
  meal_plan_id?: number; // Optional if not part of a meal plan
  instructions?: string; // Optional field for meal preparation instructions
  recipeLink?: string; // Optional field for an external recipe link
  created_at?: string; // Optional field for the creation timestamp
  created_by_ai: boolean; // Indicates if the meal was created by AI
  created_by?: string; // Optional field for who created the meal
  favorite: boolean; // Indicates if the meal is a favorite
  dietary_restrictions?: string; // Optional field for dietary restrictions
  servings?: number; // Optional field for number of servings
  cuisine?: string; // Optional field for cuisine type
  ingredients?: MealIngredient[]; // Optional array of ingredients from meal_ingredients table
  isMacroMeal?: boolean; // Flag to identify meals from macro_meals table
  AI_Macros?: boolean; // Indicates if AI was used to calculate macros (deprecated, use Edamam_macros)
  Edamam_macros?: boolean; // Indicates if Edamam was used to calculate macros
}

export interface MealIngredient {
  raw_name: string;
  quantity: number;
  unit: string | null;
}

export interface UserProfile {
  id: string;
  username: string;
  profile_picture?: Uint8Array | string | null; // bytea in database, could be base64 string or binary
  calories_goal?: number | null;
  protein_goal?: number | null;
  carbohydrates_goal?: number | null;
  fat_goal?: number | null;
  dietary_restrictions?: string | null;
  allergies?: string | null;
  ai_usage_count?: number | null;
  ai_usage_last_date?: string | null;
  created_at?: string | null;
}