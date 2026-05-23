import { getLegalCards, getWinningPlay } from "./rules.js";

function estimateBid(hand, cardsInRound) {
  const suitCounts = {};
  hand.forEach((card) => {
    suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
  });

  let estimate = 0;
  hand.forEach((card) => {
    const suitLength = suitCounts[card.suit];
    if (card.rank === "A") {
      estimate += 0.95;
    } else if (card.rank === "K" && suitLength >= 2) {
      estimate += 0.55;
    } else if (card.rank === "D" && suitLength >= 3) {
      estimate += 0.35;
    } else if (card.rank === "Kn" && suitLength >= 4) {
      estimate += 0.2;
    } else if (card.value >= 10 && suitLength >= 4) {
      estimate += 0.15;
    }
  });

  const rounded = Math.round(estimate);
  const noise = Math.random() < 0.35 ? (Math.random() < 0.5 ? -1 : 1) : 0;
  return clamp(rounded + noise, 0, cardsInRound);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function cardBeats(card, other, leadSuit) {
  if (card.suit !== leadSuit) {
    return false;
  }
  if (other.suit !== leadSuit) {
    return true;
  }
  return card.value > other.value;
}

function pickLowest(cards) {
  return [...cards].sort((a, b) => a.value - b.value)[0];
}

function pickHighest(cards) {
  return [...cards].sort((a, b) => b.value - a.value)[0];
}

export function chooseBid(hand, cardsInRound) {
  return estimateBid(hand, cardsInRound);
}

export function chooseCard(hand, context) {
  const {
    leadSuit,
    trickPlays,
    leadPlayerIndex,
    tricksWon,
    bid,
  } = context;

  const legalCards = getLegalCards(hand, leadSuit);
  if (legalCards.length === 1) {
    return legalCards[0];
  }

  const remainingNeeded = bid - tricksWon;

  if (trickPlays.length === 0) {
    if (remainingNeeded > 0) {
      return pickHighest(legalCards);
    }
    return pickLowest(legalCards);
  }

  const { winningPlay } = getWinningPlay(trickPlays, leadPlayerIndex);
  const winningCard = winningPlay.card;
  const winningCards = legalCards.filter((card) => cardBeats(card, winningCard, leadSuit));
  const losingCards = legalCards.filter((card) => !cardBeats(card, winningCard, leadSuit));

  if (remainingNeeded > 0) {
    if (winningCards.length > 0) {
      return pickLowest(winningCards);
    }
    return pickHighest(legalCards);
  }

  if (remainingNeeded === 0) {
    if (losingCards.length > 0) {
      return pickHighest(losingCards);
    }
    return pickLowest(legalCards);
  }

  if (losingCards.length > 0) {
    return pickHighest(losingCards);
  }
  return pickLowest(legalCards);
}

export function shouldUseLaser(context) {
  const { playerIndex, projectedWinner, tricksWon, bid, trickSize } = context;

  if (projectedWinner === playerIndex) {
    return false;
  }

  const remainingNeeded = bid - tricksWon;
  if (remainingNeeded <= 0) {
    return false;
  }

  if (trickSize < 2) {
    return false;
  }

  return Math.random() < 0.72;
}
