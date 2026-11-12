import { BookOpen, Cloud, CloudFog, CloudDrizzle, CloudLightning, CloudMoon, CloudRain, CloudSnow, CloudSun, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CALI_WEATHER_REFRESH_MS, isCurrentCaliWeather, type CaliWeather } from '@/lib/caliWeather';
import LoginMoon from './LoginMoon';
import styles from './login.module.css';
import weatherStyles from './LoginWeather.module.css';

const landscapes = {
  morning: '/login-verse-sunrise.webp',
  midday: '/login-verse-midday.webp',
  night: '/login-verse-night-sky.webp',
  cloudy: '/login-verse-cloudy-day.webp',
  'cloudy-night': '/login-verse-cloudy.webp',
  drizzle: '/login-verse-drizzle-day.webp',
  rain: '/login-verse-rain-day.webp',
  'rain-night': '/login-verse-rain.webp',
};

const nightWeatherLandscapes = {
  cloudy: 'cloudy-night',
  drizzle: 'rain-night',
  rain: 'rain-night',
} as const;

type Landscape = keyof typeof landscapes;
type Scene = { current: Landscape; previous?: Landscape };

const conditions = {
  clear: { label: 'Despejado', icon: Sun, nightIcon: Moon, landscape: undefined },
  partlyCloudy: { label: 'Parcialmente nublado', icon: CloudSun, nightIcon: CloudMoon, landscape: undefined },
  cloudy: { label: 'Nublado', icon: Cloud, landscape: 'cloudy' },
  fog: { label: 'Niebla', icon: CloudFog, landscape: 'cloudy' },
  drizzle: { label: 'Llovizna', icon: CloudDrizzle, landscape: 'drizzle' },
  rain: { label: 'Lluvia', icon: CloudRain, landscape: 'rain' },
  storm: { label: 'Tormenta', icon: CloudLightning, landscape: 'rain' },
  snow: { label: 'Nieve', icon: CloudSnow, landscape: 'cloudy' },
} as const;

const HOUR_MS = 60 * 60 * 1000;
const COLOMBIA_OFFSET_MS = -5 * HOUR_MS;

function useCaliWeather() {
  const [weather, setWeather] = useState<CaliWeather>();

  useEffect(() => {
    let request: AbortController | undefined;
    let timer: number | undefined;
    let nextCheck = 0;

    const refresh = async () => {
      window.clearTimeout(timer);
      if (document.visibilityState !== 'visible' || request) return;
      setWeather(previous => previous && isCurrentCaliWeather(previous.observedAt) ? previous : undefined);
      const now = Date.now();
      if (now < nextCheck) {
        timer = window.setTimeout(refresh, nextCheck - now);
        return;
      }

      nextCheck = now + CALI_WEATHER_REFRESH_MS;
      const controller = new AbortController();
      request = controller;
      try {
        const response = await fetch('/api/login/weather', { signal: controller.signal });
        if (!response.ok) return;
        const result: CaliWeather = await response.json();
        if (!controller.signal.aborted && isCurrentCaliWeather(result.observedAt)) setWeather(result);
      } catch {
        // Weather is optional. The hour-based landscape is always available.
      } finally {
        request = undefined;
        if (!controller.signal.aborted && document.visibilityState === 'visible') {
          timer = window.setTimeout(refresh, Math.max(0, nextCheck - Date.now()));
        }
      }
    };

    void refresh();
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('pageshow', refresh);
    return () => {
      request?.abort();
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('pageshow', refresh);
    };
  }, []);

  return weather;
}

export default function LoginVerseCard() {
  const weather = useCaliWeather();
  const [scene, setScene] = useState<Scene>();
  const condition = weather && conditions[weather.condition];
  const weatherLandscape = condition?.landscape;
  const isNight = scene?.current === 'night' || scene?.current.endsWith('-night');
  const WeatherIcon = condition && isNight && 'nightIcon' in condition ? condition.nightIcon : condition?.icon;

  useEffect(() => {
    let timer: number;
    let requested: Landscape | undefined;
    let disposed = false;

    const updateLandscape = () => {
      window.clearTimeout(timer);
      const now = Date.now();
      const localTime = new Date(now + COLOMBIA_OFFSET_MS);
      const hour = localTime.getUTCHours();
      const period = hour < 6 || hour >= 18 ? 'night' : hour < 12 ? 'morning' : 'midday';
      const landscape = weatherLandscape
        ? period === 'night' ? nightWeatherLandscapes[weatherLandscape] : weatherLandscape
        : period;
      const nextHour = hour < 6 ? 6 : hour < 12 ? 12 : hour < 18 ? 18 : 30;
      const nextBoundary = localTime.setUTCHours(nextHour, 0, 0, 0);
      timer = window.setTimeout(updateLandscape, nextBoundary - now - COLOMBIA_OFFSET_MS);

      if (landscape === requested) return;
      requested = landscape;
      const image = new window.Image();
      image.src = landscapes[landscape];
      void image.decode().then(() => {
        if (disposed || requested !== landscape) return;
        setScene(previous => previous?.current === landscape
          ? previous
          : { current: landscape, previous: previous?.current });
      }).catch(() => {
        if (requested === landscape) requested = undefined;
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
  }, [weatherLandscape]);

  return (
    <blockquote className={styles.verse} aria-label="Versículo">
      <div className={styles.verseLandscape} data-transition={Boolean(scene?.previous)}>
        {scene && [scene.previous, scene.current].map(landscape => landscape && (
          <span
            key={landscape}
            className={landscape.endsWith('-night') ? `${styles.verseLandscapeLayer} ${weatherStyles.night}` : styles.verseLandscapeLayer}
            data-landscape={landscape}
            data-current={landscape === scene.current}
            aria-hidden={landscape !== scene.current}
            style={{ backgroundImage: `url(${landscapes[landscape]})` }}
          >
            {landscape === 'night' && <LoginMoon />}
          </span>
        ))}
      </div>
      <div className={weatherStyles.header}>
        {weather && condition && WeatherIcon && (
          <a
            className={weatherStyles.badge}
            href="https://open-meteo.com/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Cali, ${weather.temperature} grados Celsius. ${condition.label}. Datos de Open-Meteo.`}
            title={`${condition.label} en Cali`}
          >
            <span className={weatherStyles.temperature}>
              <WeatherIcon size={16} strokeWidth={1.65} aria-hidden="true" />
              {weather.temperature}°C
            </span>
            <span className={weatherStyles.source}>Cali</span>
          </a>
        )}
      </div>
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
