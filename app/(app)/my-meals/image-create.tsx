import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Image,
  TextInput,
  Platform,
} from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../../utils/supabase';
import { 
  analyzeImageNutrition, 
  convertImageNutritionToMeal, 
  formatImageNutritionDisplay,
  validateImageNutritionData,
  ImageNutritionData 
} from '../../../utils/edamamImageUtils';

const ImageCreateMeal = () => {
  const { theme } = useTheme();
  const router = useRouter();
  
  // State management
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [nutritionData, setNutritionData] = useState<ImageNutritionData | null>(null);
  const [mealName, setMealName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Request permissions
  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Camera roll permissions are needed to select images.'
        );
        return false;
      }
    }
    return true;
  };

  // Pick image from library
  const pickImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedImage(asset.uri);
        setAnalysisError(null);
        setNutritionData(null);
        
        // Auto-analyze the image
        if (asset.base64) {
          await analyzeImage(asset.base64);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  // Take photo with camera
  const takePhoto = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Camera permissions are needed to take photos.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedImage(asset.uri);
        setAnalysisError(null);
        setNutritionData(null);
        
        // Auto-analyze the image
        if (asset.base64) {
          await analyzeImage(asset.base64);
        }
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  // Analyze image using Edamam Food Vision API
  const analyzeImage = async (base64Image: string) => {
    setAnalyzing(true);
    setAnalysisError(null);

    try {
      const result = await analyzeImageNutrition(base64Image, false);
      
      if ('error' in result) {
        setAnalysisError(result.details);
        return;
      }

      if (!validateImageNutritionData(result.nutrition)) {
        setAnalysisError('Could not detect valid nutrition information from this image. Please try a different image with clearer food items.');
        return;
      }

      setNutritionData(result.nutrition);
      setMealName(result.nutrition.foodLabel);
      
      // Auto-generate description
      const formatted = formatImageNutritionDisplay(result.nutrition);
      const autoDescription = [
        `Analyzed with Edamam Food Vision`,
        formatted.ingredients.length > 0 ? `Detected: ${formatted.ingredients.slice(0, 2).join(', ')}` : '',
        formatted.dietInfo ? `Diet: ${formatted.dietInfo}` : '',
        formatted.cautions ? `⚠️ ${formatted.cautions}` : ''
      ].filter(Boolean).join('\n');
      
      setDescription(autoDescription);

    } catch (error) {
      console.error('Error analyzing image:', error);
      setAnalysisError('Failed to analyze image. Please check your internet connection and try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  // Save meal to database
  const saveMeal = async () => {
    if (!nutritionData) {
      Alert.alert('Error', 'No nutrition data available. Please analyze an image first.');
      return;
    }

    if (!mealName.trim()) {
      Alert.alert('Error', 'Please enter a meal name.');
      return;
    }

    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to save meals.');
        return;
      }

      // Convert nutrition data to meal format
      const mealData = convertImageNutritionToMeal(nutritionData, mealName);
      
      // Add user-specific data
      const finalMealData = {
        ...mealData,
        description: description.trim() || mealData.description,
        user_id: user.id,
      };

      const { error } = await supabase
        .from('meals')
        .insert([finalMealData]);

      if (error) {
        console.error('Error saving meal:', error);
        Alert.alert('Error', 'Failed to save meal. Please try again.');
        return;
      }

      Alert.alert(
        'Success!', 
        'Your meal has been saved successfully.',
        [
          {
            text: 'OK',
            onPress: () => router.push('/(app)/my-meals/meals')
          }
        ]
      );

    } catch (error) {
      console.error('Error saving meal:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const formatDisplayValue = formatImageNutritionDisplay(nutritionData || {} as ImageNutritionData);

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          📸 Create from Image
        </Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        {/* Image Selection */}
        {!selectedImage ? (
          <View style={[styles.imageSelectionContainer, { borderColor: theme.border }]}>
            <Ionicons name="camera" size={64} color={theme.textSecondary} />
            <Text style={[styles.imageSelectionTitle, { color: theme.text }]}>
              Analyze Food with Edamam Vision
            </Text>
            <Text style={[styles.imageSelectionSubtitle, { color: theme.textSecondary }]}>
              Take a photo or select an image of your food for automatic nutrition analysis
            </Text>
            
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.imageButton, { backgroundColor: theme.primary }]}
                onPress={takePhoto}
              >
                <Ionicons name="camera" size={20} color={theme.buttonTextPrimary} />
                <Text style={[styles.imageButtonText, { color: theme.buttonTextPrimary }]}>
                  Take Photo
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.imageButton, { backgroundColor: theme.buttonSecondary }]}
                onPress={pickImage}
              >
                <Ionicons name="images" size={20} color={theme.text} />
                <Text style={[styles.imageButtonText, { color: theme.text }]}>
                  Choose Image
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {/* Selected Image */}
            <View style={[styles.imageContainer, { borderColor: theme.border }]}>
              <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
              <TouchableOpacity
                style={[styles.changeImageButton, { backgroundColor: theme.primary }]}
                onPress={() => {
                  setSelectedImage(null);
                  setNutritionData(null);
                  setAnalysisError(null);
                  setMealName('');
                  setDescription('');
                }}
              >
                <Ionicons name="refresh" size={16} color={theme.buttonTextPrimary} />
                <Text style={[styles.changeImageText, { color: theme.buttonTextPrimary }]}>
                  Change Image
                </Text>
              </TouchableOpacity>
            </View>

            {/* Analysis Status */}
            {analyzing && (
              <View style={[styles.analysisContainer, { backgroundColor: theme.card }]}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={[styles.analysisText, { color: theme.text }]}>
                  Analyzing image with Edamam Food Vision...
                </Text>
              </View>
            )}

            {/* Analysis Error */}
            {analysisError && (
              <View style={[styles.errorContainer, { backgroundColor: theme.dangerLight }]}>
                <Ionicons name="warning" size={20} color={theme.danger} />
                <Text style={[styles.errorText, { color: theme.danger }]}>
                  {analysisError}
                </Text>
                <TouchableOpacity
                  style={[styles.retryButton, { backgroundColor: theme.danger }]}
                  onPress={() => selectedImage && analyzeImage(selectedImage)}
                >
                  <Text style={[styles.retryButtonText, { color: theme.buttonTextPrimary }]}>
                    Retry Analysis
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Nutrition Results */}
            {nutritionData && (
              <>
                {/* Nutrition Display */}
                <View style={[styles.nutritionContainer, { backgroundColor: theme.card }]}>
                  <View style={styles.nutritionHeader}>
                    <Ionicons name="nutrition" size={24} color={theme.success} />
                    <Text style={[styles.nutritionTitle, { color: theme.text }]}>
                      Nutrition Analysis
                    </Text>
                  </View>
                  
                  <View style={styles.nutritionGrid}>
                    <View style={[styles.nutritionItem, { backgroundColor: theme.background }]}>
                      <Text style={[styles.nutritionValue, { color: '#FF6B6B' }]}>
                        {nutritionData.calories}
                      </Text>
                      <Text style={[styles.nutritionLabel, { color: theme.textSecondary }]}>
                        Calories
                      </Text>
                    </View>
                    
                    <View style={[styles.nutritionItem, { backgroundColor: theme.background }]}>
                      <Text style={[styles.nutritionValue, { color: '#4ECDC4' }]}>
                        {nutritionData.protein}g
                      </Text>
                      <Text style={[styles.nutritionLabel, { color: theme.textSecondary }]}>
                        Protein
                      </Text>
                    </View>
                    
                    <View style={[styles.nutritionItem, { backgroundColor: theme.background }]}>
                      <Text style={[styles.nutritionValue, { color: '#45B7D1' }]}>
                        {nutritionData.carbohydrates}g
                      </Text>
                      <Text style={[styles.nutritionLabel, { color: theme.textSecondary }]}>
                        Carbs
                      </Text>
                    </View>
                    
                    <View style={[styles.nutritionItem, { backgroundColor: theme.background }]}>
                      <Text style={[styles.nutritionValue, { color: '#F7DC6F' }]}>
                        {nutritionData.fat}g
                      </Text>
                      <Text style={[styles.nutritionLabel, { color: theme.textSecondary }]}>
                        Fat
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.servingInfo, { color: theme.textSecondary }]}>
                    {formatDisplayValue.servings} • {formatDisplayValue.weight}
                  </Text>

                  {/* Edamam Attribution */}
                  <View style={styles.attributionContainer}>
                    <Image 
                      source={require("../../../assets/images/Edamam_Badge_Transparent.svg")}
                      style={styles.attributionBadge}
                      resizeMode="contain"
                    />
                    <Text style={[styles.attributionText, { color: theme.textSecondary }]}>
                      Nutrition analysis powered by Edamam
                    </Text>
                  </View>
                </View>

                {/* Meal Details Form */}
                <View style={[styles.formContainer, { backgroundColor: theme.card }]}>
                  <Text style={[styles.formTitle, { color: theme.text }]}>
                    Meal Details
                  </Text>
                  
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: theme.text }]}>
                      Meal Name *
                    </Text>
                    <TextInput
                      style={[styles.textInput, { 
                        backgroundColor: theme.background, 
                        borderColor: theme.border,
                        color: theme.text 
                      }]}
                      value={mealName}
                      onChangeText={setMealName}
                      placeholder="Enter meal name"
                      placeholderTextColor={theme.textSecondary}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: theme.text }]}>
                      Description
                    </Text>
                    <TextInput
                      style={[styles.textArea, { 
                        backgroundColor: theme.background, 
                        borderColor: theme.border,
                        color: theme.text 
                      }]}
                      value={description}
                      onChangeText={setDescription}
                      placeholder="Optional description..."
                      placeholderTextColor={theme.textSecondary}
                      multiline
                      numberOfLines={4}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.saveButton, { 
                      backgroundColor: theme.primary,
                      opacity: saving ? 0.6 : 1
                    }]}
                    onPress={saveMeal}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color={theme.buttonTextPrimary} />
                    ) : (
                      <Ionicons name="checkmark" size={20} color={theme.buttonTextPrimary} />
                    )}
                    <Text style={[styles.saveButtonText, { color: theme.buttonTextPrimary }]}>
                      {saving ? 'Saving...' : 'Save Meal'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 50,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  content: {
    padding: 20,
  },
  imageSelectionContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 16,
    marginBottom: 20,
  },
  imageSelectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  imageSelectionSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  imageButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  imageContainer: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  selectedImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  changeImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 8,
  },
  changeImageText: {
    fontSize: 14,
    fontWeight: '600',
  },
  analysisContainer: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    marginBottom: 20,
  },
  analysisText: {
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  errorContainer: {
    flexDirection: 'column',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 8,
    lineHeight: 20,
  },
  retryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  nutritionContainer: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
  },
  nutritionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  nutritionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  nutritionItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  nutritionValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  nutritionLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  servingInfo: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  attributionContainer: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  attributionBadge: {
    width: 100,
    height: 35,
    marginBottom: 6,
  },
  attributionText: {
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  formContainer: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ImageCreateMeal;
