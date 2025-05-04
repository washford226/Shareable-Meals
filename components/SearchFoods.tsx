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
import { searchFoods, getFoodDetails } from "../backend/usdaApi";

const FoodSearch: React.FC = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { fdcId: number; description: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [selectedFood, setSelectedFood] = useState<{
    description: string;
    nutrients: { name: string; amount: number; unit: string }[];
  } | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) {
      Alert.alert("Error", "Please enter a search query.");
      return;
    }

    setLoading(true);
    try {
      const foods = await searchFoods(query);
      setResults(foods);
      setSelectedFood(null); // Clear previously selected food
    } catch (error) {
      console.error("Error searching for foods:", error);
      Alert.alert("Error", "Failed to fetch food data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleFoodSelect = async (fdcId: number, description: string) => {
    setLoading(true);
    try {
      const nutrients = await getFoodDetails(fdcId);
      console.log("Nutritional Values:", nutrients); // Debugging
      setSelectedFood({ description, nutrients });
    } catch (error) {
      console.error("Error fetching food details:", error);
      Alert.alert("Error", "Failed to fetch food details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
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
            onPress={() => handleFoodSelect(item.fdcId, item.description)}
          >
            <Text style={styles.resultText}>{item.description}</Text>
          </TouchableOpacity>
        )}
      />
      {selectedFood && (
        <View style={styles.detailsContainer}>
          <Text style={styles.detailsTitle}>{selectedFood.description}</Text>
          <Text style={styles.detailsSubtitle}>Nutritional Values:</Text>
          <FlatList
            data={selectedFood.nutrients || []}
            keyExtractor={(_item, index) => index.toString()}
            renderItem={({ item }) => {
              console.log("Nutrient Item:", item); // Debugging
              return (
                <View style={styles.nutrientItem}>
                  <Text style={styles.nutrientName}>{item.name}</Text>
                  <Text style={styles.nutrientValue}>
                    {item.amount} {item.unit}
                  </Text>
                </View>
              );
            }}
            ListEmptyComponent={<Text>No nutritional values available.</Text>}
          />
        </View>
      )}
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
  detailsContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
  },
  detailsTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  detailsSubtitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
  },
  nutrientItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  nutrientName: {
    fontSize: 14,
    color: "#000",
  },
  nutrientValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#000",
  },
});

export default FoodSearch;