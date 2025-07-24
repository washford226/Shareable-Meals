import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTheme } from "../../../../context/ThemeContext";
import { supabase } from "utils/supabase";

const EditPantryItem = () => {
  const { theme } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams(); // Get the pantry item ID from the route

  const [food, setFood] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [expirationDate, setExpirationDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Enhanced state management
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});

  // Enhanced fetch function with retry logic
  const fetchPantryItem = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        throw new Error("User not authenticated. Please log in.");
      }
      const userId = userData.user.id;

      const { data, error } = await supabase
        .from("pantry")
        .select("*")
        .eq("pantry_id", id)
        .eq("user_id", userId)
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error("Pantry item not found.");
      }

      setFood(data.food || "");
      setQuantity(data.quantity?.toString() || "");
      setUnit(data.unit || "");
      setExpirationDate(data.expiration_date ? new Date(data.expiration_date) : null);
      setRetryCount(0);
    } catch (error: any) {
      console.error("Error fetching pantry item:", error);
      const errorMessage = error.message || "Failed to fetch pantry item.";
      setError(errorMessage);
      
      if (errorMessage.includes("not authenticated")) {
        Alert.alert("Authentication Error", errorMessage, [
          { text: "OK", onPress: () => router.push("/pantry/pantry") }
        ]);
      } else if (errorMessage.includes("not found")) {
        Alert.alert("Item Not Found", errorMessage, [
          { text: "OK", onPress: () => router.push("/pantry/pantry") }
        ]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, router]);

  // Retry function with exponential backoff
  const handleRetry = useCallback(async () => {
    const newRetryCount = retryCount + 1;
    setRetryCount(newRetryCount);
    
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delay = Math.min(1000 * Math.pow(2, newRetryCount - 1), 16000);
    
    setTimeout(() => {
      fetchPantryItem();
    }, delay);
  }, [retryCount, fetchPantryItem]);

  // Fetch pantry item from Supabase
  useEffect(() => {
    if (id) fetchPantryItem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Validation functions
  const validateForm = useCallback(() => {
    const errors: {[key: string]: string} = {};

    if (!food.trim()) {
      errors.food = "Food name is required";
    } else if (food.trim().length > 100) {
      errors.food = "Food name must be 100 characters or less";
    }

    if (quantity && !/^\d*\.?\d+$/.test(quantity)) {
      errors.quantity = "Quantity must be a valid number";
    }

    if (unit && unit.length > 50) {
      errors.unit = "Unit must be 50 characters or less";
    }

    if (expirationDate && expirationDate < new Date()) {
      errors.expirationDate = "Expiration date cannot be in the past";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [food, quantity, unit, expirationDate]);

  // Form field handlers with validation
  const handleFoodChange = useCallback((value: string) => {
    setFood(value);
    if (validationErrors.food) {
      setValidationErrors(prev => ({ ...prev, food: '' }));
    }
  }, [validationErrors.food]);

  const handleQuantityChange = useCallback((value: string) => {
    setQuantity(value);
    if (validationErrors.quantity) {
      setValidationErrors(prev => ({ ...prev, quantity: '' }));
    }
  }, [validationErrors.quantity]);

  const handleUnitChange = useCallback((value: string) => {
    setUnit(value);
    if (validationErrors.unit) {
      setValidationErrors(prev => ({ ...prev, unit: '' }));
    }
  }, [validationErrors.unit]);

  const handleDateChange = useCallback((date: Date | null) => {
    setExpirationDate(date);
    if (validationErrors.expirationDate) {
      setValidationErrors(prev => ({ ...prev, expirationDate: '' }));
    }
  }, [validationErrors.expirationDate]);

  const isFormValid = useCallback(() => {
    return food.trim().length > 0 && Object.keys(validationErrors).length === 0;
  }, [food, validationErrors]);

  // Enhanced update function with validation and retry logic
  const handleUpdateItem = useCallback(async () => {
    if (!validateForm()) {
      Alert.alert("Validation Error", "Please fix the form errors before submitting.");
      return;
    }

    setUpdating(true);
    setError(null);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        throw new Error("User not authenticated. Please log in.");
      }
      const userId = userData.user.id;

      const { error } = await supabase
        .from("pantry")
        .update({
          food: food.trim(),
          quantity: quantity ? parseFloat(quantity) : null,
          unit: unit.trim() || null,
          expiration_date: expirationDate ? expirationDate.toISOString().split("T")[0] : null,
        })
        .eq("pantry_id", id)
        .eq("user_id", userId);

      if (error) {
        throw error;
      }

      Alert.alert("Success", "Pantry item updated successfully.", [
        { text: "OK", onPress: () => router.push("/pantry/pantry") }
      ]);
    } catch (error: any) {
      console.error("Error updating pantry item:", error);
      const errorMessage = error.message || "Failed to update pantry item.";
      setError(errorMessage);
      
      if (errorMessage.includes("not authenticated")) {
        Alert.alert("Authentication Error", errorMessage);
      } else {
        Alert.alert("Update Error", errorMessage);
      }
    } finally {
      setUpdating(false);
    }
  }, [validateForm, food, quantity, unit, expirationDate, id, router]);

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <View style={[styles.loadingCard, { backgroundColor: theme.card }]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading pantry item...</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.background }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => fetchPantryItem(true)}
          colors={[theme.primary]}
          tintColor={theme.primary}
        />
      }
    >
      {/* Error Banner */}
      {error && (
        <View style={[styles.errorBanner, { backgroundColor: theme.card, borderColor: theme.danger }]}>
          <Ionicons name="warning" size={20} color={theme.danger} />
          <Text style={[styles.errorBannerText, { color: theme.danger }]}>{error}</Text>
          <TouchableOpacity 
            style={[styles.errorBannerButton, { backgroundColor: theme.danger }]}
            onPress={handleRetry}
          >
            <Text style={[styles.errorBannerButtonText, { color: theme.buttonText }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Retry Banner */}
      {retryCount > 0 && !error && (
        <View style={[styles.retryBanner, { backgroundColor: theme.card, borderColor: theme.primary }]}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={[styles.retryBannerText, { color: theme.primary }]}>
            Retrying... (Attempt {retryCount})
          </Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="create-outline" size={32} color={theme.primary} />
        <Text style={[styles.title, { color: theme.text }]}>Edit Pantry Item</Text>
      </View>

      {/* Food Name Section */}
      <View style={[styles.formCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.formHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="restaurant-outline" size={20} color={theme.primary} style={{ marginRight: 8 }} />
            <Text style={[styles.sectionLabel, { color: theme.text }]}>Food Name *</Text>
          </View>
          <Text style={[styles.characterCount, { color: theme.subtext }]}>
            {food.length}/100
          </Text>
        </View>
        <TextInput
          style={[
            styles.input, 
            { 
              borderColor: validationErrors.food ? theme.danger : theme.border, 
              color: theme.text,
              backgroundColor: theme.background
            }
          ]}
          placeholder="Food Name"
          placeholderTextColor={theme.subtext}
          value={food}
          onChangeText={handleFoodChange}
          maxLength={100}
          editable={!updating}
        />
        {validationErrors.food && (
          <Text style={[styles.errorText, { color: theme.danger }]}>
            <Ionicons name="warning" size={12} color={theme.danger} /> {validationErrors.food}
          </Text>
        )}
      </View>

      {/* Quantity Section */}
      <View style={[styles.formCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.formHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="calculator-outline" size={20} color={theme.primary} style={{ marginRight: 8 }} />
            <Text style={[styles.sectionLabel, { color: theme.text }]}>Quantity (Optional)</Text>
          </View>
        </View>
        <TextInput
          style={[
            styles.input, 
            { 
              borderColor: validationErrors.quantity ? theme.danger : theme.border, 
              color: theme.text,
              backgroundColor: theme.background
            }
          ]}
          placeholder="Quantity (Optional)"
          placeholderTextColor={theme.subtext}
          keyboardType="numeric"
          value={quantity}
          onChangeText={handleQuantityChange}
          editable={!updating}
        />
        {validationErrors.quantity && (
          <Text style={[styles.errorText, { color: theme.danger }]}>
            <Ionicons name="warning" size={12} color={theme.danger} /> {validationErrors.quantity}
          </Text>
        )}
      </View>

      {/* Unit Section */}
      <View style={[styles.formCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.formHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="scale-outline" size={20} color={theme.primary} style={{ marginRight: 8 }} />
            <Text style={[styles.sectionLabel, { color: theme.text }]}>Unit</Text>
          </View>
          <Text style={[styles.characterCount, { color: theme.subtext }]}>
            {unit.length}/50
          </Text>
        </View>
        <TextInput
          style={[
            styles.input, 
            { 
              borderColor: validationErrors.unit ? theme.danger : theme.border, 
              color: theme.text,
              backgroundColor: theme.background
            }
          ]}
          placeholder="Unit (e.g., grams, cups)"
          placeholderTextColor={theme.subtext}
          value={unit}
          onChangeText={handleUnitChange}
          maxLength={50}
          editable={!updating}
        />
        {validationErrors.unit && (
          <Text style={[styles.errorText, { color: theme.danger }]}>
            <Ionicons name="warning" size={12} color={theme.danger} /> {validationErrors.unit}
          </Text>
        )}
      </View>

      {/* Date Picker Section */}
      <View style={[styles.formCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.formHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="calendar-outline" size={20} color={theme.primary} style={{ marginRight: 8 }} />
            <Text style={[styles.sectionLabel, { color: theme.text }]}>Expiration Date</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[
            styles.datePickerButton, 
            { 
              borderColor: validationErrors.expirationDate ? theme.danger : theme.border,
              backgroundColor: theme.background,
              opacity: updating ? 0.6 : 1
            }
          ]}
          onPress={() => !updating && setShowDatePicker(true)}
          disabled={updating}
        >
          <Text style={{ color: expirationDate ? theme.text : theme.subtext }}>
            {expirationDate ? expirationDate.toDateString() : "Select Expiration Date"}
          </Text>
        </TouchableOpacity>
        
        {expirationDate && (
          <TouchableOpacity 
            style={[styles.clearDateButton, { backgroundColor: theme.button, borderColor: theme.border }]}
            onPress={() => handleDateChange(null)}
            disabled={updating}
          >
            <Ionicons name="close-circle-outline" size={16} color={theme.buttonText} style={{ marginRight: 4 }} />
            <Text style={[styles.clearDateText, { color: theme.buttonText }]}>Clear Date</Text>
          </TouchableOpacity>
        )}
        
        {validationErrors.expirationDate && (
          <Text style={[styles.errorText, { color: theme.danger }]}>
            <Ionicons name="warning" size={12} color={theme.danger} /> {validationErrors.expirationDate}
          </Text>
        )}
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={expirationDate || new Date()}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowDatePicker(false);
            if (date) handleDateChange(date);
          }}
        />
      )}

      {/* Button Container */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.updateButton, 
            { 
              backgroundColor: isFormValid() && !updating ? theme.primary : theme.border,
              opacity: updating ? 0.6 : 1
            }
          ]}
          onPress={handleUpdateItem}
          disabled={!isFormValid() || updating}
        >
          {updating ? (
            <ActivityIndicator size="small" color={theme.buttonText} />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="checkmark-circle-outline" size={20} color={theme.buttonText} style={{ marginRight: 8 }} />
              <Text style={[styles.updateButtonText, { color: theme.buttonText }]}>Update Item</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.cancelButton, { backgroundColor: theme.button, borderColor: theme.border, opacity: updating ? 0.6 : 1 }]}
          onPress={() => router.push("/pantry/pantry")}
          disabled={updating}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="close-outline" size={20} color={theme.buttonText} style={{ marginRight: 8 }} />
            <Text style={[styles.cancelButtonText, { color: theme.buttonText }]}>Cancel</Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  loadingCard: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
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
  errorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    marginRight: 12,
  },
  errorBannerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  errorBannerButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  retryBanner: {
    flexDirection: 'row',
    justifyContent: 'center',
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
  retryBannerText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginLeft: 12,
  },
  
  // Enhanced Form Styles
  formCard: {
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  formSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  characterCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    marginLeft: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  datePickerButton: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    justifyContent: "center",
  },
  clearDateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  clearDateText: {
    fontSize: 14,
    fontWeight: '600',
  },
  buttonContainer: {
    marginTop: 32,
    gap: 16,
  },
  updateButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: "center",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  updateButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});

export default EditPantryItem;