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
      console.log("Fetching details for food ID:", fdcId);
      const response = await axios.get(
        `${BASE_URL}/food/${fdcId}?api_key=${USDA_API_KEY}`
      );
      console.log("Food details response:", response.data);
  
      // Extract and return only the nutritional values
      const nutrients = response.data.foodNutrients.map((nutrient: any) => ({
        name: nutrient.nutrientName,
        amount: nutrient.value,
        unit: nutrient.unitName,
      }));
  
      return nutrients; // Returns an array of nutrient objects
    } catch (error) {
      console.error("Error fetching food details:", error);
      throw error;
    }
  };