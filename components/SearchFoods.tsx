import React, { useState } from "react";
import {
  View,
  TextInput,
  Button,
  FlatList,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { searchFoods, getFoodDetails } from "../backend/usdaApi"; // Import API functions

interface FoodSearchProps {
  onBack: () => void; // Callback to handle navigation back
  onFoodSelect: (food: { fdcId: number; description: string }) => void; // Callback to handle food selection
}

const FoodSearch: React.FC<FoodSearchProps> = ({ onBack, onFoodSelect }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { fdcId: number; description: string; nutrients?: any[] }[]
  >([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) {
      Alert.alert("Error", "Please enter a search query.");
      return;
    }

    setLoading(true);
    try {
      console.log("Searching for foods with query:", query);
      const foods = await searchFoods(query); // Fetch search results from USDA API
      console.log("Search results:", foods);

      const foodsWithNutrients = await Promise.all(
        foods.map(async (food: { fdcId: number; description: string }) => {
          try {
            console.log("Fetching details for food ID:", food.fdcId);
            const foodDetails = await getFoodDetails(food.fdcId.toString()); // Fetch detailed nutritional info
            console.log("Food details:", foodDetails);
            return {
              ...food,
              nutrients: foodDetails.foodNutrients, // Add nutrients to the food object
            };
          } catch (error) {
            console.error("Error fetching food details for ID:", food.fdcId, error);
            return { ...food, nutrients: [] }; // Return food without nutrients if details fail
          }
        })
      );

      setResults(foodsWithNutrients); // Update results with nutritional values
    } catch (error) {
      console.error("Error searching for foods:", error);
      Alert.alert("Error", "Failed to fetch food data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Button title="Back" onPress={onBack} /> {/* Back button */}
      <TextInput
        style={styles.input}
        placeholder="Search for a food"
        value={query}
        onChangeText={setQuery}
      />
      <Button title="Search" onPress={handleSearch} />
      {loading && <ActivityIndicator size="large" color="#007BFF" />}
      <FlatList
        data={results}
        keyExtractor={(item) => item.fdcId.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.resultItem}
            onPress={() => onFoodSelect(item)} // Pass the selected food back to the parent
          >
            <Text style={styles.resultText}>{item.description}</Text>
            {item.nutrients && item.nutrients.length > 0 && (
              <View style={styles.nutrientContainer}>
                {item.nutrients.slice(0, 5).map((nutrient: any) => (
                  <Text key={nutrient.nutrientName} style={styles.nutrientText}>
                    {nutrient.nutrientName}: {nutrient.value} {nutrient.unitName}
                  </Text>
                ))}
              </View>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  input: {
    height: 40,
    borderColor: "gray",
    borderWidth: 1,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  resultItem: {
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  resultText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  nutrientContainer: {
    marginTop: 8,
    paddingLeft: 8,
  },
  nutrientText: {
    fontSize: 14,
    color: "#555",
  },
});

export default FoodSearch;