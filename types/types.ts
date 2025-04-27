export interface Meal {
  id: number; // Ensure this matches the type used in your backend (number or string)
  name: string;
  description: string;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  userName: string;
  ingredients: string | string[]; // Allow ingredients to be a string or an array
  visibility: boolean; // Indicates if the meal is public or private
  averageRating: number;
  reviewCount?: number;
  meal_type: "Breakfast" | "Lunch" | "Dinner" | "Other";
  picture: string | Blob | null; // Allow null if no picture is provided
  meal_plan_id?: number; // Optional if not part of a meal plan
  instructions?: string; // Optional field for meal preparation instructions
  recipeLink?: string; // Optional field for an external recipe link
  created_at?: string; // Optional field for the creation timestamp
}