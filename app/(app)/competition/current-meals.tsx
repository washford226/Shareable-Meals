import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useTheme } from "../../../context/ThemeContext";

const BASE_URL = Platform.OS === "android" ? "http://10.0.2.2:5000" : "http://localhost:5000";

const CurrentMeals = () => {
  interface Meal {
    meal_id: number;
    name: string;
    votes: number;
  }

  interface Competition {
    competition_id: number;
    start_date: string;
    end_date: string;
    theme: string;
  }

  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [competitionId, setCompetitionId] = useState<number | null>(null);
  const [competitionTheme, setCompetitionTheme] = useState<string | null>(null);
  const [voting, setVoting] = useState(false); // State to track voting
  const router = useRouter();
  const { theme } = useTheme();

  // Fetch the latest competition
  const fetchLatestCompetition = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "User not authenticated. Please log in.");
        setLoading(false);
        return;
      }

      const response = await axios.get(`${BASE_URL}/comp/competitions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const competitions: Competition[] = response.data;

      if (competitions.length === 0) {
        Alert.alert("No Competitions", "There are no active competitions.");
        setLoading(false);
        return;
      }

      // Get the competition with the highest ID
      const latestCompetition = competitions.reduce((prev, current) =>
        prev.competition_id > current.competition_id ? prev : current
      );

      setCompetitionId(latestCompetition.competition_id);
      setCompetitionTheme(latestCompetition.theme);
      fetchMeals(latestCompetition.competition_id, token); // Fetch meals for the latest competition
    } catch (error) {
      console.error("Error fetching competitions:", error);
      Alert.alert("Error", "Failed to fetch competitions. Please try again later.");
      setLoading(false);
    }
  };

  // Fetch meals for the given competition
  const fetchMeals = async (competitionId: number, token: string) => {
    try {
      const response = await axios.get(`${BASE_URL}/comp/competitions/${competitionId}/meals`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setMeals(response.data);
    } catch (error) {
      console.error("Error fetching meals:", error);
      Alert.alert("Error", "Failed to fetch meals. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // Handle voting for a meal
  const handleVote = async (mealId: number) => {
    if (!competitionId) return;

    setVoting(true); // Disable voting while processing
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "User not authenticated. Please log in.");
        setVoting(false);
        return;
      }

      await axios.post(
        `${BASE_URL}/comp/competitions/${competitionId}/vote`,
        { meal_id: mealId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      Alert.alert("Success", "Your vote has been cast!");
      fetchMeals(competitionId, token); // Refresh the list to update vote counts
    } catch (error) {
      console.error("Error voting for meal:", error);
      if (axios.isAxiosError(error)) {
        Alert.alert("Error", error.response?.data?.error || "Failed to cast your vote. Please try again.");
      } else {
        Alert.alert("Error", "An unexpected error occurred. Please try again later.");
      }
    } finally {
      setVoting(false); // Re-enable voting
    }
  };

  useEffect(() => {
    fetchLatestCompetition();
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!competitionId) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.emptyText, { color: theme.subtext }]}>
          No active competitions available.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Back Button */}
      <TouchableOpacity
        style={[styles.backButton, { backgroundColor: theme.primary }]}
        onPress={() => router.push("/other-meals/other-meals")} // Navigate back to the other-meals screen
      >
        <Text style={[styles.backButtonText, { color: theme.buttonText }]}>Back</Text>
      </TouchableOpacity>

      {/* Competition Theme */}
      {competitionTheme && (
        <Text style={[styles.themeText, { color: theme.text }]}>
          Current Theme: {competitionTheme}
        </Text>
      )}

      {/* Add Meal Button */}
      <TouchableOpacity
        style={[styles.addMealButton, { backgroundColor: theme.primary }]}
        onPress={() => router.push("/competition/add-meal")} // Navigate to the Add Meal screen
      >
        <Text style={[styles.addMealButtonText, { color: theme.buttonText }]}>Add Meal</Text>
      </TouchableOpacity>

      {/* Meals List */}
      <FlatList
        data={meals}
        keyExtractor={(item) => item.meal_id.toString()}
        renderItem={({ item }) => (
          <View style={[styles.mealContainer, { backgroundColor: theme.card }]}>
            <Text style={[styles.mealName, { color: theme.text }]}>{item.name}</Text>
            <Text style={[styles.mealVotes, { color: theme.subtext }]}>
              Votes: {item.votes}
            </Text>
            <TouchableOpacity
              style={[styles.voteButton, { backgroundColor: theme.primary }]}
              onPress={() => handleVote(item.meal_id)}
              disabled={voting} // Disable button while voting
            >
              <Text style={[styles.voteButtonText, { color: theme.buttonText }]}>
                {voting ? "Voting..." : "Vote"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: theme.subtext }]}>
            No meals have been added to this competition yet.
          </Text>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  backButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  themeText: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  addMealButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  addMealButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  mealContainer: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mealName: {
    fontSize: 16,
    fontWeight: "bold",
    flex: 1,
  },
  mealVotes: {
    fontSize: 14,
    marginRight: 16,
  },
  voteButton: {
    padding: 8,
    borderRadius: 8,
  },
  voteButtonText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 32,
  },
});

export default CurrentMeals;