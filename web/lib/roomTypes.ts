export type RoomPot = {
  potId: string;
  matchId: string | null;
  condition: string | null;
  payoutRecipient: string | null;
  createdBy: string | null;
  confirmedResultHash: string | null;
  disputeOpen: boolean;
};

export type RoomProposal = {
  potId: string;
  creator: string;
  eventNumber: number;
  evidenceType: string;
  evidenceHash: string;
  model: string | null;
  parserDevice: string;
  parsedResult: Record<string, unknown> | null;
  resultHash: string;
};

export type RoomReceipt = {
  potId: string;
  txHash: string;
  chain: string;
  finalAmount: string;
  recipient: string;
};

export type RoomCup = { cupId: string; name: string | null; createdBy: string | null; teams: string[] };
export type RoomFixture = {
  fixtureId: string;
  home: string;
  away: string;
  potId: string | null;
  result: { homeScore: number; awayScore: number } | null;
};
