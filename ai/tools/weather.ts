import { z } from "zod";

export function createWeatherTools() {
  return {
    getWeather: {
      description: "Get the current weather at a location",
      inputSchema: z.object({
        latitude: z.number().describe("Latitude coordinate"),
        longitude: z.number().describe("Longitude coordinate"),
      }),
      execute: async ({ latitude, longitude }: { latitude: number; longitude: number }) => {
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&hourly=temperature_2m&daily=sunrise,sunset&timezone=auto`,
        );
        if (!response.ok) throw new Error("Weather service request failed");
        return response.json();
      },
    },
  };
}
