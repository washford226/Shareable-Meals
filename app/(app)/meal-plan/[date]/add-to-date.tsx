import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
} from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Meal } from "../../../../types/types";
import { useTheme } from "../../../../context/ThemeContext";
import { useRouter, useLocalSearchParams } from "expo-router";

const BASE_URL =
  Platform.OS === "android" ? "http://10.0.2.2:5000" : "http://localhost:5000";

const AddMealToDate = () => {
  const { theme } = useTheme();
  const router = useRouter();
  const { date } = useLocalSearchParams(); // ✅ receives `[date]` param from folder name

  const [meals, setMeals] = useState<Meal[]>([]);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const fetchMeals = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "Please log in to view meals.");
        return;
      }

      const response = await axios.get(`${BASE_URL}/meal/meals`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (Array.isArray(response.data)) {
        setMeals(response.data);
      } else {
        console.warn("Unexpected meals format:", response.data);
      }
    } catch (error) {
      console.error("Fetch error:", error);
      Alert.alert("Error", "Could not load meals.");
    }
  };

  const addMealToDate = async (mealId: number, mealType: string) => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "Please log in to add meals.");
        return;
      }

      await axios.post(
        `${BASE_URL}/mealplan/meal-plan`,
        { date, meal_id: mealId, meal_type: mealType },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert("Success", "Meal added to your plan.");
      setIsModalVisible(false);
      router.push("/(app)/meal-plan/calendar");
    } catch (error) {
      console.error("Add meal error:", error);
      Alert.alert("Error", "Could not add meal.");
    }
  };

  const handleMealPress = (meal: Meal) => {
    setSelectedMeal(meal);
    setIsModalVisible(true);
  };

  useEffect(() => {
    fetchMeals();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>
        Add Meal to {date}
      </Text>
      <FlatList
        data={meals}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.mealItem, { backgroundColor: theme.card }]}
            onPress={() => handleMealPress(item)}
          >
            <Text style={[styles.mealName, { color: theme.text }]}>
              {item.name}
            </Text>
            <Text style={[styles.mealDescription, { color: theme.subtext }]}>
              {item.description || "No description"}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: theme.subtext }]}>
            No meals available
          </Text>
        }
      />

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
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 16, textAlign: "center" },
  mealItem: { padding: 16, marginBottom: 8, borderRadius: 8 },
  mealName: { fontSize: 16, fontWeight: "bold" },
  mealDescription: { fontSize: 14, marginTop: 4 },
  emptyText: { fontSize: 14, fontStyle: "italic", textAlign: "center", marginTop: 16 },
  button: { padding: 12, borderRadius: 8, alignItems: "center", marginTop: 16 },
  buttonText: { fontSize: 16, fontWeight: "bold" },
  modalContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" },
  modalContent: { width: "80%", borderRadius: 8, padding: 16, alignItems: "center" },
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 16 },
  modalButton: { padding: 12, borderRadius: 8, marginBottom: 8, width: "100%", alignItems: "center" },
  modalButtonText: { fontSize: 16, fontWeight: "bold" },
  cancelButton: { marginTop: 8 },
});

export default AddMealToDate;
