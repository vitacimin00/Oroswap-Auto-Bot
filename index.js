// index.js - Pharos Network Autobot
require('dotenv').config();
const axios = require('axios');
const { SigningCosmWasmClient } = require('@cosmjs/cosmwasm-stargate');
const { GasPrice, coins } = require('@cosmjs/stargate');
const { DirectSecp256k1HdWallet, DirectSecp256k1Wallet } = require('@cosmjs/proto-signing');
const config = require('./config');

const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  bold: "\x1b[1m",
  blue: "\x1b[34m",
};

const logger = {
  info: (msg) => console.log(`${colors.green}[✓] ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}[⚠] ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}[✗] ${msg}${colors.reset}`),
  step: (msg) => console.log(`${colors.cyan}[➤] ${msg}${colors.reset}`),
  loop: (msg) => console.log(`${colors.blue}\n===== ${msg} =====${colors.reset}`),
  link: (msg) => console.log(`${colors.cyan}\x1b[2m    ${msg}\x1b[0m`),
  banner: () => {
    console.log(`${colors.cyan}${colors.bold}`);
    console.log("╔═════════════════════════════════════════════╗");
    console.log("║        Oroswap Auto Bot - AmoureuxID        ║");
    console.log(`╚═════════════════════════════════════════════╝${colors.reset}\n`);
  },
};

const delay = (ms) => new Promise(res => setTimeout(res, ms));

const DENOM_ORO = 'coin.zig10rfjm85jmzfhravjwpq3hcdz8ngxg7lxd0drkr.uoro';
const DENOM_ZIG = 'uzig';
const TOKEN_DECIMALS = { [DENOM_ZIG]: 6, [DENOM_ORO]: 6, [config.lpTokenDenom]: 6 };

function toMicroUnits(amount, denom) {
  const decimals = TOKEN_DECIMALS[denom] || 6;
  return Math.floor(parseFloat(amount) * Math.pow(10, decimals));
}

function fromMicroUnits(amount, denom) {
    const decimals = TOKEN_DECIMALS[denom] || 6;
    return parseFloat(amount) / Math.pow(10, decimals);
}

async function getWallet(key) {
    const trimmedKey = key.trim();
    if (trimmedKey.split(/\s+/).length >= 12) {
      return DirectSecp256k1HdWallet.fromMnemonic(trimmedKey, { prefix: 'zig' });
    }
    const processedKey = trimmedKey.startsWith('0x') ? trimmedKey.substring(2) : trimmedKey;
    const privateKeyBytes = Buffer.from(processedKey, 'hex');
    return DirectSecp256k1Wallet.fromKey(privateKeyBytes, 'zig');
}

async function displayAccountInfo(client, address) {
  logger.step('Loading account status...');
  try {
    const [zigBalance, oroBalance, pointsData] = await Promise.all([
        client.getBalance(address, DENOM_ZIG),
        client.getBalance(address, DENOM_ORO),
        refreshPoints(address, false)
    ]);
    const zigAmount = fromMicroUnits(zigBalance.amount, DENOM_ZIG);
    const oroAmount = fromMicroUnits(oroBalance.amount, DENOM_ORO);
    logger.info(`Balance: ${zigAmount.toFixed(4)} ZIG | ${oroAmount.toFixed(4)} ORO`);
    if(pointsData) {
        logger.info(`Points: ${pointsData.points} | Swaps: ${pointsData.swaps_count} | Pools: ${pointsData.join_pool_count}`);
    }
  } catch(e) {
    logger.warn(`Failed to load account info: ${e.message}`);
  }
}

async function refreshPoints(address, shouldLog = true) {
  try {
    const url = `https://testnet-api.oroswap.org/api/portfolio/${address}/points`;
    const axiosConfig = {
      headers: {
        'accept': 'application/json, text/plain, */*',
        'origin': 'https://testnet.oroswap.org',
        'referer': 'https://testnet.oroswap.org/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
      }
    };
    const response = await axios.get(url, axiosConfig);
    const pointsData = response.data.points[0];
    if (pointsData && shouldLog) {
      logger.info(`Points updated: ${pointsData.points} (Swaps: ${pointsData.swaps_count}, Pools: ${pointsData.join_pool_count})`);
    }
    return pointsData;
  } catch (e) {
    if(shouldLog) logger.warn(`Could not refresh points data: ${e.message}`);
    return null;
  }
}

async function performSwap(client, address, fromDenom, amount) {
  try {
    logger.step(`Attempting to swap ${amount.toFixed(5)} ${fromDenom === DENOM_ZIG ? 'ZIG' : 'ORO'}...`);
    const poolInfo = await client.queryContractSmart(config.contract, { pool: {} });
    const assetZIG = poolInfo.assets.find(a => a.info.native_token?.denom === DENOM_ZIG);
    const assetORO = poolInfo.assets.find(a => a.info.native_token?.denom === DENOM_ORO);
    let beliefPrice;
    if (fromDenom === DENOM_ZIG) {
        beliefPrice = (parseFloat(assetZIG.amount) / parseFloat(assetORO.amount)).toFixed(18);
    } else {
        beliefPrice = (parseFloat(assetORO.amount) / parseFloat(assetZIG.amount)).toFixed(18);
    }
    const msg = { swap: { offer_asset: { amount: toMicroUnits(amount, fromDenom).toString(), info: { native_token: { denom: fromDenom } } }, belief_price: beliefPrice, max_spread: (config.swap.slippage / 100).toString() } };
    const result = await client.execute(address, config.contract, msg, 'auto', 'Swap (Native)', coins(toMicroUnits(amount, fromDenom), fromDenom));
    logger.info(`Swap successful!`);
    logger.link(`Tx: https://zigscan.org/tx/${result.transactionHash}`);
    return true;
  } catch (e) {
    logger.error(`Swap failed: ${e.message.split('Broadcasting transaction failed')[0]}`);
    return false;
  }
}

async function performAddLiquidity(client, address) {
    try {
        logger.step(`Attempting to add liquidity: ${config.pools.amountZIG} ZIG & ${config.pools.amountORO} ORO...`);
        const assets = [
            { amount: toMicroUnits(config.pools.amountORO, DENOM_ORO).toString(), info: { native_token: { denom: DENOM_ORO } } },
            { amount: toMicroUnits(config.pools.amountZIG, DENOM_ZIG).toString(), info: { native_token: { denom: DENOM_ZIG } } }
        ];
        const msg = { provide_liquidity: { assets, slippage_tolerance: "0.5", auto_stake: false, } };
        const funds = [
            { denom: DENOM_ORO, amount: toMicroUnits(config.pools.amountORO, DENOM_ORO).toString() },
            { denom: DENOM_ZIG, amount: toMicroUnits(config.pools.amountZIG, DENOM_ZIG).toString() }
        ];
        const result = await client.execute(address, config.contract, msg, 'auto', '', funds);
        logger.info('Add liquidity successful!');
        logger.link(`Tx: https://zigscan.org/tx/${result.transactionHash}`);
        return true;
    } catch(e) {
        logger.error(`Add liquidity failed: ${e.message.split('Broadcasting transaction failed')[0]}`);
        return false;
    }
}

async function performWithdrawLiquidity(client, address) {
    try {
        const lpBalance = await client.getBalance(address, config.lpTokenDenom);
        const lpAmount = lpBalance.amount;
        if (parseInt(lpAmount) === 0) {
            logger.warn('No liquidity (LP Tokens) to withdraw.');
            return false;
        }
        logger.step(`Attempting to withdraw ${lpAmount} LP Tokens...`);
        const msg = { withdraw_liquidity: {} };
        const result = await client.execute(address, config.contract, msg, 'auto', '', coins(lpAmount, config.lpTokenDenom));
        logger.info('Withdraw liquidity successful!');
        logger.link(`Tx: https://zigscan.org/tx/${result.transactionHash}`);
        return true;
    } catch(e) {
        logger.error(`Withdraw liquidity failed: ${e.message.split('Broadcasting transaction failed')[0]}`);
        return false;
    }
}

async function main() {
  logger.banner();
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    return logger.error("PRIVATE_KEY not found in .env file.");
  }

  const wallet = await getWallet(privateKey);
  const [account] = await wallet.getAccounts();
  const client = await SigningCosmWasmClient.connectWithSigner(config.rpc, wallet, {
    gasPrice: GasPrice.fromString('0.03uzig'),
  });

  logger.info(`Bot started for wallet: ${account.address}`);
  let loopCount = 1;

  while (true) {
    logger.loop(`STARTING LOOP #${loopCount}`);
    await displayAccountInfo(client, account.address);
    console.log('');

    if (config.swap.enabled) {
      logger.step(`Starting swap cycle (${config.swap.countPerLoop} transactions)...`);
      for (let i = 0; i < config.swap.countPerLoop; i++) {
        const fromDenom = i % 2 === 0 ? DENOM_ZIG : DENOM_ORO;
        const amountConfig = fromDenom === DENOM_ZIG ? config.swap.amountZIG : config.swap.amountORO;
        const amount = Math.random() * (amountConfig.max - amountConfig.min) + amountConfig.min;
        const success = await performSwap(client, account.address, fromDenom, amount);
        if(success) { await refreshPoints(account.address); }
        logger.info(`Waiting for ${config.delayInSeconds.betweenTransactions} seconds...`);
        await delay(config.delayInSeconds.betweenTransactions * 1000);
      }
    }

    if (config.pools.enabled) {
        logger.step('Starting pool cycle...');
        const added = await performAddLiquidity(client, account.address);
        if (added) {
            await refreshPoints(account.address);
            if (config.pools.withdrawEnabled) {
                logger.info(`Waiting for ${config.delayInSeconds.betweenTransactions} seconds before withdrawing liquidity...`);
                await delay(config.delayInSeconds.betweenTransactions * 1000);
                const withdrawn = await performWithdrawLiquidity(client, account.address);
                if(withdrawn) { await refreshPoints(account.address); }
            }
        }
    }
    
    loopCount++;
    logger.loop(`CYCLE COMPLETE. Waiting for ${config.delayInSeconds.betweenLoops} seconds for the next loop...`);
    await delay(config.delayInSeconds.betweenLoops * 1000);
  }
}

main().catch(e => logger.error(`FATAL ERROR: ${e.message}`));