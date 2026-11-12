import { z } from 'zod';
import { getWeatherCondition, isCurrentCaliWeather, type CaliWeather } from '@/lib/caliWeather';

const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
forecastUrl.search = new URLSearchParams({
  latitude: '3.4372',
  longitude: '-76.5225',
  timezone: 'America/Bogota',
  temperature_unit: 'celsius',
  timeformat: 'unixtime',
  current: 'temperature_2m,weather_code,precipitation',
}).toString();

const forecastSchema = z.object({
  current: z.object({
    temperature_2m: z.number().finite(),
    weather_code: z.number().int(),
    precipitation: z.number().finite().nonnegative(),
    time: z.number().int(),
  }),
});

export async function GET() {
  try {
    const response = await fetch(forecastUrl, {
      cache: 'no-store',
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) throw new Error('Weather provider unavailable');
    const { current } = forecastSchema.parse(await response.json());
    const observedAt = current.time * 1000;
    if (!isCurrentCaliWeather(observedAt)) throw new Error('Weather snapshot out of date');

    return Response.json({
      temperature: Math.round(current.temperature_2m),
      condition: getWeatherCondition(current.weather_code, current.precipitation),
      observedAt,
    } satisfies CaliWeather, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' },
    });
  } catch {
    return Response.json({ weather: null }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
