// Region name translations
// Maps English region names to Turkish (Türkçe) labels

export const REGION_TRANSLATIONS = {
  // Americas / Amerika Kıtası
  'North America': 'Kuzey Amerika',
  'Mexico': 'Meksika',
  'Central America': 'Orta Amerika',
  'South America': 'Güney Amerika',
  
  // North Atlantic / Kuzey Atlantik
  'Greenland': 'Grönland',
  'Iceland': 'İzlanda',
  
  // Europe / Avrupa
  'UK-Ireland': 'Birleşik Krallık-İrlanda',
  'Scandinavia': 'İskandinavya',
  'Western Europe': 'Batı Avrupa',
  'Eastern Europe': 'Doğu Avrupa',
  
  // Eurasia / Avrasya
  'Russia': 'Rusya',
  'Central Asia': 'Orta Asya',
  
  // Asia / Asya
  'China': 'Çin',
  'Mongolia': 'Moğolistan',
  'Japan': 'Japonya',
  'Korea': 'Kore',
  'Southeast Asia': 'Güneydoğu Asya',
  'Philippines': 'Filipinler',
  'South Asia': 'Güney Asya',
  
  // Middle East / Orta Doğu
  'Middle East': 'Orta Doğu',
  
  // Africa / Afrika
  'North Africa': 'Kuzey Afrika',
  'West Africa': 'Batı Afrika',
  'Central-East Africa': 'Orta-Doğu Afrika',
  'South Africa': 'Güney Afrika',
  
  // Oceania / Okyanusya
  'Australia': 'Avustralya',
  'New Zealand': 'Yeni Zelanda',
};

// Get translated region name
export const getRegionName = (englishName, language = 'en') => {
  if (language === 'tr') {
    return REGION_TRANSLATIONS[englishName] || englishName;
  }
  return englishName;
};

// Get all region names in specified language
export const getAllRegionNames = (language = 'en') => {
  const regions = Object.keys(REGION_TRANSLATIONS);
  if (language === 'tr') {
    return regions.map(region => REGION_TRANSLATIONS[region]);
  }
  return regions;
};

// Region groupings for easier navigation
export const REGION_GROUPS = {
  'Americas': ['North America', 'Mexico', 'Central America', 'South America'],
  'Europe': ['UK-Ireland', 'Scandinavia', 'Western Europe', 'Eastern Europe', 'Russia'],
  'Asia': ['Central Asia', 'China', 'Mongolia', 'Japan', 'Korea', 'Southeast Asia', 'Philippines', 'South Asia'],
  'Middle East': ['Middle East'],
  'Africa': ['North Africa', 'West Africa', 'Central-East Africa', 'South Africa'],
  'Oceania': ['Australia', 'New Zealand'],
  'Atlantic': ['Greenland', 'Iceland'],
};

// Get region group
export const getRegionGroup = (regionName) => {
  for (const [group, regions] of Object.entries(REGION_GROUPS)) {
    if (regions.includes(regionName)) {
      return group;
    }
  }
  return 'Other';
};

// Region colors for game/visualization (optional)
export const REGION_COLORS = {
  'North America': '#4CAF50',
  'Mexico': '#8BC34A',
  'Central America': '#CDDC39',
  'South America': '#FFEB3B',
  'Greenland': '#E3F2FD',
  'Iceland': '#BBDEFB',
  'UK-Ireland': '#90CAF9',
  'Scandinavia': '#64B5F6',
  'Western Europe': '#42A5F5',
  'Eastern Europe': '#2196F3',
  'Russia': '#1E88E5',
  'Central Asia': '#1976D2',
  'China': '#F44336',
  'Mongolia': '#E91E63',
  'Japan': '#9C27B0',
  'Korea': '#673AB7',
  'Southeast Asia': '#3F51B5',
  'Philippines': '#2196F3',
  'South Asia': '#03A9F4',
  'Middle East': '#00BCD4',
  'North Africa': '#009688',
  'West Africa': '#4CAF50',
  'Central-East Africa': '#8BC34A',
  'South Africa': '#CDDC39',
  'Australia': '#FF9800',
  'New Zealand': '#FF5722',
};

// Get region color
export const getRegionColor = (regionName, owned = false) => {
  const baseColor = REGION_COLORS[regionName] || '#9E9E9E';
  if (owned) {
    return baseColor;
  }
  return '#E0E0E0'; // Neutral color for unowned regions
};
