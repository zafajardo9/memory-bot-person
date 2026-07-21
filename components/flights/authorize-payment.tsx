"use client";

import { differenceInMinutes } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

import { fetcher } from "@/lib/utils";

import { CheckCircle, InfoIcon } from "../custom/icons";
import { Input } from "../ui/input";

export function AuthorizePayment({
  intent = { reservationId: "sample-uuid" },
}: {
  intent?: { reservationId: string };
}) {
  const { data: reservation, mutate } = useSWR(
    `/api/reservation?id=${intent.reservationId}`,
    fetcher,
  );

  const [input, setInput] = useState("");

  const handleAuthorize = async (magicWord: string) => {
    try {
      const response = await fetch(
        `/api/reservation?id=${intent.reservationId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ magicWord }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || response.statusText);
      }

      const updatedReservation = await response.json();
      mutate(updatedReservation);
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("An unknown error occurred");
      }
    }
  };

  return reservation?.hasCompletedPayment ? (
    <div className="flex flex-row items-center justify-between gap-4 rounded-lg border border-emerald-500/30 bg-emerald-500/8 p-4">
      <div className="font-medium text-emerald-700 dark:text-emerald-300">
        Payment Verified
      </div>
      <div className="text-emerald-700 dark:text-emerald-300">
        <CheckCircle size={20} />
      </div>
    </div>
  ) : differenceInMinutes(new Date(), new Date(reservation?.createdAt)) >
    150 ? (
    <div className="flex flex-row items-center justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/8 p-4 text-destructive">
      <div>Payment gateway timed out</div>
      <div>
        <InfoIcon size={20} />
      </div>
    </div>
  ) : (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-4">
      <div className="text font-medium">
        Use your saved information for this transaction
      </div>
      <div className="text-muted-foreground text-sm sm:text-base">
        Enter the magic word to authorize payment. Hint: It rhymes with bercel.
      </div>

      <Input
        type="text"
        placeholder="Enter magic word..."
        className="mt-2 text-base"
        onChange={(event) => setInput(event.currentTarget.value)}
        onKeyDown={async (event) => {
          if (event.key === "Enter") {
            await handleAuthorize(input);
            setInput("");
          }
        }}
      />
    </div>
  );
}
