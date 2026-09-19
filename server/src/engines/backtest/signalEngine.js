import Decimal from 'decimal.js';
// State contains only previously consumed candles. No complete dataset enters a rule.
export function createSignalEngine(strategy) {
  const history = [];
  const ema = new Map();
  const priorSma = new Map();
  const periods = [
    ...new Set(
      strategy.all.filter((r) => r.type === 'ema').map((r) => r.period)
    ),
  ];

  const keep = Math.max(
    3,
    ...strategy.all.map((r) => r.slowPeriod || r.period || 0)
  );

  let count = 0;

  return {
    consume(bar) {
      count++;
      history.push(bar);
      if (history.length > keep) history.shift();
      for (const p of periods) {
        const alpha = new Decimal(2).div(p + 1);
        ema.set(
          p,
          ema.has(p)
            ? new Decimal(bar.close)
                .times(alpha)
                .plus(ema.get(p).times(new Decimal(1).minus(alpha)))
            : new Decimal(bar.close)
        );
      }

      let opposite = false;
      const nextSma = new Map();
      const matches = strategy.all.map((rule) => {
        if (rule.type === 'session') return bar.session === rule.value;

        if (rule.type === 'insideBar') {
          const a = history.at(-1 - rule.offset),
            b = history.at(-2 - rule.offset);

          return Boolean(a && b && a.high < b.high && a.low > b.low);
        }
        if (rule.type === 'ema')
          return (
            count >= rule.period &&
            (rule.comparison === 'above'
              ? new Decimal(bar.close).gt(ema.get(rule.period))
              : new Decimal(bar.close).lt(ema.get(rule.period)))
          );

        const key = `${rule.fastPeriod}/${rule.slowPeriod}`;
        const previous = priorSma.get(key);

        if (count < rule.slowPeriod) return false;

        const avg = (p) =>
          history
            .slice(-p)
            .reduce((sum, b) => sum.plus(b.close), new Decimal(0))
            .div(p);

        const difference = avg(rule.fastPeriod).minus(avg(rule.slowPeriod));
        const above =
          previous !== undefined && previous.lte(0) && difference.gt(0);

        const below =
          previous !== undefined && previous.gte(0) && difference.lt(0);

        nextSma.set(key, difference);
        opposite ||= rule.direction === 'above' ? below : above;

        return rule.direction === 'above' ? above : below;
      });

      for (const [key, value] of nextSma) priorSma.set(key, value);
      return {
        enter: matches.every(Boolean),
        exit: strategy.exitOnOppositeCross && opposite,
      };
    },
  };
}
