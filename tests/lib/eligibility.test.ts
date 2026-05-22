import { describe, it, expect } from 'vitest';
import {
  checkChase524,
  checkAmex290,
  checkAmexLifetime,
  checkCiti865,
  checkBoA234,
  checkIssuerEligibility,
} from '@/lib/eligibility';
import type { Card, HardInquiry } from '@/types';

const createTestCard = (overrides: Partial<Card> = {}): Card => ({
  id: crypto.randomUUID(),
  nickname: 'Test Card',
  issuer: 'chase',
  productName: 'Test Product',
  network: 'visa',
  last4: '1234',
  annualFee: 0,
  aprPurchase: 24.99,
  openedOn: new Date().toISOString().split('T')[0] ?? '',
  foreignTxFee: 0,
  rewards: {
    baseRate: 0.01,
    categories: [],
    pointType: 'cashback',
    pointValue: 1,
  },
  ...overrides,
});

const createTestInquiry = (overrides: Partial<HardInquiry> = {}): HardInquiry => ({
  id: crypto.randomUUID(),
  bureau: 'experian',
  issuer: 'chase',
  date: new Date().toISOString().split('T')[0] ?? '',
  ...overrides,
});

describe('eligibility', () => {
  describe('checkChase524', () => {
    it('should pass with fewer than 5 cards', () => {
      const cards = [createTestCard(), createTestCard(), createTestCard()];
      const result = checkChase524(cards);

      expect(result.eligible).toBe(true);
      expect(result.reason).toContain('3/5');
    });

    it('should fail with 5+ cards in 24 months', () => {
      const cards = Array.from({ length: 6 }, () => createTestCard());
      const result = checkChase524(cards);

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('6 cards');
    });

    it('should not count cards older than 24 months', () => {
      const oldDate = new Date();
      oldDate.setMonth(oldDate.getMonth() - 30);

      const cards = [
        ...Array.from({ length: 3 }, () =>
          createTestCard({ openedOn: oldDate.toISOString().split('T')[0] })
        ),
        createTestCard(),
        createTestCard(),
      ];

      const result = checkChase524(cards);
      expect(result.eligible).toBe(true);
      expect(result.reason).toContain('2/5');
    });
  });

  describe('checkAmex290', () => {
    it('should pass with fewer than 2 Amex cards in 90 days', () => {
      const cards = [createTestCard({ issuer: 'amex' })];
      const result = checkAmex290(cards);

      expect(result.eligible).toBe(true);
      expect(result.reason).toContain('1/2');
    });

    it('should fail with 2+ Amex cards in 90 days', () => {
      const cards = [
        createTestCard({ issuer: 'amex' }),
        createTestCard({ issuer: 'amex' }),
      ];
      const result = checkAmex290(cards);

      expect(result.eligible).toBe(false);
    });

    it('should not count non-Amex cards', () => {
      const cards = [
        createTestCard({ issuer: 'chase' }),
        createTestCard({ issuer: 'chase' }),
        createTestCard({ issuer: 'amex' }),
      ];
      const result = checkAmex290(cards);

      expect(result.eligible).toBe(true);
    });
  });

  describe('checkAmexLifetime', () => {
    it('should pass if never held product', () => {
      const cards = [createTestCard({ issuer: 'amex', productName: 'Gold Card' })];
      const result = checkAmexLifetime(cards, 'Platinum Card');

      expect(result.eligible).toBe(true);
    });

    it('should fail if previously held product', () => {
      const cards = [createTestCard({ issuer: 'amex', productName: 'Platinum Card' })];
      const result = checkAmexLifetime(cards, 'Platinum');

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('previously held');
    });
  });

  describe('checkCiti865', () => {
    it('should pass with no recent Citi applications', () => {
      const result = checkCiti865([], []);
      expect(result.eligible).toBe(true);
    });

    it('should fail with application in last 8 days', () => {
      const inquiries = [createTestInquiry({ issuer: 'citi' })];
      const result = checkCiti865([], inquiries);

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('8 days');
    });

    it('should fail with 2+ applications in 65 days', () => {
      const date1 = new Date();
      date1.setDate(date1.getDate() - 20);
      const date2 = new Date();
      date2.setDate(date2.getDate() - 40);

      const inquiries = [
        createTestInquiry({ issuer: 'citi', date: date1.toISOString().split('T')[0] }),
        createTestInquiry({ issuer: 'citi', date: date2.toISOString().split('T')[0] }),
      ];

      const result = checkCiti865([], inquiries);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('65 days');
    });
  });

  describe('checkBoA234', () => {
    it('should pass with no BoA cards', () => {
      const result = checkBoA234([]);
      expect(result.eligible).toBe(true);
    });

    it('should fail with 2+ BoA cards in 2 months', () => {
      const cards = [
        createTestCard({ issuer: 'boa' }),
        createTestCard({ issuer: 'boa' }),
      ];
      const result = checkBoA234(cards);

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('2 months');
    });

    it('should fail with 4+ BoA cards total', () => {
      const oldDate = new Date();
      oldDate.setFullYear(oldDate.getFullYear() - 2);

      const cards = Array.from({ length: 4 }, () =>
        createTestCard({ issuer: 'boa', openedOn: oldDate.toISOString().split('T')[0] })
      );

      const result = checkBoA234(cards);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('4 BoA cards total');
    });
  });

  describe('checkIssuerEligibility', () => {
    it('should run Chase rules for Chase', () => {
      const results = checkIssuerEligibility('chase', [], []);
      expect(results.some((r) => r.rule === 'Chase 5/24')).toBe(true);
    });

    it('should run Amex rules for Amex', () => {
      const results = checkIssuerEligibility('amex', [], [], 'Gold Card');
      expect(results.some((r) => r.rule === 'Amex 2/90')).toBe(true);
      expect(results.some((r) => r.rule === 'Amex Lifetime')).toBe(true);
    });

    it('should run Citi rules for Citi', () => {
      const results = checkIssuerEligibility('citi', [], []);
      expect(results.some((r) => r.rule === 'Citi 8/65')).toBe(true);
    });

    it('should run BoA rules for BoA', () => {
      const results = checkIssuerEligibility('boa', [], []);
      expect(results.some((r) => r.rule === 'BoA 2/3/4')).toBe(true);
    });

    it('should return general result for other issuers', () => {
      const results = checkIssuerEligibility('discover', [], []);
      expect(results[0]?.rule).toBe('General');
      expect(results[0]?.eligible).toBe(true);
    });
  });
});
