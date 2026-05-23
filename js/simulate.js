import { cardsForRound, createDeck, dealCards, shuffleDeck } from "./deck.js";
import {
  canPlayCard,
  getTrickWinner,
  removeCardFromHand,
  scoreRound,
} from "./rules.js";
import { chooseBid, chooseCard } from "./ai.js";

const PLAYER_COUNT = 3;

function createRoundStats() {
  return Array.from({ length: PLAYER_COUNT }, () => ({
    bid: null,
    tricksWon: 0,
  }));
}

function simulateMatch() {
  let dealerIndex = PLAYER_COUNT - 1;
  const totals = Array.from({ length: PLAYER_COUNT }, () => ({
    points: 0,
    plumps: 0,
  }));

  for (let roundNumber = 1; roundNumber <= 10; roundNumber += 1) {
    const cardsInRound = cardsForRound(roundNumber);
    const deck = shuffleDeck(createDeck());
    const { hands } = dealCards(deck, PLAYER_COUNT, cardsInRound);
    const roundStats = createRoundStats();

    for (let playerIndex = 0; playerIndex < PLAYER_COUNT; playerIndex += 1) {
      roundStats[playerIndex].bid = chooseBid(hands[playerIndex], cardsInRound);
    }

    let leaderIndex = (dealerIndex + 1) % PLAYER_COUNT;
    let currentPlayerIndex = leaderIndex;
    let trickPlays = [];

    while (hands.some((hand) => hand.length > 0)) {
      const leadSuit = trickPlays[0]?.card.suit ?? null;
      const card = chooseCard(hands[currentPlayerIndex], {
        leadSuit,
        trickPlays,
        leadPlayerIndex: leaderIndex,
        tricksWon: roundStats[currentPlayerIndex].tricksWon,
        bid: roundStats[currentPlayerIndex].bid,
      });

      if (!canPlayCard(hands[currentPlayerIndex], card, leadSuit)) {
        throw new Error(`Illegal AI card in round ${roundNumber}`);
      }

      hands[currentPlayerIndex] = removeCardFromHand(hands[currentPlayerIndex], card.id);
      trickPlays.push({ playerIndex: currentPlayerIndex, card });

      if (trickPlays.length < PLAYER_COUNT) {
        currentPlayerIndex = (currentPlayerIndex + 1) % PLAYER_COUNT;
        continue;
      }

      const winnerIndex = getTrickWinner(trickPlays, leaderIndex);
      roundStats[winnerIndex].tricksWon += 1;
      leaderIndex = winnerIndex;
      currentPlayerIndex = winnerIndex;
      trickPlays = [];
    }

    roundStats.forEach((stats, index) => {
      const result = scoreRound(stats.bid, stats.tricksWon);
      totals[index].points += result.pointsAwarded;
      if (result.gotPlump) {
        totals[index].plumps += 1;
      }
    });

    dealerIndex = (dealerIndex + 1) % PLAYER_COUNT;
  }

  return totals;
}

const result = simulateMatch();
console.log("Simulated match totals:", result);
