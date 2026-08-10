import { afterEach, describe, expect, it, vi } from "vitest";

import { createWeatherTools } from "@/ai/tools/weather";

describe("getWeather", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("geocodes a location name before fetching the forecast", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          results: [
            { latitude: 35.68, longitude: 139.69, name: "Tokyo", country: "Japan" },
          ],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ current: { temperature_2m: 22 }, daily: {} }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createWeatherTools().getWeather.execute({
      location: "Tokyo",
    });

    expect(result.resolvedLocation).toBe("Tokyo, Japan");
    expect(result.current.temperature_2m).toBe(22);
    const forecastUrl = String(fetchMock.mock.calls[1][0]);
    expect(forecastUrl).toContain("latitude=35.68");
    expect(forecastUrl).toContain("longitude=139.69");
  });

  it("reports a helpful error for unknown locations", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ results: [] })),
    );

    await expect(
      createWeatherTools().getWeather.execute({ location: "Nowhereville" }),
    ).rejects.toThrow(/Could not find a location/);
  });

  it("requires either a location or coordinates", async () => {
    await expect(
      createWeatherTools().getWeather.execute({}),
    ).rejects.toThrow();
  });
});
