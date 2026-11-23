// The coin toss. The flip uses the browser's secure random generator (not Math.random), so heads and tails are an even
// 50/50 and nobody, including the scorer, can predict or steer the result.
export type CoinSide = "heads" | "tails";

/** One fair flip. `rand` can be replaced in tests; by default it is the device's cryptographic generator. */
export function flipCoin(rand: () => number = secureBit): CoinSide {
  return rand() === 1 ? "heads" : "tails";
}

function secureBit(): number {
  // Rejection sampling over a whole byte keeps the two sides exactly equally likely.
  const a = new Uint8Array(1);
  for (;;) {
    crypto.getRandomValues(a);
    if (a[0]! < 250) return a[0]! % 2;   // 250 is a multiple of 2, so values 250 to 255 are thrown away
  }
}

/** The side that called the toss wins if the coin shows what it called. */
export function tossWinner(caller: 1 | 2, call: CoinSide, result: CoinSide): 1 | 2 {
  return call === result ? caller : caller === 1 ? 2 : 1;
}
