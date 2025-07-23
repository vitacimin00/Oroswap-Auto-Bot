# OroSwap Testnet Automation Bot

An all-in-one Node.js bot designed to automate daily tasks on the **OroSwap Testnet (Zignaly Chain)**. Built for efficiency, it fully automates all the steps required to farm interaction points for a potential airdrop.

---

## 🚀 Features

- **Automated DeFi Suite**  
  Executes a variety of on-chain actions to build a rich transaction history:
    - **Swaps**: Randomly swaps between ZIG and ORO.
    - **Liquidity Provision**: Automatically adds and (optionally) removes liquidity in the ZIG/ORO pool.

- **Highly Configurable**  
  Easily control the bot's entire behavior through the `config.js` file.
    - Enable or disable modules (Swaps, Pools, Withdrawals).
    - Set transaction counts per cycle.
    - Define random swap amounts.
    - Adjust delays between transactions and loops.

- **Real-time Point Tracking**  
  Automatically fetches and displays your updated points from the OroSwap API after each successful action.

- **Robust & Resilient**  
  Includes adjustable slippage settings to handle testnet volatility and ensure transactions succeed.

- **Secure & Simple**  
  Loads your private key securely from a `.env` file and operates from a single, clean script.

---

## 🏁 Getting Started

### 1. Explore the OroSwap Testnet

Familiarize yourself with the dApp and its features.  
👉 Go to [OroSwap Testnet](https://testnet.oroswap.org/)

### 2. Join the AmoureuxID Community

For updates, tips, and airdrop info:  
🔗 [Join AmoureuxID on Telegram](https://t.me/AmoureuxID)

---

## ⚙️ Installation

### Prerequisites

- Node.js (v16.x or newer)
- npm

### 1. Clone & Install

```bash
git clone https://github.com/AmoureuxID/Oros-Network-Auto-Bot.git
cd Oros-Network-Auto-Bot
npm install
```

### 2. Configuration

#### a. Environment Variables (`.env` file)

Create a `.env` file in the project root. You can do this by copying the `.env.example` if it exists, or just creating a new file.

Add your wallet's private key to the `.env` file.
```env
# Add your wallet private key here (without the 0x prefix)
PRIVATE_KEY=your_private_key_1
```
> **⚠️ IMPORTANT:** Always use a new, empty **burner wallet** for this kind of activity. NEVER use a private key from your main wallet containing real funds.

#### b. Bot Settings (`config.js` file)

Open the `config.js` file to control the bot's behavior. You can enable/disable swaps and pools, set the number of transactions, define delays, and more.

---

## 🖥️ Usage

Start the bot with:
```bash
node index.js
```

**Bot flow in the terminal:**
- The bot will display a banner and start.
- At the beginning of each loop, it will display your current balance and points.
- It will then execute the swap cycle and the pool cycle based on your `config.js` settings.
- After completing a full cycle, it will start a countdown and repeat the process indefinitely.

---

## 📁 Project Structure

```OroSwap-Bot/
├── index.js           # Main bot script
├── config.js          # All user-configurable settings
├── .env               # Your secret private key
├── package.json       # Project dependencies
└── README.md          # This documentation file
```

---

## ⚠️ Important Notes

- **For educational purposes only! Use at your own risk.**
- Testnet Instability: Testnets can be slow or unstable. If transactions fail, consider increasing the `slippage` in the `config.js` file.
- Respect platform limitations & ToS. The bot includes configurable delays; use them responsibly.

---

## ❓ FAQ & Troubleshooting

- **"Swap failed: Operation exceeds max spread limit..."**  
  This is the most common issue and is caused by testnet price volatility. **Solution:** Open `config.js` and increase the `swap.slippage` value (e.g., from `3` to `5`).

- **"Add liquidity failed..."**  
  This is usually a network issue or a temporary problem with the smart contract. The bot's logic for adding liquidity is based on successful manual transactions and should be reliable. Try running the bot again later.

- **"My points aren't updating correctly..."**  
  The OroSwap API might have a slight delay. The bot fetches the latest data available, but it can sometimes take a few moments for points to reflect on the backend.

---

## 🤗 Contributing

1. Fork this repository.
2. Create a new feature branch (`git checkout -b feature/NewFeature`).
3. Commit and push your changes.
4. Open a Pull Request.

---

## 📜 License & Attribution

For educational purposes only — use at your own risk.  
Developed by **AmoureuxID**.

---

## 📬 Support & Contact

- Telegram: [@AmoureuxID](https://t.me/AmoureuxID)
- GitHub Issues: [Open an Issue](https://github.com/AmoureuxID/Oros-Network-Auto-Bot/issues)

---

## 🧋 Buy Me a Coffee

If you find this project helpful, your support is appreciated!

- **EVM:** 0xcee2713694211aF776E0a3c1B0E4d9B5B45167c1
- **TON:** UQAGw7KmISyrILX807eYYY1sxPofEGBvOUKtDGo8QPtYY_SL
- **SOL:** 9fYY9YkPmaumkPUSqjD6oaYxvxNo3wETpC9A7nE3Pbza
- **SUI:** 0x2f4b127951b293e164056b908d05c826011a258f81910f2685a8c433158a7b9b

---

⭐ If you enjoy this project, please star the repository!

**à la folie.**