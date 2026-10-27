import type { CSSProperties } from 'react';

// Each character is one pixel. "." is transparent and "F" uses the current text color.
const palette: Record<string, string> = {
  K: '#15101f',
  T: '#e8432e',
  C: '#fff4de',
  Y: '#ffd23f',
  F: 'currentColor',
};

const maps = {
  tv: [
    '...Y....Y...',
    '....K..K....',
    'KKKKKKKKKKKK',
    'KTTTTTTTTTTK',
    'KTKKKKKKKKTK',
    'KTKCCCCCCKTK',
    'KTKCKCCKCKTK',
    'KTKCCCCCCKTK',
    'KTKKKKKKKKTK',
    'KTTTTTTTTTTK',
    'KKKKKKKKKKKK',
    '.KK......KK.',
  ],
  star: ['...Y...', '...Y...', '..YYY..', 'YYYYYYY', '..YYY..', '...Y...', '...Y...'],
  cursor: [
    'K.........',
    'KK........',
    'KCK.......',
    'KCCK......',
    'KCCCK.....',
    'KCCCCK....',
    'KCCCCCK...',
    'KCCCCCCK..',
    'KCCCCCCCK.',
    'KCCCCKKKKK',
    'KCCKCK....',
    'KCK.KCK...',
    'KK..KCK...',
    '.....KK...',
  ],
  github: [
    '....FFFFFFFF....',
    '..FFFFFFFFFFFF..',
    '.FFFFFFFFFFFFFF.',
    '.FFF.FFFFFF.FFF.',
    'FFFF..FFFF..FFFF',
    'FFF..........FFF',
    'FFF..........FFF',
    'FFF..........FFF',
    'FFF..........FFF',
    'FFFF........FFFF',
    '.FFFF......FFFF.',
    '.F..FF....FFFFF.',
    '..F..F....FFFF..',
    '...FF.....FFF...',
    '.....F....F.....',
    '......FFFF......',
  ],
} as const;

export type SpriteName = keyof typeof maps;

type Run = { x: number; y: number; width: number; fill: string };

function toRuns(rows: readonly string[]): Run[] {
  const runs: Run[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const fill = palette[row[x] ?? '.'];
      if (!fill) {
        x += 1;
        continue;
      }
      let end = x;
      while (row[end] === row[x]) end += 1;
      runs.push({ x, y, width: end - x, fill });
      x = end;
    }
  });
  return runs;
}

interface PixelSpriteProps {
  name: SpriteName;
  size: number;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

export function PixelSprite({ name, size, label, className, style }: PixelSpriteProps) {
  const rows = maps[name];
  const width = rows[0].length;
  const height = rows.length;
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={(size * height) / width}
      viewBox={`0 0 ${width} ${height}`}
      shapeRendering="crispEdges"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {toRuns(rows).map((run) => (
        <rect
          key={`${run.x}-${run.y}`}
          x={run.x}
          y={run.y}
          width={run.width}
          height={1}
          fill={run.fill}
        />
      ))}
    </svg>
  );
}
