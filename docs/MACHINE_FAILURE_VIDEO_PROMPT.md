# Machine failure video

The incident screen opens on a short clip of the failure. The clip is optional
and the app never depends on it: with no file present, the screen draws its
animated schematic instead and the session runs exactly as it does with one.

The file currently in the repository was generated from the prompt below and
re-encoded for delivery — see **Encoding** at the end.

## Where the file goes

```
public/media/machine-failure.mp4
```

That path is the only integration point. It is declared once, as
`MACHINE_VIDEO_SRC` in `src/lib/content/activity.ts`, and read by
`src/components/present/scene/MachinePanel.tsx`.

`MachineFootage` renders the schematic first and swaps to the video only once
the browser reports `canplay`. If the file is missing the request 404s,
`canplay` never fires, and the schematic simply stays — there is no error state
to recover from and nothing on screen changes. **Do not** replace this with an
external URL: the projector has to work on a conference network that may not
reach anything but the app itself.

## How it is presented

The clip has **the first beat of the incident stage to itself**, at the largest
true 16:9 rectangle that fits the projector, with nothing else on screen. A
room cannot watch fifteen seconds of a machine failing and read a sentence at
the same time; asked to do both, they do neither. The narrative starts on the
facilitator's next press, against the still frame the clip ends on.

The frame is driven from its **height** (`aspect-video h-full max-w-full`), not
its width. Sizing from the width lets `max-h-full` clamp the height, the aspect
ratio loses, and the footage ends up pillarboxed inside a 2.09:1 box — which is
exactly the "video player" look this is meant not to have. `object-contain`
means a replacement clip at another aspect ratio will letterbox rather than
stretch or crop.

Playback is muted, autoplay, `playsInline`, **once**, with no controls and no
browser chrome (`controls={false}`, `disablePictureInPicture`, a restrictive
`controlsList`). It holds its last frame — machine stopped, warnings active,
production interrupted — because that still is the scenario the room then
spends the session on.

## Generation prompt

Use this verbatim.

> Create a realistic industrial rotating-equipment failure sequence in a modern
> oil-and-gas production facility. Show a large pump/compressor package
> operating normally inside a clean industrial process area. Begin with stable
> operation. Gradually introduce subtle abnormal vibration, increasing
> mechanical instability and a rising temperature indication. Show operators
> noticing the condition on a local panel. The vibration worsens, the equipment
> begins to sound and move abnormally, a warning light activates, then the
> machine trips automatically and comes to a controlled emergency stop. Show
> realistic mechanical distress, light smoke or minor sparking only if
> physically plausible, but no explosion, no fireball, no Hollywood
> destruction. The final image should show the machine stopped, warning
> indicators active and production interrupted. Hyper-realistic, cinematic but
> technically credible, industrial safety documentary style, natural lighting,
> realistic PPE, no text overlays, no logos, no brand names, no AI-looking
> artefacts, 16:9.

## Output settings

| Setting | Value                              |
| ------- | ---------------------------------- |
| Length  | 8–15 seconds                       |
| Aspect  | 16:9                               |
| Codec   | H.264 MP4, so every laptop plays it |

## Encoding

Encode for delivery before committing. The clip ships in the deployment bundle
and a projector on hotel wifi has to fetch it before the incident screen is
reached, so the difference between a generator's raw output and a sensible
encode is a real part of whether the session starts on time.

```bash
ffmpeg -i raw.mp4 -map 0:v:0 -an \
  -c:v libx264 -preset slow -crf 23 -profile:v high -level 4.0 \
  -pix_fmt yuv420p -movflags +faststart \
  public/media/machine-failure.mp4
```

- `-an` drops the audio. The app plays muted, always, so an audio track is
  bytes every projector downloads and nothing ever hears.
- `-map 0:v:0` drops any cover-art stream a generator attached.
- `-crf 23` at 720p is visually indistinguishable from a raw 8 Mbps export,
  including on the high-motion smoke frames, at roughly a third of the size.
  The current file went 15 MB → 5.9 MB this way.
- `+faststart` puts the index at the front so playback can begin before the
  whole file has arrived.

## What the clip must not do

The audience for this session is operations and maintenance people. They will
find any physical implausibility instantly, and the moment they do, the
argument the session is making stops being credible.

- **No explosion, fireball, or flying debris.** A trip is a protection system
  working. Making it look like a disaster movie says the opposite of what the
  session is teaching.
- **No visible shaft wobble.** A shaft you can see wobbling from the back of a
  room has already come apart.
- **No text, gauges with invented numbers, logos, or brand names.** The
  activity puts no figures on anything, deliberately — see the cost screens.
- **Nothing that identifies a real site or a real incident.**

## Replaying it in a session

The clip plays once and stops on its last frame. A facilitator who wants to run
it again presses Back to the first beat of the incident stage; the frame
remounts and playback starts from the beginning.
