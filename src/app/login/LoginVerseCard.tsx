import { BookOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import styles from './login.module.css';

const landscapes = {
  morning: '/login-verse-sunrise.webp',
  midday: '/login-verse-midday.webp',
  night: '/login-verse-night.webp',
};

type Period = keyof typeof landscapes;
type Scene = { current: Period; previous?: Period };

const HOUR_MS = 60 * 60 * 1000;
const COLOMBIA_OFFSET_MS = -5 * HOUR_MS;

export default function LoginVerseCard() {
  const [scene, setScene] = useState<Scene>();

  useEffect(() => {
    let timer: number;
    let requested: Period | undefined;
    let disposed = false;

    const updateLandscape = () => {
      window.clearTimeout(timer);
      const now = Date.now();
      const localTime = new Date(now + COLOMBIA_OFFSET_MS);
      const hour = localTime.getUTCHours();
      const period = hour < 6 || hour >= 18 ? 'night' : hour < 12 ? 'morning' : 'midday';
      const nextHour = hour < 6 ? 6 : hour < 12 ? 12 : hour < 18 ? 18 : 30;
      const nextBoundary = localTime.setUTCHours(nextHour, 0, 0, 0);
      timer = window.setTimeout(updateLandscape, nextBoundary - now - COLOMBIA_OFFSET_MS);

      if (period === requested) return;
      requested = period;
      const image = new window.Image();
      image.src = landscapes[period];
      void image.decode().then(() => {
        if (disposed || requested !== period) return;
        setScene(previous => previous?.current === period
          ? previous
          : { current: period, previous: previous?.current });
      }).catch(() => {
        if (requested === period) requested = undefined;
      });
    };

    const updateWhenVisible = () => {
      if (document.visibilityState === 'visible') updateLandscape();
    };
    updateLandscape();
    document.addEventListener('visibilitychange', updateWhenVisible);
    window.addEventListener('pageshow', updateWhenVisible);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', updateWhenVisible);
      window.removeEventListener('pageshow', updateWhenVisible);
    };
  }, []);

  return (
    <blockquote className={styles.verse} aria-label="Versículo">
      <div className={styles.verseLandscape} data-transition={Boolean(scene?.previous)} aria-hidden="true">
        {scene && [scene.previous, scene.current].map(period => period && (
          <span
            key={period}
            className={styles.verseLandscapeLayer}
            data-landscape={period}
            data-current={period === scene.current}
            style={{ backgroundImage: `url(${landscapes[period]})` }}
          />
        ))}
      </div>
      <div className={styles.verseEmblem} aria-hidden="true"><span><BookOpen size={21} strokeWidth={1.6} /></span></div>
      <div className={styles.verseReading}>
        <p className={styles.verseText}>
          <span aria-hidden="true">“</span>El hombre planea su futuro, pero Dios le marca el rumbo.<span aria-hidden="true">”</span>
        </p>
        <svg className={styles.verseFlourish} width="140" height="12" viewBox="0 0 140 12" aria-hidden="true"><path d="M0 11C39 0 96-3 140 7 91 2 40 6 0 11Z" fill="currentColor" /></svg>
      </div>
      <cite><BookOpen size={16} strokeWidth={1.7} aria-hidden="true" />Proverbios 16:9 · TLA</cite>
    </blockquote>
  );
}
