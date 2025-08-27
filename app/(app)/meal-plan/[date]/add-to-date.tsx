import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Image,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { Meal } from "../../../../types/types";
import { useTheme } from "../../../../context/ThemeContext";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "utils/supabase";
import { cachedDataService } from "utils/cachedDataService";
import { isSmallScreen, isExtraSmallScreen } from "../../../../utils/responsiveUtils";

const AddMealToDate = () => {
  const { theme } = useTheme();
  const router = useRouter();
  const { date } = useLocalSearchParams(); // receives `[date]` param from folder name

  const [meals, setMeals] = useState<Meal[]>([]);
  const [filteredMeals, setFilteredMeals] = useState<Meal[]>([]);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [addingMeal, setAddingMeal] = useState(false);

  // Helper function to format date
  const formatDate = (dateString: string | string[]) => {
    try {
      const dateStr = Array.isArray(dateString) ? dateString[0] : dateString;
      return format(new Date(dateStr), "EEEE, MMMM d, yyyy");
    } catch {
      return dateString;
    }
  };

  // Fetch user's meals using cached data service
  const fetchMeals = async (retryCount = 0): Promise<boolean> => {
    try {
      setError(null);
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error("Authentication error:", userError.message);
        setError("Authentication error. Please log in again.");
        return false;
      }
      
      if (!userData?.user) {
        setError("You are not logged in. Please log in to view your meals.");
        return false;
      }
      
      const userId = userData.user.id;

      // Try cached data first for better performance
      try {
        console.log('📱 Trying cached meals for add-to-date...');
        const cachedMeals = await cachedDataService.getUserMeals(userId, false);
        
        if (cachedMeals && cachedMeals.length > 0) {
          console.log(`📱 Using cached meals (${cachedMeals.length} meals)`);
          setMeals(cachedMeals);
          setFilteredMeals(cachedMeals);
          return true;
        }
      } catch (cacheError) {
        console.log('Cache miss, fetching from Supabase:', cacheError);
      }

      // Fallback to direct Supabase query
      console.log('🌐 Fetching meals from Supabase...');
      const { data, error } = await supabase
        .from("meals")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Database error:", error.message);
        
        // Retry logic for network errors
        if (retryCount < 2 && (error.message.includes('network') || error.message.includes('timeout'))) {
          console.log(`Retrying fetchMeals, attempt ${retryCount + 1}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          return fetchMeals(retryCount + 1);
        }
        
        setError("Failed to load your meals. Please try again.");
        return false;
      }

      const mealsData = data || [];
      console.log(`🌐 Loaded ${mealsData.length} meals from Supabase`);
      setMeals(mealsData);
      setFilteredMeals(mealsData);
      return true;
    } catch (error) {
      console.error("Unexpected error:", error);
      
      // Retry logic for unexpected errors
      if (retryCount < 2) {
        console.log(`Retrying fetchMeals, attempt ${retryCount + 1}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchMeals(retryCount + 1);
      }
      
      setError("An unexpected error occurred. Please try again.");
      return false;
    }
  };

  // Add meal to meal plan for the selected date
  const addMealToDate = async (mealId: number, mealType: string) => {
    try {
      setAddingMeal(true);
      setError(null);
      
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error("Authentication error:", userError.message);
        Alert.alert("Error", "Authentication error. Please log in again.");
        return;
      }
      
      if (!userData?.user) {
        Alert.alert("Error", "You are not logged in. Please log in to add meals.");
        return;
      }
      
      const userId = userData.user.id;

      // Validate inputs
      if (!date || !mealId || !mealType) {
        Alert.alert("Error", "Invalid meal or date information.");
        return;
      }

      // Check if meal already exists for this date and type
      const { data: existingMeal, error: checkError } = await supabase
        .from("meal_plan")
        .select("*")
        .eq("user_id", userId)
        .eq("date", date)
        .eq("meal_id", mealId)
        .eq("meal_type", mealType)
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        console.error("Error checking existing meal:", checkError.message);
        Alert.alert("Error", "Failed to verify meal. Please try again.");
        return;
      }

      if (existingMeal) {
        Alert.alert("Info", `This meal is already added to ${mealType.toLowerCase()} for ${formatDate(date)}.`);
        setIsModalVisible(false);
        return;
      }

      // Insert into meal_plan table
      const { error } = await supabase.from("meal_plan").insert([
        {
          user_id: userId,
          date: date,
          meal_id: mealId,
          meal_type: mealType,
        },
      ]);

      if (error) {
        console.error("Insert error:", error.message);
        Alert.alert("Error", `Failed to add meal: ${error.message}`);
        return;
      }

      // Invalidate meal plan cache to ensure fresh data on calendar
      try {
        await cachedDataService.invalidateMealPlanCache(userId);
        console.log('🗑️ Invalidated meal plan cache after adding meal');
      } catch (cacheError) {
        console.warn('Failed to invalidate cache:', cacheError);
        // Don't fail the operation if cache invalidation fails
      }

      Alert.alert(
        "Success", 
        `${selectedMeal?.name} added to ${mealType.toLowerCase()} for ${formatDate(date)}.`,
        [
          {
            text: "Add Another",
            onPress: () => setIsModalVisible(false)
          },
          {
            text: "Back to Calendar",
            onPress: () => {
              setIsModalVisible(false);
              router.push("/(app)/meal-plan/calendar");
            }
          }
        ]
      );
    } catch (error) {
      console.error("Add meal error:", error);
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setAddingMeal(false);
    }
  };

  // Search functionality
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim() === "") {
      setFilteredMeals(meals);
    } else {
      const filtered = meals.filter(meal =>
        meal.name.toLowerCase().includes(query.toLowerCase()) ||
        (meal.description && meal.description.toLowerCase().includes(query.toLowerCase())) ||
        (meal.cuisine && meal.cuisine.toLowerCase().includes(query.toLowerCase()))
      );
      setFilteredMeals(filtered);
    }
  };

  // Refresh function
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchMeals();
    setRefreshing(false);
  };

  // Load data function
  const loadData = async () => {
    setLoading(true);
    await fetchMeals();
    setLoading(false);
  };

  const handleMealPress = (meal: Meal) => {
    if (addingMeal) return; // Prevent interaction while adding
    setSelectedMeal(meal);
    setIsModalVisible(true);
  };

  useEffect(() => {
    if (date) {
      loadData();
    } else {
      setError("No date provided.");
      setLoading(false);
    }
  }, [date]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Top Navigation */}
      <View style={[styles.topNavContainer, { backgroundColor: theme.background }]}>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={[styles.topBackButton, { backgroundColor: theme.card }]}
          onPress={() => router.push("/(app)/meal-plan/calendar")}
        >
          <Ionicons name="close" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.scrollContainer}
      >
      {/* Header Card */}
      <View style={[styles.headerCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.headerContent}>
          <Ionicons name="calendar" size={32} color={theme.primary} />
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: theme.text }]}>
              Add Meal to Plan
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {formatDate(date)}
            </Text>
          </View>
        </View>
      </View>

      {/* Error Banner */}
      {error && (
        <View style={[styles.errorBanner, { backgroundColor: theme.card, borderColor: theme.danger }]}>
          <Ionicons name="warning" size={20} color={theme.danger} />
          <Text style={[styles.errorText, { color: theme.danger }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.danger }]}
            onPress={handleRefresh}
          >
            <Text style={[styles.retryButtonText, { color: theme.buttonText }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search Card */}
      {!loading && meals.length > 0 && (
        <View style={[styles.searchCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.searchHeader}>
            <Ionicons name="search" size={20} color={theme.primary} />
            <Text style={[styles.searchTitle, { color: theme.text }]}>Find Your Meal</Text>
          </View>
          <View style={[styles.searchInputContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Ionicons name="search" size={16} color={theme.placeholder} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search by name, description, or cuisine..."
              placeholderTextColor={theme.placeholder}
              value={searchQuery}
              onChangeText={handleSearch}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => handleSearch("")}>
                <Ionicons name="close-circle" size={16} color={theme.placeholder} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Loading State */}
      {loading ? (
        <View style={[styles.loadingCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text }]}>
            Loading your meals...
          </Text>
        </View>
      ) : (
        <View style={[styles.mealsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.mealsHeader}>
            <Ionicons name="restaurant" size={20} color={theme.primary} />
            <Text style={[styles.mealsTitle, { color: theme.text }]}>
              Your Meals ({filteredMeals.length})
            </Text>
          </View>
          
          <FlatList
            data={filteredMeals}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false}
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
                style={[
                  styles.mealItem, 
                  { 
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                    opacity: addingMeal ? 0.5 : 1
                  }
                ]}
                onPress={() => handleMealPress(item)}
                disabled={addingMeal}
              >
                <View style={styles.mealContent}>
                  {/* Meal Image */}
                  {item.picture && typeof item.picture === "string" ? (
                    <Image 
                      source={{ 
                        uri: item.picture.startsWith('\\x') 
                          ? item.picture.slice(2).match(/.{2}/g)?.map((hex: string) => String.fromCharCode(parseInt(hex, 16))).join('') || ''
                          : item.picture
                      }} 
                      style={styles.mealImage} 
                    />
                  ) : (
                    <View style={[styles.mealImagePlaceholder, { backgroundColor: theme.border }]}>
                      <Ionicons name="image" size={24} color={theme.placeholder} />
                    </View>
                  )}

                  {/* Meal Info */}
                  <View style={styles.mealInfo}>
                    <Text style={[
                      styles.mealName, 
                      { 
                        color: theme.text,
                        fontSize: (isSmallScreen || isExtraSmallScreen) ? 12 : 16
                      }
                    ]}>
                      {item.name}
                    </Text>
                    <Text style={[
                      styles.mealDescription, 
                      { 
                        color: theme.textSecondary,
                        fontSize: (isSmallScreen || isExtraSmallScreen) ? 10 : 14
                      }
                    ]}>
                      {item.description || "No description available"}
                    </Text>
                    
                    <View style={styles.mealMeta}>
                      {item.cuisine && (
                        <View style={[styles.cuisineTag, { backgroundColor: theme.primary + '20', borderColor: theme.primary }]}>
                          <Ionicons name="globe" size={12} color={theme.primary} />
                          <Text style={[
                            styles.cuisineText, 
                            { 
                              color: theme.primary,
                              fontSize: (isSmallScreen || isExtraSmallScreen) ? 9 : 12
                            }
                          ]}>
                            {item.cuisine}
                          </Text>
                        </View>
                      )}
                      
                      <View style={styles.nutritionInfo}>
                        <View style={styles.nutritionItem}>
                          <Ionicons name="flash" size={12} color={theme.textSecondary} />
                          <Text style={[
                            styles.nutritionText, 
                            { 
                              color: theme.textSecondary,
                              fontSize: (isSmallScreen || isExtraSmallScreen) ? 9 : 12
                            }
                          ]}>
                            {item.calories || 0} cal
                          </Text>
                        </View>
                        <View style={styles.nutritionItem}>
                          <Ionicons name="fitness" size={12} color={theme.textSecondary} />
                          <Text style={[
                            styles.nutritionText, 
                            { 
                              color: theme.textSecondary,
                              fontSize: (isSmallScreen || isExtraSmallScreen) ? 9 : 12
                            }
                          ]}>
                            {item.protein || 0}g protein
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                {searchQuery ? (
                  <View style={styles.emptyContent}>
                    <Ionicons name="search" size={48} color={theme.placeholder} />
                    <Text style={[styles.emptyTitle, { color: theme.text }]}>
                      No results found
                    </Text>
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                      No meals found matching &quot;{searchQuery}&quot;
                    </Text>
                    <TouchableOpacity
                      style={[styles.clearSearchButton, { backgroundColor: theme.primary }]}
                      onPress={() => handleSearch("")}
                    >
                      <Text style={[styles.clearSearchText, { color: theme.buttonText }]}>
                        Clear Search
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.emptyContent}>
                    <Ionicons name="restaurant" size={48} color={theme.placeholder} />
                    <Text style={[styles.emptyTitle, { color: theme.text }]}>
                      No meals available
                    </Text>
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                      Create your first meal to add it to your meal plan
                    </Text>
                    <TouchableOpacity
                      style={[styles.createMealButton, { backgroundColor: theme.primary }]}
                      onPress={() => router.push("/(app)/my-meals/create")}
                    >
                      <Ionicons name="add-circle" size={20} color={theme.buttonText} />
                      <Text style={[styles.createMealButtonText, { color: theme.buttonText }]}>
                        Create Your First Meal
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            }
          />
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => router.push("/(app)/meal-plan/calendar")}
        >
          <Ionicons name="arrow-back" size={20} color={theme.text} />
          <Text style={[styles.backButtonText, { color: theme.text }]}>
            Back to Calendar
          </Text>
        </TouchableOpacity>
      </View>

      {/* Enhanced Modal */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Ionicons name="time" size={24} color={theme.primary} />
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  Select Meal Type
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedMeal && (
              <View style={[styles.selectedMealInfo, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <Text style={[styles.selectedMealName, { color: theme.text }]}>
                  {selectedMeal.name}
                </Text>
                <Text style={[styles.selectedMealDescription, { color: theme.textSecondary }]}>
                  Adding to {formatDate(date)}
                </Text>
              </View>
            )}

            <View style={styles.mealTypeContainer}>
              {[
                { type: "Breakfast", icon: "sunny", time: "Morning" },
                { type: "Lunch", icon: "partly-sunny", time: "Afternoon" },
                { type: "Dinner", icon: "moon", time: "Evening" }
              ].map(({ type, icon, time }) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.mealTypeButton, { backgroundColor: theme.background, borderColor: theme.border }]}
                  onPress={() => addMealToDate(Number(selectedMeal!.id), type)}
                  disabled={addingMeal}
                >
                  <View style={styles.mealTypeContent}>
                    <Ionicons name={icon as any} size={24} color={theme.primary} />
                    <View style={styles.mealTypeText}>
                      <Text style={[styles.mealTypeName, { color: theme.text }]}>
                        {type}
                      </Text>
                      <Text style={[styles.mealTypeTime, { color: theme.textSecondary }]}>
                        {time}
                      </Text>
                    </View>
                  </View>
                  {addingMeal ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.modalCancelButton, { backgroundColor: theme.danger }]}
              onPress={() => setIsModalVisible(false)}
              disabled={addingMeal}
            >
              <Ionicons name="close-circle" size={20} color={theme.buttonText} />
              <Text style={[styles.modalCancelText, { color: theme.buttonText }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  // Top Navigation Styles
  topNavContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
    zIndex: 1000,
  },
  topBackButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  scrollContainer: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 32,
  },
  
  // Header Card Styles
  headerCard: {
    marginBottom: 24,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },

  // Search Card Styles
  searchCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },

  // Loading Card Styles
  loadingCard: {
    padding: 32,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },

  // Meals Card Styles
  mealsCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  mealsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  mealsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  // Meal Item Styles
  mealItem: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  mealContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  mealImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealInfo: {
    flex: 1,
  },
  mealName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  mealDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  mealMeta: {
    gap: 8,
  },
  cuisineTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 4,
  },
  cuisineText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  nutritionInfo: {
    flexDirection: 'row',
    gap: 12,
  },
  nutritionItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nutritionText: {
    fontSize: 12,
    marginLeft: 4,
  },

  // Empty State Styles
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  clearSearchButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  clearSearchText: {
    fontSize: 14,
    fontWeight: '500',
  },
  createMealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  createMealButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  // Action Container
  actionContainer: {
    marginTop: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  modalCloseButton: {
    padding: 4,
  },
  selectedMealInfo: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 20,
  },
  selectedMealName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  selectedMealDescription: {
    fontSize: 14,
  },
  mealTypeContainer: {
    gap: 12,
    marginBottom: 20,
  },
  mealTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  mealTypeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  mealTypeText: {
    marginLeft: 12,
  },
  mealTypeName: {
    fontSize: 16,
    fontWeight: '600',
  },
  mealTypeTime: {
    fontSize: 12,
    marginTop: 2,
  },
  modalCancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  // Error Banner Styles
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    marginRight: 12,
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Legacy Styles (for compatibility)
  container: {
    flex: 1,
    padding: 16,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  searchContainer: {
    marginBottom: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  mealImagePlaceholderText: {
    fontSize: 10,
    textAlign: 'center',
  },
  mealCuisine: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  button: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  modalContent: {
    width: "80%",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  modalButton: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    width: "100%",
    alignItems: "center",
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  cancelButton: {
    marginTop: 8,
  },
});

export default AddMealToDate;