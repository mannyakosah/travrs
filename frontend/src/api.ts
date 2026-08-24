import type { InspectResponse } from "./types";

export type JourneyStage =
  | "detect"
  | "resolve"
  | "coordinates"
  | "normalize"
  | "identify"
  | "verify"
  | "equivalents";

export type InspectProgress = {
  stage?: JourneyStage;
  message?: string;
};

type StreamEvent =
  | { type: "stage"; stage: JourneyStage }
  | { type: "progress"; message: string }
  | { type: "result"; payload: InspectResponse }
  | { type: "error"; detail: string };

export function cacheBypassRequested(): boolean {
  return new URLSearchParams(window.location.search).has("nocache");
}

export async function fetchVersions(): Promise<Record<string, string> | null> {
  try {
    const response = await fetch("/api/versions");
    if (!response.ok) return null;
    return (await response.json()) as Record<string, string>;
  } catch {
    return null;
  }
}

export async function inspectVariant(
  input: string,
  onProgress?: (event: InspectProgress) => void,
): Promise<InspectResponse> {
  const response = await fetch("/api/inspect/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input, no_cache: cacheBypassRequested() }),
  });

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      /* keep status text */
    }
    throw new Error(detail);
  }

  if (!response.body) {
    throw new Error("The API did not stream a response.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: InspectResponse | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const line = chunk.split("\n").find((row) => row.startsWith("data: "));
      if (!line) continue;
      const event = JSON.parse(line.slice(6)) as StreamEvent;
      if (event.type === "stage") {
        onProgress?.({ stage: event.stage });
      } else if (event.type === "progress") {
        onProgress?.({ message: event.message });
      } else if (event.type === "error") {
        throw new Error(event.detail);
      } else if (event.type === "result") {
        result = event.payload;
      }
    }
  }

  if (!result) {
    throw new Error("The API stream ended without a result.");
  }
  return result;
}
