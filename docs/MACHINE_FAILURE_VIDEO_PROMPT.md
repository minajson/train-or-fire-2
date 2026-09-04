# Machine failure video

The incident screen has a slot for a short clip of the failure. It is optional
and the app never depends on it: with no file present, the screen draws its
animated schematic instead and the session runs exactly as it does today.

## Where the file goes

```
public/media/machine-failure.mp4
```

That path is the only integration point. It is declared once, as
`MACHINE_VIDEO_SRC` in `src/lib/content/activity.ts`, and read by
`src/components/present/scene/MachinePanel.tsx`.

The panel renders the schematic first and swaps to the video only once the
browser reports `canplay`. If the file is missing the request 404s, `canplay`
never fires, and the schematic simply stays — there is no error state to
recover from and nothing on screen changes. **Do not** replace this with an
external URL: the projector has to work on a conference network that may not
reach anything but the app itself.

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

| Setting  | Value                                                    |
| -------- | -------------------------------------------------------- |
| Length   | 8–10 seconds                                             |
| Aspect   | 16:9                                                     |
| Audio    | Optional. Realistic industrial sound only if it is generated |
| Encoding | H.264 MP4, so every projector laptop plays it            |

The app plays the clip **muted**, looping, with no controls, so any audio track
in the file is never heard. Keep the file small — it ships in the deployment
bundle and a projector on hotel wifi has to fetch it before the incident
screen is reached.

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

The clip loops for as long as the incident screen is up, so there is nothing to
restart. A facilitator who wants to run it again presses Back to the incident
stage; the panel remounts and playback starts from the beginning.
