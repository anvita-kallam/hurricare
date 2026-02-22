import { EffectComposer, Noise, HueSaturation, BrightnessContrast, Bloom, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'

interface PostProcessingProps {
  selected?: boolean
}

export default function PostProcessing({ selected }: PostProcessingProps) {
  return (
    <EffectComposer>
      <Bloom
        intensity={selected ? 0.4 : 0.3}
        luminanceThreshold={0.5}
        luminanceSmoothing={0.9}
        mipmapBlur
      />

      <HueSaturation hue={0} saturation={0.2} />
      <BrightnessContrast brightness={0.05} contrast={0.1} />

      <Noise
        opacity={selected ? 0.35 : 0.22}
        blendFunction={BlendFunction.OVERLAY}
      />

      <Vignette
        offset={selected ? 0.2 : 0.4}
        darkness={selected ? 1.1 : 0.7}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  )
}
