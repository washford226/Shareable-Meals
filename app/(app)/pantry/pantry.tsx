import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../../context/ThemeContext";
import { useRouter } from "expo-router";

const BASE_URL = Platform.OS === "android" ? "http://10.0.2.2:5000" : "http://localhost:5000";

const PantryScreen = () => {
  const { theme } = useTheme();
  const router = useRouter();

  interface PantryItem {
    pantry_id: number;
    food: string; // Updated to match the database schema
    quantity: number;
    unit?: string;
    expiration_date?: string;
  }

  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch pantry items from the backend
  const fetchPantryItems = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const response = await axios.get(`${BASE_URL}/pantry/pantry`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPantryItems(response.data);
    } catch (error) {
      console.error("Error fetching pantry items:", error);
      Alert.alert("Error", "Failed to fetch pantry items. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // Delete a pantry item
  const deletePantryItem = async (id: number) => {
    try {
      const token = await AsyncStorage.getItem("token");
      await axios.delete(`${BASE_URL}/pantry/pantry/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      Alert.alert("Success", "Pantry item deleted successfully.");
      fetchPantryItems(); // Refresh the list
    } catch (error) {
      console.error("Error deleting pantry item:", error);
      Alert.alert("Error", "Failed to delete pantry item. Please try again later.");
    }
  };

  useEffect(() => {
    fetchPantryItems();
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>My Pantry</Text>
      <FlatList
        data={pantryItems}
        keyExtractor={(item) => item.pantry_id.toString()}
        renderItem={({ item }) => (
          <View style={[styles.itemContainer, { backgroundColor: theme.card }]}>
            <Text style={[styles.itemText, { color: theme.text }]}>
              {item.food} - {item.quantity} {item.unit || ""}
            </Text>
            {item.expiration_date && (
              <Text style={[styles.expirationText, { color: theme.subtext }]}>
                Expires on: {item.expiration_date}
              </Text>
            )}
            <TouchableOpacity
            style={[styles.editButton, { backgroundColor: theme.primary }]}
            onPress={() => router.push(`/pantry/${item.pantry_id}/edit`)} 
          >
            <Text style={[styles.editButtonText, { color: theme.buttonText }]}>Edit</Text>
          </TouchableOpacity>
            <TouchableOpacity
              style={[styles.deleteButton, { backgroundColor: theme.danger }]}
              onPress={() =>
                Alert.alert(
                  "Delete Item",
                  "Are you sure you want to delete this item?",
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", onPress: () => deletePantryItem(item.pantry_id) },
                  ]
                )
              }
            >
              <Text style={[styles.deleteButtonText, { color: theme.buttonText }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: theme.subtext }]}>
            Your pantry is empty. Add some items!
          </Text>
        }
      />
      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: theme.primary }]}
        onPress={() => router.push("/pantry/add")} // Navigate to the Add Pantry Item screen
      >
        <Text style={[styles.addButtonText, { color: theme.buttonText }]}>Add Item</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.push("/meal-plan/calendar")} // Navigate back to the previous screen
        >
        <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  backButton: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#ccc", // Default background color
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000", // Default text color
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  itemContainer: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  itemText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  expirationText: {
    fontSize: 14,
    marginTop: 4,
  },
  deleteButton: {
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  addButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 32,
  },
  editButton: {
  marginTop: 8,
  padding: 8,
  borderRadius: 8,
  alignItems: "center",
},
editButtonText: {
  fontSize: 14,
  fontWeight: "bold",
},
});

export default PantryScreen;