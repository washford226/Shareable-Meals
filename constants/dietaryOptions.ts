// Basic dietary options (used in signup and other forms)
export const dietaryOptions = [
  { label: "None", value: "None", icon: "ban", description: "No dietary restrictions" },
  { label: "Vegetarian", value: "Vegetarian", icon: "leaf", description: "No meat, but dairy and eggs are okay" },
  { label: "Vegan", value: "Vegan", icon: "flower", description: "No animal products whatsoever" },
  { label: "Gluten-Free", value: "Gluten-Free", icon: "medical", description: "No gluten-containing grains" },
  { label: "Keto", value: "Keto", icon: "fitness", description: "Low-carb, high-fat diet" },
  { label: "Paleo", value: "Paleo", icon: "body", description: "Foods available in Paleolithic era" },
];

// Dietary options for filtering (used in meal browsing screens)
export const dietaryFilterOptions = [
  { label: "All", value: "" },
  { label: "Vegetarian", value: "Vegetarian" },
  { label: "Vegan", value: "Vegan" },
  { label: "Gluten-Free", value: "Gluten-Free" },
  { label: "Keto", value: "Keto" },
  { label: "Paleo", value: "Paleo" },
];

// Dietary options for meal creation (used in create meal forms)
export const dietaryCreateOptions = [
  { label: "None", value: "" },
  { label: "Vegetarian", value: "Vegetarian" },
  { label: "Vegan", value: "Vegan" },
  { label: "Gluten-Free", value: "Gluten-Free" },
  { label: "Keto", value: "Keto" },
  { label: "Paleo", value: "Paleo" },
];

// Enhanced dietary options with more detailed descriptions (used in edit-user screen)
export const dietaryOptionsEnhanced = [
  { label: "None", value: "None", icon: "restaurant", description: "No specific dietary restrictions" },
  { label: "Vegetarian", value: "Vegetarian", icon: "leaf", description: "No meat, but may include dairy and eggs" },
  { label: "Vegan", value: "Vegan", icon: "nutrition", description: "Plant-based, no animal products" },
  { label: "Gluten-Free", value: "Gluten-Free", icon: "medical", description: "No wheat, barley, rye, or gluten" },
  { label: "Keto", value: "Keto", icon: "flame", description: "Low-carb, high-fat ketogenic diet" },
  { label: "Paleo", value: "Paleo", icon: "fitness", description: "Whole foods, no processed ingredients" },
];

// Enhanced dietary options for meal creation (used in create meal forms)
export const dietaryCreateOptionsEnhanced = [
  { label: "None", value: "", icon: "restaurant", description: "No specific dietary restrictions" },
  { label: "Vegetarian", value: "Vegetarian", icon: "leaf", description: "No meat, but may include dairy and eggs" },
  { label: "Vegan", value: "Vegan", icon: "nutrition", description: "Plant-based, no animal products" },
  { label: "Gluten-Free", value: "Gluten-Free", icon: "medical", description: "No wheat, barley, rye, or gluten" },
  { label: "Keto", value: "Keto", icon: "flame", description: "Low-carb, high-fat ketogenic diet" },
  { label: "Paleo", value: "Paleo", icon: "fitness", description: "Whole foods, no processed ingredients" },
];

// Enhanced dietary filter options for meal browsing (used in other-meals screen)
export const dietaryFilterOptionsEnhanced = [
  { label: "All Dietary Restrictions", value: "", icon: "restaurant", description: "Show all meal types" },
  { label: "Vegetarian", value: "Vegetarian", icon: "leaf", description: "No meat, but may include dairy and eggs" },
  { label: "Vegan", value: "Vegan", icon: "nutrition", description: "Plant-based, no animal products" },
  { label: "Gluten-Free", value: "Gluten-Free", icon: "medical", description: "No wheat, barley, rye, or gluten" },
  { label: "Keto", value: "Keto", icon: "flame", description: "Low-carb, high-fat ketogenic diet" },
  { label: "Paleo", value: "Paleo", icon: "fitness", description: "Whole foods, no processed ingredients" },
];

// Basic cuisine options (used in simple forms)
export const cuisineOptions = [
  { label: "None", value: "" },
  { label: "Italian", value: "Italian" },
  { label: "Mexican", value: "Mexican" },
  { label: "Chinese", value: "Chinese" },
  { label: "Indian", value: "Indian" },
  { label: "American", value: "American" },
  { label: "Japanese", value: "Japanese" },
  { label: "Mediterranean", value: "Mediterranean" },
  { label: "Thai", value: "Thai" },
  { label: "French", value: "French" },
];

// Cuisine options for filtering (used in meal browsing screens)
export const cuisineFilterOptions = [
  { label: "All", value: "" },
  { label: "Italian", value: "Italian" },
  { label: "Mexican", value: "Mexican" },
  { label: "Chinese", value: "Chinese" },
  { label: "Indian", value: "Indian" },
  { label: "American", value: "American" },
  { label: "Japanese", value: "Japanese" },
  { label: "Mediterranean", value: "Mediterranean" },
  { label: "Thai", value: "Thai" },
  { label: "French", value: "French" },
];

// Enhanced cuisine options with icons and descriptions (used in meal creation forms)
export const cuisineOptionsEnhanced = [
  { label: "None", value: "", icon: "globe", description: "No specific cuisine type" },
  { label: "Italian", value: "Italian", icon: "wine", description: "Pasta, pizza, and Italian classics" },
  { label: "Mexican", value: "Mexican", icon: "flame", description: "Spicy and flavorful Mexican dishes" },
  { label: "Chinese", value: "Chinese", icon: "restaurant", description: "Traditional Chinese cooking" },
  { label: "Indian", value: "Indian", icon: "leaf", description: "Rich spices and aromatic curries" },
  { label: "American", value: "American", icon: "fast-food", description: "Classic American comfort food" },
  { label: "Japanese", value: "Japanese", icon: "fish", description: "Sushi, ramen, and Japanese cuisine" },
  { label: "Mediterranean", value: "Mediterranean", icon: "sunny", description: "Healthy Mediterranean flavors" },
  { label: "Thai", value: "Thai", icon: "restaurant", description: "Sweet, sour, and spicy Thai dishes" },
  { label: "French", value: "French", icon: "wine", description: "Elegant French culinary traditions" },
];

// Enhanced cuisine filter options for meal browsing (used in meal browsing screens)
export const cuisineFilterOptionsEnhanced = [
  { label: "All Cuisines", value: "", icon: "globe", description: "Show meals from all cuisines" },
  { label: "Italian", value: "Italian", icon: "wine", description: "Pasta, pizza, and Mediterranean flavors" },
  { label: "Mexican", value: "Mexican", icon: "flame", description: "Spicy and flavorful dishes" },
  { label: "Chinese", value: "Chinese", icon: "restaurant", description: "Traditional Chinese cooking" },
  { label: "Indian", value: "Indian", icon: "leaf", description: "Rich spices and aromatic dishes" },
  { label: "American", value: "American", icon: "fast-food", description: "Classic American comfort food" },
  { label: "Japanese", value: "Japanese", icon: "fish", description: "Fresh ingredients and clean flavors" },
  { label: "Mediterranean", value: "Mediterranean", icon: "sunny", description: "Healthy oils and fresh vegetables" },
  { label: "Thai", value: "Thai", icon: "sparkles", description: "Sweet, sour, and spicy balance" },
  { label: "French", value: "French", icon: "cafe", description: "Elegant and refined cooking" },
];

export type DietaryOption = {
  label: string;
  value: string;
  icon: string;
  description: string;
};

export type CuisineOption = {
  label: string;
  value: string;
  icon: string;
  description: string;
};

// AI Generation filter options (used in meal browsing screens)
export const aiGenerationFilterOptions = [
  { label: "AI Generated", value: "ai" },
  { label: "Manually Created", value: "human" },
];
