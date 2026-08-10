import { z } from "zod";

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

const geocodingSchema = z.object({
  results: z
    .array(
      z.object({
        latitude: z.number(),
        longitude: z.number(),
        name: z.string(),
        country: z.string().optional(),
        admin1: z.string().optional(),
      }),
    )
    .optional(),
});

async function geocodeLocation(location: string) {
  const response = await fetch(
    `${GEOCODING_URL}?name=${encodeURIComponent(location)}&count=1&language=en&format=json`,
    { signal: AbortSignal.timeout(10_000) },
  );
  if (!response.ok) {
    throw new Error("Weather location lookup failed. Try again or provide latitude/longitude.");
  }
  const parsed = geocodingSchema.safeParse(await response.json());
  const first = parsed.success ? parsed.data.results?.[0] : undefined;
  if (!first) {
    throw new Error(
      `Could not find a location named "${location}". Try a more specific name (e.g. "Manila, Philippines") or provide latitude/longitude.`,
    );
  }
  const region = [first.admin1, first.country].filter(Boolean).join(", ");
  return {
    latitude: first.latitude,
    longitude: first.longitude,
    name: region ? `${first.name}, ${region}` : first.name,
  };
}

export function createWeatherTools() {
  return {
    getWeather: {
      description:
        "Get the current weather and today's forecast for a location. Provide a city or place name (e.g. \"Tokyo\" or \"New York, NY\"), or exact latitude/longitude coordinates.",
      inputSchema: z
        .object({
          location: z
            .string()
            .trim()
            .min(1)
            .max(200)
            .describe("City or place name, e.g. \"Tokyo\" or \"Manila\"")
            .optional(),
          latitude: z.number().describe("Latitude coordinate").optional(),
          longitude: z.number().describe("Longitude coordinate").optional(),
        })
        .refine(
          (value) =>
            Boolean(value.location) !== Boolean(value.latitude != null && value.longitude != null),
          "Provide either a location name or both latitude and longitude, not both.",
        ),
      execute: async (input: {
        location?: string;
        latitude?: number;
        longitude?: number;
      }) => {
        let latitude: number;
        let longitude: number;
        let resolvedLocation: string | undefined;

        if (input.location) {
          const resolved = await geocodeLocation(input.location);
          latitude = resolved.latitude;
          longitude = resolved.longitude;
          resolvedLocation = resolved.name;
        } else {
          latitude = input.latitude!;
          longitude = input.longitude!;
        }

        const response = await fetch(
          `${FORECAST_URL}?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto`,
          { signal: AbortSignal.timeout(10_000) },
        );
        if (!response.ok) throw new Error("Weather service request failed");

        const data = await response.json();
        return {
          ...data,
          resolvedLocation,
          note: resolvedLocation
            ? `Coordinates resolved from the name "${input.location}" → ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
            : undefined,
        };
      },
    },
  };
}
