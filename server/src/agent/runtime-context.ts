import type { WeatherLocation, WeatherService, WeatherSnapshot } from "../services/weather";
import type { MdStore } from "../store/store";

export interface RuntimeContextOptions {
  store: MdStore;
  weather?: WeatherService;
  now?: Date;
  /** Speaker id to pull the known-child summary for. */
  speakerId?: string;
  /** Weather location; omitted → weather line is dropped. */
  location?: WeatherLocation;
  /** Cap the runtime-context block size (chars). Defaults to 3000. */
  maxChars?: number;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatDate(d: Date): string {
  const day = DAY_NAMES[d.getDay()] ?? "";
  const month = MONTH_NAMES[d.getMonth()] ?? "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${d.getDate()} ${month} ${d.getFullYear()}, ${hh}:${mm} local`;
}

function formatWeather(s: WeatherSnapshot | null | undefined): string | null {
  if (!s) return null;
  const t = `${Math.round(s.temperature_c)} °C`;
  const w = s.wind_kph >= 15 ? `, wind ${Math.round(s.wind_kph)} km/h` : "";
  return `${t} ${s.condition}${w}`;
}

function truncateBullets(source: string, maxChars: number): string {
  if (source.length <= maxChars) return source;
  const capped = source.slice(0, maxChars);
  const lastNewline = capped.lastIndexOf("\n");
  return lastNewline > 0 ? capped.slice(0, lastNewline) : capped;
}

/**
 * Render the "## Right Now" block appended to Nessie's system prompt each
 * turn. Pure function: no side effects, suitable for snapshot tests.
 *
 * Included lines (each skipped when empty):
 * - Current date + day of week + local clock
 * - Weather snapshot (if `location` + `weather` provided and fetch succeeds)
 * - Today's routine excerpt (whole `routine.md` body, space-permitting)
 * - Parent notes from `constraints.md`
 * - Known-child summary (name, age from profile) + up to 5 memory snippets
 */
export async function renderRuntimeContext(opts: RuntimeContextOptions): Promise<string> {
  const now = opts.now ?? new Date();
  const maxChars = opts.maxChars ?? 3000;
  const lines: string[] = ["## Right Now", `Date: ${formatDate(now)}`];

  if (opts.weather && opts.location) {
    const snap = await opts.weather.snapshot(opts.location).catch(() => null);
    const line = formatWeather(snap);
    if (line) {
      const label = opts.location.label ? ` (${opts.location.label})` : "";
      lines.push(`Weather${label}: ${line}`);
    }
  }

  const routine = await opts.store.read("routine", "routine").catch(() => null);
  if (routine?.body.trim()) {
    lines.push(`Today's routine:\n${routine.body.trim()}`);
  }

  const constraints = await opts.store.read("constraint", "constraints").catch(() => null);
  if (constraints?.body.trim()) {
    lines.push(`Parent notes (until further notice):\n${constraints.body.trim()}`);
  }

  if (opts.speakerId) {
    const profile = await opts.store.read("profile", opts.speakerId).catch(() => null);
    const name = (profile?.frontmatter.name as string | undefined) ?? opts.speakerId;
    const age = profile?.frontmatter.age as number | undefined;
    const label = age ? `${name}, age ${age}` : name;
    const memories = await opts.store
      .list("memory", { frontmatter: { subject: `speakers/${opts.speakerId}` }, limit: 5 })
      .catch(() => []);
    const summaryLines = [`Known-child summary (${label}):`];
    if (profile?.body.trim()) summaryLines.push(`  - ${profile.body.trim().split("\n")[0]}`);
    for (const m of memories) {
      const first = m.body.trim().split("\n")[0];
      if (first) summaryLines.push(`  - ${first}`);
    }
    if (summaryLines.length > 1) lines.push(summaryLines.join("\n"));
  }

  return truncateBullets(lines.join("\n\n"), maxChars);
}
