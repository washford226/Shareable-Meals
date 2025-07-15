import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import RNPickerSelect from 'react-native-picker-select';
import { useTheme } from '../../../context/ThemeContext';
import { supabase } from 'utils/supabase';

const dietaryOptions = [
  { label: 'None', value: 'None' },
  { label: 'Vegetarian', value: 'Vegetarian' },
  { label: 'Vegan', value: 'Vegan' },
  { label: 'Gluten-Free', value: 'Gluten-Free' },
  { label: 'Keto', value: 'Keto' },
  { label: 'Paleo', value: 'Paleo' },
];

const EditUserScreen: React.FC = () => {
  const [username, setUsername] = useState<string>('');
  const [caloriesGoal, setCaloriesGoal] = useState<string>('');
  const [proteinGoal, setProteinGoal] = useState<string>('');
  const [carbsGoal, setCarbsGoal] = useState<string>('');
  const [fatGoal, setFatGoal] = useState<string>('');
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string>('');
  const [allergies, setAllergies] = useState<string>('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { theme } = useTheme();
  const router = useRouter();

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
          Alert.alert('Error', 'User not authenticated. Please log in.');
          router.replace('/login');
          return;
        }
        const userId = userData.user.id;

        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) {
          throw error;
        }

        setUsername(data.username ?? '');
        setCaloriesGoal(data.calories_goal?.toString() ?? '');
        setProteinGoal(data.protein_goal?.toString() ?? '');
        setCarbsGoal(data.carbohydrates_goal?.toString() ?? '');
        setFatGoal(data.fat_goal?.toString() ?? '');
        setDietaryRestrictions(data.dietary_restrictions ?? '');
        setAllergies(data.allergies ?? '');
        setProfilePicture(data.profile_picture ?? null);
      } catch (error) {
        console.error('Error fetching user info:', error);
        Alert.alert('Error', 'Failed to fetch user information.');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const updateUserField = async (fields: Record<string, any>, successMsg: string, errorMsg: string) => {
    try {
      setLoading(true);
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        Alert.alert('Error', 'User not authenticated.');
        return;
      }
      const userId = userData.user.id;
      const { error } = await supabase.from('users').update(fields).eq('id', userId);
      if (error) {
        Alert.alert('Error', errorMsg);
      } else {
        Alert.alert('Success', successMsg);
      }
    } catch (error) {
      Alert.alert('Error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCaloriesGoal = async () => {
    if (!caloriesGoal) {
      Alert.alert('Error', 'Please enter a valid calorie goal.');
      return;
    }
    await updateUserField(
      { calories_goal: Number(caloriesGoal) },
      'Calorie goal updated successfully!',
      'Failed to update calorie goal.'
    );
  };

  const handleUpdateProteinGoal = async () => {
    if (!proteinGoal) {
      Alert.alert('Error', 'Please enter a valid protein goal.');
      return;
    }
    await updateUserField(
      { protein_goal: Number(proteinGoal) },
      'Protein goal updated successfully!',
      'Failed to update protein goal.'
    );
  };

  const handleUpdateCarbsGoal = async () => {
    if (!carbsGoal) {
      Alert.alert('Error', 'Please enter a valid carbs goal.');
      return;
    }
    await updateUserField(
      { carbohydrates_goal: Number(carbsGoal) },
      'Carbs goal updated successfully!',
      'Failed to update carbs goal.'
    );
  };

  const handleUpdateFatGoal = async () => {
    if (!fatGoal) {
      Alert.alert('Error', 'Please enter a valid fat goal.');
      return;
    }
    await updateUserField(
      { fat_goal: Number(fatGoal) },
      'Fat goal updated successfully!',
      'Failed to update fat goal.'
    );
  };

  const handleUpdateAllergies = async () => {
    if (!allergies) {
      Alert.alert('Error', 'Please enter your allergies.');
      return;
    }
    await updateUserField(
      { allergies },
      'Allergies updated successfully!',
      'Failed to update allergies.'
    );
  };

  const handleUpdateDietaryRestrictions = async () => {
    if (!dietaryRestrictions) {
      Alert.alert('Error', 'Please select dietary restrictions.');
      return;
    }
    await updateUserField(
      { dietary_restrictions: dietaryRestrictions },
      'Dietary restrictions updated successfully!',
      'Failed to update dietary restrictions.'
    );
  };

  const handleUpdateProfilePicture = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setLoading(true);
        const uri = result.assets[0].uri;
        // You should upload the image to Supabase Storage and save the public URL in the users table.
        // For simplicity, we'll just save the local URI here.
        // TODO: Replace this with actual upload logic if needed.
        await updateUserField(
          { profile_picture: uri },
          'Profile picture updated successfully!',
          'Failed to update profile picture.'
        );
        setProfilePicture(uri);
      }
    } catch (error) {
      console.error('Error updating profile picture:', error);
      Alert.alert('Error', 'Failed to update profile picture');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Picture */}
        <Text style={[styles.label, { color: theme.text }]}>Profile Picture</Text>
        {profilePicture ? (
          <Image source={{ uri: profilePicture }} style={styles.profilePicture} />
        ) : (
          <View style={[styles.profilePicturePlaceholder, { backgroundColor: theme.button }]}>
            <Text style={[styles.profilePicturePlaceholderText, { color: theme.text }]}>No Picture</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: theme.primary }]}
          onPress={handleUpdateProfilePicture}
        >
          <Text style={[styles.saveButtonText, { color: theme.buttonText }]}>Change Profile Picture</Text>
        </TouchableOpacity>

        {/* Calorie Goal */}
        <Text style={[styles.label, { color: theme.text }]}>Calorie Goal</Text>
        <TextInput
          style={[styles.input, { borderColor: theme.border, color: theme.text }]}
          placeholder="Enter new calorie goal"
          placeholderTextColor={theme.placeholder}
          value={caloriesGoal}
          onChangeText={setCaloriesGoal}
          keyboardType="numeric"
        />
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: theme.primary }]}
          onPress={handleUpdateCaloriesGoal}
        >
          <Text style={[styles.saveButtonText, { color: theme.buttonText }]}>Save Calorie Goal</Text>
        </TouchableOpacity>

        {/* Protein Goal */}
        <Text style={[styles.label, { color: theme.text }]}>Protein Goal (g)</Text>
        <TextInput
          style={[styles.input, { borderColor: theme.border, color: theme.text }]}
          placeholder="Enter new protein goal"
          placeholderTextColor={theme.placeholder}
          value={proteinGoal}
          onChangeText={setProteinGoal}
          keyboardType="numeric"
        />
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: theme.primary }]}
          onPress={handleUpdateProteinGoal}
        >
          <Text style={[styles.saveButtonText, { color: theme.buttonText }]}>Save Protein Goal</Text>
        </TouchableOpacity>

        {/* Carbs Goal */}
        <Text style={[styles.label, { color: theme.text }]}>Carbs Goal (g)</Text>
        <TextInput
          style={[styles.input, { borderColor: theme.border, color: theme.text }]}
          placeholder="Enter new carbs goal"
          placeholderTextColor={theme.placeholder}
          value={carbsGoal}
          onChangeText={setCarbsGoal}
          keyboardType="numeric"
        />
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: theme.primary }]}
          onPress={handleUpdateCarbsGoal}
        >
          <Text style={[styles.saveButtonText, { color: theme.buttonText }]}>Save Carbs Goal</Text>
        </TouchableOpacity>

        {/* Fat Goal */}
        <Text style={[styles.label, { color: theme.text }]}>Fat Goal (g)</Text>
        <TextInput
          style={[styles.input, { borderColor: theme.border, color: theme.text }]}
          placeholder="Enter new fat goal"
          placeholderTextColor={theme.placeholder}
          value={fatGoal}
          onChangeText={setFatGoal}
          keyboardType="numeric"
        />
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: theme.primary }]}
          onPress={handleUpdateFatGoal}
        >
          <Text style={[styles.saveButtonText, { color: theme.buttonText }]}>Save Fat Goal</Text>
        </TouchableOpacity>

        {/* Dietary Restrictions */}
        <Text style={[styles.label, { color: theme.text }]}>Dietary Restrictions</Text>
        <RNPickerSelect
          onValueChange={(value) => setDietaryRestrictions(value)}
          items={dietaryOptions}
          placeholder={{
            label: 'Select Dietary Restrictions',
            value: null,
          }}
          style={{
            inputIOS: styles.pickerInput,
            inputAndroid: styles.pickerInput,
          }}
          value={dietaryRestrictions}
        />
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: theme.primary }]}
          onPress={handleUpdateDietaryRestrictions}
        >
          <Text style={[styles.saveButtonText, { color: theme.buttonText }]}>Save Dietary Restrictions</Text>
        </TouchableOpacity>

        {/* Allergies */}
        <Text style={[styles.label, { color: theme.text }]}>Allergies</Text>
        <TextInput
          style={[styles.input, { borderColor: theme.border, color: theme.text }]}
          placeholder="Enter your allergies (comma-separated)"
          placeholderTextColor={theme.placeholder}
          value={allergies}
          onChangeText={setAllergies}
        />
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: theme.primary }]}
          onPress={handleUpdateAllergies}
        >
          <Text style={[styles.saveButtonText, { color: theme.buttonText }]}>Save Allergies</Text>
        </TouchableOpacity>

        {/* Navigation Buttons */}
        <TouchableOpacity
          style={[styles.navigationButton, { backgroundColor: theme.primary }]}
          onPress={() => router.push('/account/edit-email')}
        >
          <Text style={[styles.navigationButtonText, { color: theme.buttonText }]}>Edit Email</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navigationButton, { backgroundColor: theme.primary }]}
          onPress={() => router.push('/account/edit-password')}
        >
          <Text style={[styles.navigationButtonText, { color: theme.buttonText }]}>Edit Password</Text>
        </TouchableOpacity>

        {/* Back Button */}
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.button, borderColor: theme.border }]}
          onPress={() => router.push('/account/account')}
        >
          <Text style={[styles.backButtonText, { color: theme.text }]}>Back</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navigationButton: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    width: '100%',
  },
  navigationButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 10,
    textAlign: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 20,
    width: '100%',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 20,
    alignSelf: 'flex-start',
  },
  usernameText: {
    fontSize: 16,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    width: '100%',
  },
  saveButton: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    width: '100%',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  profilePicture: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginTop: 10,
    marginBottom: 10,
  },
  profilePicturePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  profilePicturePlaceholderText: {
    fontSize: 16,
  },
  pickerInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    backgroundColor: '#fff',
    fontSize: 16,
  },
});

export default EditUserScreen;
