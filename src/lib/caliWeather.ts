export type WeatherCondition = 'clear' | 'partlyCloudy' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'storm' | 'snow';

export type CaliWeather = {
  temperature: number;
  condition: WeatherCondition;
  observedAt: number;
};

export const CALI_WEATHER_REFRESH_MS = 5 * 60_000;
const MAX_WEATHER_AGE_MS = 45 * 60_000;

export function isCurrentCaliWeather(observedAt: number) {
  const age = Date.now() - observedAt;
  return age >= -60_000 && age < MAX_WEATHER_AGE_MS;
}

export function getWeatherCondition(code: number, precipitation: number): WeatherCondition {
  // Open-Meteo's WMO codes distinguish fog, drizzle, rain, snow and storms.
  if (code >= 95) return 'storm';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 51 && code <= 57) || precipitation >= 0.1) return 'drizzle';
  if (code === 45 || code === 48) return 'fog';
  if (code === 3) return 'cloudy';
  if (code === 2) return 'partlyCloudy';
  return 'clear';
}
