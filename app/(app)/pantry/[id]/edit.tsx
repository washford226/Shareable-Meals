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
        .eq("id", id)
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
        .eq("id", id)
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
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>Loading pantry item...</Text>
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
          <Text style={[styles.retryBannerText, { color: theme.primary }]}>
            Retrying... (Attempt {retryCount})
          </Text>
        </View>
      )}

      <Text style={[styles.title, { color: theme.text }]}>Edit Pantry Item</Text>

      {/* Food Name Section */}
      <View style={styles.formSection}>
        <Text style={[styles.sectionLabel, { color: theme.text }]}>Food Name *</Text>
        <Text style={[styles.characterCount, { color: theme.subtext }]}>
          {food.length}/100
        </Text>
        <TextInput
          style={[
            styles.input, 
            { 
              borderColor: validationErrors.food ? theme.danger : theme.border, 
              color: theme.text 
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
          <Text style={[styles.errorText, { color: theme.danger }]}>{validationErrors.food}</Text>
        )}
      </View>

      {/* Quantity Section */}
      <View style={styles.formSection}>
        <Text style={[styles.sectionLabel, { color: theme.text }]}>Quantity (Optional)</Text>
        <TextInput
          style={[
            styles.input, 
            { 
              borderColor: validationErrors.quantity ? theme.danger : theme.border, 
              color: theme.text 
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
          <Text style={[styles.errorText, { color: theme.danger }]}>{validationErrors.quantity}</Text>
        )}
      </View>

      {/* Unit Section */}
      <View style={styles.formSection}>
        <Text style={[styles.sectionLabel, { color: theme.text }]}>Unit</Text>
        <Text style={[styles.characterCount, { color: theme.subtext }]}>
          {unit.length}/50
        </Text>
        <TextInput
          style={[
            styles.input, 
            { 
              borderColor: validationErrors.unit ? theme.danger : theme.border, 
              color: theme.text 
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
          <Text style={[styles.errorText, { color: theme.danger }]}>{validationErrors.unit}</Text>
        )}
      </View>

      {/* Date Picker Section */}
      <View style={styles.formSection}>
        <Text style={[styles.sectionLabel, { color: theme.text }]}>Expiration Date</Text>
        <TouchableOpacity
          style={[
            styles.datePickerButton, 
            { 
              borderColor: validationErrors.expirationDate ? theme.danger : theme.border,
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
            style={[styles.clearDateButton, { backgroundColor: theme.button }]}
            onPress={() => handleDateChange(null)}
            disabled={updating}
          >
            <Text style={[styles.clearDateText, { color: theme.buttonText }]}>Clear Date</Text>
          </TouchableOpacity>
        )}
        
        {validationErrors.expirationDate && (
          <Text style={[styles.errorText, { color: theme.danger }]}>{validationErrors.expirationDate}</Text>
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
            <Text style={[styles.updateButtonText, { color: theme.buttonText }]}>Update Item</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.cancelButton, { backgroundColor: theme.button, opacity: updating ? 0.6 : 1 }]}
          onPress={() => router.push("/pantry/pantry")}
          disabled={updating}
        >
          <Text style={[styles.cancelButtonText, { color: theme.buttonText }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
    marginRight: 12,
  },
  errorBannerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  errorBannerButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  retryBanner: {
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  retryBannerText: {
    fontSize: 14,
    fontWeight: '500',
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 24,
  },
  formSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  characterCount: {
    fontSize: 12,
    textAlign: 'right',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
  datePickerButton: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    justifyContent: "center",
  },
  clearDateButton: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  clearDateText: {
    fontSize: 14,
  },
  buttonContainer: {
    marginTop: 32,
    gap: 12,
  },
  updateButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  updateButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  cancelButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default EditPantryItem;