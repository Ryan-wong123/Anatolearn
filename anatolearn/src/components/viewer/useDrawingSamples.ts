import { useRef, useState } from 'react';
import { createDrawingSamples } from './drawingSamples';
import type { DrawPoint, ScreenPoint } from './types';

export function useDrawingSamples() {
  const samples = useRef(createDrawingSamples());
  const [preview, setPreview] = useState<ScreenPoint[]>([]);
  return {
    preview,
    accepts: (point: ScreenPoint) => samples.current.accepts(point),
    start() { samples.current.reset(); setPreview([]); },
    append(screen: ScreenPoint, world: DrawPoint, meshIndex: number) {
      if (samples.current.append(screen, world, meshIndex)) setPreview(samples.current.snapshot().screenPoints);
    },
    finish() { setPreview([]); return samples.current.snapshot(); },
  };
}
