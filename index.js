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

async function refreshPoints(address, log = true) {
  try {
    const url = `https://testnet-api.oroswap.org/api/portfolio/${address}/points`;
    const headers = {
      'accept': 'application/json, text/plain, */*',
      'origin': 'https://testnet.oroswap.org',
      'referer': 'https://testnet.oroswap.org/',
      'user-agent': 'Mozilla/5.0'
    };
    const res = await axios.get(url, { headers });
    const points = res.data.points[0];
    if (log && points) {
      logger.info(`Points: ${points.points} | Swaps: ${points.swaps_count} | Pools: ${points.join_pool_count}`);
    }
    return points;
  } catch (e) {
    if (log) logger.warn(`Gagal ambil points: ${e.message}`);
    return null;
  }
}

async function displayAccountInfo(client, address) {
  logger.step('Cek saldo & status...');
  try {
    const [zig, oro, points] = await Promise.all([
      client.getBalance(address, DENOM_ZIG),
      client.getBalance(address, DENOM_ORO),
      refreshPoints(address, false)
    ]);
    logger.info(`Saldo: ${fromMicroUnits(zig.amount, DENOM_ZIG).toFixed(4)} ZIG | ${fromMicroUnits(oro.amount, DENOM_ORO).toFixed(4)} ORO`);
    if (points) logger.info(`Points: ${points.points} | Swaps: ${points.swaps_count} | Pools: ${points.join_pool_count}`);
  } catch (e) {
    logger.warn(`Gagal cek info akun: ${e.message}`);
  }
}

async function performSwap(client, address, fromDenom, amount) {
  try {
    logger.step(`Swap ${amount.toFixed(4)} ${fromDenom === DENOM_ZIG ? 'ZIG' : 'ORO'}...`);
    const poolInfo = await client.queryContractSmart(config.contract, { pool: {} });
    const zig = poolInfo.assets.find(a => a.info.native_token?.denom === DENOM_ZIG);
    const oro = poolInfo.assets.find(a => a.info.native_token?.denom === DENOM_ORO);
    const beliefPrice = fromDenom === DENOM_ZIG
      ? (parseFloat(zig.amount) / parseFloat(oro.amount)).toFixed(18)
      : (parseFloat(oro.amount) / parseFloat(zig.amount)).toFixed(18);
    const msg = {
      swap: {
        offer_asset: {
          amount: toMicroUnits(amount, fromDenom).toString(),
          info: { native_token: { denom: fromDenom } }
        },
        belief_price: beliefPrice,
        max_spread: (config.swap.slippage / 100).toString()
      }
    };
    const tx = await client.execute(address, config.contract, msg, 'auto', 'Swap', coins(toMicroUnits(amount, fromDenom), fromDenom));
    logger.info(`Swap berhasil`);
    logger.link(`Tx: https://zigscan.org/tx/${tx.transactionHash}`);
    return true;
  } catch (e) {
    logger.error(`Swap gagal: ${e.message}`);
    return false;
  }
}

async function performAddLiquidity(client, address) {
  try {
    logger.step(`Tambah liquidity ZIG: ${config.pools.amountZIG}, ORO: ${config.pools.amountORO}`);
    const assets = [
      { amount: toMicroUnits(config.pools.amountZIG, DENOM_ZIG).toString(), info: { native_token: { denom: DENOM_ZIG } } },
      { amount: toMicroUnits(config.pools.amountORO, DENOM_ORO).toString(), info: { native_token: { denom: DENOM_ORO } } },
    ];
    const funds = [
      { denom: DENOM_ZIG, amount: toMicroUnits(config.pools.amountZIG, DENOM_ZIG).toString() },
      { denom: DENOM_ORO, amount: toMicroUnits(config.pools.amountORO, DENOM_ORO).toString() }
    ].sort((a, b) => a.denom.localeCompare(b.denom));
    const msg = { provide_liquidity: { assets, slippage_tolerance: "0.5", auto_stake: false } };
    const tx = await client.execute(address, config.contract, msg, 'auto', '', funds);
    logger.info(`Liquidity berhasil ditambahkan`);
    logger.link(`Tx: https://zigscan.org/tx/${tx.transactionHash}`);
    return true;
  } catch (e) {
    logger.error(`Add liquidity gagal: ${e.message}`);
    return false;
  }
}

async function performWithdrawLiquidity(client, address) {
  try {
    const lp = await client.getBalance(address, config.lpTokenDenom);
    if (parseInt(lp.amount) === 0) {
      logger.warn(`Tidak ada LP token`);
      return false;
    }
    logger.step(`Withdraw ${lp.amount} LP token...`);
    const tx = await client.execute(address, config.contract, { withdraw_liquidity: {} }, 'auto', '', coins(lp.amount, config.lpTokenDenom));
    logger.info(`Withdraw berhasil`);
    logger.link(`Tx: https://zigscan.org/tx/${tx.transactionHash}`);
    return true;
  } catch (e) {
    logger.error(`Withdraw gagal: ${e.message}`);
    return false;
  }
}

async function runForWalletOnce(privateKey, index) {
  try {
    const wallet = await getWallet(privateKey);
    const [account] = await wallet.getAccounts();
    const client = await SigningCosmWasmClient.connectWithSigner(config.rpc, wallet, {
      gasPrice: GasPrice.fromString('0.03uzig'),
    });

    logger.info(`[#${index}] Wallet: ${account.address}`);
    await displayAccountInfo(client, account.address);
    console.log('');

    if (config.swap.enabled) {
      for (let i = 0; i < config.swap.countPerLoop; i++) {
        const fromDenom = i % 2 === 0 ? DENOM_ZIG : DENOM_ORO;
        const amountRange = fromDenom === DENOM_ZIG ? config.swap.amountZIG : config.swap.amountORO;
        const amount = Math.random() * (amountRange.max - amountRange.min) + amountRange.min;
        const success = await performSwap(client, account.address, fromDenom, amount);
        if (success) await refreshPoints(account.address);
        await delay(config.delayInSeconds.betweenTransactions * 1000);
      }
    }

    if (config.pools.enabled) {
      const added = await performAddLiquidity(client, account.address);
      if (added) {
        await refreshPoints(account.address);
        if (config.pools.withdrawEnabled) {
          await delay(config.delayInSeconds.betweenTransactions * 1000);
          const withdrawn = await performWithdrawLiquidity(client, account.address);
          if (withdrawn) await refreshPoints(account.address);
        }
      }
    }

    logger.info(`[#${index}] Selesai 1 loop.\n`);
    await delay(config.delayInSeconds.betweenLoops * 1000);
  } catch (e) {
    logger.error(`[#${index}] ERROR: ${e.message}`);
  }
}

async function main() {
  logger.banner();

  const envKeys = Object.keys(process.env).filter(k => /^pk\d+$/i.test(k));
  if (envKeys.length === 0) return logger.error("Tidak ada variabel pk1=, pk2=, ... dalam .env");

  const keys = envKeys
    .sort((a, b) => parseInt(a.replace('pk', '')) - parseInt(b.replace('pk', '')))
    .map(k => process.env[k].trim())
    .filter(Boolean);

  let round = 1;
  while (true) {
    logger.loop(`ROUND #${round}`);
    for (let i = 0; i < keys.length; i++) {
      logger.loop(`Menjalankan Wallet #${i + 1}`);
      await runForWalletOnce(keys[i], i + 1);
    }
    round++;
  }
}

main().catch(e => logger.error(`FATAL: ${e.message}`));
