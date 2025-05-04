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
} from "react-native";
import { format, startOfWeek, addDays } from "date-fns";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Meal } from "../../../types/types";
import { useTheme } from "../../../context/ThemeContext";
import  BottomNav from "../../../components/bottomNav"; //B may be uppercase maybe

const BASE_URL = Platform.OS === "android" ? "http://10.0.2.2:5000" : "http://localhost:5000";

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

      const response = await axios.get(`${BASE_URL}/meal-plan`, {
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

      await axios.delete(`${BASE_URL}/meal-plan-clear`, {
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
    scrollViewRef.current?.scrollTo({ x: todayIndex * 166, animated: true });
  }, []);

  const handleDatePress = (date: string) => {
    setSelectedDate(date);
    setIsModalVisible(true);
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
    router.push(`/my-meals/${meal.id}/info`);

  };

  const getMealButtonColor = (mealType: string) => {
    const mealTypeKey = mealType.toLowerCase() as keyof typeof theme.mealColors;
    return theme.mealColors[mealTypeKey] || theme.button;
  };

  return (
    <View style={[styles.outerContainer, { backgroundColor: theme.background }]}>
      <View style={styles.createMealButtonContainer}>
        <TouchableOpacity
          style={[styles.createMealButton, { backgroundColor: theme.primary }]}
          onPress={() => router.push("/my-meals/create")}
        >
          <Text style={[styles.createMealButtonText, { color: theme.buttonText }]}>
            Create Meal
          </Text>
        </TouchableOpacity>
      </View>

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
                        <Text style={[styles.mealText, { color: theme.mealText }]}>
                          {meal.name}
                        </Text>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <Text style={[styles.noMealText, { color: theme.subtext }]}>
                      No meals for this day
                    </Text>
                  )}
                </View>
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
  outerContainer: { flex: 1 },
  createMealButtonContainer: { alignItems: "center", marginVertical: 16 },
  createMealButton: { padding: 12, borderRadius: 8 },
  createMealButtonText: { fontSize: 16, fontWeight: "bold" },
  scrollView: { flex: 1 },
  container: { flexDirection: "row", padding: 16 },
  dayContainer: {
    width: 200,
    marginRight: 16,
    padding: 8,
    borderWidth: 1,
    borderRadius: 8,
  },
  dateLabel: { fontSize: 16, fontWeight: "bold", marginBottom: 8, textAlign: "center" },
  mealsContainer: { marginTop: 8 },
  mealButton: { padding: 12, borderRadius: 8, marginBottom: 8 },
  mealText: { fontSize: 14, textAlign: "center" },
  noMealText: { fontSize: 12, fontStyle: "italic", textAlign: "center" },
  nextWeekButton: {
    width: 150,
    marginLeft: 16,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  nextWeekButtonText: { fontSize: 16, fontWeight: "bold", textAlign: "center" },
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
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 16 },
  modalButton: {
    width: "100%",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: "center",
  },
  modalButtonText: { fontSize: 16, fontWeight: "bold" },
  modalCancelButton: {
    width: "100%",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  modalCancelButtonText: { fontSize: 16, fontWeight: "bold" },
});

export default MealPlanCalendar;
