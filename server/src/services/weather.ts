/**
 * Weather service backed by Open-Meteo (https://open-meteo.com). No API key
 * required, fully local/home-friendly. We cache snapshots for 15 minutes
 * keyed on `(lat, lon, hour)` so the prompt doesn't pay for every turn.
 */

export interface WeatherLocation {
  lat: number;
  lon: number;
  /** Human-readable label — used when the agent describes the location. */
  label?: string;
}

export interface WeatherSnapshot {
  temperature_c: number;
  condition: string;
  wind_kph: number;
  is_day: boolean;
}

export interface HourlyForecast {
  time: string;
  temperature_c: number;
  precipitation_mm: number;
  condition: string;
}

export interface WeatherDetail {
  snapshot: WeatherSnapshot;
  hourly: HourlyForecast[];
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

// WMO weather interpretation codes, simplified to one-word labels.
// https://open-meteo.com/en/docs (weather_code table)
const CODE_LABELS: Record<number, string> = {
  0: "clear",
  1: "mostly clear",
  2: "partly cloudy",
  3: "cloudy",
  45: "fog",
  48: "fog",
  51: "light drizzle",
  53: "drizzle",
  55: "heavy drizzle",
  61: "light rain",
  63: "rain",
  65: "heavy rain",
  71: "light snow",
  73: "snow",
  75: "heavy snow",
  80: "showers",
  81: "showers",
  82: "heavy showers",
  95: "thunderstorm",
  96: "thunderstorm with hail",
  99: "thunderstorm with hail",
};

function codeLabel(code: number): string {
  return CODE_LABELS[code] ?? `code-${code}`;
}

export interface WeatherServiceOptions {
  baseUrl?: string;
  ttlMs?: number;
  fetchFn?: typeof fetch;
  now?: () => number;
}

export class WeatherService {
  private readonly baseUrl: string;
  private readonly ttlMs: number;
  private readonly fetchFn: typeof fetch;
  private readonly now: () => number;
  private readonly snapshotCache = new Map<string, CacheEntry<WeatherSnapshot>>();
  private readonly detailCache = new Map<string, CacheEntry<WeatherDetail>>();

  constructor(options: WeatherServiceOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "https://api.open-meteo.com/v1").replace(/\/$/, "");
    this.ttlMs = options.ttlMs ?? 15 * 60 * 1000;
    this.fetchFn = options.fetchFn ?? fetch;
    this.now = options.now ?? (() => Date.now());
  }

  private key(loc: WeatherLocation): string {
    return `${loc.lat.toFixed(3)},${loc.lon.toFixed(3)}`;
  }

  /**
   * A short dict suitable for prompt injection. Returns `null` if the
   * upstream call fails (the runtime-context renderer then omits the line).
   */
  async snapshot(loc: WeatherLocation): Promise<WeatherSnapshot | null> {
    const cached = this.snapshotCache.get(this.key(loc));
    if (cached && cached.expiresAt > this.now()) return cached.value;

    const url =
      `${this.baseUrl}/forecast` +
      `?latitude=${loc.lat}&longitude=${loc.lon}` +
      `&current=temperature_2m,wind_speed_10m,weather_code,is_day` +
      `&wind_speed_unit=kmh`;
    let res: Response;
    try {
      res = await this.fetchFn(url);
    } catch {
      return null;
    }
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as {
      current?: {
        temperature_2m: number;
        wind_speed_10m: number;
        weather_code: number;
        is_day: number;
      };
    } | null;
    if (!body?.current) return null;
    const snap: WeatherSnapshot = {
      temperature_c: body.current.temperature_2m,
      wind_kph: body.current.wind_speed_10m,
      condition: codeLabel(body.current.weather_code),
      is_day: body.current.is_day === 1,
    };
    this.snapshotCache.set(this.key(loc), {
      value: snap,
      expiresAt: this.now() + this.ttlMs,
    });
    return snap;
  }

  /**
   * Today + tomorrow hourly detail, used by Nessie's `get_weather_detail`
   * tool for "is it going to rain later?" style questions.
   */
  async detail(loc: WeatherLocation): Promise<WeatherDetail | null> {
    const cached = this.detailCache.get(this.key(loc));
    if (cached && cached.expiresAt > this.now()) return cached.value;

    const snap = await this.snapshot(loc);
    if (!snap) return null;
    const url =
      `${this.baseUrl}/forecast` +
      `?latitude=${loc.lat}&longitude=${loc.lon}` +
      `&hourly=temperature_2m,precipitation,weather_code` +
      `&forecast_days=2`;
    let res: Response;
    try {
      res = await this.fetchFn(url);
    } catch {
      return null;
    }
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as {
      hourly?: {
        time: string[];
        temperature_2m: number[];
        precipitation: number[];
        weather_code: number[];
      };
    } | null;
    if (!body?.hourly) return null;
    const hourly: HourlyForecast[] = body.hourly.time.map((t, i) => ({
      time: t,
      temperature_c: body.hourly?.temperature_2m[i] ?? Number.NaN,
      precipitation_mm: body.hourly?.precipitation[i] ?? 0,
      condition: codeLabel(body.hourly?.weather_code[i] ?? 0),
    }));
    const detail: WeatherDetail = { snapshot: snap, hourly };
    this.detailCache.set(this.key(loc), {
      value: detail,
      expiresAt: this.now() + this.ttlMs,
    });
    return detail;
  }
}
