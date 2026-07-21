import { format } from "date-fns";
import { PlaneTakeoffIcon } from "lucide-react";

const SAMPLE = {
  reservationId: "RES123456",
  flightNumber: "DL1",
  seat: "1C",
  departure: {
    cityName: "London",
    airportCode: "LHR",
    airportName: "Heathrow Airport",
    timestamp: "2023-11-01T09:00:00Z",
    terminal: "5",
    gate: "A10",
  },
  arrival: {
    cityName: "New York City",
    airportCode: "JFK",
    airportName: "John F. Kennedy International Airport",
    timestamp: "2023-11-01T12:00:00Z",
    terminal: "4",
    gate: "B22",
  },
  passengerName: "John Doe",
};

export function DisplayBoardingPass({ boardingPass = SAMPLE }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex flex-row justify-between items-center relative">
        <div className="flex flex-col gap-0.5">
          <div className="text-sm text-muted-foreground sm:text-base">
            {boardingPass.departure.cityName}
          </div>
          <div className="font-mono text-2xl font-semibold sm:text-3xl">
            {boardingPass.departure.airportCode}
          </div>
        </div>

        <div className="absolute w-full flex flex-row justify-center">
          <div className="text-primary">
            <PlaneTakeoffIcon />
          </div>
        </div>

        <div className="flex flex-col gap-0.5">
          <div className="text-sm text-muted-foreground sm:text-base">
            {boardingPass.arrival.cityName}
          </div>
          <div className="text-right font-mono text-2xl font-semibold sm:text-3xl">
            {boardingPass.arrival.airportCode}
          </div>
        </div>
      </div>

      <div className="h-px grow bg-border" />

      <div className="flex flex-row justify-between">
        <div className="flex flex-col gap-0.5">
          <div className="text-sm font-medium sm:text-base">
            Passenger
          </div>
          <div className="text-lg text-muted-foreground">
            {boardingPass.passengerName}
          </div>
        </div>

        <div className="flex flex-col gap-0.5">
          <div className="text-sm font-medium sm:text-base">
            Gate
          </div>
          <div className="text-lg text-muted-foreground">
            {boardingPass.departure.gate}
          </div>
        </div>

        <div className="flex flex-col gap-0.5">
          <div className="text-sm font-medium sm:text-base">
            Boards
          </div>
          <div className="text-lg text-muted-foreground">
            {format(new Date(boardingPass.departure.timestamp), "h:mma")}
          </div>
        </div>
      </div>
    </div>
  );
}
