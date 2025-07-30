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
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Meal } from "../../../types/types";
import { useTheme } from "../../../context/ThemeContext";
import { useRouter } from "expo-router";  // Import Expo Router hook
import BottomNav from "components/bottomNav";
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
  const [favoriteLoading, setFavoriteLoading] = useState<{ [key: string]: boolean }>({});
  const [macroUsageInfo, setMacroUsageInfo] = useState<{
    daily_usage: number;
    daily_limit: number;
    remaining: number;
  } | null>(null);
  const [macroUsageLoading, setMacroUsageLoading] = useState<boolean>(false);
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

  const fetchMacroUsageInfo = useCallback(async () => {
    try {
      setMacroUsageLoading(true);
      const userId = await getCurrentUserId();
      if (!userId) return;

      const today = new Date().toISOString().split('T')[0];
      
      const { data: userProfile, error } = await supabase
        .from("user_profiles")
        .select("macro_calculation_uses, macro_calculation_uses_last_date")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Error fetching macro usage info:", error);
        return;
      }

      if (userProfile) {
        const lastUsageDate = userProfile.macro_calculation_uses_last_date;
        const currentUsageCount = userProfile.macro_calculation_uses || 0;

        // Reset count if it's a new day
        const dailyUsage = lastUsageDate === today ? currentUsageCount : 0;
        
        setMacroUsageInfo({
          daily_usage: dailyUsage,
          daily_limit: 20,
          remaining: Math.max(0, 20 - dailyUsage)
        });
      }
    } catch (error: any) {
      console.error("Error fetching macro usage info:", error);
    } finally {
      setMacroUsageLoading(false);
    }
  }, [getCurrentUserId]);

  const toggleFavorite = async (mealId: number | string) => {
    if (favoriteLoading[mealId]) return; // Prevent multiple toggles
    
    // Skip toggle for macro meals (they don't have favorite status in database)
    if (typeof mealId === 'string' && mealId.startsWith('macro_')) {
      return;
    }
    
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
    fetchMacroUsageInfo();
  }, [restoreFiltersAndFetchMeals, fetchMacroUsageInfo]);

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
    fetchMacroUsageInfo(); // Also refresh usage info
  }, [fetchMyMeals, fetchMacroUsageInfo]);

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
          <View style={[styles.loadingCard, { backgroundColor: theme.card }]}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.text }]}>
              Loading your meals...
            </Text>
          </View>
          {error && (
            <View style={[styles.errorContainer, { backgroundColor: theme.card, borderColor: theme.danger }]}>
              <Ionicons name="warning-outline" size={32} color={theme.danger} />
              <Text style={[styles.errorTitle, { color: theme.danger }]}>
                Error Loading Meals
              </Text>
              <Text style={[styles.errorText, { color: theme.text }]}>
                {error}
              </Text>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: theme.primary }]}
                onPress={handleRefresh}
              >
                <Ionicons name="refresh-outline" size={20} color={theme.buttonText} style={{ marginRight: 8 }} />
                <Text style={[styles.retryButtonText, { color: theme.buttonText }]}>
                  Try Again
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
          <Ionicons name="warning" size={20} color={theme.danger} />
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
        <View style={[styles.searchInputContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="search" size={20} color={theme.subtext} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchBar, { color: theme.text }]}
            placeholder="Search meals..."
            placeholderTextColor={theme.placeholder}
            value={searchQuery}
            onChangeText={handleSearchChange} 
          />
        </View>
        <TouchableOpacity
          style={[
            styles.filterButton,
            { 
              backgroundColor: isFilterActive ? theme.primary : theme.card,
              borderColor: theme.border
            }
          ]}
          onPress={() => {
            setTempAiFilter(aiFilter);
            setTempDietaryRestrictionFilter(dietaryRestrictionFilter);
            setTempCuisineFilter(cuisineFilter);
            setIsFilterModalVisible(true);
          }}
        >
          <Ionicons 
            name="filter" 
            size={20} 
            color={isFilterActive ? theme.buttonText : theme.text} 
          />
          <Text style={[
            styles.filterButtonText, 
            { color: isFilterActive ? theme.buttonText : theme.text }
          ]}>
            Filter
          </Text>
          {isFilterActive && (
            <View style={[styles.filterActiveDot, { backgroundColor: theme.warning }]} />
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.createMealButton, { backgroundColor: theme.primary }]}
        onPress={() => setIsCreateMealModalVisible(true)}
      >
        <Ionicons name="add-circle-outline" size={24} color={theme.buttonText} style={{ marginRight: 8 }} />
        <Text style={[styles.createMealButtonText, { color: theme.buttonText }]}>Create New Meal</Text>
      </TouchableOpacity>

      {/* Macro Usage Info */}
      {macroUsageInfo && (
        <View style={[styles.usageInfoContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.usageInfoHeader}>
            <Ionicons name="calculator-outline" size={20} color={theme.primary} />
            <Text style={[styles.usageInfoTitle, { color: theme.text }]}>
              AI Macro Calculations
            </Text>
          </View>
          <View style={styles.usageInfoContent}>
            <Text style={[styles.usageInfoText, { color: theme.subtext }]}>
              Today: {macroUsageInfo.daily_usage}/{macroUsageInfo.daily_limit} used
            </Text>
            <View style={[styles.usageProgressBar, { backgroundColor: theme.cardSecondary }]}>
              <View 
                style={[
                  styles.usageProgressFill, 
                  { 
                    backgroundColor: macroUsageInfo.remaining <= 5 ? theme.danger : theme.primary,
                    width: `${(macroUsageInfo.daily_usage / macroUsageInfo.daily_limit) * 100}%`
                  }
                ]} 
              />
            </View>
            <Text style={[
              styles.usageRemainingText, 
              { 
                color: macroUsageInfo.remaining <= 5 ? theme.danger : theme.success 
              }
            ]}>
              {macroUsageInfo.remaining} calculations remaining
            </Text>
          </View>
        </View>
      )}

      {filteredMeals.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <View style={[styles.emptyStateCard, { backgroundColor: theme.card }]}>
            <Ionicons name="restaurant-outline" size={64} color={theme.subtext} />
            <Text style={[styles.emptyStateTitle, { color: theme.text }]}>
              No Meals Found
            </Text>
            <Text style={[styles.emptyStateText, { color: theme.subtext }]}>
              {searchQuery || isFilterActive 
                ? "Try adjusting your search or filters to find meals."
                : "Create your first meal to get started with meal planning!"
              }
            </Text>
            {!searchQuery && !isFilterActive && (
              <TouchableOpacity
                style={[styles.emptyStateButton, { backgroundColor: theme.primary }]}
                onPress={() => setIsCreateMealModalVisible(true)}
              >
                <Ionicons name="add" size={20} color={theme.buttonText} style={{ marginRight: 8 }} />
                <Text style={[styles.emptyStateButtonText, { color: theme.buttonText }]}>
                  Create Your First Meal
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        <FlatList
          data={filteredMeals}
          keyExtractor={(item) => String(item.id)}
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
                disabled={favoriteLoading[item.id]}
              >
                {favoriteLoading[item.id] ? (
                  <ActivityIndicator size="small" color={theme.warning} />
                ) : (
                  <Ionicons
                    name={item.favorite ? "star" : "star-outline"}
                    size={24}
                    color={item.favorite ? theme.warning : theme.subtext}
                  />
                )}
              </TouchableOpacity>

              {/* AI Tag */}
              {item.created_by_ai === true && (
                <View style={[styles.aiTag, { backgroundColor: theme.aiAccent }]}>
                  <Ionicons name="sparkles" size={12} color={theme.buttonText} />
                  <Text style={[styles.aiTagText, { color: theme.buttonText }]}>AI</Text>
                </View>
              )}

              {/* Meal Image */}
              {item.picture && typeof item.picture === "string" ? (
                <Image 
                  source={{ 
                    uri: item.picture.startsWith('\\x') 
                      ? item.picture.slice(2).match(/.{2}/g)?.map((hex: string) => String.fromCharCode(parseInt(hex, 16))).join('') || ''
                      : item.picture
                  }} 
                  style={styles.mealPicture} 
                />
              ) : (
                <View style={[styles.mealPicturePlaceholder, { backgroundColor: theme.cardSecondary }]}>
                  <Ionicons name="image-outline" size={32} color={theme.subtext} />
                  <Text style={[styles.mealPicturePlaceholderText, { color: theme.subtext }]}>
                    No Image
                  </Text>
                </View>
              )}

              {/* Meal Info */}
              <View style={styles.mealInfo}>
                <Text style={[styles.mealName, { color: theme.text }]} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={[styles.mealDescription, { color: theme.subtext }]} numberOfLines={3}>
                  {item.description.length > 80
                    ? `${item.description.slice(0, 80)}...`
                    : item.description}
                </Text>
                
                {/* Nutrition Preview */}
                <View style={styles.nutritionPreview}>
                  <View style={styles.nutritionItem}>
                    <Ionicons name="flame-outline" size={14} color={theme.warning} />
                    <Text style={[styles.nutritionText, { color: theme.subtext }]}>
                      {item.calories}
                    </Text>
                  </View>
                  <View style={styles.nutritionItem}>
                    <Ionicons name="barbell-outline" size={14} color={theme.protein} />
                    <Text style={[styles.nutritionText, { color: theme.subtext }]}>
                      {item.protein}g
                    </Text>
                  </View>
                  <View style={styles.nutritionItem}>
                    <Ionicons name="analytics-outline" size={14} color={theme.carbs} />
                    <Text style={[styles.nutritionText, { color: theme.subtext }]}>
                      {item.carbohydrates}g
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.mealsGrid}
        />
      )}

      <Modal visible={isCreateMealModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Create New Meal</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setIsCreateMealModalVisible(false)}
              >
                <Ionicons name="close" size={24} color={theme.subtext} />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.modalSubtitle, { color: theme.subtext }]}>
              Choose how you'd like to create your meal
            </Text>

            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: theme.primary }]}
              onPress={() => {
                setIsCreateMealModalVisible(false);
                router.push("/my-meals/create");
              }}
            >
              <Ionicons name="create-outline" size={24} color={theme.buttonText} />
              <View style={styles.modalButtonContent}>
                <Text style={[styles.modalButtonText, { color: theme.buttonText }]}>Manual Entry</Text>
                <Text style={[styles.modalButtonSubtext, { color: theme.buttonText, opacity: 0.8 }]}>
                  Enter meal details yourself
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.buttonText} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: theme.aiAccent }]}
              onPress={() => {
                setIsCreateMealModalVisible(false);
                router.push("../AI/AICreateMeal");
              }}
            >
              <Ionicons name="sparkles" size={24} color={theme.buttonText} />
              <View style={styles.modalButtonContent}>
                <Text style={[styles.modalButtonText, { color: theme.buttonText }]}>AI Generated</Text>
                <Text style={[styles.modalButtonSubtext, { color: theme.buttonText, opacity: 0.8 }]}>
                  Let AI create a meal for you
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.buttonText} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: theme.info }]}
              onPress={() => {
                setIsCreateMealModalVisible(false);
                router.push("./url-create");
              }}
            >
              <Ionicons name="link-outline" size={24} color={theme.buttonText} />
              <View style={styles.modalButtonContent}>
                <Text style={[styles.modalButtonText, { color: theme.buttonText }]}>From URL</Text>
                <Text style={[styles.modalButtonSubtext, { color: theme.buttonText, opacity: 0.8 }]}>
                  Import from recipe website
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.buttonText} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: theme.background, borderColor: theme.border }]}
              onPress={() => setIsCreateMealModalVisible(false)}
            >
              <Text style={[styles.cancelButtonText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={isFilterModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
            <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Filter Meals</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => {
                    setTempFilters(filters);
                    setTempDietaryRestrictionFilter(dietaryRestrictionFilter);
                    setTempAiFilter(aiFilter);
                    setTempCuisineFilter(cuisineFilter);
                    setIsFilterModalVisible(false);
                  }}
                >
                  <Ionicons name="close" size={24} color={theme.subtext} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.modalSubtitle, { color: theme.subtext }]}>
                Refine your meal search with these filters
              </Text>

              {/* Nutrition Filters */}
              <Text style={[styles.label, { color: theme.text }]}>Nutrition Ranges</Text>
              {tempFilters.map((filter, index) => (
                <View key={index} style={styles.filterRow}>
                  <Text style={[styles.filterLabel, { color: theme.text }]}>
                    {filter.type.charAt(0).toUpperCase() + filter.type.slice(1)}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput
                      style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.background, flex: 1 }]}
                      placeholder="Min"
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
                      style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.background, flex: 1 }]}
                      placeholder="Max"
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
                </View>
              ))}

              {/* Dietary Restrictions */}
              <Text style={[styles.label, { color: theme.text }]}>Dietary Restrictions</Text>
              <View style={{ marginBottom: 16 }}>
                <RNPickerSelect
                  onValueChange={setTempDietaryRestrictionFilter}
                  items={dietaryOptions}
                  value={tempDietaryRestrictionFilter}
                  style={{
                    inputIOS: {
                      color: tempDietaryRestrictionFilter ? theme.text : theme.placeholder,
                      paddingVertical: 16,
                      paddingHorizontal: 16,
                      borderWidth: 1,
                      borderColor: theme.border,
                      borderRadius: 12,
                      backgroundColor: theme.background,
                      fontSize: 16,
                      fontWeight: '500',
                    },
                    inputAndroid: {
                      color: tempDietaryRestrictionFilter ? theme.text : theme.placeholder,
                      paddingVertical: 16,
                      paddingHorizontal: 16,
                      borderWidth: 1,
                      borderColor: theme.border,
                      borderRadius: 12,
                      backgroundColor: theme.background,
                      fontSize: 16,
                      fontWeight: '500',
                    },
                  }}
                  useNativeAndroidPickerStyle={false}
                  placeholder={{ label: "Select dietary restriction", value: "" }}
                />
              </View>

              {/* Cuisine Filter */}
              <Text style={[styles.label, { color: theme.text }]}>Cuisine Type</Text>
              <View style={{ marginBottom: 16 }}>
                <RNPickerSelect
                  onValueChange={setTempCuisineFilter}
                  items={cuisineOptions}
                  value={tempCuisineFilter}
                  style={{
                    inputIOS: {
                      color: tempCuisineFilter ? theme.text : theme.placeholder,
                      paddingVertical: 16,
                      paddingHorizontal: 16,
                      borderWidth: 1,
                      borderColor: theme.border,
                      borderRadius: 12,
                      backgroundColor: theme.background,
                      fontSize: 16,
                      fontWeight: '500',
                    },
                    inputAndroid: {
                      color: tempCuisineFilter ? theme.text : theme.placeholder,
                      paddingVertical: 16,
                      paddingHorizontal: 16,
                      borderWidth: 1,
                      borderColor: theme.border,
                      borderRadius: 12,
                      backgroundColor: theme.background,
                      fontSize: 16,
                      fontWeight: '500',
                    },
                  }}
                  useNativeAndroidPickerStyle={false}
                  placeholder={{ label: "Select cuisine type", value: "" }}
                />
              </View>

              {/* AI Generation Filter */}
              <Text style={[styles.label, { color: theme.text }]}>AI Generation</Text>
              <View style={{ marginBottom: 24 }}>
                <RNPickerSelect
                  onValueChange={setTempAiFilter}
                  items={aiOptions}
                  value={tempAiFilter}
                  style={{
                    inputIOS: {
                      color: theme.text,
                      paddingVertical: 16,
                      paddingHorizontal: 16,
                      borderWidth: 1,
                      borderColor: theme.border,
                      borderRadius: 12,
                      backgroundColor: theme.background,
                      fontSize: 16,
                      fontWeight: '500',
                    },
                    inputAndroid: {
                      color: theme.text,
                      paddingVertical: 16,
                      paddingHorizontal: 16,
                      borderWidth: 1,
                      borderColor: theme.border,
                      borderRadius: 12,
                      backgroundColor: theme.background,
                      fontSize: 16,
                      fontWeight: '500',
                    },
                  }}
                  useNativeAndroidPickerStyle={false}
                  placeholder={{ label: "All meals", value: "" }}
                />
              </View>

              {/* Action Buttons */}
              <TouchableOpacity 
                style={[styles.applyButton, { backgroundColor: theme.primary }]} 
                onPress={applyFilters}
              >
                <Text style={[styles.applyButtonText, { color: theme.buttonText }]}>
                  Apply Filters
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.clearButton, { backgroundColor: theme.background, borderColor: theme.border }]}
                onPress={clearFilters}
              >
                <Text style={[styles.clearButtonText, { color: theme.text }]}>
                  Clear All Filters
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.cancelButton, { backgroundColor: theme.background, borderColor: theme.border }]}
                onPress={() => {
                  setTempFilters(filters);
                  setTempDietaryRestrictionFilter(dietaryRestrictionFilter);
                  setTempAiFilter(aiFilter);
                  setTempCuisineFilter(cuisineFilter);
                  setIsFilterModalVisible(false);
                }}
              >
                <Text style={[styles.cancelButtonText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
      
      <BottomNav /> 
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingTop: 45, // Add top padding to avoid status bar overlap
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  // Enhanced Loading Card
  loadingCard: {
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    maxWidth: '90%',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },

  // Enhanced Error Styles
  errorContainer: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    maxWidth: '90%',
    borderWidth: 2,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    marginTop: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 12,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Error Banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  errorBannerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  errorBannerButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Enhanced Search Bar
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    marginHorizontal: 16,
    gap: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchBar: {
    flex: 1,
    height: 48,
    fontSize: 16,
    fontWeight: '500',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  filterActiveDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Enhanced Create Button
  createMealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  createMealButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },

  // Enhanced Empty State
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyStateCard: {
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
    maxWidth: '100%',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    maxWidth: 280,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyStateButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },

  // Enhanced Meal Cards
  mealItem: {
    flex: 1,
    margin: 8,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    maxWidth: '46%',
  },
  favoriteIcon: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 6,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  aiTag: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  aiTagText: {
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mealPicture: {
    width: "100%",
    height: 140,
    resizeMode: 'cover',
  },
  mealPicturePlaceholder: {
    width: "100%",
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  mealPicturePlaceholderText: {
    fontSize: 12,
    fontWeight: '600',
  },
  mealInfo: {
    padding: 16,
  },
  mealName: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
    lineHeight: 22,
  },
  mealDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
    fontWeight: '500',
  },
  nutritionPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  nutritionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  nutritionText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Enhanced Modals
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    padding: 24,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    flex: 1,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalSubtitle: {
    fontSize: 16,
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  modalButtonContent: {
    flex: 1,
    marginLeft: 16,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  modalButtonSubtext: {
    fontSize: 14,
    fontWeight: '500',
  },
  cancelButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },

  // Filter Modal Styles
  filterRow: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 8,
  },
  applyButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginVertical: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  clearButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginVertical: 4,
    borderWidth: 1,
  },
  clearButtonText: {
    fontWeight: "600",
    fontSize: 16,
  },

  // Grid Layout
  mealsGrid: {
    paddingHorizontal: 8,
    paddingBottom: 100,
  },

  // Usage Info Styles
  usageInfoContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  usageInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  usageInfoTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  usageInfoContent: {
    gap: 8,
  },
  usageInfoText: {
    fontSize: 14,
    fontWeight: '600',
  },
  usageProgressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  usageProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  usageRemainingText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
  },

  // Legacy compatibility
  noMealsText: {
    fontSize: 16,
    textAlign: "center",
  },
});

export default MyMeals;
