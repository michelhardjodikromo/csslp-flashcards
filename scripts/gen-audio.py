#!/usr/bin/env python3
"""Generate missing narration audio for cards.json using edge-tts.

Usage (from the repo root, needs internet access):
    pip install edge-tts
    python scripts/gen-audio.py

For every card whose audio/dN/NN-q.mp3 or NN-a.mp3 file is missing, this
generates it with the same neural voice used for the original 188 cards
(en-US-AndrewNeural). Existing files are never touched, so it is safe to
re-run any time new cards are added.
"""
import asyncio
import json
import sys
from pathlib import Path

try:
    import edge_tts
except ImportError:
    sys.exit("edge-tts is not installed. Run: pip install edge-tts")

VOICE = "en-US-AndrewNeural"
ROOT = Path(__file__).resolve().parent.parent
CONCURRENCY = 4


async def synth(sem: asyncio.Semaphore, text: str, out: Path) -> None:
    async with sem:
        out.parent.mkdir(parents=True, exist_ok=True)
        tmp = out.with_suffix(".tmp")
        await edge_tts.Communicate(text, VOICE).save(str(tmp))
        tmp.replace(out)
        print(f"  wrote {out.relative_to(ROOT)}")


async def main() -> None:
    cards = json.loads((ROOT / "cards.json").read_text(encoding="utf-8"))
    sem = asyncio.Semaphore(CONCURRENCY)
    jobs = []
    for domain in cards["domains"]:
        for card in domain["cards"]:
            for side, key in (("front", "q"), ("back", "a")):
                path = ROOT / card[key]
                if not path.exists():
                    jobs.append(synth(sem, card[side], path))
    if not jobs:
        print("Nothing to do - every card already has audio.")
        return
    print(f"Generating {len(jobs)} audio files with {VOICE} ...")
    await asyncio.gather(*jobs)
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
