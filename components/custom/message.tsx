"use client";

import {
  getToolName,
  isFileUIPart,
  isTextUIPart,
  isToolUIPart,
  type UIMessage,
} from "ai";
import { motion } from "framer-motion";
import { Streamdown } from "streamdown";

import { BotIcon, UserIcon } from "./icons";
import { PreviewAttachment } from "./preview-attachment";
import { Weather } from "./weather";
import { AuthorizePayment } from "../flights/authorize-payment";
import { DisplayBoardingPass } from "../flights/boarding-pass";
import { CreateReservation } from "../flights/create-reservation";
import { FlightStatus } from "../flights/flight-status";
import { ListFlights } from "../flights/list-flights";
import { SelectSeats } from "../flights/select-seats";
import { VerifyPayment } from "../flights/verify-payment";
import { KnowledgeResults } from "../knowledge/knowledge-results";

export const Message = ({
  chatId,
  message,
}: {
  chatId: string;
  message: UIMessage;
}) => {
  const { role } = message;
  const content = message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join("");
  const toolInvocations = message.parts.filter(isToolUIPart);
  const attachments = message.parts.filter(isFileUIPart);

  return (
    <motion.div
      className="flex w-full max-w-3xl flex-row gap-3 px-4 first-of-type:pt-24 sm:gap-4 sm:px-0"
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
    >
      <div className={`flex size-8 shrink-0 flex-col items-center justify-center rounded-md border p-1 ${role === "assistant" ? "border-primary/25 bg-primary/8 text-primary" : "bg-card text-muted-foreground"}`}>
        {role === "assistant" ? <BotIcon /> : <UserIcon />}
      </div>

      <div className="flex flex-col gap-2 w-full">
        {content && (
          <div className={`flex flex-col gap-4 leading-7 ${role === "user" ? "rounded-xl border bg-muted px-4 py-2.5 text-foreground" : "text-foreground"}`}>
            <Streamdown>{content}</Streamdown>
          </div>
        )}

        {toolInvocations.length > 0 && (
          <div className="flex flex-col gap-4">
            {toolInvocations.map((toolInvocation) => {
              const toolName = getToolName(toolInvocation);
              const { toolCallId, state } = toolInvocation;

              if (state === "output-available") {
                const result = toolInvocation.output;

                return (
                  <div key={toolCallId}>
                    {toolName === "getWeather" ? (
                      <Weather weatherAtLocation={result as never} />
                    ) : toolName === "displayFlightStatus" ? (
                      <FlightStatus flightStatus={result as never} />
                    ) : toolName === "searchFlights" ? (
                      <ListFlights chatId={chatId} results={result as never} />
                    ) : toolName === "selectSeats" ? (
                      <SelectSeats chatId={chatId} availability={result as never} />
                    ) : toolName === "createReservation" ? (
                      typeof result === "object" && result !== null && "error" in result ? null : (
                        <CreateReservation reservation={result as never} />
                      )
                    ) : toolName === "authorizePayment" ? (
                      <AuthorizePayment intent={result as never} />
                    ) : toolName === "displayBoardingPass" ? (
                      <DisplayBoardingPass boardingPass={result as never} />
                    ) : toolName === "verifyPayment" ? (
                      <VerifyPayment result={result as never} />
                    ) : toolName === "searchCompanyKnowledge" ||
                      toolName === "readCompanyKnowledge" ? (
                      <KnowledgeResults result={result as never} />
                    ) : (
                      <div>{JSON.stringify(result, null, 2)}</div>
                    )}
                  </div>
                );
              } else {
                return (
                  <div key={toolCallId} className="skeleton">
                    {toolName === "getWeather" ? (
                      <Weather />
                    ) : toolName === "displayFlightStatus" ? (
                      <FlightStatus />
                    ) : toolName === "searchFlights" ? (
                      <ListFlights chatId={chatId} />
                    ) : toolName === "selectSeats" ? (
                      <SelectSeats chatId={chatId} />
                    ) : toolName === "createReservation" ? (
                      <CreateReservation />
                    ) : toolName === "authorizePayment" ? (
                      <AuthorizePayment />
                    ) : toolName === "displayBoardingPass" ? (
                      <DisplayBoardingPass />
                    ) : toolName === "searchCompanyKnowledge" ||
                      toolName === "readCompanyKnowledge" ? (
                      <KnowledgeResults />
                    ) : null}
                  </div>
                );
              }
            })}
          </div>
        )}

        {attachments.length > 0 && (
          <div className="flex flex-row gap-2">
            {attachments.map((attachment) => (
              <PreviewAttachment key={attachment.url} attachment={attachment} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};
