import { getAllCards } from '@/lib/storage';
import { getApiKey, chat, type AIMessage } from '@/lib/ai';
import type { Card } from '@/types';

let allCards: Card[] = [];
let conversationHistory: AIMessage[] = [];

async function init(): Promise<void> {
  const aiSection = document.getElementById('ai-section');
  const noApiKey = document.getElementById('no-api-key');
  const emptyState = document.getElementById('empty-state');
  const cardCount = document.getElementById('card-count');
  const chatInput = document.getElementById('chat-input') as HTMLInputElement | null;
  const sendBtn = document.getElementById('send-btn');
  const chatMessages = document.getElementById('chat-messages');
  const openOptions = document.getElementById('open-options');
  const setupApiKey = document.getElementById('setup-api-key');
  const addFirstCard = document.getElementById('add-first-card');
  const viewCards = document.getElementById('view-cards');

  if (!aiSection || !noApiKey || !emptyState || !cardCount || !chatInput || !sendBtn || !chatMessages) {
    console.error('Required DOM elements not found');
    return;
  }

  // Navigation handlers
  openOptions?.addEventListener('click', () => void chrome.runtime.openOptionsPage());
  setupApiKey?.addEventListener('click', () => void chrome.runtime.openOptionsPage());
  addFirstCard?.addEventListener('click', () => void chrome.runtime.openOptionsPage());
  viewCards?.addEventListener('click', () => void chrome.runtime.openOptionsPage());

  // Load cards and check API key
  try {
    allCards = await getAllCards();
    const apiKey = await getApiKey();

    cardCount.textContent = `${allCards.length} card${allCards.length !== 1 ? 's' : ''}`;

    if (allCards.length === 0) {
      aiSection.classList.add('hidden');
      noApiKey.classList.add('hidden');
      emptyState.classList.remove('hidden');
      return;
    }

    if (!apiKey) {
      aiSection.classList.add('hidden');
      emptyState.classList.add('hidden');
      noApiKey.classList.remove('hidden');
      return;
    }

    // Show AI chat
    emptyState.classList.add('hidden');
    noApiKey.classList.add('hidden');
    aiSection.classList.remove('hidden');

    // Set up chat handlers
    const sendMessage = async () => {
      const message = chatInput.value.trim();
      if (!message) return;

      chatInput.value = '';
      await handleUserMessage(message, chatMessages);
    };

    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        void sendMessage();
      }
    });

    // Quick prompts
    document.querySelectorAll('.quick-prompt').forEach((btn) => {
      btn.addEventListener('click', () => {
        const prompt = btn.getAttribute('data-prompt');
        if (prompt) {
          chatInput.value = prompt;
          void sendMessage();
        }
      });
    });

  } catch (error) {
    console.error('Error initializing popup:', error);
  }
}

async function handleUserMessage(message: string, container: HTMLElement): Promise<void> {
  // Clear welcome message if present
  const welcome = container.querySelector('.ai-welcome');
  if (welcome) {
    welcome.remove();
  }

  // Add user message
  addMessage(container, message, 'user');

  // Add typing indicator
  const typingDiv = document.createElement('div');
  typingDiv.className = 'chat-message assistant loading';
  typingDiv.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
  container.appendChild(typingDiv);
  container.scrollTop = container.scrollHeight;

  // Send to AI
  const response = await chat(message, allCards, conversationHistory);

  // Remove typing indicator
  typingDiv.remove();

  if (response.success) {
    // Add to history
    conversationHistory.push({ role: 'user', content: message });
    conversationHistory.push({ role: 'assistant', content: response.message });

    // Keep history manageable (last 10 exchanges)
    if (conversationHistory.length > 20) {
      conversationHistory = conversationHistory.slice(-20);
    }

    addMessage(container, response.message, 'assistant');
  } else {
    addMessage(container, response.error ?? 'Something went wrong', 'error');
  }
}

function addMessage(container: HTMLElement, content: string, type: 'user' | 'assistant' | 'error'): void {
  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-message ${type}`;

  if (type === 'assistant') {
    // Parse markdown-like formatting
    msgDiv.innerHTML = formatAIResponse(content);
  } else {
    msgDiv.textContent = content;
  }

  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}

function formatAIResponse(text: string): string {
  // Simple markdown-like parsing
  let html = text
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Line breaks to paragraphs
    .split('\n\n')
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');

  // Lists
  html = html.replace(/<p>- (.+?)(<br>- .+?)*<\/p>/g, (match) => {
    const items = match
      .replace(/<\/?p>/g, '')
      .split('<br>')
      .filter((i) => i.startsWith('- '))
      .map((i) => `<li>${i.substring(2)}</li>`)
      .join('');
    return `<ul>${items}</ul>`;
  });

  // Numbered lists
  html = html.replace(/<p>\d+\. (.+?)(<br>\d+\. .+?)*<\/p>/g, (match) => {
    const items = match
      .replace(/<\/?p>/g, '')
      .split('<br>')
      .filter((i) => /^\d+\./.test(i))
      .map((i) => `<li>${i.replace(/^\d+\.\s*/, '')}</li>`)
      .join('');
    return `<ol>${items}</ol>`;
  });

  return html;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  void init();
});
