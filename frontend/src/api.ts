import type { InspectResponse } from "./types";

export async function inspectVariant(input: string): Promise<InspectResponse> {
  const response = await fetch("/api/inspect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input }),
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

  return (await response.json()) as InspectResponse;
}
