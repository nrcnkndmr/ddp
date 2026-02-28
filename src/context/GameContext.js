import React, { createContext, useState, useEffect, useContext } from 'react';
import { AuthContext } from './AuthContext';
import { db } from '../../firebaseConfig';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { calculateLocationOwner, calculateRegionOwnership, autoPlayUndecidedRegions } from '../utils/gameAlgorithm';

export const GameContext = createContext();

// Takım renkleri
export const TEAMS = {
  blue: { name: 'Mavi Takım', color: '#3B82F6' },
  yellow: { name: 'Sarı Takım', color: '#FCD34D' },
  red: { name: 'Kırmızı Takım', color: '#EF4444' },
  green: { name: 'Yeşil Takım', color: '#10B981' },
};

const WEEK_DURATION_DAYS = 7;
const WEEK_DURATION_MS = WEEK_DURATION_DAYS * 24 * 60 * 60 * 1000;

const getInitialStats = () => ({
  blue: { totalPoints: 0, cities: 0, regions: 0, countries: 0 },
  yellow: { totalPoints: 0, cities: 0, regions: 0, countries: 0 },
  red: { totalPoints: 0, cities: 0, regions: 0, countries: 0 },
  green: { totalPoints: 0, cities: 0, regions: 0, countries: 0 },
});

const getAreaNameFromLocation = (data) => {
  if (!data) return null;

  const country = (data.country || '').toLowerCase();
  if (country === 'turkey' || country === 'türkiye') {
    return data.region || data.locationName || data.city || null;
  }

  return data.region || data.locationName || data.city || null;
};

const toJsDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  return null;
};

const getWinnerTeamFromStats = (stats) => {
  const teams = Object.keys(TEAMS);
  const ranked = teams
    .map((team) => {
      const teamStats = stats?.[team] || {};
      return {
        team,
        countries: teamStats.countries || 0,
        regions: teamStats.regions || 0,
        totalPoints: teamStats.totalPoints || 0,
      };
    })
    .sort((a, b) => {
      if (b.countries !== a.countries) return b.countries - a.countries;
      if (b.regions !== a.regions) return b.regions - a.regions;
      return b.totalPoints - a.totalPoints;
    });

  if (!ranked.length) {
    return null;
  }

  const best = ranked[0];
  const second = ranked[1];
  const noProgress = best.countries === 0 && best.regions === 0 && best.totalPoints === 0;
  if (noProgress) {
    return null;
  }

  const isTie = second &&
    second.countries === best.countries &&
    second.regions === best.regions &&
    second.totalPoints === best.totalPoints;

  return isTie ? null : best.team;
};

const createBatches = (items, size = 400) => {
  const result = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
};

export function GameProvider({ children }) {
  const { user } = useContext(AuthContext);
  const [gameStats, setGameStats] = useState(getInitialStats());
  const [userTeam, setUserTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [weeklyGame, setWeeklyGame] = useState({
    weekNumber: 1,
    startAt: null,
    endAt: null,
    lastWinnerTeam: null,
  });

  // Kullanıcının takımını yükle
  useEffect(() => {
    if (user?.profile?.team) {
      setUserTeam(user.profile.team);
    } else {
      setUserTeam(null);
    }
  }, [user, user?.profile?.team]);

  // Oyun istatistiklerini dinle
  useEffect(() => {
    const statsDocRef = doc(db, 'game', 'stats');
    
    const unsubscribe = onSnapshot(
      statsDocRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          setGameStats(docSnapshot.data());
        } else {
          // İlk kez oluştur
          const initialStats = getInitialStats();
          setDoc(statsDocRef, initialStats).catch(console.error);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Game stats listener error:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const weekRef = doc(db, 'game', 'weekMeta');

    const unsubscribe = onSnapshot(
      weekRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          setWeeklyGame({
            weekNumber: data.weekNumber || 1,
            startAt: toJsDate(data.startAt),
            endAt: toJsDate(data.endAt),
            lastWinnerTeam: data.lastWinnerTeam || null,
          });
          return;
        }

        const startAt = new Date();
        const endAt = new Date(startAt.getTime() + WEEK_DURATION_MS);
        const initialWeekData = {
          weekNumber: 1,
          startAt,
          endAt,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastWinnerTeam: null,
        };

        setDoc(weekRef, initialWeekData).catch(console.error);
        setWeeklyGame({ weekNumber: 1, startAt, endAt, lastWinnerTeam: null });
      },
      (error) => {
        console.error('Week meta listener error:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  // Fotoğraf atıldığında konum puanı ekle
  const addLocationPoint = async (locationData) => {
    if (!user || !userTeam) {
      throw new Error('Kullanıcı giriş yapmamış veya takımı yok');
    }

    try {
      const { city, region, country, latitude, longitude } = locationData;

      const normalizedCountry = (country || '').toLowerCase();
      const areaName = normalizedCountry === 'turkey' || normalizedCountry === 'türkiye'
        ? (region || city || 'Bilinmeyen')
        : (region || city || 'Bilinmeyen');
      
      // Location document ID oluştur
      const locationId = `${country}_${areaName}`.toLowerCase().replace(/\s+/g, '_');
      const locationRef = doc(db, 'gameLocations', locationId);

      // Mevcut lokasyon verisini al
      const locationDoc = await getDoc(locationRef);
      
      if (locationDoc.exists()) {
        // Varolan lokasyona puan ekle
        const currentData = locationDoc.data();
        const teamPoints = currentData.teamPoints || {};
        const currentTeamPoints = teamPoints[userTeam] || 0;
        const nextTeamPoints = {
          ...teamPoints,
          [userTeam]: currentTeamPoints + 1,
        };
        const nextOwner = calculateLocationOwner(nextTeamPoints);
        
        await updateDoc(locationRef, {
          [`teamPoints.${userTeam}`]: increment(1),
          owner: nextOwner,
          locationName: areaName,
          lastUpdate: serverTimestamp(),
        });
      } else {
        // Yeni lokasyon oluştur
        await setDoc(locationRef, {
          city,
          locationName: areaName,
          region,
          country,
          latitude,
          longitude,
          teamPoints: {
            [userTeam]: 1,
          },
          owner: userTeam,
          createdAt: serverTimestamp(),
          lastUpdate: serverTimestamp(),
        });
      }

      // Kullanıcının günlük fotoğraf sayısını güncelle
      const today = new Date().toISOString().split('T')[0];
      const userDailyRef = doc(db, 'userDailyPoints', `${user.uid}_${today}`);
      
      const userDailyDoc = await getDoc(userDailyRef);
      if (userDailyDoc.exists()) {
        await updateDoc(userDailyRef, {
          photoCount: increment(1),
          lastLocation: locationId,
          lastUpdate: serverTimestamp(),
        });
      } else {
        await setDoc(userDailyRef, {
          userId: user.uid,
          team: userTeam,
          date: today,
          photoCount: 1,
          lastLocation: locationId,
          createdAt: serverTimestamp(),
          lastUpdate: serverTimestamp(),
        });
      }

      return { success: true, locationId };
    } catch (error) {
      console.error('Add location point error:', error);
      throw error;
    }
  };

  // Bir lokasyonun bilgilerini al
  const getLocationInfo = async (locationId) => {
    try {
      const locationRef = doc(db, 'gameLocations', locationId);
      const locationDoc = await getDoc(locationRef);
      
      if (locationDoc.exists()) {
        return { id: locationDoc.id, ...locationDoc.data() };
      }
      return null;
    } catch (error) {
      console.error('Get location info error:', error);
      return null;
    }
  };

  // Kullanıcının bugün kaç fotoğraf attığını kontrol et
  const checkDailyPhotoLimit = async () => {
    if (!user) return { canPost: false, count: 0 };
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const userDailyRef = doc(db, 'userDailyPoints', `${user.uid}_${today}`);
      const userDailyDoc = await getDoc(userDailyRef);
      
      if (userDailyDoc.exists()) {
        const count = userDailyDoc.data().photoCount || 0;
        return { canPost: count < 1, count }; // Günde 1 fotoğraf limiti
      }
      
      return { canPost: true, count: 0 };
    } catch (error) {
      console.error('Check daily photo limit error:', error);
      return { canPost: false, count: 0 };
    }
  };

  const finalizeWeeklyGame = async () => {
    const now = new Date();
    const weekRef = doc(db, 'game', 'weekMeta');
    const statsRef = doc(db, 'game', 'stats');

    const weekDoc = await getDoc(weekRef);
    let weekData = weekDoc.exists() ? weekDoc.data() : null;

    if (!weekData) {
      const startAt = now;
      const endAt = new Date(startAt.getTime() + WEEK_DURATION_MS);
      weekData = { weekNumber: 1, startAt, endAt };
      await setDoc(weekRef, {
        ...weekData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      throw new Error('Haftalık oyun yeni başlatıldı. Hafta henüz bitmedi.');
    }

    const endAtDate = toJsDate(weekData.endAt);
    if (endAtDate && now < endAtDate) {
      throw new Error('Hafta henüz tamamlanmadı.');
    }

    await calculateRegionOwnership();

    const refreshedStatsDoc = await getDoc(statsRef);
    const refreshedStats = refreshedStatsDoc.exists() ? refreshedStatsDoc.data() : getInitialStats();
    const winnerTeam = getWinnerTeamFromStats(refreshedStats);

    const locationsSnapshot = await getDocs(collection(db, 'gameLocations'));

    const regionOwners = {};
    const countryTeamCounts = {};
    const mapLocations = [];

    locationsSnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const owner = data.owner || calculateLocationOwner(data.teamPoints);
      const areaName = getAreaNameFromLocation(data);
      const countryName = data.country;

      mapLocations.push({ id: docSnapshot.id, ...data, owner: owner || null });

      if (owner && areaName) {
        regionOwners[areaName] = owner;
      }

      if (owner && countryName) {
        if (!countryTeamCounts[countryName]) {
          countryTeamCounts[countryName] = {};
        }
        countryTeamCounts[countryName][owner] = (countryTeamCounts[countryName][owner] || 0) + 1;
      }
    });

    const countryOwners = {};
    Object.keys(countryTeamCounts).forEach((country) => {
      countryOwners[country] = calculateLocationOwner(countryTeamCounts[country]);
    });

    const weekNumber = weekData.weekNumber || 1;
    const weekHistoryRef = doc(db, 'gameWeekHistory', `week_${weekNumber}`);

    await setDoc(weekHistoryRef, {
      weekNumber,
      startAt: weekData.startAt,
      endAt: weekData.endAt,
      finalizedAt: serverTimestamp(),
      winnerTeam,
      winnerTeamName: winnerTeam ? TEAMS[winnerTeam]?.name : null,
      teamStats: refreshedStats,
      mapSnapshot: {
        regionOwners,
        countryOwners,
        locations: mapLocations,
      },
    });

    let rewardedUsers = 0;
    if (winnerTeam) {
      const usersSnapshot = await getDocs(query(collection(db, 'users'), where('team', '==', winnerTeam)));
      rewardedUsers = usersSnapshot.size;

      const userDocs = usersSnapshot.docs;
      const userDocChunks = createBatches(userDocs);
      for (const chunk of userDocChunks) {
        const batch = writeBatch(db);
        chunk.forEach((userDocSnapshot) => {
          batch.update(userDocSnapshot.ref, {
            credits: increment(20),
            lastWeeklyRewardAt: serverTimestamp(),
            [`weeklyBonusHistory.week_${weekNumber}`]: 20,
          });
        });
        await batch.commit();
      }
    }

    const locationDocs = locationsSnapshot.docs;
    const locationDocChunks = createBatches(locationDocs);
    for (const chunk of locationDocChunks) {
      const batch = writeBatch(db);
      chunk.forEach((locationDocSnapshot) => {
        batch.delete(locationDocSnapshot.ref);
      });
      await batch.commit();
    }

    const nextStartAt = now;
    const nextEndAt = new Date(now.getTime() + WEEK_DURATION_MS);

    await setDoc(statsRef, getInitialStats());
    await setDoc(weekRef, {
      weekNumber: weekNumber + 1,
      startAt: nextStartAt,
      endAt: nextEndAt,
      lastWinnerTeam: winnerTeam || null,
      lastWeekHistoryId: `week_${weekNumber}`,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    return {
      weekNumber,
      winnerTeam,
      rewardedUsers,
      archivedLocationCount: mapLocations.length,
      historyId: `week_${weekNumber}`,
      nextWeekNumber: weekNumber + 1,
      nextEndAt,
    };
  };

  const value = {
    gameStats,
    userTeam,
    loading,
    weeklyGame,
    addLocationPoint,
    getLocationInfo,
    checkDailyPhotoLimit,
    calculateRegionOwnership,
    autoPlayUndecidedRegions,
    finalizeWeeklyGame,
    TEAMS,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
