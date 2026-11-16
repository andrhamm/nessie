import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderRuntimeContext } from "../../src/agent/runtime-context";
import { type WeatherLocation, WeatherService } from "../../src/services/weather";
import { MdStore } from "../../src/store/store";

let store: MdStore;
let dataDir: string;

const FIXED_NOW = new Date("2026-04-18T14:32:00");
const LOCATION: WeatherLocation = { lat: 47.6, lon: -122.3, label: "Seattle" };

function mockWeather(responses: Array<Record<string, unknown>>): WeatherService {
  let i = 0;
  const fetchFn = (async () => {
    const body = responses[i++] ?? {};
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof fetch;
  return new WeatherService({ fetchFn, ttlMs: 60_000, now: () => FIXED_NOW.getTime() });
}

beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "nessie-rtctx-test-"));
  store = await MdStore.create({ dataDir });

  await store.write(
    "routine.md",
    { updated: "2026-04-18" },
    "After school: snack, homework, free play until 17:30.",
  );
  await store.write(
    "constraints.md",
    { updated: "2026-04-18" },
    "- No scary stories this week\n- Alex needs a bath before bedtime",
  );
  await store.write(
    "profile/SPEAKER_0.md",
    { speaker: "SPEAKER_0", name: "Alex", age: 6 },
    "Alex loves dinosaurs, especially T-Rex.",
  );
  await store.write(
    "memory/mem-dino.md",
    { id: "mem-dino", subject: "speakers/SPEAKER_0" },
    "Alex builds elaborate dinosaur habitats out of Lego.",
  );
});

afterAll(async () => {
  await store.close();
  await rm(dataDir, { recursive: true, force: true });
});

describe("renderRuntimeContext", () => {
  it("returns a well-formed block with date, routine, parent notes, and child summary", async () => {
    const out = await renderRuntimeContext({
      store,
      speakerId: "SPEAKER_0",
      now: FIXED_NOW,
    });

    expect(out).toContain("## Right Now");
    expect(out).toContain("Date: Saturday 18 April 2026");
    expect(out).toContain("Today's routine:");
    expect(out).toContain("After school");
    expect(out).toContain("Parent notes");
    expect(out).toContain("bath before bedtime");
    expect(out).toContain("Known-child summary (Alex, age 6)");
    expect(out).toContain("dinosaur");
  });

  it("includes weather when location + service provided", async () => {
    const weather = mockWeather([
      {
        current: {
          temperature_2m: 12,
          wind_speed_10m: 18,
          weather_code: 61,
          is_day: 1,
        },
      },
    ]);
    const out = await renderRuntimeContext({
      store,
      weather,
      location: LOCATION,
      speakerId: "SPEAKER_0",
      now: FIXED_NOW,
    });
    expect(out).toContain("Weather (Seattle):");
    expect(out).toMatch(/12 °C light rain/);
  });

  it("drops the weather line when the upstream fetch fails", async () => {
    const fetchFn = (async () => new Response("boom", { status: 500 })) as unknown as typeof fetch;
    const weather = new WeatherService({ fetchFn });
    const out = await renderRuntimeContext({
      store,
      weather,
      location: LOCATION,
      speakerId: "SPEAKER_0",
      now: FIXED_NOW,
    });
    expect(out).not.toContain("Weather");
  });

  it("omits child summary when no speaker provided", async () => {
    const out = await renderRuntimeContext({ store, now: FIXED_NOW });
    expect(out).not.toContain("Known-child summary");
  });
});
