/**
 * Minimal ABI for a generic binary (multi-outcome) prediction market.
 * Align fields with your deployed Solidity; adjust as needed.
 */
export const predictionMarketAbi = [
  "function getMarket(bytes32 marketId) view returns (uint256 outcomeCount, bool resolved, uint256 winningOutcome, uint256 endTime)",
  "function createMarket(string question, uint256 endTime, uint256 outcomeCount) returns (bytes32 marketId)",
  "function resolveMarket(bytes32 marketId, uint256 winningOutcome)",
  "function buy(bytes32 marketId, uint256 outcomeIndex, uint256 minShares, uint256 collateralAmount)",
  "function sell(bytes32 marketId, uint256 outcomeIndex, uint256 shareAmount, uint256 minCollateralOut)",
  "function claim(bytes32 marketId)",
  "event MarketCreated(bytes32 indexed marketId, string question, uint256 outcomeCount, uint256 endTime)",
  "event MarketResolved(bytes32 indexed marketId, uint256 winningOutcome)",
  "event Trade(bytes32 indexed marketId, address indexed trader, uint256 outcomeIndex, bool isBuy, uint256 size, uint256 priceBps)",
] as const;
