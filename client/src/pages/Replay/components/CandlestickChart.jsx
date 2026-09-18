import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

// Presentation receives only the server's already revealed prefix. Its axes,
// tooltips, indicators and captured SVG cannot reference unrevealed candles.
export default function CandlestickChart({
  view,
  showEMA,
  showVWAP,
  showHistory,
  svgRef,
  onPoint,
}) {
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('sm'));
  const canvasWidth = compact ? 480 : 1000;
  const bars = view.candles.slice(-120);
  const offset = view.candles.length - bars.length;
  const lines = view.events.filter((event) => event.kind === 'line');
  const values = bars.flatMap((bar) => [bar.high, bar.low]);
  lines.forEach((line) => values.push(line.price, line.endPrice ?? line.price));
  const series = view.indicators.series.slice(-120);
  series.forEach((point) => {
    if (showEMA) values.push(point.ema);
    if (showVWAP && point.vwap !== null) values.push(point.vwap);
  });

  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const span = max - min || Math.max(Math.abs(max) * 0.01, 1);
  const bottom = min - span * 0.1;
  const top = max + span * 0.1;
  const left = 16;
  const width = canvasWidth - 100;
  const height = 320;
  const x = (index) =>
    left + ((index + 0.5) / Math.max(bars.length, 1)) * width;

  const y = (price) => 24 + ((top - price) / (top - bottom)) * height;
  const maxVolume = Math.max(1, ...bars.map((bar) => bar.volume || 0));
  const up = theme.palette.success.main;
  const down = theme.palette.error.main;
  const text = theme.palette.text.secondary;
  const stamp = (value) =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: view.dataset.timezone,
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZoneName: 'short',
    }).format(new Date(value));

  const path = (key) =>
    series
      .map((point, index) =>
        point[key] === null
          ? ''
          : `${index === 0 || series[index - 1][key] === null ? 'M' : 'L'}${x(index)},${y(point[key])}`
      )
      .join(' ');

  return (
    <svg
      ref={svgRef}
      xmlns='http://www.w3.org/2000/svg'
      viewBox={`0 0 ${canvasWidth} 440`}
      role='img'
      aria-label='Revealed market candles'
      style={{ width: '100%', display: 'block', minHeight: 240 }}
      onClick={(event) => {
        if (!bars.length || !onPoint) return;
        const svg = event.currentTarget;
        const matrix = svg.getScreenCTM();
        if (!matrix) return;
        const pointer = svg.createSVGPoint();
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        const { x: px, y: py } = pointer.matrixTransform(matrix.inverse());
        if (px < left || px > left + width || py < 24 || py > 344) return;
        onPoint({
          cursor:
            offset +
            Math.min(
              bars.length - 1,
              Math.floor(((px - left) / width) * bars.length)
            ),
          price: top - ((py - 24) / height) * (top - bottom),
        });
      }}
    >
      <rect
        width={canvasWidth}
        height='440'
        fill={theme.palette.background.paper}
      />
      <text x='16' y='16' fill={text} fontSize='12'>
        {view.marketRequest.symbol} · {view.marketRequest.timeframe} · closed
        bars only
      </text>
      {Array.from({ length: 5 }, (_, index) => {
        const price = bottom + ((top - bottom) * index) / 4;
        return (
          <g key={index}>
            <line
              x1={left}
              x2={left + width + 4}
              y1={y(price)}
              y2={y(price)}
              stroke={theme.palette.divider}
            />
            <text
              x={left + width + 10}
              y={y(price) + 4}
              fill={text}
              fontSize='11'
            >
              {price.toLocaleString('en-US', { maximumFractionDigits: 4 })}
            </text>
          </g>
        );
      })}
      {bars.map((bar, index) => {
        const color = bar.close >= bar.open ? up : down;
        const body = Math.max(1, Math.abs(y(bar.open) - y(bar.close)));
        return (
          <g
            key={bar.timestamp}
            data-testid='replay-candle'
            data-timestamp={bar.timestamp}
          >
            <title>{`${stamp(bar.timestamp)} — O ${bar.open} H ${bar.high} L ${bar.low} C ${bar.close} V ${bar.volume ?? 'unknown'}`}</title>
            <line
              x1={x(index)}
              x2={x(index)}
              y1={y(bar.high)}
              y2={y(bar.low)}
              stroke={color}
            />
            <rect
              x={x(index) - Math.min(9, (width / bars.length) * 0.32)}
              y={Math.min(y(bar.open), y(bar.close))}
              width={Math.min(18, (width / bars.length) * 0.64)}
              height={body}
              fill={color}
            />
            <rect
              x={x(index) - 2}
              y={
                395 - (bar.volume === null ? 0 : (bar.volume / maxVolume) * 35)
              }
              width='4'
              height={bar.volume === null ? 0 : (bar.volume / maxVolume) * 35}
              fill={color}
              opacity='0.5'
            />
          </g>
        );
      })}
      {showEMA && (
        <path
          d={path('ema')}
          fill='none'
          stroke={theme.palette.warning.main}
          strokeWidth='1.7'
        />
      )}
      {showVWAP && (
        <path
          d={path('vwap')}
          fill='none'
          stroke={theme.palette.info.main}
          strokeWidth='1.7'
        />
      )}
      {lines.map((line) => (
        <g key={line._id}>
          <line
            x1={
              line.lineType === 'trend'
                ? x(Math.max(0, line.startCursor - offset))
                : left
            }
            x2={
              line.lineType === 'trend'
                ? x(Math.max(0, (line.endCursor ?? line.cursor) - offset))
                : left + width + 4
            }
            y1={y(line.price)}
            y2={y(line.endPrice ?? line.price)}
            stroke={
              line.lineType === 'stop'
                ? down
                : line.lineType === 'target'
                  ? up
                  : theme.palette.primary.main
            }
            strokeDasharray={line.lineType === 'trend' ? undefined : '5 4'}
            strokeWidth='1.5'
          />
          <text x='22' y={y(line.price) - 4} fill={text} fontSize='11'>
            {line.lineType}: {line.text || line.price}
          </text>
        </g>
      ))}
      {showHistory &&
        view.markers.map((marker, index) => {
          const barIndex = bars.findIndex(
            (bar) =>
              marker.timestamp >= bar.timestamp &&
              marker.timestamp <= bar.endTimestamp
          );
          if (barIndex < 0) return null;
          const px = x(barIndex);
          const py = y(marker.price);
          return (
            <g key={`${marker.tradeId}-${index}`} data-testid='replay-marker'>
              <title>{`${marker.kind}: ${marker.side} ${marker.quantity} @ ${marker.price} · ${stamp(marker.timestamp)}`}</title>
              <circle
                cx={px}
                cy={py}
                r='5'
                fill={theme.palette.background.paper}
                stroke={marker.side === 'buy' ? up : down}
                strokeWidth='2'
              />
              <text x={px + 6} y={py - 6} fontSize='10' fill={text}>
                {{ entry: 'E', exit: 'X', 'scale-in': '+', 'scale-out': '−' }[
                  marker.kind
                ] || 'F'}
              </text>
            </g>
          );
        })}
      {bars.length ? (
        (compact
          ? [0, bars.length - 1]
          : [0, Math.floor((bars.length - 1) / 2), bars.length - 1]
        )
          .filter((item, index, list) => list.indexOf(item) === index)
          .map((index) => (
            <text
              key={index}
              x={x(index)}
              y='420'
              textAnchor={
                index === 0
                  ? 'start'
                  : index === bars.length - 1
                    ? 'end'
                    : 'middle'
              }
              fill={text}
              fontSize={compact ? 13 : 11}
            >
              {stamp(bars[index].timestamp)}
            </text>
          ))
      ) : (
        <text x={canvasWidth / 2} y='200' textAnchor='middle' fill={text}>
          Step forward to reveal the first completed candle
        </text>
      )}
    </svg>
  );
}
