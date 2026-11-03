"use client";

import FileDrop from "./FileDrop";

export default function DataUpload({
  sessionId,
  onUploaded,
}: {
  sessionId: string;
  onUploaded: () => void;
}) {
  return <FileDrop sessionId={sessionId} onUploaded={onUploaded} />;
}
