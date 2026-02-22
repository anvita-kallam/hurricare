# Data Sources & Attribution

This document attributes the sources used for humanitarian response data in HurriCare's simulation engine.

## Primary Data Sources

### OCHA Financial Tracking Service (FTS)
- **URL**: https://fts.unocha.org/
- **Data used**: Humanitarian funding flows, flash appeal requirements, emergency funding totals
- **Hurricanes sourced**: Beryl 2024, Irma 2017, and others tracked as FTS emergencies
- **Citation**: Financial Tracking Service (FTS), managed by OCHA. Data is continuously updated and publicly available.
- Beryl 2024 Emergency Page: https://fts.unocha.org/emergencies/963/summary/2024
- Irma 2017 Regional Response Plan: https://fts.unocha.org/appeals/630/summary

### UN Central Emergency Response Fund (CERF)
- **URL**: https://cerf.un.org/
- **Data used**: Rapid response allocations per disaster, sector/cluster breakdowns
- **Key allocations sourced**:
  - Cyclone Nargis 2008 (Myanmar): US$20.3M across 7 clusters — https://cerf.un.org/sites/default/files/resources/Myanmar%20CERF%20Narrative%20Report%202008.pdf
  - Cyclone Idai 2019 (Mozambique/Zimbabwe/Malawi): US$20M — https://cerf.un.org/news/story/cyclone-idai-cerf-allocates-us20m-ramp-urgent-aid
  - Cyclone Freddy 2023 (Malawi): US$5.5M, (Mozambique): US$10M — https://cerf.un.org/what-we-do/allocation/2023/summary/23-RR-MWI-58010
  - Hurricane Beryl 2024 (Caribbean): US$4M — https://www.unocha.org/publications/report/jamaica/surviving-beryl-how-cerf-funded-assistance-helped-caribbean-rebuild

### FEMA (Federal Emergency Management Agency)
- **URL**: https://www.fema.gov/
- **Data used**: Disaster declarations, federal assistance amounts, affected populations, designated counties
- **Key disasters sourced**:
  - Hurricane Beryl 2024 (DR-4798-TX): $750M+ in FEMA assistance to ~700,000 households — https://www.fema.gov/disaster/4798
  - Hurricane Helene 2024: Multiple disaster declarations (DR-4827-FL through DR-4832-VA)
  - Hurricane Milton 2024 (DR-4834-FL): ~$3.5B in FEMA assistance
  - Hurricane Michael 2018, Florence 2018, Ida 2021, Ian 2022

### ReliefWeb
- **URL**: https://reliefweb.int/
- **Data used**: Situation reports, affected population estimates, humanitarian needs assessments
- **Key reports sourced**:
  - Hurricane Beryl situation reports: https://reliefweb.int/disaster/tc-2024-000105-vct
  - Cyclone Idai situation reports: https://reliefweb.int/disaster/tc-2019-000021-moz
  - Cyclone Freddy situation reports: https://reliefweb.int/report/mozambique/world-bank-mobilizes-150-million-help-mozambique-recover-cyclone-freddy

### NOAA National Hurricane Center
- **URL**: https://www.nhc.noaa.gov/
- **Data used**: Tropical cyclone reports, storm tracks, wind speeds, damage estimates
- **Key reports**:
  - 2025 Atlantic Hurricane Season Summary: https://www.noaa.gov/news-release/2025-atlantic-hurricane-season-marked-by-striking-contrasts
  - Hurricane Beryl TCR: https://www.nhc.noaa.gov/data/tcr/AL022024_Beryl.pdf
  - Hurricane Humberto TCR: https://www.nhc.noaa.gov/data/tcr/AL082025_Humberto.pdf

### PAHO/WHO
- **URL**: https://www.paho.org/
- **Data used**: Health sector response plans, affected population health data
- **Key reports**:
  - Hurricane Melissa 2025 Strategic Response Plan: https://www.paho.org/en/documents/pahowho-strategic-response-plan-hurricane-melissa-2025-impacted-countries-cuba-haiti-and

### IFRC (International Federation of Red Cross and Red Crescent Societies)
- **URL**: https://www.ifrc.org/
- **Data used**: Emergency appeals, shelter response data, beneficiary counts
- **Key responses**: Cyclone Idai, Cyclone Winston, Hurricane Melissa

### World Bank
- **URL**: https://www.worldbank.org/
- **Data used**: Post-disaster needs assessments, recovery funding
- **Key allocations**:
  - Cyclone Freddy 2023 (Mozambique): US$150M CERC — https://www.worldbank.org/en/news/press-release/2023/05/24/world-bank-mobilizes-150-million-to-help-afe-mozambique-recover-from-cyclone-freddy

### Wikipedia
- **URL**: https://en.wikipedia.org/
- **Data used**: Storm metadata, affected population estimates, death tolls, damage totals (cross-referenced with primary sources)
- **Key articles**:
  - 2025 Atlantic Hurricane Season: https://en.wikipedia.org/wiki/2025_Atlantic_hurricane_season
  - Hurricane Melissa (2025): https://en.wikipedia.org/wiki/Hurricane_Melissa_(2025)
  - Hurricane Erin (2025): https://en.wikipedia.org/wiki/Hurricane_Erin_(2025)
  - Hurricane Gabrielle (2025): https://en.wikipedia.org/wiki/Hurricane_Gabrielle_(2025)
  - Hurricane Beryl: https://en.wikipedia.org/wiki/Hurricane_Beryl
  - Effects of Hurricane Beryl in Texas: https://en.wikipedia.org/wiki/Effects_of_Hurricane_Beryl_in_Texas

### UN News
- **URL**: https://news.un.org/
- **Data used**: Humanitarian impact summaries, UN response coordination
- **Key reports**:
  - Hurricane Melissa impact: https://news.un.org/en/story/2025/11/1166261
  - Cyclone Freddy response: https://news.un.org/en/story/2023/03/1134802

### Additional Sources
- **AccuWeather**: Damage estimates for Hurricane Beryl ($28-32B) — https://abc13.com/post/hurricane-beryl-damage-cost-accuweather-estimates-economic-loss/15048656/
- **Moody's RMS**: Insured loss estimates for Hurricane Beryl ($2.5-4.5B)
- **U.S. Department of State**: Hurricane Melissa recovery assistance ($37M) — https://www.state.gov/releases/office-of-the-spokesperson/2025/11/u-s-support-for-hurricane-melissa-recovery
- **European Commission**: EU humanitarian aid for Hurricane Beryl and Melissa — https://civil-protection-humanitarian-aid.ec.europa.eu/
- **CCRIF SPC**: Caribbean catastrophe risk insurance payouts for Grenada ($44M) — https://www.ccrif.org/
- **Center for Disaster Philanthropy**: 2025 hurricane season analysis — https://disasterphilanthropy.org/disasters/2025-atlantic-hurricane-season/

## Data Notes

### Severity Index
The severity index (0.0-1.0) is derived from a combination of:
- Infrastructure damage reports (% buildings damaged/destroyed)
- Population displacement ratios
- Emergency declaration severity levels
- Post-disaster needs assessment scores

For hurricanes where official severity indices are not available, values are estimated based on reported damage metrics from the sources above, calibrated against hurricanes with known severity data.

### Project/Funding Data
- Project budgets for international disasters (CERF/FTS-tracked) reflect actual reported humanitarian funding flows
- Project budgets for U.S. domestic disasters reflect a combination of FEMA Individual Assistance, Red Cross disaster relief, and other domestic humanitarian aid
- Beneficiary counts are sourced from implementing partner reports where available, or estimated from funding/cost-per-person ratios
- `pooled_fund=True` indicates funding through UN pooled mechanisms (CERF, country-based pooled funds); `pooled_fund=False` indicates bilateral or domestic funding

### Ideal Response Plans
Sector allocation data in ideal response plans is derived from:
- Actual flash appeal sector breakdowns (where available from FTS)
- CERF allocation reports with cluster-level detail
- Humanitarian response plan requirements documents
- Where sector-specific data is unavailable, allocations follow UN humanitarian cluster standard proportions based on disaster type and affected population size
