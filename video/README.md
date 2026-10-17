# Tuck launch video

`tuck-launch.mp4` is the rendered video: 1920×1080, 30 fps, about 52 s.

The source is a [Remotion](https://www.remotion.dev/) project. Scene timing follows a beat grid in `src/theme.js` (103.2 BPM).

The music track is not in the repo. To render with music, put an mp3 at `public/music.mp3`, then:

```
npm install
npm run studio   # preview in the browser
npm run render   # writes tuck-launch.mp4
```

Without the music file, the render fails at the audio step. To render without music, run `npx remotion render src/index.jsx Launch tuck-launch.mp4 --props='{"music":null}'`.
