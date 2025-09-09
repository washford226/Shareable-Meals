import { formatPrice } from '../../components/SubscriptionPaywall';

describe('formatPrice utility', () => {
  describe('USD Currency', () => {
    it('should format USD prices correctly', () => {
      expect(formatPrice(9.99, 'USD')).toBe('$9.99');
      expect(formatPrice(99.99, 'USD')).toBe('$99.99');
      expect(formatPrice(0.99, 'USD')).toBe('$0.99');
      expect(formatPrice(999.99, 'USD')).toBe('$999.99');
    });

    it('should handle whole numbers', () => {
      expect(formatPrice(10, 'USD')).toBe('$10.00');
      expect(formatPrice(100, 'USD')).toBe('$100.00');
    });

    it('should handle zero', () => {
      expect(formatPrice(0, 'USD')).toBe('$0.00');
    });
  });

  describe('Other Currencies', () => {
    it('should format EUR prices correctly', () => {
      expect(formatPrice(9.99, 'EUR')).toBe('€9.99');
      expect(formatPrice(99.99, 'EUR')).toBe('€99.99');
    });

    it('should format GBP prices correctly', () => {
      expect(formatPrice(7.99, 'GBP')).toBe('£7.99');
      expect(formatPrice(79.99, 'GBP')).toBe('£79.99');
    });

    it('should format JPY prices correctly', () => {
      expect(formatPrice(1200, 'JPY')).toBe('¥1,200');
      expect(formatPrice(12000, 'JPY')).toBe('¥12,000');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large numbers', () => {
      expect(formatPrice(9999999.99, 'USD')).toBe('$9,999,999.99');
    });

    it('should handle very small numbers', () => {
      expect(formatPrice(0.01, 'USD')).toBe('$0.01');
    });

    it('should handle numbers with many decimal places', () => {
      expect(formatPrice(9.999999, 'USD')).toBe('$10.00'); // Rounds to nearest cent
    });

    it('should handle negative numbers', () => {
      expect(formatPrice(-9.99, 'USD')).toBe('-$9.99');
    });
  });
});
