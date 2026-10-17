import React from 'react';
import { registerRoot, Composition } from 'remotion';
import { Launch } from './Launch';
import { FPS, beat, TOTAL_BEATS } from './theme';

const Root = () => (
  <Composition
    id="Launch"
    component={Launch}
    durationInFrames={beat(TOTAL_BEATS)}
    fps={FPS}
    width={1920}
    height={1080}
    defaultProps={{ music: { startFrom: 0 } }}
  />
);

registerRoot(Root);
