import React, { useState, useEffect, useCallback } from "react";
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
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  const [generatingItems, setGeneratingItems] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const getCurrentUser = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        const errorMessage = "You are not logged in. Please log in to view your grocery list.";
        setError(errorMessage);
        Alert.alert(
          "Authentication Required", 
          errorMessage,
          [{ text: "Login", onPress: () => router.push("/(auth)/login") }]
        );
        return;
      }
      setUserId(data.user.id);
      setError(null);
    } catch (error: any) {
      console.error("Error getting user:", error);
      const errorMessage = "Authentication error. Please try again.";
      setError(errorMessage);
      Alert.alert("Error", errorMessage);
    }
  }, [router]);

  useEffect(() => {
    getCurrentUser();
  }, [getCurrentUser]);

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

  const loadGroceryItems = useCallback(async (isRefresh = false) => {
    if (!userId) return;
    
    try {
      if (isRefresh) {
        setRefreshing(true);
        setError(null);
      } else {
        setLoading(true);
        setError(null);
      }

      // Validate user authentication
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        throw new Error("Authentication required. Please log in again.");
      }

      const { data, error } = await supabase
        .from("user_grocery_items")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      
      if (error) {
        throw new Error(error.message || "Failed to load grocery items");
      }
      
      setGroceryItems(data || []);
      setRetryCount(0); // Reset retry count on success
    } catch (error: any) {
      console.error("Error loading grocery items:", error);
      const errorMessage = error.message || "Failed to load grocery items. Please try again.";
      setError(errorMessage);
      
      // Auto-retry with exponential backoff for network errors
      if (retryCount < 3 && !error.message?.includes("Authentication")) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          loadGroceryItems(isRefresh);
        }, delay);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, retryCount]);

  const handleRefresh = useCallback(() => {
    setRetryCount(0);
    loadGroceryItems(true);
  }, [loadGroceryItems]);

  useEffect(() => {
    if (userId) {
      loadGroceryItems();
    }
  }, [userId, loadGroceryItems]);

  const generateFromMealPlan = async () => {
    if (!userId || generatingItems) return;
    
    setGeneratingItems(true);
    setError(null);
    
    try {
      // Validate date range
      if (startDate >= endDate) {
        throw new Error("End date must be after start date");
      }

      // Validate user authentication
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        throw new Error("Authentication required. Please log in again.");
      }

      const { error } = await supabase.rpc("generate_grocery_items", {
        target_user_id: userId,
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
      });
      
      if (error) {
        throw new Error(error.message || "Failed to generate grocery list");
      }
      
      // Reload the grocery list to show the new items
      await loadGroceryItems();
      
      Alert.alert(
        "Success", 
        "Grocery items have been added from your meal plan!",
        [{ text: "OK" }]
      );
    } catch (error: any) {
      console.error("Error generating grocery list:", error);
      const errorMessage = error.message || "Failed to generate grocery list. Please try again.";
      setError(errorMessage);
      Alert.alert("Error", errorMessage);
    } finally {
      setGeneratingItems(false);
    }
  };

  // Toggle item checked status (Shopping Mode)
  const toggleItemChecked = async (index: number) => {
    const item = groceryItems[index];
    if (!item.id) return;
    
    try {
      const newCheckedStatus = !item.checked;
      
      // Optimistic update
      const updatedItems = [...groceryItems];
      updatedItems[index].checked = newCheckedStatus;
      setGroceryItems(updatedItems);
      
      const { error } = await supabase
        .from("user_grocery_items")
        .update({ checked: newCheckedStatus })
        .eq("id", item.id);
      
      if (error) {
        // Revert optimistic update on error
        updatedItems[index].checked = !newCheckedStatus;
        setGroceryItems(updatedItems);
        throw new Error(error.message || "Failed to update item");
      }
    } catch (error: any) {
      console.error("Error updating item:", error);
      const errorMessage = error.message || "Failed to update item. Please try again.";
      setError(errorMessage);
      Alert.alert("Error", errorMessage);
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
    if (!editName.trim()) {
      Alert.alert("Validation Error", "Item name is required.");
      return;
    }

    if (!editQuantity.trim() || isNaN(parseFloat(editQuantity)) || parseFloat(editQuantity) <= 0) {
      Alert.alert("Validation Error", "Please enter a valid quantity greater than 0.");
      return;
    }

    const item = groceryItems[editingIndex!];
    const updatedItem = {
      raw_name: editName.trim(),
      quantity: parseFloat(editQuantity),
      unit: editUnit.trim() || null,
    };

    try {
      setError(null);
      
      if (item.id) {
        // Update existing item
        const { error } = await supabase
          .from("user_grocery_items")
          .update(updatedItem)
          .eq("id", item.id);
        
        if (error) {
          throw new Error(error.message || "Failed to update item");
        }
        
        // Update local state for existing item
        const updatedItems = [...groceryItems];
        updatedItems[editingIndex!] = { ...item, ...updatedItem };
        setGroceryItems(updatedItems);
      } else {
        // Insert new item
        const { data, error } = await supabase
          .from("user_grocery_items")
          .insert([{ user_id: userId, ...updatedItem, checked: false }])
          .select()
          .single();
        
        if (error) {
          throw new Error(error.message || "Failed to add item");
        }
        
        // Update local state with new ID
        const updatedItems = [...groceryItems];
        updatedItems[editingIndex!] = { ...data };
        setGroceryItems(updatedItems);
      }
      
      cancelEdit();
    } catch (error: any) {
      console.error("Error saving item:", error);
      const errorMessage = error.message || "Failed to save item. Please try again.";
      setError(errorMessage);
      Alert.alert("Error", errorMessage);
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
      `Are you sure you want to delete "${item.raw_name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setError(null);
              
              // Optimistic update
              const updatedItems = groceryItems.filter((_, i) => i !== index);
              setGroceryItems(updatedItems);
              
              if (item.id) {
                const { error } = await supabase
                  .from("user_grocery_items")
                  .delete()
                  .eq("id", item.id);
                
                if (error) {
                  // Revert optimistic update on error
                  setGroceryItems(groceryItems);
                  throw new Error(error.message || "Failed to delete item");
                }
              }
            } catch (error: any) {
              console.error("Error deleting item:", error);
              const errorMessage = error.message || "Failed to delete item. Please try again.";
              setError(errorMessage);
              Alert.alert("Error", errorMessage);
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
    if (groceryItems.length === 0) {
      Alert.alert("No Items", "There are no items to delete.");
      return;
    }

    Alert.alert(
      "Delete All Items",
      `Are you sure you want to delete all ${groceryItems.length} items? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete All",
          style: "destructive",
          onPress: async () => {
            try {
              setError(null);
              
              // Optimistic update
              const backupItems = [...groceryItems];
              setGroceryItems([]);
              
              const { error } = await supabase
                .from("user_grocery_items")
                .delete()
                .eq("user_id", userId);
              
              if (error) {
                // Revert optimistic update on error
                setGroceryItems(backupItems);
                throw new Error(error.message || "Failed to delete all items");
              }
              
              Alert.alert("Success", "All items have been deleted.");
            } catch (error: any) {
              console.error("Error deleting all items:", error);
              const errorMessage = error.message || "Failed to delete all items. Please try again.";
              setError(errorMessage);
              Alert.alert("Error", errorMessage);
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
      {/* Enhanced Header */}
      <View style={[styles.header, { backgroundColor: theme.card }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.primary }]}
          onPress={() => router.push("/(app)/meal-plan/calendar")}
        >
          <Ionicons name="arrow-back" size={20} color={theme.buttonText} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Ionicons name="list-outline" size={28} color={theme.primary} />
          <Text style={[styles.title, { color: theme.text }]}>Grocery List</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Scrollable Content */}
      <ScrollView 
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Error Banner */}
        {error && (
          <View style={[styles.errorBanner, { backgroundColor: theme.card, borderColor: theme.danger }]}>
            <Ionicons name="warning" size={20} color={theme.danger} />
            <Text style={[styles.errorBannerText, { color: theme.danger }]}>
              {error}
            </Text>
            <TouchableOpacity
              style={[styles.errorBannerRetry, { backgroundColor: theme.danger }]}
              onPress={handleRefresh}
            >
              <Text style={[styles.errorBannerRetryText, { color: theme.buttonText }]}>
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Mode Toggle */}
        <View style={[styles.modeContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.modeInfo}>
            <Ionicons 
              name={isShoppingMode ? "basket-outline" : "construct-outline"} 
              size={24} 
              color={theme.primary} 
            />
            <View style={styles.modeTextContainer}>
              <Text style={[styles.modeLabel, { color: theme.text }]}>
                {isShoppingMode ? "Shopping Mode" : "Planning Mode"}
              </Text>
              <Text style={[styles.modeDescription, { color: theme.subtext }]}>
                {isShoppingMode ? "Check off items as you shop" : "Manage your grocery list"}
              </Text>
            </View>
          </View>
          <Switch
            value={isShoppingMode}
            onValueChange={setIsShoppingMode}
            trackColor={{ false: theme.border, true: theme.primary }}
            thumbColor={isShoppingMode ? theme.background : theme.background}
          />
        </View>

      {/* Planning Mode Controls */}
      {!isShoppingMode && (
        <View style={[styles.planningCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {/* Date Range Section */}
          <View style={styles.dateSection}>
            <View style={styles.dateSectionHeader}>
              <Ionicons name="calendar-outline" size={20} color={theme.primary} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Date Range</Text>
            </View>
            <View style={styles.dateContainer}>
              <TouchableOpacity
                style={[styles.dateButton, { backgroundColor: theme.background, borderColor: theme.border }]}
                onPress={() => setShowStartPicker(true)}
              >
                <Text style={[styles.dateLabel, { color: theme.subtext }]}>Start Date</Text>
                <Text style={[styles.dateText, { color: theme.text }]}>
                  {format(startDate, "MMM d, yyyy")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.dateButton, { backgroundColor: theme.background, borderColor: theme.border }]}
                onPress={() => setShowEndPicker(true)}
              >
                <Text style={[styles.dateLabel, { color: theme.subtext }]}>End Date</Text>
                <Text style={[styles.dateText, { color: theme.text }]}>
                  {format(endDate, "MMM d, yyyy")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Actions Section */}
          <View style={styles.actionsSection}>
            <TouchableOpacity
              style={[
                styles.generateButton, 
                { 
                  backgroundColor: theme.primary,
                  opacity: generatingItems ? 0.7 : 1
                }
              ]}
              onPress={generateFromMealPlan}
              disabled={generatingItems}
            >
              {generatingItems ? (
                <ActivityIndicator size="small" color={theme.buttonText} />
              ) : (
                <View style={styles.buttonContent}>
                  <Ionicons name="restaurant-outline" size={20} color={theme.buttonText} />
                  <Text style={[styles.generateButtonText, { color: theme.buttonText }]}>Add From Meal Plan</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.success }]}
                onPress={addNewItem}
              >
                <Ionicons name="add-circle-outline" size={18} color={theme.buttonText} />
                <Text style={[styles.actionButtonText, { color: theme.buttonText }]}>Add Item</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.danger }]}
                onPress={deleteAllItems}
              >
                <Ionicons name="trash-outline" size={18} color={theme.buttonText} />
                <Text style={[styles.actionButtonText, { color: theme.buttonText }]}>Delete All</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

          {showStartPicker && (
            <DateTimePicker value={startDate} mode="date" display="default" onChange={handleStartDateChange} />
          )}
          {showEndPicker && (
            <DateTimePicker value={endDate} mode="date" display="default" onChange={handleEndDateChange} />
          )}

      {/* Items List */}
      <View style={styles.itemsSection}>
        {loading && groceryItems.length === 0 ? (
          <View style={[styles.loadingCard, { backgroundColor: theme.card }]}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.text }]}>
              Loading grocery list...
            </Text>
          </View>
        ) : groceryItems.length > 0 ? (
          <ScrollView 
            style={styles.itemsContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[theme.primary]}
                tintColor={theme.primary}
              />
            }
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={true}
            scrollEventThrottle={16}
          >
            <View style={[styles.itemsHeader, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Ionicons name="receipt-outline" size={20} color={theme.primary} />
              <Text style={[styles.itemsTitle, { color: theme.text }]}>
                Grocery Items ({groceryItems.length})
              </Text>
              {isShoppingMode && (
                <View style={styles.progressIndicator}>
                  <Text style={[styles.progressText, { color: theme.success }]}>
                    {groceryItems.filter(item => item.checked).length}/{groceryItems.length}
                  </Text>
                </View>
              )}
            </View>
            {groceryItems.map((item, index) => (
              <View key={index} style={[styles.item, { 
                backgroundColor: theme.card, 
                borderColor: theme.border,
                opacity: item.checked ? 0.7 : 1
              }]}>
                {/* Shopping Mode - Enhanced Checkbox */}
                {isShoppingMode && (
                  <TouchableOpacity
                    style={[
                      styles.checkbox, 
                      item.checked && { backgroundColor: theme.success, borderColor: theme.success }
                    ]}
                    onPress={() => toggleItemChecked(index)}
                  >
                    {item.checked && <Ionicons name="checkmark" size={16} color={theme.buttonText} />}
                  </TouchableOpacity>
                )}

                {/* Item Content */}
                {editingIndex === index ? (
                  // Edit Mode
                  <View style={styles.editContainer}>
                    <View style={styles.editRow}>
                      <TextInput
                        style={[styles.editInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                        value={editName}
                        onChangeText={setEditName}
                        placeholder="Item name"
                        placeholderTextColor={theme.subtext}
                      />
                    </View>
                    <View style={styles.editRow}>
                      <TextInput
                        style={[styles.editInputSmall, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                        value={editQuantity}
                        onChangeText={setEditQuantity}
                        placeholder="Qty"
                        placeholderTextColor={theme.subtext}
                        keyboardType="numeric"
                      />
                      <TextInput
                        style={[styles.editInputSmall, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                        value={editUnit}
                        onChangeText={setEditUnit}
                        placeholder="Unit"
                        placeholderTextColor={theme.subtext}
                      />
                    </View>
                    <View style={styles.editButtons}>
                      <TouchableOpacity style={[styles.editButton, { backgroundColor: theme.success }]} onPress={saveEdit}>
                        <Ionicons name="checkmark" size={16} color={theme.buttonText} />
                        <Text style={[styles.editButtonText, { color: theme.buttonText }]}>Save</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.editButton, { backgroundColor: theme.border }]} onPress={cancelEdit}>
                        <Ionicons name="close" size={16} color={theme.text} />
                        <Text style={[styles.editButtonText, { color: theme.text }]}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  // Display Mode
                  <View style={styles.itemContent}>
                    <View style={styles.itemInfo}>
                      <Text style={[styles.itemName, { 
                        color: theme.text, 
                        textDecorationLine: item.checked ? 'line-through' : 'none',
                        opacity: item.checked ? 0.7 : 1
                      }]}>
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
                          style={[styles.actionButtonSmall, { backgroundColor: theme.primary }]}
                          onPress={() => startEditing(index)}
                        >
                          <Ionicons name="create-outline" size={14} color={theme.buttonText} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButtonSmall, { backgroundColor: theme.danger }]}
                          onPress={() => deleteItem(index)}
                        >
                          <Ionicons name="trash-outline" size={14} color={theme.buttonText} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons 
              name={isShoppingMode ? "basket-outline" : "list-outline"} 
              size={48} 
              color={theme.subtext} 
            />
            <Text style={[styles.emptyText, { color: theme.subtext }]}>
              {isShoppingMode 
                ? "No items in your grocery list." 
                : "No grocery items yet. Add items manually or generate from your meal plan."
              }
            </Text>
            {!isShoppingMode && (
              <TouchableOpacity
                style={[styles.emptyActionButton, { backgroundColor: theme.primary }]}
                onPress={addNewItem}
              >
                <Ionicons name="add-circle-outline" size={20} color={theme.buttonText} style={{ marginRight: 8 }} />
                <Text style={[styles.emptyActionButtonText, { color: theme.buttonText }]}>
                  Add Your First Item
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
      </ScrollView>
      
      {/* Bottom Back Button */}
      <TouchableOpacity
        style={[styles.bottomBackButton, { backgroundColor: theme.primary }]}
        onPress={() => router.push("/(app)/meal-plan/calendar")}
      >
        <View style={styles.buttonContent}>
          <Ionicons name="arrow-back" size={20} color={theme.buttonText} />
          <Text style={[styles.bottomBackButtonText, { color: theme.buttonText }]}>Back to Calendar</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 20
  },
  
  // Scroll Content Styles
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 20,
  },
  
  // Enhanced Header Styles
  header: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginBottom: 24,
    padding: 16,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 40, // Same width as back button for centering
  },
  backButton: { 
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  backButtonText: { 
    fontSize: 16, 
    fontWeight: "bold" 
  },
  title: { 
    fontSize: 24, 
    fontWeight: "800",
    marginLeft: 12,
  },
  
  // Enhanced Error Banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  errorBannerRetry: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  errorBannerRetryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Enhanced Mode Toggle
  modeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  modeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modeTextContainer: {
    marginLeft: 12,
  },
  modeLabel: { 
    fontSize: 18, 
    fontWeight: "700" 
  },
  modeDescription: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  
  // Enhanced Planning Card
  planningCard: {
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  dateSection: {
    marginBottom: 20,
  },
  dateSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  dateContainer: { 
    flexDirection: "row", 
    justifyContent: "space-between",
    gap: 12,
  },
  dateButton: { 
    flex: 1, 
    padding: 16, 
    borderRadius: 12, 
    borderWidth: 1,
    alignItems: "center",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '700',
  },
  dateButtonText: { 
    fontSize: 16, 
    fontWeight: "500" 
  },
  
  // Enhanced Actions Section
  actionsSection: {
    gap: 16,
  },
  generateButton: { 
    padding: 16, 
    borderRadius: 12, 
    alignItems: "center",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  generateButtonText: { 
    fontSize: 16, 
    fontWeight: "700",
    marginLeft: 8,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonText: { 
    fontSize: 14, 
    fontWeight: "600",
    marginLeft: 6,
  },
  
  // Enhanced Items Section
  itemsSection: {
    flex: 1,
  },
  loadingCard: {
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  itemsContainer: { 
    flex: 1 
  },
  itemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  itemsTitle: { 
    fontSize: 18, 
    fontWeight: "700",
    marginLeft: 8,
    flex: 1,
  },
  progressIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  progressText: {
    fontSize: 14,
    fontWeight: '700',
  },
  
  // Enhanced Item Styles
  item: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#ccc",
    marginRight: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
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
  itemInfo: { 
    flex: 1 
  },
  itemName: { 
    fontSize: 16, 
    fontWeight: "600",
    marginBottom: 4,
  },
  itemQuantity: { 
    fontSize: 14, 
    fontWeight: "500" 
  },
  itemActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButtonSmall: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  actionButtonTextSmall: { 
    fontSize: 14, 
    fontWeight: "bold" 
  },
  
  // Enhanced Edit Styles
  editContainer: {
    flex: 1,
    gap: 12,
  },
  editRow: {
    flexDirection: 'row',
    gap: 8,
  },
  editInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  editInputSmall: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  editButtons: {
    flexDirection: "row",
    gap: 8,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  editButtonText: { 
    fontSize: 14, 
    fontWeight: "600",
    marginLeft: 4,
  },
  
  // Enhanced Empty State
  emptyCard: {
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    marginVertical: 20,
  },
  emptyText: { 
    fontSize: 16, 
    textAlign: "center", 
    fontWeight: '500',
    lineHeight: 24,
    marginVertical: 16,
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyActionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  
  // Enhanced Bottom Button
  bottomBackButton: { 
    flexDirection: 'row',
    padding: 16, 
    borderRadius: 12, 
    alignItems: "center", 
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  bottomBackButtonText: { 
    fontSize: 16, 
    fontWeight: "700",
    marginLeft: 8,
  },
});

export default GroceryListScreen;
