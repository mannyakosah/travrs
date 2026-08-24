import { useEffect, useState, type ReactNode } from "react";
import { fetchVersions } from "./api";
import "./App.css";

export const SITE_BLURB =
  "From a variant string to a GA4GH computed identifier, with each VRS step shown.";

export function Wordmark({ href = "/" }: { href?: string }) {
  const mark = (
    <>
      tra<span className="vrs">VRS</span>
    </>
  );
  return href ? (
    <a className="wordmark" href={href}>
      {mark}
    </a>
  ) : (
    <div className="wordmark">{mark}</div>
  );
}

export function SiteHeader({ children }: { children?: ReactNode }) {
  return (
    <header>
      <Wordmark href="/" />
      <p className="subline">pronounced traverse</p>
      <p className="blurb">{SITE_BLURB}</p>
      {children}
    </header>
  );
}

function versionLine(versions?: Record<string, string> | null): string {
  if (!versions) return "vrs-python";
  return `vrs-python ${versions.vrs_python ?? "?"}  ·  traVRS ${versions.travrs ?? "?"}`;
}

export function SiteFooter({
  here,
  versions,
}: {
  here: "inspect" | "glossary";
  versions?: Record<string, string>;
}) {
  const [live, setLive] = useState<Record<string, string> | null>(versions ?? null);

  useEffect(() => {
    if (versions) {
      setLive(versions);
      return;
    }
    let cancelled = false;
    void fetchVersions().then((next) => {
      if (!cancelled && next) setLive(next);
    });
    return () => {
      cancelled = true;
    };
  }, [versions]);

  return (
    <footer className="footer">
      <div>{versionLine(live)}</div>
      <div>
        {here === "inspect" ? (
          <a href="/glossary">Glossary</a>
        ) : (
          <a href="/">Inspect</a>
        )}
        {" · "}
        <a href="https://doi.org/10.1016/j.xgen.2021.100027">
          Wagner et al. 2021, Cell Genomics
        </a>
      </div>
    </footer>
  );
}

export function inspectHref(value: string): string {
  return `/?q=${encodeURIComponent(value)}`;
}
