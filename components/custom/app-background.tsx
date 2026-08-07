"use client";

import Grainient from "@/components/Grainient";

export function AppBackground() {
  return (
    <div className="grainient-background" aria-hidden="true">
      <Grainient
        timeSpeed={0.08}
        colorBalance={-0.08}
        warpStrength={0.72}
        warpFrequency={3.8}
        warpSpeed={0.65}
        warpAmplitude={76}
        blendAngle={-18}
        blendSoftness={0.18}
        rotationAmount={260}
        noiseScale={1.45}
        grainAmount={0.035}
        grainScale={1.6}
        grainAnimated={false}
        contrast={1.08}
        gamma={1.04}
        saturation={0.82}
        centerX={0.04}
        centerY={-0.03}
        zoom={0.88}
        color1="#d8f1ff"
        color2="#4f83e8"
        color3="#d7c7f2"
      />
    </div>
  );
}
