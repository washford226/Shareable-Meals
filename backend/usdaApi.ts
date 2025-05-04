import axios from "axios";

const USDA_API_KEY = "u9bcsoeMIs1pOE9A4Z0v2wtWdSebbIHKEvLG3EDV";
const BASE_URL = "https://api.nal.usda.gov/fdc/v1";

if (!USDA_API_KEY) {
  throw new Error("USDA_API_KEY is not defined.");
}

export const searchFoods = async (query: string) => {
  try {
    console.log("Searching foods with query:", query);
    const response = await axios.get(
      `${BASE_URL}/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(query)}`
    );
    console.log("Search response:", response.data);
    return response.data.foods; // Returns an array of food items
  } catch (error) {
    console.error("Error searching foods:", error);
    throw error;
  }
};

export const getFoodDetails = async (fdcId: string | number) => {
  try {
    const response = await axios.get(
      `${BASE_URL}/food/${fdcId}?api_key=${USDA_API_KEY}`
    );

    console.log("API Response for Food Details:", response.data); // Debugging

    const nutrients = response.data.foodNutrients
      ? response.data.foodNutrients.map((nutrient: any) => ({
          name: nutrient.nutrient?.name || "Unknown Nutrient", // Extract name from nutrient object
          amount: nutrient.amount || 0, // Extract amount
          unit: nutrient.nutrient?.unitName || "", // Extract unitName from nutrient object
        }))
      : []; // Fallback to an empty array if foodNutrients is missing

    return nutrients;
  } catch (error) {
    console.error("Error fetching food details:", error);
    throw error;
  }
};