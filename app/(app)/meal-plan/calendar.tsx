import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  ScrollView,
  Modal,
  Image,
  ActivityIndicator,
  RefreshControl
} from "react-native";
import { format, startOfWeek, addDays } from "date-fns";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Meal } from "../../../types/types";
import { useTheme } from "../../../context/ThemeContext";
import BottomNav from "../../../components/bottomNav";
import { Dimensions } from "react-native";
import { supabase } from "utils/supabase";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;

const MealPlanCalendar: React.FC = () => {
  const router = useRouter();
  const today = new Date();
  const { theme } = useTheme();
  const [daysToShow, setDaysToShow] = useState(7);
  const [meals, setMeals] = useState<{ [key: string]: Meal[] }>({});
  const [loadingDates, setLoadingDates] = useState<{ [key: string]: boolean }>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);

  const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 0 });

  const getCurrentUserId = async (): Promise<string | null> => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error("Error getting user:", error.message);
        setError("Authentication error. Please log in again.");
        return null;
      }
      if (!data?.user) {
        setError("You are not logged in. Please log in to view your meals.");
        return null;
      }
      return data.user.id;
    } catch (error) {
      console.error("Unexpected error getting user:", error);
      setError("An unexpected error occurred. Please try again.");
      return null;
    }
  };

  const fetchMealsForDate = async (date: string, retryCount = 0): Promise<Meal[]> => {
    try {
      // Set loading state for this date
      setLoadingDates(prev => ({ ...prev, [date]: true }));
      
      const userId = await getCurrentUserId();
      if (!userId) {
        setLoadingDates(prev => ({ ...prev, [date]: false }));
        return [];
      }

      // Fetch meal plan entries with full meal details
      const { data, error } = await supabase
        .from("meal_plan")
        .select(`
          *,
          meals (
            id,
            name,
            description,
            calories,
            protein,
            carbohydrates,
            fat,
            picture,
            instructions,
            recipeLink,
            created_at,
            created_by_ai,
            favorite,
            dietary_restrictions,
            servings,
            cuisine,
            visibility,
            created_by
          )
        `)
        .eq("user_id", userId)
        .eq("date", date);

      if (error) {
        console.error(`Error fetching meals for date (${date}):`, error.message);
        
        // Retry logic for network errors
        if (retryCount < 2 && (error.message.includes('network') || error.message.includes('timeout'))) {
          console.log(`Retrying fetch for ${date}, attempt ${retryCount + 1}`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          return fetchMealsForDate(date, retryCount + 1);
        }
        
        setError(`Failed to load meals for ${date}. Please try refreshing.`);
        setLoadingDates(prev => ({ ...prev, [date]: false }));
        return [];
      }

      // Transform the data to match the expected Meal interface
      const transformedMeals = data?.map(entry => ({
        id: entry.meals?.id || entry.meal_id,
        name: entry.meals?.name || "Unknown Meal",
        description: entry.meals?.description || "",
        calories: entry.meals?.calories || 0,
        protein: entry.meals?.protein || 0,
        carbohydrates: entry.meals?.carbohydrates || 0,
        fat: entry.meals?.fat || 0,
        picture: entry.meals?.picture || null,
        meal_type: entry.meal_type || "Other", // Get meal_type from meal_plan table
        userName: entry.meals?.created_by || "",
        visibility: entry.meals?.visibility || false,
        averageRating: 0, // Not stored in database
        reviewCount: 0, // Not stored in database
        meal_plan_id: entry.meal_plan_id,
        instructions: entry.meals?.instructions || "",
        recipeLink: entry.meals?.recipeLink || "",
        created_at: entry.meals?.created_at || "",
        created_by_ai: entry.meals?.created_by_ai || false,
        favorite: entry.meals?.favorite || false,
        dietary_restrictions: entry.meals?.dietary_restrictions || "",
        servings: entry.meals?.servings || 1,
        cuisine: entry.meals?.cuisine || ""
      })) || [];

      // Clear loading state for this date
      setLoadingDates(prev => ({ ...prev, [date]: false }));
      setError(null); // Clear any previous errors
      return transformedMeals;
    } catch (error) {
      console.error(`Unexpected error fetching meals for date (${date}):`, error);
      
      // Retry logic for unexpected errors
      if (retryCount < 2) {
        console.log(`Retrying fetch for ${date}, attempt ${retryCount + 1}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchMealsForDate(date, retryCount + 1);
      }
      
      setError(`An unexpected error occurred loading meals for ${date}.`);
      setLoadingDates(prev => ({ ...prev, [date]: false }));
      return [];
    }
  };

  const fetchMealsForWeek = async (weekStartDate: Date, isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsInitialLoading(true);
      }
      
      const newMeals: { [key: string]: Meal[] } = {};
      const fetchPromises = [];
      
      for (let i = 0; i < daysToShow; i++) {
        const currentDate = addDays(weekStartDate, i);
        const currentDateString = format(currentDate, "yyyy-MM-dd");
        fetchPromises.push(
          fetchMealsForDate(currentDateString).then(mealsForDate => {
            newMeals[currentDateString] = mealsForDate;
          })
        );
      }
      
      await Promise.all(fetchPromises);
      setMeals((prevMeals) => ({ ...prevMeals, ...newMeals }));
      setError(null); // Clear any errors on successful fetch
    } catch (error) {
      console.error("Error fetching meals for week:", error);
      setError("Failed to load meal plan. Please try again.");
    } finally {
      setIsRefreshing(false);
      setIsInitialLoading(false);
    }
  };

  const handleRefresh = async () => {
    await fetchMealsForWeek(startOfCurrentWeek, true);
  };

  const deleteAllMealsForDate = async (date: string) => {
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        Alert.alert("Error", "You are not logged in. Please log in to continue.");
        return;
      }

      // Show confirmation dialog
      Alert.alert(
        "Confirm Delete",
        `Are you sure you want to delete all meals for ${format(new Date(date), "EEEE, MMMM d")}?`,
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                const { error } = await supabase
                  .from("meal_plan")
                  .delete()
                  .eq("user_id", userId)
                  .eq("date", date);

                if (error) {
                  console.error("Error deleting meals:", error.message);
                  Alert.alert("Error", `Failed to delete meals: ${error.message}`);
                  return;
                }

                Alert.alert("Success", `All meals for ${format(new Date(date), "EEEE, MMMM d")} have been deleted.`);
                setMeals((prevMeals) => {
                  const updatedMeals = { ...prevMeals };
                  updatedMeals[date] = []; // Set to empty array instead of deleting
                  return updatedMeals;
                });
              } catch (error) {
                console.error("Unexpected error deleting meals:", error);
                Alert.alert("Error", "An unexpected error occurred. Please try again.");
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error("Error in deleteAllMealsForDate:", error);
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    }
  };

  useEffect(() => {
    fetchMealsForWeek(startOfCurrentWeek);
  }, []); // Only run on mount

  useEffect(() => {
    if (daysToShow > 7) {
      // Only fetch new data when extending beyond initial week
      const newWeekStart = addDays(startOfCurrentWeek, daysToShow - 7);
      fetchMealsForWeek(newWeekStart);
    }
  }, [daysToShow]);

  // Auto-scroll to today's date after initial loading is complete
  useEffect(() => {
    if (!isInitialLoading) {
      const todayIndex = Math.floor(
        (today.getTime() - startOfWeek(today, { weekStartsOn: 0 }).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      const dayWidth = SCREEN_WIDTH * 0.95 + 16; // Width of the day container + marginRight
      
      // Add a small delay to ensure the ScrollView has rendered properly
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ 
          x: todayIndex * dayWidth, 
          animated: true 
        });
      }, 300);
    }
  }, [isInitialLoading]);

  const handleDatePress = (date: string) => {
    setSelectedDate(date);
    setIsModalVisible(true);
  };

  const calculateNutritionTotals = (mealsForDay: Meal[]) => {
    return mealsForDay.reduce(
      (totals, meal) => {
        return {
          calories: totals.calories + (meal.calories || 0),
          protein: totals.protein + (meal.protein || 0),
          carbs: totals.carbs + (meal.carbohydrates || 0),
          fat: totals.fat + (meal.fat || 0),
        };
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  };

  const handleAddMeal = () => {
    try {
      if (selectedDate) {
        router.push(`/(app)/meal-plan/${selectedDate}/add-to-date`);
        setIsModalVisible(false);
      } else {
        Alert.alert("Error", "No date selected. Please try again.");
      }
    } catch (error) {
      console.error("Error navigating to add meal:", error);
      Alert.alert("Error", "Failed to open add meal screen. Please try again.");
    }
  };

  const handleDeleteMeals = () => {
    try {
      if (selectedDate) {
        deleteAllMealsForDate(selectedDate);
        setIsModalVisible(false);
      } else {
        Alert.alert("Error", "No date selected. Please try again.");
      }
    } catch (error) {
      console.error("Error in handleDeleteMeals:", error);
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    }
  };

  const handleNextWeek = async () => {
    try {
      if (isRefreshing || isInitialLoading) {
        return; // Prevent multiple requests
      }
      
      const newDaysToShow = daysToShow + 7;
      setDaysToShow(newDaysToShow);
      
      // Fetch meals for the new week
      const newWeekStart = addDays(startOfCurrentWeek, daysToShow);
      const newMeals: { [key: string]: Meal[] } = {};
      
      for (let i = 0; i < 7; i++) {
        const currentDate = addDays(newWeekStart, i);
        const currentDateString = format(currentDate, "yyyy-MM-dd");
        if (!meals[currentDateString]) {
          const mealsForDate = await fetchMealsForDate(currentDateString);
          newMeals[currentDateString] = mealsForDate;
        }
      }
      
      if (Object.keys(newMeals).length > 0) {
        setMeals((prevMeals) => ({ ...prevMeals, ...newMeals }));
      }
    } catch (error) {
      console.error("Error loading next week:", error);
      setError("Failed to load next week. Please try again.");
    }
  };

  const handleMealSelect = (meal: Meal) => {
    try {
      if (!meal?.meal_plan_id) {
        Alert.alert("Error", "Invalid meal data. Please try refreshing the calendar.");
        return;
      }
      // Navigate to the meal plan details using the meal_plan_id
      router.push(`/(app)/meal-plan/${meal.meal_plan_id}/details`);
    } catch (error) {
      console.error("Error navigating to meal details:", error);
      Alert.alert("Error", "Failed to open meal details. Please try again.");
    }
  };

  const getMealButtonColor = (mealType: string) => {
    const mealTypeKey = mealType.toLowerCase() as keyof typeof theme.mealColors;
    return theme.mealColors[mealTypeKey] || theme.button;
  };

  return (
    <View style={[styles.outerContainer, { backgroundColor: theme.background }]}>
      {/* Error Banner */}
      {error && (
        <View style={[styles.errorBanner, { backgroundColor: theme.dangerLight, borderColor: theme.danger }]}>
          <View style={styles.errorContent}>
            <Text style={[styles.errorIcon, { color: theme.danger }]}>⚠️</Text>
            <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
          </View>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.danger }]}
            onPress={handleRefresh}
          >
            <Text style={[styles.retryButtonText, { color: theme.buttonTextPrimary }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Compact Header */}
      <View style={[styles.headerContainer, { backgroundColor: theme.card, shadowColor: theme.shadow }]}>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[styles.headerButton, styles.groceryButton, { 
              backgroundColor: theme.successLight, 
              borderColor: theme.success 
            }]}
            onPress={() => router.push("./grocery-list")}
          >
            <Text style={[styles.headerButtonIcon, { color: theme.success }]}>🛒</Text>
            <Text style={[styles.headerButtonText, { color: theme.success }]}>Grocery List</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, styles.pantryButton, { 
              backgroundColor: theme.primaryLight, 
              borderColor: theme.primary 
            }]}
            onPress={() => router.push("/pantry/pantry")}
          >
            <Text style={[styles.headerButtonIcon, { color: theme.primary }]}>🏠</Text>
            <Text style={[styles.headerButtonText, { color: theme.primary }]}>Pantry</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Loading Indicator for Initial Load */}
      {isInitialLoading ? (
        <View style={styles.initialLoadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading your meal plan...</Text>
        </View>
      ) : (
        <ScrollView 
          horizontal 
          style={styles.scrollView} 
          ref={scrollViewRef}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[theme.primary]}
              tintColor={theme.primary}
            />
          }
        >
          <View style={styles.container}>
          {Array.from({ length: daysToShow }).map((_, i) => {
            const currentDate = addDays(startOfCurrentWeek, i);
            const dateString = format(currentDate, "yyyy-MM-dd");
            const isToday = format(currentDate, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
            return (
              <View
                key={dateString}
                style={[
                  styles.dayContainer,
                  { 
                    backgroundColor: theme.card,
                    borderColor: isToday ? theme.primary : theme.border,
                    shadowColor: theme.shadow,
                  },
                  isToday && styles.todayContainer,
                ]}
              >
                {/* Enhanced Date Header */}
                <TouchableOpacity 
                  style={[styles.dateHeader, isToday && { backgroundColor: theme.primaryLight }]}
                  onPress={() => handleDatePress(dateString)}
                  accessibilityLabel={`Options for ${format(currentDate, "EEEE, MMMM d")}`}
                  accessibilityHint="Tap to add or delete meals for this date"
                >
                  <View style={styles.dateHeaderContent}>
                    <Text style={[styles.dayName, { color: isToday ? theme.primary : theme.text }]}>
                      {format(currentDate, "EEEE")}
                    </Text>
                    <Text style={[styles.dateNumber, { color: isToday ? theme.primary : theme.text }]}>
                      {format(currentDate, "MMM d")}
                    </Text>
                    {isToday && (
                      <View style={[styles.todayBadge, { backgroundColor: theme.primary }]}>
                        <Text style={[styles.todayText, { color: theme.buttonTextPrimary }]}>Today</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.optionsHint, { color: theme.textSecondary }]}>
                    Tap for options
                  </Text>
                </TouchableOpacity>
                <View style={styles.mealsContainer}>
                  <ScrollView contentContainerStyle={styles.mealsScrollContent}>
                  {loadingDates[dateString] ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color={theme.primary} />
                      <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading meals...</Text>
                    </View>
                  ) : meals[dateString]?.length > 0 ? (
                    meals[dateString].map((meal, index) => (
                      <TouchableOpacity
                        key={`${meal.id}-${index}`}
                        style={[
                          styles.mealCard,
                          { 
                            backgroundColor: theme.mealColors[meal.meal_type.toLowerCase() as keyof typeof theme.mealColors] || theme.card,
                            borderColor: theme.mealAccent[meal.meal_type.toLowerCase() as keyof typeof theme.mealAccent] || theme.border,
                            shadowColor: theme.shadow,
                          },
                        ]}
                        onPress={() => handleMealSelect(meal)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.mealCardContent}>
                          {/* Meal Type Badge */}
                          <View style={[styles.mealTypeBadge, { 
                            backgroundColor: theme.mealAccent[meal.meal_type.toLowerCase() as keyof typeof theme.mealAccent] || theme.primary 
                          }]}>
                            <Text style={[styles.mealTypeBadgeText, { color: theme.buttonTextPrimary }]}>
                              {meal.meal_type}
                            </Text>
                          </View>

                          {/* Meal Image */}
                          <View style={styles.mealImageContainer}>
                            {meal.picture && typeof meal.picture === "string" ? (
                              <Image source={{ uri: meal.picture }} style={styles.mealImage} />
                            ) : (
                              <View style={[styles.mealImagePlaceholder, { backgroundColor: theme.divider }]}>
                                <Text style={[styles.mealImagePlaceholderText, { color: theme.textSecondary }]}>🍽️</Text>
                              </View>
                            )}
                          </View>

                          {/* Meal Info */}
                          <View style={styles.mealInfo}>
                            <Text style={[styles.mealName, { color: theme.text }]} numberOfLines={2}>
                              {meal.name || "Unknown Meal"}
                            </Text>
                            <Text style={[styles.mealDescription, { color: theme.textSecondary }]} numberOfLines={2}>
                              {meal.description || "No description available"}
                            </Text>
                            {/* Nutrition Preview */}
                            <View style={styles.nutritionPreview}>
                              <Text style={[styles.nutritionPreviewText, { color: theme.textSecondary }]}>
                                {meal.calories || 0} cal • {meal.protein || 0}g protein
                              </Text>
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))
                  ) : meals[dateString] !== undefined ? (
                    <View style={styles.emptyMealsContainer}>
                      <Text style={[styles.emptyMealsIcon, { color: theme.textSecondary }]}>🍽️</Text>
                      <Text style={[styles.emptyMealsText, { color: theme.textSecondary }]}>
                        No meals planned
                      </Text>
                      <Text style={[styles.emptyMealsSubtext, { color: theme.textSecondary }]}>
                        Tap the date to add meals
                      </Text>
                    </View>
                  ) : null}
                  </ScrollView>
                </View>
                {/* Enhanced Nutrition Block */}
                <TouchableOpacity
                  style={[styles.nutritionBlock, { 
                    backgroundColor: theme.card,
                    shadowColor: theme.shadow,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 8,
                    elevation: 3,
                  }]}
                  activeOpacity={0.8}
                  onPress={() => router.push({ pathname: "/(app)/meal-plan/[date]/daynutrition", params: { date: dateString } })}
                >
                  {(() => {
                    const totals = meals[dateString]?.length > 0
                      ? calculateNutritionTotals(meals[dateString])
                      : { calories: 0, protein: 0, carbs: 0, fat: 0 };
                    const hasNutrition = totals.calories > 0;
                    return (
                      <>
                        <View style={styles.nutritionHeader}>
                          <Text style={[styles.nutritionTitle, { color: theme.text }]}>
                            Daily Nutrition
                          </Text>
                          <Text style={[styles.nutritionSubtitle, { color: theme.textSecondary }]}>
                            Tap for details
                          </Text>
                        </View>
                        <View style={styles.nutritionRow}>
                          <View style={[styles.nutritionColumn, styles.caloriesColumn]}>
                            <Text style={[styles.nutritionValue, { color: theme.primary, fontSize: 20, fontWeight: '800' }]}>
                              {totals.calories}
                            </Text>
                            <Text style={[styles.nutritionLabel, { color: theme.textSecondary }]}>calories</Text>
                          </View>
                          <View style={styles.nutritionDivider} />
                          <View style={styles.macrosContainer}>
                            <View style={styles.macroItem}>
                              <Text style={[styles.macroValue, { color: theme.text }]}>{totals.protein}g</Text>
                              <Text style={[styles.macroLabel, { color: theme.protein }]}>Protein</Text>
                            </View>
                            <View style={styles.macroItem}>
                              <Text style={[styles.macroValue, { color: theme.text }]}>{totals.carbs}g</Text>
                              <Text style={[styles.macroLabel, { color: theme.carbs }]}>Carbs</Text>
                            </View>
                            <View style={styles.macroItem}>
                              <Text style={[styles.macroValue, { color: theme.text }]}>{totals.fat}g</Text>
                              <Text style={[styles.macroLabel, { color: theme.fat }]}>Fat</Text>
                            </View>
                          </View>
                        </View>
                        {!hasNutrition && (
                          <View style={styles.emptyNutritionContainer}>
                            <Text style={[styles.emptyNutritionText, { color: theme.textSecondary }]}>
                              📊 Add meals to see nutrition data
                            </Text>
                          </View>
                        )}
                      </>
                    );
                  })()}
                </TouchableOpacity>
              
              </View>
            );
          })}

          <TouchableOpacity
            style={[
              styles.nextWeekButton, 
              { backgroundColor: theme.primary },
              (isRefreshing || isInitialLoading) && { opacity: 0.6 }
            ]}
            onPress={handleNextWeek}
            disabled={isRefreshing || isInitialLoading}
            accessibilityLabel="Load next week"
            accessibilityHint="Tap to load more days in your meal plan"
          >
            {isRefreshing || isInitialLoading ? (
              <ActivityIndicator size="small" color={theme.buttonText} />
            ) : (
              <Text style={[styles.nextWeekButtonText, { color: theme.buttonText }]}>
                Next Week
              </Text>
            )}
          </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      <Modal visible={isModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Options for {selectedDate}
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: theme.primary }]}
              onPress={handleAddMeal}
            >
              <Text style={[styles.modalButtonText, { color: theme.buttonText }]}>
                Add Meal to Calendar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: theme.danger }]}
              onPress={handleDeleteMeals}
            >
              <Text style={[styles.modalButtonText, { color: theme.buttonText }]}>
                Delete All Meals for This Date
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalCancelButton, { backgroundColor: theme.border }]}
              onPress={() => setIsModalVisible(false)}
            >
              <Text style={[styles.modalCancelButtonText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <BottomNav />
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: { 
    flex: 1,
    paddingTop: 20, // Add top padding to avoid status bar overlap
  },
  errorBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  errorContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  headerButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  headerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 2,
    gap: 8,
  },
  headerButtonIcon: {
    fontSize: 20,
  },
  headerButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  initialLoadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
groceryButton: {
  padding: 12,
  borderRadius: 8,
},
groceryButtonText: {
  fontSize: 16,
  fontWeight: "bold",
},
pantryButton: {
  padding: 12,
  borderRadius: 8,
},
pantryButtonText: {
  fontSize: 16,
  fontWeight: "bold",
},
  nutritionBlock: {
    position: "absolute", // Make the block absolute
    bottom: 0, // Anchor it to the bottom of the container
    left: 0, // Align it to the left
    right: 0, // Align it to the right
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  nutritionRow: {
    flexDirection: "row", // Arrange columns horizontally
    justifyContent: "space-between", // Space out the columns evenly
  },
  nutritionColumn: {
    alignItems: "center", // Center the text in each column
    flex: 1, // Ensure equal width for each column
  },
  nutritionLabel: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 4, // Add spacing between the label and the value
  },
  nutritionValue: {
    fontSize: 16,
    fontWeight: "bold",
  },
  nutritionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8, // Add spacing between the title and the nutrition rows
  },
  nutritionHeader: {
    marginBottom: 16,
    alignItems: 'center',
  },
  nutritionSubtitle: {
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
  },
  caloriesColumn: {
    flex: 2,
    alignItems: 'center',
    paddingRight: 16,
  },
  nutritionDivider: {
    width: 1,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 16,
    alignSelf: 'stretch',
  },
  macrosContainer: {
    flex: 3,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  macroItem: {
    alignItems: 'center',
    flex: 1,
  },
  macroValue: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  macroLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyNutritionContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    alignItems: 'center',
  },
  emptyNutritionText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  createMealButtonContainer: { 
    alignItems: "center", 
    marginVertical: 16 
  },
  createMealButton: { 
    padding: 12, 
    borderRadius: 8 
  },
  createMealButtonText: { 
    fontSize: 16, 
    fontWeight: "bold" 
  },
  mealContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 8,
  },
  scrollView: { 
    flex: 1 
  },
  container: { 
    flexDirection: "row", 
    padding: 16 
  },
  mealPicture: {
    width: 150,
    height: 150,
    borderRadius: 8,
    resizeMode: "cover",
    marginLeft: 3,
  },
  mealPicturePlaceholder: {
    width: 150,
    height: 150,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ccc",
    borderRadius: 8,
    marginLeft: 3,
  },
  mealPicturePlaceholderText: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
  },
  dayContainer: {
    width: SCREEN_WIDTH * 0.95,
    marginRight: 16,
    padding: 0,
    borderWidth: 2,
    borderRadius: 20,
    height: SCREEN_HEIGHT * 0.75,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    overflow: 'hidden',
  },
  todayContainer: {
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  dateHeader: {
    padding: 16,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  dateHeaderContent: {
    alignItems: 'center',
    marginBottom: 8,
  },
  dayName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  dateNumber: {
    fontSize: 16,
    fontWeight: '600',
  },
  todayBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  todayText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  optionsHint: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  dateLabel: { 
    fontSize: 16, 
    fontWeight: "bold", 
    marginBottom: 8, 
    textAlign: "center" 
  },
  mealsContainer: { 
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  mealsScrollContent: {
    paddingBottom: 100, // Space for nutrition block
  },
  mealCard: {
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  mealCardContent: {
    position: 'relative',
  },
  mealTypeBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  mealTypeBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  mealImageContainer: {
    height: 120,
    width: '100%',
  },
  mealImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  mealImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealImagePlaceholderText: {
    fontSize: 32,
  },
  mealInfo: {
    padding: 12,
  },
  mealName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  mealDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  nutritionPreview: {
    marginTop: 4,
  },
  nutritionPreviewText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyMealsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyMealsIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyMealsText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptyMealsSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  mealButton: { 
    padding: 12, 
    borderRadius: 8, 
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "#ccc",
  },
  mealText: { 
    fontSize: 14, 
    textAlign: "center" 
  },
  noMealText: { 
    fontSize: 12, 
    fontStyle: "italic", 
    textAlign: "center" 
  },
  nextWeekButton: {
    width: 150,
    marginLeft: 16,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  nextWeekButtonText: { 
    fontSize: 16, 
    fontWeight: "bold", 
    textAlign: "center" 
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    padding: 20,
  },
  modalContent: {
    width: "90%",
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: { 
    fontSize: 20, 
    fontWeight: "800", 
    marginBottom: 8,
    textAlign: 'center',
  },
  modalButton: {
    width: "100%",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: "center",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  modalButtonText: { 
    fontSize: 16, 
    fontWeight: "700" 
  },
  modalCancelButton: {
    width: "100%",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 2,
    marginTop: 8,
  },
  modalCancelButtonText: { 
    fontSize: 16, 
    fontWeight: "600" 
  },
  mealTypeText: {
    fontSize: 10,
    textAlign: "center",
    marginTop: 2,
    fontWeight: "bold",
  },
  mealTextContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  nutritionText: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 4,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    marginVertical: 16,
  },
  loadingText: {
    fontSize: 14,
    fontStyle: "italic",
    textAlign: "center",
  },
});

export default MealPlanCalendar;
