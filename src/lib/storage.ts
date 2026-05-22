import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  Card,
  CardInput,
  HardInquiry,
  HardInquiryInput,
  SpendEntry,
  SpendEntryInput,
  StorageMetadata,
} from '@/types';
import {
  generateUuid,
  validateCard,
  validateHardInquiry,
  validateSpendEntry,
} from './validators';

const DB_NAME = 'cardcompare';
const CURRENT_SCHEMA_VERSION = 1;

interface CardCompareDB extends DBSchema {
  cards: {
    key: string;
    value: Card;
    indexes: {
      'by-issuer': string;
      'by-network': string;
      'by-openedOn': string;
    };
  };
  spendEntries: {
    key: string;
    value: SpendEntry;
    indexes: {
      'by-cardId': string;
      'by-date': string;
      'by-category': string;
    };
  };
  hardInquiries: {
    key: string;
    value: HardInquiry;
    indexes: {
      'by-date': string;
      'by-issuer': string;
      'by-bureau': string;
    };
  };
  metadata: {
    key: number;
    value: StorageMetadata;
  };
}

let dbInstance: IDBPDatabase<CardCompareDB> | null = null;

async function getDb(): Promise<IDBPDatabase<CardCompareDB>> {
  if (dbInstance !== null) {
    return dbInstance;
  }

  dbInstance = await openDB<CardCompareDB>(DB_NAME, CURRENT_SCHEMA_VERSION, {
    upgrade(db, oldVersion, _newVersion, _transaction) {
      // Version 1: Initial schema
      if (oldVersion < 1) {
        // Cards store
        const cardsStore = db.createObjectStore('cards', { keyPath: 'id' });
        cardsStore.createIndex('by-issuer', 'issuer');
        cardsStore.createIndex('by-network', 'network');
        cardsStore.createIndex('by-openedOn', 'openedOn');

        // Spend entries store
        const spendStore = db.createObjectStore('spendEntries', { keyPath: 'id' });
        spendStore.createIndex('by-cardId', 'cardId');
        spendStore.createIndex('by-date', 'date');
        spendStore.createIndex('by-category', 'category');

        // Hard inquiries store
        const inquiriesStore = db.createObjectStore('hardInquiries', { keyPath: 'id' });
        inquiriesStore.createIndex('by-date', 'date');
        inquiriesStore.createIndex('by-issuer', 'issuer');
        inquiriesStore.createIndex('by-bureau', 'bureau');

        // Metadata store
        db.createObjectStore('metadata', { keyPath: 'schemaVersion' });
      }

      // Future migrations would go here:
      // if (oldVersion < 2) { ... }
    },
  });

  // Initialize metadata if needed
  const existingMetadata = await dbInstance.get('metadata', CURRENT_SCHEMA_VERSION);
  if (existingMetadata === undefined) {
    const now = new Date().toISOString();
    await dbInstance.put('metadata', {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      createdAt: now,
      lastModifiedAt: now,
    });
  }

  return dbInstance;
}

// Update the lastModifiedAt timestamp
async function updateLastModified(): Promise<void> {
  const db = await getDb();
  const metadata = await db.get('metadata', CURRENT_SCHEMA_VERSION);
  if (metadata !== undefined) {
    metadata.lastModifiedAt = new Date().toISOString();
    await db.put('metadata', metadata);
  }
}

// ============ Card Operations ============

export async function getAllCards(): Promise<Card[]> {
  const db = await getDb();
  return db.getAll('cards');
}

export async function getCard(id: string): Promise<Card | undefined> {
  const db = await getDb();
  return db.get('cards', id);
}

export async function addCard(input: CardInput): Promise<Card> {
  const card: Card = {
    ...input,
    id: generateUuid(),
  };

  const validation = validateCard(card);
  if (!validation.valid) {
    throw new Error(`Invalid card data: ${validation.errors.join(', ')}`);
  }

  const db = await getDb();
  await db.add('cards', card);
  await updateLastModified();

  return card;
}

export async function updateCard(card: Card): Promise<Card> {
  const validation = validateCard(card);
  if (!validation.valid) {
    throw new Error(`Invalid card data: ${validation.errors.join(', ')}`);
  }

  const db = await getDb();
  const existing = await db.get('cards', card.id);
  if (existing === undefined) {
    throw new Error(`Card with id ${card.id} not found`);
  }

  await db.put('cards', card);
  await updateLastModified();

  return card;
}

export async function deleteCard(id: string): Promise<void> {
  const db = await getDb();
  const existing = await db.get('cards', id);
  if (existing === undefined) {
    throw new Error(`Card with id ${id} not found`);
  }

  // Also delete associated spend entries
  const spendEntries = await db.getAllFromIndex('spendEntries', 'by-cardId', id);
  const tx = db.transaction(['cards', 'spendEntries'], 'readwrite');

  for (const entry of spendEntries) {
    await tx.objectStore('spendEntries').delete(entry.id);
  }
  await tx.objectStore('cards').delete(id);

  await tx.done;
  await updateLastModified();
}

export async function getCardsByIssuer(issuer: string): Promise<Card[]> {
  const db = await getDb();
  return db.getAllFromIndex('cards', 'by-issuer', issuer);
}

export async function getCardsByNetwork(network: string): Promise<Card[]> {
  const db = await getDb();
  return db.getAllFromIndex('cards', 'by-network', network);
}

// ============ Spend Entry Operations ============

export async function getAllSpendEntries(): Promise<SpendEntry[]> {
  const db = await getDb();
  return db.getAll('spendEntries');
}

export async function getSpendEntry(id: string): Promise<SpendEntry | undefined> {
  const db = await getDb();
  return db.get('spendEntries', id);
}

export async function addSpendEntry(input: SpendEntryInput): Promise<SpendEntry> {
  const entry: SpendEntry = {
    ...input,
    id: generateUuid(),
  };

  const validation = validateSpendEntry(entry);
  if (!validation.valid) {
    throw new Error(`Invalid spend entry: ${validation.errors.join(', ')}`);
  }

  // Verify card exists
  const db = await getDb();
  const card = await db.get('cards', entry.cardId);
  if (card === undefined) {
    throw new Error(`Card with id ${entry.cardId} not found`);
  }

  await db.add('spendEntries', entry);
  await updateLastModified();

  return entry;
}

export async function updateSpendEntry(entry: SpendEntry): Promise<SpendEntry> {
  const validation = validateSpendEntry(entry);
  if (!validation.valid) {
    throw new Error(`Invalid spend entry: ${validation.errors.join(', ')}`);
  }

  const db = await getDb();
  const existing = await db.get('spendEntries', entry.id);
  if (existing === undefined) {
    throw new Error(`Spend entry with id ${entry.id} not found`);
  }

  await db.put('spendEntries', entry);
  await updateLastModified();

  return entry;
}

export async function deleteSpendEntry(id: string): Promise<void> {
  const db = await getDb();
  const existing = await db.get('spendEntries', id);
  if (existing === undefined) {
    throw new Error(`Spend entry with id ${id} not found`);
  }

  await db.delete('spendEntries', id);
  await updateLastModified();
}

export async function getSpendEntriesByCard(cardId: string): Promise<SpendEntry[]> {
  const db = await getDb();
  return db.getAllFromIndex('spendEntries', 'by-cardId', cardId);
}

export async function getSpendEntriesByDateRange(
  startDate: string,
  endDate: string
): Promise<SpendEntry[]> {
  const db = await getDb();
  const range = IDBKeyRange.bound(startDate, endDate);
  return db.getAllFromIndex('spendEntries', 'by-date', range);
}

export async function getSpendEntriesByCategory(category: string): Promise<SpendEntry[]> {
  const db = await getDb();
  return db.getAllFromIndex('spendEntries', 'by-category', category);
}

// ============ Hard Inquiry Operations ============

export async function getAllHardInquiries(): Promise<HardInquiry[]> {
  const db = await getDb();
  return db.getAll('hardInquiries');
}

export async function getHardInquiry(id: string): Promise<HardInquiry | undefined> {
  const db = await getDb();
  return db.get('hardInquiries', id);
}

export async function addHardInquiry(input: HardInquiryInput): Promise<HardInquiry> {
  const inquiry: HardInquiry = {
    ...input,
    id: generateUuid(),
  };

  const validation = validateHardInquiry(inquiry);
  if (!validation.valid) {
    throw new Error(`Invalid hard inquiry: ${validation.errors.join(', ')}`);
  }

  const db = await getDb();
  await db.add('hardInquiries', inquiry);
  await updateLastModified();

  return inquiry;
}

export async function updateHardInquiry(inquiry: HardInquiry): Promise<HardInquiry> {
  const validation = validateHardInquiry(inquiry);
  if (!validation.valid) {
    throw new Error(`Invalid hard inquiry: ${validation.errors.join(', ')}`);
  }

  const db = await getDb();
  const existing = await db.get('hardInquiries', inquiry.id);
  if (existing === undefined) {
    throw new Error(`Hard inquiry with id ${inquiry.id} not found`);
  }

  await db.put('hardInquiries', inquiry);
  await updateLastModified();

  return inquiry;
}

export async function deleteHardInquiry(id: string): Promise<void> {
  const db = await getDb();
  const existing = await db.get('hardInquiries', id);
  if (existing === undefined) {
    throw new Error(`Hard inquiry with id ${id} not found`);
  }

  await db.delete('hardInquiries', id);
  await updateLastModified();
}

export async function getHardInquiriesInLast24Months(): Promise<HardInquiry[]> {
  const db = await getDb();
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - 24);
  const cutoffStr = cutoffDate.toISOString().split('T')[0] ?? '';

  const range = IDBKeyRange.lowerBound(cutoffStr);
  return db.getAllFromIndex('hardInquiries', 'by-date', range);
}

// ============ Bulk Operations ============

export async function clearAllData(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['cards', 'spendEntries', 'hardInquiries', 'metadata'], 'readwrite');

  await tx.objectStore('cards').clear();
  await tx.objectStore('spendEntries').clear();
  await tx.objectStore('hardInquiries').clear();

  // Reset metadata
  const now = new Date().toISOString();
  await tx.objectStore('metadata').put({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    createdAt: now,
    lastModifiedAt: now,
  });

  await tx.done;
}

export async function getMetadata(): Promise<StorageMetadata | undefined> {
  const db = await getDb();
  return db.get('metadata', CURRENT_SCHEMA_VERSION);
}

// ============ Export/Import Support ============

export interface ExportData {
  schemaVersion: number;
  exportedAt: string;
  cards: Card[];
  spendEntries: SpendEntry[];
  hardInquiries: HardInquiry[];
}

export async function exportAllData(): Promise<ExportData> {
  const db = await getDb();

  const [cards, spendEntries, hardInquiries] = await Promise.all([
    db.getAll('cards'),
    db.getAll('spendEntries'),
    db.getAll('hardInquiries'),
  ]);

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    cards,
    spendEntries,
    hardInquiries,
  };
}

export async function importAllData(data: ExportData, merge = false): Promise<void> {
  // Validate all imported data
  for (const card of data.cards) {
    const validation = validateCard(card);
    if (!validation.valid) {
      throw new Error(`Invalid card in import data: ${validation.errors.join(', ')}`);
    }
  }

  for (const entry of data.spendEntries) {
    const validation = validateSpendEntry(entry);
    if (!validation.valid) {
      throw new Error(`Invalid spend entry in import data: ${validation.errors.join(', ')}`);
    }
  }

  for (const inquiry of data.hardInquiries) {
    const validation = validateHardInquiry(inquiry);
    if (!validation.valid) {
      throw new Error(`Invalid hard inquiry in import data: ${validation.errors.join(', ')}`);
    }
  }

  const db = await getDb();

  if (!merge) {
    // Clear existing data first
    await clearAllData();
  }

  const tx = db.transaction(['cards', 'spendEntries', 'hardInquiries'], 'readwrite');

  for (const card of data.cards) {
    await tx.objectStore('cards').put(card);
  }

  for (const entry of data.spendEntries) {
    await tx.objectStore('spendEntries').put(entry);
  }

  for (const inquiry of data.hardInquiries) {
    await tx.objectStore('hardInquiries').put(inquiry);
  }

  await tx.done;
  await updateLastModified();
}

// Close database (useful for testing)
export function closeDb(): void {
  if (dbInstance !== null) {
    dbInstance.close();
    dbInstance = null;
  }
}
