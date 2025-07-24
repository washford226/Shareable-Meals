import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  RefreshControl,
  ActivityIndicator,
  ScrollView 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { supabase } from '../../../utils/supabase';
import { router } from 'expo-router';

interface Report {
  report_id: number;
  user_id: string;
  meal_id: number;
  reason: string;
  status: string;
  created_at: string;
  reporter_username?: string;
  meal_title?: string;
}

const AdminReportsScreen: React.FC = () => {
  const { theme } = useTheme();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setError(null);
      } else {
        setLoading(true);
        setError(null);
      }

      const { data, error: fetchError } = await supabase
        .from('reports')
        .select(`
          *,
          user_profiles!reports_user_id_fkey(username),
          meals!reports_meal_id_fkey(name)
        `)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching reports:', fetchError);
        throw new Error(fetchError.message || 'Failed to fetch reports');
      }

      const formattedReports = data?.map(report => ({
        ...report,
        reporter_username: report.user_profiles?.username || 'Unknown',
        meal_title: report.meals?.name || `Meal ID: ${report.meal_id}`,
      })) || [];

      setReports(formattedReports);
      setRetryCount(0); // Reset retry count on success
    } catch (error: any) {
      console.error('Error:', error);
      const errorMessage = error?.message || 'An unexpected error occurred while fetching reports';
      setError(errorMessage);
      
      // Auto-retry logic with exponential backoff
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetchReports(isRefresh);
        }, delay);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [retryCount]);

  const handleRetry = useCallback(() => {
    setRetryCount(0);
    fetchReports();
  }, [fetchReports]);

  const onRefresh = useCallback(() => {
    fetchReports(true);
  }, [fetchReports]);

  const handleReportAction = useCallback(async (reportId: number, action: 'Resolved' | 'Dismissed') => {
    if (actionLoading === reportId) return; // Prevent double-tap

    if (action === 'Resolved') {
      // Show options for resolving
      Alert.alert(
        'Resolve Report',
        'How would you like to resolve this report?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Hide Meal',
            onPress: () => handleResolveWithMealAction(reportId, 'hide_meal'),
          },
          {
            text: 'Ban User',
            onPress: () => handleResolveWithMealAction(reportId, 'ban_user'),
            style: 'destructive',
          },
          {
            text: 'Mark Resolved Only',
            onPress: () => updateReportStatus(reportId, 'Resolved'),
          },
        ]
      );
    } else {
      // Direct dismiss
      updateReportStatus(reportId, 'Dismissed');
    }
  }, [actionLoading]);

  const navigateToMealDetails = useCallback(async (reportId: number) => {
    if (actionLoading === reportId) return; // Prevent double-tap
    
    try {
      setActionLoading(reportId);
      
      // Get the meal_id from the report
      const { data: reportData, error: reportError } = await supabase
        .from('reports')
        .select('meal_id')
        .eq('report_id', reportId)
        .single();

      if (reportError) {
        console.error('Error fetching report details:', reportError);
        Alert.alert('Error', 'Failed to fetch report details. Please try again.');
        return;
      }

      // Navigate to admin meal view screen
      router.push(`./meal-details?mealId=${reportData.meal_id}&reportId=${reportId}`);
    } catch (error: any) {
      console.error('Error:', error);
      Alert.alert('Error', error?.message || 'An unexpected error occurred while navigating to meal details');
    } finally {
      setActionLoading(null);
    }
  }, [actionLoading]);

  const handleResolveWithMealAction = useCallback(async (reportId: number, actionType: 'hide_meal' | 'ban_user') => {
    if (actionLoading === reportId) return; // Prevent double-tap
    
    try {
      setActionLoading(reportId);
      
      // First get the report details to know which meal and user
      const { data: reportData, error: reportError } = await supabase
        .from('reports')
        .select('meal_id, user_id')
        .eq('report_id', reportId)
        .single();

      if (reportError) {
        console.error('Error fetching report details:', reportError);
        throw new Error('Failed to fetch report details');
      }

      if (actionType === 'hide_meal') {
        // Set meal's forever_invis to true
        const { error: mealError } = await supabase
          .from('meals')
          .update({ forever_invis: true })
          .eq('id', reportData.meal_id);

        if (mealError) {
          console.error('Error hiding meal:', mealError);
          throw new Error('Failed to hide meal');
        }
      } else if (actionType === 'ban_user') {
        // Set user's ban column to true
        const { error: banError } = await supabase
          .from('user_profiles')
          .update({ ban: true })
          .eq('id', reportData.user_id);

        if (banError) {
          console.error('Error banning user:', banError);
          throw new Error('Failed to ban user');
        }
      }

      // Update report status to resolved
      await updateReportStatus(reportId, 'Resolved');
      
      const actionText = actionType === 'hide_meal' ? 'Meal hidden and report resolved' : 'User banned and report resolved';
      Alert.alert('Success', actionText);
    } catch (error: any) {
      console.error('Error:', error);
      Alert.alert('Error', error?.message || 'An unexpected error occurred while processing the action');
    } finally {
      setActionLoading(null);
    }
  }, [actionLoading]);

  const updateReportStatus = useCallback(async (reportId: number, status: 'Resolved' | 'Dismissed') => {
    if (actionLoading === reportId) return; // Prevent double-tap
    
    try {
      setActionLoading(reportId);
      
      const { error } = await supabase
        .from('reports')
        .update({ status: status })
        .eq('report_id', reportId);

      if (error) {
        console.error('Error updating report:', error);
        throw new Error('Failed to update report status');
      }

      // Refresh the reports list
      fetchReports();
      if (status === 'Dismissed') {
        Alert.alert('Success', 'Report dismissed successfully');
      }
    } catch (error: any) {
      console.error('Error:', error);
      Alert.alert('Error', error?.message || 'An unexpected error occurred while updating report status');
    } finally {
      setActionLoading(null);
    }
  }, [fetchReports, actionLoading]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return '#FFA500'; // Orange
      case 'resolved':
        return '#4CAF50'; // Green
      case 'dismissed':
        return '#9E9E9E'; // Gray
      default:
        return theme.text;
    }
  };

  const renderReportItem = useCallback(({ item }: { item: Report }) => {
    const isActionLoading = actionLoading === item.report_id;
    const statusColor = getStatusColor(item.status);
    const isPending = item.status === 'Pending';
    
    return (
      <View style={[styles.reportCard, { backgroundColor: theme.card }]}>
        <View style={styles.reportHeader}>
          <View style={styles.reportHeaderLeft}>
            <Ionicons 
              name={isPending ? "warning" : item.status === 'Resolved' ? "checkmark-circle" : "close-circle"} 
              size={20} 
              color={statusColor} 
            />
            <Text style={[styles.reportType, { color: theme.text }]}>
              Report #{item.report_id}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}>
            <Text style={[styles.reportStatus, { color: statusColor }]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>
        
        <View style={styles.reportContent}>
          <View style={styles.reportInfoRow}>
            <Ionicons name="person" size={14} color={theme.subtext} />
            <Text style={[styles.reportDetail, { color: theme.text }]}>
              Reporter: {item.reporter_username}
            </Text>
          </View>
          
          {item.meal_title && (
            <View style={styles.reportInfoRow}>
              <Ionicons name="restaurant" size={14} color={theme.subtext} />
              <Text style={[styles.reportDetail, { color: theme.text }]}>
                Meal: {item.meal_title}
              </Text>
            </View>
          )}
          
          <View style={styles.reasonCard}>
            <Text style={[styles.reasonLabel, { color: theme.subtext }]}>
              Reason:
            </Text>
            <Text style={[styles.reportDescription, { color: theme.text }]}>
              {item.reason}
            </Text>
          </View>
          
          <View style={styles.reportFooter}>
            <View style={styles.dateRow}>
              <Ionicons name="time" size={12} color={theme.subtext} />
              <Text style={[styles.reportDate, { color: theme.subtext }]}>
                {new Date(item.created_at).toLocaleDateString()} at {new Date(item.created_at).toLocaleTimeString()}
              </Text>
            </View>
          </View>
        </View>

        {isPending && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[
                styles.actionButton, 
                styles.viewButton,
                { opacity: isActionLoading ? 0.6 : 1 }
              ]}
              onPress={() => navigateToMealDetails(item.report_id)}
              disabled={isActionLoading}
            >
              <Ionicons name="eye" size={16} color="#2196F3" />
              {isActionLoading ? (
                <ActivityIndicator size="small" color="#2196F3" />
              ) : (
                <Text style={[styles.actionButtonText, { color: '#2196F3' }]}>
                  View Meal
                </Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.actionButton, 
                styles.resolveButton,
                { opacity: isActionLoading ? 0.6 : 1 }
              ]}
              onPress={() => handleReportAction(item.report_id, 'Resolved')}
              disabled={isActionLoading}
            >
              <Ionicons name="checkmark" size={16} color="#4CAF50" />
              {isActionLoading ? (
                <ActivityIndicator size="small" color="#4CAF50" />
              ) : (
                <Text style={[styles.actionButtonText, { color: '#4CAF50' }]}>
                  Resolve
                </Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.actionButton, 
                styles.dismissButton,
                { opacity: isActionLoading ? 0.6 : 1 }
              ]}
              onPress={() => handleReportAction(item.report_id, 'Dismissed')}
              disabled={isActionLoading}
            >
              <Ionicons name="close" size={16} color="#9E9E9E" />
              {isActionLoading ? (
                <ActivityIndicator size="small" color="#9E9E9E" />
              ) : (
                <Text style={[styles.actionButtonText, { color: '#9E9E9E' }]}>
                  Dismiss
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }, [theme, actionLoading, getStatusColor, navigateToMealDetails, handleReportAction]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Modern Header */}
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.card }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Admin Reports
        </Text>
        <TouchableOpacity
          style={[styles.headerActionButton, { backgroundColor: theme.card }]}
          onPress={() => fetchReports()}
        >
          <Ionicons name="refresh" size={20} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* Error Banner */}
      {error && (
        <View style={[styles.errorBanner, { 
          backgroundColor: `${theme.danger}15`, 
          borderColor: theme.danger 
        }]}>
          <Ionicons name="alert-circle" size={16} color={theme.danger} />
          <Text style={[styles.errorBannerText, { color: theme.danger }]}>
            {error}
          </Text>
          <TouchableOpacity 
            style={[styles.errorBannerButton, { backgroundColor: theme.danger }]}
            onPress={handleRetry}
          >
            <Text style={[styles.errorBannerButtonText, { color: theme.buttonText }]}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Retry Banner */}
      {retryCount > 0 && !error && (
        <View style={[styles.retryBanner, { 
          backgroundColor: `${theme.warning}15`, 
          borderColor: theme.warning 
        }]}>
          <ActivityIndicator size="small" color={theme.warning} />
          <Text style={[styles.retryBannerText, { color: theme.warning }]}>
            Retrying... (Attempt {retryCount}/3)
          </Text>
        </View>
      )}

      {/* Statistics Card */}
      {reports.length > 0 && (
        <View style={[styles.statsCard, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="stats-chart" size={20} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Report Statistics
            </Text>
          </View>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: theme.text }]}>
                {reports.length}
              </Text>
              <Text style={[styles.statLabel, { color: theme.subtext }]}>
                Total
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: '#FFA500' }]}>
                {reports.filter(r => r.status === 'Pending').length}
              </Text>
              <Text style={[styles.statLabel, { color: theme.subtext }]}>
                Pending
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: '#4CAF50' }]}>
                {reports.filter(r => r.status === 'Resolved').length}
              </Text>
              <Text style={[styles.statLabel, { color: theme.subtext }]}>
                Resolved
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: '#9E9E9E' }]}>
                {reports.filter(r => r.status === 'Dismissed').length}
              </Text>
              <Text style={[styles.statLabel, { color: theme.subtext }]}>
                Dismissed
              </Text>
            </View>
          </View>
        </View>
      )}

      <FlatList
        data={reports}
        renderItem={renderReportItem}
        keyExtractor={(item) => item.report_id.toString()}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
        ListEmptyComponent={
          <View style={[styles.emptyStateCard, { backgroundColor: theme.card }]}>
            <View style={styles.emptyStateContent}>
              {loading ? (
                <>
                  <ActivityIndicator size="large" color={theme.primary} />
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>
                    Loading Reports
                  </Text>
                  <Text style={[styles.emptySubtext, { color: theme.subtext }]}>
                    Fetching report data...
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="shield-checkmark" size={48} color={theme.success} />
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>
                    No Reports Found
                  </Text>
                  <Text style={[styles.emptySubtext, { color: theme.subtext }]}>
                    Great! There are currently no reports to review. The community is behaving well.
                  </Text>
                  <TouchableOpacity
                    style={[styles.refreshButton, { backgroundColor: theme.primary }]}
                    onPress={() => fetchReports()}
                  >
                    <Ionicons name="refresh" size={16} color={theme.buttonText} />
                    <Text style={[styles.refreshButtonText, { color: theme.buttonText }]}>
                      Refresh
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  // Header Styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 44, // Account for status bar
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerActionButton: {
    padding: 8,
    borderRadius: 8,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Error/Retry Banners
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
  },
  errorBannerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  errorBannerButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  retryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  retryBannerText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Statistics Card
  statsCard: {
    margin: 16,
    marginTop: 8,
    padding: 20,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '500',
  },

  // List Container
  listContainer: {
    padding: 16,
    paddingTop: 0,
  },

  // Report Card
  reportCard: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reportHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reportType: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  reportStatus: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  reportContent: {
    gap: 8,
  },
  reportInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reportDetail: {
    fontSize: 14,
    flex: 1,
  },
  reasonCard: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.02)',
    marginTop: 4,
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  reportDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  reportFooter: {
    marginTop: 8,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reportDate: {
    fontSize: 12,
  },

  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    flex: 1,
    gap: 4,
  },
  viewButton: {
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    borderColor: '#2196F3',
  },
  resolveButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderColor: '#4CAF50',
  },
  dismissButton: {
    backgroundColor: 'rgba(158, 158, 158, 0.1)',
    borderColor: '#9E9E9E',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Empty State
  emptyStateCard: {
    margin: 16,
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyStateContent: {
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 16,
    gap: 6,
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Legacy styles (keeping for compatibility)
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
});

export default AdminReportsScreen;
