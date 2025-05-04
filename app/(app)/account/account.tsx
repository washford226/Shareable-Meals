import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, TextInput, StyleSheet, Platform, Image, Switch } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../../context/ThemeContext'; // Import the ThemeContext
import { Link, useRouter } from 'expo-router'; // Import Link and useRouter from Expo Router
import BottomNav from 'components/bottomNav';

const BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';

const AccountScreen: React.FC = () => {
  const [username, setUsername] = useState<string>('');
  const [caloriesGoal, setCaloriesGoal] = useState<number | null>(null);
  const [isEditingCaloriesGoal, setIsEditingCaloriesGoal] = useState<boolean>(false);
  const [newCaloriesGoal, setNewCaloriesGoal] = useState<string>('');
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string>('');
  const [isEditingDietaryRestrictions, setIsEditingDietaryRestrictions] = useState<boolean>(false);
  const [newDietaryRestrictions, setNewDietaryRestrictions] = useState<string>('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null); // State for profile picture
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');

  const { theme, toggleTheme } = useTheme(); // Access theme and toggleTheme from ThemeContext

  const router = useRouter();

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          throw new Error('No token found');
        }

        const response = await axios.get(`${BASE_URL}/user`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        setUsername(response.data.username);
        setCaloriesGoal(response.data.calories_goal);
        setDietaryRestrictions(response.data.dietary_restrictions);

        if (response.data.profile_picture) {
          setProfilePicture(response.data.profile_picture);
        } else {
          setProfilePicture(null);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, []);


  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('token');
      router.replace('/login'); // or whatever your login route is
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        throw new Error('No token found');
      }

      const response = await axios.delete(`${BASE_URL}/userdelete`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 200) {
        Alert.alert('Success', 'Account deleted successfully');
        handleLogout();
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      Alert.alert('Error', 'Failed to delete account');
    }
  };

  const handleEditCaloriesGoal = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        throw new Error('No token found');
      }

      const response = await axios.put(
        `${BASE_URL}/user/${username}`,
        { calories_goal: newCaloriesGoal },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 200) {
        setCaloriesGoal(parseInt(newCaloriesGoal, 10));
        setIsEditingCaloriesGoal(false);
        Alert.alert('Success', 'Calories goal updated successfully');
      }
    } catch (error) {
      console.error('Error updating calories goal:', error);
      Alert.alert('Error', 'Failed to update calories goal');
    }
  };

  const handleEditDietaryRestrictions = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        throw new Error('No token found');
      }

      const response = await axios.put(
        `${BASE_URL}/user/${username}`,
        { dietary_restrictions: newDietaryRestrictions },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 200) {
        setDietaryRestrictions(newDietaryRestrictions);
        setIsEditingDietaryRestrictions(false);
        Alert.alert('Success', 'Dietary restrictions updated successfully');
      }
    } catch (error) {
      console.error('Error updating dietary restrictions:', error);
      Alert.alert('Error', 'Failed to update dietary restrictions');
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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

        const response = await axios.post(`${BASE_URL}/upload-profile-picture`, formData, {
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
      <BottomNav /> 
      {/* Profile Picture */}
      {profilePicture ? (
        <Image source={{ uri: profilePicture }} style={styles.profilePicture} />
      ) : (
        <View style={[styles.profilePicturePlaceholder, { backgroundColor: theme.button }]}>
          <Text style={[styles.profilePicturePlaceholderText, { color: theme.text }]}>No Picture</Text>
        </View>
      )}
      <TouchableOpacity style={styles.updatePictureButton} onPress={pickImage}>
        <Text style={styles.updatePictureButtonText}>Update Profile Picture</Text>
      </TouchableOpacity>

      <Text style={[styles.title, { color: theme.text }]}>Welcome, {username}!</Text>

      {/* Calories Goal */}
      <View style={styles.row}>
        <Text style={[styles.leftAlignText, { color: theme.text }]}>Calories Goal: {caloriesGoal}</Text>
        <TouchableOpacity style={[styles.editButton, { backgroundColor: theme.button }]} onPress={() => setIsEditingCaloriesGoal(true)}>
          <Text style={[styles.editButtonText, { color: theme.buttonText }]}>Edit</Text>
        </TouchableOpacity>
      </View>
      {isEditingCaloriesGoal && (
        <View>
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.text }]}
            placeholder="Enter new calories goal"
            placeholderTextColor={theme.placeholder}
            value={newCaloriesGoal}
            onChangeText={setNewCaloriesGoal}
            keyboardType="numeric"
          />
          <TouchableOpacity onPress={handleEditCaloriesGoal}>
            <Text style={{ color: theme.button, marginTop: 10 }}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsEditingCaloriesGoal(false)}>
            <Text style={{ color: theme.danger, marginTop: 10 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Dietary Restrictions */}
      <View style={styles.row}>
        <Text style={[styles.leftAlignText, { color: theme.text }]}>Dietary Restrictions: {dietaryRestrictions}</Text>
        <TouchableOpacity style={[styles.editButton, { backgroundColor: theme.button }]} onPress={() => setIsEditingDietaryRestrictions(true)}>
          <Text style={[styles.editButtonText, { color: theme.buttonText }]}>Edit</Text>
        </TouchableOpacity>
      </View>
      {isEditingDietaryRestrictions && (
        <View>
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.text }]}
            placeholder="Enter new dietary restrictions"
            placeholderTextColor={theme.placeholder}
            value={newDietaryRestrictions}
            onChangeText={setNewDietaryRestrictions}
          />
          <TouchableOpacity onPress={handleEditDietaryRestrictions}>
            <Text style={{ color: theme.button, marginTop: 10 }}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsEditingDietaryRestrictions(false)}>
            <Text style={{ color: theme.danger, marginTop: 10 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Link to other screens */}
      <Link href="/(app)/account/edit-email">
        <Text style={{ color: theme.primary }}>Change Email</Text>
      </Link>

      <Link href="/(app)/account/edit-password">
        <Text style={{ color: theme.primary }}>Change Password</Text>
      </Link>

      <TouchableOpacity onPress={handleLogout}>
        <Text style={{ color: theme.danger, marginTop: 20 }}>Logout</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleDeleteAccount}>
        <Text style={{ color: theme.warning, marginTop: 20 }}>Delete Account</Text>
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
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  profilePicture: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
  },
  profilePicturePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePicturePlaceholderText: {
    color: 'white',
  },
  updatePictureButton: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#ccc',
    borderRadius: 5,
  },
  updatePictureButtonText: {
    color: '#333',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 15,
  },
  leftAlignText: {
    fontSize: 16,
  },
  editButton: {
    padding: 5,
    borderRadius: 5,
  },
  editButtonText: {
    color: 'white',
  },
  input: {
    width: '100%',
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderRadius: 5,
  },
  centeredRow: {
    alignItems: 'center',
    marginBottom: 20,
  },
  centeredButton: {
    padding: 15,
    borderRadius: 5,
    marginTop: 20,
  },
  buttonText: {
    fontSize: 16,
  },
  deleteButton: {
    padding: 15,
    borderRadius: 5,
    marginTop: 30,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 16,
  },
  logoutButton: {
    padding: 15,
    borderRadius: 5,
    marginTop: 20,
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 16,
  },
});

export default AccountScreen;
