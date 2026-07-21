import { FileText, X } from "lucide-react";

import { LoaderIcon } from "./icons";

import type { FileUIPart } from "ai";


export const PreviewAttachment = ({
  attachment,
  isUploading = false,
  onRemove,
}: {
  attachment: FileUIPart;
  isUploading?: boolean;
  onRemove?: () => void;
}) => {
  const { filename, url, mediaType } = attachment;

  return (
    <div className="relative flex w-40 shrink-0 items-center gap-2 rounded-xl border bg-background p-2 pr-7">
      <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
        {mediaType ? (
          mediaType.startsWith("image") ? (
            // NOTE: it is recommended to use next/image for images
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt={filename ?? "An image attachment"}
              className="size-full object-cover"
            />
          ) : (
            <FileText size={17} />
          )
        ) : (
          <FileText size={17} />
        )}

        {isUploading && (
          <div className="absolute animate-spin text-muted-foreground">
            <LoaderIcon />
          </div>
        )}
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs font-medium">{filename ?? "Attachment"}</div>
        <div className="mt-0.5 text-[10px] uppercase text-muted-foreground">
          {mediaType?.split("/")[1] ?? "file"}
        </div>
      </div>
      {onRemove && !isUploading ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${filename ?? "attachment"}`}
          className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X size={12} />
        </button>
      ) : null}
    </div>
  );
};
