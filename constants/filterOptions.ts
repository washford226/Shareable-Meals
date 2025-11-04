// Filter options for meal filtering
export const CUISINE_OPTIONS = [
  'American',
  'Asian',
  'Chinese',
  'French',
  'Greek',
  'Indian',
  'Italian',
  'Japanese',
  'Korean',
  'Mediterranean',
  'Mexican',
  'Middle Eastern',
  'Spanish',
  'Thai',
  'Vietnamese',
].sort();

export const DIETARY_RESTRICTION_OPTIONS = [
  'Dairy-Free',
  'Gluten-Free',
  'Halal',
  'Keto',
  'Kosher',
  'Low-Carb',
  'Low-Fat',
  'Low-Sodium',
  'Nut-Free',
  'Paleo',
  'Pescatarian',
  'Shellfish-Free',
  'Sugar-Free',
  'Vegan',
  'Vegetarian',
].sort();

export const MEAL_TYPE_OPTIONS = [
  'breakfast',
  'lunch', 
  'dinner',
  'snack',
  'dessert',
] as const;

export const CALORIE_RANGES = [
  { key: 'all', label: 'All' },
  { key: 'low', label: 'Low (< 400 cal)' },
  { key: 'medium', label: 'Medium (400-700 cal)' },
  { key: 'high', label: 'High (> 700 cal)' },
] as const;

export const PROTEIN_RANGES = [
  { key: 'all', label: 'All' },
  { key: 'low', label: 'Low (< 15g)' },
  { key: 'medium', label: 'Medium (15-30g)' },
  { key: 'high', label: 'High (> 30g)' },
] as const;

export const CARB_RANGES = [
  { key: 'all', label: 'All' },
  { key: 'low', label: 'Low (< 30g)' },
  { key: 'medium', label: 'Medium (30-60g)' },
  { key: 'high', label: 'High (> 60g)' },
] as const;

export const FAT_RANGES = [
  { key: 'all', label: 'All' },
  { key: 'low', label: 'Low (< 10g)' },
  { key: 'medium', label: 'Medium (10-20g)' },
  { key: 'high', label: 'High (> 20g)' },
] as const;

export const SORT_OPTIONS = [
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'name', label: 'Name' },
] as const;