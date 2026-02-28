import React, { useRef } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

export default function WorldMap({
  regionOwners = {},
  countryOwners = {},
  onRegionPress,
  onInteractionChange,
  onProvinceLoadingChange,
}) {
  const webViewRef = useRef(null);

  // regionOwners değiştiğinde haritayı güncelle
  React.useEffect(() => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        updateRegionColors(${JSON.stringify(regionOwners)}, ${JSON.stringify(countryOwners)});
        true;
      `);
    }
  }, [regionOwners, countryOwners]);

  // HTML içeriği - Leaflet.js kullanarak interaktif dünya haritası
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>
        html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; }
        #map { height: 100vh; width: 100vw; touch-action: none; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script>
        var map = L.map('map', {
          center: [20, 0],
          zoom: 2,
          minZoom: 2,
          maxZoom: 18,
          zoomControl: true,
          preferCanvas: true,
          zoomAnimation: false,
          markerZoomAnimation: false,
          fadeAnimation: false,
          dragging: true,
          touchZoom: true,
          doubleClickZoom: true,
          scrollWheelZoom: true,
          tap: true
        });

        var canvasRenderer = L.canvas({ padding: 0.4 });

        map.dragging.enable();
        map.touchZoom.enable();
        map.doubleClickZoom.enable();
        map.scrollWheelZoom.enable();
        if (map.tap) {
          map.tap.enable();
        }

        // OpenStreetMap tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(map);

        // Takım renkleri
        var teamColors = {
          blue: '#3B82F6',
          yellow: '#EAB308',
          red: '#EF4444',
          green: '#10B981',
          neutral: '#D4D4D4'
        };

        // Türkçe karakterleri normalize et (küçük harf + Türkçe karakter temizleme)
        function normalizeText(text) {
          if (!text) return '';
          return text
            .toLowerCase()
            .replace(/ı/g, 'i')
            .replace(/İ/g, 'i')
            .replace(/ğ/g, 'g')
            .replace(/Ğ/g, 'g')
            .replace(/ü/g, 'u')
            .replace(/Ü/g, 'u')
            .replace(/ş/g, 's')
            .replace(/Ş/g, 's')
            .replace(/ö/g, 'o')
            .replace(/Ö/g, 'o')
            .replace(/ç/g, 'c')
            .replace(/Ç/g, 'c')
            .replace(/\s+/g, ''); // Boşlukları kaldır
        }

        // GeoJSON katmanları
        var countryLayer = null;
        var countryBorderLayer = null;
        var provinceLayer = null;
        var provinceGeoData = null;
        var isProvinceLoading = false;

        // Zoom eşik değeri
        var PROVINCE_ZOOM = 6;
        var currentZoom = map.getZoom();

        // İl/Eyalet sahiplikleri - React Native'den gelecek
        var regionOwners = {};
        var normalizedRegionOwners = {};

        // Ülke sahiplikleri - React Native'den gelecek
        var countryOwners = {};
        var normalizedCountryOwners = {};

        function normalizeCountryName(name) {
          return normalizeText(name || '');
        }

        function getCountryAliases(name) {
          var normalized = normalizeCountryName(name);
          var aliases = [normalized];

          if (normalized === 'turkiye' || normalized === 'turkey') {
            aliases.push('turkiye');
            aliases.push('turkey');
          }

          if (normalized === 'unitedstatesofamerica' || normalized === 'usa' || normalized === 'unitedstates') {
            aliases.push('unitedstatesofamerica');
            aliases.push('unitedstates');
            aliases.push('usa');
          }

          if (normalized === 'russianfederation' || normalized === 'russia') {
            aliases.push('russianfederation');
            aliases.push('russia');
          }

          return aliases;
        }

        function resolveCountryOwner(countryName) {
          if (countryOwners[countryName]) {
            return countryOwners[countryName];
          }

          var aliases = getCountryAliases(countryName);
          for (var i = 0; i < aliases.length; i++) {
            if (normalizedCountryOwners[aliases[i]]) {
              return normalizedCountryOwners[aliases[i]];
            }
          }

          return 'neutral';
        }

        // Ülke GeoJSON stil fonksiyonu
        function getCountryStyle(feature) {
          var countryName = feature.properties.name || feature.properties.ADMIN || 
                           feature.properties.NAME || feature.properties.sovereignt;
          var owner = resolveCountryOwner(countryName);
          var color = teamColors[owner];
          
          return {
            fillColor: color,
            weight: 1.5,
            opacity: 0.8,
            color: '#555',
            fillOpacity: 0.6,
            renderer: canvasRenderer,
            smoothFactor: 1.5
          };
        }

        function getCountryBorderStyle() {
          return {
            fill: false,
            weight: 1.8,
            opacity: 0.95,
            color: '#111827',
            renderer: canvasRenderer,
            smoothFactor: 1
          };
        }

        // İl/Eyalet GeoJSON stil fonksiyonu
        function getProvinceStyle(feature) {
          // Tüm olası property'leri kontrol et
          var possibleNames = [
            feature.properties.name,
            feature.properties.NAME_1,
            feature.properties.name_en,
            feature.properties.gn_name,
            feature.properties.NAME,
            feature.properties.admin,
            feature.properties.province
          ];
          
          var provinceName = null;
          var owner = null;
          
          // Her bir olası ismi kontrol et
          for (var i = 0; i < possibleNames.length; i++) {
            if (!possibleNames[i]) continue;
            
            provinceName = possibleNames[i];
            
            // 1. Direkt eşleşme
            if (regionOwners[provinceName]) {
              owner = regionOwners[provinceName];
              break;
            }

            // 2. Normalize edilmiş isimlerle
            var normalizedProvince = normalizeText(provinceName);
            if (normalizedRegionOwners[normalizedProvince]) {
              owner = normalizedRegionOwners[normalizedProvince];
              break;
            }
          }
          
          // Varsayılan neutral
          owner = owner || 'neutral';
          var color = teamColors[owner];
          
          return {
            fillColor: color,
            weight: 0.8,
            opacity: 0.75,
            color: '#333',
            fillOpacity: 0.65,
            renderer: canvasRenderer,
            smoothFactor: 2
          };
        }

        // Ülke için feature eventi
        function onEachCountry(feature, layer) {
          var countryName = feature.properties.name || feature.properties.ADMIN || 
                           feature.properties.NAME || feature.properties.sovereignt;
          var owner = resolveCountryOwner(countryName);
          
          layer.bindPopup('<b>' + countryName + '</b><br>Takım: ' + owner);
          
          layer.on('click', function() {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'countryClick',
              country: countryName,
              team: owner
            }));
          });
        }

        // İl/Eyalet için feature eventi
        function onEachProvince(feature, layer) {
          var provinceName = feature.properties.name || feature.properties.NAME_1 || 
                            feature.properties.name_en || feature.properties.gn_name;
          var owner = regionOwners[provinceName] || 'neutral';

          layer.on('click', function() {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'provinceClick',
              province: provinceName,
              owner: owner
            }));
          });
        }

        function createProvinceLayer(data) {
          if (provinceLayer && map.hasLayer(provinceLayer)) {
            map.removeLayer(provinceLayer);
          }

          provinceLayer = L.geoJSON(data, {
            style: getProvinceStyle,
            onEachFeature: onEachProvince,
            renderer: canvasRenderer
          });
        }

        function notifyProvinceLoading(active) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'provinceLoading',
            active: active
          }));
        }

        function ensureProvinceLayerLoaded() {
          if (provinceGeoData || isProvinceLoading) {
            return;
          }

          isProvinceLoading = true;
          notifyProvinceLoading(true);
          fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson')
            .then(response => response.json())
            .then(data => {
              provinceGeoData = data;
              createProvinceLayer(provinceGeoData);
              updateLayerVisibility();
            })
            .catch(error => {
              console.error('Eyalet GeoJSON yükleme hatası:', error);
            })
            .finally(function() {
              isProvinceLoading = false;
              notifyProvinceLoading(false);
            });
        }

        // Katman görünürlüğünü zoom seviyesine göre ayarla
        function updateLayerVisibility() {
          currentZoom = map.getZoom();
          
          if (currentZoom < PROVINCE_ZOOM) {
            // Uzaktan - ülke katmanını göster
            if (provinceLayer && map.hasLayer(provinceLayer)) {
              map.removeLayer(provinceLayer);
            }
            if (countryBorderLayer && map.hasLayer(countryBorderLayer)) {
              map.removeLayer(countryBorderLayer);
            }
            if (countryLayer && !map.hasLayer(countryLayer)) {
              map.addLayer(countryLayer);
            }
          } else {
            // Yakından - il/eyalet katmanını göster
            ensureProvinceLayerLoaded();
            if (provinceLayer) {
              if (countryLayer && map.hasLayer(countryLayer)) {
                map.removeLayer(countryLayer);
              }
              if (!map.hasLayer(provinceLayer)) {
                map.addLayer(provinceLayer);
              }
            } else {
              if (countryLayer && !map.hasLayer(countryLayer)) {
                map.addLayer(countryLayer);
              }
            }

            // İl seviyesinde ülke sınırlarını belirgin tut
            if (countryBorderLayer && !map.hasLayer(countryBorderLayer)) {
              map.addLayer(countryBorderLayer);
            }

            if (countryBorderLayer) {
              countryBorderLayer.bringToFront();
            }
          }
        }

        // Zoom değişikliğini dinle
        map.on('zoomend', updateLayerVisibility);
        map.on('zoom', function() {
          var z = map.getZoom();
          if (z >= PROVINCE_ZOOM - 0.5) {
            ensureProvinceLayerLoaded();
          }
        });

        // React Native ScrollView ile gesture çakışmasını önlemek için etkileşim durumu gönder
        function notifyInteraction(active) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'mapInteraction',
            active: active
          }));
        }

        map.on('movestart zoomstart', function() {
          notifyInteraction(true);
        });

        map.on('moveend zoomend', function() {
          notifyInteraction(false);
        });

        // Dünya ülkeleri GeoJSON'ını yükle
        fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson')
          .then(response => response.json())
          .then(data => {
            countryLayer = L.geoJSON(data, {
              style: getCountryStyle,
              onEachFeature: onEachCountry
            });

            countryBorderLayer = L.geoJSON(data, {
              style: getCountryBorderStyle,
              interactive: false,
              renderer: canvasRenderer
            });

            updateLayerVisibility();

            setTimeout(function() {
              ensureProvinceLayerLoaded();
            }, 1200);
          })
          .catch(error => {
            console.error('GeoJSON yükleme hatası:', error);
          });

        // React Native'den gelen güncellemeleri dinle
        function updateRegionColors(newRegionOwners, newCountryOwners) {
          // Yeni sahiplikleri tam olarak değiştir (merge değil)
          countryOwners = newCountryOwners || {};
          regionOwners = newRegionOwners || {};

          normalizedRegionOwners = {};
          Object.keys(regionOwners).forEach(function(regionName) {
            normalizedRegionOwners[normalizeText(regionName)] = regionOwners[regionName];
          });

          normalizedCountryOwners = {};
          Object.keys(countryOwners).forEach(function(countryName) {
            normalizedCountryOwners[normalizeCountryName(countryName)] = countryOwners[countryName];
          });
          
          if (countryLayer) {
            countryLayer.setStyle(getCountryStyle);
          }
          if (provinceLayer) {
            provinceLayer.setStyle(getProvinceStyle);
          }
        }

        // Harita tıklama olayları
        map.on('click', function(e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'mapClick',
            lat: e.latlng.lat,
            lng: e.latlng.lng
          }));
        });
      </script>
    </body>
    </html>
  `;

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'mapInteraction' && typeof data.active === 'boolean' && onInteractionChange) {
        onInteractionChange(data.active);
        return;
      }
      if (data.type === 'provinceLoading' && typeof data.active === 'boolean' && onProvinceLoadingChange) {
        onProvinceLoadingChange(data.active);
        return;
      }
      if ((data.type === 'countryClick' || data.type === 'provinceClick') && onRegionPress) {
        const name = data.country || data.province;
        const owner = data.team || data.owner || regionOwners[name] || 'neutral';
        onRegionPress(name, owner);
      }
    } catch (error) {
      console.log('WebView message error:', error);
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={styles.map}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onMessage={handleMessage}
        onLoadEnd={() => {
          if (!webViewRef.current) return;
          webViewRef.current.injectJavaScript(`
            updateRegionColors(${JSON.stringify(regionOwners)}, ${JSON.stringify(countryOwners)});
            true;
          `);
        }}
        nestedScrollEnabled={true}
        scrollEnabled={false}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#4ECDC4" />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
});
