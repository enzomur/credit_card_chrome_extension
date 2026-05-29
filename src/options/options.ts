import {
  getAllCards,
  addCard,
  updateCard,
  deleteCard,
  clearAllData,
  exportAllData,
  importAllData,
  getAllHardInquiries,
  addHardInquiry,
  deleteHardInquiry,
} from '@/lib/storage';
import {
  validateCard,
  sanitizeForDisplay,
  containsFullCardNumber,
} from '@/lib/validators';
import {
  compareCardsForPurchase,
  getSignupBonusProgress,
} from '@/lib/rewards';
import {
  checkChase524,
  checkAmex290,
  checkCiti865,
  checkBoA234,
} from '@/lib/eligibility';
import type {
  Card,
  CardInput,
  Category,
  CategoryReward,
  Issuer,
  Network,
  PointType,
  TransferPartner,
  HardInquiry,
  HardInquiryInput,
  Bureau,
} from '@/types';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  NETWORK_LABELS,
  ISSUER_LABELS,
} from '@/types';

// DOM element references
let cardModal: HTMLElement | null = null;
let deleteModal: HTMLElement | null = null;
let clearModal: HTMLElement | null = null;
let cardForm: HTMLFormElement | null = null;
let cardsList: HTMLElement | null = null;
let noCards: HTMLElement | null = null;
let categoryRewardsList: HTMLElement | null = null;
let transferPartnersList: HTMLElement | null = null;
let calcResults: HTMLElement | null = null;
let bonusTracker: HTMLElement | null = null;
let inquiryModal: HTMLElement | null = null;
let deleteInquiryModal: HTMLElement | null = null;
let inquiryForm: HTMLFormElement | null = null;
let inquiriesList: HTMLElement | null = null;
let noInquiries: HTMLElement | null = null;

// Current state
let editingCardId: string | null = null;
let deletingCardId: string | null = null;
let deletingInquiryId: string | null = null;
let categoryRewards: CategoryReward[] = [];
let transferPartners: TransferPartner[] = [];
let allCards: Card[] = [];
let allInquiries: HardInquiry[] = [];

async function init(): Promise<void> {
  // Get DOM references
  cardModal = document.getElementById('card-modal');
  deleteModal = document.getElementById('delete-modal');
  clearModal = document.getElementById('clear-modal');
  cardForm = document.getElementById('card-form') as HTMLFormElement | null;
  cardsList = document.getElementById('cards-list');
  noCards = document.getElementById('no-cards');
  categoryRewardsList = document.getElementById('category-rewards-list');
  transferPartnersList = document.getElementById('transfer-partners-list');
  calcResults = document.getElementById('calc-results');
  bonusTracker = document.getElementById('bonus-tracker');
  inquiryModal = document.getElementById('inquiry-modal');
  deleteInquiryModal = document.getElementById('delete-inquiry-modal');
  inquiryForm = document.getElementById('inquiry-form') as HTMLFormElement | null;
  inquiriesList = document.getElementById('inquiries-list');
  noInquiries = document.getElementById('no-inquiries');

  setupNavigation();
  setupModals();
  setupCardForm();
  setupSettings();
  setupCalculator();
  setupInquiries();

  await loadCards();
  await loadInquiries();
  renderBonusTracker();
  renderEligibility();
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

  // Add transfer partner button
  document.getElementById('add-partner-btn')?.addEventListener('click', () => {
    addTransferPartnerRow();
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

function setupCalculator(): void {
  document.getElementById('calc-compare-btn')?.addEventListener('click', () => {
    runCalculatorComparison();
  });
}

function setupInquiries(): void {
  // Add inquiry button
  document.getElementById('add-inquiry-btn')?.addEventListener('click', () => {
    openInquiryModal();
  });

  // Inquiry form submission
  inquiryForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    void saveInquiry();
  });

  // Delete inquiry confirmation
  document.getElementById('confirm-delete-inquiry-btn')?.addEventListener('click', () => {
    void confirmDeleteInquiry();
  });
}

function openInquiryModal(): void {
  if (inquiryModal === null || inquiryForm === null) return;
  inquiryForm.reset();
  inquiryModal.classList.remove('hidden');
}

async function saveInquiry(): Promise<void> {
  if (inquiryForm === null) return;

  const formData = new FormData(inquiryForm);

  const input: HardInquiryInput = {
    bureau: formData.get('bureau') as Bureau,
    issuer: formData.get('issuer') as Issuer,
    date: formData.get('date') as string,
  };

  const productName = (formData.get('productName') as string).trim();
  if (productName !== '') {
    input.productName = productName;
  }

  try {
    await addHardInquiry(input);
    closeAllModals();
    await loadInquiries();
    renderEligibility();
  } catch (error) {
    console.error('Error saving inquiry:', error);
    alert('Error saving inquiry. Please try again.');
  }
}

function openDeleteInquiryModal(id: string): void {
  if (deleteInquiryModal === null) return;
  deletingInquiryId = id;
  deleteInquiryModal.classList.remove('hidden');
}

async function confirmDeleteInquiry(): Promise<void> {
  if (deletingInquiryId === null) return;

  try {
    await deleteHardInquiry(deletingInquiryId);
    deletingInquiryId = null;
    closeAllModals();
    await loadInquiries();
    renderEligibility();
  } catch (error) {
    console.error('Error deleting inquiry:', error);
    alert('Error deleting inquiry. Please try again.');
  }
}

async function loadInquiries(): Promise<void> {
  if (inquiriesList === null || noInquiries === null) return;

  try {
    const inquiries = await getAllHardInquiries();
    allInquiries = inquiries;

    if (inquiries.length === 0) {
      inquiriesList.classList.add('hidden');
      noInquiries.classList.remove('hidden');
      return;
    }

    noInquiries.classList.add('hidden');
    inquiriesList.classList.remove('hidden');

    // Sort by date descending
    const sortedInquiries = [...inquiries].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    while (inquiriesList.firstChild !== null) {
      inquiriesList.removeChild(inquiriesList.firstChild);
    }

    for (const inquiry of sortedInquiries) {
      inquiriesList.appendChild(createInquiryItem(inquiry));
    }
  } catch (error) {
    console.error('Error loading inquiries:', error);
  }
}

function createInquiryItem(inquiry: HardInquiry): HTMLElement {
  const item = document.createElement('div');
  item.className = 'inquiry-item';

  // Date
  const dateDiv = document.createElement('div');
  dateDiv.className = 'inquiry-date';
  const date = new Date(inquiry.date);
  dateDiv.textContent = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Info
  const infoDiv = document.createElement('div');
  infoDiv.className = 'inquiry-info';

  const issuerDiv = document.createElement('div');
  issuerDiv.className = 'inquiry-issuer';
  issuerDiv.textContent = ISSUER_LABELS[inquiry.issuer];

  infoDiv.appendChild(issuerDiv);

  if (inquiry.productName !== undefined) {
    const productDiv = document.createElement('div');
    productDiv.className = 'inquiry-product';
    productDiv.textContent = inquiry.productName;
    infoDiv.appendChild(productDiv);
  }

  // Bureau badge
  const bureauSpan = document.createElement('span');
  bureauSpan.className = `inquiry-bureau ${inquiry.bureau}`;
  bureauSpan.textContent = inquiry.bureau;

  // Age / expiry info
  const ageDiv = document.createElement('div');
  ageDiv.className = 'inquiry-age';
  const daysSince = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  const daysUntilExpiry = 730 - daysSince; // 2 years = 730 days

  if (daysUntilExpiry <= 0) {
    ageDiv.textContent = 'Fallen off';
    ageDiv.classList.add('expired');
  } else if (daysUntilExpiry <= 90) {
    ageDiv.textContent = `${daysUntilExpiry}d until off`;
    ageDiv.classList.add('expiring-soon');
  } else {
    const monthsRemaining = Math.floor(daysUntilExpiry / 30);
    ageDiv.textContent = `${monthsRemaining}mo remaining`;
  }

  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'inquiry-delete';
  deleteBtn.textContent = '×';
  deleteBtn.title = 'Delete';
  deleteBtn.addEventListener('click', () => {
    openDeleteInquiryModal(inquiry.id);
  });

  item.appendChild(dateDiv);
  item.appendChild(infoDiv);
  item.appendChild(bureauSpan);
  item.appendChild(ageDiv);
  item.appendChild(deleteBtn);

  return item;
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
    allCards = cards; // Store for calculator use

    // Update calculator state
    const calcNoCards = document.getElementById('calc-no-cards');
    const calcContainer = document.querySelector('.calculator-container') as HTMLElement | null;
    if (calcNoCards !== null && calcContainer !== null) {
      if (cards.length === 0) {
        calcNoCards.classList.remove('hidden');
        calcContainer.classList.add('hidden');
      } else {
        calcNoCards.classList.add('hidden');
        calcContainer.classList.remove('hidden');
      }
    }

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
  transferPartners = card?.rewards.transferPartners ? [...card.rewards.transferPartners] : [];

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
    if (card.openedOn !== undefined) {
      (document.getElementById('openedOn') as HTMLInputElement).value = card.openedOn;
    }
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

    // Signup bonus fields
    if (card.signupBonus !== undefined) {
      (document.getElementById('bonusAmount') as HTMLInputElement).value = String(card.signupBonus.amount);
      (document.getElementById('bonusMinSpend') as HTMLInputElement).value = String(card.signupBonus.minSpend);
      (document.getElementById('bonusDeadline') as HTMLInputElement).value = card.signupBonus.deadline;
      (document.getElementById('bonusSpentToDate') as HTMLInputElement).value = String(card.signupBonus.spendToDate);
    }

    if (card.notes !== undefined) {
      (document.getElementById('notes') as HTMLTextAreaElement).value = card.notes;
    }
  }

  // Render category rewards and transfer partners
  renderCategoryRewards();
  renderTransferPartners();

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

function renderTransferPartners(): void {
  if (transferPartnersList === null) return;

  while (transferPartnersList.firstChild !== null) {
    transferPartnersList.removeChild(transferPartnersList.firstChild);
  }

  for (let i = 0; i < transferPartners.length; i++) {
    const partner = transferPartners[i];
    if (partner === undefined) continue;

    const row = document.createElement('div');
    row.className = 'partner-row';

    // Partner name input
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = partner.partner;
    nameInput.placeholder = 'Partner name';
    nameInput.dataset['index'] = String(i);
    nameInput.addEventListener('change', (e) => {
      const idx = parseInt((e.target as HTMLInputElement).dataset['index'] ?? '0', 10);
      const item = transferPartners[idx];
      if (item !== undefined) {
        item.partner = (e.target as HTMLInputElement).value;
      }
    });

    // Ratio input
    const ratioInput = document.createElement('input');
    ratioInput.type = 'number';
    ratioInput.min = '0';
    ratioInput.step = '0.1';
    ratioInput.value = String(partner.ratio);
    ratioInput.placeholder = 'Ratio';
    ratioInput.title = 'Transfer ratio (e.g., 1 = 1:1)';
    ratioInput.dataset['index'] = String(i);
    ratioInput.addEventListener('change', (e) => {
      const idx = parseInt((e.target as HTMLInputElement).dataset['index'] ?? '0', 10);
      const item = transferPartners[idx];
      if (item !== undefined) {
        item.ratio = parseFloat((e.target as HTMLInputElement).value) || 1;
      }
    });

    // Valuation input
    const valInput = document.createElement('input');
    valInput.type = 'number';
    valInput.min = '0';
    valInput.step = '0.1';
    valInput.value = String(partner.valuationCpp);
    valInput.placeholder = 'cpp';
    valInput.title = 'Cents per point valuation';
    valInput.dataset['index'] = String(i);
    valInput.addEventListener('change', (e) => {
      const idx = parseInt((e.target as HTMLInputElement).dataset['index'] ?? '0', 10);
      const item = transferPartners[idx];
      if (item !== undefined) {
        item.valuationCpp = parseFloat((e.target as HTMLInputElement).value) || 1;
      }
    });

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'partner-remove';
    removeBtn.textContent = '×';
    removeBtn.dataset['index'] = String(i);
    removeBtn.addEventListener('click', (e) => {
      const idx = parseInt((e.target as HTMLButtonElement).dataset['index'] ?? '0', 10);
      transferPartners.splice(idx, 1);
      renderTransferPartners();
    });

    row.appendChild(nameInput);
    row.appendChild(ratioInput);
    row.appendChild(valInput);
    row.appendChild(removeBtn);

    transferPartnersList.appendChild(row);
  }
}

function addTransferPartnerRow(): void {
  transferPartners.push({
    partner: '',
    ratio: 1,
    valuationCpp: 1.5,
  });
  renderTransferPartners();
}

async function saveCard(): Promise<void> {
  if (cardForm === null) return;

  const formData = new FormData(cardForm);

  const baseRatePercent = parseFloat(formData.get('baseRate') as string) || 1;
  const creditLimitStr = formData.get('creditLimit') as string;
  const statementDayStr = formData.get('statementDay') as string;
  const dueDayStr = formData.get('dueDay') as string;

  // Filter out invalid transfer partners (empty names)
  const validPartners = transferPartners.filter((p) => p.partner.trim() !== '');

  const openedOnStr = formData.get('openedOn') as string;

  const cardInput: CardInput = {
    nickname: (formData.get('nickname') as string).trim(),
    productName: (formData.get('productName') as string).trim(),
    issuer: formData.get('issuer') as Issuer,
    network: formData.get('network') as Network,
    last4: formData.get('last4') as string,
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

  // Add transfer partners if any
  if (validPartners.length > 0) {
    cardInput.rewards.transferPartners = validPartners;
  }

  // Only add optional fields if they have values
  if (openedOnStr !== '') {
    cardInput.openedOn = openedOnStr;
  }
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

  // Signup bonus
  const bonusAmountStr = formData.get('bonusAmount') as string;
  const bonusMinSpendStr = formData.get('bonusMinSpend') as string;
  const bonusDeadlineStr = formData.get('bonusDeadline') as string;
  const bonusSpentToDateStr = formData.get('bonusSpentToDate') as string;

  if (bonusAmountStr !== '' && bonusMinSpendStr !== '' && bonusDeadlineStr !== '') {
    cardInput.signupBonus = {
      amount: parseFloat(bonusAmountStr) || 0,
      minSpend: parseFloat(bonusMinSpendStr) || 0,
      deadline: bonusDeadlineStr,
      spendToDate: parseFloat(bonusSpentToDateStr) || 0,
    };
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
    renderBonusTracker();
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
  inquiryModal?.classList.add('hidden');
  deleteInquiryModal?.classList.add('hidden');
  editingCardId = null;
  deletingCardId = null;
  deletingInquiryId = null;
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

function runCalculatorComparison(): void {
  if (calcResults === null) return;

  const categorySelect = document.getElementById('calc-category') as HTMLSelectElement | null;
  const amountInput = document.getElementById('calc-amount') as HTMLInputElement | null;

  if (categorySelect === null || amountInput === null) return;

  const category = categorySelect.value as Category;
  const amount = parseFloat(amountInput.value) || 0;

  if (amount <= 0) {
    while (calcResults.firstChild !== null) {
      calcResults.removeChild(calcResults.firstChild);
    }
    const placeholder = document.createElement('p');
    placeholder.className = 'calc-placeholder';
    placeholder.textContent = 'Enter an amount greater than $0 to compare cards.';
    calcResults.appendChild(placeholder);
    return;
  }

  if (allCards.length === 0) {
    while (calcResults.firstChild !== null) {
      calcResults.removeChild(calcResults.firstChild);
    }
    const placeholder = document.createElement('p');
    placeholder.className = 'calc-placeholder';
    placeholder.textContent = 'Add some cards first to use the calculator.';
    calcResults.appendChild(placeholder);
    return;
  }

  const comparisons = compareCardsForPurchase(allCards, category, amount);

  while (calcResults.firstChild !== null) {
    calcResults.removeChild(calcResults.firstChild);
  }

  for (let i = 0; i < comparisons.length; i++) {
    const comp = comparisons[i];
    if (comp === undefined) continue;

    const resultItem = document.createElement('div');
    resultItem.className = 'calc-result-item';
    if (i === 0) resultItem.classList.add('best');

    const rankDiv = document.createElement('div');
    rankDiv.className = 'calc-rank';
    rankDiv.textContent = i === 0 ? '🏆' : String(i + 1);

    const infoDiv = document.createElement('div');
    infoDiv.className = 'calc-result-info';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'calc-card-name';
    nameDiv.textContent = sanitizeForDisplay(comp.cardNickname);

    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'calc-card-details';

    const rateSpan = document.createElement('span');
    rateSpan.textContent = `${(comp.earnRate * 100).toFixed(1)}% earn rate`;
    if (comp.isRotating) {
      const rotatingBadge = document.createElement('span');
      rotatingBadge.className = 'rotating-badge';
      rotatingBadge.textContent = 'Rotating';
      detailsDiv.appendChild(rotatingBadge);
    }
    detailsDiv.appendChild(rateSpan);

    infoDiv.appendChild(nameDiv);
    infoDiv.appendChild(detailsDiv);

    const valueDiv = document.createElement('div');
    valueDiv.className = 'calc-result-value';

    const pointsDiv = document.createElement('div');
    pointsDiv.className = 'calc-points';
    pointsDiv.textContent = `${comp.pointsEarned.toFixed(0)} pts`;

    const cashDiv = document.createElement('div');
    cashDiv.className = 'calc-cash';
    cashDiv.textContent = `$${comp.bestValue.toFixed(2)} value`;

    if (comp.transferValue !== undefined && comp.transferValue > comp.cashbackValue) {
      const transferDiv = document.createElement('div');
      transferDiv.className = 'calc-transfer';
      transferDiv.textContent = '(via transfer)';
      valueDiv.appendChild(pointsDiv);
      valueDiv.appendChild(cashDiv);
      valueDiv.appendChild(transferDiv);
    } else {
      valueDiv.appendChild(pointsDiv);
      valueDiv.appendChild(cashDiv);
    }

    resultItem.appendChild(rankDiv);
    resultItem.appendChild(infoDiv);
    resultItem.appendChild(valueDiv);

    calcResults.appendChild(resultItem);
  }
}

function renderBonusTracker(): void {
  if (bonusTracker === null) return;

  while (bonusTracker.firstChild !== null) {
    bonusTracker.removeChild(bonusTracker.firstChild);
  }

  const cardsWithBonus = allCards.filter((card) => card.signupBonus !== undefined);

  if (cardsWithBonus.length === 0) {
    const placeholder = document.createElement('p');
    placeholder.className = 'calc-placeholder';
    placeholder.textContent = 'Cards with active signup bonuses will appear here.';
    bonusTracker.appendChild(placeholder);
    return;
  }

  for (const card of cardsWithBonus) {
    const progress = getSignupBonusProgress(card);
    if (progress === null) continue;

    const bonusItem = document.createElement('div');
    bonusItem.className = 'bonus-item';
    if (progress.isComplete) bonusItem.classList.add('complete');
    if (progress.isExpired) bonusItem.classList.add('expired');

    const headerDiv = document.createElement('div');
    headerDiv.className = 'bonus-header';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'bonus-card-name';
    nameSpan.textContent = sanitizeForDisplay(card.nickname);

    const statusSpan = document.createElement('span');
    statusSpan.className = 'bonus-status';
    if (progress.isComplete) {
      statusSpan.textContent = '✅ Complete';
      statusSpan.classList.add('complete');
    } else if (progress.isExpired) {
      statusSpan.textContent = '❌ Expired';
      statusSpan.classList.add('expired');
    } else {
      statusSpan.textContent = `${progress.daysRemaining} days left`;
    }

    headerDiv.appendChild(nameSpan);
    headerDiv.appendChild(statusSpan);

    const progressBarDiv = document.createElement('div');
    progressBarDiv.className = 'bonus-progress-bar';

    const progressFill = document.createElement('div');
    progressFill.className = 'bonus-progress-fill';
    progressFill.style.width = `${Math.min(100, progress.percentComplete)}%`;

    progressBarDiv.appendChild(progressFill);

    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'bonus-details';

    const spentSpan = document.createElement('span');
    spentSpan.textContent = `$${progress.spendToDate.toLocaleString()} of $${progress.minSpend.toLocaleString()}`;

    const remainingSpan = document.createElement('span');
    if (!progress.isComplete) {
      remainingSpan.textContent = `$${progress.amountRemaining.toLocaleString()} to go`;
    } else {
      remainingSpan.textContent = `${card.signupBonus?.amount.toLocaleString() ?? 0} points earned`;
    }

    detailsDiv.appendChild(spentSpan);
    detailsDiv.appendChild(remainingSpan);

    bonusItem.appendChild(headerDiv);
    bonusItem.appendChild(progressBarDiv);
    bonusItem.appendChild(detailsDiv);

    bonusTracker.appendChild(bonusItem);
  }
}

function renderEligibility(): void {
  // Chase 5/24
  const chaseResult = checkChase524(allCards);
  updateEligibilityCard('chase', chaseResult.eligible, chaseResult.reason, chaseResult.details);

  // Amex 2/90
  const amexResult = checkAmex290(allCards);
  updateEligibilityCard('amex', amexResult.eligible, amexResult.reason, amexResult.details);

  // Citi 8/65
  const citiResult = checkCiti865(allCards, allInquiries);
  updateEligibilityCard('citi', citiResult.eligible, citiResult.reason, citiResult.details);

  // BoA 2/3/4
  const boaResult = checkBoA234(allCards);
  updateEligibilityCard('boa', boaResult.eligible, boaResult.reason, boaResult.details);
}

function updateEligibilityCard(
  issuer: string,
  eligible: boolean,
  status: string,
  detail?: string
): void {
  const card = document.querySelector(`.eligibility-card[data-issuer="${issuer}"]`);
  const badge = document.getElementById(`${issuer}-badge`);
  const statusEl = document.getElementById(`${issuer}-status`);
  const detailEl = document.getElementById(`${issuer}-detail`);

  if (card !== null) {
    card.classList.remove('eligible', 'ineligible');
    card.classList.add(eligible ? 'eligible' : 'ineligible');
  }

  if (badge !== null) {
    badge.classList.remove('eligible', 'ineligible');
    badge.classList.add(eligible ? 'eligible' : 'ineligible');
    badge.textContent = eligible ? 'Eligible' : 'Ineligible';
  }

  if (statusEl !== null) {
    statusEl.textContent = status;
  }

  if (detailEl !== null) {
    detailEl.textContent = detail ?? '';
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  void init();
});
