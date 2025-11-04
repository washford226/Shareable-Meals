/**
 * Competition Utility Functions
 * Helper functions for competition-related database operations with Supabase
 */

import { supabase } from './supabase';

export interface Competition {
  competition_id: number;
  theme_id: number;
  start_date: string;
  end_date: string;
  status: 'active' | 'upcoming' | 'ended';
  total_entries?: number;
  created_at: string;
  theme?: {
    theme_name: string;
    description?: string;
  };
}

export interface CompetitionSubmission {
  id: number;
  competition_id: number;
  meal_id: number;
  user_id: string;
  submitted_at: string;
  vote_count: number;
  rank?: number;
  meal: {
    id: number;
    name: string;
    description?: string;
    meal_picture_url?: string; // Updated column name
    calories?: number;
    cook_time?: string;
    cuisine?: string;
  };
  user_profile: {
    id: string;
    username: string;
    profile_picture?: any; // bytea field
  };
  user_has_voted?: boolean;
}

export interface CompetitionVote {
  vote_id: number;
  user_id: string;
  meal_id: number;
  competition_id: number;
  created_at: string;
}

/**
 * Get all competitions with their current status and entry counts
 */
export async function getCompetitions(): Promise<Competition[]> {
  try {
    const { data: competitionsData, error } = await supabase
      .from('weekly_competitions')
      .select(`
        *,
        theme:competition_themes(theme_name, description)
      `)
      .order('start_date', { ascending: false })
      .limit(20);

    if (error) throw error;

    if (!competitionsData) return [];

    // Process competitions to add status and entry counts
    const processedCompetitions = await Promise.all(
      competitionsData.map(async (comp) => {
        // Determine status based on dates
        const startDate = new Date(comp.start_date);
        const endDate = new Date(comp.end_date);
        const nowDate = new Date();
        
        let status: 'active' | 'upcoming' | 'ended' = 'upcoming';
        if (nowDate >= startDate && nowDate <= endDate) {
          status = 'active';
        } else if (nowDate > endDate) {
          status = 'ended';
        }

        // Get submission count for this competition
        const { count: entryCount } = await supabase
          .from('competition_submissions')
          .select('*', { count: 'exact', head: true })
          .eq('competition_id', comp.competition_id);

        return {
          ...comp,
          status,
          total_entries: entryCount || 0
        };
      })
    );

    return processedCompetitions;
  } catch (error) {
    console.error('Error fetching competitions:', error);
    throw error;
  }
}

/**
 * Get a specific competition by ID
 */
export async function getCompetition(competitionId: number): Promise<Competition | null> {
  try {
    const { data: competitionData, error } = await supabase
      .from('weekly_competitions')
      .select(`
        *,
        theme:competition_themes(theme_name, description)
      `)
      .eq('competition_id', competitionId)
      .single();

    if (error) throw error;

    if (!competitionData) return null;

    // Determine status based on dates
    const startDate = new Date(competitionData.start_date);
    const endDate = new Date(competitionData.end_date);
    const nowDate = new Date();
    
    let status: 'active' | 'upcoming' | 'ended' = 'upcoming';
    if (nowDate >= startDate && nowDate <= endDate) {
      status = 'active';
    } else if (nowDate > endDate) {
      status = 'ended';
    }

    // Get submission count for this competition
    const { count: entryCount } = await supabase
      .from('competition_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('competition_id', competitionId);

    return {
      ...competitionData,
      status,
      total_entries: entryCount || 0
    };
  } catch (error) {
    console.error('Error fetching competition:', error);
    throw error;
  }
}

/**
 * Get submissions for a competition with vote data
 */
export async function getCompetitionSubmissions(
  competitionId: number, 
  userId?: string
): Promise<CompetitionSubmission[]> {
  try {
    // Fetch submissions with meal data and user profile data
    const { data: submissionsData, error } = await supabase
      .from('competition_submissions')
      .select(`
        *,
        meal:meals(*),
        user_profile:user_profiles(id, username, profile_picture)
      `)
      .eq('competition_id', competitionId)
      .order('submitted_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    if (!submissionsData) return [];

    // Get vote counts for each submission
    const submissionIds = submissionsData.map(s => s.id);
    const { data: voteCounts } = await supabase
      .from('meal_votes')
      .select('meal_id')
      .eq('competition_id', competitionId)
      .in('meal_id', submissionIds.map(id => submissionsData.find(s => s.id === id)?.meal_id).filter(Boolean));

    // Count votes per meal
    const voteCountMap = new Map<number, number>();
    voteCounts?.forEach(vote => {
      const currentCount = voteCountMap.get(vote.meal_id) || 0;
      voteCountMap.set(vote.meal_id, currentCount + 1);
    });

    let userVotedMealIds = new Set<number>();

    // Check which meals the current user has voted for (if user is logged in)
    if (userId) {
      const mealIds = submissionsData.map(s => s.meal_id);
      const { data: userVotes } = await supabase
        .from('meal_votes')
        .select('meal_id')
        .eq('user_id', userId)
        .eq('competition_id', competitionId)
        .in('meal_id', mealIds);

      userVotedMealIds = new Set(userVotes?.map(v => v.meal_id) || []);
    }

    // Process submissions with vote data and ranking
    const processedSubmissions = submissionsData.map((submission) => ({
      ...submission,
      vote_count: voteCountMap.get(submission.meal_id) || 0,
      user_has_voted: userVotedMealIds.has(submission.meal_id)
    }));

    // Sort by vote count and add ranking
    processedSubmissions.sort((a, b) => b.vote_count - a.vote_count);
    processedSubmissions.forEach((submission, index) => {
      submission.rank = index + 1;
    });

    return processedSubmissions;
  } catch (error) {
    console.error('Error fetching competition submissions:', error);
    throw error;
  }
}

/**
 * Submit a meal to a competition
 */
export async function submitMealToCompetition(
  competitionId: number,
  mealId: number,
  userId: string,
  submissionNotes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if the competition is active
    const competition = await getCompetition(competitionId);
    if (!competition) {
      return { success: false, error: 'Competition not found' };
    }

    if (competition.status !== 'active') {
      return { success: false, error: 'Competition is not currently accepting submissions' };
    }

    // Check if the meal has already been submitted to this competition
    const { data: existingSubmission } = await supabase
      .from('competition_submissions')
      .select('id')
      .eq('competition_id', competitionId)
      .eq('meal_id', mealId)
      .single();

    if (existingSubmission) {
      return { success: false, error: 'This meal has already been submitted to this competition' };
    }

    // Submit the meal
    const { error } = await supabase
      .from('competition_submissions')
      .insert([
        {
          competition_id: competitionId,
          meal_id: mealId,
          user_id: userId,
          submission_notes: submissionNotes?.trim() || null
        }
      ]);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error submitting meal to competition:', error);
    return { success: false, error: 'Failed to submit meal' };
  }
}

/**
 * Vote for a competition submission
 */
export async function voteForSubmission(
  mealId: number,
  competitionId: number,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if user has already voted for this meal in this competition
    const { data: existingVote } = await supabase
      .from('meal_votes')
      .select('vote_id')
      .eq('user_id', userId)
      .eq('meal_id', mealId)
      .eq('competition_id', competitionId)
      .single();

    if (existingVote) {
      return { success: false, error: 'You have already voted for this meal' };
    }

    // Add the vote
    const { error } = await supabase
      .from('meal_votes')
      .insert([
        {
          user_id: userId,
          meal_id: mealId,
          competition_id: competitionId
        }
      ]);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error voting for submission:', error);
    return { success: false, error: 'Failed to cast vote' };
  }
}

/**
 * Remove vote for a competition submission
 */
export async function removeVoteForSubmission(
  mealId: number,
  competitionId: number,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('meal_votes')
      .delete()
      .eq('user_id', userId)
      .eq('meal_id', mealId)
      .eq('competition_id', competitionId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error removing vote:', error);
    return { success: false, error: 'Failed to remove vote' };
  }
}

/**
 * Get user's meals that are eligible for competition submission
 */
export async function getUserEligibleMeals(
  userId: string, 
  competitionId?: number
): Promise<any[]> {
  try {
    // Get user's meals that are visible (public)
    const { data: mealsData, error } = await supabase
      .from('meals')
      .select('*')
      .eq('user_id', userId)
      .eq('visibility', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!mealsData) return [];

    // If competitionId is provided, check which meals have already been submitted
    if (competitionId) {
      const mealIds = mealsData.map(meal => meal.id);
      const { data: submissionsData } = await supabase
        .from('competition_submissions')
        .select('meal_id')
        .eq('competition_id', competitionId)
        .in('meal_id', mealIds);

      const submittedMealIds = new Set(submissionsData?.map(s => s.meal_id) || []);

      return mealsData.map(meal => ({
        ...meal,
        already_submitted: submittedMealIds.has(meal.id)
      }));
    }

    return mealsData;
  } catch (error) {
    console.error('Error fetching user eligible meals:', error);
    throw error;
  }
}

/**
 * Get historical competition winners
 */
export async function getHistoricalWinners(limit: number = 50): Promise<any[]> {
  try {
    const { data: winnersData, error } = await supabase
      .from('weekly_winners')
      .select(`
        *,
        competition:weekly_competitions(
          competition_id,
          start_date,
          end_date,
          theme:competition_themes(theme_name, description)
        ),
        meal:meals(name, picture),
        user_profile:user_profiles(username, profile_picture)
      `)
      .order('declared_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return winnersData || [];
  } catch (error) {
    console.error('Error fetching historical winners:', error);
    throw error;
  }
}

/**
 * Calculate submission score based on votes and time
 */
export function calculateSubmissionScore(votes: number, submittedAt: string): number {
  const submissionDate = new Date(submittedAt);
  const now = new Date();
  const hoursAgo = (now.getTime() - submissionDate.getTime()) / (1000 * 60 * 60);
  
  // Score decreases over time to give newer submissions a boost
  const timeDecay = Math.max(0.1, 1 - (hoursAgo / (24 * 7))); // Decay over a week
  return Math.round((votes * timeDecay * 100) / 10) / 10;
}

/**
 * Check if a submission is trending
 */
export function isSubmissionTrending(votes: number, submittedAt: string): boolean {
  const submissionDate = new Date(submittedAt);
  const now = new Date();
  const hoursAgo = (now.getTime() - submissionDate.getTime()) / (1000 * 60 * 60);
  
  // Trending if submitted in last 24 hours and has good vote ratio
  return hoursAgo <= 24 && votes >= 3;
}

/**
 * Format competition status for display
 */
export function getCompetitionStatusInfo(competition: Competition): {
  color: string;
  icon: string;
  text: string;
} {
  switch (competition.status) {
    case 'active':
      return {
        color: '#10b981', // green
        icon: 'radio-button-on',
        text: 'ACTIVE'
      };
    case 'upcoming':
      return {
        color: '#f59e0b', // yellow
        icon: 'time',
        text: 'UPCOMING'
      };
    case 'ended':
      return {
        color: '#6b7280', // gray
        icon: 'checkmark-circle',
        text: 'ENDED'
      };
    default:
      return {
        color: '#6b7280',
        icon: 'help-circle',
        text: 'UNKNOWN'
      };
  }
}