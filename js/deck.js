export const SUITS = ["♠", "♥", "♦", "♣"];
export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "K", "D", "Kn", "A"];

const RANK_VALUES = Object.fromEntries(RANKS.map((rank, index) => [rank, index + 2]));

export function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `${rank}-${suit}`,
        rank,
        suit,
        value: RANK_VALUES[rank],
        isRed: suit === "♥" || suit === "♦",
      });
    }
  }
  return deck;
}

export function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function dealCards(deck, playerCount, cardsPerPlayer) {
  const hands = Array.from({ length: playerCount }, () => []);
  const workingDeck = [...deck];

  for (let cardIndex = 0; cardIndex < cardsPerPlayer; cardIndex += 1) {
    for (let playerIndex = 0; playerIndex < playerCount; playerIndex += 1) {
      hands[playerIndex].push(workingDeck.shift());
    }
  }

  hands.forEach((hand) => hand.sort(compareCards));
  return { hands, remaining: workingDeck };
}

export function compareCards(a, b) {
  if (a.suit !== b.suit) {
    return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
  }
  return a.value - b.value;
}

export function cardsForRound(roundNumber) {
  return 11 - roundNumber;
}
