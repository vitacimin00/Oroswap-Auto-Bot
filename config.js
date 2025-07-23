// config.js
const RPC_URL = 'https://public-zigchain-testnet-rpc.numia.xyz/';
const ORO_ZIG_CONTRACT = 'zig1vhr7hx0yeww0uwe2zlp6mst5g6aup85engzntlyv52rkmxsykvdskfv0tu';
const LP_TOKEN_DENOM = 'coin.zig1vhr7hx0yeww0uwe2zlp6mst5g6aup85engzntlyv52rkmxsykvdskfv0tu.oroswaplptoken';

// =================================================================
// MAIN BOT SETTINGS - EDIT BELOW
// =================================================================
module.exports = {
  // RPC & Contract Settings (usually no need to change)
  rpc: RPC_URL,
  contract: ORO_ZIG_CONTRACT,
  lpTokenDenom: LP_TOKEN_DENOM,

  // --- SWAP SETTINGS ---
  swap: {
    enabled: true, // Set to false to disable the swap module
    countPerLoop: 1, // How many swaps in one cycle
    slippage: 3, // Slippage tolerance in percent (%). 2-3% is a safe value.
    
    // Amount of ZIG to be swapped (a random value between min and max will be chosen)
    amountZIG: { min: 0.001, max: 0.003 },
    // Amount of ORO to be swapped (a random value between min and max will be chosen)
    amountORO: { min: 0.002, max: 0.005 },
  },

  // --- POOLS SETTINGS (Add & Remove Liquidity) ---
  pools: {
    // Main switch for the pool module. If this is false, no pool actions will run.
    enabled: true, 
    
    // Specific switch for withdrawing liquidity.
    // Set to false to ONLY add liquidity without withdrawing it.
    withdrawEnabled: false, 

    // Amount to be used for adding liquidity
    amountZIG: 0.001,
    amountORO: 0.002,
  },
  
  // --- DELAY SETTINGS ---
  delayInSeconds: {
    betweenTransactions: 5, // Delay between each action (e.g., between swap 1 & 2)
    betweenLoops: 10,       // Delay after one cycle (loop) is complete (300 seconds = 5 minutes)
  },
};