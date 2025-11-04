import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Image,
  Modal,
} from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../../../utils/supabase';
import { uploadProfileImage } from '../../../utils/profileImageUtils';
import { dietaryOptions } from '../../../constants/dietaryOptions';
import * as ImagePicker from 'expo-image-picker';

interface UserProfile {
  id: string;
  username: string;
  calories_goal: number;
  protein_goal: number;
  carbohydrates_goal: number;
  fat_goal: number;
  dietary_restrictions?: string;
  allergies?: string;
  profile_picture_url?: string;
}

export default function EditProfile() {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  
  // Form fields
  const [username, setUsername] = useState('');
  const [caloriesGoal, setCaloriesGoal] = useState('');
  const [proteinGoal, setProteinGoal] = useState('');
  const [carbohydratesGoal, setCarbohydratesGoal] = useState('');
  const [fatGoal, setFatGoal] = useState('');
  const [selectedDietaryOption, setSelectedDietaryOption] = useState<string | null>(null);
  const [allergies, setAllergies] = useState('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  
  // UI states
  const [isDietaryModalVisible, setIsDietaryModalVisible] = useState(false);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<null | boolean>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [originalUsername, setOriginalUsername] = useState('');
  
  // Validation errors
  const [errors, setErrors] = useState({
    username: '',
    caloriesGoal: '',
    proteinGoal: '',
    carbohydratesGoal: '',
    fatGoal: '',
  });

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to edit your profile.');
        router.back();
        return;
      }

      const { data: profileData, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        Alert.alert('Error', 'Failed to load profile data.');
        router.back();
        return;
      }

      if (profileData) {
        setProfile(profileData);
        setUsername(profileData.username || '');
        setOriginalUsername(profileData.username || '');
        setCaloriesGoal(profileData.calories_goal?.toString() || '2000');
        setProteinGoal(profileData.protein_goal?.toString() || '80');
        setCarbohydratesGoal(profileData.carbohydrates_goal?.toString() || '300');
        setFatGoal(profileData.fat_goal?.toString() || '60');
        setSelectedDietaryOption(profileData.dietary_restrictions || null);
        setAllergies(profileData.allergies || '');
        setProfilePicture(profileData.profile_picture_url || null);
      }
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
      Alert.alert('Error', 'Failed to load profile data.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const checkUsernameAvailability = async (newUsername: string) => {
    if (newUsername === originalUsername) {
      setIsUsernameAvailable(true);
      return;
    }

    if (newUsername.length < 3) {
      setIsUsernameAvailable(false);
      setErrors(prev => ({ ...prev, username: 'Username must be at least 3 characters long' }));
      return;
    }

    setCheckingUsername(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('username')
        .eq('username', newUsername.trim())
        .single();

      if (error && error.code === 'PGRST116') {
        // No rows returned, username is available
        setIsUsernameAvailable(true);
        setErrors(prev => ({ ...prev, username: '' }));
      } else if (data) {
        // Username exists
        setIsUsernameAvailable(false);
        setErrors(prev => ({ ...prev, username: 'Username is already taken' }));
      }
    } catch (error) {
      console.error('Error checking username:', error);
      setErrors(prev => ({ ...prev, username: 'Error checking username availability' }));
    } finally {
      setCheckingUsername(false);
    }
  };

  const validateForm = () => {
    const newErrors = {
      username: '',
      caloriesGoal: '',
      proteinGoal: '',
      carbohydratesGoal: '',
      fatGoal: '',
    };

    // Username validation
    if (!username.trim()) {
      newErrors.username = 'Username is required';
    } else if (username.trim().length < 3) {
      newErrors.username = 'Username must be at least 3 characters long';
    }

    // Nutrition goals validation
    const calories = parseInt(caloriesGoal);
    const protein = parseInt(proteinGoal);
    const carbs = parseInt(carbohydratesGoal);
    const fat = parseInt(fatGoal);

    if (!caloriesGoal || isNaN(calories) || calories < 1000 || calories > 5000) {
      newErrors.caloriesGoal = 'Calories must be between 1000 and 5000';
    }

    if (!proteinGoal || isNaN(protein) || protein < 10 || protein > 300) {
      newErrors.proteinGoal = 'Protein must be between 10 and 300 grams';
    }

    if (!carbohydratesGoal || isNaN(carbs) || carbs < 50 || carbs > 800) {
      newErrors.carbohydratesGoal = 'Carbohydrates must be between 50 and 800 grams';
    }

    if (!fatGoal || isNaN(fat) || fat < 20 || fat > 200) {
      newErrors.fatGoal = 'Fat must be between 20 and 200 grams';
    }

    setErrors(newErrors);
    return Object.values(newErrors).every(error => error === '');
  };

  const handleSaveProfile = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please correct the errors in the form.');
      return;
    }

    if (username !== originalUsername && !isUsernameAvailable) {
      Alert.alert('Username Error', 'Please choose a different username.');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to save changes.');
        return;
      }

      let profilePictureUrl: string | null | undefined = profile?.profile_picture_url;

      // Handle profile picture upload if changed
      if (profilePicture && profilePicture !== profile?.profile_picture_url) {
        try {
          profilePictureUrl = await uploadProfileImage(user.id, profilePicture);
        } catch (error) {
          console.error('Error uploading profile picture:', error);
          Alert.alert('Warning', 'Profile updated but profile picture upload failed.');
        }
      }

      const updateData = {
        username: username.trim(),
        calories_goal: parseInt(caloriesGoal),
        protein_goal: parseInt(proteinGoal),
        carbohydrates_goal: parseInt(carbohydratesGoal),
        fat_goal: parseInt(fatGoal),
        dietary_restrictions: selectedDietaryOption,
        allergies: allergies.trim() || null,
        profile_picture_url: profilePictureUrl,
      };

      const { error } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) {
        console.error('Error updating profile:', error);
        Alert.alert('Error', 'Failed to save profile changes. Please try again.');
        return;
      }

      Alert.alert('Success', 'Profile updated successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error in handleSaveProfile:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Sorry, we need camera roll permissions to change your profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets[0]) {
        setProfilePicture(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Edit Profile</Text>
          <View style={styles.backButton} />
        </View>
        <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Edit Profile</Text>
          <TouchableOpacity 
            onPress={handleSaveProfile} 
            style={styles.saveButton}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Text style={[styles.saveButtonText, { color: theme.primary }]}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Profile Picture Section */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Profile Picture</Text>
            <View style={styles.profilePictureContainer}>
              <TouchableOpacity onPress={pickImage} style={styles.profilePictureButton}>
                {profilePicture ? (
                  <Image 
                    source={{ uri: profilePicture }} 
                    style={styles.profilePicture}
                    onError={(error) => {
                      console.log('Failed to load profile picture:', error.nativeEvent.error);
                      setProfilePicture(null);
                    }}
                  />
                ) : (
                  <View style={[styles.profilePicturePlaceholder, { backgroundColor: theme.border }]}>
                    <Ionicons name="person" size={40} color={theme.textSecondary} />
                  </View>
                )}
                <View style={[styles.cameraIcon, { backgroundColor: theme.primary }]}>
                  <Ionicons name="camera" size={16} color="white" />
                </View>
              </TouchableOpacity>
              <Text style={[styles.profilePictureHint, { color: theme.textSecondary }]}>
                Tap to change profile picture
              </Text>
            </View>
          </View>

          {/* Basic Information */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Basic Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Username</Text>
              <View style={styles.usernameContainer}>
                <TextInput
                  style={[
                    styles.input,
                    { 
                      backgroundColor: theme.background,
                      borderColor: errors.username ? theme.danger : theme.border,
                      color: theme.text,
                    },
                  ]}
                  value={username}
                  onChangeText={(text) => {
                    setUsername(text);
                    if (text !== originalUsername) {
                      checkUsernameAvailability(text);
                    }
                  }}
                  placeholder="Enter username"
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="none"
                />
                {checkingUsername && (
                  <ActivityIndicator size="small" color={theme.primary} style={styles.usernameLoader} />
                )}
                {!checkingUsername && username !== originalUsername && isUsernameAvailable !== null && (
                  <Ionicons 
                    name={isUsernameAvailable ? "checkmark-circle" : "close-circle"}
                    size={20}
                    color={isUsernameAvailable ? theme.success : theme.danger}
                    style={styles.usernameLoader}
                  />
                )}
              </View>
              {errors.username ? (
                <Text style={[styles.errorText, { color: theme.danger }]}>{errors.username}</Text>
              ) : null}
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Allergies</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  { 
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
                value={allergies}
                onChangeText={setAllergies}
                placeholder="List any allergies (optional)"
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Dietary Preferences */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Dietary Preferences</Text>
            
            <TouchableOpacity
              style={[
                styles.dropdownButton,
                { backgroundColor: theme.background, borderColor: theme.border },
              ]}
              onPress={() => setIsDietaryModalVisible(true)}
            >
              <Text style={[styles.dropdownText, { color: selectedDietaryOption ? theme.text : theme.textSecondary }]}>
                {selectedDietaryOption || 'Select dietary preference (optional)'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Nutrition Goals */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Daily Nutrition Goals</Text>
            
            <View style={styles.nutritionGrid}>
              <View style={styles.nutritionInput}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Calories</Text>
                <TextInput
                  style={[
                    styles.input,
                    { 
                      backgroundColor: theme.background,
                      borderColor: errors.caloriesGoal ? theme.danger : theme.border,
                      color: theme.text,
                    },
                  ]}
                  value={caloriesGoal}
                  onChangeText={setCaloriesGoal}
                  placeholder="2000"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                />
                {errors.caloriesGoal ? (
                  <Text style={[styles.errorText, { color: theme.danger }]}>{errors.caloriesGoal}</Text>
                ) : null}
              </View>

              <View style={styles.nutritionInput}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Protein (g)</Text>
                <TextInput
                  style={[
                    styles.input,
                    { 
                      backgroundColor: theme.background,
                      borderColor: errors.proteinGoal ? theme.danger : theme.border,
                      color: theme.text,
                    },
                  ]}
                  value={proteinGoal}
                  onChangeText={setProteinGoal}
                  placeholder="80"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                />
                {errors.proteinGoal ? (
                  <Text style={[styles.errorText, { color: theme.danger }]}>{errors.proteinGoal}</Text>
                ) : null}
              </View>

              <View style={styles.nutritionInput}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Carbs (g)</Text>
                <TextInput
                  style={[
                    styles.input,
                    { 
                      backgroundColor: theme.background,
                      borderColor: errors.carbohydratesGoal ? theme.danger : theme.border,
                      color: theme.text,
                    },
                  ]}
                  value={carbohydratesGoal}
                  onChangeText={setCarbohydratesGoal}
                  placeholder="300"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                />
                {errors.carbohydratesGoal ? (
                  <Text style={[styles.errorText, { color: theme.danger }]}>{errors.carbohydratesGoal}</Text>
                ) : null}
              </View>

              <View style={styles.nutritionInput}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Fat (g)</Text>
                <TextInput
                  style={[
                    styles.input,
                    { 
                      backgroundColor: theme.background,
                      borderColor: errors.fatGoal ? theme.danger : theme.border,
                      color: theme.text,
                    },
                  ]}
                  value={fatGoal}
                  onChangeText={setFatGoal}
                  placeholder="60"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                />
                {errors.fatGoal ? (
                  <Text style={[styles.errorText, { color: theme.danger }]}>{errors.fatGoal}</Text>
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Dietary Options Modal */}
        <Modal
          visible={isDietaryModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setIsDietaryModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, { backgroundColor: theme.card }]}>
              <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Dietary Preferences</Text>
                <TouchableOpacity onPress={() => setIsDietaryModalVisible(false)}>
                  <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalContent}>
                <TouchableOpacity
                  style={[
                    styles.modalOption,
                    selectedDietaryOption === null && [styles.modalOptionSelected, { backgroundColor: theme.primary + '20' }],
                  ]}
                  onPress={() => {
                    setSelectedDietaryOption(null);
                    setIsDietaryModalVisible(false);
                  }}
                >
                  <Text style={[styles.modalOptionText, { color: theme.text }]}>None</Text>
                  {selectedDietaryOption === null && (
                    <Ionicons name="checkmark" size={20} color={theme.primary} />
                  )}
                </TouchableOpacity>
                {dietaryOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.modalOption,
                      selectedDietaryOption === option.value && [styles.modalOptionSelected, { backgroundColor: theme.primary + '20' }],
                    ]}
                    onPress={() => {
                      setSelectedDietaryOption(option.value);
                      setIsDietaryModalVisible(false);
                    }}
                  >
                    <Text style={[styles.modalOptionText, { color: theme.text }]}>{option.label}</Text>
                    {selectedDietaryOption === option.value && (
                      <Ionicons name="checkmark" size={20} color={theme.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    flex: 1,
    fontSize: theme.fonts.title,
    fontFamily: theme.fontFamily.semiBold,
    textAlign: 'center',
  },
  saveButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  saveButtonText: {
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.semiBold,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.body,
  },
  content: {
    flex: 1,
  },
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: theme.fonts.title,
    fontFamily: theme.fontFamily.semiBold,
    marginBottom: 16,
  },
  profilePictureContainer: {
    alignItems: 'center',
  },
  profilePictureButton: {
    position: 'relative',
  },
  profilePicture: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  profilePicturePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePictureHint: {
    marginTop: 8,
    fontSize: theme.fonts.subheadline,
    fontFamily: theme.fontFamily.body,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.medium,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.body,
  },
  textArea: {
    height: 80,
  },
  usernameContainer: {
    position: 'relative',
  },
  usernameLoader: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  errorText: {
    fontSize: theme.fonts.subheadline,
    fontFamily: theme.fontFamily.body,
    marginTop: 4,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dropdownText: {
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.body,
    flex: 1,
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  nutritionInput: {
    width: '48%',
    marginBottom: 16,
  },
  bottomSpacer: {
    height: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: theme.fonts.title,
    fontFamily: theme.fontFamily.semiBold,
  },
  modalContent: {
    maxHeight: 400,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalOptionSelected: {
    borderRadius: 8,
    marginHorizontal: 8,
  },
  modalOptionText: {
    fontSize: theme.fonts.body,
    fontFamily: theme.fontFamily.body,
  },
});