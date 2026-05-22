import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getAllCards,
  getCard,
  addCard,
  updateCard,
  deleteCard,
  getCardsByIssuer,
  getAllSpendEntries,
  addSpendEntry,
  deleteSpendEntry,
  getSpendEntriesByCard,
  getAllHardInquiries,
  addHardInquiry,
  deleteHardInquiry,
  getHardInquiriesInLast24Months,
  clearAllData,
  getMetadata,
  exportAllData,
  importAllData,
  closeDb,
} from '@/lib/storage';
import type { CardInput, SpendEntryInput, HardInquiryInput } from '@/types';

describe('storage', () => {
  beforeEach(async () => {
    closeDb();
    await clearAllData();
  });

  afterEach(() => {
    closeDb();
  });

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

  describe('Card operations', () => {
    it('should add and retrieve a card', async () => {
      const card = await addCard(validCardInput);

      expect(card.id).toBeDefined();
      expect(card.nickname).toBe('Test Card');

      const retrieved = await getCard(card.id);
      expect(retrieved).toEqual(card);
    });

    it('should get all cards', async () => {
      await addCard(validCardInput);
      await addCard({ ...validCardInput, nickname: 'Card 2', last4: '5678' });

      const cards = await getAllCards();
      expect(cards).toHaveLength(2);
    });

    it('should update a card', async () => {
      const card = await addCard(validCardInput);
      const updated = await updateCard({ ...card, nickname: 'Updated Name' });

      expect(updated.nickname).toBe('Updated Name');

      const retrieved = await getCard(card.id);
      expect(retrieved?.nickname).toBe('Updated Name');
    });

    it('should throw when updating non-existent card', async () => {
      await expect(
        updateCard({
          ...validCardInput,
          id: '550e8400-e29b-41d4-a716-446655440000',
        })
      ).rejects.toThrow('not found');
    });

    it('should delete a card', async () => {
      const card = await addCard(validCardInput);
      await deleteCard(card.id);

      const retrieved = await getCard(card.id);
      expect(retrieved).toBeUndefined();
    });

    it('should throw when deleting non-existent card', async () => {
      await expect(deleteCard('550e8400-e29b-41d4-a716-446655440000')).rejects.toThrow('not found');
    });

    it('should delete associated spend entries when deleting card', async () => {
      const card = await addCard(validCardInput);
      await addSpendEntry({
        cardId: card.id,
        category: 'dining',
        amount: 50,
        date: '2024-01-15',
      });

      await deleteCard(card.id);

      const entries = await getAllSpendEntries();
      expect(entries).toHaveLength(0);
    });

    it('should filter cards by issuer', async () => {
      await addCard(validCardInput);
      await addCard({ ...validCardInput, nickname: 'Amex', issuer: 'amex', last4: '5678' });

      const chaseCards = await getCardsByIssuer('chase');
      expect(chaseCards).toHaveLength(1);
      expect(chaseCards[0]?.issuer).toBe('chase');
    });

    it('should reject invalid card data', async () => {
      await expect(addCard({ ...validCardInput, last4: '123' })).rejects.toThrow('Invalid card');
    });
  });

  describe('SpendEntry operations', () => {
    it('should add and retrieve spend entries', async () => {
      const card = await addCard(validCardInput);
      const entry = await addSpendEntry({
        cardId: card.id,
        category: 'dining',
        amount: 50,
        date: '2024-01-15',
      });

      expect(entry.id).toBeDefined();

      const entries = await getAllSpendEntries();
      expect(entries).toHaveLength(1);
    });

    it('should reject entry for non-existent card', async () => {
      const input: SpendEntryInput = {
        cardId: '550e8400-e29b-41d4-a716-446655440000',
        category: 'dining',
        amount: 50,
        date: '2024-01-15',
      };

      await expect(addSpendEntry(input)).rejects.toThrow('Card with id');
    });

    it('should filter entries by card', async () => {
      const card1 = await addCard(validCardInput);
      const card2 = await addCard({ ...validCardInput, nickname: 'Card 2', last4: '5678' });

      await addSpendEntry({ cardId: card1.id, category: 'dining', amount: 50, date: '2024-01-15' });
      await addSpendEntry({
        cardId: card2.id,
        category: 'grocery',
        amount: 100,
        date: '2024-01-16',
      });

      const card1Entries = await getSpendEntriesByCard(card1.id);
      expect(card1Entries).toHaveLength(1);
      expect(card1Entries[0]?.cardId).toBe(card1.id);
    });

    it('should delete spend entry', async () => {
      const card = await addCard(validCardInput);
      const entry = await addSpendEntry({
        cardId: card.id,
        category: 'dining',
        amount: 50,
        date: '2024-01-15',
      });

      await deleteSpendEntry(entry.id);

      const entries = await getAllSpendEntries();
      expect(entries).toHaveLength(0);
    });
  });

  describe('HardInquiry operations', () => {
    it('should add and retrieve hard inquiries', async () => {
      const input: HardInquiryInput = {
        bureau: 'experian',
        issuer: 'chase',
        date: '2024-01-15',
        productName: 'Sapphire Reserve',
      };

      const inquiry = await addHardInquiry(input);
      expect(inquiry.id).toBeDefined();

      const inquiries = await getAllHardInquiries();
      expect(inquiries).toHaveLength(1);
    });

    it('should filter inquiries from last 24 months', async () => {
      const recentDate = new Date();
      recentDate.setMonth(recentDate.getMonth() - 6);
      const recentStr = recentDate.toISOString().split('T')[0] ?? '';

      const oldDate = new Date();
      oldDate.setMonth(oldDate.getMonth() - 30);
      const oldStr = oldDate.toISOString().split('T')[0] ?? '';

      await addHardInquiry({ bureau: 'experian', issuer: 'chase', date: recentStr });
      await addHardInquiry({ bureau: 'equifax', issuer: 'amex', date: oldStr });

      const recent = await getHardInquiriesInLast24Months();
      expect(recent).toHaveLength(1);
      expect(recent[0]?.bureau).toBe('experian');
    });

    it('should delete hard inquiry', async () => {
      const inquiry = await addHardInquiry({
        bureau: 'experian',
        issuer: 'chase',
        date: '2024-01-15',
      });

      await deleteHardInquiry(inquiry.id);

      const inquiries = await getAllHardInquiries();
      expect(inquiries).toHaveLength(0);
    });
  });

  describe('Metadata operations', () => {
    it('should have metadata after initialization', async () => {
      await addCard(validCardInput); // Triggers DB init
      const metadata = await getMetadata();

      expect(metadata).toBeDefined();
      expect(metadata?.schemaVersion).toBe(1);
      expect(metadata?.createdAt).toBeDefined();
      expect(metadata?.lastModifiedAt).toBeDefined();
    });

    it('should update lastModifiedAt on changes', async () => {
      const card = await addCard(validCardInput);
      const metadata1 = await getMetadata();

      // Small delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      await updateCard({ ...card, nickname: 'New Name' });
      const metadata2 = await getMetadata();

      expect(new Date(metadata2?.lastModifiedAt ?? '').getTime()).toBeGreaterThanOrEqual(
        new Date(metadata1?.lastModifiedAt ?? '').getTime()
      );
    });
  });

  describe('Export/Import operations', () => {
    it('should export all data', async () => {
      const card = await addCard(validCardInput);
      await addSpendEntry({ cardId: card.id, category: 'dining', amount: 50, date: '2024-01-15' });
      await addHardInquiry({ bureau: 'experian', issuer: 'chase', date: '2024-01-15' });

      const exported = await exportAllData();

      expect(exported.schemaVersion).toBe(1);
      expect(exported.cards).toHaveLength(1);
      expect(exported.spendEntries).toHaveLength(1);
      expect(exported.hardInquiries).toHaveLength(1);
    });

    it('should import data replacing existing', async () => {
      await addCard(validCardInput);

      const importData = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        cards: [
          { ...validCardInput, id: '550e8400-e29b-41d4-a716-446655440000', nickname: 'Imported' },
        ],
        spendEntries: [],
        hardInquiries: [],
      };

      await importAllData(importData, false);

      const cards = await getAllCards();
      expect(cards).toHaveLength(1);
      expect(cards[0]?.nickname).toBe('Imported');
    });

    it('should import data merging with existing', async () => {
      await addCard(validCardInput);

      const importData = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        cards: [
          {
            ...validCardInput,
            id: '550e8400-e29b-41d4-a716-446655440000',
            nickname: 'Imported',
            last4: '5678',
          },
        ],
        spendEntries: [],
        hardInquiries: [],
      };

      await importAllData(importData, true);

      const cards = await getAllCards();
      expect(cards).toHaveLength(2);
    });

    it('should reject invalid import data', async () => {
      const importData = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        cards: [{ ...validCardInput, id: '550e8400-e29b-41d4-a716-446655440000', last4: '12' }], // Invalid last4
        spendEntries: [],
        hardInquiries: [],
      };

      await expect(importAllData(importData, false)).rejects.toThrow('Invalid card');
    });
  });

  describe('clearAllData', () => {
    it('should clear all stores', async () => {
      const card = await addCard(validCardInput);
      await addSpendEntry({ cardId: card.id, category: 'dining', amount: 50, date: '2024-01-15' });
      await addHardInquiry({ bureau: 'experian', issuer: 'chase', date: '2024-01-15' });

      await clearAllData();

      expect(await getAllCards()).toHaveLength(0);
      expect(await getAllSpendEntries()).toHaveLength(0);
      expect(await getAllHardInquiries()).toHaveLength(0);
    });
  });
});
