import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTheme } from "../../../../context/ThemeContext";

const BASE_URL = Platform.OS === "android" ? "http://10.0.2.2:5000" : "http://localhost:5000";

const EditPantryItem = () => {
  const { theme } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams(); // Get the pantry item ID from the route

  const [food, setFood] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [expirationDate, setExpirationDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    const fetchPantryItem = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const response = await axios.get(`${BASE_URL}/pantry/pantry/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const item = response.data;
        setFood(item.food);
        setQuantity(item.quantity?.toString() || "");
        setUnit(item.unit || "");
        setExpirationDate(item.expiration_date ? new Date(item.expiration_date) : null);
      } catch (error) {
        console.error("Error fetching pantry item:", error);
        Alert.alert("Error", "Failed to fetch pantry item.");
      }
    };

    fetchPantryItem();
  }, [id]);

  const handleUpdateItem = async () => {
    if (!food) {
      Alert.alert("Error", "Food name is required.");
      return;
    }

    try {
      const token = await AsyncStorage.getItem("token");
      await axios.put(
        `${BASE_URL}/pantry/pantry/${id}`,
        {
          food,
          quantity: quantity ? parseFloat(quantity) : null,
          unit,
          expiration_date: expirationDate ? expirationDate.toISOString().split("T")[0] : null,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      Alert.alert("Success", "Pantry item updated successfully.");
      router.push("/pantry/pantry"); // Navigate back to the pantry list
    } catch (error) {
      console.error("Error updating pantry item:", error);
      Alert.alert("Error", "Failed to update pantry item.");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>Edit Pantry Item</Text>

      <TextInput
        style={[styles.input, { borderColor: theme.border, color: theme.text }]}
        placeholder="Food Name"
        placeholderTextColor={theme.subtext}
        value={food}
        onChangeText={setFood}
      />

      <TextInput
        style={[styles.input, { borderColor: theme.border, color: theme.text }]}
        placeholder="Quantity (Optional)"
        placeholderTextColor={theme.subtext}
        keyboardType="numeric"
        value={quantity}
        onChangeText={setQuantity}
      />

      <TextInput
        style={[styles.input, { borderColor: theme.border, color: theme.text }]}
        placeholder="Unit (e.g., grams, cups)"
        placeholderTextColor={theme.subtext}
        value={unit}
        onChangeText={setUnit}
      />

      {/* Date Picker */}
      <TouchableOpacity
        style={[styles.datePickerButton, { borderColor: theme.border }]}
        onPress={() => setShowDatePicker(true)}
      >
        <Text style={{ color: theme.text }}>
          {expirationDate ? expirationDate.toDateString() : "Select Expiration Date"}
        </Text>
      </TouchableOpacity>

      {showDatePicker && (
        <DateTimePicker
          value={expirationDate || new Date()}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowDatePicker(false);
            if (date) setExpirationDate(date);
          }}
        />
      )}

      <TouchableOpacity
        style={[styles.updateButton, { backgroundColor: theme.primary }]}
        onPress={handleUpdateItem}
      >
        <Text style={[styles.updateButtonText, { color: theme.buttonText }]}>Update Item</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.cancelButton, { backgroundColor: theme.danger }]}
        onPress={() => router.push("/pantry/pantry")}
      >
        <Text style={[styles.cancelButtonText, { color: theme.buttonText }]}>Cancel</Text>
      </TouchableOpacity>
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
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  datePickerButton: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    justifyContent: "center",
  },
  updateButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  updateButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  cancelButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default EditPantryItem;