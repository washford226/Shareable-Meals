import React, { useState, useEffect } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Platform,
  Alert,
  Modal,
  Image,
  Linking,
} from "react-native";
import { useTheme } from "../../../../context/ThemeContext";
import { useLocalSearchParams, useRouter } from "expo-router";
import { format } from "date-fns";
import { Meal } from "../../../../types/types";
import QRCode from "react-native-qrcode-svg";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import { supabase } from "utils/supabase";

const MyMealInfo = () => {
  const { theme } = useTheme();
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [meal, setMeal] = useState<Meal | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [mealType, setMealType] = useState("Breakfast");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isQRModalVisible, setIsQRModalVisible] = useState(false);

  // Fetch meal from Supabase
  const fetchMeal = async () => {
    try {
      setLoading(true);
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        Alert.alert("Error", "User not authenticated. Please log in.");
        router.back();
        return;
      }
      const userId = userData.user.id;

      const { data, error } = await supabase
        .from("meals")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .single();

      if (error || !data) {
        Alert.alert("Error", "Meal not found.");
        router.back();
        return;
      }
      setMeal(data);
    } catch (error) {
      console.error("Error fetching meal:", error);
      Alert.alert("Error", "Could not fetch meal.");
    } finally {
      setLoading(false);
    }
  };

  // Add meal to meal plan in Supabase
  const handleAddToMealPlan = async () => {
    if (!selectedDate) {
      Alert.alert("Error", "Please select a date.");
      return;
    }
    try {
      setLoading(true);
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        Alert.alert("Error", "User not authenticated. Please log in.");
        return;
      }
      const userId = userData.user.id;

      const { error } = await supabase.from("meal_plan").insert([
        {
          user_id: userId,
          meal_id: id,
          date: selectedDate,
          meal_type: mealType,
        },
      ]);

      if (error) {
        throw error;
      }

      Alert.alert("Success", "Meal added to the meal plan!");
      setIsModalVisible(false);
      setSelectedDate("");
      setMealType("Breakfast");
    } catch (error) {
      console.error("Error adding meal to meal plan:", error);
      Alert.alert("Error", "Failed to add meal to the meal plan. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleDateSelection = (date: Date): void => {
    const formattedDate: string = format(date, "yyyy-MM-dd");
    setSelectedDate(formattedDate);
  };

  // Delete meal from Supabase
  const handleDeleteMeal = async () => {
    try {
      setLoading(true);
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        Alert.alert("Error", "User not authenticated. Please log in.");
        return;
      }
      const userId = userData.user.id;

      const { error } = await supabase
        .from("meals")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (error) {
        throw error;
      }

      Alert.alert("Success", "Meal deleted successfully!");
      router.back();
    } catch (error) {
      console.error("Error deleting meal:", error);
      Alert.alert("Error", "An error occurred while deleting the meal.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading && !meal) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>Loading...</Text>
      </View>
    );
  }

  if (!meal) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>Meal not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.scrollContainer, { backgroundColor: theme.background }]}>
      {/* Meal Picture */}
      {meal.picture ? (
        <Image
          source={{ uri: typeof meal.picture === "string" ? meal.picture : "" }}
          style={styles.mealImage}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.placeholder, { backgroundColor: theme.card }]}>
          <Text style={[styles.placeholderText, { color: theme.subtext }]}>No Image Available</Text>
        </View>
      )}

      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Meal Name */}
        <Text style={[styles.title, { color: theme.text }]}>{meal.name}</Text>

        {/* Description */}
        <Text style={[styles.description, { color: theme.subtext }]}>{meal.description}</Text>

        {/* Instructions */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Instructions</Text>
        <Text style={[styles.details, { color: theme.text }]}>{meal.instructions}</Text>

        {/* Dietary Restriction */}
        {meal.dietary_restrictions && (
          <Text style={[styles.details, { color: theme.text, fontWeight: "bold", marginBottom: 8 }]}>
            Dietary Restriction: {meal.dietary_restrictions}
          </Text>
        )}
        {/* Cuisine */}
        {meal.cuisine && (
          <Text style={[styles.details, { color: theme.text, fontWeight: "bold", marginBottom: 8 }]}>
            Cuisine: {meal.cuisine}
          </Text>
        )}

        {/* Meal Link */}
        {meal.recipeLink && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Recipe Link</Text>
            <Text
              style={[styles.linkText, { color: theme.primary }]}
              onPress={() => meal.recipeLink && Linking.openURL(meal.recipeLink)}
            >
              {meal.recipeLink}
            </Text>
          </>
        )}
        {/* Ingredients */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Ingredients</Text>
        {Array.isArray(meal.ingredients) ? (
          meal.ingredients.length > 0 ? (
            meal.ingredients.map((ing: any, idx: number) => (
              <Text key={idx} style={[styles.details, { color: theme.text }]}>
                {ing.quantity} {ing.unit} {ing.name}
              </Text>
            ))
          ) : (
            <Text style={[styles.details, { color: theme.text }]}>No ingredients listed.</Text>
          )
        ) : (
          <Text style={[styles.details, { color: theme.text }]}>{meal.ingredients}</Text>
        )}

        {/* Nutrition Info */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Nutrition Info</Text>
        <View style={styles.nutritionContainer}>
          <Text style={[styles.nutritionText, { color: theme.text }]}>
            Calories: {meal.calories}
          </Text>
          <Text style={[styles.nutritionText, { color: theme.text }]}>
            Protein: {meal.protein}g
          </Text>
          <Text style={[styles.nutritionText, { color: theme.text }]}>
            Carbs: {meal.carbohydrates}g
          </Text>
          <Text style={[styles.nutritionText, { color: theme.text }]}>
            Fat: {meal.fat}g
          </Text>
        </View>

        {/* Buttons */}
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={() => setIsModalVisible(true)}
        >
          <Text style={[styles.buttonText, { color: theme.buttonText }]}>Add to Meal Plan</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.button }]}
          onPress={() => router.push(`/my-meals/${id}/edit`)}
        >
          <Text style={[styles.buttonText, { color: theme.buttonText }]}>Edit Meal</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={() => setIsQRModalVisible(true)}
        >
          <Text style={[styles.buttonText, { color: theme.buttonText }]}>Share via QR Code</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.danger }]}
          onPress={handleDeleteMeal}
        >
          <Text style={[styles.buttonText, { color: theme.buttonText }]}>Delete Meal</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.button }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.buttonText, { color: theme.buttonText }]}>Back</Text>
        </TouchableOpacity>
      </View>

      {/* QR Code Modal */}
      <Modal visible={isQRModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Scan to Save Meal</Text>
            <QRCode
              value={id ? `meal:${id}` : ""}
              size={200}
              color={theme.text}
              backgroundColor={theme.card}
            />
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.danger }]}
              onPress={() => setIsQRModalVisible(false)}
            >
              <Text style={[styles.buttonText, { color: theme.buttonText }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal for Adding to Meal Plan */}
      <Modal visible={isModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Add to Meal Plan</Text>

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
              style={[styles.button, { backgroundColor: theme.primary }]}
              onPress={handleAddToMealPlan}
              disabled={loading}
            >
              <Text style={[styles.buttonText, { color: theme.buttonText }]}>{loading ? "Adding..." : "Add"}</Text>
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    width: "100%",
  },
  scrollContainer: {
    flexGrow: 1,
  },
  mealImage: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
  },
  placeholder: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: "bold",
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
  },
  details: {
    fontSize: 14,
    marginBottom: 8,
  },
  nutritionContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
  },
  nutritionText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  button: {
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
    alignItems: "center",
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
  linkText: {
    fontSize: 16,
    textDecorationLine: "underline",
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 16,
  },
});

export default MyMealInfo;