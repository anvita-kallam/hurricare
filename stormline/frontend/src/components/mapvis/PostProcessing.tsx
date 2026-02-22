import { EffectComposer, Noise, HueSaturation, BrightnessContrast, Bloom, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'

export default function PostProcessing() {
  return (
    <EffectComposer>
      {/* Static subtle bloom — no selection-driven intensity changes */}
      <Bloom
        intensity={0.25}
        luminanceThreshold={0.6}
        luminanceSmoothing={0.9}
        mipmapBlur
      />

      <HueSaturation hue={0} saturation={0.15} />
      <BrightnessContrast brightness={0.03} contrast={0.08} />

      {/* Subtle static noise */}
      <Noise
        opacity={0.18}
        blendFunction={BlendFunction.OVERLAY}
      />

      {/* Static vignette */}
      <Vignette
        offset={0.4}
        darkness={0.7}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  )
}
