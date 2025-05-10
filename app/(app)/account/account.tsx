import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Image, Switch, StyleSheet, Platform } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../../context/ThemeContext'; // Import the ThemeContext
import BottomNav from 'components/bottomNav';
import { useRouter } from 'expo-router';

const BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';

const AccountScreen: React.FC = () => {
  const [username, setUsername] = useState<string>('');
  const [caloriesGoal, setCaloriesGoal] = useState<number | null>(null);
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string>('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [email, setEmail] = useState<string>(''); // State for email

  const { theme, toggleTheme } = useTheme(); // Access theme and toggleTheme
  const router = useRouter();

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          throw new Error('No token found');
        }

        const response = await axios.get(`${BASE_URL}/users/user`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        setUsername(response.data.username);
        setCaloriesGoal(response.data.calories_goal);
        setDietaryRestrictions(response.data.dietary_restrictions);
        setEmail(response.data.email); // Set the email from the response

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
      router.replace('/login');
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const handleDeleteAccount = async () => {
  Alert.alert(
    "Confirm Deletion",
    "Are you sure you want to delete your account? This action cannot be undone.",
    [
      {
        text: "Cancel",
        style: "cancel", // Makes the button appear as a cancel action
      },
      {
        text: "Delete",
        style: "destructive", // Highlights the button as a destructive action
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem("token");
            if (!token) {
              throw new Error("No token found");
            }

            const response = await axios.delete(`${BASE_URL}/users/userdelete`, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            if (response.status === 200) {
              Alert.alert("Success", "Account deleted successfully");
              handleLogout(); // Log out the user after account deletion
            }
          } catch (error) {
            console.error("Error deleting account:", error);
            Alert.alert("Error", "Failed to delete account");
          }
        },
      },
    ]
  );
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
      <Text style={[styles.title, { color: theme.text, marginBottom: 4 }]}>{username}</Text>

      {/* Email */}
      <View style={styles.centeredRow}>
        <Text style={[styles.email, { color: theme.text, marginVertical: 4 }]}>{email}</Text>
      </View>

      <View style={styles.row}>
        <Text style={[styles.title, { color: theme.text }]}>Meal Plan</Text>
      </View>

      {/* Calories Goal */}
      <View style={[styles.borderRow, { backgroundColor: theme.button, borderColor: theme.border, borderWidth: 1, borderRadius: 8, padding: 15 }]}>
        <Text style={[styles.leftAlignText, { color: theme.text, fontSize: 18 }]}>Calories Goal: {caloriesGoal}</Text>
      </View>

      {/* Dietary Restrictions */}
      <View style={[styles.borderRow, { backgroundColor: theme.button, borderColor: theme.border, borderWidth: 1, borderRadius: 8, padding: 15 }]}>
        <Text style={[styles.leftAlignText, { color: theme.text, fontSize: 18 }]}>Dietary Restrictions: {dietaryRestrictions}</Text>
      </View>

      <View style={styles.row}>
        <Text style={[styles.title, { color: theme.text }]}>Themes</Text>
      </View>

      {/* Dark Mode Toggle */}
      <View style={[styles.borderRow, { backgroundColor: theme.button, borderColor: theme.border, borderWidth: 1, borderRadius: 10, padding: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
        <Text style={[styles.themeButtonText, { color: theme.text }]}>
          {theme.background === '#121212' ? 'Dark Mode' : 'Light Mode'}
        </Text>
        <Switch
          value={theme.background === '#121212'} // Correctly reflects the current theme
          onValueChange={toggleTheme} // Toggles the theme
          thumbColor={theme.primary}
          trackColor={{ false: theme.border, true: theme.primary }}
          style={styles.switch} // Apply custom switch style
        />
      </View>

      {/* Edit User Information Button */}
      <TouchableOpacity
        style={[styles.editButton, { backgroundColor: theme.button, borderColor: theme.border, borderWidth: 1, borderRadius: 10 }]}
        onPress={() => router.push('./edit-user')} // Navigate to the edit user screen
      >
        <Text style={[styles.editButtonText, { color: theme.text, alignSelf: 'flex-start' }]}>
          Edit Information
        </Text>
      </TouchableOpacity>

      {/* Logout Button */}
      <TouchableOpacity
        style={[styles.logoutButton, { backgroundColor: theme.button, borderColor: theme.border, borderWidth: 1, borderRadius: 10 }]}
        onPress={handleLogout}
      >
        <Text style={[styles.logoutButtonText, { color: theme.buttonText, alignSelf: 'flex-start' }]}>Logout</Text>
      </TouchableOpacity>

      {/* Delete Account Button */}
      <TouchableOpacity
        style={[styles.deleteButton, { backgroundColor: theme.button, borderColor: theme.border, borderWidth: 1, borderRadius: 10 }]}
        onPress={handleDeleteAccount}
      >
        <Text style={[styles.deleteButtonText, { color: theme.danger, alignSelf: 'flex-start' }]}>Delete Account</Text>
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
  themeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  switch: {
    transform: [{ scaleX: 1.5 }, { scaleY: 1.5 }], // Make the switch bigger
  },
  borderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between', // Space between text and switch
    alignItems: 'center',
    width: '100%',
    marginBottom: 15,
  },
  editButton: {
    marginTop: 20,
    padding: 12,
    alignItems: 'center',
    width: '100%',
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoutButton: {
    marginTop: 20,
    padding: 12,
    alignItems: 'center',
    width: '100%',
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  deleteButton: {
    marginTop: 20,
    padding: 12,
    alignItems: 'center',
    width: '100%',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 15,
  },
  leftAlignText: {
    fontSize: 16,
  },
  centeredRow: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginBottom: 15,
  },
  email: {
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 10,
  },
});

export default AccountScreen;