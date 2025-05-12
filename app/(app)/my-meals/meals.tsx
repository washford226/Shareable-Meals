import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
  Modal,
  Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { Meal } from "../../../types/types";
import { useTheme } from "../../../context/ThemeContext";
import { jwtDecode } from "jwt-decode"; 
import { useRouter } from "expo-router";  // Import Expo Router hook
import BottomNav from "components/bottomNav";

interface MyMealsProps {
  onCreateMeal: () => void;
}

const BASE_URL = Platform.OS === "android" ? "http://10.0.2.2:5000" : "http://localhost:5000";

const MyMeals: React.FC<MyMealsProps> = ({ onCreateMeal}) => {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [filteredMeals, setFilteredMeals] = useState<Meal[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filters, setFilters] = useState<{ type: string; greaterThan: string; lessThan: string }[]>([
    { type: "calories", greaterThan: "", lessThan: "" },
    { type: "fat", greaterThan: "", lessThan: "" },
    { type: "protein", greaterThan: "", lessThan: "" },
    { type: "carbohydrates", greaterThan: "", lessThan: "" },
  ]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [isCreateMealModalVisible, setIsCreateMealModalVisible] = useState(false);
  const [tempFilters, setTempFilters] = useState<{ type: string; greaterThan: string; lessThan: string }[]>([
    { type: "calories", greaterThan: "", lessThan: "" },
    { type: "fat", greaterThan: "", lessThan: "" },
    { type: "protein", greaterThan: "", lessThan: "" },
    { type: "carbohydrates", greaterThan: "", lessThan: "" },
  ]);

  const { theme } = useTheme();
  const router = useRouter(); // Initialize router

  useEffect(() => {
    const fetchMyMeals = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) {
          Alert.alert("Error", "User not authenticated. Please log in.");
          return;
        }
    
        const userId = await getUserIdFromToken(); 
        if (!userId) {
          Alert.alert("Error", "User not authenticated. Please log in.");
          return;
        }
    
        const savedFilters = await AsyncStorage.getItem(`filters_MyMeals_${userId}`); 
        const savedSearchQuery = await AsyncStorage.getItem(`searchQuery_MyMeals_${userId}`); 
    
        if (savedFilters) {
          const parsedFilters = JSON.parse(savedFilters);
          setFilters(parsedFilters); 
          setTempFilters(parsedFilters); 
        }
    
        if (savedSearchQuery) {
          setSearchQuery(savedSearchQuery); 
        }
    
        const response = await axios.get(`${BASE_URL}/meal/my-meals`, {
          headers: { Authorization: `Bearer ${token}` },
        });
    
        setMeals(response.data);
        setFilteredMeals(response.data); 
      } catch (error) {
        console.error("Error fetching meals:", error);
        Alert.alert("Error", "Failed to fetch meals. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchMyMeals();
  }, []);

  useEffect(() => {
    const filtered = meals.filter((meal) => {
      const passesFilters = filters.every((filter) => {
        const greaterThanValue = parseFloat(filter.greaterThan);
        const lessThanValue = parseFloat(filter.lessThan);
  
        if (filter.type in meal) {
          const mealValue = parseFloat(meal[filter.type as keyof Meal] as unknown as string);
  
          if (!isNaN(greaterThanValue) && mealValue <= greaterThanValue) {
            return false;
          }
  
          if (!isNaN(lessThanValue) && mealValue >= lessThanValue) {
            return false;
          }
        }
  
        return true;
      });
  
      const passesSearch =
        !searchQuery ||
        meal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        meal.description.toLowerCase().includes(searchQuery.toLowerCase());
  
      return passesFilters && passesSearch;
    });
  
    setFilteredMeals(filtered);
  }, [searchQuery, filters, meals]);

  const onMealSelect = (meal: Meal) => {
    router.push(`/my-meals/${meal.id}/info`); // Navigate to the meal details screen
  };

  const handleSearchChange = async (text: string) => {
    setSearchQuery(text); 
    try {
      const userId = await getUserIdFromToken(); 
      if (!userId) {
        Alert.alert("Error", "User not authenticated. Please log in.");
        return;
      }
  
      await AsyncStorage.setItem(`searchQuery_MyMeals_${userId}`, text); 
    } catch (error) {
      console.error("Error saving search query:", error);
    }
  };

  const getUserIdFromToken = async (): Promise<number | null> => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        return null;
      }

      const decodedToken = jwtDecode<{ id: number }>(token); 
      return decodedToken.id;
    } catch (error) {
      console.error("Error decoding token:", error);
      return null;
    }
  };

  const applyFilters = async () => {
    try {
      const userId = await getUserIdFromToken(); 
      if (!userId) {
        Alert.alert("Error", "User not authenticated. Please log in.");
        return;
      }

      const isValid = tempFilters.every(
        (filter) =>
          (!filter.greaterThan || !isNaN(parseFloat(filter.greaterThan))) &&
          (!filter.lessThan || !isNaN(parseFloat(filter.lessThan)))
      );

      if (!isValid) {
        Alert.alert("Invalid Filters", "Please enter valid numeric values for the filters.");
        return;
      }

      setFilters(tempFilters); 
      await AsyncStorage.setItem(`filters_MyMeals_${userId}`, JSON.stringify(tempFilters)); 
      setIsFilterModalVisible(false); 
    } catch (error) {
      console.error("Error saving filters:", error);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>Loading your meals...</Text>
      </View>
    );
  }

  if (meals.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.noMealsText, { color: theme.text }]}>No meals found.</Text>
        <TouchableOpacity 
          style={[styles.createMealButton, { backgroundColor: theme.button }]} 
          onPress={() => router.push("/my-meals/create")} // Use Expo Router to navigate
        >
          <Text style={[styles.createMealButtonText, { color: theme.buttonText }]}>Create Meal</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.searchBarContainer}>
        <TextInput
          style={[styles.searchBar, { borderColor: theme.border, color: theme.text }]}
          placeholder="Search meals..."
          placeholderTextColor={theme.placeholder}
          value={searchQuery}
          onChangeText={handleSearchChange} 
        />
        <TouchableOpacity
          style={[styles.filterButton, { backgroundColor: theme.button }]}
          onPress={() => setIsFilterModalVisible(true)}
        >
          <Text style={[styles.filterButtonText, { color: theme.buttonText }]}>Filter</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.createMealButton, { backgroundColor: theme.button }]}
        onPress={() => setIsCreateMealModalVisible(true)} // Open the modal
      >
        <Text style={[styles.createMealButtonText, { color: theme.buttonText }]}>Create Meal</Text>
      </TouchableOpacity>

      <FlatList
  data={filteredMeals}
  keyExtractor={(item) => item.id.toString()}
  numColumns={2} // Display two items per row
  renderItem={({ item }) => (
    <TouchableOpacity
      style={[styles.mealItem, { backgroundColor: theme.card, borderColor: theme.border }]}
      onPress={() => onMealSelect(item)}
    >
      {item.picture && typeof item.picture === "string" ? (
        <Image source={{ uri: item.picture }} style={styles.mealPicture} />
      ) : (
        <View style={styles.mealPicturePlaceholder}>
          <Text style={styles.mealPicturePlaceholderText}>No Image</Text>
        </View>
      )}
      <Text style={[styles.mealName, { color: theme.text }]}>{item.name}</Text>
      <Text style={[styles.mealDescription, { color: theme.subtext }]}>{item.description}</Text>

      {item.created_by_ai == true && (
        <View style={styles.aiTag}>
          <Text style={styles.aiTagText}>AI Generated</Text>
        </View>
      )}
    </TouchableOpacity>
  )}
  contentContainerStyle={styles.mealsGrid}
/>
    <Modal visible={isCreateMealModalVisible} transparent animationType="slide">
      <View style={styles.modalContainer}>
        <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>Select Meal Creation Type</Text>
          <TouchableOpacity
            style={[styles.modalButton, { backgroundColor: theme.primary }]}
            onPress={() => {
              setIsCreateMealModalVisible(false); // Close the modal
              router.push("/my-meals/create"); // Navigate to manual meal creation
            }}
          >
            <Text style={[styles.modalButtonText, { color: theme.buttonText }]}>Manual</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modalButton, { backgroundColor: theme.primary }]}
            onPress={() => {
              setIsCreateMealModalVisible(false); // Close the modal
              router.push("../AI/AICreateMeal"); // Navigate to AI meal creation
            }}
          >
            <Text style={[styles.modalButtonText, { color: theme.buttonText }]}>AI</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modalButton, { backgroundColor: theme.primary }]}
            onPress={() => {
              setIsCreateMealModalVisible(false); // Close the modal
              router.push("./url-create"); // Navigate to AI meal creation
            }}
          >
            <Text style={[styles.modalButtonText, { color: theme.buttonText }]}>URL</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cancelButton, { backgroundColor: theme.danger }]}
            onPress={() => setIsCreateMealModalVisible(false)} // Close the modal
          >
            <Text style={[styles.cancelButtonText, { color: theme.buttonText }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>

      <Modal visible={isFilterModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Filter Meals</Text>
            {tempFilters.map((filter, index) => (
              <View key={index} style={styles.filterRow}>
                <Text style={[styles.filterLabel, { color: theme.text }]}>
                  {filter.type.charAt(0).toUpperCase() + filter.type.slice(1)}
                </Text>
                <TextInput
                  style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                  placeholder="Greater than"
                  placeholderTextColor={theme.placeholder}
                  value={filter.greaterThan}
                  onChangeText={(text) => {
                    const updatedFilters = [...tempFilters];
                    updatedFilters[index].greaterThan = text;
                    setTempFilters(updatedFilters);
                  }}
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                  placeholder="Less than"
                  placeholderTextColor={theme.placeholder}
                  value={filter.lessThan}
                  onChangeText={(text) => {
                    const updatedFilters = [...tempFilters];
                    updatedFilters[index].lessThan = text;
                    setTempFilters(updatedFilters);
                  }}
                  keyboardType="numeric"
                />
              </View>
            ))}
            <TouchableOpacity style={[styles.applyButton, { backgroundColor: theme.button }]} onPress={applyFilters}>
              <Text style={[styles.applyButtonText, { color: theme.buttonText }]}>Apply Filters</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: theme.danger }]}
              onPress={() => {
                setTempFilters(filters); 
                setIsFilterModalVisible(false); 
              }}
            >
              <Text style={[styles.cancelButtonText, { color: theme.buttonText }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <BottomNav /> 
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    paddingBottom: 16,
    width: "100%",
    height: "100%",
  },
  mealItem: {
    flex: 1, // Ensure items take up equal space
    margin: 8, // Add spacing between items
    padding: 16,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "flex-start", // Align content to the top
  },
  mealPicture: {
    width: "100%", // Make the picture take up the full width of the item
    height: 100, // Set a fixed height for the picture
    borderRadius: 8,
    marginBottom: 8,
  },
  mealPicturePlaceholder: {
    width: "100%",
    height: 100,
    borderRadius: 8,
    backgroundColor: "#e0e0e0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  mealPicturePlaceholderText: {
    fontSize: 12,
    color: "#888",
  },
  mealName: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 4,
  },
  mealDescription: {
    fontSize: 14,
    textAlign: "center",
    color: "#666",
  },
  mealsGrid: {
    paddingBottom: 60,
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  searchBar: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 16,
  },
  filterButton: {
    marginLeft: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  filterButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    textAlign: "center",
  },
  noMealsText: {
    fontSize: 16,
    textAlign: "center",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    width: "80%",
    padding: 16,
    borderRadius: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  filterLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "bold",
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    marginHorizontal: 4,
    fontSize: 14,
  },
  applyButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 8,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  cancelButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  createMealButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
    alignSelf: "center", // Center the button horizontally
    width: "100%", // Set a width for the button
  },
  createMealButtonText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  aiTag: {
  position: "absolute",
  top: 8,
  right: 8,
  backgroundColor: "#FFD700", // Gold color for the tag
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 8,
  zIndex: 1, // Ensure the tag appears above other elements
},
aiTagText: {
  fontSize: 12,
  fontWeight: "bold",
  color: "#000", // Black text for contrast
},
modalButton: {
  width: "100%",
  padding: 12,
  borderRadius: 8,
  alignItems: "center",
  marginBottom: 8,
},
modalButtonText: {
  fontSize: 16,
  fontWeight: "bold",
},

});

export default MyMeals;
