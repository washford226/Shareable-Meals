export interface Meal {
    id: number; // Ensure this matches the type used in your backend (number or string)
    name: string;
    description: string;
    calories: number;
    protein: number;
    carbohydrates: number;
    fat: number;
    userName: string;
    ingredients: string;
    visibility: boolean; // Added visibility property
    averageRating: number;
    reviewCount?: number;
    meal_type: "Breakfast" | "Lunch" | "Dinner" | "Other";
    picture: string | Blob;
    meal_plan_id: number;
  }
