import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme } from "../../../context/ThemeContext";
import { useRouter } from "expo-router";
import { supabase } from "utils/supabase";

const AddPantryItem = () => {
  const { theme } = useTheme();
  const router = useRouter();

  const [food, setFood] = useState(""); // Updated to match the database schema
  const [quantity, setQuantity] = useState(""); // Optional field
  const [unit, setUnit] = useState("");
  const [expirationDate, setExpirationDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const handleAddItem = useCallback(async () => {
    // Validation
    if (!food.trim()) {
      const errorMessage = "Food name is required.";
      setError(errorMessage);
      return;
    }

    if (food.trim().length > 100) {
      const errorMessage = "Food name must be 100 characters or less.";
      setError(errorMessage);
      return;
    }

    if (quantity && isNaN(parseFloat(quantity))) {
      const errorMessage = "Quantity must be a valid number.";
      setError(errorMessage);
      return;
    }

    if (quantity && parseFloat(quantity) <= 0) {
      const errorMessage = "Quantity must be greater than 0.";
      setError(errorMessage);
      return;
    }

    if (unit.length > 50) {
      const errorMessage = "Unit must be 50 characters or less.";
      setError(errorMessage);
      return;
    }

    if (expirationDate && expirationDate < new Date(new Date().setHours(0, 0, 0, 0))) {
      const errorMessage = "Expiration date cannot be in the past.";
      setError(errorMessage);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        throw new Error("User not authenticated. Please log in.");
      }
      const userId = userData.user.id;

      const { error } = await supabase.from("pantry").insert([
        {
          user_id: userId,
          food: food.trim(),
          quantity: quantity ? parseFloat(quantity) : null,
          unit: unit.trim() || null,
          expiration_date: expirationDate ? expirationDate.toISOString().split("T")[0] : null,
        },
      ]);

      if (error) {
        throw error;
      }

      Alert.alert("Success", "Pantry item added successfully!", [
        { text: "OK", onPress: () => router.push("/pantry/pantry") }
      ]);
      setRetryCount(0); // Reset retry count on success
    } catch (error: any) {
      console.error("Error adding pantry item:", error);
      const errorMessage = error.message || "Failed to add pantry item. Please try again later.";
      setError(errorMessage);
      
      // Auto-retry logic for network errors (not validation errors)
      if (!error.message?.includes("authenticated") && retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          handleAddItem();
        }, delay);
      }
    } finally {
      setLoading(false);
    }
  }, [food, quantity, unit, expirationDate, retryCount, router]);

  // Handle retry
  const handleRetry = useCallback(() => {
    setRetryCount(0);
    setError(null);
    handleAddItem();
  }, [handleAddItem]);

  // Clear error when user makes changes
  const handleFoodChange = useCallback((text: string) => {
    setFood(text);
    if (error) setError(null);
  }, [error]);

  const handleQuantityChange = useCallback((text: string) => {
    setQuantity(text);
    if (error) setError(null);
  }, [error]);

  const handleUnitChange = useCallback((text: string) => {
    setUnit(text);
    if (error) setError(null);
  }, [error]);

  const handleDateChange = useCallback((event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setExpirationDate(date);
      if (error) setError(null);
    }
  }, [error]);

  // Check if form is valid
  const isFormValid = useCallback(() => {
    return food.trim().length > 0 && 
           food.trim().length <= 100 && 
           (!quantity || (!isNaN(parseFloat(quantity)) && parseFloat(quantity) > 0)) &&
           unit.length <= 50 &&
           (!expirationDate || expirationDate >= new Date(new Date().setHours(0, 0, 0, 0)));
  }, [food, quantity, unit, expirationDate]);

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Error Banner */}
      {error && (
        <View style={[styles.errorBanner, { 
          backgroundColor: `${theme.danger}15`, 
          borderColor: theme.danger 
        }]}>
          <Text style={[styles.errorBannerText, { color: theme.danger }]}>
            {error}
          </Text>
          {!error.includes("authenticated") && (
            <TouchableOpacity
              style={[styles.errorBannerButton, { backgroundColor: theme.danger }]}
              onPress={handleRetry}
            >
              <Text style={[styles.errorBannerButtonText, { color: theme.buttonText }]}>
                Retry
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Retry Banner */}
      {retryCount > 0 && (
        <View style={[styles.retryBanner, { 
          backgroundColor: `${theme.warning}15`, 
          borderColor: theme.warning 
        }]}>
          <Text style={[styles.retryBannerText, { color: theme.warning }]}>
            Retry attempt {retryCount}/3
          </Text>
        </View>
      )}

      <Text style={[styles.title, { color: theme.text }]}>Add Pantry Item</Text>

      <View style={styles.formSection}>
        <Text style={[styles.sectionLabel, { color: theme.text }]}>Food Name *</Text>
        <Text style={[styles.characterCount, { color: theme.subtext }]}>
          {food.length}/100 characters
        </Text>
        <TextInput
          style={[
            styles.input, 
            { 
              borderColor: error && (food.length === 0 || food.length > 100) ? theme.danger : theme.border, 
              color: theme.text 
            }
          ]}
          placeholder="Enter food name"
          placeholderTextColor={theme.placeholder}
          value={food}
          onChangeText={handleFoodChange}
          maxLength={100}
        />
      </View>

      <View style={styles.formSection}>
        <Text style={[styles.sectionLabel, { color: theme.text }]}>Quantity (Optional)</Text>
        <TextInput
          style={[
            styles.input, 
            { 
              borderColor: error && quantity && (isNaN(parseFloat(quantity)) || parseFloat(quantity) <= 0) ? theme.danger : theme.border, 
              color: theme.text 
            }
          ]}
          placeholder="Enter quantity (e.g., 2, 1.5)"
          placeholderTextColor={theme.placeholder}
          keyboardType="numeric"
          value={quantity}
          onChangeText={handleQuantityChange}
        />
      </View>

      <View style={styles.formSection}>
        <Text style={[styles.sectionLabel, { color: theme.text }]}>Unit (Optional)</Text>
        <Text style={[styles.characterCount, { color: theme.subtext }]}>
          {unit.length}/50 characters
        </Text>
        <TextInput
          style={[
            styles.input, 
            { 
              borderColor: error && unit.length > 50 ? theme.danger : theme.border, 
              color: theme.text 
            }
          ]}
          placeholder="Enter unit (e.g., grams, cups, pieces)"
          placeholderTextColor={theme.placeholder}
          value={unit}
          onChangeText={handleUnitChange}
          maxLength={50}
        />
      </View>

      <View style={styles.formSection}>
        <Text style={[styles.sectionLabel, { color: theme.text }]}>Expiration Date (Optional)</Text>
        <TouchableOpacity
          style={[
            styles.datePickerButton, 
            { 
              borderColor: error && expirationDate && expirationDate < new Date(new Date().setHours(0, 0, 0, 0)) ? theme.danger : theme.border 
            }
          ]}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={{ color: expirationDate ? theme.text : theme.placeholder }}>
            {expirationDate ? expirationDate.toDateString() : "Select Expiration Date"}
          </Text>
        </TouchableOpacity>
        
        {expirationDate && (
          <TouchableOpacity
            style={[styles.clearDateButton, { backgroundColor: theme.border }]}
            onPress={() => {
              setExpirationDate(null);
              if (error) setError(null);
            }}
          >
            <Text style={[styles.clearDateText, { color: theme.text }]}>Clear Date</Text>
          </TouchableOpacity>
        )}
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={expirationDate || new Date()}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={handleDateChange}
        />
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.addButton, 
            { 
              backgroundColor: isFormValid() ? theme.primary : theme.border,
              opacity: isFormValid() ? 1 : 0.5
            }
          ]}
          onPress={handleAddItem}
          disabled={loading || !isFormValid()}
        >
          {loading ? (
            <ActivityIndicator size="small" color={theme.buttonText} />
          ) : (
            <Text style={[styles.addButtonText, { color: theme.buttonText }]}>
              Add Item
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.cancelButton, { backgroundColor: theme.border }]}
          onPress={() => router.push("/pantry/pantry")}
          disabled={loading}
        >
          <Text style={[styles.cancelButtonText, { color: theme.text }]}>Cancel</Text>
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
  addButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  addButtonText: {
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

export default AddPantryItem;
