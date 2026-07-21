"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import cx from "classnames";
import { Fragment } from "react";

interface Seat {
  seatNumber: string;
  priceInUSD: number;
  isAvailable: boolean;
}

const SAMPLE: { seats: Seat[][] } = {
  seats: [
    [
      { seatNumber: "1A", priceInUSD: 150, isAvailable: false },
      { seatNumber: "1B", priceInUSD: 150, isAvailable: false },
      { seatNumber: "1C", priceInUSD: 150, isAvailable: false },
      { seatNumber: "1D", priceInUSD: 150, isAvailable: false },
      { seatNumber: "1E", priceInUSD: 150, isAvailable: false },
      { seatNumber: "1F", priceInUSD: 150, isAvailable: false },
    ],
    [
      { seatNumber: "2A", priceInUSD: 150, isAvailable: false },
      { seatNumber: "2B", priceInUSD: 150, isAvailable: false },
      { seatNumber: "2C", priceInUSD: 150, isAvailable: false },
      { seatNumber: "2D", priceInUSD: 150, isAvailable: false },
      { seatNumber: "2E", priceInUSD: 150, isAvailable: false },
      { seatNumber: "2F", priceInUSD: 150, isAvailable: false },
    ],
    [
      { seatNumber: "3A", priceInUSD: 150, isAvailable: false },
      { seatNumber: "3B", priceInUSD: 150, isAvailable: false },
      { seatNumber: "3C", priceInUSD: 150, isAvailable: false },
      { seatNumber: "3D", priceInUSD: 150, isAvailable: false },
      { seatNumber: "3E", priceInUSD: 150, isAvailable: false },
      { seatNumber: "3F", priceInUSD: 150, isAvailable: false },
    ],
    [
      { seatNumber: "4A", priceInUSD: 150, isAvailable: false },
      { seatNumber: "4B", priceInUSD: 150, isAvailable: false },
      { seatNumber: "4C", priceInUSD: 150, isAvailable: false },
      { seatNumber: "4D", priceInUSD: 150, isAvailable: false },
      { seatNumber: "4E", priceInUSD: 150, isAvailable: false },
      { seatNumber: "4F", priceInUSD: 150, isAvailable: false },
    ],
    [
      { seatNumber: "5A", priceInUSD: 150, isAvailable: false },
      { seatNumber: "5B", priceInUSD: 150, isAvailable: false },
      { seatNumber: "5C", priceInUSD: 150, isAvailable: false },
      { seatNumber: "5D", priceInUSD: 150, isAvailable: false },
      { seatNumber: "5E", priceInUSD: 150, isAvailable: false },
      { seatNumber: "5F", priceInUSD: 150, isAvailable: false },
    ],
  ],
};

export function SelectSeats({
  chatId,
  availability = SAMPLE,
}: {
  chatId: string;
  availability?: typeof SAMPLE;
}) {
  const { sendMessage } = useChat({
    id: chatId,
    transport: new DefaultChatTransport({ body: { id: chatId } }),
  });

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card">
      <div className="flex flex-col gap-4 scale-75">
        <div className="flex flex-row w-full justify-between text-muted-foreground">
          <div className="flex flex-row">
            <div className="w-[45px] sm:w-[54px] text-center">A</div>
            <div className="w-[45px] sm:w-[54px] text-center">B</div>
            <div className="w-[45px] sm:w-[54px] text-center">C</div>
          </div>
          <div className="flex flex-row">
            <div className="w-[45px] sm:w-[54px] text-center">D</div>
            <div className="w-[45px] sm:w-[54px] text-center">E</div>
            <div className="w-[45px] sm:w-[54px] text-center">F</div>
          </div>
        </div>

        {availability.seats.map((row, index) => (
          <div key={`row-${index}`} className="flex flex-row gap-4">
            {row.map((seat, seatIndex) => (
              <Fragment key={seat.seatNumber}>
                {seatIndex === 3 ? (
                  <div className="flex flex-row items-center justify-center w-full text-muted-foreground">
                    {index + 1}
                  </div>
                ) : null}
                <div
                  onClick={() => {
                    void sendMessage({
                      text: `I'd like to go with seat ${seat.seatNumber}`,
                    });
                  }}
                  className={cx(
                    "cursor-pointer group relative size-8 sm:size-10 flex-shrink-0 flex rounded-sm flex-row items-center justify-center",
                    {
                      "bg-primary hover:bg-primary/85": seat.isAvailable,
                      "cursor-not-allowed bg-muted-foreground/45": !seat.isAvailable,
                    },
                  )}
                >
                  <div className="text-xs text-white">${seat.priceInUSD}</div>
                  <div
                    className={cx(
                      "absolute -top-1 h-2 w-full scale-125 rounded-sm",
                      {
                        "bg-primary group-hover:bg-primary/85": seat.isAvailable,
                        "cursor-not-allowed bg-muted-foreground/60": !seat.isAvailable,
                      },
                    )}
                  />
                </div>
              </Fragment>
            ))}
          </div>
        ))}
      </div>

      <div className="flex flex-row gap-4 justify-center pb-6">
        <div className="flex flex-row items-center gap-2">
          <div className="size-4 rounded-sm bg-primary" />
          <div className="text text-muted-foreground font-medium text-sm">
            Available
          </div>
        </div>
        <div className="flex flex-row items-center gap-2">
          <div className="size-4 rounded-sm bg-muted-foreground/45" />
          <div className="text text-muted-foreground font-medium text-sm">
            Unavailable
          </div>
        </div>
      </div>
    </div>
  );
}
