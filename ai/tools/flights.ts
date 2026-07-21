import { z } from "zod";

import {
  flightLocationSchema,
  generateReservationPrice,
  generateSampleFlightSearchResults,
  generateSampleFlightStatus,
  generateSampleSeatSelection,
} from "@/ai/actions";
import {
  createReservation,
  getReservationById,
} from "@/db/queries";
import { generateUUID } from "@/lib/utils";

import type { LanguageModel } from "ai";

export function createFlightTools({
  model,
  userId,
}: {
  model: LanguageModel;
  userId: string;
}) {
  return {
    displayFlightStatus: {
      description: "Display the status of a demonstration flight",
      inputSchema: z.object({ flightNumber: z.string(), date: z.string() }),
      execute: (input: { flightNumber: string; date: string }) =>
        generateSampleFlightStatus(model, input),
    },
    searchFlights: {
      description: "Search demonstration flights",
      inputSchema: z.object({ origin: z.string(), destination: z.string() }),
      execute: (input: { origin: string; destination: string }) =>
        generateSampleFlightSearchResults(model, input),
    },
    selectSeats: {
      description: "Select seats for a demonstration flight",
      inputSchema: z.object({ flightNumber: z.string() }),
      execute: (input: { flightNumber: string }) =>
        generateSampleSeatSelection(model, input),
    },
    createReservation: {
      description: "Display pending demonstration reservation details",
      inputSchema: z.object({
        seats: z.array(z.string()),
        flightNumber: z.string(),
        departure: flightLocationSchema,
        arrival: flightLocationSchema,
        passengerName: z.string(),
      }),
      execute: async (props: z.infer<typeof reservationSchema>) => {
        const { totalPriceInUSD } = await generateReservationPrice(model, props);
        const id = generateUUID();
        await createReservation({
          id,
          userId,
          details: { ...props, totalPriceInUSD },
        });
        return { id, ...props, totalPriceInUSD };
      },
    },
    authorizePayment: {
      description: "Ask the user to authorize a demonstration payment",
      inputSchema: z.object({ reservationId: z.string().uuid() }),
      execute: async ({ reservationId }: { reservationId: string }) => ({
        reservationId,
      }),
    },
    verifyPayment: {
      description: "Verify demonstration payment status",
      inputSchema: z.object({ reservationId: z.string().uuid() }),
      execute: async ({ reservationId }: { reservationId: string }) => ({
        hasCompletedPayment: Boolean(
          (await getReservationById({ id: reservationId }))?.hasCompletedPayment,
        ),
      }),
    },
    displayBoardingPass: {
      description: "Display a demonstration boarding pass",
      inputSchema: z.object({
        reservationId: z.string().uuid(),
        passengerName: z.string(),
        flightNumber: z.string(),
        seat: z.string(),
        departure: flightLocationSchema,
        arrival: flightLocationSchema,
      }),
      execute: async (boardingPass: z.infer<typeof boardingPassSchema>) =>
        boardingPass,
    },
  };
}

const reservationSchema = z.object({
  seats: z.array(z.string()),
  flightNumber: z.string(),
  departure: flightLocationSchema,
  arrival: flightLocationSchema,
  passengerName: z.string(),
});

const boardingPassSchema = z.object({
  reservationId: z.string().uuid(),
  passengerName: z.string(),
  flightNumber: z.string(),
  seat: z.string(),
  departure: flightLocationSchema,
  arrival: flightLocationSchema,
});
