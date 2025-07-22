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
    user_id: string;
    username?: string;
  }

  interface Competition {
    competition_id: number;
    start_date: string;
    end_date: string;
    theme_name: string;
    status: string;
  }

  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [competitionId, setCompetitionId] = useState<number | null>(null);
  const [competitionTheme, setCompetitionTheme] = useState<string | null>(null);
  const [competitionStatus, setCompetitionStatus] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);
  const router = useRouter();
  const { theme } = useTheme();

  // Fetch the latest competition from Supabase
  const fetchLatestCompetition = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("weekly_competitions")
        .select(`
          competition_id,
          start_date,
          end_date,
          status,
          competition_themes!fk_theme_id (
            theme_name
          )
        `)
        .eq("status", "active")
        .order("competition_id", { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        // If no active competition, try to get the latest one
        const { data: latestData, error: latestError } = await supabase
          .from("weekly_competitions")
          .select(`
            competition_id,
            start_date,
            end_date,
            status,
            competition_themes!fk_theme_id (
              theme_name
            )
          `)
          .order("competition_id", { ascending: false })
          .limit(1)
          .single();

        if (latestError || !latestData) {
          Alert.alert("No Competitions", "There are no competitions available.");
          setLoading(false);
          return;
        }

        setCompetitionId(latestData.competition_id);
        setCompetitionTheme(latestData.competition_themes?.[0]?.theme_name || "Unknown Theme");
        setCompetitionStatus(latestData.status);
        fetchMeals(latestData.competition_id);
        return;
      }

      setCompetitionId(data.competition_id);
      setCompetitionTheme(data.competition_themes?.[0]?.theme_name || "Unknown Theme");
      setCompetitionStatus(data.status);
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
        .from("competition_submissions")
        .select(`
          meal_id,
          meals!competition_submissions_meal_id_fkey (
            id,
            name
          ),
          user_profiles!competition_submissions_user_id_fkey (
            id,
            username
          )
        `)
        .eq("competition_id", competitionId);

      if (error) {
        throw error;
      }

      // Process the data to include vote counts
      const mealsWithVotes = await Promise.all(
        (data || []).map(async (submission: any) => {
          const { data: voteData } = await supabase
            .from("meal_votes")
            .select("vote_id")
            .eq("meal_id", submission.meal_id)
            .eq("competition_id", competitionId);

          return {
            meal_id: submission.meal_id,
            name: submission.meals?.name || "Unknown Meal",
            votes: voteData?.length || 0,
            user_id: submission.user_profiles?.id || "",
            username: submission.user_profiles?.username || "Unknown User",
          };
        })
      );

      setMeals(mealsWithVotes);
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

      // Check if user has already voted for this meal in this competition
      const { data: existingVote } = await supabase
        .from("meal_votes")
        .select("*")
        .eq("competition_id", competitionId)
        .eq("user_id", userId)
        .eq("meal_id", mealId)
        .maybeSingle();

      if (existingVote) {
        Alert.alert("Error", "You have already voted for this meal in this competition.");
        setVoting(false);
        return;
      }

      // Insert vote
      const { error } = await supabase.from("meal_votes").insert([
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
        {/* Back Button */}
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.primary }]}
          onPress={() => router.push("/other-meals/other-meals")}
        >
          <Text style={[styles.backButtonText, { color: theme.buttonText }]}>Back</Text>
        </TouchableOpacity>
        
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
        <View style={styles.competitionInfo}>
          <Text style={[styles.themeText, { color: theme.text }]}>
            Current Theme: {competitionTheme}
          </Text>
          {competitionStatus && (
            <Text style={[styles.statusText, { color: theme.subtext }]}>
              Status: {competitionStatus.charAt(0).toUpperCase() + competitionStatus.slice(1)}
            </Text>
          )}
        </View>
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
            <View style={styles.mealInfo}>
              <Text style={[styles.mealName, { color: theme.text }]}>{item.name}</Text>
              <Text style={[styles.mealUser, { color: theme.subtext }]}>
                by {item.username}
              </Text>
              <Text style={[styles.mealVotes, { color: theme.subtext }]}>
                Votes: {item.votes}
              </Text>
            </View>
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
  competitionInfo: {
    marginBottom: 16,
    alignItems: "center",
  },
  themeText: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
    textAlign: "center",
  },
  statusText: {
    fontSize: 14,
    fontStyle: "italic",
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
  mealInfo: {
    flex: 1,
  },
  mealName: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 2,
  },
  mealUser: {
    fontSize: 12,
    fontStyle: "italic",
    marginBottom: 2,
  },
  mealVotes: {
    fontSize: 14,
  },
  voteButton: {
    padding: 8,
    borderRadius: 8,
    marginLeft: 16,
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
