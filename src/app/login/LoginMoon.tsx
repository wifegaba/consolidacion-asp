import { useEffect, useState } from 'react';
import styles from './LoginMoon.module.css';

const COLOMBIA_OFFSET_HOURS = -5;
const PRIMARY_PHASES = ['Luna nueva', 'Cuarto creciente', 'Luna llena', 'Cuarto menguante'];
const INTERMEDIATE_PHASES = ['Luna creciente', 'Luna gibosa creciente', 'Luna gibosa menguante', 'Luna menguante'];
const percent = new Intl.NumberFormat('es-CO', { style: 'percent' });

type LunarPhase = {
  name: string;
  fraction: number;
  waxing: boolean;
};

function illuminatedDisk(fraction: number, waxing: boolean) {
  const side = waxing ? 1 : -1;
  const segments = 24;
  const arc = Array.from({ length: segments + 1 }, (_, index) => {
    const angle = Math.PI * index / segments;
    return { x: 50 * side * Math.sin(angle), y: 50 - 50 * Math.cos(angle) };
  });
  const edge = arc.map(({ x, y }) => `${(50 + x).toFixed(2)}% ${y.toFixed(2)}%`);
  // Project the curved boundary between sunlight and shadow onto the lunar disk.
  const terminator = arc.reverse().map(({ x, y }) =>
    `${(50 + x * (1 - 2 * fraction)).toFixed(2)}% ${y.toFixed(2)}%`);
  return `polygon(${[...edge, ...terminator].join(',')})`;
}

export default function LoginMoon() {
  const [phase, setPhase] = useState<LunarPhase>();

  useEffect(() => {
    let disposed = false;
    let timer: number | undefined;
    let update: (() => void) | undefined;

    void import('astronomy-engine').then(({ Body, Illumination, MoonPhase, SearchMoonQuarter }) => {
      if (disposed) return;
      update = () => {
        if (document.visibilityState !== 'visible') return;
        const now = new Date();
        const localDay = new Date(now.getTime() + COLOMBIA_OFFSET_HOURS * 3_600_000);
        const dayStart = new Date(localDay.setUTCHours(-COLOMBIA_OFFSET_HOURS, 0, 0, 0));
        const nextQuarter = SearchMoonQuarter(dayStart);
        const quarterIsToday = nextQuarter.time.date.getTime() - dayStart.getTime() < 86_400_000;
        const angle = MoonPhase(now);

        setPhase({
          name: quarterIsToday ? PRIMARY_PHASES[nextQuarter.quarter] : INTERMEDIATE_PHASES[Math.floor(angle / 90)],
          fraction: Illumination(Body.Moon, now).phase_fraction,
          waxing: angle < 180,
        });
      };
      update();
      timer = window.setInterval(update, 5 * 60_000);
    }).catch(() => {
      // The night landscape can still render if the ephemeris chunk fails to load.
    });

    const refresh = () => update?.();
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('pageshow', refresh);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('pageshow', refresh);
    };
  }, []);

  if (!phase) return null;

  return (
    <span className={styles.moon} role="img" aria-label={`${phase.name}, ${percent.format(phase.fraction)} de iluminación`}>
      {phase.fraction >= .008 && (
        <span className={styles.disk}>
          <span className={styles.light} style={{ clipPath: illuminatedDisk(phase.fraction, phase.waxing) }} />
        </span>
      )}
    </span>
  );
}
