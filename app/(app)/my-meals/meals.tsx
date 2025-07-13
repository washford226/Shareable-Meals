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
import { Meal } from "../../../types/types";
import { useTheme } from "../../../context/ThemeContext";
import { useRouter } from "expo-router";  // Import Expo Router hook
import BottomNav from "components/bottomNav";
import Icon from "react-native-vector-icons/FontAwesome"
import RNPickerSelect from "react-native-picker-select";
import { supabase } from "app/utils_supabase";

interface MyMealsProps {
  onCreateMeal: () => void;
}

const aiOptions = [
  { label: "All", value: "" },
  { label: "AI Generated", value: "ai" },
  { label: "Not AI Generated", value: "not_ai" },
];

const dietaryOptions = [
  { label: "All", value: "" },
  { label: "Vegetarian", value: "Vegetarian" },
  { label: "Vegan", value: "Vegan" },
  { label: "Gluten-Free", value: "Gluten-Free" },
  { label: "Keto", value: "Keto" },
  { label: "Paleo", value: "Paleo" },
];

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
  const [dietaryRestrictionFilter, setDietaryRestrictionFilter] = useState<string>("");
  const [aiFilter, setAiFilter] = useState<string>("");
  const [tempDietaryRestrictionFilter, setTempDietaryRestrictionFilter] = useState<string>(dietaryRestrictionFilter);
  const [tempAiFilter, setTempAiFilter] = useState<string>(aiFilter);
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  const cuisineOptions = [
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
const [cuisineFilter, setCuisineFilter] = useState<string>("");
const [tempCuisineFilter, setTempCuisineFilter] = useState<string>(cuisineFilter);
  const isFilterActive =
    aiFilter !== "" ||
    dietaryRestrictionFilter !== "" ||
    cuisineFilter !== "" ||
    filters.some(f => f.greaterThan !== "" || f.lessThan !== "");

  const { theme } = useTheme();
  const router = useRouter(); // Initialize router

  const getCurrentUserId = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  return data.user.id;
};

  const toggleFavorite = async (mealId: number) => {
  try {
    const { data, error } = await supabase
      .from("meals")
      .update({ favorite: true }) // or false, toggle as needed
      .eq("id", mealId);

    if (error) throw error;

    // Update local state as needed
  } catch (error) {
    console.error("Error toggling favorite status:", error);
    Alert.alert("Error", "Failed to update favorite status. Please try again.");
  }
};

useEffect(() => {
  const restoreFiltersAndFetchMeals = async () => {
    // Restore filters from AsyncStorage
    const user = await supabase.auth.getUser();
    const userId = user.data?.user?.id;
    if (!userId) return;

    const savedFilters = await AsyncStorage.getItem(`filters_MyMeals_${userId}`);
    const savedSearchQuery = await AsyncStorage.getItem(`searchQuery_MyMeals_${userId}`);
    const savedDietary = await AsyncStorage.getItem(`dietaryRestrictionFilter_MyMeals_${userId}`);
    const savedAi = await AsyncStorage.getItem(`aiFilter_MyMeals_${userId}`);
    const savedCuisine = await AsyncStorage.getItem(`cuisineFilter_MyMeals_${userId}`);

    if (savedFilters) {
      const parsedFilters = JSON.parse(savedFilters);
      setFilters(parsedFilters);
      setTempFilters(parsedFilters);
    }
    if (savedSearchQuery) setSearchQuery(savedSearchQuery);
    if (savedDietary !== null) setDietaryRestrictionFilter(savedDietary);
    if (savedAi !== null) setAiFilter(savedAi);
    if (savedCuisine !== null) setCuisineFilter(savedCuisine);

    setFiltersLoaded(true);
  };

  restoreFiltersAndFetchMeals();
}, []);

  useEffect(() => {
  if (!filtersLoaded) return;

  const fetchMyMeals = async () => {
  setLoading(true);
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      Alert.alert("Error", "User not authenticated. Please log in.");
      return;
    }

    let query = supabase
      .from("meals")
      .select("*")
      .eq("user_id", userId);

    if (dietaryRestrictionFilter) query = query.eq("dietary_restrictions", dietaryRestrictionFilter);
    if (aiFilter === "ai") query = query.eq("created_by_ai", true);
    if (aiFilter === "not_ai") query = query.eq("created_by_ai", false);
    if (cuisineFilter) query = query.eq("cuisine", cuisineFilter);

    const { data, error } = await query;

    if (error) throw error;

    setMeals(data || []);
  } catch (error) {
    console.error("Error fetching meals:", error);
    Alert.alert("Error", "Failed to fetch meals. Please try again later.");
  } finally {
    setLoading(false);
  }
};

  fetchMyMeals();
}, [filtersLoaded, dietaryRestrictionFilter, aiFilter, cuisineFilter]);

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
    const { data, error } = await supabase.auth.getUser();
    const userId = data?.user?.id;
    if (!userId) {
      Alert.alert("Error", "User not authenticated. Please log in.");
      return;
    }
    await AsyncStorage.setItem(`searchQuery_MyMeals_${userId}`, text);
  } catch (error) {
    console.error("Error saving search query:", error);
  }
};



  const clearFilters = async () => {
  const defaultFilters = [
    { type: "calories", greaterThan: "", lessThan: "" },
    { type: "fat", greaterThan: "", lessThan: "" },
    { type: "protein", greaterThan: "", lessThan: "" },
    { type: "carbohydrates", greaterThan: "", lessThan: "" },
  ];
  setFilters(defaultFilters);
  setTempFilters(defaultFilters);
  setAiFilter("");
  setTempAiFilter("");
  setDietaryRestrictionFilter("");
  setTempDietaryRestrictionFilter("");
  setCuisineFilter("");
  setTempCuisineFilter("");
  setSearchQuery("");

  // Use Supabase to get the user ID
  const { data, error } = await supabase.auth.getUser();
  const userId = data?.user?.id;
  if (userId) {
    await AsyncStorage.removeItem(`filters_MyMeals_${userId}`);
    await AsyncStorage.removeItem(`searchQuery_MyMeals_${userId}`);
    await AsyncStorage.removeItem(`dietaryRestrictionFilter_MyMeals_${userId}`);
    await AsyncStorage.removeItem(`aiFilter_MyMeals_${userId}`);
    await AsyncStorage.removeItem(`cuisineFilter_MyMeals_${userId}`);
  }
  setIsFilterModalVisible(false);
};

const applyFilters = async () => {
  try {
    const { data, error } = await supabase.auth.getUser();
    const userId = data?.user?.id;
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
    setDietaryRestrictionFilter(tempDietaryRestrictionFilter);
    setAiFilter(tempAiFilter);
    setCuisineFilter(tempCuisineFilter);

    await AsyncStorage.setItem(`filters_MyMeals_${userId}`, JSON.stringify(tempFilters));
    await AsyncStorage.setItem(`aiFilter_MyMeals_${userId}`, tempAiFilter);
    await AsyncStorage.setItem(`dietaryRestrictionFilter_MyMeals_${userId}`, tempDietaryRestrictionFilter);
    await AsyncStorage.setItem(`cuisineFilter_MyMeals_${userId}`, tempCuisineFilter);

    setIsFilterModalVisible(false);
  } catch (error) {
    console.error("Error saving filters:", error);
  }
};

  if (loading || !filtersLoaded) {
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ActivityIndicator size="large" color={theme.primary} />
      <Text style={[styles.loadingText, { color: theme.text }]}>Loading your meals...</Text>
      <BottomNav />
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
  style={[
    styles.filterButton,
    { backgroundColor: isFilterActive ? theme.primary : theme.button }
  ]}
  onPress={() => {
    setTempAiFilter(aiFilter);
    setTempDietaryRestrictionFilter(dietaryRestrictionFilter);
    setIsFilterModalVisible(true);
  }}
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

      {filteredMeals.length === 0 ? (
  <View style={{ flex: 1, justifyContent: "center", alignItems: "center", width: "100%" }}>
    <Text style={[styles.noMealsText, { color: theme.text, marginTop: 32 }]}>
      No meals found. Please create a meal.
    </Text>
  </View>
) : (
      <FlatList
  data={filteredMeals}
  keyExtractor={(item) => item.id.toString()}
  numColumns={2} // Display two items per row
  renderItem={({ item }) => (
    <TouchableOpacity
      style={[styles.mealItem, { backgroundColor: theme.card, borderColor: theme.border }]}
      onPress={() => onMealSelect(item)}
    >
      {/* Favorite Star */}
          <TouchableOpacity
            style={styles.favoriteIcon}
            onPress={() => toggleFavorite(item.id)} // Call the toggleFavorite function
          >
            <Icon
              name="star"
              size={24}
              color={item.favorite ? "#FFD700" : "#ccc"} // Gold if favorite, gray otherwise
            />
          </TouchableOpacity>
      {item.picture && typeof item.picture === "string" ? (
        <Image source={{ uri: item.picture }} style={styles.mealPicture} />
      ) : (
        <View style={styles.mealPicturePlaceholder}>
          <Text style={styles.mealPicturePlaceholderText}>No Image</Text>
        </View>
      )}
      <Text style={[styles.mealDescription, { color: theme.subtext }]}>
        {item.description.length > 100
          ? `${item.description.slice(0, 100)}...` // Limit to 100 characters
          : item.description}
      </Text>
      {item.created_by_ai == true && (
        <View style={styles.aiTag}>
          <Text style={styles.aiTagText}>AI Generated</Text>
        </View>
      )}
    </TouchableOpacity>
  )}
  contentContainerStyle={styles.mealsGrid}
/>
)}
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
            <Text style={[styles.label, { color: theme.text }]}>Dietary Restriction</Text>
            <View style={{ marginBottom: 12 }}>
              <RNPickerSelect
                onValueChange={setTempDietaryRestrictionFilter}
                items={dietaryOptions}
                value={tempDietaryRestrictionFilter}
                style={{
                  inputIOS: {
                    color: dietaryRestrictionFilter ? theme.text : theme.placeholder,
                    paddingVertical: 12,
                    paddingHorizontal: 10,
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 8,
                    backgroundColor: theme.card,
                    paddingRight: 30, // to ensure the dropdown icon doesn't overlap text
                  },
                  inputAndroid: {
                    color: dietaryRestrictionFilter ? theme.text : theme.placeholder,
                    paddingVertical: 12,
                    paddingHorizontal: 10,
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 8,
                    backgroundColor: theme.card,
                    paddingRight: 30,
                  },
                  iconContainer: {
                    top: 16,
                    right: 12,
                  },
                  placeholder: {
                    color: theme.placeholder,
                  },
                }}
                useNativeAndroidPickerStyle={false}
                Icon={() => <Text style={{ fontSize: 16, color: theme.text }}>▼</Text>}
              />
            </View>

            <Text style={[styles.label, { color: theme.text }]}>Cuisine</Text>
<View style={{ marginBottom: 12 }}>
  <RNPickerSelect
    onValueChange={setTempCuisineFilter}
    items={cuisineOptions}
    value={tempCuisineFilter}
    style={{
      inputIOS: {
        color: tempCuisineFilter ? theme.text : theme.placeholder,
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 8,
        backgroundColor: theme.card,
        paddingRight: 30,
      },
      inputAndroid: {
        color: tempCuisineFilter ? theme.text : theme.placeholder,
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 8,
        backgroundColor: theme.card,
        paddingRight: 30,
      },
      iconContainer: {
        top: 16,
        right: 12,
      },
      placeholder: {
        color: theme.placeholder,
      },
    }}
    useNativeAndroidPickerStyle={false}
    Icon={() => <Text style={{ fontSize: 16, color: theme.text }}>▼</Text>}
    placeholder={{ label: "Select Cuisine", value: "" }}
  />
</View>

            {/* AI Generated Switch */}
            <Text style={[styles.label, { color: theme.text }]}>AI Generation</Text>
            <View style={{ marginBottom: 12 }}>
              <RNPickerSelect
                onValueChange={setTempAiFilter}
                items={aiOptions}
                value={tempAiFilter}
                style={{
                  inputIOS: {
                    color: theme.text,
                    paddingVertical: 12,
                    paddingHorizontal: 10,
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 8,
                    backgroundColor: theme.card,
                    paddingRight: 30,
                  },
                  inputAndroid: {
                    color: theme.text,
                    paddingVertical: 12,
                    paddingHorizontal: 10,
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 8,
                    backgroundColor: theme.card,
                    paddingRight: 30,
                  },
                  iconContainer: {
                    top: 16,
                    right: 12,
                  },
                  placeholder: {
                    color: theme.placeholder,
                  },
                }}
                useNativeAndroidPickerStyle={false}
                Icon={() => <Text style={{ fontSize: 16, color: theme.text }}>▼</Text>}
              />
            </View>
            <TouchableOpacity style={[styles.applyButton, { backgroundColor: theme.button }]} onPress={applyFilters}>
              <Text style={[styles.applyButtonText, { color: theme.buttonText }]}>Apply Filters</Text>
            </TouchableOpacity>

            <TouchableOpacity
  style={[styles.clearButton, { backgroundColor: theme.button, marginTop: 8 }]}
  onPress={clearFilters}
>
  <Text style={[styles.clearButtonText, { color: theme.buttonText }]}>Clear Filters</Text>
</TouchableOpacity>

            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: theme.danger }]}
              onPress={() => {
                setTempFilters(filters);
                setTempDietaryRestrictionFilter(dietaryRestrictionFilter);
                setTempAiFilter(aiFilter);
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
  label: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  favoriteIcon: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 1,
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
  clearButton: {
  padding: 12,
  borderRadius: 8,
  alignItems: "center",
  marginVertical: 4,
},
clearButtonText: {
  fontWeight: "bold",
  fontSize: 16,
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
    width: "93%",
    height: "70%",
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
  left: 8,
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
