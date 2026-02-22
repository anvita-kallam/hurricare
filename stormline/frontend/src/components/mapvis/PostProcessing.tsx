import { EffectComposer, HueSaturation, BrightnessContrast } from '@react-three/postprocessing'

// Bloom DISABLED — it causes white flashing squares with additive-blended materials.
// Noise DISABLED — overlay blend on noise causes flickering.
// Vignette DISABLED — forbidden per design spec.
// Saturation reduced to desaturate everything toward monochrome.
export default function PostProcessing() {
  return (
    <EffectComposer>
      <HueSaturation hue={0} saturation={-0.3} />
      <BrightnessContrast brightness={0.02} contrast={0.08} />
    </EffectComposer>
  )
}
