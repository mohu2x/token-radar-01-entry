import type { SnapshotProtocol } from './model.ts';

interface FarmPlaybook {
  check: string;
  action: string;
  cost: string;
  exit: string;
}

const lending: FarmPlaybook = {
  check: 'find a supported supply market and check utilization, withdrawal liquidity and any deposit minimum',
  action: 'Supply a small amount of an asset you already hold, if the market supports it',
  cost: 'Supply capital, approval and deposit fees',
  exit: 'Recheck available liquidity and preview a full withdrawal before adding funds',
};

const vault: FarmPlaybook = {
  check: 'check the vault asset, strategy exposure, fees, withdrawal queue and minimum deposit',
  action: 'Preview shares and deposit the smallest amount you are comfortable testing if the vault is open',
  cost: 'Vault principal, approval and deposit fees',
  exit: 'Compare the redeem preview with your entry and check whether the vault queues exits',
};

const allocation: FarmPlaybook = {
  check: 'identify whether users deposit through an integrated vault and inspect its curator, mandates and allocation caps',
  action: 'If the docs identify a public vault, preview its shares and consider one small deposit within the stated limits',
  cost: 'Vault principal, approval and deposit fees',
  exit: 'Review changes to allocations and withdrawal liquidity, and test the documented redemption route',
};

const bridge: FarmPlaybook = {
  check: 'verify the source and destination route, settlement delay, asset addresses and refund procedure',
  action: 'If you already need to move funds, quote and test the route with a small transfer you can track',
  cost: 'Transfer capital, quoted bridge fee and gas on both chains',
  exit: 'Save the transfer ID and verify the destination receipt and asset address after settlement',
};

const btc: FarmPlaybook = {
  check: 'review BTC custody, confirmation requirements, asset addresses and the redemption route',
  action: 'Preview a small wrap or mint if a public route is available and its minimum fits your budget',
  cost: 'Optional BTC principal, network and service fees',
  exit: 'Check the quoted cost and time to redeem before sending BTC, then reconcile both chain receipts if you proceed',
};

const staking: FarmPlaybook = {
  check: 'verify eligible staking assets, validator exposure, slashing terms and the unstake queue',
  action: 'If the lockup fits your timeline, preview one small delegation or stake and record the stake or receipt balance',
  cost: 'Stake principal and network fees',
  exit: 'Check the unbonding or redemption delay and set a reminder before committing any additional stake',
};

const restaking: FarmPlaybook = {
  check: 'review supported receipts, operator exposure, slashing terms and all exit queues',
  action: 'If a public route accepts an asset you already hold, preview a small restake and check which operators it exposes you to',
  cost: 'Optional restake principal, approval and network fees',
  exit: 'Check both the restaking withdrawal and the underlying asset redemption, including any separate delays',
};

const liquidity: FarmPlaybook = {
  check: 'inspect the supported pool or position manager, liquidity, fee tier and price range',
  action: 'Preview a small liquidity position in a pair you already hold and check the asset mix and slippage before opening it',
  cost: 'Optional liquidity capital, approvals and network fees',
  exit: 'Check the position range and compare the withdrawal quote against holding the two assets',
};

const eligibility: FarmPlaybook = {
  check: 'verify onboarding, eligible regions or wallet types, custody and whether public participation is available',
  action: 'Use the documented onboarding or demo if available and note which actions require identity checks or funding',
  cost: 'No capital for checking; see the published fees before funding',
  exit: 'Find the documented withdrawal or closure path, including supported destinations and any fees',
};

const byCategory = new Map<string, FarmPlaybook>([
  ['Anchor BTC', btc], ['Decentralized BTC', btc], ['Bridge', bridge], ['Canonical Bridge', bridge],
  ['CeDeFi', eligibility], ['Crypto Card Issuer', eligibility],
  ['Dexs', liquidity], ['Liquidity Manager', liquidity], ['Farm', vault], ['Yield', vault], ['Yield Aggregator', vault],
  ['Lending', lending], ['Collateral Markets', lending],
  ['Liquid Staking', staking], ['Staking Pool', staking], ['Liquid Restaking', restaking], ['Restaking', restaking],
  ['Risk Curators', allocation], ['Onchain Capital Allocator', allocation],
  ['Basis Trading', {
    check: 'look up how the strategy hedges spot exposure, which venues it uses and how it handles funding reversals',
    action: 'Compare the quoted entry and redemption for a small position and use a demo or preview if offered',
    cost: 'No capital for a preview; inspect entry, funding and unwind costs',
    exit: 'Record the funding and redemption conditions under which you would skip or unwind the position',
  }],
  ['CDP', {
    check: 'check accepted collateral, minimum debt, borrowing fees and liquidation rules for a documented vault',
    action: 'Simulate a small collateral and debt position with the official calculator or testnet if either is available',
    cost: 'No mainnet capital for simulation',
    exit: 'Stress the collateral price, then check the repay-and-withdraw route and fees',
  }],
  ['Chain', {
    check: 'confirm the network ID, supported wallet, gas asset and documented public or test network',
    action: 'If an official testnet is available, submit a basic transfer and verify the receipt in its documented explorer',
    cost: 'Testnet gas if available; no mainnet capital for the check',
    exit: 'Record the network ID and receipt, and check the documented withdrawal path before bridging any mainnet funds',
  }],
  ['Derivatives', {
    check: 'review margin requirements, funding, order types and liquidation rules for a supported market',
    action: 'Use paper trading or an order preview if offered and record entry, close and estimated execution costs',
    cost: 'No capital for a preview; live positions require margin and fees',
    exit: 'Verify how to reduce or close the position and withdraw unused margin',
  }],
  ['Dual-Token Stablecoin', {
    check: 'verify the mint and redeem mechanisms, each token’s role and its behavior under a loss of peg',
    action: 'Get a small mint or swap quote and a matching redeem quote if the interface offers both',
    cost: 'No capital for quotes; inspect spread, mint and redemption fees',
    exit: 'Check the available exit liquidity and any redemption limits before funding',
  }],
  ['Governance Incentives', {
    check: 'check which governance positions can vote, when votes are recorded and whether locks are required',
    action: 'If an existing position is eligible, review a live proposal or allocation and use the documented vote flow',
    cost: 'Network fees if a vote is submitted; locks may tie up capital',
    exit: 'Record the vote receipt if submitted and check the next vote, unlock and withdrawal dates',
  }],
  ['Indexes', {
    check: 'review the index holdings, rebalance rules, management fees and available redemption liquidity',
    action: 'Get a small entry quote and verify the underlying exposure and expected receipt before transacting',
    cost: 'No capital for a quote; inspect spread, fees and minimum size',
    exit: 'Check the exit quote, including whether redemption returns one asset or the underlying basket',
  }],
  ['Insurance', {
    check: 'read the covered event, exclusions, expiry and claim evidence requirements',
    action: 'Request a cover quote for exposure you already have if it is eligible',
    cost: 'No capital for a quote; any premium is a direct expense',
    exit: 'Record the policy terms and deadline if you buy cover and set a reminder to review it before expiry',
  }],
  ['Leveraged Farming', {
    check: 'trace the deposited assets, borrowed asset, variable rates and liquidation rules',
    action: 'Preview the lowest supported leverage in a simulator or order form if offered and test a rate increase',
    cost: 'No capital for simulation; live positions add interest, gas and liquidation exposure',
    exit: 'Check the repay-and-close route and see whether it needs a separate balance or transaction',
  }],
  ['Payments', {
    check: 'verify supported assets, transfer routes, recipient requirements and settlement fees',
    action: 'If you have a payment to make and a supported route, preview a small payment and compare the amount received',
    cost: 'Optional payment amount plus quoted processing and network fees',
    exit: 'Verify the settlement receipt and look up the refund or dispute process before repeating',
  }],
  ['Prediction Market', {
    check: 'read the resolution source, settlement rules, eligibility requirements and order book depth',
    action: 'Preview a small order in a market you understand and compare the quoted fill and exit prices',
    cost: 'No capital for a quote; a filled position can lose its stake',
    exit: 'Record the resolution date and check the settlement or early-exit procedure',
  }],
  ['RWA', {
    check: 'verify investor eligibility, custody and the issuer’s subscription and redemption terms',
    action: 'If eligible, request or preview a subscription quote and record its minimum and settlement window',
    cost: 'No capital for checking; subscription minimums and fees may apply',
    exit: 'Confirm redemption windows, holding restrictions and any delay to settlement before subscribing',
  }],
  ['Stablecoin Wrapper', {
    check: 'check the accepted backing asset, conversion rate, redemption limits and any pause conditions',
    action: 'Preview a small wrap and the reverse unwrap if both are exposed by the documented interface',
    cost: 'No capital for a quote; inspect approval, conversion and network fees',
    exit: 'Compare the unwrap amount with the original asset amount and verify whether any delay applies',
  }],
  ['Uncollateralized Lending', {
    check: 'read lender or borrower eligibility, counterparty terms and default and recovery procedures',
    action: 'Review a terms sheet or public market if available and compare the net rate with its maturity and minimum',
    cost: 'No capital for reviewing terms',
    exit: 'Check when principal can be recovered and how late repayments are handled before funding',
  }],
]);

const unclassified: FarmPlaybook = {
  check: 'identify the documented public action and which assets, permissions and fees it requires',
  action: 'Use a documented demo, testnet or transaction preview if offered and record the expected result',
  cost: 'No mainnet capital for a preview',
  exit: 'Confirm how to unwind the action or revoke any approval before putting funds at risk',
};

export function farmSteps(protocol: SnapshotProtocol): string[] {
  const plan = byCategory.get(protocol.category ?? '') ?? unclassified;
  const chain = protocol.chains[0];
  const chainCheck = chain === undefined ? 'confirm a supported chain' : `verify support on ${chain}`;
  return [
    `Find ${protocol.name} through its verified documentation, ${chainCheck}, and ${plan.check}. Cost: none. Time: 5–10 minutes.`,
    `${plan.action}. Continue only if the documented route and quoted costs fit your budget. Cost: ${plan.cost}. Time: 10–20 minutes, plus settlement if applicable.`,
    `${plan.exit}. Cost: none to review; check fees before an exit transaction. Time: 5–15 minutes, plus any waiting period.`,
    'Save any receipt, chain, date and costs. Check official announcements for any published eligibility rules before spending more. Cost: none. Time: 5 minutes.',
  ];
}
