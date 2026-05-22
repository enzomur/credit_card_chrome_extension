// Core domain types for CardCompare

export type Network = 'visa' | 'mastercard' | 'amex' | 'discover';

export type Issuer =
  | 'chase'
  | 'amex'
  | 'citi'
  | 'capital_one'
  | 'boa'
  | 'discover'
  | 'wells_fargo'
  | 'us_bank'
  | 'other';

export type Category =
  | 'dining'
  | 'grocery'
  | 'gas'
  | 'travel_flights'
  | 'travel_hotels'
  | 'travel_other'
  | 'transit'
  | 'streaming'
  | 'online_retail'
  | 'drugstore'
  | 'utilities'
  | 'wholesale_club'
  | 'other';

export type Bureau = 'experian' | 'equifax' | 'transunion';

export type PointType = 'cashback' | 'ur' | 'mr' | 'thankyou' | 'venture' | 'other';

export type CapPeriod = 'quarterly' | 'annually';

export type Quarter = 1 | 2 | 3 | 4;

export interface CategoryReward {
  category: Category;
  multiplier: number;
  cap?: number;
  capPeriod?: CapPeriod;
}

export interface RotatingCategory {
  quarter: Quarter;
  year: number;
  categories: Category[];
  activated: boolean;
}

export interface TransferPartner {
  partner: string;
  ratio: number;
  valuationCpp: number;
}

export interface Rewards {
  baseRate: number;
  categories: CategoryReward[];
  rotating?: RotatingCategory[];
  pointType: PointType;
  pointValue: number;
  transferPartners?: TransferPartner[];
}

export interface IntroApr {
  rate: number;
  endsOn: string;
}

export interface SignupBonus {
  amount: number;
  minSpend: number;
  deadline: string;
  spendToDate: number;
}

export interface Perk {
  name: string;
  estimatedAnnualValue: number;
  notes?: string;
}

export interface Card {
  id: string;
  nickname: string;
  issuer: Issuer;
  productName: string;
  network: Network;
  last4: string;
  annualFee: number;
  aprPurchase: number;
  introApr?: IntroApr;
  creditLimit?: number;
  statementDay?: number;
  dueDay?: number;
  openedOn: string;
  foreignTxFee: number;
  rewards: Rewards;
  signupBonus?: SignupBonus;
  perks?: Perk[];
  notes?: string;
}

export interface SpendEntry {
  id: string;
  cardId: string;
  category: Category;
  amount: number;
  date: string;
  merchant?: string;
}

export interface HardInquiry {
  id: string;
  bureau: Bureau;
  issuer: Issuer;
  date: string;
  productName?: string;
}

// Validation result types
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// Storage schema version for migrations
export interface StorageMetadata {
  schemaVersion: number;
  createdAt: string;
  lastModifiedAt: string;
}

// Complete storage state
export interface StorageState {
  metadata: StorageMetadata;
  cards: Card[];
  spendEntries: SpendEntry[];
  hardInquiries: HardInquiry[];
}

// Export/Import envelope
export interface EncryptedExportEnvelope {
  version: number;
  salt: string;
  iv: string;
  ciphertext: string;
  createdAt: string;
}

// Card creation input (without id, which is generated)
export type CardInput = Omit<Card, 'id'>;

// Spend entry creation input
export type SpendEntryInput = Omit<SpendEntry, 'id'>;

// Hard inquiry creation input
export type HardInquiryInput = Omit<HardInquiry, 'id'>;

// All valid networks
export const NETWORKS: readonly Network[] = ['visa', 'mastercard', 'amex', 'discover'] as const;

// All valid issuers
export const ISSUERS: readonly Issuer[] = [
  'chase',
  'amex',
  'citi',
  'capital_one',
  'boa',
  'discover',
  'wells_fargo',
  'us_bank',
  'other',
] as const;

// All valid categories
export const CATEGORIES: readonly Category[] = [
  'dining',
  'grocery',
  'gas',
  'travel_flights',
  'travel_hotels',
  'travel_other',
  'transit',
  'streaming',
  'online_retail',
  'drugstore',
  'utilities',
  'wholesale_club',
  'other',
] as const;

// All valid bureaus
export const BUREAUS: readonly Bureau[] = ['experian', 'equifax', 'transunion'] as const;

// All valid point types
export const POINT_TYPES: readonly PointType[] = [
  'cashback',
  'ur',
  'mr',
  'thankyou',
  'venture',
  'other',
] as const;

// Category display names
export const CATEGORY_LABELS: Record<Category, string> = {
  dining: 'Dining',
  grocery: 'Grocery',
  gas: 'Gas',
  travel_flights: 'Flights',
  travel_hotels: 'Hotels',
  travel_other: 'Other Travel',
  transit: 'Transit',
  streaming: 'Streaming',
  online_retail: 'Online Shopping',
  drugstore: 'Drugstore',
  utilities: 'Utilities',
  wholesale_club: 'Wholesale Club',
  other: 'Other',
};

// Issuer display names
export const ISSUER_LABELS: Record<Issuer, string> = {
  chase: 'Chase',
  amex: 'American Express',
  citi: 'Citi',
  capital_one: 'Capital One',
  boa: 'Bank of America',
  discover: 'Discover',
  wells_fargo: 'Wells Fargo',
  us_bank: 'US Bank',
  other: 'Other',
};

// Network display names
export const NETWORK_LABELS: Record<Network, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  discover: 'Discover',
};

// Point type display names
export const POINT_TYPE_LABELS: Record<PointType, string> = {
  cashback: 'Cash Back',
  ur: 'Chase Ultimate Rewards',
  mr: 'Amex Membership Rewards',
  thankyou: 'Citi ThankYou Points',
  venture: 'Capital One Miles',
  other: 'Other Points',
};
