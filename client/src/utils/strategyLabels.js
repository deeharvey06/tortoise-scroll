export function withStrategyLabels(data, strategies) {
  const names = new Map(
    strategies.map((strategy) => [String(strategy._id), strategy.name])
  );

  return {
    ...data,
    byStrategy: (data.byStrategy ?? []).map((row) => ({
      ...row,
      label: names.get(String(row.key)) || 'Unresolved strategy',
    })),
  };
}
