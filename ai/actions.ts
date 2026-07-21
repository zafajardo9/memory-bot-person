import { generateObject } from "ai";
import { z } from "zod";

import type { LanguageModel } from "ai";

export async function generateSampleFlightStatus(
  model: LanguageModel,
  { flightNumber, date }: { flightNumber: string; date: string },
) {
  const { object } = await generateObject({
    model,
    prompt: `Flight status for flight number ${flightNumber} on ${date}`,
    schema: z.object({
      flightNumber: z.string(),
      departure: flightLocationSchema,
      arrival: flightLocationSchema,
      totalDistanceInMiles: z.number(),
    }),
  });
  return object;
}

const flightSearchResultSchema = z.object({
  id: z.string(),
  departure: z.object({
    cityName: z.string(),
    airportCode: z.string(),
    timestamp: z.string(),
  }),
  arrival: z.object({
    cityName: z.string(),
    airportCode: z.string(),
    timestamp: z.string(),
  }),
  airlines: z.array(z.string()),
  priceInUSD: z.number(),
  numberOfStops: z.number(),
});

const flightLocationSchema = z.object({
  cityName: z.string(),
  airportCode: z.string(),
  airportName: z.string(),
  timestamp: z.string(),
  terminal: z.string(),
  gate: z.string(),
});

export async function generateSampleFlightSearchResults(
  model: LanguageModel,
  { origin, destination }: { origin: string; destination: string },
) {
  const { object } = await generateObject({
    model,
    prompt: `Generate four realistic demonstration flights from ${origin} to ${destination}.`,
    output: "array",
    schema: flightSearchResultSchema,
  });
  return { flights: object };
}

export async function generateSampleSeatSelection(
  model: LanguageModel,
  { flightNumber }: { flightNumber: string },
) {
  const { object } = await generateObject({
    model,
    prompt: `Simulate five rows of six seats for flight ${flightNumber}. Keep every seat price below 99 USD.`,
    output: "array",
    schema: z.array(
      z.object({
        seatNumber: z.string(),
        priceInUSD: z.number(),
        isAvailable: z.boolean(),
      }),
    ),
  });
  return { seats: object };
}

export async function generateReservationPrice(
  model: LanguageModel,
  props: {
    seats: string[];
    flightNumber: string;
    departure: z.infer<typeof flightLocationSchema>;
    arrival: z.infer<typeof flightLocationSchema>;
    passengerName: string;
  },
) {
  const { object } = await generateObject({
    model,
    prompt: `Generate a realistic demonstration price for this reservation:\n${JSON.stringify(props, null, 2)}`,
    schema: z.object({ totalPriceInUSD: z.number() }),
  });
  return object;
}

export { flightLocationSchema };
