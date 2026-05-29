// Claude AI integration for card recommendations
import type { Card } from '@/types';
import { CATEGORY_LABELS, ISSUER_LABELS, POINT_TYPE_LABELS } from '@/types';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  success: boolean;
  message: string;
  error?: string;
}

// Store API key in chrome.storage.local
export async function saveApiKey(apiKey: string): Promise<void> {
  await chrome.storage.local.set({ anthropicApiKey: apiKey });
}

export async function getApiKey(): Promise<string | null> {
  const result = await chrome.storage.local.get('anthropicApiKey');
  return result['anthropicApiKey'] ?? null;
}

export async function clearApiKey(): Promise<void> {
  await chrome.storage.local.remove('anthropicApiKey');
}

// Test if API key is valid
export async function testApiKey(apiKey: string): Promise<AIResponse> {
  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 50,
        messages: [{ role: 'user', content: 'Say "connected" if you can read this.' }],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, message: '', error: error.error?.message ?? 'Invalid API key' };
    }

    return { success: true, message: 'API key is valid!' };
  } catch (error) {
    return { success: false, message: '', error: 'Failed to connect to Claude API' };
  }
}

// Build a summary of user's cards for AI context
export function buildCardContext(cards: Card[]): string {
  if (cards.length === 0) {
    return 'The user has no credit cards added yet.';
  }

  const cardSummaries = cards.map((card) => {
    const categories = card.rewards.categories
      .map((c) => `${CATEGORY_LABELS[c.category]}: ${c.multiplier}%${c.cap ? ` (cap: $${c.cap})` : ''}`)
      .join(', ');

    const partners = card.rewards.transferPartners
      ?.map((p) => `${p.partner} (${p.ratio}:1, ${p.valuationCpp}cpp)`)
      .join(', ');

    return `- **${card.nickname}** (${card.productName} by ${ISSUER_LABELS[card.issuer]})
  - Annual Fee: $${card.annualFee}
  - Rewards: ${POINT_TYPE_LABELS[card.rewards.pointType]}, base ${(card.rewards.baseRate * 100).toFixed(1)}% (${card.rewards.pointValue}cpp value)
  - Category Bonuses: ${categories || 'None'}
  - Transfer Partners: ${partners || 'None'}
  - Foreign Transaction Fee: ${card.foreignTxFee}%`;
  });

  return `The user has ${cards.length} credit card(s):\n\n${cardSummaries.join('\n\n')}`;
}

// System prompt for Claude
const SYSTEM_PROMPT = `You are a credit card rewards optimization expert embedded in a Chrome extension called CardCompare. Your role is to help users maximize their credit card rewards.

You have access to the user's credit card portfolio (reward structures only - never full card numbers). Based on this information, you can:

1. **Recommend which card to use** for specific purchases to maximize rewards
2. **Suggest new cards** that would complement their portfolio based on spending patterns
3. **Analyze their portfolio** for gaps or redundancies
4. **Explain strategies** like transfer partners, category bonuses, and signup bonuses
5. **Answer questions** about credit card rewards, points valuations, and optimization

Guidelines:
- Be concise but helpful - users want quick answers
- When recommending cards for purchases, always explain WHY (e.g., "Use X because it earns 3% on dining vs Y's 1%")
- Consider annual fees when making recommendations
- For new card suggestions, mention popular options like Chase Sapphire, Amex Gold, Citi Double Cash, etc.
- If the user's question is unclear, ask for clarification
- Never ask for or reference full card numbers, SSN, or sensitive data

Current card portfolio:
{CARD_CONTEXT}`;

// Send a message to Claude
export async function chat(
  userMessage: string,
  cards: Card[],
  conversationHistory: AIMessage[] = []
): Promise<AIResponse> {
  const apiKey = await getApiKey();

  if (!apiKey) {
    return { success: false, message: '', error: 'No API key configured. Add your Anthropic API key in Settings.' };
  }

  const cardContext = buildCardContext(cards);
  const systemPrompt = SYSTEM_PROMPT.replace('{CARD_CONTEXT}', cardContext);

  const messages = [
    ...conversationHistory.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: userMessage },
  ];

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, message: '', error: error.error?.message ?? 'API request failed' };
    }

    const data = await response.json();
    const assistantMessage = data.content?.[0]?.text ?? 'No response from AI';

    return { success: true, message: assistantMessage };
  } catch (error) {
    return { success: false, message: '', error: 'Failed to connect to Claude API' };
  }
}

// Quick recommendation for a specific purchase
export async function getQuickRecommendation(
  purchaseDescription: string,
  cards: Card[]
): Promise<AIResponse> {
  const prompt = `I'm about to make this purchase: "${purchaseDescription}"

Which of my cards should I use to maximize rewards? Give me a quick, direct recommendation with brief reasoning.`;

  return chat(prompt, cards);
}

// Portfolio analysis
export async function analyzePortfolio(cards: Card[]): Promise<AIResponse> {
  const prompt = `Analyze my current credit card portfolio. Tell me:
1. What categories am I well-covered for?
2. Where are the gaps in my rewards earning?
3. Are any of my cards redundant?
4. What's one card I should consider adding next?

Keep it concise.`;

  return chat(prompt, cards);
}
