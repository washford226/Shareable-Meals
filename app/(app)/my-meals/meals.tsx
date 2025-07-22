import React, { useEffect, useState, useCallback } from "react";
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
  RefreshControl,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Meal } from "../../../types/types";
import { useTheme } from "../../../context/ThemeContext";
import { useRouter } from "expo-router";  // Import Expo Router hook
import BottomNav from "components/bottomNav";
import Icon from "react-native-vector-icons/FontAwesome"
import RNPickerSelect from "react-native-picker-select";
import { supabase } from "utils/supabase";

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
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
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
  const [cuisineFilter, setCuisineFilter] = useState<string>("");
  const [tempCuisineFilter, setTempCuisineFilter] = useState<string>(cuisineFilter);
  const [favoriteLoading, setFavoriteLoading] = useState<{ [key: number]: boolean }>({});
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
  const isFilterActive =
    aiFilter !== "" ||
    dietaryRestrictionFilter !== "" ||
    cuisineFilter !== "" ||
    filters.some(f => f.greaterThan !== "" || f.lessThan !== "");

  const { theme } = useTheme();
  const router = useRouter(); // Initialize router

  const getCurrentUserId = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        throw new Error("Authentication required. Please log in again.");
      }
      return data.user.id;
    } catch (error: any) {
      console.error("Error getting user ID:", error);
      setError(error.message || "Authentication error");
      return null;
    }
  }, []);

  const toggleFavorite = async (mealId: number) => {
    if (favoriteLoading[mealId]) return; // Prevent multiple toggles
    
    try {
      setFavoriteLoading(prev => ({ ...prev, [mealId]: true }));
      setError(null);
      
      // Find current meal
      const currentMeal = meals.find(meal => meal.id === mealId);
      if (!currentMeal) {
        throw new Error("Meal not found");
      }
      
      const newFavoriteStatus = !currentMeal.favorite;
      
      // Optimistic update
      const updatedMeals = meals.map(meal => 
        meal.id === mealId 
          ? { ...meal, favorite: newFavoriteStatus }
          : meal
      );
      setMeals(updatedMeals);
      
      const { error } = await supabase
        .from("meals")
        .update({ favorite: newFavoriteStatus })
        .eq("id", mealId);

      if (error) {
        // Revert optimistic update on error
        const revertedMeals = meals.map(meal => 
          meal.id === mealId 
            ? { ...meal, favorite: currentMeal.favorite }
            : meal
        );
        setMeals(revertedMeals);
        throw new Error(error.message || "Failed to update favorite status");
      }
    } catch (error: any) {
      console.error("Error toggling favorite status:", error);
      const errorMessage = error.message || "Failed to update favorite status. Please try again.";
      setError(errorMessage);
      Alert.alert("Error", errorMessage);
    } finally {
      setFavoriteLoading(prev => ({ ...prev, [mealId]: false }));
    }
  };

  const restoreFiltersAndFetchMeals = useCallback(async () => {
    try {
      setError(null);
      
      // Restore filters from AsyncStorage
      const user = await supabase.auth.getUser();
      const userId = user.data?.user?.id;
      if (!userId) {
        throw new Error("Authentication required. Please log in again.");
      }

      const [savedFilters, savedSearchQuery, savedDietary, savedAi, savedCuisine] = await Promise.all([
        AsyncStorage.getItem(`filters_MyMeals_${userId}`),
        AsyncStorage.getItem(`searchQuery_MyMeals_${userId}`),
        AsyncStorage.getItem(`dietaryRestrictionFilter_MyMeals_${userId}`),
        AsyncStorage.getItem(`aiFilter_MyMeals_${userId}`),
        AsyncStorage.getItem(`cuisineFilter_MyMeals_${userId}`)
      ]);

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
    } catch (error: any) {
      console.error("Error restoring filters:", error);
      const errorMessage = error.message || "Failed to restore filters";
      setError(errorMessage);
      setFiltersLoaded(true); // Still allow the component to proceed
    }
  }, []);

  useEffect(() => {
    restoreFiltersAndFetchMeals();
  }, [restoreFiltersAndFetchMeals]);

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

  const fetchMyMeals = useCallback(async (isRefresh = false) => {
    if (!filtersLoaded) return;
    
    try {
      if (isRefresh) {
        setRefreshing(true);
        setError(null);
      } else {
        setLoading(true);
        setError(null);
      }

      const userId = await getCurrentUserId();
      if (!userId) {
        throw new Error("Authentication required. Please log in again.");
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

      if (error) {
        throw new Error(error.message || "Failed to fetch meals");
      }

      setMeals(data || []);
      setRetryCount(0); // Reset retry count on success
    } catch (error: any) {
      console.error("Error fetching meals:", error);
      const errorMessage = error.message || "Failed to fetch meals. Please try again later.";
      setError(errorMessage);
      
      // Auto-retry with exponential backoff for network errors
      if (retryCount < 3 && !error.message?.includes("Authentication")) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetchMyMeals(isRefresh);
        }, delay);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filtersLoaded, dietaryRestrictionFilter, aiFilter, cuisineFilter, getCurrentUserId, retryCount]);

  const handleRefresh = useCallback(() => {
    setRetryCount(0);
    fetchMyMeals(true);
  }, [fetchMyMeals]);

  useEffect(() => {
    fetchMyMeals();
  }, [filtersLoaded, dietaryRestrictionFilter, aiFilter, cuisineFilter, fetchMyMeals]);

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

  const handleSearchChange = useCallback(async (text: string) => {
    setSearchQuery(text);
    try {
      const userId = await getCurrentUserId();
      if (userId) {
        await AsyncStorage.setItem(`searchQuery_MyMeals_${userId}`, text);
      }
    } catch (error: any) {
      console.error("Error saving search query:", error);
      // Don't show error to user for this non-critical operation
    }
  }, [getCurrentUserId]);



  const clearFilters = useCallback(async () => {
    try {
      setError(null);
      
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
      const userId = await getCurrentUserId();
      if (userId) {
        await Promise.all([
          AsyncStorage.removeItem(`filters_MyMeals_${userId}`),
          AsyncStorage.removeItem(`searchQuery_MyMeals_${userId}`),
          AsyncStorage.removeItem(`dietaryRestrictionFilter_MyMeals_${userId}`),
          AsyncStorage.removeItem(`aiFilter_MyMeals_${userId}`),
          AsyncStorage.removeItem(`cuisineFilter_MyMeals_${userId}`)
        ]);
      }
      
      setIsFilterModalVisible(false);
    } catch (error: any) {
      console.error("Error clearing filters:", error);
      const errorMessage = error.message || "Failed to clear filters";
      setError(errorMessage);
      Alert.alert("Error", errorMessage);
    }
  }, [getCurrentUserId]);

const applyFilters = useCallback(async () => {
  try {
    setError(null);
    
    const isValid = tempFilters.every(
      (filter) =>
        (!filter.greaterThan || !isNaN(parseFloat(filter.greaterThan))) &&
        (!filter.lessThan || !isNaN(parseFloat(filter.lessThan)))
    );

    if (!isValid) {
      Alert.alert("Invalid Filters", "Please enter valid numeric values for the filters.");
      return;
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error("Authentication required. Please log in again.");
    }

    setFilters(tempFilters);
    setDietaryRestrictionFilter(tempDietaryRestrictionFilter);
    setAiFilter(tempAiFilter);
    setCuisineFilter(tempCuisineFilter);

    await Promise.all([
      AsyncStorage.setItem(`filters_MyMeals_${userId}`, JSON.stringify(tempFilters)),
      AsyncStorage.setItem(`aiFilter_MyMeals_${userId}`, tempAiFilter),
      AsyncStorage.setItem(`dietaryRestrictionFilter_MyMeals_${userId}`, tempDietaryRestrictionFilter),
      AsyncStorage.setItem(`cuisineFilter_MyMeals_${userId}`, tempCuisineFilter)
    ]);

    setIsFilterModalVisible(false);
  } catch (error: any) {
    console.error("Error saving filters:", error);
    const errorMessage = error.message || "Failed to apply filters";
    setError(errorMessage);
    Alert.alert("Error", errorMessage);
  }
}, [tempFilters, tempDietaryRestrictionFilter, tempAiFilter, tempCuisineFilter, getCurrentUserId]);

  if (loading || !filtersLoaded) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading your meals...</Text>
          {error && (
            <View style={styles.errorContainer}>
              <Text style={[styles.errorText, { color: theme.danger }]}>
                {error}
              </Text>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: theme.primary }]}
                onPress={handleRefresh}
              >
                <Text style={[styles.retryButtonText, { color: theme.buttonText }]}>
                  Retry
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        <BottomNav />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {error && (
        <View style={[styles.errorBanner, { backgroundColor: theme.card, borderColor: theme.danger }]}>
          <Text style={[styles.errorBannerText, { color: theme.danger }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.errorBannerButton, { backgroundColor: theme.danger }]}
            onPress={handleRefresh}
          >
            <Text style={[styles.errorBannerButtonText, { color: theme.buttonText }]}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      )}

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
        onPress={() => setIsCreateMealModalVisible(true)}
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
          numColumns={2}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[theme.primary]}
              tintColor={theme.primary}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.mealItem, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => onMealSelect(item)}
            >
              {/* Favorite Star */}
              <TouchableOpacity
                style={styles.favoriteIcon}
                onPress={() => toggleFavorite(item.id)}
              >
                <Icon
                  name="star"
                  size={24}
                  color={item.favorite ? "#FFD700" : "#ccc"}
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
                  ? `${item.description.slice(0, 100)}...`
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
                setIsCreateMealModalVisible(false);
                router.push("/my-meals/create");
              }}
            >
              <Text style={[styles.modalButtonText, { color: theme.buttonText }]}>Manual</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: theme.primary }]}
              onPress={() => {
                setIsCreateMealModalVisible(false);
                router.push("../AI/AICreateMeal");
              }}
            >
              <Text style={[styles.modalButtonText, { color: theme.buttonText }]}>AI</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: theme.primary }]}
              onPress={() => {
                setIsCreateMealModalVisible(false);
                router.push("./url-create");
              }}
            >
              <Text style={[styles.modalButtonText, { color: theme.buttonText }]}>URL</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: theme.danger }]}
              onPress={() => setIsCreateMealModalVisible(false)}
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
centerContent: {
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
  padding: 20,
},
errorContainer: {
  marginTop: 20,
  alignItems: "center",
},
errorText: {
  fontSize: 16,
  textAlign: "center",
  marginBottom: 10,
},
retryButton: {
  paddingHorizontal: 20,
  paddingVertical: 10,
  borderRadius: 6,
},
retryButtonText: {
  fontSize: 16,
  fontWeight: "bold",
},
errorBanner: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  padding: 12,
  marginHorizontal: 16,
  marginTop: 10,
  borderRadius: 8,
  borderWidth: 1,
},
errorBannerText: {
  flex: 1,
  fontSize: 14,
  marginRight: 12,
},
errorBannerButton: {
  paddingHorizontal: 16,
  paddingVertical: 6,
  borderRadius: 4,
},
errorBannerButtonText: {
  fontSize: 12,
  fontWeight: "bold",
},

});

export default MyMeals;
