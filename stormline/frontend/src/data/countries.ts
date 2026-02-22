// Countries data file for MapVis Globe
// This file contains polygon data for 190+ countries
// Structure: Array of { name, color, points: [[lon, lat], ...] }

export interface CountryPolygon {
  name: string
  color: string
  points: [number, number][]
}

// Minimal countries dataset - expand with full data as needed
export const COUNTRY_POLYGONS: CountryPolygon[] = [
  {
    name: "United States",
    color: "#0d2060",
    points: [
      [-125, 49], [-125, 25], [-66, 25], [-66, 49], [-125, 49]
    ]
  },
  {
    name: "Canada",
    color: "#0d2060",
    points: [
      [-141, 70], [-141, 42], [-52, 42], [-52, 70], [-141, 70]
    ]
  },
  {
    name: "Brazil",
    color: "#0d2060",
    points: [
      [-74, 5], [-74, -33], [-35, -33], [-35, 5], [-74, 5]
    ]
  },
  {
    name: "Russia",
    color: "#0d2060",
    points: [
      [19, 69], [19, 42], [169, 42], [169, 69], [19, 69]
    ]
  },
  {
    name: "Australia",
    color: "#0d2060",
    points: [
      [113, -10], [113, -44], [154, -44], [154, -10], [113, -10]
    ]
  },
  {
    name: "China",
    color: "#0d2060",
    points: [
      [73, 54], [73, 18], [135, 18], [135, 54], [73, 54]
    ]
  },
  {
    name: "India",
    color: "#0d2060",
    points: [
      [68, 37], [68, 8], [97, 8], [97, 37], [68, 37]
    ]
  },
  {
    name: "Europe",
    color: "#0d2060",
    points: [
      [-10, 71], [-10, 36], [40, 36], [40, 71], [-10, 71]
    ]
  },
  {
    name: "Africa",
    color: "#0d2060",
    points: [
      [-18, 37], [-18, -35], [52, -35], [52, 37], [-18, 37]
    ]
  },
  {
    name: "South America",
    color: "#0d2060",
    points: [
      [-82, 13], [-82, -56], [-35, -56], [-35, 13], [-82, 13]
    ]
  },
]

export const COUNTRY_FACTS: Record<string, string> = {
  "United States": "Has the world's largest economy.",
  "Canada": "Is the world's second-largest country by area.",
  "Brazil": "Is home to about 60% of the Amazon rainforest.",
  "Russia": "Spans 11 time zones across Europe and Asia.",
  "Australia": "Has more than 10,000 beaches.",
  "China": "Is home to over 1.4 billion people.",
  "India": "Is the world's largest democracy.",
  "Europe": "Is composed of 50 countries.",
  "Africa": "Is the world's second-largest continent.",
  "South America": "Contains the Amazon rainforest.",
}
