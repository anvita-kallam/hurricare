import { useRef } from 'react'
import GlobeShell from './mapvis/GlobeShell'
import CountryMesh from './mapvis/CountryMesh'
import HurricaneLayer from './HurricaneLayer'
import { COUNTRY_POLYGONS } from '../data/countries'

/**
 * CinematicGlobe - MapVis globe for cinematic intros
 * Features:
 * - No hover elevation
 * - No country selection
 * - Fixed camera controls (no orbit)
 * - Hurricane paths visible
 */

export default function CinematicGlobe() {
  return (
    <group>
      <GlobeShell />
      {COUNTRY_POLYGONS.map((country) => (
        <CountryMesh
          key={country.name}
          country={country}
          radius={1}
          selected={false}
          globalSelected={false}
          mouseOnGlobe={useRef(null)}
          onSelect={() => {}} // No-op for cinematic
          hoverEnabled={false} // Disabled for cinematic
        />
      ))}
      <HurricaneLayer />
    </group>
  )
}
