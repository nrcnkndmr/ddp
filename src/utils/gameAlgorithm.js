// Oyun bölge sahipliği hesaplama algoritması
import { db } from '../../firebaseConfig';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  setDoc,
  getDoc,
} from 'firebase/firestore';

/**
 * Bir lokasyonun hangi takıma ait olduğunu hesapla
 * @param {Object} teamPoints - { blue: 5, red: 3, yellow: 1, green: 2 }
 * @returns {string|null} - Kazanan takım rengi veya null
 */
export function calculateLocationOwner(teamPoints) {
  if (!teamPoints) return null;

  const teams = Object.keys(teamPoints);
  if (teams.length === 0) return null;

  // En yüksek puanı bul
  let maxPoints = 0;
  let winner = null;
  let hasTie = false;

  teams.forEach((team) => {
    const points = teamPoints[team] || 0;
    if (points > maxPoints) {
      maxPoints = points;
      winner = team;
      hasTie = false;
    } else if (points === maxPoints && points > 0) {
      hasTie = true;
    }
  });

  // Berabere durumunda sahip yok
  return hasTie ? null : winner;
}

/**
 * Tüm şehirleri kontrol et ve bölge sahipliklerini güncelle
 */
export async function calculateRegionOwnership() {
  try {
    const locationsRef = collection(db, 'gameLocations');
    const locationsSnapshot = await getDocs(locationsRef);

    const regionMap = {}; // { "Turkey_Marmara": { blue: 2, red: 1 } }
    const countryMap = {}; // { "Turkey": { blue: 5, red: 3 } }

    // Tüm şehirleri işle
    const locationUpdates = [];
    locationsSnapshot.forEach((doc) => {
      const data = doc.data();
      const { region, country, teamPoints } = data;

      // Şehir sahibini belirle
      const cityOwner = calculateLocationOwner(teamPoints);

      locationUpdates.push({
        id: doc.id,
        owner: cityOwner,
      });

      // Bölge ve ülke için sayaçları güncelle
      const regionKey = `${country}_${region}`;
      if (cityOwner) {
        if (!regionMap[regionKey]) {
          regionMap[regionKey] = {};
        }
        regionMap[regionKey][cityOwner] = (regionMap[regionKey][cityOwner] || 0) + 1;

        if (!countryMap[country]) {
          countryMap[country] = {};
        }
        countryMap[country][cityOwner] = (countryMap[country][cityOwner] || 0) + 1;
      }
    });

    // Şehir sahipliklerini güncelle
    for (const update of locationUpdates) {
      await updateDoc(doc(db, 'gameLocations', update.id), {
        owner: update.owner,
      });
    }

    // Bölge sahipliklerini hesapla ve kaydet
    const regionOwners = {};
    Object.keys(regionMap).forEach((regionKey) => {
      const owner = calculateLocationOwner(regionMap[regionKey]);
      regionOwners[regionKey] = owner;
    });

    // Ülke sahipliklerini hesapla
    const countryOwners = {};
    Object.keys(countryMap).forEach((country) => {
      const owner = calculateLocationOwner(countryMap[country]);
      countryOwners[country] = owner;
    });

    // Genel istatistikleri güncelle
    const stats = {
      blue: { totalPoints: 0, cities: 0, regions: 0, countries: 0 },
      yellow: { totalPoints: 0, cities: 0, regions: 0, countries: 0 },
      red: { totalPoints: 0, cities: 0, regions: 0, countries: 0 },
      green: { totalPoints: 0, cities: 0, regions: 0, countries: 0 },
    };

    // Şehir sayıları ve toplam puanlar
    locationUpdates.forEach((update) => {
      if (update.owner) {
        stats[update.owner].cities += 1;
      }
    });

    // Toplam puanları hesapla
    locationsSnapshot.forEach((doc) => {
      const data = doc.data();
      const { teamPoints } = data;
      if (teamPoints) {
        Object.keys(teamPoints).forEach((team) => {
          stats[team].totalPoints += teamPoints[team] || 0;
        });
      }
    });

    // Bölge sayıları
    Object.values(regionOwners).forEach((owner) => {
      if (owner) {
        stats[owner].regions += 1;
      }
    });

    // Ülke sayıları
    Object.values(countryOwners).forEach((owner) => {
      if (owner) {
        stats[owner].countries += 1;
      }
    });

    // Firestore'a kaydet
    await setDoc(doc(db, 'game', 'stats'), stats);

    console.log('Bölge sahiplikleri güncellendi:', {
      cities: locationUpdates.length,
      regions: Object.keys(regionOwners).length,
      countries: Object.keys(countryOwners).length,
    });

    return { success: true, stats };
  } catch (error) {
    console.error('Bölge sahipliği hesaplama hatası:', error);
    throw error;
  }
}

/**
 * Otomatik oyun - belirlenmemiş bölgeler için en optimum takımı seç
 */
export async function autoPlayUndecidedRegions() {
  try {
    const locationsRef = collection(db, 'gameLocations');
    const q = query(locationsRef, where('owner', '==', null));
    const undecidedSnapshot = await getDocs(q);

    let autoPlayCount = 0;

    for (const docSnapshot of undecidedSnapshot.docs) {
      const data = docSnapshot.data();
      const { teamPoints } = data;

      if (!teamPoints || Object.keys(teamPoints).length === 0) {
        // Hiç puan yoksa rastgele takım seç
        const teams = ['blue', 'yellow', 'red', 'green'];
        const randomTeam = teams[Math.floor(Math.random() * teams.length)];

        await updateDoc(doc(db, 'gameLocations', docSnapshot.id), {
          [`teamPoints.${randomTeam}`]: 1,
          autoPlayed: true,
        });

        autoPlayCount++;
      } else {
        // Eşit puanlar varsa en az şehri olan takıma ver
        const statsDoc = await getDoc(doc(db, 'game', 'stats'));
        const stats = statsDoc.exists() ? statsDoc.data() : null;

        if (stats) {
          // En düşük şehir sayısına sahip takımı bul
          const teamCities = Object.keys(stats).map((team) => ({
            team,
            cities: stats[team].cities || 0,
          }));

          teamCities.sort((a, b) => a.cities - b.cities);
          const weakestTeam = teamCities[0].team;

          // Puanı artır
          await updateDoc(doc(db, 'gameLocations', docSnapshot.id), {
            [`teamPoints.${weakestTeam}`]: (teamPoints[weakestTeam] || 0) + 1,
            autoPlayed: true,
          });

          autoPlayCount++;
        }
      }
    }

    // Sahiplikleri yeniden hesapla
    await calculateRegionOwnership();

    console.log(`Otomatik oyun: ${autoPlayCount} bölge atandı`);

    return { success: true, autoPlayCount };
  } catch (error) {
    console.error('Otomatik oyun hatası:', error);
    throw error;
  }
}
