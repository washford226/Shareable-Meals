import { formatIngredientsForEdamam, IngredientInput } from '../../utils/edamamUtils';

// Mock supabase
jest.mock('../../utils/supabase', () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));

describe('edamamUtils', () => {
  describe('formatIngredientsForEdamam', () => {
    it('should format ingredients correctly with quantity, unit, and name', () => {
      const ingredients: IngredientInput[] = [
        { name: 'flour', quantity: '2', unit: 'cups' },
        { name: 'sugar', quantity: '1', unit: 'cup' },
        { name: 'salt', quantity: '1', unit: 'tsp' },
      ];

      const result = formatIngredientsForEdamam(ingredients);
      
      expect(result).toEqual([
        '2 cups flour',
        '1 cup sugar',
        '1 tsp salt',
      ]);
    });

    it('should handle ingredients without units', () => {
      const ingredients: IngredientInput[] = [
        { name: 'eggs', quantity: '2', unit: '' },
        { name: 'chicken breast', quantity: '1', unit: 'lb' },
      ];

      const result = formatIngredientsForEdamam(ingredients);
      
      expect(result).toEqual([
        '2 eggs', // Fixed: no extra space when unit is empty
        '1 lb chicken breast',
      ]);
    });

    it('should filter out ingredients with empty names', () => {
      const ingredients: IngredientInput[] = [
        { name: '', quantity: '2', unit: 'cups' },
        { name: 'flour', quantity: '1', unit: 'cup' },
        { name: '   ', quantity: '1', unit: 'tsp' }, // whitespace only
      ];

      const result = formatIngredientsForEdamam(ingredients);
      
      expect(result).toEqual(['1 cup flour']);
    });

    it('should filter out ingredients with empty quantities', () => {
      const ingredients: IngredientInput[] = [
        { name: 'flour', quantity: '', unit: 'cups' },
        { name: 'sugar', quantity: '1', unit: 'cup' },
        { name: 'salt', quantity: '   ', unit: 'tsp' }, // whitespace only
      ];

      const result = formatIngredientsForEdamam(ingredients);
      
      expect(result).toEqual(['1 cup sugar']);
    });

    it('should handle ingredients with extra whitespace', () => {
      const ingredients: IngredientInput[] = [
        { name: '  flour  ', quantity: '  2  ', unit: '  cups  ' },
        { name: 'sugar', quantity: '1', unit: 'cup' },
      ];

      const result = formatIngredientsForEdamam(ingredients);
      
      expect(result).toEqual([
        '2 cups flour',
        '1 cup sugar',
      ]);
    });

    it('should handle mixed case and special characters', () => {
      const ingredients: IngredientInput[] = [
        { name: 'All-Purpose Flour', quantity: '2.5', unit: 'cups' },
        { name: 'Kosher Salt', quantity: '1/2', unit: 'tsp' },
        { name: 'Extra Virgin Olive Oil', quantity: '2', unit: 'tbsp' },
      ];

      const result = formatIngredientsForEdamam(ingredients);
      
      expect(result).toEqual([
        '2.5 cups All-Purpose Flour',
        '1/2 tsp Kosher Salt',
        '2 tbsp Extra Virgin Olive Oil',
      ]);
    });

    it('should return empty array for empty input', () => {
      const result = formatIngredientsForEdamam([]);
      expect(result).toEqual([]);
    });

    it('should handle undefined or null values gracefully', () => {
      const ingredients: any[] = [
        { name: null, quantity: '2', unit: 'cups' },
        { name: 'flour', quantity: null, unit: 'cups' },
        { name: 'sugar', quantity: '1', unit: null },
        { name: 'salt', quantity: '1', unit: 'tsp' },
      ];

      // This should not throw and should filter out invalid entries
      expect(() => formatIngredientsForEdamam(ingredients)).not.toThrow();
      
      const result = formatIngredientsForEdamam(ingredients);
      // Should filter out entries with null/undefined values
      expect(result.length).toBeGreaterThan(0); // At least some valid entries
      expect(result.every(item => typeof item === 'string')).toBe(true);
    });

    it('should handle complex measurements and fractions', () => {
      const ingredients: IngredientInput[] = [
        { name: 'butter', quantity: '1/2', unit: 'stick' },
        { name: 'brown sugar', quantity: '3/4', unit: 'cup' },
        { name: 'vanilla extract', quantity: '1.5', unit: 'tsp' },
        { name: 'baking powder', quantity: '2 1/4', unit: 'tsp' },
      ];

      const result = formatIngredientsForEdamam(ingredients);
      
      expect(result).toEqual([
        '1/2 stick butter',
        '3/4 cup brown sugar',
        '1.5 tsp vanilla extract',
        '2 1/4 tsp baking powder',
      ]);
    });
  });
});