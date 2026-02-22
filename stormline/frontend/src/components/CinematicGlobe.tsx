import { useRef } from 'react'
import * as THREE from 'three'
import GlobeShell from './mapvis/GlobeShell'
import CountryMesh from './mapvis/CountryMesh'
import HurricaneLayer from './HurricaneLayer'
import { COUNTRY_POLYGONS } from '../data/countries'

/**
 * CinematicGlobe - MapVis globe for cinematic intros
 * - No hover elevation
 * - No country selection
 * - Hurricane paths visible and elevated
 */
export default function CinematicGlobe() {
  const nullMouse = useRef<THREE.Vector3 | null>(null)

  return (
    <group>
      <GlobeShell />
      {COUNTRY_POLYGONS.map((country, idx) => (
        <CountryMesh
          key={`${country.name}-${idx}`}
          country={country}
          radius={1}
          selected={false}
          globalSelected={false}
          mouseOnGlobe={nullMouse}
          onSelect={() => {}}
          hoverEnabled={false}
        />
      ))}
      <HurricaneLayer />
    </group>
  )
}
