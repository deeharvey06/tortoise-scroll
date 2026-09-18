import Decimal from 'decimal.js';

// Explicit conventions: EMA seeds with first visible close. VWAP uses typical
// price (H+L+C)/3 and resets by tradingDate; unknown volume invalidates that day.
export function computeIndicators(candles, period = 20) {
  if (!Number.isInteger(period) || period < 1 || period > 200)
    throw new Error('EMA period must be 1–200');
  const alpha = new Decimal(2).div(period + 1);
  let ema;
  let date;
  let weighted = new Decimal(0);
  let volume = new Decimal(0);
  let unknown = false;
  let high = null;
  let low = null;
  const series = candles.map((bar) => {
    if (bar.tradingDate !== date) {
      date = bar.tradingDate;
      weighted = new Decimal(0);
      volume = new Decimal(0);
      unknown = false;
      high = null;
      low = null;
    }
    ema =
      ema === undefined
        ? new Decimal(bar.close)
        : new Decimal(bar.close)
            .times(alpha)
            .plus(ema.times(new Decimal(1).minus(alpha)));
    high = high === null ? bar.high : Math.max(high, bar.high);
    low = low === null ? bar.low : Math.min(low, bar.low);
    if (bar.volume === null) unknown = true;
    else {
      weighted = weighted.plus(
        new Decimal(bar.high)
          .plus(bar.low)
          .plus(bar.close)
          .div(3)
          .times(bar.volume)
      );
      volume = volume.plus(bar.volume);
    }
    return {
      timestamp: bar.timestamp,
      ema: ema.toNumber(),
      vwap: unknown || volume.isZero() ? null : weighted.div(volume).toNumber(),
    };
  });
  return {
    series,
    sessionHigh: high,
    sessionLow: low,
    tradingDate: date || null,
    vwapUnavailable: unknown || volume.isZero(),
  };
}
