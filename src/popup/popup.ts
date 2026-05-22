import { getAllCards } from '@/lib/storage';
import { sanitizeForDisplay } from '@/lib/validators';
import type { Card } from '@/types';
import { NETWORK_LABELS } from '@/types';

async function init(): Promise<void> {
  const cardsSummary = document.getElementById('cards-summary');
  const emptyState = document.getElementById('empty-state');
  const cardCount = document.getElementById('card-count');
  const quickCompare = document.getElementById('quick-compare') as HTMLButtonElement | null;
  const openOptions = document.getElementById('open-options');
  const addFirstCard = document.getElementById('add-first-card');

  if (
    cardsSummary === null ||
    emptyState === null ||
    cardCount === null ||
    quickCompare === null ||
    openOptions === null
  ) {
    console.error('Required DOM elements not found');
    return;
  }

  // Open options page handlers
  openOptions.addEventListener('click', () => {
    void chrome.runtime.openOptionsPage();
  });

  addFirstCard?.addEventListener('click', () => {
    void chrome.runtime.openOptionsPage();
  });

  // Load and display cards
  try {
    const cards = await getAllCards();

    if (cards.length === 0) {
      cardsSummary.classList.add('hidden');
      emptyState.classList.remove('hidden');
      cardCount.textContent = '0 cards';
      return;
    }

    emptyState.classList.add('hidden');
    cardsSummary.classList.remove('hidden');
    cardCount.textContent = `${cards.length} card${cards.length !== 1 ? 's' : ''}`;
    quickCompare.disabled = cards.length < 2;

    // Sort by due date (cards with due dates first, then by date)
    const sortedCards = [...cards].sort((a, b) => {
      if (a.dueDay !== undefined && b.dueDay !== undefined) {
        return a.dueDay - b.dueDay;
      }
      if (a.dueDay !== undefined) return -1;
      if (b.dueDay !== undefined) return 1;
      return a.nickname.localeCompare(b.nickname);
    });

    while (cardsSummary.firstChild !== null) {
      cardsSummary.removeChild(cardsSummary.firstChild);
    }
    for (const card of sortedCards) {
      cardsSummary.appendChild(createCardRow(card));
    }
  } catch (error) {
    console.error('Error loading cards:', error);
    while (cardsSummary.firstChild !== null) {
      cardsSummary.removeChild(cardsSummary.firstChild);
    }
    const errorDiv = document.createElement('div');
    errorDiv.className = 'loading';
    errorDiv.textContent = 'Error loading cards';
    cardsSummary.appendChild(errorDiv);
  }
}

function createCardRow(card: Card): HTMLElement {
  const row = document.createElement('div');
  row.className = `card-row issuer-${card.issuer}`;
  row.dataset['cardId'] = card.id;

  // Card info section
  const infoDiv = document.createElement('div');
  infoDiv.className = 'card-info';

  const nicknameDiv = document.createElement('div');
  nicknameDiv.className = 'card-nickname';
  nicknameDiv.textContent = sanitizeForDisplay(card.nickname);

  const detailsDiv = document.createElement('div');
  detailsDiv.className = 'card-details';

  const last4Span = document.createElement('span');
  last4Span.className = 'card-last4';
  last4Span.textContent = `••${card.last4}`;

  const networkSpan = document.createElement('span');
  networkSpan.className = `network-badge network-${card.network}`;
  networkSpan.textContent = NETWORK_LABELS[card.network];

  detailsDiv.appendChild(last4Span);
  detailsDiv.appendChild(networkSpan);
  infoDiv.appendChild(nicknameDiv);
  infoDiv.appendChild(detailsDiv);

  // Annual fee section
  const feeDiv = document.createElement('div');
  feeDiv.className = 'card-fee';
  const feeLabel = document.createElement('div');
  feeLabel.textContent = 'Annual Fee';
  const feeAmount = document.createElement('div');
  feeAmount.className = 'card-fee-amount';
  feeAmount.textContent = card.annualFee === 0 ? '$0' : `$${card.annualFee}`;
  feeDiv.appendChild(feeLabel);
  feeDiv.appendChild(feeAmount);

  // Due date section
  const dueDiv = document.createElement('div');
  dueDiv.className = 'card-due';

  if (card.dueDay !== undefined) {
    const dueInfo = getDueInfo(card.dueDay);
    dueDiv.textContent = dueInfo.text;
    if (dueInfo.soon) {
      dueDiv.classList.add('soon');
    }
  } else {
    dueDiv.textContent = '';
  }

  row.appendChild(infoDiv);
  row.appendChild(feeDiv);
  row.appendChild(dueDiv);

  // Click to open options page with card selected
  row.addEventListener('click', () => {
    void chrome.runtime.openOptionsPage();
  });

  return row;
}

function getDueInfo(dueDay: number): { text: string; soon: boolean } {
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // Calculate next due date
  let dueDate: Date;
  if (dueDay >= currentDay) {
    dueDate = new Date(currentYear, currentMonth, dueDay);
  } else {
    dueDate = new Date(currentYear, currentMonth + 1, dueDay);
  }

  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return { text: 'Due today', soon: true };
  } else if (diffDays === 1) {
    return { text: 'Due tomorrow', soon: true };
  } else if (diffDays <= 7) {
    return { text: `Due in ${diffDays}d`, soon: true };
  } else {
    return { text: `Due ${dueDay}${getOrdinalSuffix(dueDay)}`, soon: false };
  }
}

function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0] ?? 'th';
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  void init();
});
