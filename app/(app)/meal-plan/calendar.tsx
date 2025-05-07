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
  Image } from "react-native";
import { format, startOfWeek, addDays } from "date-fns";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Meal } from "../../../types/types";
import { useTheme } from "../../../context/ThemeContext";
import  BottomNav from "../../../components/bottomNav"; //B may be uppercase maybe
import { Dimensions } from "react-native";

const BASE_URL = Platform.OS === "android" ? "http://10.0.2.2:5000" : "http://localhost:5000";
const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;

const MealPlanCalendar: React.FC = () => {
  const router = useRouter();
  const today = new Date();
  const { theme } = useTheme();
  const [daysToShow, setDaysToShow] = useState(7);
  const [meals, setMeals] = useState<{ [key: string]: Meal[] }>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 0 });

  const fetchMealsForDate = async (date: string) => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "You are not logged in. Please log in to view your meals.");
        return [];
      }

      const response = await axios.get(`${BASE_URL}/mealplan/meal-plan`, {
        params: { date },
        headers: { Authorization: `Bearer ${token}` },
      });

      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error(`Error fetching meals for date (${date}):`, error);
      return [];
    }
  };

  const fetchMealsForWeek = async (weekStartDate: Date) => {
    const newMeals: { [key: string]: Meal[] } = {};
    for (let i = 0; i < daysToShow; i++) {
      const currentDate = addDays(weekStartDate, i);
      const currentDateString = format(currentDate, "yyyy-MM-dd");
      const mealsForDate = await fetchMealsForDate(currentDateString);
      newMeals[currentDateString] = mealsForDate;
    }
    setMeals((prevMeals) => ({ ...prevMeals, ...newMeals }));
  };

  const deleteAllMealsForDate = async (date: string) => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "You are not logged in.");
        return;
      }

      await axios.delete(`${BASE_URL}/mealplan/meal-plan-clear`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { date },
      });

      Alert.alert("Success", `All meals for ${date} have been deleted.`);
      setMeals((prevMeals) => {
        const updatedMeals = { ...prevMeals };
        delete updatedMeals[date];
        return updatedMeals;
      });
    } catch (error) {
      console.error("Error deleting meals for date:", error);
      Alert.alert("Error", "Failed to delete meals. Try again.");
    }
  };

  useEffect(() => {
    fetchMealsForWeek(startOfCurrentWeek);
  }, [daysToShow]);

  useEffect(() => {
    const todayIndex = Math.floor(
      (today.getTime() - startOfWeek(today, { weekStartsOn: 0 }).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    const dayWidth = SCREEN_WIDTH * 0.95 + 16; // Width of the day container + marginRight
    scrollViewRef.current?.scrollTo({ x: todayIndex * dayWidth, animated: true });
  }, []);

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
    if (selectedDate) {
      router.push(`/(app)/meal-plan/${selectedDate}/add-to-date`);
      setIsModalVisible(false);
    }
  };

  const handleDeleteMeals = () => {
    if (selectedDate) {
      deleteAllMealsForDate(selectedDate);
      setIsModalVisible(false);
    }
  };

  const handleNextWeek = () => {
    setDaysToShow((prev) => prev + 7);
  };

  const handleMealSelect = (meal: Meal) => {
    router.push(`/(app)/meal-plan/${meal.meal_plan_id}/details`);

  };

  const getMealButtonColor = (mealType: string) => {
    const mealTypeKey = mealType.toLowerCase() as keyof typeof theme.mealColors;
    return theme.mealColors[mealTypeKey] || theme.button;
  };

  return (
    <View style={[styles.outerContainer, { backgroundColor: theme.background }]}>
      <ScrollView horizontal style={styles.scrollView} ref={scrollViewRef}>
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
                  { backgroundColor: theme.card },
                  isToday && { borderColor: theme.primary },
                ]}
              >
                <TouchableOpacity onPress={() => handleDatePress(dateString)}>
                  <Text style={[styles.dateLabel, { color: theme.text }]}>
                    {format(currentDate, "EEEE, MMMM d")}
                  </Text>
                </TouchableOpacity>
                <View style={styles.mealsContainer}>
                  <ScrollView>
                  {meals[dateString]?.length > 0 ? (
                    meals[dateString].map((meal, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.mealButton,
                          { backgroundColor: getMealButtonColor(meal.meal_type) },
                        ]}
                        onPress={() => handleMealSelect(meal)}
                      >
                        <View style={styles.mealContent}>
                          {/* Display the meal picture */}
                          {meal.picture && typeof meal.picture === "string" ? (
                            <Image source={{ uri: meal.picture }} style={styles.mealPicture} />
                          ) : (
                            <View style={styles.mealPicturePlaceholder}>
                              <Text style={styles.mealPicturePlaceholderText}>No Image</Text>
                            </View>
                          )}

                          {/* Display the meal name and description */}
                          <View style={styles.mealTextContainer}>
                            <Text style={[styles.mealText, { color: theme.mealText }]}>{meal.name}</Text>
                            <Text style={[styles.mealDescription, { color: theme.subtext }]}>
                              {meal.description}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <Text style={[styles.noMealText, { color: theme.subtext }]}>
                      No meals for this day
                    </Text>
                  )}
                  </ScrollView>
                </View>
                {/* Nutrition Block */}
                {meals[dateString]?.length > 0 && (
                  <View style={[styles.nutritionBlock, { backgroundColor: theme.card }]}>
                    {(() => {
                      const totals = calculateNutritionTotals(meals[dateString]);
                      return (
                        <>
                          <Text style={[styles.nutritionTitle, { color: theme.text }]}>Nutrition Facts</Text>
                          <View style={styles.nutritionRow}>
                            <View style={styles.nutritionColumn}>
                              <Text style={[styles.nutritionLabel, { color: theme.text }]}>Calories</Text>
                              <Text style={[styles.nutritionValue, { color: theme.text }]}>{totals.calories} kcal</Text>
                            </View>
                            <View style={styles.nutritionColumn}>
                              <Text style={[styles.nutritionLabel, { color: theme.text }]}>Protein</Text>
                              <Text style={[styles.nutritionValue, { color: theme.text }]}>{totals.protein} g</Text>
                            </View>
                            <View style={styles.nutritionColumn}>
                              <Text style={[styles.nutritionLabel, { color: theme.text }]}>Carbs</Text>
                              <Text style={[styles.nutritionValue, { color: theme.text }]}>{totals.carbs} g</Text>
                            </View>
                            <View style={styles.nutritionColumn}>
                              <Text style={[styles.nutritionLabel, { color: theme.text }]}>Fat</Text>
                              <Text style={[styles.nutritionValue, { color: theme.text }]}>{totals.fat} g</Text>
                            </View>
                          </View>
                        </>
                      );
                    })()}
                  </View>
                )}
              </View>
            );
          })}

          <TouchableOpacity
            style={[styles.nextWeekButton, { backgroundColor: theme.primary }]}
            onPress={handleNextWeek}
          >
            <Text style={[styles.nextWeekButtonText, { color: theme.buttonText }]}>
              Next Week
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

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
                Delete All Meals on Today
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
    flex: 1 
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
    padding: 8,
    borderWidth: 1,
    borderRadius: 8,
    height: SCREEN_HEIGHT * 0.87,
  },
  dateLabel: { 
    fontSize: 16, 
    fontWeight: "bold", 
    marginBottom: 8, 
    textAlign: "center" 
  },
  mealsContainer: { 
    marginTop: 8, 
    flex: 1,
    paddingBottom: 20,
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
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    width: "80%",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  modalTitle: { 
    fontSize: 18, 
    fontWeight: "bold", 
    marginBottom: 16 
  },
  modalButton: {
    width: "100%",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: "center",
  },
  modalButtonText: { 
    fontSize: 16, 
    fontWeight: "bold" 
  },
  modalCancelButton: {
    width: "100%",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  modalCancelButtonText: { 
    fontSize: 16, 
    fontWeight: "bold" 
  },
  mealDescription: { 
    fontSize: 12, 
    textAlign: "center", 
    marginTop: 4 
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
});

export default MealPlanCalendar;
