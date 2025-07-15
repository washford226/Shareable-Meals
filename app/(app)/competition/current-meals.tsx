import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../../../context/ThemeContext";
import { supabase } from "utils/supabase";

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
  const [voting, setVoting] = useState(false);
  const router = useRouter();
  const { theme } = useTheme();

  // Fetch the latest competition from Supabase
  const fetchLatestCompetition = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("competitions")
        .select("*")
        .order("competition_id", { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        Alert.alert("No Competitions", "There are no active competitions.");
        setLoading(false);
        return;
      }

      setCompetitionId(data.competition_id);
      setCompetitionTheme(data.theme);
      fetchMeals(data.competition_id);
    } catch (error) {
      console.error("Error fetching competitions:", error);
      Alert.alert("Error", "Failed to fetch competitions. Please try again later.");
      setLoading(false);
    }
  };

  // Fetch meals for the given competition from Supabase
  const fetchMeals = async (competitionId: number) => {
    try {
      const { data, error } = await supabase
        .from("competition_meals_view") // Use a view or join to get meal name and votes
        .select("meal_id, name, votes")
        .eq("competition_id", competitionId);

      if (error) {
        throw error;
      }
      setMeals(data || []);
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

    setVoting(true);
    try {
      // Get current user
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        Alert.alert("Error", "User not authenticated. Please log in.");
        setVoting(false);
        return;
      }
      const userId = userData.user.id;

      // Check if user has already voted in this competition
      const { data: existingVote } = await supabase
        .from("competition_votes")
        .select("*")
        .eq("competition_id", competitionId)
        .eq("user_id", userId)
        .maybeSingle();

      if (existingVote) {
        Alert.alert("Error", "You have already voted in this competition.");
        setVoting(false);
        return;
      }

      // Insert vote
      const { error } = await supabase.from("competition_votes").insert([
        {
          competition_id: competitionId,
          meal_id: mealId,
          user_id: userId,
        },
      ]);

      if (error) {
        throw error;
      }

      Alert.alert("Success", "Your vote has been cast!");
      fetchMeals(competitionId); // Refresh the list to update vote counts
    } catch (error) {
      console.error("Error voting for meal:", error);
      Alert.alert("Error", "Failed to cast your vote. Please try again.");
    } finally {
      setVoting(false);
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
        onPress={() => router.push("/other-meals/other-meals")}
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
        onPress={() => router.push("/competition/add-meal")}
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
              disabled={voting}
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
