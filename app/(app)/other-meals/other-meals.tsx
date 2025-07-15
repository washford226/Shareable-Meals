import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Image,
} from "react-native";
import { Meal } from "../../../types/types";
import { useTheme } from "../../../context/ThemeContext";
import Icon from "react-native-vector-icons/FontAwesome";
import { useRouter } from "expo-router";
import BottomNav from "components/bottomNav";
import RNPickerSelect from "react-native-picker-select";
import { supabase } from "utils/supabase";

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

const defaultFilters = [
  { type: "calories", greaterThan: "", lessThan: "" },
  { type: "fat", greaterThan: "", lessThan: "" },
  { type: "protein", greaterThan: "", lessThan: "" },
  { type: "carbohydrates", greaterThan: "", lessThan: "" },
];

const OtherMeals: React.FC = () => {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [filteredMeals, setFilteredMeals] = useState<Meal[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);

  const [filters, setFilters] = useState(defaultFilters);
  const [tempFilters, setTempFilters] = useState(defaultFilters);

  const [aiFilter, setAiFilter] = useState<string>("");
  const [dietaryRestrictionFilter, setDietaryRestrictionFilter] = useState<string>("");
  const [cuisineFilter, setCuisineFilter] = useState<string>("");

  const [tempAiFilter, setTempAiFilter] = useState<string>(aiFilter);
  const [tempDietaryRestrictionFilter, setTempDietaryRestrictionFilter] = useState<string>(dietaryRestrictionFilter);
  const [tempCuisineFilter, setTempCuisineFilter] = useState<string>(cuisineFilter);

  const { theme } = useTheme();
  const router = useRouter();

  const isFilterActive =
    aiFilter !== "" ||
    dietaryRestrictionFilter !== "" ||
    cuisineFilter !== "" ||
    filters.some(f => f.greaterThan !== "" || f.lessThan !== "");

  

  // Fetch all public meals from Supabase
  const fetchMeals = async () => {
  setLoading(true);
  try {
    // 1. Fetch all public meals
    let query = supabase
      .from("meals")
      .select("*")
      .eq("visibility", true);

    if (dietaryRestrictionFilter) query = query.eq("dietary_restrictions", dietaryRestrictionFilter);
    if (aiFilter === "ai") query = query.eq("created_by_ai", true);
    if (aiFilter === "not_ai") query = query.eq("created_by_ai", false);
    if (cuisineFilter) query = query.eq("cuisine", cuisineFilter);

    const { data: mealsData, error: mealsError } = await query;
    if (mealsError) throw mealsError;

    // 2. Fetch all user_profiles for those user_ids
    const userIds = Array.from(new Set((mealsData || []).map(meal => meal.user_id)));
    let userIdToUsername: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from("user_profiles")
        .select("id,username")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      (profilesData || []).forEach(profile => {
        userIdToUsername[profile.id] = profile.username;
      });
    }

    // 3. Combine meals and usernames
    const mealsWithUsernames = (mealsData || []).map(meal => ({
      ...meal,
      userName: userIdToUsername[meal.user_id] || "Unknown",
      averageRating: 0,
      reviewCount: 0,
    }));

    setMeals(mealsWithUsernames);
    setFilteredMeals(mealsWithUsernames);
  } catch (error) {
    console.error("Error fetching meals:", error);
    Alert.alert("Error", "Failed to fetch meals. Please try again later.");
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    fetchMeals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dietaryRestrictionFilter, aiFilter, cuisineFilter]);

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
        meal.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (meal.userName && meal.userName.toLowerCase().includes(searchQuery.toLowerCase()));

      return passesFilters && passesSearch;
    });

    setFilteredMeals(filtered);
  }, [searchQuery, filters, meals]);

  const onMealSelect = (meal: Meal) => {
    router.push(`/other-meals/${meal.id}/other-meals-info`);
  };

  const applyFilters = () => {
    setFilters(tempFilters);
    setAiFilter(tempAiFilter);
    setDietaryRestrictionFilter(tempDietaryRestrictionFilter);
    setCuisineFilter(tempCuisineFilter);
    setIsFilterModalVisible(false);
  };

  const clearFilters = () => {
    setFilters(defaultFilters);
    setTempFilters(defaultFilters);
    setAiFilter("");
    setTempAiFilter("");
    setDietaryRestrictionFilter("");
    setTempDietaryRestrictionFilter("");
    setCuisineFilter("");
    setTempCuisineFilter("");
    setSearchQuery("");
    setIsFilterModalVisible(false);
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>Loading meals...</Text>
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
            { backgroundColor: isFilterActive ? theme.primary : theme.button },
          ]}
          onPress={() => {
            setTempAiFilter(aiFilter);
            setTempDietaryRestrictionFilter(dietaryRestrictionFilter);
            setTempCuisineFilter(cuisineFilter);
            setIsFilterModalVisible(true);
          }}
        >
          <Text style={[styles.filterButtonText, { color: theme.buttonText }]}>Filter</Text>
        </TouchableOpacity>
      </View>

      {/* Weekly Meals Button */}
      <TouchableOpacity
        style={[styles.weeklyMealsButton, { backgroundColor: theme.primary }]}
        onPress={() => router.push("/competition/current-meals")}
      >
        <Text style={[styles.weeklyMealsButtonText, { color: theme.buttonText }]}>
          Weekly Meals
        </Text>
      </TouchableOpacity>

      <FlatList
        data={filteredMeals}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
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
            <Text style={[styles.mealDescription, { color: theme.subtext }]}>
              {item.description.length > 100
                ? `${item.description.slice(0, 100)}...`
                : item.description}
            </Text>
            {/* AI Generated Tag */}
            {item.created_by_ai == true && (
              <View style={styles.aiTag}>
                <Text style={styles.aiTagText}>AI Generated</Text>
              </View>
            )}
            <View style={styles.ratingContainer}>
              {[...Array(5)].map((_, index) => (
                <Icon
                  key={index}
                  name="star"
                  size={16}
                  color={index < Math.floor(item.averageRating) ? "#FFD700" : "#CCCCCC"}
                />
              ))}
              <Text style={[styles.reviewCount, { color: theme.subtext }]}>
                ({item.reviewCount} reviews)
              </Text>
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.mealsGrid}
      />

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
                    paddingRight: 30,
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
              style={[styles.cancelButton, { backgroundColor: theme.button, marginTop: 8 }]}
              onPress={clearFilters}
            >
              <Text style={[styles.cancelButtonText, { color: theme.buttonText }]}>Clear Filters</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: theme.danger }]}
              onPress={() => {
                setTempAiFilter(aiFilter);
                setTempDietaryRestrictionFilter(dietaryRestrictionFilter);
                setTempCuisineFilter(cuisineFilter);
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
    width: "100%",
  },
  mealItem: {
    flex: 1,
    margin: 8,
    padding: 16,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  aiTag: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "#FFD700",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    zIndex: 1,
  },
  aiTagText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#000",
  },
  weeklyMealsButton: {
    margin: 16,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  weeklyMealsButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  mealPicture: {
    width: "100%",
    height: 100,
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
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  reviewCount: {
    fontSize: 12,
    marginLeft: 4,
    color: "#888",
  },
  mealsGrid: {
    paddingBottom: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: "center",
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    margin: 16,
  },
  searchBar: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
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
  mealUser: {
    fontSize: 12,
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
  label: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
});

export default OtherMeals;
