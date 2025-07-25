# Scanner Usage Limit Implementation

## Overview
This document outlines the implementation of a daily scanner usage limit for the AI-powered pantry and meal scanners in the MealPlanApp.

## Features Implemented

### Usage Limits
- **Daily Limit**: 3 scans per user per day
- **Automatic Reset**: Usage count resets daily
- **Real-time Tracking**: Shows remaining scans on scanner buttons

### Database Changes Required
The following columns have been added to the `user_profiles` table:

```sql
-- Add scanner usage tracking columns to user_profiles table
ALTER TABLE public.user_profiles 
ADD COLUMN scanner_usage_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN scanner_usage_last_date DATE NULL;
```

### Files Modified

#### 1. `utils/aiUsageUtils.ts` (New File)
- `checkScannerUsage()`: Validates if user can use scanner
- `incrementScannerUsage()`: Increments usage count after successful scan
- `getScannerUsageStatus()`: Gets current usage stats for display

#### 2. `app/(app)/pantry/pantry.tsx`
- Added usage limit check before camera opens
- Added usage tracking after successful scan
- Updated scan button to show remaining uses
- Added loading of usage status on component mount

#### 3. `app/(app)/meal-plan/calendar.tsx`
- Added usage limit check before camera opens
- Added usage tracking after successful scan
- Updated scan button to show remaining uses
- Added loading of usage status on component mount

## User Experience

### Before Limit Reached
- Scanner buttons show "X/3 left" indicating remaining uses
- Scanner functions normally

### When Limit Reached
- Alert dialog shows: "You have reached your daily scanner limit of 3 uses. Please try again tomorrow."
- Scanner buttons still visible but blocked from use

### Daily Reset
- Usage count automatically resets at midnight
- Users get fresh 3 scans each day

## Technical Details

### Usage Tracking Logic
1. **First Check**: Before opening camera, check current usage vs limit
2. **Date Comparison**: If last usage was different date, reset to 0
3. **Increment**: Only increment after successful API response
4. **Display Update**: Refresh usage display after each scan

### Database Schema
```sql
CREATE TABLE public.user_profiles (
  id uuid NOT NULL,
  username character varying(50) NOT NULL,
  profile_picture bytea NULL,
  calories_goal integer NULL DEFAULT 2000,
  protein_goal integer NULL DEFAULT 80,
  carbohydrates_goal integer NULL DEFAULT 300,
  fat_goal integer NULL DEFAULT 60,
  dietary_restrictions character varying(255) NULL,
  allergies character varying(255) NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  is_admin boolean NOT NULL DEFAULT false,
  ban boolean NOT NULL DEFAULT false,
  ai_usage_count integer NOT NULL DEFAULT 0,
  ai_usage_last_date date NULL,
  scanner_usage_count integer NOT NULL DEFAULT 0, -- New column
  scanner_usage_last_date date NULL,               -- New column
  CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT user_profiles_username_key UNIQUE (username),
  CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE
) TABLESPACE pg_default;
```

## Error Handling
- Network failures don't increment usage count
- Failed scans don't count against limit
- Database errors are logged and handled gracefully
- User-friendly error messages for limit exceeded

## Future Enhancements
1. **Admin Override**: Allow admins to have unlimited scans
2. **Premium Limits**: Different limits for premium users
3. **Usage Analytics**: Track usage patterns for insights
4. **Flexible Limits**: Configurable daily limits per user
