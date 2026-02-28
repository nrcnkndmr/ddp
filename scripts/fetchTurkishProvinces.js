/**
 * TÜRKİYE İL SINIRLARINI İNDİR VE SVG'YE DÖNÜŞTÜR
 * Kaynak: Natural Earth Data (Public Domain / CC0)
 * Admin Level 1 (States/Provinces) - Türkiye için 81 il
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Natural Earth Admin-1 States/Provinces (Medium scale 1:10m - daha detaylı)
const GEOJSON_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson';

// İl isimleri mapping (GeoJSON'daki isim -> Türkçe isim)
const PROVINCE_NAMES = {
  'Adana': 'Adana',
  'Adıyaman': 'Adıyaman',
  'Afyonkarahisar': 'Afyonkarahisar',
  'Ağrı': 'Ağrı',
  'Amasya': 'Amasya',
  'Ankara': 'Ankara',
  'Antalya': 'Antalya',
  'Artvin': 'Artvin',
  'Aydın': 'Aydın',
  'Balıkesir': 'Balıkesir',
  'Bilecik': 'Bilecik',
  'Bingöl': 'Bingöl',
  'Bitlis': 'Bitlis',
  'Bolu': 'Bolu',
  'Burdur': 'Burdur',
  'Bursa': 'Bursa',
  'Çanakkale': 'Çanakkale',
  'Çankırı': 'Çankırı',
  'Çorum': 'Çorum',
  'Denizli': 'Denizli',
  'Diyarbakır': 'Diyarbakır',
  'Edirne': 'Edirne',
  'Elazığ': 'Elazığ',
  'Erzincan': 'Erzincan',
  'Erzurum': 'Erzurum',
  'Eskişehir': 'Eskişehir',
  'Gaziantep': 'Gaziantep',
  'Giresun': 'Giresun',
  'Gümüşhane': 'Gümüşhane',
  'Hakkari': 'Hakkari',
  'Hatay': 'Hatay',
  'Isparta': 'Isparta',
  'Mersin': 'Mersin',
  'İstanbul': 'İstanbul',
  'İzmir': 'İzmir',
  'Kars': 'Kars',
  'Kastamonu': 'Kastamonu',
  'Kayseri': 'Kayseri',
  'Kırklareli': 'Kırklareli',
  'Kırşehir': 'Kırşehir',
  'Kocaeli': 'Kocaeli',
  'Konya': 'Konya',
  'Kütahya': 'Kütahya',
  'Malatya': 'Malatya',
  'Manisa': 'Manisa',
  'Kahramanmaraş': 'Kahramanmaraş',
  'Mardin': 'Mardin',
  'Muğla': 'Muğla',
  'Muş': 'Muş',
  'Nevşehir': 'Nevşehir',
  'Niğde': 'Niğde',
  'Ordu': 'Ordu',
  'Rize': 'Rize',
  'Sakarya': 'Sakarya',
  'Samsun': 'Samsun',
  'Siirt': 'Siirt',
  'Sinop': 'Sinop',
  'Sivas': 'Sivas',
  'Tekirdağ': 'Tekirdağ',
  'Tokat': 'Tokat',
  'Trabzon': 'Trabzon',
  'Tunceli': 'Tunceli',
  'Şanlıurfa': 'Şanlıurfa',
  'Uşak': 'Uşak',
  'Van': 'Van',
  'Yozgat': 'Yozgat',
  'Zonguldak': 'Zonguldak',
  'Aksaray': 'Aksaray',
  'Bayburt': 'Bayburt',
  'Karaman': 'Karaman',
  'Kırıkkale': 'Kırıkkale',
  'Batman': 'Batman',
  'Şırnak': 'Şırnak',
  'Bartın': 'Bartın',
  'Ardahan': 'Ardahan',
  'Iğdır': 'Iğdır',
  'Yalova': 'Yalova',
  'Karabük': 'Karabük',
  'Kilis': 'Kilis',
  'Osmaniye': 'Osmaniye',
  'Düzce': 'Düzce'
};

// Equirectangular projection - 1600x800 ölçek (2x)
function latLngToSVG(lat, lng) {
  const x = (lng + 180) * (1600 / 360);
  const y = (90 - lat) * (800 / 180);
  return { x, y };
}

// Douglas-Peucker simplification algoritması
function simplifyPath(points, tolerance) {
  if (points.length <= 2) return points;
  
  let maxDistance = 0;
  let maxIndex = 0;
  const end = points.length - 1;
  
  for (let i = 1; i < end; i++) {
    const distance = perpendicularDistance(points[i], points[0], points[end]);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }
  
  if (maxDistance > tolerance) {
    const left = simplifyPath(points.slice(0, maxIndex + 1), tolerance);
    const right = simplifyPath(points.slice(maxIndex), tolerance);
    return left.slice(0, -1).concat(right);
  } else {
    return [points[0], points[end]];
  }
}

function perpendicularDistance(point, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const mag = Math.sqrt(dx * dx + dy * dy);
  if (mag > 0) {
    const u = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (mag * mag);
    const ix = lineStart.x + u * dx;
    const iy = lineStart.y + u * dy;
    return Math.sqrt(Math.pow(point.x - ix, 2) + Math.pow(point.y - iy, 2));
  }
  return Math.sqrt(Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2));
}

// GeoJSON koordinatlarını SVG path'e dönüştür
function coordinatesToSVGPath(coordinates, simplifyFactor = 0.5) {
  if (!coordinates || coordinates.length === 0) return '';
  
  let paths = [];
  
  if (coordinates[0][0] && Array.isArray(coordinates[0][0])) {
    // MultiPolygon veya Polygon with holes
    coordinates.forEach(polygon => {
      const points = polygon.map(([lng, lat]) => latLngToSVG(lat, lng));
      const simplified = simplifyPath(points, simplifyFactor);
      
      if (simplified.length >= 3) {
        const pathStr = simplified.map((p, i) => 
          `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`
        ).join(' ') + ' Z';
        paths.push(pathStr);
      }
    });
  } else {
    // Simple Polygon
    const points = coordinates.map(([lng, lat]) => latLngToSVG(lat, lng));
    const simplified = simplifyPath(points, simplifyFactor);
    
    if (simplified.length >= 3) {
      const pathStr = simplified.map((p, i) => 
        `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`
      ).join(' ') + ' Z';
      paths.push(pathStr);
    }
  }
  
  return paths.join(' ');
}

// Merkez noktası hesapla
function calculateCenter(coordinates) {
  let allPoints = [];
  
  if (coordinates[0][0] && Array.isArray(coordinates[0][0])) {
    coordinates.forEach(polygon => {
      polygon.forEach(([lng, lat]) => {
        allPoints.push(latLngToSVG(lat, lng));
      });
    });
  } else {
    allPoints = coordinates.map(([lng, lat]) => latLngToSVG(lat, lng));
  }
  
  if (allPoints.length === 0) return { x: 0, y: 0 };
  
  const sumX = allPoints.reduce((sum, p) => sum + p.x, 0);
  const sumY = allPoints.reduce((sum, p) => sum + p.y, 0);
  
  return {
    x: Math.round((sumX / allPoints.length) * 10) / 10,
    y: Math.round((sumY / allPoints.length) * 10) / 10
  };
}

// GeoJSON'ı indir
function downloadGeoJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      // Redirect kontrolü
      if (res.statusCode === 301 || res.statusCode === 302) {
        downloadGeoJSON(res.headers.location).then(resolve).catch(reject);
        return;
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }
      
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          console.error('JSON Parse Hatası. İlk 100 karakter:', data.substring(0, 100));
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Ana işlem
async function main() {
  console.log('🇹🇷 Türkiye il sınırları indiriliyor (Natural Earth Data)...');
  
  try {
    const geoJSON = await downloadGeoJSON(GEOJSON_URL);
    console.log(`✅ GeoJSON indirildi - ${geoJSON.features.length} özellik bulundu`);
    
    // Sadece Türkiye illerini filtrele
    const turkeyProvinces = geoJSON.features.filter(feature => {
      const props = feature.properties;
      const country = props.admin || props.adm0_a3 || props.iso_a2;
      return country === 'Turkey' || country === 'TUR' || country === 'TR';
    });
    
    console.log(`🇹🇷 ${turkeyProvinces.length} Türkiye ili bulundu`);
    
    const provinces = {};
    let processedCount = 0;
    
    turkeyProvinces.forEach(feature => {
      const props = feature.properties;
      const provinceName = props.name || props.name_tr || props.name_en || props.woe_name;
      
      if (!provinceName) {
        console.log(`⚠️  İsim bulunamadı:`, Object.keys(props));
        return;
      }
      
      // Türkçe isme çevir
      const name = PROVINCE_NAMES[provinceName] || provinceName;
      const key = name.toLowerCase()
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ı/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/İ/g, 'i')
        .replace(/\s+/g, '');
      
      const geometry = feature.geometry;
      let coordinates;
      
      if (geometry.type === 'Polygon') {
        coordinates = geometry.coordinates[0]; // Outer ring
      } else if (geometry.type === 'MultiPolygon') {
        coordinates = geometry.coordinates.map(poly => poly[0]);
      } else {
        console.log(`⚠️  Desteklenmeyen geometri tipi: ${geometry.type} - ${name}`);
        return;
      }
      
      const path = coordinatesToSVGPath(coordinates, 0.5); // Orta seviye basitleştirme
      const center = calculateCenter(coordinates);
      
      if (path && center) {
        provinces[key] = {
          name,
          path,
          center
        };
        processedCount++;
        console.log(`  ✓ ${name}`);
      }
    });
    
    console.log(`\n✅ ${processedCount} il işlendi`);
    
    // ProvinceData.js dosyasını oluştur
    const output = `/**
 * TÜRKİYE İL SINIR VERİLERİ
 * Natural Earth / OpenStreetMap verilerinden üretilmiştir
 * Koordinatlar: 1600x800 ölçek (Equirectangular projection)
 */

export const TURKEY_PROVINCES = ${JSON.stringify(provinces, null, 2)};

// Diğer ülkeler için il verileri buraya eklenebilir
export const COUNTRY_PROVINCES = {
  'Türkiye': TURKEY_PROVINCES,
  // Diğer ülkeler için:
  // 'ABD': USA_STATES,
  // 'Fransa': FRANCE_REGIONS,
  // vb.
};

// Bir ülkenin illlerini getir
export function getProvincesForCountry(countryName) {
  return COUNTRY_PROVINCES[countryName] || null;
}
`;
    
    const outputPath = path.join(__dirname, '..', 'src', 'data', 'ProvinceData.js');
    fs.writeFileSync(outputPath, output, 'utf8');
    
    console.log(`\n📝 Dosya oluşturuldu: ${outputPath}`);
    console.log(`\n✨ İşlem tamamlandı!`);
    
  } catch (error) {
    console.error('❌ Hata:', error.message);
    process.exit(1);
  }
}

main();
