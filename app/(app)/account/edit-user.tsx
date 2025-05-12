import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import RNPickerSelect from 'react-native-picker-select';
import axios from 'axios';
import { useTheme } from '../../../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';

const EditUserScreen: React.FC = () => {
  const [username, setUsername] = useState<string>(''); // Add username state
  const [caloriesGoal, setCaloriesGoal] = useState<string>('');
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string>('');
  const [allergies, setAllergies] = useState<string>(''); // State for allergies
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { theme } = useTheme();
  const router = useRouter();

  const dietaryOptions = [
    { label: 'None', value: 'None' },
    { label: 'Vegetarian', value: 'Vegetarian' },
    { label: 'Vegan', value: 'Vegan' },
    { label: 'Gluten-Free', value: 'Gluten-Free' },
    { label: 'Keto', value: 'Keto' },
    { label: 'Paleo', value: 'Paleo' },
  ];

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          throw new Error('No token found');
        }

        const response = await axios.get(`${BASE_URL}/users/user`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.status === 200) {
          const { username, calories_goal, dietary_restrictions, profile_picture } = response.data;
          setUsername(username); // Set the username
          setCaloriesGoal(calories_goal || '');
          setDietaryRestrictions(dietary_restrictions || '');
          setAllergies(allergies || ''); 
          setProfilePicture(profile_picture || null);
        }
      } catch (error) {
        console.error('Error fetching user info:', error);
        Alert.alert('Error', 'Failed to fetch user information.');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleUpdateCaloriesGoal = async () => {
    if (!caloriesGoal) {
      Alert.alert('Error', 'Please enter a valid calorie goal.');
      return;
    }
  
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'User not authenticated.');
        return;
      }
  
      const response = await axios.put(
        `${BASE_URL}/users/user/${username}`, // Include username in the URL
        { calories_goal: caloriesGoal },
        { headers: { Authorization: `Bearer ${token}` } }
      );
  
      if (response.status === 200) {
        Alert.alert('Success', 'Calorie goal updated successfully!');
      } else {
        Alert.alert('Error', 'Failed to update calorie goal.');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Error updating calorie goal:', error.response?.data || error.message);
      } else {
        console.error('Error updating calorie goal:', error);
      }
      if (axios.isAxiosError(error)) {
        Alert.alert('Error', error.response?.data?.message || 'Failed to update calorie goal.');
      } else {
        Alert.alert('Error', 'Failed to update calorie goal.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAllergies = async () => {
  if (!allergies) {
    Alert.alert('Error', 'Please enter your allergies.');
    return;
  }

  try {
    setLoading(true);
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      Alert.alert('Error', 'User not authenticated.');
      return;
    }

    const response = await axios.put(
      `${BASE_URL}/users/user/${username}`, // Include username in the URL
      { allergies }, // Update allergies
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (response.status === 200) {
      Alert.alert('Success', 'Allergies updated successfully!');
    } else {
      Alert.alert('Error', 'Failed to update allergies.');
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Error updating allergies:', error.response?.data || error.message);
    } else {
      console.error('Error updating allergies:', error);
    }
    Alert.alert('Error', 'Failed to update allergies.');
  } finally {
    setLoading(false);
  }
};

  const handleUpdateDietaryRestrictions = async () => {
    if (!dietaryRestrictions) {
      Alert.alert('Error', 'Please select dietary restrictions.');
      return;
    }
  
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'User not authenticated.');
        return;
      }
  
      const response = await axios.put(
        `${BASE_URL}/users/user/${username}`, // Include username in the URL
        { dietary_restrictions: dietaryRestrictions },
        { headers: { Authorization: `Bearer ${token}` } }
      );
  
      if (response.status === 200) {
        Alert.alert('Success', 'Dietary restrictions updated successfully!');
      } else {
        Alert.alert('Error', 'Failed to update dietary restrictions.');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Error updating dietary restrictions:', error.response?.data || error.message);
      } else {
        console.error('Error updating dietary restrictions:', error);
      }
      if (axios.isAxiosError(error)) {
        Alert.alert('Error', error.response?.data?.message || 'Failed to update dietary restrictions.');
      } else {
        Alert.alert('Error', 'Failed to update dietary restrictions.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfilePicture = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1], // Square aspect ratio
        quality: 1,
      });

      if (!result.canceled) {
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          throw new Error('No token found');
        }

        const formData = new FormData();
        formData.append('profile_picture', {
          uri: result.assets[0].uri,
          name: 'profile_picture.jpg',
          type: 'image/jpeg',
        } as any);

        const response = await axios.post(`${BASE_URL}/users/upload-profile-picture`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        });

        if (response.status === 200) {
          Alert.alert('Success', 'Profile picture updated successfully');
          setProfilePicture(result.assets[0].uri); // Update the profile picture state
        }
      }
    } catch (error) {
      console.error('Error updating profile picture:', error);
      Alert.alert('Error', 'Failed to update profile picture');
    }
  };


  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>

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