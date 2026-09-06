"""Generate reusable Thai reference audio. No user recordings or credentials are sent."""
import asyncio, json, sys
from pathlib import Path
sys.path.insert(0, str(Path('node_modules/.training-python').resolve()))
import edge_tts

ROOT = Path('public/bangkok/audio')
VOICE = 'th-TH-NiwatNeural'
async def main():
    rows = json.loads((ROOT / 'phrases.json').read_text(encoding='utf-8'))
    gate = asyncio.Semaphore(3)
    failures = []
    async def generate(row):
        path = ROOT / f"{row['id']}.mp3"
        if path.exists() and path.stat().st_size > 1000:
            return
        async with gate:
            for attempt in range(2):
                try:
                    await asyncio.wait_for(edge_tts.Communicate(row['text'], VOICE, rate='-8%').save(str(path)), 45)
                    print(f"Saved {row['id']}", flush=True)
                    return
                except Exception as error:
                    if attempt == 1:
                        failures.append(row['id'])
                        print(f"Failed {row['id']}: {type(error).__name__}", flush=True)
    await asyncio.gather(*(generate(row) for row in rows))
    (ROOT / 'provenance.json').write_text(json.dumps({'source': 'Microsoft Edge text-to-speech via edge-tts', 'voice': VOICE, 'rate': '-8%', 'type': 'synthetic reference speech', 'nativeSpeakerReviewed': False, 'failed': failures}, indent=2), encoding='utf-8')
    print(f"Complete: {len(rows)-len(failures)}/{len(rows)}", flush=True)
    if failures: sys.exit(1)
asyncio.run(main())
