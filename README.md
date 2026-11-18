# AIM-8 Sonic Studio

An open-source AI music studio that runs entirely in your browser. Describe a song, or chat with the
AI producer, and AIM-8 writes lyrics, generates full tracks with Suno (through [Kie.ai](https://kie.ai)),
and lets you extend, cover, remix, separate stems, master and export them.

**Bring your own keys (BYOK) — keys are required.** AIM-8 ships with no API keys, no shared backend,
no accounts and no demo mode. Until you enter your own keys, the app shows only the key prompt and does
nothing else. All usage is billed to your own Kie.ai and Google accounts.

## Features

- AI producer chat (Gemini) that turns ideas into styles, prompts and full lyrics
- Song generation, extension, covers, add-vocals / add-instrumental (Suno models via Kie.ai)
- Pro Studio: lyrics, synced lyrics, stem separation, WAV conversion, music videos
- In-browser stem mixer, effects and mastering presets
- Export to MP3 / WAV / stems ZIP and vertical social clips
- Library and personas stored locally in your browser

## Required API keys

| Key | Used for | Get one |
| --- | --- | --- |
| Kie.ai API key | Suno music generation, lyrics, stems, video, file uploads | https://kie.ai/api-key |
| Google Gemini API key | AI producer chat, prompt & lyric writing, track titles, live voice | https://aistudio.google.com/apikey |

Both keys are required. Open the app, paste them into the **Enter your API keys** screen, and click
**Save keys**. You can change them later with the **API Keys** button in the studio, or remove them from
the sidebar.

### How keys are handled

- Keys are saved only in your browser's `localStorage` (`aim8_byok_keys`).
- Requests go straight from your browser to `api.kie.ai` / `kieai.redpandaai.co` (Kie.ai) and to
  Google's Gemini API. There is no AIM-8 server in between, and keys are never sent anywhere else.
- Nothing is read from environment variables at build time, so a deployment can never bundle a key.
- Because keys live in the browser, use keys with spending limits, and clear them on shared computers.

## Run locally

Requires Node.js 18+.

```bash
npm install
npm run dev      # http://localhost:3344
npm run build    # production build in dist/
npm run preview  # serve the build
```

No `.env` file is needed or read.

## Deploy

It's a static Vite SPA. On Vercel, import the repo (framework preset: Vite) and deploy. **Do not set any
environment variables** — none are used. `vercel.json` adds the SPA rewrite. Any static host that serves
`dist/` with a fallback to `index.html` works too.

## Project layout

```
App.tsx                 key gate -> studio
components/ApiKeySetup  the BYOK key screen
components/VoiceStudio  main studio shell
components/ProStudio    advanced Kie.ai tools
services/byok.ts        key storage (browser only)
services/sunoService.ts / kieProService.ts   Kie.ai (Suno) client
services/geminiService.ts / liveService.ts  Gemini client
```

## Not included

This public version intentionally leaves out the hosted aim8.io backend: accounts, credits, payments,
cloud library, push notifications, analytics, email, admin/affiliate/marketing tooling and server-side
video rendering.

## License

[MIT](LICENSE) © 2026 John Matveyev
