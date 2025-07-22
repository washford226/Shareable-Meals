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
} from "react-native";
import { format } from "date-fns";
import { Meal } from "../../../../types/types";
import { useTheme } from "../../../../context/ThemeContext";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "utils/supabase";

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

  // Fetch user's meals from Supabase
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
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>
        Add Meal to {formatDate(date)}
      </Text>

      {/* Error Banner */}
      {error && (
        <View style={[styles.errorBanner, { backgroundColor: theme.danger }]}>
          <Text style={[styles.errorText, { color: theme.buttonText }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRefresh}
          >
            <Text style={[styles.retryButtonText, { color: theme.buttonText }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search Bar */}
      {!loading && meals.length > 0 && (
        <View style={[styles.searchContainer, { backgroundColor: theme.card }]}>
          <TextInput
            style={[styles.searchInput, { color: theme.text, borderColor: theme.border }]}
            placeholder="Search meals by name, description, or cuisine..."
            placeholderTextColor={theme.placeholder}
            value={searchQuery}
            onChangeText={handleSearch}
          />
        </View>
      )}

      {/* Loading State */}
      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text }]}>
            Loading your meals...
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredMeals}
          keyExtractor={(item) => item.id.toString()}
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
                  backgroundColor: theme.card,
                  opacity: addingMeal ? 0.5 : 1
                }
              ]}
              onPress={() => handleMealPress(item)}
              disabled={addingMeal}
            >
              <View style={styles.mealContent}>
                {/* Meal Image */}
                {item.picture && typeof item.picture === "string" ? (
                  <Image source={{ uri: item.picture }} style={styles.mealImage} />
                ) : (
                  <View style={[styles.mealImagePlaceholder, { backgroundColor: theme.border }]}>
                    <Text style={[styles.mealImagePlaceholderText, { color: theme.subtext }]}>
                      No Image
                    </Text>
                  </View>
                )}

                {/* Meal Info */}
                <View style={styles.mealInfo}>
                  <Text style={[styles.mealName, { color: theme.text }]}>
                    {item.name}
                  </Text>
                  <Text style={[styles.mealDescription, { color: theme.subtext }]}>
                    {item.description || "No description available"}
                  </Text>
                  {item.cuisine && (
                    <Text style={[styles.mealCuisine, { color: theme.primary }]}>
                      {item.cuisine}
                    </Text>
                  )}
                  <View style={styles.nutritionInfo}>
                    <Text style={[styles.nutritionText, { color: theme.subtext }]}>
                      {item.calories || 0} cal • {item.protein || 0}g protein
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.centerContent}>
              {searchQuery ? (
                <Text style={[styles.emptyText, { color: theme.subtext }]}>
                  No meals found matching "{searchQuery}"
                </Text>
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: theme.subtext }]}>
                    No meals available
                  </Text>
                  <TouchableOpacity
                    style={[styles.createMealButton, { backgroundColor: theme.primary }]}
                    onPress={() => router.push("/(app)/my-meals/create")}
                  >
                    <Text style={[styles.createMealButtonText, { color: theme.buttonText }]}>
                      Create Your First Meal
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          }
        />
      )}

      {/* Modal */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Select Meal Type
            </Text>
            {["Breakfast", "Lunch", "Dinner"].map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.modalButton, { backgroundColor: theme.primary }]}
                onPress={() => addMealToDate(selectedMeal!.id, type)}
              >
                <Text
                  style={[styles.modalButtonText, { color: theme.buttonText }]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[
                styles.modalButton,
                styles.cancelButton,
                { backgroundColor: theme.danger },
              ]}
              onPress={() => setIsModalVisible(false)}
            >
              <Text style={[styles.modalButtonText, { color: theme.buttonText }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Back Button */}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.primary }]}
        onPress={() => router.back()}
      >
        <Text style={[styles.buttonText, { color: theme.buttonText }]}>
          Back to Calendar
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 16 
  },
  title: { 
    fontSize: 20, 
    fontWeight: "bold", 
    marginBottom: 16, 
    textAlign: "center" 
  },
  errorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
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
  searchInput: {
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 8,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  mealItem: { 
    padding: 16, 
    marginBottom: 8, 
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
  mealImagePlaceholderText: {
    fontSize: 10,
    textAlign: 'center',
  },
  mealInfo: {
    flex: 1,
  },
  mealName: { 
    fontSize: 16, 
    fontWeight: "bold",
    marginBottom: 4,
  },
  mealDescription: { 
    fontSize: 14, 
    marginTop: 4,
    lineHeight: 20,
  },
  mealCuisine: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  nutritionInfo: {
    marginTop: 4,
  },
  nutritionText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  emptyText: { 
    fontSize: 14, 
    fontStyle: "italic", 
    textAlign: "center", 
    marginTop: 16 
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  createMealButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  createMealButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  button: { 
    padding: 12, 
    borderRadius: 8, 
    alignItems: "center", 
    marginTop: 16 
  },
  buttonText: { 
    fontSize: 16, 
    fontWeight: "bold" 
  },
  modalContainer: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center", 
    backgroundColor: "rgba(0,0,0,0.5)" 
  },
  modalContent: { 
    width: "80%", 
    borderRadius: 8, 
    padding: 16, 
    alignItems: "center" 
  },
  modalTitle: { 
    fontSize: 18, 
    fontWeight: "bold", 
    marginBottom: 16 
  },
  modalButton: { 
    padding: 12, 
    borderRadius: 8, 
    marginBottom: 8, 
    width: "100%", 
    alignItems: "center" 
  },
  modalButtonText: { 
    fontSize: 16, 
    fontWeight: "bold" 
  },
  cancelButton: { 
    marginTop: 8 
  },
});

export default AddMealToDate;