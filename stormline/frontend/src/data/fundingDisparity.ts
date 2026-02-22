/**
 * Funding Disparity Index (0-1)
 * 0 = Well-funded disaster preparedness and response
 * 1 = Severely underfunded disaster management
 *
 * Based on combinations of:
 * - GDP per capita
 * - Disaster preparedness index
 * - Healthcare infrastructure
 * - Emergency response capacity
 */

export const fundingDisparityByCountry: Record<string, number> = {
  // Well-funded nations (0.0-0.2)
  'United States': 0.08,
  'Germany': 0.06,
  'Japan': 0.07,
  'Canada': 0.05,
  'United Kingdom': 0.06,
  'Switzerland': 0.04,
  'Australia': 0.07,
  'Netherlands': 0.05,
  'Norway': 0.04,
  'Denmark': 0.05,
  'Sweden': 0.06,
  'France': 0.07,
  'South Korea': 0.08,
  'Singapore': 0.05,
  'New Zealand': 0.06,

  // Moderate funding (0.2-0.4)
  'China': 0.25,
  'India': 0.35,
  'Russia': 0.28,
  'Brazil': 0.32,
  'Mexico': 0.38,
  'South Africa': 0.41,
  'Thailand': 0.36,
  'Indonesia': 0.42,
  'Philippines': 0.44,
  'Vietnam': 0.40,
  'Poland': 0.18,
  'Czech Republic': 0.16,
  'Hungary': 0.20,
  'Romania': 0.26,
  'Portugal': 0.19,
  'Argentina': 0.28,
  'Chile': 0.22,
  'Colombia': 0.34,
  'Peru': 0.39,
  'Ecuador': 0.42,
  'Egypt': 0.45,
  'Kenya': 0.46,
  'Nigeria': 0.48,
  'Pakistan': 0.52,
  'Bangladesh': 0.54,

  // Under-resourced nations (0.4-0.7)
  'Venezuela': 0.58,
  'Syria': 0.72,
  'Iraq': 0.65,
  'Afghanistan': 0.78,
  'Yemen': 0.82,
  'Somalia': 0.85,
  'Sudan': 0.76,
  'South Sudan': 0.88,
  'Chad': 0.81,
  'Niger': 0.79,
  'Mali': 0.75,
  'Benin': 0.68,
  'Togo': 0.70,
  'Ghana': 0.52,
  'Senegal': 0.62,
  'Cameroon': 0.64,
  'Democratic Republic of the Congo': 0.84,
  'Angola': 0.66,
  'Zambia': 0.72,
  'Zimbabwe': 0.78,
  'Mozambique': 0.74,
  'Malawi': 0.75,
  'Ethiopia': 0.77,
  'Eritrea': 0.86,
  'Mauritania': 0.73,
  'Liberia': 0.82,
  'Sierra Leone': 0.80,
  'Guinea': 0.76,
  'Guinea-Bissau': 0.81,
  'Côte d\'Ivoire': 0.65,
  'Burkina Faso': 0.71,
  'Gambia': 0.70,
  'Cape Verde': 0.48,
  'Mauritius': 0.35,
  'Seychelles': 0.32,
  'Comoros': 0.74,
  'Djibouti': 0.68,
  'Madagascar': 0.73,
  'Bolivia': 0.55,
  'Paraguay': 0.52,
  'Guatemala': 0.58,
  'Honduras': 0.64,
  'Nicaragua': 0.61,
  'El Salvador': 0.60,
  'Haiti': 0.83,
  'Dominican Republic': 0.49,
  'Jamaica': 0.54,
  'Papua New Guinea': 0.70,
  'Fiji': 0.56,
  'Solomon Islands': 0.75,
  'Vanuatu': 0.68,
  'Samoa': 0.62,
  'Kiribati': 0.72,
  'Marshall Islands': 0.65,
  'Palau': 0.58,
  'Nauru': 0.71,
  'Tuvalu': 0.73,
  'East Timor': 0.68,
  'Laos': 0.64,
  'Cambodia': 0.66,
  'Myanmar': 0.62,
  'Mongolia': 0.55,
  'Kosovo': 0.50,
  'Bosnia and Herzegovina': 0.45,
  'Albania': 0.48,
  'North Macedonia': 0.42,
  'Libya': 0.62,
  'Tunisia': 0.48,
  'Morocco': 0.45,
  'Algeria': 0.40,
  'Kyrgyzstan': 0.58,
  'Tajikistan': 0.65,
  'Turkmenistan': 0.54,
  'Uzbekistan': 0.52,
  'Kazakhstan': 0.35,
  'Georgia': 0.42,
  'Armenia': 0.44,
  'Azerbaijan': 0.46,
  'Bahrain': 0.22,
  'Qatar': 0.15,
  'United Arab Emirates': 0.18,
  'Saudi Arabia': 0.24,
  'Oman': 0.28,
  'Lebanon': 0.58,
  'Jordan': 0.50,
  'Israel': 0.12,
  'Palestine': 0.68,
  'Kuwait': 0.20,
  'Turkiye': 0.32,
  'Iran': 0.44,
  'Nepal': 0.62,
  'Bhutan': 0.55,
  'Sri Lanka': 0.58,
  'Maldives': 0.52,

  // Default for any unlisted countries
}

/**
 * Get funding disparity value for a country (0-1 scale)
 */
export function getFundingDisparity(countryName: string): number {
  const normalized = countryName.trim()
  return fundingDisparityByCountry[normalized] ?? 0.5 // Default to middle if not found
}

/**
 * Convert disparity value to a color
 * 0 = Green (well-funded)
 * 0.5 = Yellow (moderate)
 * 1 = Red (severely underfunded)
 */
export function disparityToColor(disparity: number): string {
  const clamped = Math.max(0, Math.min(1, disparity))

  if (clamped < 0.5) {
    // Green to Yellow (0 to 0.5)
    const t = clamped * 2
    const r = Math.round(255 * t)
    const g = 255
    const b = 0
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  } else {
    // Yellow to Red (0.5 to 1)
    const t = (clamped - 0.5) * 2
    const r = 255
    const g = Math.round(255 * (1 - t))
    const b = 0
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }
}

/**
 * Get detailed statistics for a country
 */
export function getCountryStatistics(countryName: string) {
  const disparity = getFundingDisparity(countryName)
  const disparityLevel = disparity < 0.25 ? 'Well-Funded' : disparity < 0.5 ? 'Moderate' : disparity < 0.75 ? 'Under-Resourced' : 'Severely Under-Resourced'

  return {
    disparity,
    disparityLevel,
    color: disparityToColor(disparity),
    preparednessScore: Math.round((1 - disparity) * 100),
    fundingRating: ((1 - disparity) * 5).toFixed(1),
  }
}
