import { describe, it, expect } from 'vitest';
import {
  containsFullCardNumber,
  validateLast4,
  validateIsoDate,
  validateNickname,
  validateProductName,
  validateNetwork,
  validateIssuer,
  validateCategory,
  validatePointType,
  validateNonNegativeNumber,
  validatePercentage,
  validateStatementDay,
  validateRate,
  validateTextContent,
  validateUuid,
  validateCard,
  validateSpendEntry,
  validateHardInquiry,
  sanitizeForDisplay,
  generateUuid,
} from '@/lib/validators';
import type { Card, CardInput, SpendEntryInput, HardInquiryInput } from '@/types';

describe('containsFullCardNumber', () => {
  it('should detect valid Luhn card numbers', () => {
    // Test Visa card number (passes Luhn)
    expect(containsFullCardNumber('4532015112830366')).toBe(true);
    // With spaces
    expect(containsFullCardNumber('4532 0151 1283 0366')).toBe(true);
    // With dashes
    expect(containsFullCardNumber('4532-0151-1283-0366')).toBe(true);
  });

  it('should not flag last 4 digits', () => {
    expect(containsFullCardNumber('0366')).toBe(false);
    expect(containsFullCardNumber('1234')).toBe(false);
  });

  it('should not flag random text', () => {
    expect(containsFullCardNumber('Chase Sapphire Preferred')).toBe(false);
    expect(containsFullCardNumber('My favorite card')).toBe(false);
  });

  it('should not flag numbers that fail Luhn', () => {
    expect(containsFullCardNumber('1234567890123456')).toBe(false);
  });

  it('should detect card numbers embedded in text', () => {
    expect(containsFullCardNumber('Card number is 4532015112830366 for reference')).toBe(true);
  });
});

describe('validateLast4', () => {
  it('should accept valid 4-digit strings', () => {
    expect(validateLast4('1234').valid).toBe(true);
    expect(validateLast4('0000').valid).toBe(true);
    expect(validateLast4('9999').valid).toBe(true);
  });

  it('should reject non-4-digit strings', () => {
    expect(validateLast4('123').valid).toBe(false);
    expect(validateLast4('12345').valid).toBe(false);
    expect(validateLast4('abcd').valid).toBe(false);
    expect(validateLast4('12a4').valid).toBe(false);
    expect(validateLast4('').valid).toBe(false);
  });
});

describe('validateIsoDate', () => {
  it('should accept valid ISO dates', () => {
    expect(validateIsoDate('2024-01-15').valid).toBe(true);
    expect(validateIsoDate('2023-12-31').valid).toBe(true);
  });

  it('should reject invalid date formats', () => {
    expect(validateIsoDate('01-15-2024').valid).toBe(false);
    expect(validateIsoDate('2024/01/15').valid).toBe(false);
    expect(validateIsoDate('January 15, 2024').valid).toBe(false);
    expect(validateIsoDate('').valid).toBe(false);
  });

  it('should reject invalid dates', () => {
    expect(validateIsoDate('2024-13-01').valid).toBe(false);
    expect(validateIsoDate('2024-02-30').valid).toBe(false);
  });
});

describe('validateNickname', () => {
  it('should accept valid nicknames', () => {
    expect(validateNickname('Sapphire').valid).toBe(true);
    expect(validateNickname('Primary Card').valid).toBe(true);
    expect(validateNickname('A').valid).toBe(true);
  });

  it('should reject empty nicknames', () => {
    expect(validateNickname('').valid).toBe(false);
    expect(validateNickname('   ').valid).toBe(false);
  });

  it('should reject overly long nicknames', () => {
    expect(validateNickname('a'.repeat(51)).valid).toBe(false);
  });

  it('should reject nicknames containing card numbers', () => {
    expect(validateNickname('Card 4532015112830366').valid).toBe(false);
  });
});

describe('validateProductName', () => {
  it('should accept valid product names', () => {
    expect(validateProductName('Chase Sapphire Preferred').valid).toBe(true);
    expect(validateProductName('Amex Gold').valid).toBe(true);
  });

  it('should reject empty product names', () => {
    expect(validateProductName('').valid).toBe(false);
  });

  it('should reject overly long product names', () => {
    expect(validateProductName('a'.repeat(101)).valid).toBe(false);
  });
});

describe('validateNetwork', () => {
  it('should accept valid networks', () => {
    expect(validateNetwork('visa').valid).toBe(true);
    expect(validateNetwork('mastercard').valid).toBe(true);
    expect(validateNetwork('amex').valid).toBe(true);
    expect(validateNetwork('discover').valid).toBe(true);
  });

  it('should reject invalid networks', () => {
    expect(validateNetwork('jcb').valid).toBe(false);
    expect(validateNetwork('').valid).toBe(false);
  });
});

describe('validateIssuer', () => {
  it('should accept valid issuers', () => {
    expect(validateIssuer('chase').valid).toBe(true);
    expect(validateIssuer('amex').valid).toBe(true);
    expect(validateIssuer('other').valid).toBe(true);
  });

  it('should reject invalid issuers', () => {
    expect(validateIssuer('bank of mars').valid).toBe(false);
    expect(validateIssuer('').valid).toBe(false);
  });
});

describe('validateCategory', () => {
  it('should accept valid categories', () => {
    expect(validateCategory('dining').valid).toBe(true);
    expect(validateCategory('grocery').valid).toBe(true);
    expect(validateCategory('travel_flights').valid).toBe(true);
  });

  it('should reject invalid categories', () => {
    expect(validateCategory('food').valid).toBe(false);
    expect(validateCategory('').valid).toBe(false);
  });
});

describe('validatePointType', () => {
  it('should accept valid point types', () => {
    expect(validatePointType('cashback').valid).toBe(true);
    expect(validatePointType('ur').valid).toBe(true);
    expect(validatePointType('mr').valid).toBe(true);
  });

  it('should reject invalid point types', () => {
    expect(validatePointType('rewards').valid).toBe(false);
  });
});

describe('validateNonNegativeNumber', () => {
  it('should accept non-negative numbers', () => {
    expect(validateNonNegativeNumber(0, 'test').valid).toBe(true);
    expect(validateNonNegativeNumber(100, 'test').valid).toBe(true);
    expect(validateNonNegativeNumber(0.5, 'test').valid).toBe(true);
  });

  it('should reject negative numbers', () => {
    expect(validateNonNegativeNumber(-1, 'test').valid).toBe(false);
  });

  it('should reject NaN', () => {
    expect(validateNonNegativeNumber(NaN, 'test').valid).toBe(false);
  });
});

describe('validatePercentage', () => {
  it('should accept valid percentages', () => {
    expect(validatePercentage(0, 'test').valid).toBe(true);
    expect(validatePercentage(50, 'test').valid).toBe(true);
    expect(validatePercentage(100, 'test').valid).toBe(true);
  });

  it('should reject percentages over 100', () => {
    expect(validatePercentage(101, 'test').valid).toBe(false);
  });

  it('should reject negative percentages', () => {
    expect(validatePercentage(-1, 'test').valid).toBe(false);
  });
});

describe('validateStatementDay', () => {
  it('should accept days 1-28', () => {
    expect(validateStatementDay(1).valid).toBe(true);
    expect(validateStatementDay(15).valid).toBe(true);
    expect(validateStatementDay(28).valid).toBe(true);
  });

  it('should reject days outside 1-28', () => {
    expect(validateStatementDay(0).valid).toBe(false);
    expect(validateStatementDay(29).valid).toBe(false);
    expect(validateStatementDay(31).valid).toBe(false);
  });

  it('should reject non-integers', () => {
    expect(validateStatementDay(15.5).valid).toBe(false);
  });
});

describe('validateRate', () => {
  it('should accept valid decimal rates', () => {
    expect(validateRate(0.01, 'test').valid).toBe(true);
    expect(validateRate(0.05, 'test').valid).toBe(true);
    expect(validateRate(0, 'test').valid).toBe(true);
  });

  it('should reject rates over 1', () => {
    expect(validateRate(1.5, 'test').valid).toBe(false);
  });

  it('should reject negative rates', () => {
    expect(validateRate(-0.01, 'test').valid).toBe(false);
  });
});

describe('validateTextContent', () => {
  it('should accept valid text', () => {
    expect(validateTextContent('Some notes here', 'test').valid).toBe(true);
    expect(validateTextContent(undefined, 'test').valid).toBe(true);
  });

  it('should reject text over 1000 characters', () => {
    expect(validateTextContent('a'.repeat(1001), 'test').valid).toBe(false);
  });

  it('should reject text containing card numbers', () => {
    expect(validateTextContent('Card 4532015112830366', 'test').valid).toBe(false);
  });
});

describe('validateUuid', () => {
  it('should accept valid UUIDs', () => {
    expect(validateUuid('550e8400-e29b-41d4-a716-446655440000').valid).toBe(true);
    expect(validateUuid('6ba7b810-9dad-11d1-80b4-00c04fd430c8').valid).toBe(true);
  });

  it('should reject invalid UUIDs', () => {
    expect(validateUuid('not-a-uuid').valid).toBe(false);
    expect(validateUuid('').valid).toBe(false);
    expect(validateUuid('12345678-1234-1234-1234-123456789012').valid).toBe(false); // wrong version
  });
});

describe('validateCard', () => {
  const validCardInput: CardInput = {
    nickname: 'Test Card',
    issuer: 'chase',
    productName: 'Sapphire Preferred',
    network: 'visa',
    last4: '1234',
    annualFee: 95,
    aprPurchase: 24.99,
    openedOn: '2023-01-15',
    foreignTxFee: 0,
    rewards: {
      baseRate: 0.01,
      categories: [{ category: 'dining', multiplier: 3 }],
      pointType: 'ur',
      pointValue: 1.25,
    },
  };

  it('should accept valid card input', () => {
    expect(validateCard(validCardInput).valid).toBe(true);
  });

  it('should accept valid card with all optional fields', () => {
    const fullCard: CardInput = {
      ...validCardInput,
      introApr: { rate: 0, endsOn: '2024-01-15' },
      creditLimit: 10000,
      statementDay: 15,
      dueDay: 10,
      signupBonus: {
        amount: 60000,
        minSpend: 4000,
        deadline: '2023-04-15',
        spendToDate: 2000,
      },
      perks: [{ name: 'Priority Pass', estimatedAnnualValue: 429 }],
      notes: 'Primary travel card',
    };
    expect(validateCard(fullCard).valid).toBe(true);
  });

  it('should reject card with invalid issuer', () => {
    const result = validateCard({ ...validCardInput, issuer: 'invalid' as 'chase' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('issuer'))).toBe(true);
  });

  it('should reject card with invalid last4', () => {
    const result = validateCard({ ...validCardInput, last4: '123' });
    expect(result.valid).toBe(false);
  });

  it('should reject card with card number in nickname', () => {
    const result = validateCard({ ...validCardInput, nickname: '4532015112830366' });
    expect(result.valid).toBe(false);
  });
});

describe('validateSpendEntry', () => {
  const validEntry: SpendEntryInput = {
    cardId: '550e8400-e29b-41d4-a716-446655440000',
    category: 'dining',
    amount: 50.0,
    date: '2024-01-15',
  };

  it('should accept valid spend entry', () => {
    expect(validateSpendEntry(validEntry).valid).toBe(true);
  });

  it('should accept spend entry with merchant', () => {
    expect(validateSpendEntry({ ...validEntry, merchant: 'Local Restaurant' }).valid).toBe(true);
  });

  it('should reject entry with invalid category', () => {
    const result = validateSpendEntry({ ...validEntry, category: 'food' as 'dining' });
    expect(result.valid).toBe(false);
  });

  it('should reject entry with negative amount', () => {
    const result = validateSpendEntry({ ...validEntry, amount: -50 });
    expect(result.valid).toBe(false);
  });
});

describe('validateHardInquiry', () => {
  const validInquiry: HardInquiryInput = {
    bureau: 'experian',
    issuer: 'chase',
    date: '2024-01-15',
  };

  it('should accept valid hard inquiry', () => {
    expect(validateHardInquiry(validInquiry).valid).toBe(true);
  });

  it('should accept inquiry with product name', () => {
    expect(validateHardInquiry({ ...validInquiry, productName: 'Sapphire Reserve' }).valid).toBe(
      true
    );
  });

  it('should reject inquiry with invalid bureau', () => {
    const result = validateHardInquiry({ ...validInquiry, bureau: 'fico' as 'experian' });
    expect(result.valid).toBe(false);
  });
});

describe('sanitizeForDisplay', () => {
  it('should escape HTML entities', () => {
    expect(sanitizeForDisplay('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('should escape ampersands', () => {
    expect(sanitizeForDisplay('A & B')).toBe('A &amp; B');
  });

  it('should escape quotes', () => {
    expect(sanitizeForDisplay("It's a \"test\"")).toBe('It&#x27;s a &quot;test&quot;');
  });

  it('should leave plain text unchanged', () => {
    expect(sanitizeForDisplay('Plain text')).toBe('Plain text');
  });
});

describe('generateUuid', () => {
  it('should generate valid UUIDs', () => {
    const uuid = generateUuid();
    expect(validateUuid(uuid).valid).toBe(true);
  });

  it('should generate unique UUIDs', () => {
    const uuid1 = generateUuid();
    const uuid2 = generateUuid();
    expect(uuid1).not.toBe(uuid2);
  });
});
