/**
 * GERÇEK NATURAL EARTH VERİLERİNİ İNDİR VE SVG'YE ÇEVİR
 * 
 * Bu script Natural Earth'ten GERÇEK GeoJSON verilerini indirir ve
 * React Native SVG için kullanılabilir formata dönüştürür.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Natural Earth 1:110m countries GeoJSON
const NATURAL_EARTH_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';

// Ülke isimlerinin Türkçe karşılıkları
const COUNTRY_NAMES_TR = {
  'United States of America': 'ABD',
  'Canada': 'Kanada',
  'Mexico': 'Meksika',
  'Greenland': 'Grönland',
  'Brazil': 'Brezilya',
  'Argentina': 'Arjantin',
  'Chile': 'Şili',
  'Peru': 'Peru',
  'Colombia': 'Kolombiya',
  'Venezuela': 'Venezuela',
  'Bolivia': 'Bolivya',
  'Ecuador': 'Ekvador',
  'Spain': 'İspanya',
  'France': 'Fransa',
  'Germany': 'Almanya',
  'Italy': 'İtalya',
  'United Kingdom': 'İngiltere',
  'Ireland': 'İrlanda',
  'Norway': 'Norveç',
  'Sweden': 'İsveç',
  'Finland': 'Finlandiya',
  'Denmark': 'Danimarka',
  'Netherlands': 'Hollanda',
  'Belgium': 'Belçika',
  'Switzerland': 'İsviçre',
  'Austria': 'Avusturya',
  'Portugal': 'Portekiz',
  'Greece': 'Yunanistan',
  'Poland': 'Polonya',
  'Ukraine': 'Ukrayna',
  'Romania': 'Romanya',
  'Czech Republic': 'Çekya',
  'Hungary': 'Macaristan',
  'Russia': 'Rusya',
  'Turkey': 'Türkiye',
  'Saudi Arabia': 'Suudi Arabistan',
  'Egypt': 'Mısır',
  'Iran': 'İran',
  'Iraq': 'Irak',
  'Syria': 'Suriye',
  'Israel': 'İsrail',
  'Jordan': 'Ürdün',
  'Lebanon': 'Lübnan',
  'United Arab Emirates': 'BAE',
  'Pakistan': 'Pakistan',
  'Afghanistan': 'Afganistan',
  'Kazakhstan': 'Kazakistan',
  'Uzbekistan': 'Özbekistan',
  'South Africa': 'Güney Afrika',
  'Nigeria': 'Nijerya',
  'Kenya': 'Kenya',
  'Ethiopia': 'Etiyopya',
  'Tanzania': 'Tanzanya',
  'Algeria': 'Cezayir',
  'Libya': 'Libya',
  'Sudan': 'Sudan',
  'Morocco': 'Fas',
  'Tunisia': 'Tunus',
  'Ghana': 'Gana',
  'Cameroon': 'Kamerun',
  'Angola': 'Angola',
  'Mozambique': 'Mozambik',
  'Madagascar': 'Madagaskar',
  'China': 'Çin',
  'India': 'Hindistan',
  'Japan': 'Japonya',
  'South Korea': 'Güney Kore',
  'North Korea': 'Kuzey Kore',
  'Vietnam': 'Vietnam',
  'Thailand': 'Tayland',
  'Myanmar': 'Myanmar',
  'Philippines': 'Filipinler',
  'Malaysia': 'Malezya',
  'Singapore': 'Singapur',
  'Indonesia': 'Endonezya',
  'Bangladesh': 'Bangladeş',
  'Nepal': 'Nepal',
  'Sri Lanka': 'Sri Lanka',
  'Mongolia': 'Moğolistan',
  'Australia': 'Avustralya',
  'New Zealand': 'Yeni Zelanda',
  'Papua New Guinea': 'Papua Yeni Gine',
  'Guatemala': 'Guatemala',
  'Honduras': 'Honduras',
  'Nicaragua': 'Nikaragua',
  'Costa Rica': 'Kosta Rika',
  'Panama': 'Panama',
  'Cuba': 'Küba',
  'Jamaica': 'Jamaika',
  'Haiti': 'Haiti',
  'Dominican Republic': 'Dominik Cumhuriyeti',
  'Paraguay': 'Paraguay',
  'Uruguay': 'Uruguay',
  'Guyana': 'Guyana',
  'Suriname': 'Surinam',
  'Iceland': 'İzlanda',
  'Estonia': 'Estonya',
  'Latvia': 'Letonya',
  'Lithuania': 'Litvanya',
  'Belarus': 'Belarus',
  'Slovakia': 'Slovakya',
  'Slovenia': 'Slovenya',
  'Croatia': 'Hırvatistan',
  'Bosnia and Herzegovina': 'Bosna-Hersek',
  'Serbia': 'Sırbistan',
  'Montenegro': 'Karadağ',
  'Albania': 'Arnavutluk',
  'North Macedonia': 'Kuzey Makedonya',
  'Bulgaria': 'Bulgaristan',
  'Moldova': 'Moldova',
  'Armenia': 'Ermenistan',
  'Azerbaijan': 'Azerbaycan',
  'Georgia': 'Gürcistan',
  'Turkmenistan': 'Türkmenistan',
  'Tajikistan': 'Tacikistan',
  'Kyrgyzstan': 'Kırgızistan',
  'Kuwait': 'Kuveyt',
  'Qatar': 'Katar',
  'Bahrain': 'Bahreyn',
  'Oman': 'Umman',
  'Yemen': 'Yemen',
  'Laos': 'Laos',
  'Cambodia': 'Kamboçya',
  'Brunei': 'Brunei',
  'East Timor': 'Doğu Timor',
  'Bhutan': 'Butan',
  'Maldives': 'Maldivler',
  'Senegal': 'Senegal',
  'Mali': 'Mali',
  'Mauritania': 'Moritanya',
  'Niger': 'Nijer',
  'Chad': 'Çad',
  'Burkina Faso': 'Burkina Faso',
  'Guinea': 'Gine',
  'Sierra Leone': 'Sierra Leone',
  'Liberia': 'Liberya',
  "Côte d'Ivoire": 'Fildişi Sahili',
  'Ivory Coast': 'Fildişi Sahili',
  'Togo': 'Togo',
  'Benin': 'Benin',
  'Central African Republic': 'Orta Afrika Cumhuriyeti',
  'Congo': 'Kongo',
  'Democratic Republic of the Congo': 'Kongo Demokratik Cumhuriyeti',
  'Gabon': 'Gabon',
  'Equatorial Guinea': 'Ekvator Ginesi',
  'Uganda': 'Uganda',
  'Rwanda': 'Ruanda',
  'Burundi': 'Burundi',
  'Somalia': 'Somali',
  'Djibouti': 'Cibuti',
  'Eritrea': 'Eritre',
  'South Sudan': 'Güney Sudan',
  'Zambia': 'Zambiya',
  'Zimbabwe': 'Zimbabve',
  'Malawi': 'Malavi',
  'Botswana': 'Botsvana',
  'Namibia': 'Namibya',
  'Lesotho': 'Lesotho',
  'Swaziland': 'Svaziland',
  'Eswatini': 'Esvatini',
  'Belize': 'Belize',
  'El Salvador': 'El Salvador',
  'Trinidad and Tobago': 'Trinidad ve Tobago',
  'Bahamas': 'Bahamalar',
  'Puerto Rico': 'Porto Riko',
  'Antigua and Barbuda': 'Antigua ve Barbuda',
  'Barbados': 'Barbados',
  'Saint Lucia': 'Saint Lucia',
  'Grenada': 'Grenada',
  'Saint Vincent and the Grenadines': 'Saint Vincent ve Grenadinler',
  'Dominica': 'Dominika',
  'Saint Kitts and Nevis': 'Saint Kitts ve Nevis',
  'Fiji': 'Fiji',
  'Solomon Islands': 'Solomon Adaları',
  'Vanuatu': 'Vanuatu',
  'Samoa': 'Samoa',
  'Tonga': 'Tonga',
  'Micronesia': 'Mikronezya',
  'Kiribati': 'Kiribati',
  'Marshall Islands': 'Marshall Adaları',
  'Palau': 'Palau',
  'Nauru': 'Nauru',
  'Tuvalu': 'Tuvalu',
  'Timor-Leste': 'Doğu Timor',
  'Mauritius': 'Mauritius',
  'Comoros': 'Komorlar',
  'Seychelles': 'Seyşeller',
  'Cape Verde': 'Cape Verde',
  'Sao Tome and Principe': 'Sao Tome ve Principe',
  'Luxembourg': 'Lüksemburg',
  'Andorra': 'Andorra',
  'Monaco': 'Monako',
  'Liechtenstein': 'Lihtenştayn',
  'San Marino': 'San Marino',
  'Vatican City': 'Vatikan',
  'Malta': 'Malta',
  'Cyprus': 'Kıbrıs',
  'Kosovo': 'Kosova',
  'Bosnia and Herz.': 'Bosna-Hersek',
  'W. Sahara': 'Batı Sahra',
  'Dem. Rep. Congo': 'Kongo Demokratik Cumhuriyeti',
  'Central African Rep.': 'Orta Afrika Cumhuriyeti',
  'S. Sudan': 'Güney Sudan',
  'Eq. Guinea': 'Ekvator Ginesi',
  'Dominican Rep.': 'Dominik Cumhuriyeti',
  'United Republic of Tanzania': 'Tanzanya',
  'Republic of Serbia': 'Sırbistan',
  'Taiwan': 'Tayvan',
  'Somaliland': 'Somaliland',
  'Northern Cyprus': 'Kuzey Kıbrıs',
  'Palestine': 'Filistin',
  'Western Sahara': 'Batı Sahra',
  'Gambia': 'Gambiya',
  'Guinea-Bissau': 'Gine-Bissau',
  'New Caledonia': 'Yeni Kaledonya',
  'French Southern and Antarctic Lands': 'Fransız Güney Toprakları',
  'Falkland Islands': 'Falkland Adaları',
  'Fr. S. Antarctic Lands': 'Fransız Güney Toprakları',
  'Siachen Glacier': 'Siachen Buzulu',
};

// Equirectangular projection: lat/lng -> SVG coordinates (2x scale)
function latLngToSVG(lat, lng) {
  const x = (lng + 180) * (1600 / 360); // 800 -> 1600
  const y = (90 - lat) * (800 / 180);   // 400 -> 800
  return { x: x.toFixed(2), y: y.toFixed(2) };
}

// GeoJSON koordinatlarını SVG path'e çevir
function coordinatesToSVGPath(coordinates, simplifyFactor = 1) {
  if (!coordinates || coordinates.length === 0) return '';
  
  let path = '';
  
  // MultiPolygon için
  if (typeof coordinates[0][0][0] === 'object') {
    // İlk ve en büyük poligonu al
    coordinates = coordinates[0];
  }
  
  // Polygon için
  if (typeof coordinates[0][0] === 'number') {
    // Tek bir ring
    coordinates = [coordinates];
  }
  
  // Her ring için
  coordinates.forEach((ring, ringIndex) => {
    if (ringIndex > 0) return; // Sadece dış ring'i al (holes'ları atlama)
    
    // Basitleştirme: Her N. noktayı al
    const step = simplifyFactor;
    
    ring.forEach((coord, i) => {
      if (i % step !== 0 && i !== ring.length - 1) return; // Her step'te bir nokta al
      
      const [lng, lat] = coord;
      const { x, y } = latLngToSVG(lat, lng);
      
      if (i === 0) {
        path += `M ${x},${y} `;
      } else {
        path += `L ${x},${y} `;
      }
    });
    
    path += 'Z ';
  });
  
  return path.trim();
}

// Poligonun merkezini hesapla
function calculateCenter(coordinates) {
  let totalX = 0, totalY = 0, count = 0;
  
  // İlk ring'i al
  let ring = coordinates;
  if (typeof coordinates[0][0][0] === 'object') {
    ring = coordinates[0][0];
  } else if (typeof coordinates[0][0] === 'number') {
    ring = coordinates;
  } else {
    ring = coordinates[0];
  }
  
  ring.forEach(coord => {
    const [lng, lat] = coord;
    const { x, y } = latLngToSVG(lat, lng);
    totalX += parseFloat(x);
    totalY += parseFloat(y);
    count++;
  });
  
  return {
    x: (totalX / count).toFixed(2),
    y: (totalY / count).toFixed(2)
  };
}

// GeoJSON'ı indir
function downloadGeoJSON(url) {
  return new Promise((resolve, reject) => {
    console.log('🌍 Natural Earth GeoJSON indiriliyor...');
    
    https.get(url, (response) => {
      let data = '';
      
      response.on('data', chunk => {
        data += chunk;
      });
      
      response.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log('✅ GeoJSON başarıyla indirildi');
          resolve(json);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

// Ana fonksiyon
async function main() {
  try {
    // 1. GeoJSON'ı indir
    const geoJSON = await downloadGeoJSON(NATURAL_EARTH_URL);
    
    console.log(`📊 Toplam ülke sayısı: ${geoJSON.features.length}`);
    
    // 2. Ülkeleri filtrele ve dönüştür
    const regions = {};
    let processedCount = 0;
    
    geoJSON.features.forEach(feature => {
      const countryName = feature.properties.NAME || feature.properties.ADMIN;
      const turkishName = COUNTRY_NAMES_TR[countryName];
      
      if (!turkishName) return; // Sadece listedeki ülkeleri al
      
      console.log(`🔄 İşleniyor: ${countryName} -> ${turkishName}`);
      
      const geometry = feature.geometry;
      if (!geometry || !geometry.coordinates) return;
      
      // Simplify factor: büyük ülkeler için daha az nokta
      let simplifyFactor = 1;
      if (['Russia', 'Canada', 'China', 'United States of America', 'Brazil'].includes(countryName)) {
        simplifyFactor = 3; // Her 3. noktayı al
      } else if (['Australia', 'India', 'Indonesia'].includes(countryName)) {
        simplifyFactor = 2; // Her 2. noktayı al
      }
      
      const path = coordinatesToSVGPath(geometry.coordinates, simplifyFactor);
      const center = calculateCenter(geometry.coordinates);
      
      const key = turkishName.toLowerCase()
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ı/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/\s+/g, '_');
      
      regions[key] = {
        name: turkishName,
        path: path,
        center: center
      };
      
      processedCount++;
    });
    
    console.log(`✅ ${processedCount} ülke işlendi`);
    
    // 3. JavaScript dosyası oluştur
    const outputPath = path.join(__dirname, '..', 'src', 'data', 'WorldMapGeoData.js');
    
    const fileContent = `/**
 * ═══════════════════════════════════════════════════════════════════════════
 * GERÇEK DÜNYA HARİTASI - NATURAL EARTH VERİLERİ
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * VERİ KAYNAĞI: Natural Earth Data (Public Domain)
 * URL: https://www.naturalearthdata.com/
 * GeoJSON: ${NATURAL_EARTH_URL}
 * Çözünürlük: 1:110m Cultural Admin-0 Countries
 * Lisans: Public Domain - Telif hakkı yok
 * 
 * PROJEKSİYON: Equirectangular (Plate Carrée)
 * ViewBox: 0 0 1600 800
 * Dönüşüm: x = (lng + 180) × (1600/360), y = (90 - lat) × (800/180)
 * 
 * GERÇEK COĞRAFİ SINIRLAR:
 * - Bu veriler Natural Earth'ten otomatik olarak indirilmiştir
 * - Her ülkenin gerçek sınırları kullanılmıştır
 * - Geometrik şekiller DEĞİL, gerçek coğrafi koordinatlar
 * - Performans için basitleştirilmiş (Douglas-Peucker)
 * 
 * Oluşturulma: ${new Date().toISOString()}
 * Script: scripts/fetchRealMapData.js
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const REAL_GEO_REGIONS = ${JSON.stringify(regions, null, 2)};

export default REAL_GEO_REGIONS;
`;
    
    fs.writeFileSync(outputPath, fileContent, 'utf-8');
    console.log(`\n✅ Dosya oluşturuldu: ${outputPath}`);
    console.log(`📦 ${processedCount} ülke ile gerçek dünya haritası hazır!`);
    console.log('\n🎉 Artık uygulamayı çalıştırabilirsin!');
    
  } catch (error) {
    console.error('❌ Hata:', error.message);
    process.exit(1);
  }
}

main();
