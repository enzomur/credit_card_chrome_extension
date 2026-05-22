import {
  getAllCards,
  addCard,
  updateCard,
  deleteCard,
  clearAllData,
  exportAllData,
  importAllData,
} from '@/lib/storage';
import {
  validateCard,
  sanitizeForDisplay,
  containsFullCardNumber,
} from '@/lib/validators';
import type {
  Card,
  CardInput,
  Category,
  CategoryReward,
  Issuer,
  Network,
  PointType,
} from '@/types';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  NETWORK_LABELS,
} from '@/types';

// DOM element references
let cardModal: HTMLElement | null = null;
let deleteModal: HTMLElement | null = null;
let clearModal: HTMLElement | null = null;
let cardForm: HTMLFormElement | null = null;
let cardsList: HTMLElement | null = null;
let noCards: HTMLElement | null = null;
let categoryRewardsList: HTMLElement | null = null;

// Current state
let editingCardId: string | null = null;
let deletingCardId: string | null = null;
let categoryRewards: CategoryReward[] = [];

async function init(): Promise<void> {
  // Get DOM references
  cardModal = document.getElementById('card-modal');
  deleteModal = document.getElementById('delete-modal');
  clearModal = document.getElementById('clear-modal');
  cardForm = document.getElementById('card-form') as HTMLFormElement | null;
  cardsList = document.getElementById('cards-list');
  noCards = document.getElementById('no-cards');
  categoryRewardsList = document.getElementById('category-rewards-list');

  setupNavigation();
  setupModals();
  setupCardForm();
  setupSettings();

  await loadCards();
}

function setupNavigation(): void {
  const navBtns = document.querySelectorAll('.nav-btn');
  const sections = document.querySelectorAll('.section');

  navBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const sectionId = btn.getAttribute('data-section');
      if (sectionId === null) return;

      navBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      sections.forEach((s) => {
        s.classList.add('hidden');
        if (s.id === `${sectionId}-section`) {
          s.classList.remove('hidden');
        }
      });
    });
  });
}

function setupModals(): void {
  // Card modal
  document.getElementById('add-card-btn')?.addEventListener('click', () => {
    openCardModal();
  });

  document.getElementById('add-first-card-btn')?.addEventListener('click', () => {
    openCardModal();
  });

  // Close modal handlers
  document.querySelectorAll('.modal-close, .modal-cancel').forEach((el) => {
    el.addEventListener('click', closeAllModals);
  });

  document.querySelectorAll('.modal-backdrop').forEach((el) => {
    el.addEventListener('click', closeAllModals);
  });

  // Delete confirmation
  document.getElementById('confirm-delete-btn')?.addEventListener('click', () => {
    void confirmDelete();
  });

  // Clear confirmation
  document.getElementById('confirm-clear-btn')?.addEventListener('click', () => {
    void confirmClear();
  });
}

function setupCardForm(): void {
  if (cardForm === null) return;

  // Add category button
  document.getElementById('add-category-btn')?.addEventListener('click', () => {
    addCategoryRow();
  });

  // Form submission
  cardForm.addEventListener('submit', (e) => {
    e.preventDefault();
    void saveCard();
  });

  // Block card numbers in inputs
  const sensitiveInputs = ['nickname', 'productName', 'notes'];
  sensitiveInputs.forEach((inputId) => {
    const input = document.getElementById(inputId) as HTMLInputElement | HTMLTextAreaElement | null;
    input?.addEventListener('blur', () => {
      if (containsFullCardNumber(input.value)) {
        input.classList.add('invalid');
        alert('Warning: This field appears to contain a full card number. Only enter the last 4 digits in the designated field.');
      } else {
        input.classList.remove('invalid');
      }
    });
  });

  // Last4 validation
  const last4Input = document.getElementById('last4') as HTMLInputElement | null;
  last4Input?.addEventListener('input', () => {
    last4Input.value = last4Input.value.replace(/\D/g, '').slice(0, 4);
  });
}

function setupSettings(): void {
  document.getElementById('export-btn')?.addEventListener('click', () => {
    void handleExport();
  });

  document.getElementById('import-btn')?.addEventListener('click', () => {
    handleImport();
  });

  document.getElementById('clear-btn')?.addEventListener('click', () => {
    clearModal?.classList.remove('hidden');
  });
}

async function loadCards(): Promise<void> {
  if (cardsList === null || noCards === null) return;

  try {
    const cards = await getAllCards();

    if (cards.length === 0) {
      cardsList.classList.add('hidden');
      noCards.classList.remove('hidden');
      return;
    }

    noCards.classList.add('hidden');
    cardsList.classList.remove('hidden');

    // Sort by nickname
    const sortedCards = [...cards].sort((a, b) => a.nickname.localeCompare(b.nickname));

    while (cardsList.firstChild !== null) {
      cardsList.removeChild(cardsList.firstChild);
    }
    for (const card of sortedCards) {
      cardsList.appendChild(createCardItem(card));
    }
  } catch (error) {
    console.error('Error loading cards:', error);
    while (cardsList.firstChild !== null) {
      cardsList.removeChild(cardsList.firstChild);
    }
    const errorDiv = document.createElement('div');
    errorDiv.className = 'loading';
    errorDiv.textContent = 'Error loading cards';
    cardsList.appendChild(errorDiv);
  }
}

function createCardItem(card: Card): HTMLElement {
  const item = document.createElement('div');
  item.className = 'card-item';
  item.dataset['cardId'] = card.id;

  // Info section
  const infoDiv = document.createElement('div');
  infoDiv.className = 'card-item-info';

  const nicknameDiv = document.createElement('div');
  nicknameDiv.className = 'card-item-nickname';
  nicknameDiv.textContent = sanitizeForDisplay(card.nickname);

  const detailsDiv = document.createElement('div');
  detailsDiv.className = 'card-item-details';

  const productSpan = document.createElement('span');
  productSpan.className = 'card-item-product';
  productSpan.textContent = sanitizeForDisplay(card.productName);

  const networkSpan = document.createElement('span');
  networkSpan.className = `network-badge network-${card.network}`;
  networkSpan.textContent = NETWORK_LABELS[card.network];

  const last4Span = document.createElement('span');
  last4Span.textContent = `••${card.last4}`;

  detailsDiv.appendChild(productSpan);
  detailsDiv.appendChild(networkSpan);
  detailsDiv.appendChild(last4Span);

  infoDiv.appendChild(nicknameDiv);
  infoDiv.appendChild(detailsDiv);

  // Fee section
  const feeDiv = document.createElement('div');
  feeDiv.className = 'card-item-fee';
  const feeLabel = document.createElement('div');
  feeLabel.className = 'card-item-fee-label';
  feeLabel.textContent = 'Annual Fee';
  const feeValue = document.createElement('div');
  feeValue.className = 'card-item-fee-value';
  feeValue.textContent = card.annualFee === 0 ? '$0' : `$${card.annualFee}`;
  feeDiv.appendChild(feeLabel);
  feeDiv.appendChild(feeValue);

  // Rewards section
  const rewardsDiv = document.createElement('div');
  rewardsDiv.className = 'card-item-rewards';
  const rewardsLabel = document.createElement('div');
  rewardsLabel.className = 'card-item-rewards-label';
  rewardsLabel.textContent = 'Base Rate';
  const rewardsValue = document.createElement('div');
  rewardsValue.className = 'card-item-rewards-value';
  rewardsValue.textContent = `${(card.rewards.baseRate * 100).toFixed(1)}%`;
  rewardsDiv.appendChild(rewardsLabel);
  rewardsDiv.appendChild(rewardsValue);

  // Actions
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'card-item-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'btn-icon';
  editBtn.textContent = '✏️';
  editBtn.title = 'Edit';
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openCardModal(card);
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn-icon delete';
  deleteBtn.textContent = '🗑️';
  deleteBtn.title = 'Delete';
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openDeleteModal(card);
  });

  actionsDiv.appendChild(editBtn);
  actionsDiv.appendChild(deleteBtn);

  item.appendChild(infoDiv);
  item.appendChild(feeDiv);
  item.appendChild(rewardsDiv);
  item.appendChild(actionsDiv);

  return item;
}

function openCardModal(card?: Card): void {
  if (cardModal === null || cardForm === null) return;

  editingCardId = card?.id ?? null;
  categoryRewards = card?.rewards.categories ? [...card.rewards.categories] : [];

  // Update title
  const title = document.getElementById('modal-title');
  if (title !== null) {
    title.textContent = card !== undefined ? 'Edit Card' : 'Add Card';
  }

  // Reset form
  cardForm.reset();

  // Populate form if editing
  if (card !== undefined) {
    (document.getElementById('nickname') as HTMLInputElement).value = card.nickname;
    (document.getElementById('productName') as HTMLInputElement).value = card.productName;
    (document.getElementById('issuer') as HTMLSelectElement).value = card.issuer;
    (document.getElementById('network') as HTMLSelectElement).value = card.network;
    (document.getElementById('last4') as HTMLInputElement).value = card.last4;
    (document.getElementById('openedOn') as HTMLInputElement).value = card.openedOn;
    (document.getElementById('annualFee') as HTMLInputElement).value = String(card.annualFee);
    (document.getElementById('aprPurchase') as HTMLInputElement).value = String(card.aprPurchase);
    (document.getElementById('foreignTxFee') as HTMLInputElement).value = String(card.foreignTxFee);

    if (card.creditLimit !== undefined) {
      (document.getElementById('creditLimit') as HTMLInputElement).value = String(card.creditLimit);
    }
    if (card.statementDay !== undefined) {
      (document.getElementById('statementDay') as HTMLInputElement).value = String(card.statementDay);
    }
    if (card.dueDay !== undefined) {
      (document.getElementById('dueDay') as HTMLInputElement).value = String(card.dueDay);
    }

    (document.getElementById('pointType') as HTMLSelectElement).value = card.rewards.pointType;
    (document.getElementById('baseRate') as HTMLInputElement).value = String(card.rewards.baseRate * 100);
    (document.getElementById('pointValue') as HTMLInputElement).value = String(card.rewards.pointValue);

    if (card.notes !== undefined) {
      (document.getElementById('notes') as HTMLTextAreaElement).value = card.notes;
    }
  }

  // Render category rewards
  renderCategoryRewards();

  cardModal.classList.remove('hidden');
}

function renderCategoryRewards(): void {
  if (categoryRewardsList === null) return;

  while (categoryRewardsList.firstChild !== null) {
    categoryRewardsList.removeChild(categoryRewardsList.firstChild);
  }

  for (let i = 0; i < categoryRewards.length; i++) {
    const reward = categoryRewards[i];
    if (reward === undefined) continue;

    const row = document.createElement('div');
    row.className = 'category-row';

    // Category select
    const catSelect = document.createElement('select');
    catSelect.dataset['index'] = String(i);
    for (const cat of CATEGORIES) {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = CATEGORY_LABELS[cat];
      if (cat === reward.category) option.selected = true;
      catSelect.appendChild(option);
    }
    catSelect.addEventListener('change', (e) => {
      const idx = parseInt((e.target as HTMLSelectElement).dataset['index'] ?? '0', 10);
      const item = categoryRewards[idx];
      if (item !== undefined) {
        item.category = (e.target as HTMLSelectElement).value as Category;
      }
    });

    // Multiplier input
    const multInput = document.createElement('input');
    multInput.type = 'number';
    multInput.min = '0';
    multInput.step = '0.5';
    multInput.value = String(reward.multiplier);
    multInput.placeholder = 'Rate';
    multInput.dataset['index'] = String(i);
    multInput.addEventListener('change', (e) => {
      const idx = parseInt((e.target as HTMLInputElement).dataset['index'] ?? '0', 10);
      const item = categoryRewards[idx];
      if (item !== undefined) {
        item.multiplier = parseFloat((e.target as HTMLInputElement).value) || 0;
      }
    });

    // Cap input
    const capInput = document.createElement('input');
    capInput.type = 'number';
    capInput.min = '0';
    capInput.step = '100';
    capInput.value = reward.cap !== undefined ? String(reward.cap) : '';
    capInput.placeholder = 'Cap $';
    capInput.dataset['index'] = String(i);
    capInput.addEventListener('change', (e) => {
      const idx = parseInt((e.target as HTMLInputElement).dataset['index'] ?? '0', 10);
      const val = (e.target as HTMLInputElement).value;
      const item = categoryRewards[idx];
      if (item !== undefined) {
        if (val !== '') {
          item.cap = parseFloat(val);
        } else {
          delete item.cap;
        }
      }
    });

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'category-remove';
    removeBtn.textContent = '×';
    removeBtn.dataset['index'] = String(i);
    removeBtn.addEventListener('click', (e) => {
      const idx = parseInt((e.target as HTMLButtonElement).dataset['index'] ?? '0', 10);
      categoryRewards.splice(idx, 1);
      renderCategoryRewards();
    });

    row.appendChild(catSelect);
    row.appendChild(multInput);
    row.appendChild(capInput);
    row.appendChild(removeBtn);

    categoryRewardsList.appendChild(row);
  }
}

function addCategoryRow(): void {
  categoryRewards.push({
    category: 'dining',
    multiplier: 3,
  });
  renderCategoryRewards();
}

async function saveCard(): Promise<void> {
  if (cardForm === null) return;

  const formData = new FormData(cardForm);

  const baseRatePercent = parseFloat(formData.get('baseRate') as string) || 1;
  const creditLimitStr = formData.get('creditLimit') as string;
  const statementDayStr = formData.get('statementDay') as string;
  const dueDayStr = formData.get('dueDay') as string;

  const cardInput: CardInput = {
    nickname: (formData.get('nickname') as string).trim(),
    productName: (formData.get('productName') as string).trim(),
    issuer: formData.get('issuer') as Issuer,
    network: formData.get('network') as Network,
    last4: formData.get('last4') as string,
    openedOn: formData.get('openedOn') as string,
    annualFee: parseFloat(formData.get('annualFee') as string) || 0,
    aprPurchase: parseFloat(formData.get('aprPurchase') as string) || 0,
    foreignTxFee: parseFloat(formData.get('foreignTxFee') as string) || 0,
    rewards: {
      baseRate: baseRatePercent / 100,
      categories: categoryRewards,
      pointType: formData.get('pointType') as PointType,
      pointValue: parseFloat(formData.get('pointValue') as string) || 1,
    },
  };

  // Only add optional fields if they have values
  if (creditLimitStr !== '') {
    cardInput.creditLimit = parseFloat(creditLimitStr);
  }
  if (statementDayStr !== '') {
    cardInput.statementDay = parseInt(statementDayStr, 10);
  }
  if (dueDayStr !== '') {
    cardInput.dueDay = parseInt(dueDayStr, 10);
  }
  const notesValue = (formData.get('notes') as string).trim();
  if (notesValue !== '') {
    cardInput.notes = notesValue;
  }

  // Validate
  const validation = validateCard(cardInput);
  if (!validation.valid) {
    alert(`Please fix the following errors:\n\n${validation.errors.join('\n')}`);
    return;
  }

  try {
    if (editingCardId !== null) {
      await updateCard({ ...cardInput, id: editingCardId });
    } else {
      await addCard(cardInput);
    }

    closeAllModals();
    await loadCards();
  } catch (error) {
    console.error('Error saving card:', error);
    alert('Error saving card. Please try again.');
  }
}

function openDeleteModal(card: Card): void {
  if (deleteModal === null) return;

  deletingCardId = card.id;

  const nameEl = document.getElementById('delete-card-name');
  if (nameEl !== null) {
    nameEl.textContent = card.nickname;
  }

  deleteModal.classList.remove('hidden');
}

async function confirmDelete(): Promise<void> {
  if (deletingCardId === null) return;

  try {
    await deleteCard(deletingCardId);
    deletingCardId = null;
    closeAllModals();
    await loadCards();
  } catch (error) {
    console.error('Error deleting card:', error);
    alert('Error deleting card. Please try again.');
  }
}

async function confirmClear(): Promise<void> {
  try {
    await clearAllData();
    closeAllModals();
    await loadCards();
  } catch (error) {
    console.error('Error clearing data:', error);
    alert('Error clearing data. Please try again.');
  }
}

function closeAllModals(): void {
  cardModal?.classList.add('hidden');
  deleteModal?.classList.add('hidden');
  clearModal?.classList.add('hidden');
  editingCardId = null;
  deletingCardId = null;
}

async function handleExport(): Promise<void> {
  try {
    const data = await exportAllData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `cardcompare-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting data:', error);
    alert('Error exporting data. Please try again.');
  }
}

function handleImport(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file === undefined) return;

    const reader = new FileReader();
    reader.onload = (e): void => {
      const content = e.target?.result as string;
      try {
        const data = JSON.parse(content) as ReturnType<typeof exportAllData> extends Promise<infer T> ? T : never;

        const confirmImport = confirm(
          'Import found:\n- ' + String(data.cards.length) + ' cards\n- ' + String(data.spendEntries.length) + ' spend entries\n- ' + String(data.hardInquiries.length) + ' hard inquiries\n\nDo you want to replace your current data with this backup?'
        );

        if (confirmImport) {
          void importAllData(data, false).then(() => loadCards()).then(() => {
            alert('Import successful!');
          });
        }
      } catch (error) {
        console.error('Error importing data:', error);
        alert('Error importing data. Please make sure the file is a valid CardCompare backup.');
      }
    };

    reader.readAsText(file);
  });

  input.click();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  void init();
});
