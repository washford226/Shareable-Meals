import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../../../context/ThemeContext";
import { format, addDays } from "date-fns";
import DateTimePicker from "@react-native-community/datetimepicker";
import { supabase } from "utils/supabase";

interface GroceryItem {
  id?: string;
  raw_name: string;
  quantity: number;
  unit: string | null;
  checked?: boolean;
  created_at?: string;
}

const GroceryListScreen = () => {
  const router = useRouter();
  const { theme } = useTheme();

  const [isShoppingMode, setIsShoppingMode] = useState(false); // false = Planning Mode, true = Shopping Mode
  const [loading, setLoading] = useState(false);
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(addDays(new Date(), 7));
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editQuantity, setEditQuantity] = useState("");
  const [editUnit, setEditUnit] = useState("");

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        Alert.alert("Error", "You are not logged in. Please log in to view your grocery list.");
        router.push("/(auth)/login");
        return;
      }
      setUserId(data.user.id);
    };
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (userId) {
      loadGroceryItems();
    }
  }, [userId]);

  const loadGroceryItems = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_grocery_items")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      setGroceryItems(data || []);
    } catch (error) {
      console.error("Error loading grocery items:", error);
      Alert.alert("Error", "Failed to load grocery items. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const generateFromMealPlan = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc("generate_grocery_items", {
        target_user_id: userId,
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
      });
      
      if (error) throw error;
      
      // Reload the grocery list to show the new items
      await loadGroceryItems();
      
      Alert.alert("Success", "Grocery items have been added from your meal plan!");
    } catch (error) {
      console.error("Error generating grocery list:", error);
      Alert.alert("Error", "Failed to generate grocery list. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Toggle item checked status (Shopping Mode)
  const toggleItemChecked = async (index: number) => {
    const item = groceryItems[index];
    if (!item.id) return;
    
    try {
      const newCheckedStatus = !item.checked;
      const { error } = await supabase
        .from("user_grocery_items")
        .update({ checked: newCheckedStatus })
        .eq("id", item.id);
      
      if (error) throw error;
      
      const updatedItems = [...groceryItems];
      updatedItems[index].checked = newCheckedStatus;
      setGroceryItems(updatedItems);
    } catch (error) {
      console.error("Error updating item:", error);
      Alert.alert("Error", "Failed to update item. Please try again.");
    }
  };

  // Start editing an item (Planning Mode)
  const startEditing = (index: number) => {
    const item = groceryItems[index];
    setEditingIndex(index);
    setEditName(item.raw_name);
    setEditQuantity(item.quantity.toString());
    setEditUnit(item.unit || "");
  };

  // Save edited item
  const saveEdit = async () => {
    if (!editName.trim() || !editQuantity.trim()) {
      Alert.alert("Error", "Please fill in all required fields.");
      return;
    }

    const item = groceryItems[editingIndex!];
    const updatedItem = {
      raw_name: editName.trim(),
      quantity: parseFloat(editQuantity),
      unit: editUnit.trim() || null,
    };

    try {
      if (item.id) {
        // Update existing item
        const { error } = await supabase
          .from("user_grocery_items")
          .update(updatedItem)
          .eq("id", item.id);
        
        if (error) throw error;
      } else {
        // Insert new item
        const { data, error } = await supabase
          .from("user_grocery_items")
          .insert([{ user_id: userId, ...updatedItem, checked: false }])
          .select()
          .single();
        
        if (error) throw error;
        
        // Update local state with new ID
        const updatedItems = [...groceryItems];
        updatedItems[editingIndex!] = { ...data };
        setGroceryItems(updatedItems);
        cancelEdit();
        return;
      }
      
      // Update local state for existing item
      const updatedItems = [...groceryItems];
      updatedItems[editingIndex!] = { ...item, ...updatedItem };
      setGroceryItems(updatedItems);
      cancelEdit();
    } catch (error) {
      console.error("Error saving item:", error);
      Alert.alert("Error", "Failed to save item. Please try again.");
    }
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingIndex(null);
    setEditName("");
    setEditQuantity("");
    setEditUnit("");
  };

  // Delete an item (Planning Mode)
  const deleteItem = async (index: number) => {
    const item = groceryItems[index];
    
    Alert.alert(
      "Delete Item",
      "Are you sure you want to delete this item?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              if (item.id) {
                const { error } = await supabase
                  .from("user_grocery_items")
                  .delete()
                  .eq("id", item.id);
                
                if (error) throw error;
              }
              
              const updatedItems = groceryItems.filter((_, i) => i !== index);
              setGroceryItems(updatedItems);
            } catch (error) {
              console.error("Error deleting item:", error);
              Alert.alert("Error", "Failed to delete item. Please try again.");
            }
          },
        },
      ]
    );
  };

  // Add new item (Planning Mode)
  const addNewItem = () => {
    const newItem: GroceryItem = {
      raw_name: "New Item",
      quantity: 1,
      unit: null,
      checked: false,
    };
    // Add new item at the top of the list instead of bottom
    const updatedItems = [newItem, ...groceryItems];
    setGroceryItems(updatedItems);
    // New item is now at index 0 (top of the list)
    setEditingIndex(0);
    setEditName("New Item");
    setEditQuantity("1");
    setEditUnit("");
  };

  // Delete all items (Planning Mode)
  const deleteAllItems = () => {
    Alert.alert(
      "Delete All Items",
      "Are you sure you want to delete all items?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete All",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("user_grocery_items")
                .delete()
                .eq("user_id", userId);
              
              if (error) throw error;
              setGroceryItems([]);
            } catch (error) {
              console.error("Error deleting all items:", error);
              Alert.alert("Error", "Failed to delete all items. Please try again.");
            }
          },
        },
      ]
    );
  };

  const handleStartDateChange = (_: any, selectedDate?: Date) => {
    setShowStartPicker(false);
    if (selectedDate) setStartDate(selectedDate);
  };

  const handleEndDateChange = (_: any, selectedDate?: Date) => {
    setShowEndPicker(false);
    if (selectedDate) setEndDate(selectedDate);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.button }]}
          onPress={() => router.push("/(app)/meal-plan/calendar")}
        >
          <Text style={[styles.backButtonText, { color: theme.buttonText }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Grocery List</Text>
      </View>

      {/* Mode Toggle */}
      <View style={styles.modeContainer}>
        <Text style={[styles.modeLabel, { color: theme.text }]}>
          {isShoppingMode ? "Shopping Mode" : "Planning Mode"}
        </Text>
        <Switch
          value={isShoppingMode}
          onValueChange={setIsShoppingMode}
          trackColor={{ false: theme.border, true: theme.primary }}
          thumbColor={isShoppingMode ? theme.primary : theme.border}
        />
      </View>

      {/* Planning Mode Controls */}
      {!isShoppingMode && (
        <>
          <View style={styles.dateContainer}>
            <TouchableOpacity
              style={[styles.dateButton, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => setShowStartPicker(true)}
            >
              <Text style={[styles.dateButtonText, { color: theme.text }]}>
                Start: {format(startDate, "MMM d, yyyy")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dateButton, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => setShowEndPicker(true)}
            >
              <Text style={[styles.dateButtonText, { color: theme.text }]}>
                End: {format(endDate, "MMM d, yyyy")}
              </Text>
            </TouchableOpacity>
          </View>

          {showStartPicker && (
            <DateTimePicker value={startDate} mode="date" display="default" onChange={handleStartDateChange} />
          )}
          {showEndPicker && (
            <DateTimePicker value={endDate} mode="date" display="default" onChange={handleEndDateChange} />
          )}

          <TouchableOpacity
            style={[styles.generateButton, { backgroundColor: theme.primary }]}
            onPress={generateFromMealPlan}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={theme.buttonText} />
            ) : (
              <Text style={[styles.generateButtonText, { color: theme.buttonText }]}>Add From Meal Plan</Text>
            )}
          </TouchableOpacity>

          {/* Planning Mode Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.primary }]}
              onPress={addNewItem}
            >
              <Text style={[styles.actionButtonText, { color: theme.buttonText }]}>Add Item</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.danger }]}
              onPress={deleteAllItems}
            >
              <Text style={[styles.actionButtonText, { color: theme.buttonText }]}>Delete All</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Items List */}
      <ScrollView style={styles.itemsContainer}>
        {groceryItems.length > 0 ? (
          <>
            <Text style={[styles.itemsTitle, { color: theme.text }]}>
              Grocery Items ({groceryItems.length})
            </Text>
            {groceryItems.map((item, index) => (
              <View key={index} style={[styles.item, { backgroundColor: theme.card, borderColor: theme.border }]}>
                {/* Shopping Mode - Checkbox */}
                {isShoppingMode && (
                  <TouchableOpacity
                    style={[styles.checkbox, item.checked && { backgroundColor: theme.primary }]}
                    onPress={() => toggleItemChecked(index)}
                  >
                    {item.checked && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                )}

                {/* Item Content */}
                {editingIndex === index ? (
                  // Edit Mode
                  <View style={styles.editContainer}>
                    <TextInput
                      style={[styles.editInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                      value={editName}
                      onChangeText={setEditName}
                      placeholder="Item name"
                      placeholderTextColor={theme.placeholder}
                    />
                    <TextInput
                      style={[styles.editInputSmall, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                      value={editQuantity}
                      onChangeText={setEditQuantity}
                      placeholder="Qty"
                      placeholderTextColor={theme.placeholder}
                      keyboardType="numeric"
                    />
                    <TextInput
                      style={[styles.editInputSmall, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                      value={editUnit}
                      onChangeText={setEditUnit}
                      placeholder="Unit"
                      placeholderTextColor={theme.placeholder}
                    />
                    <View style={styles.editButtons}>
                      <TouchableOpacity style={[styles.editButton, { backgroundColor: theme.primary }]} onPress={saveEdit}>
                        <Text style={[styles.editButtonText, { color: theme.buttonText }]}>Save</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.editButton, { backgroundColor: theme.border }]} onPress={cancelEdit}>
                        <Text style={[styles.editButtonText, { color: theme.text }]}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  // Display Mode
                  <View style={styles.itemContent}>
                    <View style={styles.itemInfo}>
                      <Text style={[styles.itemName, { color: theme.text, textDecorationLine: item.checked ? 'line-through' : 'none' }]}>
                        {item.raw_name}
                      </Text>
                      <Text style={[styles.itemQuantity, { color: theme.subtext }]}>
                        {item.quantity} {item.unit || ""}
                      </Text>
                    </View>
                    
                    {/* Planning Mode - Edit/Delete Buttons */}
                    {!isShoppingMode && (
                      <View style={styles.itemActions}>
                        <TouchableOpacity
                          style={[styles.actionButtonSmall, { backgroundColor: theme.button }]}
                          onPress={() => startEditing(index)}
                        >
                          <Text style={[styles.actionButtonTextSmall, { color: theme.buttonText }]}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButtonSmall, { backgroundColor: theme.danger }]}
                          onPress={() => deleteItem(index)}
                        >
                          <Text style={[styles.actionButtonTextSmall, { color: theme.buttonText }]}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </View>
            ))}
          </>
        ) : !loading ? (
          <Text style={[styles.emptyText, { color: theme.subtext }]}>
            {isShoppingMode ? "No items in your grocery list." : "No meals found for selected dates."}
          </Text>
        ) : null}
      </ScrollView>
      
      {/* Bottom Back Button */}
      <TouchableOpacity
        style={[styles.bottomBackButton, { backgroundColor: theme.button }]}
        onPress={() => router.push("/(app)/meal-plan/calendar")}
      >
        <Text style={[styles.bottomBackButtonText, { color: theme.buttonText }]}>Back to Calendar</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  backButton: { padding: 10, borderRadius: 8, marginRight: 16 },
  backButtonText: { fontSize: 16, fontWeight: "bold" },
  title: { fontSize: 24, fontWeight: "bold", flex: 1 },
  modeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
  },
  modeLabel: { fontSize: 18, fontWeight: "bold" },
  dateContainer: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  dateButton: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, marginHorizontal: 4, alignItems: "center" },
  dateButtonText: { fontSize: 16, fontWeight: "500" },
  generateButton: { padding: 12, borderRadius: 8, alignItems: "center", marginBottom: 16 },
  generateButtonText: { fontSize: 16, fontWeight: "bold" },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 4,
  },
  actionButtonText: { fontSize: 16, fontWeight: "bold" },
  itemsContainer: { flex: 1 },
  itemsTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 12 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#ccc",
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  checkmark: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  itemContent: {
    flexDirection: "row",
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: "500" },
  itemQuantity: { fontSize: 14, fontWeight: "bold" },
  itemActions: {
    flexDirection: "row",
  },
  actionButtonSmall: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  actionButtonTextSmall: { fontSize: 14, fontWeight: "bold" },
  editContainer: {
    flex: 1,
  },
  editInput: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
    fontSize: 16,
    marginBottom: 8,
  },
  editInputSmall: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    marginBottom: 8,
    width: 80,
  },
  editButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  editButton: {
    flex: 1,
    padding: 8,
    borderRadius: 6,
    alignItems: "center",
    marginHorizontal: 4,
  },
  editButtonText: { fontSize: 14, fontWeight: "bold" },
  emptyText: { fontSize: 16, textAlign: "center", marginTop: 40, fontStyle: "italic" },
  bottomBackButton: { 
    padding: 12, 
    borderRadius: 8, 
    alignItems: "center", 
    marginTop: 16,
    marginBottom: 8 
  },
  bottomBackButtonText: { 
    fontSize: 16, 
    fontWeight: "bold" 
  },
});

export default GroceryListScreen;
