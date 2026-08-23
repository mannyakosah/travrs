"""vrs-explain — the 15-minute VRS on-ramp.

    python -m traverse.cli "NM_007294.4:c.68_69del"
    vrs-explain --json 17-43124027-CAG-C
"""

from __future__ import annotations

import argparse
import json
import sys

from traverse.detect import Detection, UnknownFormatError, detect
from traverse.pipeline import InspectResult, inspect


def _print_banner(console) -> None:
    from rich.panel import Panel

    console.print(
        Panel.fit(
            "[bold]TraVerse[/bold]  ·  vrs-explain\n"
            "[dim]trace any variant through the verse[/dim]",
            border_style="cyan",
        )
    )


def _print_human(result: InspectResult, *, console=None, preamble: bool = True) -> None:
    from rich.console import Console
    from rich.syntax import Syntax
    from rich.table import Table

    console = console or Console()
    if preamble:
        _print_banner(console)
        console.print("\n[bold cyan]Input[/bold cyan]")
        console.print(f"  {result.input}")
        console.print("\n[bold cyan]Detected[/bold cyan]")
        console.print(f"  {result.detection.fmt}  —  {result.detection.note}")

    if result.errors and result.allele is None:
        console.print("\n[bold red]Could not translate[/bold red]")
        for err in result.errors:
            console.print(f"  {err}")
        return

    console.print("\n[bold cyan]VRS Allele[/bold cyan]")
    pretty = json.dumps(result.allele_json, indent=2)
    console.print(Syntax(pretty, "json", theme="monokai", word_wrap=True))

    console.print("\n[bold cyan]Computed identifier[/bold cyan]")
    if result.vrs_id:
        console.print(f"  [bold green]{result.vrs_id}[/bold green]")
    else:
        console.print("  [red](none)[/red]")
    if result.location_id:
        console.print(f"  location  {result.location_id}")

    console.print("\n[bold cyan]Checks[/bold cyan]")
    for check in result.checks:
        mark = "[green]✓[/green]" if check.ok else "[red]✗[/red]"
        console.print(f"  {mark}  {check.name}: {check.detail}")

    if result.equivalents:
        console.print("\n[bold cyan]Equivalent representations[/bold cyan]")
        table = Table(show_header=True, header_style="bold", box=None, pad_edge=False)
        table.add_column("format", style="dim")
        table.add_column("expression")
        for fmt, values in result.equivalents.items():
            if not values:
                table.add_row(fmt, "—")
                continue
            table.add_row(fmt, values[0])
            for extra in values[1:]:
                table.add_row("", extra)
        console.print(table)

    if result.errors:
        console.print("\n[yellow]Notes[/yellow]")
        for err in result.errors:
            console.print(f"  {err}")

    versions = result.versions
    console.print(
        f"\n[dim]vrs-python {versions.get('vrs_python', '?')}  ·  "
        f"ga4gh.core {versions.get('ga4gh_core', '?')}  ·  "
        f"traverse {versions.get('traverse', '?')}[/dim]"
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="vrs-explain",
        description="Translate HGVS / SPDI / gnomAD / VRS JSON to a computed VRS identifier.",
    )
    parser.add_argument(
        "variant",
        help="Variant expression, e.g. NM_007294.4:c.68_69del",
    )
    parser.add_argument(
        "--fmt",
        choices=("hgvs", "spdi", "gnomad", "vrs"),
        default=None,
        help="Skip auto-detect and force this format.",
    )
    parser.add_argument("--json", action="store_true", help="Machine-readable output.")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    if args.json:
        try:
            result = inspect(args.variant, fmt=args.fmt)
        except UnknownFormatError as exc:
            print(exc, file=sys.stderr)
            return 2
        print(json.dumps(result.to_dict(), indent=2))
        return 1 if result.errors and result.allele is None else 0

    from rich.console import Console

    console = Console()
    _print_banner(console)
    console.print("\n[bold cyan]Input[/bold cyan]")
    console.print(f"  {args.variant.strip()}")

    try:
        detection = (
            Detection(args.fmt, f"forced format={args.fmt}")
            if args.fmt is not None
            else detect(args.variant)
        )
    except UnknownFormatError as exc:
        console.print(f"\n[bold red]{exc}[/bold red]")
        return 2

    console.print("\n[bold cyan]Detected[/bold cyan]")
    console.print(f"  {detection.fmt}  —  {detection.note}")

    with console.status("[cyan]Starting…[/cyan]", spinner="dots") as status:
        result = inspect(
            args.variant,
            fmt=args.fmt,
            on_progress=lambda msg: status.update(f"[cyan]{msg}[/cyan]"),
        )

    _print_human(result, console=console, preamble=False)
    return 1 if result.errors and result.allele is None else 0


if __name__ == "__main__":
    raise SystemExit(main())
