// Rewards calculation engine for Phase 2
import type { Card, Category, CategoryReward } from '@/types';

/**
 * Result of comparing cards for a specific purchase
 */
export interface CardComparison {
  cardId: string;
  cardNickname: string;
  earnRate: number;
  pointsEarned: number;
  cashbackValue: number;
  transferValue?: number;
  bestValue: number;
  isRotating: boolean;
  capRemaining?: number;
}

/**
 * Calculates the effective earn rate for a card in a specific category
 */
export function getEffectiveRate(card: Card, category: Category): {
  rate: number;
  isRotating: boolean;
  categoryReward?: CategoryReward;
} {
  // Check rotating categories first (if activated)
  if (card.rewards.rotating !== undefined) {
    const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3) as 1 | 2 | 3 | 4;
    const currentYear = new Date().getFullYear();

    const activeRotating = card.rewards.rotating.find(
      (r) => r.quarter === currentQuarter && r.year === currentYear && r.activated
    );

    if (activeRotating?.categories.includes(category) === true) {
      // Rotating categories typically have a 5x multiplier
      return { rate: 0.05, isRotating: true };
    }
  }

  // Check category bonuses
  const categoryReward = card.rewards.categories.find((c) => c.category === category);
  if (categoryReward !== undefined) {
    return {
      rate: categoryReward.multiplier / 100,
      isRotating: false,
      categoryReward,
    };
  }

  // Fall back to base rate
  return { rate: card.rewards.baseRate, isRotating: false };
}

/**
 * Calculates the value of points for a card
 * Returns both cashback value and best transfer partner value
 */
export function calculatePointValue(
  card: Card,
  pointsEarned: number
): { cashbackValue: number; transferValue?: number; bestTransferPartner?: string } {
  // Base cashback value
  const cashbackValue = pointsEarned * card.rewards.pointValue / 100;

  // Check transfer partners for better value
  if (card.rewards.transferPartners !== undefined && card.rewards.transferPartners.length > 0) {
    let bestTransferValue = 0;
    let bestPartner: string | undefined;

    for (const partner of card.rewards.transferPartners) {
      const transferredPoints = pointsEarned * partner.ratio;
      const value = transferredPoints * partner.valuationCpp / 100;

      if (value > bestTransferValue) {
        bestTransferValue = value;
        bestPartner = partner.partner;
      }
    }

    if (bestTransferValue > cashbackValue && bestPartner !== undefined) {
      return { cashbackValue, transferValue: bestTransferValue, bestTransferPartner: bestPartner };
    }
  }

  return { cashbackValue };
}

/**
 * Compares all cards for a specific purchase and returns ranked results
 */
export function compareCardsForPurchase(
  cards: Card[],
  category: Category,
  amount: number
): CardComparison[] {
  const comparisons: CardComparison[] = [];

  for (const card of cards) {
    const { rate, isRotating, categoryReward } = getEffectiveRate(card, category);
    const pointsEarned = amount * rate * 100; // Convert to points

    const { cashbackValue, transferValue } = calculatePointValue(card, pointsEarned);

    const bestValue = transferValue !== undefined ? Math.max(cashbackValue, transferValue) : cashbackValue;

    const comparison: CardComparison = {
      cardId: card.id,
      cardNickname: card.nickname,
      earnRate: rate,
      pointsEarned,
      cashbackValue,
      bestValue,
      isRotating,
    };
    if (transferValue !== undefined) {
      comparison.transferValue = transferValue;
    }
    if (categoryReward?.cap !== undefined) {
      comparison.capRemaining = categoryReward.cap;
    }
    comparisons.push(comparison);
  }

  // Sort by best value descending
  return comparisons.sort((a, b) => b.bestValue - a.bestValue);
}

/**
 * Gets the best card for a specific category (quick lookup)
 */
export function getBestCardForCategory(
  cards: Card[],
  category: Category
): Card | undefined {
  let bestCard: Card | undefined;
  let bestRate = 0;

  for (const card of cards) {
    const { rate } = getEffectiveRate(card, category);
    if (rate > bestRate) {
      bestRate = rate;
      bestCard = card;
    }
  }

  return bestCard;
}

/**
 * Calculates signup bonus progress
 */
export function getSignupBonusProgress(card: Card): {
  hasBonus: boolean;
  spendToDate: number;
  minSpend: number;
  percentComplete: number;
  amountRemaining: number;
  daysRemaining: number;
  isComplete: boolean;
  isExpired: boolean;
} | null {
  if (card.signupBonus === undefined) {
    return null;
  }

  const { minSpend, deadline, spendToDate } = card.signupBonus;
  const deadlineDate = new Date(deadline);
  const today = new Date();
  const daysRemaining = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  return {
    hasBonus: true,
    spendToDate,
    minSpend,
    percentComplete: Math.min(100, (spendToDate / minSpend) * 100),
    amountRemaining: Math.max(0, minSpend - spendToDate),
    daysRemaining: Math.max(0, daysRemaining),
    isComplete: spendToDate >= minSpend,
    isExpired: daysRemaining < 0 && spendToDate < minSpend,
  };
}

/**
 * Calculates the net annual value of a card
 * (estimated rewards + perks - annual fee)
 */
export function calculateNetAnnualValue(
  card: Card,
  estimatedAnnualSpend: Record<Category, number>
): {
  estimatedRewards: number;
  perkValue: number;
  annualFee: number;
  netValue: number;
} {
  let estimatedRewards = 0;

  // Calculate rewards from each category
  for (const [category, spend] of Object.entries(estimatedAnnualSpend) as [Category, number][]) {
    const { rate } = getEffectiveRate(card, category);
    const points = spend * rate * 100;
    const { cashbackValue, transferValue } = calculatePointValue(card, points);
    estimatedRewards += transferValue !== undefined ? Math.max(cashbackValue, transferValue) : cashbackValue;
  }

  // Calculate perk value
  const perkValue = card.perks?.reduce((sum, perk) => sum + perk.estimatedAnnualValue, 0) ?? 0;

  return {
    estimatedRewards,
    perkValue,
    annualFee: card.annualFee,
    netValue: estimatedRewards + perkValue - card.annualFee,
  };
}
