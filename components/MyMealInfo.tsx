import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  Platform,
  Switch,
  TouchableOpacity,
  Modal,
} from "react-native";
import { Meal } from "@/types/types";
import { useTheme } from "@/context/ThemeContext";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Picker } from "@react-native-picker/picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format } from "date-fns";

interface MyMealInfoProps {
  meal: Meal;
  onBack: () => void;
}

const BASE_URL = Platform.OS === "android" ? "http://10.0.2.2:5000" : "http://localhost:5000";

const MyMealInfo: React.FC<MyMealInfoProps> = ({ meal, onBack }) => {
  const { theme } = useTheme();

  const [isEditing, setIsEditing] = useState(false);
  const [editedMeal, setEditedMeal] = useState<Meal>({ ...meal });
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [mealType, setMealType] = useState("Breakfast");
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleAddToMealPlan = async () => {
    if (!selectedDate) {
      Alert.alert("Error", "Please select a date.");
      return;
    }

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "User not authenticated. Please log in.");
        return;
      }

      const response = await axios.post(
        `${BASE_URL}/meal-plan`,
        {
          meal_id: meal.id,
          date: selectedDate,
          meal_type: mealType,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.status === 201) {
        Alert.alert("Success", "Meal added to the meal plan!");
        setIsModalVisible(false);
        setSelectedDate("");
        setMealType("Breakfast");
      }
    } catch (error) {
      console.error("Error adding meal to meal plan:", error);
      Alert.alert("Error", "Failed to add meal to the meal plan. Please try again later.");
    }
  };

  const handleDateSelection = (date: Date) => {
    const formattedDate = format(date, "yyyy-MM-dd"); // Ensure consistent formatting
    setSelectedDate(formattedDate);
  };

  const confirmDelete = () => {
    Alert.alert(
      "Confirm Deletion",
      "Are you sure you want to delete this meal? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: handleDelete },
      ]
    );
  };

  const handleDelete = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "User not authenticated. Please log in.");
        return;
      }

      const response = await axios.delete(`${BASE_URL}/meals/${meal.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 200) {
        Alert.alert("Success", "Meal deleted successfully!");
        onBack();
      }
    } catch (error) {
      console.error("Error deleting meal:", error);
      Alert.alert("Error", "Failed to delete meal. Please try again later.");
    }
  };

  const handleSave = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "User not authenticated. Please log in.");
        return;
      }
  
      const response = await axios.put(
        `${BASE_URL}/meals/${editedMeal.id}`,
        editedMeal,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
  
      if (response.status === 200) {
        Alert.alert("Success", "Meal updated successfully!");
        setIsEditing(false);
        fetchUpdatedMeal(); // Refresh the meal information
      }
    } catch (error) {
      console.error("Error saving meal:", error);
      Alert.alert("Error", "Failed to save meal. Please try again later.");
    }
  };

  const fetchUpdatedMeal = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "User not authenticated. Please log in.");
        return;
      }
  
      const response = await axios.get(`${BASE_URL}/meals/${meal.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
  
      if (response.status === 200) {
        setEditedMeal(response.data); // Update the editedMeal state with the latest data
      }
    } catch (error) {
      console.error("Error fetching updated meal:", error);
      Alert.alert("Error", "Failed to refresh meal information. Please try again later.");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {isEditing ? (
        <>
          {/* Editing UI */}
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.text }]}
            value={editedMeal.name}
            onChangeText={(text) => setEditedMeal({ ...editedMeal, name: text })}
            placeholder="Meal Name"
            placeholderTextColor={theme.placeholder}
          />
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.text }]}
            value={editedMeal.description}
            onChangeText={(text) => setEditedMeal({ ...editedMeal, description: text })}
            placeholder="Description"
            placeholderTextColor={theme.placeholder}
          />
          <TextInput
            style={[styles.ingredientsInput, { borderColor: theme.border, color: theme.text }]}
            value={editedMeal.ingredients}
            onChangeText={(text) => setEditedMeal({ ...editedMeal, ingredients: text })}
            placeholder="Ingredients"
            placeholderTextColor={theme.placeholder}
            multiline={true}
            numberOfLines={4}
          />
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.text }]}
            value={editedMeal.calories.toString()}
            onChangeText={(text) => setEditedMeal({ ...editedMeal, calories: parseInt(text) || 0 })}
            placeholder="Calories"
            placeholderTextColor={theme.placeholder}
            keyboardType="numeric"
          />
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.text }]}
            value={editedMeal.protein.toString()}
            onChangeText={(text) => setEditedMeal({ ...editedMeal, protein: parseFloat(text) || 0 })}
            placeholder="Protein (g)"
            placeholderTextColor={theme.placeholder}
            keyboardType="numeric"
          />
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.text }]}
            value={editedMeal.carbohydrates.toString()}
            onChangeText={(text) =>
              setEditedMeal({ ...editedMeal, carbohydrates: parseFloat(text) || 0 })
            }
            placeholder="Carbs (g)"
            placeholderTextColor={theme.placeholder}
            keyboardType="numeric"
          />
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.text }]}
            value={editedMeal.fat.toString()}
            onChangeText={(text) => setEditedMeal({ ...editedMeal, fat: parseFloat(text) || 0 })}
            placeholder="Fat (g)"
            placeholderTextColor={theme.placeholder}
            keyboardType="numeric"
          />
          <View style={styles.switchContainer}>
            <Text style={[styles.switchLabel, { color: theme.text }]}>Visibility:</Text>
            <Switch
              value={editedMeal.visibility}
              onValueChange={(value) => setEditedMeal({ ...editedMeal, visibility: value })}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor={editedMeal.visibility ? theme.primary : theme.border}
            />
          </View>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.button }]}
            onPress={handleSave}
          >
            <Text style={[styles.buttonText, { color: theme.buttonText }]}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.danger }]}
            onPress={() => setIsEditing(false)}
          >
            <Text style={[styles.buttonText, { color: theme.buttonText }]}>Cancel</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          {/* Viewing UI */}
          <Text style={[styles.title, { color: theme.text }]}>{editedMeal.name}</Text>
          <Text style={[styles.description, { color: theme.subtext }]}>{editedMeal.description}</Text>
          <Text style={[styles.details, { color: theme.text }]}>Ingredients: {editedMeal.ingredients}</Text>
          <Text style={[styles.details, { color: theme.text }]}>Calories: {editedMeal.calories}</Text>
          <Text style={[styles.details, { color: theme.text }]}>Protein: {editedMeal.protein}g</Text>
          <Text style={[styles.details, { color: theme.text }]}>Carbs: {editedMeal.carbohydrates}g</Text>
          <Text style={[styles.details, { color: theme.text }]}>Fat: {editedMeal.fat}g</Text>
          <Text style={[styles.details, { color: theme.text }]}>
            Visibility: {meal.visibility ? "Public" : "Private"}
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.button }]}
            onPress={() => setIsEditing(true)}
          >
            <Text style={[styles.buttonText, { color: theme.buttonText }]}>Edit Meal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.danger }]}
            onPress={confirmDelete}
          >
            <Text style={[styles.buttonText, { color: theme.buttonText }]}>Delete Meal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.button }]}
            onPress={() => setIsModalVisible(true)}
          >
            <Text style={[styles.buttonText, { color: theme.buttonText }]}>Save to Calendar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.button }]}
            onPress={onBack}
          >
            <Text style={[styles.buttonText, { color: theme.buttonText }]}>Back to My Meals</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Modal for Adding to Meal Plan */}
      <Modal visible={isModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Add to Meal Plan</Text>
            <View>
              <TouchableOpacity
                style={[styles.input, { borderColor: theme.border }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={{ color: theme.text }}>
                  {selectedDate ? selectedDate : "Select Date"}
                </Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={selectedDate ? new Date(selectedDate) : new Date()}
                  mode="date"
                  display="default"
                  onChange={(event, date) => {
                    setShowDatePicker(false);
                    if (date) {
                      handleDateSelection(date); 
                    }
                  }}
                />
              )}
            </View>
            <View style={[styles.pickerContainer, { borderColor: theme.border }]}>
              <Picker
                selectedValue={mealType}
                onValueChange={(itemValue) => setMealType(itemValue)}
                style={{ color: theme.text }}
              >
                <Picker.Item label="Breakfast" value="Breakfast" />
                <Picker.Item label="Lunch" value="Lunch" />
                <Picker.Item label="Dinner" value="Dinner" />
                <Picker.Item label="Other" value="Other" />
              </Picker>
            </View>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.button }]}
              onPress={handleAddToMealPlan}
            >
              <Text style={[styles.buttonText, { color: theme.buttonText }]}>Add</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.danger }]}
              onPress={() => setIsModalVisible(false)}
            >
              <Text style={[styles.buttonText, { color: theme.buttonText }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    marginBottom: 16,
  },
  details: {
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  ingredientsInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    height: 100,
    textAlignVertical: "top",
  },
  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  switchLabel: {
    fontSize: 16,
    marginRight: 8,
  },
  button: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    width: "80%",
    padding: 20,
    borderRadius: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 16,
  },
});


export default MyMealInfo;