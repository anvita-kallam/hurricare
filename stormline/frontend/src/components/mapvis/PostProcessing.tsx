import { EffectComposer, HueSaturation, BrightnessContrast, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'

// Bloom DISABLED — it causes white flashing squares with additive-blended materials.
// Noise DISABLED — overlay blend on noise causes flickering.
export default function PostProcessing() {
  return (
    <EffectComposer>
      <HueSaturation hue={0} saturation={0.12} />
      <BrightnessContrast brightness={0.02} contrast={0.06} />
      <Vignette
        offset={0.4}
        darkness={0.65}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  )
}
