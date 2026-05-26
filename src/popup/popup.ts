import { getAllCards } from '@/lib/storage';
import { sanitizeForDisplay } from '@/lib/validators';
import { getBestCardForCategory, getEffectiveRate } from '@/lib/rewards';
import type { Card, Category } from '@/types';
import { NETWORK_LABELS, CATEGORY_LABELS } from '@/types';

let allCards: Card[] = [];

async function init(): Promise<void> {
  const cardsSummary = document.getElementById('cards-summary');
  const emptyState = document.getElementById('empty-state');
  const cardCount = document.getElementById('card-count');
  const quickCompareSection = document.getElementById('quick-compare-section');
  const cardsSection = document.querySelector('.cards-section');
  const categorySelect = document.getElementById('category-select') as HTMLSelectElement | null;
  const bestCardResult = document.getElementById('best-card-result');
  const openOptions = document.getElementById('open-options');
  const addFirstCard = document.getElementById('add-first-card');
  const openFullCalculator = document.getElementById('open-full-calculator');

  if (
    cardsSummary === null ||
    emptyState === null ||
    cardCount === null ||
    categorySelect === null ||
    bestCardResult === null ||
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

  openFullCalculator?.addEventListener('click', () => {
    // Open options page and navigate to calculator tab
    void chrome.runtime.openOptionsPage();
  });

  // Category select change handler
  categorySelect.addEventListener('change', () => {
    updateBestCard(categorySelect.value as Category, bestCardResult);
  });

  // Load and display cards
  try {
    const cards = await getAllCards();
    allCards = cards;

    if (cards.length === 0) {
      cardsSummary.classList.add('hidden');
      quickCompareSection?.classList.add('hidden');
      cardsSection?.classList.add('hidden');
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    quickCompareSection?.classList.remove('hidden');
    cardsSection?.classList.remove('hidden');
    cardsSummary.classList.remove('hidden');
    cardCount.textContent = String(cards.length);

    // Initial best card display
    updateBestCard(categorySelect.value as Category, bestCardResult);

    // Sort by nickname
    const sortedCards = [...cards].sort((a, b) => a.nickname.localeCompare(b.nickname));

    while (cardsSummary.firstChild !== null) {
      cardsSummary.removeChild(cardsSummary.firstChild);
    }

    for (const card of sortedCards) {
      cardsSummary.appendChild(createCardRow(card, categorySelect.value as Category));
    }

    // Update card rows when category changes
    categorySelect.addEventListener('change', () => {
      const category = categorySelect.value as Category;
      while (cardsSummary.firstChild !== null) {
        cardsSummary.removeChild(cardsSummary.firstChild);
      }
      for (const card of sortedCards) {
        cardsSummary.appendChild(createCardRow(card, category));
      }
    });
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

function updateBestCard(category: Category, container: HTMLElement): void {
  while (container.firstChild !== null) {
    container.removeChild(container.firstChild);
  }

  if (allCards.length === 0) {
    const placeholder = document.createElement('div');
    placeholder.className = 'best-card-placeholder';
    placeholder.textContent = 'Add cards to see recommendations';
    container.appendChild(placeholder);
    return;
  }

  const bestCard = getBestCardForCategory(allCards, category);

  if (bestCard === undefined) {
    const noCard = document.createElement('div');
    noCard.className = 'no-card-message';
    noCard.textContent = 'No cards found for this category';
    container.appendChild(noCard);
    return;
  }

  const { rate, isRotating } = getEffectiveRate(bestCard, category);
  const ratePercent = (rate * 100).toFixed(1);

  const display = document.createElement('div');
  display.className = 'best-card-display';

  const icon = document.createElement('div');
  icon.className = 'best-card-icon';
  icon.textContent = '💳';

  const info = document.createElement('div');
  info.className = 'best-card-info';

  const name = document.createElement('div');
  name.className = 'best-card-name';
  name.textContent = sanitizeForDisplay(bestCard.nickname);

  const details = document.createElement('div');
  details.className = 'best-card-details';
  let detailText = `Best for ${CATEGORY_LABELS[category]}`;
  if (isRotating) {
    detailText += ' (rotating bonus)';
  }
  details.textContent = detailText;

  info.appendChild(name);
  info.appendChild(details);

  const rateDiv = document.createElement('div');
  rateDiv.className = 'best-card-rate';

  const rateValue = document.createElement('div');
  rateValue.className = 'best-card-rate-value';
  rateValue.textContent = `${ratePercent}%`;

  const rateLabel = document.createElement('div');
  rateLabel.className = 'best-card-rate-label';
  rateLabel.textContent = 'earn rate';

  rateDiv.appendChild(rateValue);
  rateDiv.appendChild(rateLabel);

  display.appendChild(icon);
  display.appendChild(info);
  display.appendChild(rateDiv);

  container.appendChild(display);
}

function createCardRow(card: Card, category: Category): HTMLElement {
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

  // Check if this is a rotating category
  const { isRotating } = getEffectiveRate(card, category);
  if (isRotating) {
    const rotatingBadge = document.createElement('span');
    rotatingBadge.className = 'rotating-badge';
    rotatingBadge.textContent = 'Q';
    rotatingBadge.title = 'Rotating quarterly bonus';
    detailsDiv.appendChild(rotatingBadge);
  }

  infoDiv.appendChild(nicknameDiv);
  infoDiv.appendChild(detailsDiv);

  // Rate for selected category
  const rateDiv = document.createElement('div');
  rateDiv.className = 'card-rate';

  const { rate } = getEffectiveRate(card, category);
  const ratePercent = (rate * 100).toFixed(1);

  const rateValue = document.createElement('div');
  rateValue.className = 'card-rate-value';
  rateValue.textContent = `${ratePercent}%`;

  const rateLabel = document.createElement('div');
  rateLabel.className = 'card-rate-label';
  rateLabel.textContent = 'earn';

  rateDiv.appendChild(rateValue);
  rateDiv.appendChild(rateLabel);

  row.appendChild(infoDiv);
  row.appendChild(rateDiv);

  // Click to open options page
  row.addEventListener('click', () => {
    void chrome.runtime.openOptionsPage();
  });

  return row;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  void init();
});
