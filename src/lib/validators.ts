import type {
  Card,
  CardInput,
  Category,
  HardInquiry,
  HardInquiryInput,
  Issuer,
  Network,
  PointType,
  SpendEntry,
  SpendEntryInput,
  ValidationResult,
} from '@/types';
import { BUREAUS, CATEGORIES, ISSUERS, NETWORKS, POINT_TYPES } from '@/types';

// Luhn algorithm to detect potential full card numbers
function luhnCheck(numStr: string): boolean {
  const digits = numStr.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) {
    return false;
  }

  let sum = 0;
  let isEven = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i] ?? '0', 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

// Check if a string contains what appears to be a full card number
export function containsFullCardNumber(input: string): boolean {
  // Remove common separators
  const normalized = input.replace(/[\s\-.]/g, '');

  // Check for 13-19 digit sequences that pass Luhn
  const digitSequences = normalized.match(/\d{13,19}/g);
  if (digitSequences === null) {
    return false;
  }

  return digitSequences.some(luhnCheck);
}

// Validate that a string is exactly 4 digits
export function validateLast4(last4: string): ValidationResult {
  const errors: string[] = [];

  if (!/^\d{4}$/.test(last4)) {
    errors.push('Last 4 digits must be exactly 4 numeric digits');
  }

  return { valid: errors.length === 0, errors };
}

// Validate ISO date string (YYYY-MM-DD)
export function validateIsoDate(date: string): ValidationResult {
  const errors: string[] = [];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.push('Date must be in YYYY-MM-DD format');
    return { valid: false, errors };
  }

  const parts = date.split('-');
  const year = parseInt(parts[0] ?? '0', 10);
  const month = parseInt(parts[1] ?? '0', 10);
  const day = parseInt(parts[2] ?? '0', 10);

  // Create date and verify it matches input (catches invalid dates like Feb 30)
  const parsed = new Date(year, month - 1, day);
  if (
    isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    errors.push('Invalid date');
  }

  return { valid: errors.length === 0, errors };
}

// Validate nickname (non-empty, reasonable length, no dangerous characters)
export function validateNickname(nickname: string): ValidationResult {
  const errors: string[] = [];

  const trimmed = nickname.trim();
  if (trimmed.length === 0) {
    errors.push('Nickname cannot be empty');
  }
  if (trimmed.length > 50) {
    errors.push('Nickname must be 50 characters or less');
  }
  if (containsFullCardNumber(nickname)) {
    errors.push('Nickname appears to contain a full card number');
  }

  return { valid: errors.length === 0, errors };
}

// Validate product name
export function validateProductName(name: string): ValidationResult {
  const errors: string[] = [];

  const trimmed = name.trim();
  if (trimmed.length === 0) {
    errors.push('Product name cannot be empty');
  }
  if (trimmed.length > 100) {
    errors.push('Product name must be 100 characters or less');
  }
  if (containsFullCardNumber(name)) {
    errors.push('Product name appears to contain a full card number');
  }

  return { valid: errors.length === 0, errors };
}

// Validate network
export function validateNetwork(network: string): ValidationResult {
  const errors: string[] = [];

  if (!NETWORKS.includes(network as Network)) {
    errors.push(`Invalid network. Must be one of: ${NETWORKS.join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}

// Validate issuer
export function validateIssuer(issuer: string): ValidationResult {
  const errors: string[] = [];

  if (!ISSUERS.includes(issuer as Issuer)) {
    errors.push(`Invalid issuer. Must be one of: ${ISSUERS.join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}

// Validate category
export function validateCategory(category: string): ValidationResult {
  const errors: string[] = [];

  if (!CATEGORIES.includes(category as Category)) {
    errors.push(`Invalid category. Must be one of: ${CATEGORIES.join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}

// Validate point type
export function validatePointType(pointType: string): ValidationResult {
  const errors: string[] = [];

  if (!POINT_TYPES.includes(pointType as PointType)) {
    errors.push(`Invalid point type. Must be one of: ${POINT_TYPES.join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}

// Validate numeric value is non-negative
export function validateNonNegativeNumber(value: number, fieldName: string): ValidationResult {
  const errors: string[] = [];

  if (typeof value !== 'number' || isNaN(value)) {
    errors.push(`${fieldName} must be a valid number`);
  } else if (value < 0) {
    errors.push(`${fieldName} cannot be negative`);
  }

  return { valid: errors.length === 0, errors };
}

// Validate percentage (0-100 range for display, but stored as decimal)
export function validatePercentage(value: number, fieldName: string): ValidationResult {
  const errors: string[] = [];

  if (typeof value !== 'number' || isNaN(value)) {
    errors.push(`${fieldName} must be a valid number`);
  } else if (value < 0) {
    errors.push(`${fieldName} cannot be negative`);
  } else if (value > 100) {
    errors.push(`${fieldName} cannot exceed 100%`);
  }

  return { valid: errors.length === 0, errors };
}

// Validate statement/due day (1-28)
export function validateStatementDay(day: number): ValidationResult {
  const errors: string[] = [];

  if (!Number.isInteger(day)) {
    errors.push('Statement/due day must be a whole number');
  } else if (day < 1 || day > 28) {
    errors.push('Statement/due day must be between 1 and 28');
  }

  return { valid: errors.length === 0, errors };
}

// Validate rate (decimal, e.g., 0.01 for 1%)
export function validateRate(rate: number, fieldName: string): ValidationResult {
  const errors: string[] = [];

  if (typeof rate !== 'number' || isNaN(rate)) {
    errors.push(`${fieldName} must be a valid number`);
  } else if (rate < 0) {
    errors.push(`${fieldName} cannot be negative`);
  } else if (rate > 1) {
    errors.push(`${fieldName} should be a decimal (e.g., 0.05 for 5%)`);
  }

  return { valid: errors.length === 0, errors };
}

// Validate notes/text field for dangerous content
export function validateTextContent(text: string | undefined, fieldName: string): ValidationResult {
  const errors: string[] = [];

  if (text === undefined) {
    return { valid: true, errors: [] };
  }

  if (text.length > 1000) {
    errors.push(`${fieldName} must be 1000 characters or less`);
  }
  if (containsFullCardNumber(text)) {
    errors.push(`${fieldName} appears to contain a full card number`);
  }

  return { valid: errors.length === 0, errors };
}

// Validate UUID format
export function validateUuid(id: string): ValidationResult {
  const errors: string[] = [];

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    errors.push('Invalid UUID format');
  }

  return { valid: errors.length === 0, errors };
}

// Combine multiple validation results
function combineValidationResults(results: ValidationResult[]): ValidationResult {
  const allErrors = results.flatMap((r) => r.errors);
  return { valid: allErrors.length === 0, errors: allErrors };
}

// Full card validation
export function validateCard(card: Card | CardInput): ValidationResult {
  const results: ValidationResult[] = [];

  // Check for id if it's a full Card
  if ('id' in card) {
    results.push(validateUuid(card.id));
  }

  results.push(validateNickname(card.nickname));
  results.push(validateIssuer(card.issuer));
  results.push(validateProductName(card.productName));
  results.push(validateNetwork(card.network));
  results.push(validateLast4(card.last4));
  results.push(validateNonNegativeNumber(card.annualFee, 'Annual fee'));
  results.push(validateNonNegativeNumber(card.aprPurchase, 'APR'));
  // openedOn is optional - only validate if provided
  if (card.openedOn !== undefined && card.openedOn !== '') {
    results.push(validateIsoDate(card.openedOn));
  }
  results.push(validatePercentage(card.foreignTxFee, 'Foreign transaction fee'));
  results.push(validateTextContent(card.notes, 'Notes'));

  // Validate intro APR if present
  if (card.introApr !== undefined) {
    results.push(validateNonNegativeNumber(card.introApr.rate, 'Intro APR rate'));
    results.push(validateIsoDate(card.introApr.endsOn));
  }

  // Validate credit limit if present
  if (card.creditLimit !== undefined) {
    results.push(validateNonNegativeNumber(card.creditLimit, 'Credit limit'));
  }

  // Validate statement/due days if present
  if (card.statementDay !== undefined) {
    results.push(validateStatementDay(card.statementDay));
  }
  if (card.dueDay !== undefined) {
    results.push(validateStatementDay(card.dueDay));
  }

  // Validate rewards
  results.push(validateRate(card.rewards.baseRate, 'Base reward rate'));
  results.push(validatePointType(card.rewards.pointType));
  results.push(validateNonNegativeNumber(card.rewards.pointValue, 'Point value'));

  for (const catReward of card.rewards.categories) {
    results.push(validateCategory(catReward.category));
    results.push(validateNonNegativeNumber(catReward.multiplier, 'Category multiplier'));
    if (catReward.cap !== undefined) {
      results.push(validateNonNegativeNumber(catReward.cap, 'Category cap'));
    }
  }

  // Validate rotating categories if present
  if (card.rewards.rotating !== undefined) {
    for (const rotating of card.rewards.rotating) {
      if (rotating.quarter < 1 || rotating.quarter > 4) {
        results.push({ valid: false, errors: ['Quarter must be 1-4'] });
      }
      for (const cat of rotating.categories) {
        results.push(validateCategory(cat));
      }
    }
  }

  // Validate transfer partners if present
  if (card.rewards.transferPartners !== undefined) {
    for (const partner of card.rewards.transferPartners) {
      if (partner.partner.trim().length === 0) {
        results.push({ valid: false, errors: ['Transfer partner name cannot be empty'] });
      }
      results.push(validateNonNegativeNumber(partner.ratio, 'Transfer ratio'));
      results.push(validateNonNegativeNumber(partner.valuationCpp, 'Partner valuation'));
    }
  }

  // Validate signup bonus if present
  if (card.signupBonus !== undefined) {
    results.push(validateNonNegativeNumber(card.signupBonus.amount, 'Signup bonus amount'));
    results.push(validateNonNegativeNumber(card.signupBonus.minSpend, 'Minimum spend'));
    results.push(validateIsoDate(card.signupBonus.deadline));
    results.push(validateNonNegativeNumber(card.signupBonus.spendToDate, 'Spend to date'));
  }

  // Validate perks if present
  if (card.perks !== undefined) {
    for (const perk of card.perks) {
      if (perk.name.trim().length === 0) {
        results.push({ valid: false, errors: ['Perk name cannot be empty'] });
      }
      if (perk.name.length > 100) {
        results.push({ valid: false, errors: ['Perk name must be 100 characters or less'] });
      }
      results.push(validateNonNegativeNumber(perk.estimatedAnnualValue, 'Perk value'));
      results.push(validateTextContent(perk.notes, 'Perk notes'));
    }
  }

  return combineValidationResults(results);
}

// Full spend entry validation
export function validateSpendEntry(entry: SpendEntry | SpendEntryInput): ValidationResult {
  const results: ValidationResult[] = [];

  if ('id' in entry) {
    results.push(validateUuid(entry.id));
  }

  results.push(validateUuid(entry.cardId));
  results.push(validateCategory(entry.category));
  results.push(validateNonNegativeNumber(entry.amount, 'Amount'));
  results.push(validateIsoDate(entry.date));
  results.push(validateTextContent(entry.merchant, 'Merchant'));

  return combineValidationResults(results);
}

// Full hard inquiry validation
export function validateHardInquiry(inquiry: HardInquiry | HardInquiryInput): ValidationResult {
  const results: ValidationResult[] = [];

  if ('id' in inquiry) {
    results.push(validateUuid(inquiry.id));
  }

  if (!BUREAUS.includes(inquiry.bureau)) {
    results.push({ valid: false, errors: [`Invalid bureau. Must be one of: ${BUREAUS.join(', ')}`] });
  }

  results.push(validateIssuer(inquiry.issuer));
  results.push(validateIsoDate(inquiry.date));
  results.push(validateTextContent(inquiry.productName, 'Product name'));

  return combineValidationResults(results);
}

// Sanitize string for safe display (no HTML injection)
export function sanitizeForDisplay(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// Generate a UUID v4
export function generateUuid(): string {
  return crypto.randomUUID();
}
