import { describe, it, expect } from 'vitest';
import {
  getEffectiveRate,
  calculatePointValue,
  compareCardsForPurchase,
  getBestCardForCategory,
  getSignupBonusProgress,
  calculateNetAnnualValue,
} from '@/lib/rewards';
import type { Card } from '@/types';

const createTestCard = (overrides: Partial<Card> = {}): Card => ({
  id: 'test-id-1234-5678-9012',
  nickname: 'Test Card',
  issuer: 'chase',
  productName: 'Test Product',
  network: 'visa',
  last4: '1234',
  annualFee: 0,
  aprPurchase: 24.99,
  openedOn: '2023-01-15',
  foreignTxFee: 0,
  rewards: {
    baseRate: 0.01,
    categories: [],
    pointType: 'cashback',
    pointValue: 1,
  },
  ...overrides,
});

describe('rewards', () => {
  describe('getEffectiveRate', () => {
    it('should return base rate for uncategorized spending', () => {
      const card = createTestCard({
        rewards: {
          baseRate: 0.015,
          categories: [{ category: 'dining', multiplier: 3 }],
          pointType: 'cashback',
          pointValue: 1,
        },
      });

      const result = getEffectiveRate(card, 'grocery');
      expect(result.rate).toBe(0.015);
      expect(result.isRotating).toBe(false);
    });

    it('should return category rate for matching category', () => {
      const card = createTestCard({
        rewards: {
          baseRate: 0.01,
          categories: [{ category: 'dining', multiplier: 3 }],
          pointType: 'cashback',
          pointValue: 1,
        },
      });

      const result = getEffectiveRate(card, 'dining');
      expect(result.rate).toBe(0.03);
      expect(result.isRotating).toBe(false);
    });

    it('should return rotating rate if active and matching', () => {
      const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3) as 1 | 2 | 3 | 4;
      const currentYear = new Date().getFullYear();

      const card = createTestCard({
        rewards: {
          baseRate: 0.01,
          categories: [],
          rotating: [
            {
              quarter: currentQuarter,
              year: currentYear,
              categories: ['grocery'],
              activated: true,
            },
          ],
          pointType: 'cashback',
          pointValue: 1,
        },
      });

      const result = getEffectiveRate(card, 'grocery');
      expect(result.rate).toBe(0.05);
      expect(result.isRotating).toBe(true);
    });

    it('should not return rotating rate if not activated', () => {
      const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3) as 1 | 2 | 3 | 4;
      const currentYear = new Date().getFullYear();

      const card = createTestCard({
        rewards: {
          baseRate: 0.01,
          categories: [],
          rotating: [
            {
              quarter: currentQuarter,
              year: currentYear,
              categories: ['grocery'],
              activated: false,
            },
          ],
          pointType: 'cashback',
          pointValue: 1,
        },
      });

      const result = getEffectiveRate(card, 'grocery');
      expect(result.rate).toBe(0.01);
      expect(result.isRotating).toBe(false);
    });
  });

  describe('calculatePointValue', () => {
    it('should calculate simple cashback value', () => {
      const card = createTestCard({
        rewards: {
          baseRate: 0.01,
          categories: [],
          pointType: 'cashback',
          pointValue: 1,
        },
      });

      const result = calculatePointValue(card, 100);
      expect(result.cashbackValue).toBe(1);
      expect(result.transferValue).toBeUndefined();
    });

    it('should calculate higher point value', () => {
      const card = createTestCard({
        rewards: {
          baseRate: 0.01,
          categories: [],
          pointType: 'ur',
          pointValue: 1.5,
        },
      });

      const result = calculatePointValue(card, 100);
      expect(result.cashbackValue).toBe(1.5);
    });

    it('should find best transfer partner value', () => {
      const card = createTestCard({
        rewards: {
          baseRate: 0.01,
          categories: [],
          pointType: 'ur',
          pointValue: 1.5,
          transferPartners: [
            { partner: 'United', ratio: 1, valuationCpp: 1.8 },
            { partner: 'Hyatt', ratio: 1, valuationCpp: 2.2 },
          ],
        },
      });

      const result = calculatePointValue(card, 100);
      expect(result.cashbackValue).toBe(1.5);
      expect(result.transferValue).toBe(2.2);
      expect(result.bestTransferPartner).toBe('Hyatt');
    });
  });

  describe('compareCardsForPurchase', () => {
    it('should rank cards by best value', () => {
      const card1 = createTestCard({
        id: 'card-1',
        nickname: 'Basic Card',
        rewards: {
          baseRate: 0.01,
          categories: [],
          pointType: 'cashback',
          pointValue: 1,
        },
      });

      const card2 = createTestCard({
        id: 'card-2',
        nickname: 'Dining Card',
        rewards: {
          baseRate: 0.01,
          categories: [{ category: 'dining', multiplier: 3 }],
          pointType: 'cashback',
          pointValue: 1,
        },
      });

      const result = compareCardsForPurchase([card1, card2], 'dining', 100);

      expect(result[0]?.cardId).toBe('card-2');
      expect(result[0]?.bestValue).toBe(3);
      expect(result[1]?.cardId).toBe('card-1');
      expect(result[1]?.bestValue).toBe(1);
    });
  });

  describe('getBestCardForCategory', () => {
    it('should return best card for category', () => {
      const card1 = createTestCard({
        id: 'card-1',
        nickname: 'Basic Card',
        rewards: { baseRate: 0.01, categories: [], pointType: 'cashback', pointValue: 1 },
      });

      const card2 = createTestCard({
        id: 'card-2',
        nickname: 'Grocery Card',
        rewards: {
          baseRate: 0.01,
          categories: [{ category: 'grocery', multiplier: 6 }],
          pointType: 'cashback',
          pointValue: 1,
        },
      });

      const best = getBestCardForCategory([card1, card2], 'grocery');
      expect(best?.id).toBe('card-2');
    });

    it('should return undefined for empty array', () => {
      const best = getBestCardForCategory([], 'dining');
      expect(best).toBeUndefined();
    });
  });

  describe('getSignupBonusProgress', () => {
    it('should return null if no signup bonus', () => {
      const card = createTestCard();
      expect(getSignupBonusProgress(card)).toBeNull();
    });

    it('should calculate progress correctly', () => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 2);

      const card = createTestCard({
        signupBonus: {
          amount: 60000,
          minSpend: 4000,
          deadline: futureDate.toISOString().split('T')[0] ?? '',
          spendToDate: 2000,
        },
      });

      const progress = getSignupBonusProgress(card);
      expect(progress?.percentComplete).toBe(50);
      expect(progress?.amountRemaining).toBe(2000);
      expect(progress?.isComplete).toBe(false);
      expect(progress?.isExpired).toBe(false);
    });

    it('should mark as complete when spend met', () => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 1);

      const card = createTestCard({
        signupBonus: {
          amount: 60000,
          minSpend: 4000,
          deadline: futureDate.toISOString().split('T')[0] ?? '',
          spendToDate: 4500,
        },
      });

      const progress = getSignupBonusProgress(card);
      expect(progress?.isComplete).toBe(true);
      expect(progress?.percentComplete).toBe(100);
    });
  });

  describe('calculateNetAnnualValue', () => {
    it('should calculate net value with no perks', () => {
      const card = createTestCard({
        annualFee: 95,
        rewards: {
          baseRate: 0.02,
          categories: [],
          pointType: 'cashback',
          pointValue: 1,
        },
      });

      const spend = { dining: 3000, grocery: 6000, other: 12000 } as Record<string, number>;
      const result = calculateNetAnnualValue(card, spend);

      // 2% on all = $420 back
      expect(result.estimatedRewards).toBe(420);
      expect(result.perkValue).toBe(0);
      expect(result.annualFee).toBe(95);
      expect(result.netValue).toBe(325);
    });

    it('should include perk value', () => {
      const card = createTestCard({
        annualFee: 550,
        rewards: {
          baseRate: 0.01,
          categories: [{ category: 'dining', multiplier: 3 }],
          pointType: 'ur',
          pointValue: 1.5,
        },
        perks: [
          { name: 'Priority Pass', estimatedAnnualValue: 429 },
          { name: 'Global Entry', estimatedAnnualValue: 20 },
        ],
      });

      const spend = { dining: 6000, other: 12000 } as Record<string, number>;
      const result = calculateNetAnnualValue(card, spend);

      expect(result.perkValue).toBe(449);
      expect(result.annualFee).toBe(550);
    });
  });
});
