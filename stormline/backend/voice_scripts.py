"""
Hard-coded 10-second personal account scripts for each hurricane.
Each script: max ~25 words (10 sec at 150 wpm). Includes specific event/location + personal detail.
"""
# hurricane_id -> script_text
SCRIPTS = {
    "katrina_2005": (
        "I'm from the Ninth Ward. When the levees broke during Katrina, our whole block flooded. "
        "We lost everything. Please remember us."
    ),
    "sandy_2012": (
        "I lived in Breezy Point. Sandy brought fire and flood together. "
        "Over a hundred homes burned. We lost everything."
    ),
    "maria_2017": (
        "I'm from Puerto Rico. Maria destroyed our power grid. We had no light for months. "
        "My grandma's roof flew off in Yabucoa. We need help."
    ),
    "harvey_2017": (
        "I'm from Houston. Harvey wouldn't leave. Addicks Reservoir filled, we evacuated. "
        "Our car drowned. Everything underwater."
    ),
    "haiyan_2013": (
        "I'm from Tacloban. Haiyan's storm surge was a wall of water. "
        "It took my uncle. The Philippines will never forget Yolanda."
    ),
    "dorian_2019": (
        "I'm from Marsh Harbour, Abaco. Dorian sat on us for two days. "
        "Everything flattened. The airport gone. Bahamas still healing."
    ),
    "irma_2017": (
        "I'm from Barbuda. Irma destroyed ninety-five percent of our island. "
        "We had to flee to Antigua. There was nothing left."
    ),
    "michael_2018": (
        "I'm from Mexico Beach. Michael was Cat 5. House swept off its foundation. "
        "Panama City looked like a war zone."
    ),
    "florence_2018": (
        "I'm from Wilmington. Florence sat over the Carolinas for days. "
        "Cape Fear River rose, flooded our farm. We lost the crop."
    ),
    "ida_2021": (
        "I'm from LaPlace. Ida hit on Katrina's anniversary. Highway 51 flooded. "
        "Hours of terror. The whole New Orleans area lost power."
    ),
    "ian_2022": (
        "I'm from Fort Myers. Ian took out the Sanibel Causeway. "
        "We were cut off. Our beach house on Sanibel, gone."
    ),
    "fiona_2022": (
        "I'm from Puerto Rico. Fiona hit five years after Maria. "
        "The power went again. We're still rebuilding. We need support."
    ),
    "wilma_2005": (
        "I'm from Cancun. Wilma stalled for days. Our hotel was destroyed. "
        "The Keys got hit next. Worst storm I ever saw."
    ),
    "rita_2005": (
        "I'm from Lake Charles. We evacuated for Rita after Katrina. "
        "Cameron Parish was wiped. Our fishing boats are gone."
    ),
    "ike_2008": (
        "I'm from Galveston. Ike's surge covered the island. "
        "Bolivar Peninsula was erased. We lost our home to the sea."
    ),
    "gustav_2008": (
        "I'm from Haiti. Gustav hit us first before Louisiana. "
        "Our village flooded. Then it hit Cuba. We had nothing."
    ),
    "cyclone_nargis_2008": (
        "I'm from the Irrawaddy Delta. Nargis killed a hundred thousand. "
        "Bogalay lost ten thousand. Our rice fields became sea."
    ),
    "cyclone_pam_2015": (
        "I'm from Vanuatu. Pam was Cat 5. "
        "Our whole island devastated. Ninety percent of buildings damaged."
    ),
    "typhoon_mangkhut_2018": (
        "I'm from the Philippines. Mangkhut brought landslides and floods. "
        "Hong Kong was hit too. Our village was buried."
    ),
    "cyclone_idai_2019": (
        "I'm from Beira, Mozambique. Idai flooded the city. "
        "Malawi and Zimbabwe too. Thousands died. We lost everything."
    ),
    "typhoon_goni_2020": (
        "I'm from Bicol. Goni was the strongest landfall. "
        "Our house in Catanduanes destroyed. Winds unbelievable."
    ),
    "cyclone_amphan_2020": (
        "I'm from the Sundarbans. Amphan hit India and Bangladesh. "
        "Our mud house washed away. The delta will take years to heal."
    ),
    "cyclone_freddy_2023": (
        "I'm from Malawi. Freddy was the longest cyclone. "
        "It came back twice. Rains never stopped. Thousands died."
    ),
    "typhoon_meranti_2016": (
        "I'm from Taiwan. Meranti was strongest that year. "
        "Xiamen and Fujian hit hard. Our fishing boats gone."
    ),
    "cyclone_winston_2016": (
        "I'm from Fiji. Winston was strongest in the South Pacific. "
        "Entire villages flattened. Still rebuilding."
    ),
    "typhoon_hagibis_2019": (
        "I'm from Japan. Hagibis flooded Tokyo and the Kanto region. "
        "The rugby World Cup was disrupted. Rivers overflowed everywhere."
    ),
    "cyclone_yarin_2023": (
        "I'm from the Bay of Bengal. Yarin brought heavy rain and surge. "
        "Bangladesh and India evacuated millions. We feared another Nargis."
    ),
    "typhoon_jebi_2018": (
        "I'm from Osaka. Jebi flooded Kansai Airport. "
        "A tanker hit the bridge. The strongest typhoon in twenty-five years."
    ),
    "cyclone_fani_2019": (
        "I'm from Odisha. Fani hit Puri as Cat 5. "
        "A million evacuated. Bhubaneswar devastated."
    ),
    "typhoon_lekima_2019": (
        "I'm from Zhejiang. Lekima was the strongest to hit in years. "
        "Flooding and landslides. We lost our tea farm."
    ),
    "cyclone_taau_2016": (
        "I'm from Samoa. Taau brought destructive winds and surf. "
        "Our coastal village was damaged. The Pacific islands suffer every season."
    ),
    "typhoon_rammasun_2014": (
        "I'm from Hainan. Rammasun hit as a super typhoon. "
        "The strongest in decades. Our coconut trees were stripped bare."
    ),
    "cyclone_phailin_2013": (
        "I'm from Odisha. Phailin forced a million to evacuate. "
        "Gopalpur devastated. The surge was huge."
    ),
    "typhoon_haikui_2012": (
        "I'm from Shanghai. Haikui brought record rain. "
        "Millions evacuated. The city flooded. Worst typhoon in years."
    ),
    "cyclone_ocha_2015": (
        "I'm from Yemen. Chapala and Megh hit us. "
        "Socotra devastated. We're not used to cyclones."
    ),
    "typhoon_chanthu_2021": (
        "I'm from the Philippines. Chanthu was a super typhoon. "
        "Batanes took the worst. Islands isolated."
    ),
    "typhoon_doksuri_2023": (
        "I'm from Fujian. Doksuri brought catastrophic rain. "
        "Beijing flooded. Never seen rain like that."
    ),
    "typhoon_saola_2023": (
        "I'm from Hong Kong. Saola brought the highest signal. "
        "We sheltered for days. City shut down."
    ),
    "cyclone_tej_2023": (
        "I'm from Oman. Tej made rare landfall. "
        "Yemen and Socotra were hit. We're not prepared for cyclones."
    ),
    "beryl_2024": (
        "I'm from Barbados. Beryl was earliest Cat 4 ever. "
        "Carriacou flattened. Caribbean storms getting stronger."
    ),
    "milton_2024": (
        "I'm from Florida. Milton threatened Tampa as Cat 5. "
        "We evacuated. Gulf Coast can't catch a break."
    ),
    "helene_2024": (
        "I'm from North Carolina. Helene brought catastrophic flooding. "
        "Mountains cut off. Whole towns underwater."
    ),
    "melissa_2025": (
        "I lived through the storm. We lost our home and everything we had. "
        "Please support hurricane relief. Every family deserves help."
    ),
    "erin_2025": (
        "The storm took everything. Our house, our memories. "
        "We're survivors but we need aid. Please don't forget us."
    ),
    "humberto_2025": (
        "We evacuated with nothing. The storm was relentless. "
        "Our community is broken. Help us rebuild."
    ),
    "gabrielle_2025": (
        "I'm a survivor. The winds and flood took it all. "
        "We need support to start again. Thank you for caring."
    ),
}

# Voice index per hurricane (0-14) for variety
def get_voice_index(hurricane_id: str) -> int:
    h = sum(ord(c) for c in hurricane_id)
    return h % 15
