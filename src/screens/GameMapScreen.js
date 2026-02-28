import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../context/ThemeContext';
import { GameContext, TEAMS } from '../context/GameContext';
import { AuthContext } from '../context/AuthContext';
import Header from '../components/Header';
import WorldMap from '../components/WorldMap';
import { db } from '../../firebaseConfig';
import { doc, updateDoc, getDoc, collection, getDocs, deleteDoc, onSnapshot } from 'firebase/firestore';
import { calculateLocationOwner } from '../utils/gameAlgorithm';

// DEBUG MODE - Production'da false yapın
const DEBUG_MODE = __DEV__; // Development modunda otomatik açık
const WORLD_COUNTRIES_URL = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function GameMapScreen({ navigation }) {
  const { theme } = useContext(ThemeContext);
  const {
    gameStats,
    userTeam,
    loading,
    weeklyGame,
    calculateRegionOwnership,
    autoPlayUndecidedRegions,
    finalizeWeeklyGame,
  } = useContext(GameContext);
  const { user } = useContext(AuthContext);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [showTeamSelect, setShowTeamSelect] = useState(false);
  const [showDebugMenu, setShowDebugMenu] = useState(false);
  const [debugProcessing, setDebugProcessing] = useState(false);
  const [regionOwners, setRegionOwners] = useState({});
  const [countryOwners, setCountryOwners] = useState({});
  const [isMapInteracting, setIsMapInteracting] = useState(false);
  const [isProvinceLayerLoading, setIsProvinceLayerLoading] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);
  const [testLocations, setTestLocations] = useState([]);
  const [showTestSetup, setShowTestSetup] = useState(false);
  const [testTeamSelections, setTestTeamSelections] = useState({});
  const [testSetupLocations, setTestSetupLocations] = useState([]);

  const getFeatureCenter = (feature) => {
    const points = [];

    const collectPoints = (coords) => {
      if (!Array.isArray(coords)) return;
      if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        points.push(coords);
        return;
      }
      coords.forEach(collectPoints);
    };

    collectPoints(feature?.geometry?.coordinates);

    if (!points.length) {
      return { lat: 0, lng: 0 };
    }

    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    points.forEach(([lng, lat]) => {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    });

    return {
      lat: (minLat + maxLat) / 2,
      lng: (minLng + maxLng) / 2,
    };
  };

  const fetchWorldCountriesForTest = async () => {
    const response = await fetch(WORLD_COUNTRIES_URL);
    if (!response.ok) {
      throw new Error('Dünya ülkeleri yüklenemedi');
    }

    const data = await response.json();
    const features = Array.isArray(data?.features) ? data.features : [];
    const countriesMap = {};

    features.forEach((feature) => {
      const name = feature?.properties?.name || feature?.properties?.ADMIN || feature?.properties?.NAME || feature?.properties?.sovereignt;
      if (!name || countriesMap[name]) return;
      countriesMap[name] = {
        name,
        ...getFeatureCenter(feature),
      };
    });

    return Object.values(countriesMap).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  };

  const getAreaNameFromLocation = (data) => {
    if (!data) return null;

    const country = (data.country || '').toLowerCase();
    if (country === 'turkey' || country === 'türkiye') {
      return data.region || data.locationName || data.city || null;
    }

    return data.region || data.locationName || data.city || null;
  };

  useEffect(() => {
    console.log('GameMapScreen - userTeam:', userTeam);
    console.log('GameMapScreen - user:', user);
    console.log('GameMapScreen - user.profile?.team:', user?.profile?.team);
    console.log('GameMapScreen - loading:', loading);
    
    if (userTeam) {
      setSelectedTeam(userTeam);
      setShowTeamSelect(false);
    } else if (user && !loading) {
      // Takımı yoksa modal göster
      console.log('GameMapScreen - Modal açılıyor!');
      setTimeout(() => setShowTeamSelect(true), 500);
    }
  }, [userTeam, user, loading]);

  // gameLocations'ları dinle ve harita için regionOwners oluştur
  useEffect(() => {
    // Test modundaysa Firebase'i dinleme
    if (isTestMode) {
      const owners = {};
      const countryTeamCounts = {};
      testLocations.forEach(loc => {
        if (loc.locationName && loc.owner) {
          owners[loc.locationName] = loc.owner;

          if (!countryTeamCounts[loc.country]) {
            countryTeamCounts[loc.country] = {};
          }
          countryTeamCounts[loc.country][loc.owner] = (countryTeamCounts[loc.country][loc.owner] || 0) + 1;
        }
      });

      const testCountryOwners = {};
      Object.keys(countryTeamCounts).forEach(country => {
        testCountryOwners[country] = calculateLocationOwner(countryTeamCounts[country]);
      });

      setRegionOwners(owners);
      setCountryOwners(testCountryOwners);
      console.log('Test mode - Region owners:', owners);
      return;
    }

    // Normal modda Firebase'den dinle
    const unsubscribe = onSnapshot(
      collection(db, 'gameLocations'),
      (snapshot) => {
        const areaTeamCounts = {};
        const countryTeamCounts = {};
        snapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data();
          const locationName = getAreaNameFromLocation(data);
          const owner = data.owner || calculateLocationOwner(data.teamPoints);
          const countryName = data.country;

          if (locationName && owner) {
            if (!areaTeamCounts[locationName]) {
              areaTeamCounts[locationName] = {};
            }
            areaTeamCounts[locationName][owner] = (areaTeamCounts[locationName][owner] || 0) + 1;

            if (countryName) {
              if (!countryTeamCounts[countryName]) {
                countryTeamCounts[countryName] = {};
              }
              countryTeamCounts[countryName][owner] = (countryTeamCounts[countryName][owner] || 0) + 1;
            }
          }
        });

        const owners = {};
        Object.keys(areaTeamCounts).forEach((areaName) => {
          owners[areaName] = calculateLocationOwner(areaTeamCounts[areaName]);
        });

        const nextCountryOwners = {};
        Object.keys(countryTeamCounts).forEach(country => {
          nextCountryOwners[country] = calculateLocationOwner(countryTeamCounts[country]);
        });

        setRegionOwners(owners);
        setCountryOwners(nextCountryOwners);
        console.log('Firebase mode - Region owners güncellendi:', owners);
      },
      (error) => {
        console.error('gameLocations dinleme hatası:', error);
      }
    );

    return () => unsubscribe();
  }, [isTestMode, testLocations]);

  const handleSelectTeam = async (team) => {
    try {
      await updateDoc(doc(db, 'users', user.uid), { team });
      
      // Firestore'dan güncel profili al
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        user.profile = userDoc.data();
      }
      
      setShowTeamSelect(false);
      setSelectedTeam(team);
      Alert.alert('Başarılı', `${TEAMS[team].name} takımına katıldınız!`);
    } catch (error) {
      console.error('Takım seçimi hatası:', error);
      Alert.alert('Hata', 'Takım seçimi kaydedilemedi');
    }
  };

  const handleCalculateOwnership = async () => {
    setCalculating(true);
    try {
      await calculateRegionOwnership();
      alert('Bölge sahiplikleri güncellendi!');
    } catch (error) {
      alert('Hata: ' + error.message);
    } finally {
      setCalculating(false);
    }
  };

  const handleAutoPlay = async () => {
    setCalculating(true);
    try {
      const result = await autoPlayUndecidedRegions();
      alert(`Otomatik oyun tamamlandı! ${result.autoPlayCount} bölge atandı.`);
    } catch (error) {
      alert('Hata: ' + error.message);
    } finally {
      setCalculating(false);
    }
  };

  const handleFinalizeWeek = () => {
    Alert.alert(
      'Haftayı Bitir',
      'Mevcut haftayı sonlandırıp kazanan takıma +20 kredi verilecek ve yeni hafta başlayacak. Devam edilsin mi?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Bitir',
          style: 'destructive',
          onPress: async () => {
            setCalculating(true);
            try {
              const result = await finalizeWeeklyGame();
              const winnerName = result.winnerTeam ? TEAMS[result.winnerTeam]?.name : 'Berabere';
              Alert.alert(
                'Hafta Tamamlandı ✅',
                `Kazanan: ${winnerName}\nÖdül alan üye: ${result.rewardedUsers}\nArşivlenen konum: ${result.archivedLocationCount}\nYeni hafta: #${result.nextWeekNumber}`
              );
            } catch (error) {
              Alert.alert('İşlem Yapılamadı', error.message || 'Haftalık işlem sırasında hata oluştu.');
            } finally {
              setCalculating(false);
            }
          }
        }
      ]
    );
  };

  // DEBUG: Oyunu sıfırdan başlat
  const handleResetGame = async () => {
    const resetMessage = isTestMode 
      ? 'Test verileri temizlenecek. Emin misiniz?'
      : 'Tüm Firebase oyun verileri silinecek. Emin misiniz?';
    
    Alert.alert(
      'Oyunu Sıfırla',
      resetMessage,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sıfırla',
          style: 'destructive',
          onPress: async () => {
            setDebugProcessing(true);
            try {
              if (isTestMode) {
                // Test modunu temizle
                setTestLocations([]);
                setRegionOwners({});
                setCountryOwners({});
                setTestSetupLocations([]);
                setTestTeamSelections({});
                setIsTestMode(false);
                Alert.alert('Başarılı', 'Test verileri temizlendi!');
              } else {
                // Firebase'i temizle
                const snapshot = await getDocs(collection(db, 'gameLocations'));
                const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
                await Promise.all(deletePromises);
                Alert.alert('Başarılı', `${snapshot.size} bölge silindi. Oyun sıfırlandı!`);
              }
            } catch (error) {
              console.error('Oyun sıfırlama hatası:', error);
              Alert.alert('Hata', 'Oyun sıfırlanamadı: ' + error.message);
            } finally {
              setDebugProcessing(false);
            }
          }
        }
      ]
    );
  };

  // DEBUG: Test oyunu başlat (Firebase'e yazmadan, local)
  const handleInitTestGame = async () => {
    setDebugProcessing(true);
    try {
      const locations = await fetchWorldCountriesForTest();
      const teams = ['blue', 'red', 'yellow', 'green'];
      const initialSelections = {};

      locations.forEach((location) => {
        initialSelections[location.name] = teams[Math.floor(Math.random() * teams.length)];
      });

      setTestSetupLocations(locations);
      setTestTeamSelections(initialSelections);
      setShowTestSetup(true);
    } catch (error) {
      console.error('Test ülkeleri yükleme hatası:', error);
      Alert.alert('Hata', 'Test ülkeleri yüklenemedi: ' + error.message);
    } finally {
      setDebugProcessing(false);
    }
  };

  // Test oyununu başlat (seçimler yapıldıktan sonra)
  const handleConfirmTestGame = () => {
    if (!testSetupLocations.length) {
      Alert.alert('Hata', 'Test ülkeleri yüklenemedi. Lütfen tekrar deneyin.');
      return;
    }

    setDebugProcessing(true);
    try {
      const teams = ['blue', 'red', 'yellow', 'green'];
      const testData = [];

      for (const location of testSetupLocations) {
        const selectedTeam = testTeamSelections[location.name] || teams[Math.floor(Math.random() * teams.length)];
        
        // Seçilen takıma daha yüksek puan ver
        const teamPoints = {};
        teams.forEach(team => {
          if (team === selectedTeam) {
            teamPoints[team] = Math.floor(Math.random() * 5) + 10; // 10-14 puan
          } else {
            teamPoints[team] = Math.floor(Math.random() * 5) + 1; // 1-5 puan
          }
        });

        testData.push({
          locationName: location.name,
          region: location.name,
          country: location.name,
          latitude: location.lat,
          longitude: location.lng,
          teamPoints: teamPoints,
          owner: selectedTeam,
          photos: [{
            photoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            userId: user.uid,
            userName: user.displayName || 'Test User',
            team: selectedTeam,
            timestamp: Date.now(),
            isPoolPhoto: true
          }],
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }

      // Local state'e kaydet
      setTestLocations(testData);
      setIsTestMode(true);
      setShowTestSetup(false);
      setTestSetupLocations([]);

      Alert.alert(
        'Test Modu Aktif! 🧪', 
        `${testData.length} ülke için test verisi oluşturuldu.\n\nBu veriler sadece local'de, Firebase'e yazılmadı.`
      );
      setShowDebugMenu(false);
    } catch (error) {
      console.error('Test oyunu hatası:', error);
      Alert.alert('Hata', 'Test oyunu başlatılamadı: ' + error.message);
    } finally {
      setDebugProcessing(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Header navigation={navigation} title="Oyun Haritası" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.button} />
          <Text style={[styles.loadingText, { color: theme.text }]}>
            Oyun verileri yükleniyor...
          </Text>
        </View>
      </View>
    );
  }

  if (!userTeam) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Header navigation={navigation} title="Oyun Haritası" />
        <View style={styles.noTeamContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={theme.subText} />
          <Text style={[styles.noTeamText, { color: theme.text }]}>
            Oyuna katılmak için bir takım seçin
          </Text>
        </View>

        {/* Takım Seçim Modal */}
        <Modal visible={true} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
              <Ionicons name="trophy" size={48} color={theme.button} />
              <Text style={[styles.modalTitle, { color: theme.text }]}>Takım Seç</Text>
              <Text style={[styles.modalSubtitle, { color: theme.subText }]}>
                Oyuna katılmak için bir takım seçin
              </Text>
              
              <View style={styles.teamGrid}>
                {Object.keys(TEAMS).map((teamKey) => (
                  <TouchableOpacity
                    key={teamKey}
                    style={[styles.teamOption, { borderColor: TEAMS[teamKey].color }]}
                    onPress={() => handleSelectTeam(teamKey)}
                  >
                    <View style={[styles.teamCircleLarge, { backgroundColor: TEAMS[teamKey].color }]} />
                    <Text style={[styles.teamOptionText, { color: theme.text }]}>
                      {TEAMS[teamKey].name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // Takım sıralaması
  const teamRankings = Object.keys(TEAMS)
    .map((teamKey) => ({
      key: teamKey,
      ...TEAMS[teamKey],
      stats: gameStats[teamKey] || { totalPoints: 0, cities: 0, regions: 0, countries: 0 },
    }))
    .sort((a, b) => b.stats.totalPoints - a.stats.totalPoints);

  const remainingDays = weeklyGame?.endAt
    ? Math.max(0, Math.ceil((weeklyGame.endAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const renderTeamCard = (teamData, rank) => {
    const isUserTeam = teamData.key === userTeam;
    const isSelected = teamData.key === selectedTeam;

    return (
      <TouchableOpacity
        key={teamData.key}
        style={[
          styles.teamCard,
          { backgroundColor: theme.card, borderColor: theme.border },
          isSelected && { borderColor: teamData.color, borderWidth: 3 },
        ]}
        onPress={() => setSelectedTeam(teamData.key)}
        activeOpacity={0.7}
      >
        <View style={styles.teamHeader}>
          <View style={styles.teamTitleRow}>
            <View style={[styles.teamColorDot, { backgroundColor: teamData.color }]} />
            <Text style={[styles.teamName, { color: theme.text }]}>
              {teamData.name}
            </Text>
            {isUserTeam && (
              <View style={[styles.yourTeamBadge, { backgroundColor: teamData.color }]}>
                <Text style={styles.yourTeamText}>Takımınız</Text>
              </View>
            )}
          </View>
          <Text style={[styles.rankText, { color: theme.subText }]}>#{rank}</Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Ionicons name="star" size={20} color={teamData.color} />
            <Text style={[styles.statValue, { color: theme.text }]}>
              {teamData.stats.totalPoints}
            </Text>
            <Text style={[styles.statLabel, { color: theme.subText }]}>Puan</Text>
          </View>

          <View style={styles.statItem}>
            <Ionicons name="location" size={20} color={teamData.color} />
            <Text style={[styles.statValue, { color: theme.text }]}>
              {teamData.stats.cities}
            </Text>
            <Text style={[styles.statLabel, { color: theme.subText }]}>Şehir</Text>
          </View>

          <View style={styles.statItem}>
            <Ionicons name="map" size={20} color={teamData.color} />
            <Text style={[styles.statValue, { color: theme.text }]}>
              {teamData.stats.regions}
            </Text>
            <Text style={[styles.statLabel, { color: theme.subText }]}>Bölge</Text>
          </View>

          <View style={styles.statItem}>
            <Ionicons name="globe" size={20} color={teamData.color} />
            <Text style={[styles.statValue, { color: theme.text }]}>
              {teamData.stats.countries}
            </Text>
            <Text style={[styles.statLabel, { color: theme.subText }]}>Ülke</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header navigation={navigation} title="Oyun Haritası" />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isMapInteracting}
      >
        {/* Başlık */}
        <View style={styles.headerSection}>
          <Text style={[styles.title, { color: theme.text }]}>Risk Oyunu</Text>
          <Text style={[styles.subtitle, { color: theme.subText }]}>
            Fotoğraflarınızla takımınız için bölge kazanın!
          </Text>
          <Text style={[styles.subtitle, { color: theme.subText, marginTop: 6 }]}> 
            Hafta #{weeklyGame?.weekNumber || 1} • Kalan: {remainingDays ?? '-'} gün
          </Text>
          {weeklyGame?.lastWinnerTeam && (
            <Text style={[styles.subtitle, { color: theme.subText }]}> 
              Son haftanın kazananı: {TEAMS[weeklyGame.lastWinnerTeam]?.name || weeklyGame.lastWinnerTeam}
            </Text>
          )}
        </View>

        {/* Nasıl Oynanır */}
        <View style={[styles.infoCard, { backgroundColor: theme.card }]}>
          <View style={styles.infoHeader}>
            <Ionicons name="information-circle" size={24} color={theme.button} />
            <Text style={[styles.infoTitle, { color: theme.text }]}>Nasıl Oynanır?</Text>
          </View>
          <Text style={[styles.infoText, { color: theme.subText }]}>
            • Günde 1 fotoğraf paylaşarak takımınıza puan kazandırın{'\n'}
            • Her fotoğraf bulunduğunuz şehir için +1 puan{'\n'}
            • En çok puana sahip takım o bölgeyi kazanır{'\n'}
            • Kazanılan şehirler bölge, bölgeler ülke kontrolü sağlar
          </Text>
        </View>

        {/* Takım Sıralaması */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Takım Sıralaması</Text>
        {teamRankings.map((teamData, index) => renderTeamCard(teamData, index + 1))}

        {/* Dünya Haritası */}
        <View style={styles.mapSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Dünya Haritası</Text>
          <View style={[styles.mapContainer, { backgroundColor: theme.card }]}>
            <WorldMap 
              regionOwners={regionOwners}
              countryOwners={countryOwners}
              onInteractionChange={setIsMapInteracting}
              onProvinceLoadingChange={setIsProvinceLayerLoading}
              onRegionPress={(regionName, owner) => {
                Alert.alert(
                  regionName,
                  owner === 'neutral' 
                    ? 'Bu bölge henüz belirlenmedi' 
                    : `Bu bölge ${TEAMS[owner]?.name || owner} takımının kontrolünde`
                );
              }}
            />
            {isProvinceLayerLoading && (
              <View style={styles.mapLoadingOverlay} pointerEvents="none">
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.mapLoadingText}>İl katmanı yükleniyor...</Text>
              </View>
            )}
          </View>
          <Text style={[styles.mapNote, { color: theme.subText }]}>
            * Uzaklaştırdıkça ülke renkleri, yaklaştırdıkça il/eyalet renkleri görünür.
          </Text>
        </View>

        {/* DEBUG: Geliştirici Menüsü */}
        {DEBUG_MODE && (
          <View style={styles.debugSection}>
            <TouchableOpacity 
              style={styles.debugToggle}
              onPress={() => setShowDebugMenu(!showDebugMenu)}
            >
              <Ionicons 
                name={showDebugMenu ? "code-slash" : "code-slash-outline"} 
                size={20} 
                color="#9CA3AF" 
              />
              <Text style={styles.debugToggleText}>
                {showDebugMenu ? 'Debug Menüsünü Gizle' : 'Debug Menüsünü Göster'}
              </Text>
            </TouchableOpacity>

            {showDebugMenu && (
              <View style={styles.debugMenu}>
                <Text style={styles.debugTitle}>🛠️ Geliştirici Araçları</Text>
                <Text style={styles.debugWarning}>
                  ⚠️ Bu araçlar sadece test amaçlıdır. Production'da görünmez.
                </Text>
                {isTestMode && (
                  <View style={[styles.debugInfo, { backgroundColor: '#FEF3C7', borderLeftColor: '#F59E0B', marginBottom: 12 }]}>
                    <Text style={{ fontSize: 12, color: '#92400E', fontWeight: '600' }}>
                      🧪 TEST MODU AKTİF - {testLocations.length} ülke (Local)
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.debugButton, { backgroundColor: '#EF4444' }]}
                  onPress={handleResetGame}
                  disabled={debugProcessing}
                >
                  {debugProcessing ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={20} color="#fff" />
                      <Text style={styles.debugButtonText}>Oyunu Sıfırla</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.debugButton, { backgroundColor: '#8B5CF6' }]}
                  onPress={handleInitTestGame}
                  disabled={debugProcessing}
                >
                  {debugProcessing ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="flask-outline" size={20} color="#fff" />
                      <Text style={styles.debugButtonText}>Test Oyunu Başlat</Text>
                    </>
                  )}
                </TouchableOpacity>

                <View style={styles.debugInfo}>
                  <Text style={styles.debugInfoText}>
                    • Sıfırla: Tüm oyun verilerini siler{'\n'}
                    • Test Oyunu: Tüm dünya ülkeleri + seçilebilir takım ataması
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Admin Butonları (Test için) */}
        <View style={styles.adminSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Yönetim</Text>
          
          <TouchableOpacity
            style={[styles.adminButton, { backgroundColor: theme.button }]}
            onPress={handleCalculateOwnership}
            disabled={calculating}
          >
            {calculating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="refresh" size={20} color="#fff" />
                <Text style={styles.adminButtonText}>Bölge Sahipliklerini Güncelle</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.adminButton, { backgroundColor: '#10B981' }]}
            onPress={handleAutoPlay}
            disabled={calculating}
          >
            {calculating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="play" size={20} color="#fff" />
                <Text style={styles.adminButtonText}>Otomatik Oyun (Belirlenmemiş Bölgeler)</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.adminButton, { backgroundColor: '#7C3AED' }]}
            onPress={handleFinalizeWeek}
            disabled={calculating}
          >
            {calculating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="flag" size={20} color="#fff" />
                <Text style={styles.adminButtonText}>Haftayı Bitir ve Yeni Haftaya Geç</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Takım Seçim Modal */}
      <Modal visible={showTeamSelect} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Ionicons name="trophy" size={48} color={theme.button} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>Takım Seç</Text>
            <Text style={[styles.modalSubtitle, { color: theme.subText }]}>
              Oyuna katılmak için bir takım seçin
            </Text>
            
            <View style={styles.teamGrid}>
              {Object.keys(TEAMS).map((teamKey) => (
                <TouchableOpacity
                  key={teamKey}
                  style={[styles.teamOption, { borderColor: TEAMS[teamKey].color }]}
                  onPress={() => handleSelectTeam(teamKey)}
                >
                  <View style={[styles.teamCircleLarge, { backgroundColor: TEAMS[teamKey].color }]} />
                  <Text style={[styles.teamOptionText, { color: theme.text }]}>
                    {TEAMS[teamKey].name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Test Oyunu Kurulum Modalı */}
      <Modal visible={showTestSetup} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.testSetupModal, { backgroundColor: theme.card }]}>
            <View style={styles.testSetupHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>🧪 Test Oyunu Kur</Text>
              <Text style={[styles.modalSubtitle, { color: theme.subText }]}>
                Her ülke için kazanan takımı seçin
              </Text>
            </View>

            <ScrollView style={styles.cityList} showsVerticalScrollIndicator={false}>
              {Object.keys(testTeamSelections).map(cityName => (
                <View key={cityName} style={[styles.cityItem, { borderColor: theme.cardBorder }]}>
                  <Text style={[styles.cityName, { color: theme.text }]}>{cityName}</Text>
                  <View style={styles.teamButtons}>
                    {Object.keys(TEAMS).map(teamKey => (
                      <TouchableOpacity
                        key={teamKey}
                        style={[
                          styles.teamButton,
                          { backgroundColor: TEAMS[teamKey].color },
                          testTeamSelections[cityName] === teamKey && styles.teamButtonSelected
                        ]}
                        onPress={() => setTestTeamSelections(prev => ({
                          ...prev,
                          [cityName]: teamKey
                        }))}
                      >
                        {testTeamSelections[cityName] === teamKey && (
                          <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.testSetupFooter}>
              <TouchableOpacity
                style={[styles.testSetupButton, { backgroundColor: '#6B7280' }]}
                onPress={() => {
                  setShowTestSetup(false);
                  setTestSetupLocations([]);
                  setTestTeamSelections({});
                }}
              >
                <Text style={styles.testSetupButtonText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.testSetupButton, { backgroundColor: theme.button }]}
                onPress={handleConfirmTestGame}
                disabled={debugProcessing}
              >
                {debugProcessing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.testSetupButtonText}>Başlat 🚀</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  noTeamContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  noTeamText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
  scrollView: {
    flex: 1,
  },
  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  infoCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginHorizontal: 20,
    marginBottom: 16,
  },
  teamCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  teamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  teamTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  teamColorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  teamName: {
    fontSize: 18,
    fontWeight: '600',
  },
  yourTeamBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  yourTeamText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  rankText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  mapSection: {
    marginBottom: 24,
  },
  mapContainer: {
    marginHorizontal: 20,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
    height: 400,
    position: 'relative',
  },
  mapLoadingOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mapLoadingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  mapNote: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
    marginHorizontal: 20,
  },
  mapPlaceholder: {
    marginHorizontal: 20,
    marginBottom: 32,
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  mapPlaceholderText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  mapPlaceholderSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  adminSection: {
    marginHorizontal: 20,
    marginBottom: 32,
  },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  adminButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Debug Menüsü Stilleri
  debugSection: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  debugToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
    backgroundColor: '#F9FAFB',
  },
  debugToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  debugMenu: {
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  debugTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  debugWarning: {
    fontSize: 11,
    color: '#F59E0B',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  debugButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 10,
    gap: 8,
  },
  debugButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  debugInfo: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginTop: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#6B7280',
  },
  debugInfoText: {
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: SCREEN_WIDTH - 60,
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  teamGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  teamOption: {
    width: (SCREEN_WIDTH - 120) / 2,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  teamCircleLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
  },
  teamOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Test Setup Modal Stilleri
  testSetupModal: {
    width: SCREEN_WIDTH - 40,
    maxHeight: '80%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  testSetupHeader: {
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  cityList: {
    maxHeight: 400,
    padding: 16,
  },
  cityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  cityName: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  teamButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  teamButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.6,
  },
  teamButtonSelected: {
    opacity: 1,
    transform: [{ scale: 1.1 }],
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  testSetupFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  testSetupButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  testSetupButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
