# CardCompare

A privacy-first Chrome extension for managing and comparing your credit card portfolio. Instantly find the best card to use for any purchase category and track your eligibility for new cards.

## Features

### Quick Card Comparison
- Select a spending category (dining, groceries, gas, travel, etc.) and instantly see which card earns the most rewards
- View earn rates for all your cards in context
- Supports rotating quarterly bonuses (Discover, Chase Freedom)

### Rewards Calculator
- Compare cards for specific purchase amounts
- Factor in transfer partner valuations for points cards
- Track signup bonus progress with spend requirements and deadlines

### Issuer Eligibility Rules
- **Chase 5/24**: Tracks cards opened in last 24 months
- **Amex 2/90**: Monitors Amex applications in last 90 days
- **Citi 8/65**: Checks application velocity limits
- **Bank of America 2/3/4**: Tracks BoA-specific limits
- Hard inquiry tracking by credit bureau

### Card Management
- Store card details including rewards structure, annual fees, and APR
- Category bonus configuration with caps
- Transfer partner management with custom valuations
- Statement and due date tracking

## Privacy & Security

- **100% Local Storage**: All data stays on your device using IndexedDB
- **Zero Telemetry**: No data is ever sent to external servers
- **Partial Card Numbers Only**: Only stores last 4 digits (full card numbers are rejected)
- **Export/Import**: Backup your data locally anytime

## Installation

### From Source
1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the extension:
   ```bash
   npm run build
   ```
4. Open Chrome and go to `chrome://extensions/`
5. Enable "Developer mode" (top right)
6. Click "Load unpacked" and select the `dist` folder

## Usage

1. **Add Your Cards**: Click the extension icon, then the settings gear to add your credit cards with their reward structures
2. **Quick Lookup**: Click the extension popup and select a category to see your best card
3. **Detailed Comparison**: Use the Calculator tab for purchase-specific comparisons
4. **Check Eligibility**: View the Eligibility tab before applying for new cards

## Tech Stack

- TypeScript (strict mode)
- Vite build system
- Chrome Extension Manifest V3
- IndexedDB via idb library
- No external frameworks (vanilla JS)

## License

MIT
