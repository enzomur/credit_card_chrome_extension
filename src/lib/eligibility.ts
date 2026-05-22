// Issuer eligibility checking for Phase 4
import type { Card, HardInquiry, Issuer } from '@/types';

/**
 * Result of an eligibility check
 */
export interface EligibilityResult {
  eligible: boolean;
  rule: string;
  reason: string;
  details?: string;
}

/**
 * Chase 5/24 Rule
 * Cannot be approved if you've opened 5+ cards (any issuer) in the last 24 months
 */
export function checkChase524(cards: Card[]): EligibilityResult {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - 24);

  const recentCards = cards.filter((card) => new Date(card.openedOn) >= cutoffDate);

  if (recentCards.length >= 5) {
    return {
      eligible: false,
      rule: 'Chase 5/24',
      reason: `You have ${recentCards.length} cards opened in the last 24 months`,
      details: 'Chase generally denies applications if you\'ve opened 5 or more credit cards (from any issuer) in the past 24 months.',
    };
  }

  return {
    eligible: true,
    rule: 'Chase 5/24',
    reason: `${recentCards.length}/5 cards in 24 months`,
  };
}

/**
 * Amex 2/90 Rule
 * Can only be approved for 2 Amex credit cards in a 90-day period
 */
export function checkAmex290(cards: Card[]): EligibilityResult {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);

  const recentAmexCards = cards.filter(
    (card) => card.issuer === 'amex' && new Date(card.openedOn) >= cutoffDate
  );

  if (recentAmexCards.length >= 2) {
    return {
      eligible: false,
      rule: 'Amex 2/90',
      reason: `You have ${recentAmexCards.length} Amex cards opened in the last 90 days`,
      details: 'American Express limits approvals to 2 credit cards per 90-day period.',
    };
  }

  return {
    eligible: true,
    rule: 'Amex 2/90',
    reason: `${recentAmexCards.length}/2 Amex cards in 90 days`,
  };
}

/**
 * Amex Once-Per-Lifetime
 * Cannot get signup bonus on a card you've had before
 */
export function checkAmexLifetime(cards: Card[], productName: string): EligibilityResult {
  const previouslyHeld = cards.some(
    (card) =>
      card.issuer === 'amex' &&
      card.productName.toLowerCase().includes(productName.toLowerCase())
  );

  if (previouslyHeld) {
    return {
      eligible: false,
      rule: 'Amex Lifetime',
      reason: `You've previously held an Amex ${productName}`,
      details: 'American Express has a once-per-lifetime rule for signup bonuses. You cannot receive the bonus again if you\'ve ever held this card.',
    };
  }

  return {
    eligible: true,
    rule: 'Amex Lifetime',
    reason: 'No previous history with this product',
  };
}

/**
 * Citi 8/65 Rule
 * Can only apply for 1 Citi card per 8 days, and 2 per 65 days
 */
export function checkCiti865(_cards: Card[], inquiries: HardInquiry[]): EligibilityResult {
  const now = new Date();
  const cutoff8Days = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
  const cutoff65Days = new Date(now.getTime() - 65 * 24 * 60 * 60 * 1000);

  // Check applications (using inquiries to Citi)
  const citiInquiriesLast8Days = inquiries.filter(
    (inq) => inq.issuer === 'citi' && new Date(inq.date) >= cutoff8Days
  );

  const citiInquiriesLast65Days = inquiries.filter(
    (inq) => inq.issuer === 'citi' && new Date(inq.date) >= cutoff65Days
  );

  if (citiInquiriesLast8Days.length >= 1) {
    return {
      eligible: false,
      rule: 'Citi 8/65',
      reason: 'Applied for a Citi card within the last 8 days',
      details: 'Citi limits applications to 1 per 8-day period and 2 per 65-day period.',
    };
  }

  if (citiInquiriesLast65Days.length >= 2) {
    return {
      eligible: false,
      rule: 'Citi 8/65',
      reason: 'Applied for 2+ Citi cards within the last 65 days',
      details: 'Citi limits applications to 1 per 8-day period and 2 per 65-day period.',
    };
  }

  return {
    eligible: true,
    rule: 'Citi 8/65',
    reason: `${citiInquiriesLast8Days.length}/1 in 8 days, ${citiInquiriesLast65Days.length}/2 in 65 days`,
  };
}

/**
 * Bank of America 2/3/4 Rule
 * Max 2 cards per 2 months, 3 cards per 12 months, 4 cards total
 */
export function checkBoA234(cards: Card[]): EligibilityResult {
  const now = new Date();
  const cutoff2Months = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate());
  const cutoff12Months = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

  const boaCards = cards.filter((card) => card.issuer === 'boa');
  const boaCardsLast2Months = boaCards.filter((card) => new Date(card.openedOn) >= cutoff2Months);
  const boaCardsLast12Months = boaCards.filter((card) => new Date(card.openedOn) >= cutoff12Months);

  if (boaCardsLast2Months.length >= 2) {
    return {
      eligible: false,
      rule: 'BoA 2/3/4',
      reason: `${boaCardsLast2Months.length} BoA cards opened in the last 2 months`,
      details: 'Bank of America limits to 2 cards per 2 months, 3 cards per 12 months, and 4 cards total.',
    };
  }

  if (boaCardsLast12Months.length >= 3) {
    return {
      eligible: false,
      rule: 'BoA 2/3/4',
      reason: `${boaCardsLast12Months.length} BoA cards opened in the last 12 months`,
      details: 'Bank of America limits to 2 cards per 2 months, 3 cards per 12 months, and 4 cards total.',
    };
  }

  if (boaCards.length >= 4) {
    return {
      eligible: false,
      rule: 'BoA 2/3/4',
      reason: `You have ${boaCards.length} BoA cards total`,
      details: 'Bank of America limits to 2 cards per 2 months, 3 cards per 12 months, and 4 cards total.',
    };
  }

  return {
    eligible: true,
    rule: 'BoA 2/3/4',
    reason: `${boaCardsLast2Months.length}/2 in 2mo, ${boaCardsLast12Months.length}/3 in 12mo, ${boaCards.length}/4 total`,
  };
}

/**
 * Runs all relevant eligibility checks for an issuer
 */
export function checkIssuerEligibility(
  issuer: Issuer,
  cards: Card[],
  inquiries: HardInquiry[],
  productName?: string
): EligibilityResult[] {
  const results: EligibilityResult[] = [];

  switch (issuer) {
    case 'chase':
      results.push(checkChase524(cards));
      break;

    case 'amex':
      results.push(checkAmex290(cards));
      if (productName !== undefined) {
        results.push(checkAmexLifetime(cards, productName));
      }
      break;

    case 'citi':
      results.push(checkCiti865(cards, inquiries));
      break;

    case 'boa':
      results.push(checkBoA234(cards));
      break;

    default:
      // No specific rules for other issuers
      results.push({
        eligible: true,
        rule: 'General',
        reason: 'No specific issuer rules to check',
      });
  }

  return results;
}

/**
 * Gets a summary of the user's overall eligibility status
 */
export function getEligibilitySummary(
  cards: Card[],
  inquiries: HardInquiry[]
): Record<Issuer, { eligible: boolean; warnings: string[] }> {
  const issuers: Issuer[] = ['chase', 'amex', 'citi', 'capital_one', 'boa', 'discover', 'wells_fargo', 'us_bank', 'other'];
  const summary: Record<string, { eligible: boolean; warnings: string[] }> = {};

  for (const issuer of issuers) {
    const results = checkIssuerEligibility(issuer, cards, inquiries);
    const ineligible = results.filter((r) => !r.eligible);

    summary[issuer] = {
      eligible: ineligible.length === 0,
      warnings: ineligible.map((r) => r.reason),
    };
  }

  return summary as Record<Issuer, { eligible: boolean; warnings: string[] }>;
}
