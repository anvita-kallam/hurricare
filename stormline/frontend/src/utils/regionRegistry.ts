/**
 * Canonical Region Registry
 *
 * Maps display labels, admin1 codes, and common aliases to canonical region IDs.
 * Guards ALL region lookups so "unknown region" errors never block analysis.
 */

// Alias map: lowercase variant -> canonical name (matching COUNTRY_POLYGONS)
const REGION_ALIASES: Record<string, string> = {
  // Caribbean
  'haiti': 'Haiti',
  'haïti': 'Haiti',
  'republic of haiti': 'Haiti',
  'cuba': 'Cuba',
  'republic of cuba': 'Cuba',
  'dominican republic': 'Dominican Republic',
  'dominican rep.': 'Dominican Republic',
  'dom. rep.': 'Dominican Republic',
  'jamaica': 'Jamaica',
  'puerto rico': 'Puerto Rico',
  'bahamas': 'Bahamas',
  'the bahamas': 'Bahamas',
  'trinidad and tobago': 'Trinidad and Tobago',
  'barbados': 'Barbados',
  'saint lucia': 'Saint Lucia',
  'st. lucia': 'Saint Lucia',
  'st lucia': 'Saint Lucia',
  'grenada': 'Grenada',
  'dominica': 'Dominica',
  'antigua and barbuda': 'Antigua and Barbuda',
  'saint kitts and nevis': 'Saint Kitts and Nevis',
  'st. kitts and nevis': 'Saint Kitts and Nevis',
  'saint vincent and the grenadines': 'Saint Vincent and the Grenadines',
  'st. vincent': 'Saint Vincent and the Grenadines',
  'turks and caicos islands': 'Turks and Caicos Islands',
  'turks and caicos': 'Turks and Caicos Islands',
  'cayman islands': 'Cayman Islands',
  'virgin islands': 'Virgin Islands',
  'british virgin islands': 'British Virgin Islands',
  'us virgin islands': 'United States Virgin Islands',
  'u.s. virgin islands': 'United States Virgin Islands',

  // Central America
  'honduras': 'Honduras',
  'nicaragua': 'Nicaragua',
  'guatemala': 'Guatemala',
  'belize': 'Belize',
  'el salvador': 'El Salvador',
  'costa rica': 'Costa Rica',
  'panama': 'Panama',
  'mexico': 'Mexico',
  'méxico': 'Mexico',

  // North America
  'united states': 'United States of America',
  'united states of america': 'United States of America',
  'usa': 'United States of America',
  'us': 'United States of America',
  'u.s.': 'United States of America',
  'u.s.a.': 'United States of America',
  'canada': 'Canada',

  // US States (common hurricane-affected)
  'florida': 'United States of America',
  'texas': 'United States of America',
  'louisiana': 'United States of America',
  'north carolina': 'United States of America',
  'south carolina': 'United States of America',
  'georgia': 'United States of America',
  'alabama': 'United States of America',
  'mississippi': 'United States of America',
  'new york': 'United States of America',
  'new jersey': 'United States of America',
  'connecticut': 'United States of America',
  'virginia': 'United States of America',
  'maryland': 'United States of America',

  // South America
  'venezuela': 'Venezuela',
  'colombia': 'Colombia',
  'brazil': 'Brazil',
  'guyana': 'Guyana',
  'suriname': 'Suriname',

  // Pacific
  'philippines': 'Philippines',
  'the philippines': 'Philippines',
  'vanuatu': 'Vanuatu',
  'fiji': 'Fiji',
  'tonga': 'Tonga',
  'samoa': 'Samoa',

  // Indian Ocean
  'madagascar': 'Madagascar',
  'mozambique': 'Mozambique',
  'india': 'India',
  'bangladesh': 'Bangladesh',
  'myanmar': 'Myanmar',
  'sri lanka': 'Sri Lanka',

  // Others
  'china': 'China',
  'japan': 'Japan',
  'taiwan': 'Taiwan',
  'vietnam': 'Vietnam',
  'viet nam': 'Vietnam',
  'australia': 'Australia',
}

// Sub-national admin1 regions that map to a country
const ADMIN1_TO_COUNTRY: Record<string, string> = {
  // Haiti departments
  'sud': 'Haiti',
  'sud-est': 'Haiti',
  'grand\'anse': 'Haiti',
  'grandanse': 'Haiti',
  'grand anse': 'Haiti',
  'nippes': 'Haiti',
  'ouest': 'Haiti',
  'nord': 'Haiti',
  'nord-est': 'Haiti',
  'nord-ouest': 'Haiti',
  'artibonite': 'Haiti',
  'centre': 'Haiti',

  // Cuba provinces
  'pinar del rio': 'Cuba',
  'pinar del río': 'Cuba',
  'la habana': 'Cuba',
  'havana': 'Cuba',
  'matanzas': 'Cuba',
  'villa clara': 'Cuba',
  'sancti spiritus': 'Cuba',
  'sancti spíritus': 'Cuba',
  'camagüey': 'Cuba',
  'camaguey': 'Cuba',
  'holguin': 'Cuba',
  'holguín': 'Cuba',
  'santiago de cuba': 'Cuba',
  'guantánamo': 'Cuba',
  'guantanamo': 'Cuba',

  // Philippines regions
  'eastern visayas': 'Philippines',
  'western visayas': 'Philippines',
  'central visayas': 'Philippines',
  'bicol': 'Philippines',
  'bicol region': 'Philippines',
  'calabarzon': 'Philippines',
  'mimaropa': 'Philippines',
  'ncr': 'Philippines',
  'national capital region': 'Philippines',
  'caraga': 'Philippines',
  'leyte': 'Philippines',
  'samar': 'Philippines',
  'tacloban': 'Philippines',

  // Honduras departments
  'cortés': 'Honduras',
  'cortes': 'Honduras',
  'atlántida': 'Honduras',
  'atlantida': 'Honduras',
  'colón': 'Honduras',
  'colon': 'Honduras',
  'gracias a dios': 'Honduras',
  'islas de la bahía': 'Honduras',

  // Mexico states
  'quintana roo': 'Mexico',
  'yucatan': 'Mexico',
  'yucatán': 'Mexico',
  'campeche': 'Mexico',
  'tabasco': 'Mexico',
  'veracruz': 'Mexico',
  'tamaulipas': 'Mexico',
  'baja california sur': 'Mexico',
  'baja california': 'Mexico',
  'sinaloa': 'Mexico',
  'jalisco': 'Mexico',
  'guerrero': 'Mexico',
  'oaxaca': 'Mexico',
}

/**
 * Resolve a region name (display label, admin1, alias) to its canonical name.
 * Returns the canonical name or the original string if no match found.
 * NEVER throws.
 */
export function resolveRegion(input: string): string {
  if (!input || typeof input !== 'string') {
    console.warn('[RegionRegistry] Empty or invalid region input:', input)
    return input || 'Unknown'
  }

  const trimmed = input.trim()
  const lower = trimmed.toLowerCase()

  // Direct alias match
  if (REGION_ALIASES[lower]) {
    return REGION_ALIASES[lower]
  }

  // Admin1 to country match
  if (ADMIN1_TO_COUNTRY[lower]) {
    return ADMIN1_TO_COUNTRY[lower]
  }

  // Return original (title-cased) — it may already be canonical
  console.log(`[RegionRegistry] No alias for "${trimmed}", using as-is`)
  return trimmed
}

/**
 * Resolve a region name, returning the admin1 name as-is for data lookups
 * but providing the canonical country name for polygon lookups.
 */
export function resolveRegionForPolygon(input: string): string {
  return resolveRegion(input)
}

/**
 * Check if a region name can be resolved to a known polygon country.
 */
export function isKnownRegion(input: string): boolean {
  if (!input) return false
  const lower = input.trim().toLowerCase()
  return !!(REGION_ALIASES[lower] || ADMIN1_TO_COUNTRY[lower])
}

/**
 * Get the parent country for an admin1 region, or null if it's already a country.
 */
export function getParentCountry(admin1: string): string | null {
  if (!admin1) return null
  const lower = admin1.trim().toLowerCase()
  return ADMIN1_TO_COUNTRY[lower] || null
}

/**
 * Safe region lookup wrapper. Wraps any function that takes a region name
 * and returns a value, catching errors and returning fallback instead.
 */
export function safeRegionLookup<T>(
  fn: (region: string) => T,
  region: string,
  fallback: T
): T {
  try {
    const result = fn(region)
    if (result === undefined || result === null) {
      // Try resolved name
      const resolved = resolveRegion(region)
      if (resolved !== region) {
        const resolvedResult = fn(resolved)
        if (resolvedResult !== undefined && resolvedResult !== null) {
          return resolvedResult
        }
      }
      return fallback
    }
    return result
  } catch (err) {
    console.warn(`[RegionRegistry] Lookup failed for "${region}":`, err)
    return fallback
  }
}
