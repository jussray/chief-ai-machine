---
name: makevideo
description: Render a bounded Chief video through Chief's own first-party FFmpeg renderer. Use for /MAKEVIDEO, /makevideo, /video, or ordinary requests such as "make this video" when the requested output belongs to Chief.
---

# Chief MAKEVIDEO adapter

Use Chief's own renderer. Do not route the render through FCR, Bip, StoryEngine, or an external provider unless a separate current capability/authority decision explicitly selects one.

## Authority

Rendering produces bytes and evidence only. It does not grant publication, truth, billing, or release authority.

## Execute

1. Build the current JSON input accepted by `src/domain/video-renderer.js`. Read the implementation/test first and do not invent unsupported fields.
2. Run:

```bash
npm run video:render -- --input <input.json>
```

3. Require `kind: "RENDERED"` and preserve the returned output/probe/fingerprint evidence.
4. Run the exact focused proof:

```bash
npm run video:proof
```

5. If the artifact is surfaced in a browser or UI, add Playwright playback/UI proof before calling that presentation path verified.

## Stop conditions

Stop on `CAPABILITY_UNAVAILABLE`, rejected inputs, missing source evidence, failed ffprobe readback, or any request that tries to convert renderer success into publish/release truth without a separate authorization receipt.
