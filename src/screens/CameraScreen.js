import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, Alert, Image, ActivityIndicator, Modal } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { db } from '../../firebaseConfig';
import { collection, addDoc, serverTimestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import { AuthContext } from '../context/AuthContext';
import { PhotoContext } from '../context/PhotoContext';
import { GameContext } from '../context/GameContext';
import { ThemeContext } from '../context/ThemeContext';

export default function CameraScreen({ navigation }) {
  const { setLatestPhoto } = React.useContext(PhotoContext);
  const { user } = React.useContext(AuthContext);
  const { addLocationPoint, checkDailyPhotoLimit } = React.useContext(GameContext);
  const { theme } = React.useContext(ThemeContext);
  const [facing, setFacing] = useState('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [locationPermission, setLocationPermission] = useState(null);
  const cameraRef = useRef(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [canUploadToPool, setCanUploadToPool] = useState(true);
  const [userCredits, setUserCredits] = useState(0);
  const [loadingCredits, setLoadingCredits] = useState(true);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  // Kullanıcı kredilerini yükle ve günlük yenile
  useEffect(() => {
    if (!user?.uid) return;

    const checkAndRefreshCredits = async () => {
      try {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const credits = userData.credits || 0;
          const lastCreditUpdate = userData.lastCreditUpdate?.toDate();
          const now = new Date();
          
          // Günlük kredi yenileme kontrolü
          const shouldRefresh = !lastCreditUpdate || 
            (now.getDate() !== lastCreditUpdate.getDate() || 
             now.getMonth() !== lastCreditUpdate.getMonth() || 
             now.getFullYear() !== lastCreditUpdate.getFullYear());
          
          if (shouldRefresh) {
            // Günlük minimum 10 kredi garantisi (bonus kredileri silme)
            const nextCredits = Math.max(credits, 10);
            await setDoc(userRef, {
              credits: nextCredits,
              lastCreditUpdate: serverTimestamp()
            }, { merge: true });
            setUserCredits(nextCredits);
          } else {
            setUserCredits(credits);
          }
        } else {
          // İlk kez - 10 kredi ver
          await setDoc(userRef, {
            credits: 10,
            lastCreditUpdate: serverTimestamp()
          }, { merge: true });
          setUserCredits(10);
        }
      } catch (error) {
        console.error('Kredi yükleme hatası:', error);
      } finally {
        setLoadingCredits(false);
      }
    };

    checkAndRefreshCredits();
  }, [user?.uid]);

  // Konum izni iste
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
      
      if (status === 'granted') {
        try {
          const location = await Location.getCurrentPositionAsync({});
          setCurrentLocation(location);
        } catch (error) {
          console.error('Konum alınamadı:', error);
        }
      }
    })();
  }, []);

  // Force camera remount on focus to fix Android layout issue
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setCameraKey(prev => prev + 1);
      setCapturedPhoto(null);
      setUploading(false);
      setIsCapturing(false);
      setIsCameraReady(false);
      checkPoolUploadLimit();
    });

    return unsubscribe;
  }, [navigation]);

  // Oyun havuzuna yükleme limitini kontrol et
  const checkPoolUploadLimit = async () => {
    if (!user?.uid) return;
    
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();
      
      if (userData?.lastPoolUpload) {
        const lastUpload = userData.lastPoolUpload.toDate();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (lastUpload >= today) {
          setCanUploadToPool(false);
          return;
        }
      }
      
      setCanUploadToPool(true);
    } catch (error) {
      console.error('Pool limit kontrolü hatası:', error);
      setCanUploadToPool(true);
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current || !isCameraReady || isCapturing || uploading) return;

    setIsCapturing(true);

    try {
      let photo;

      try {
        photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          skipProcessing: true,
        });
      } catch (firstError) {
        await new Promise(resolve => setTimeout(resolve, 150));
        photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          skipProcessing: true,
        });
      }

      if (!photo?.uri) {
        throw new Error('Captured photo has no URI');
      }

      let uri = photo.uri;

      // Ön kamera ise aynala
      if (facing === 'front') {
        try {
          const manipulated = await ImageManipulator.manipulateAsync(
            uri,
            [{ flip: ImageManipulator.FlipType.Horizontal }],
            { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
          );
          uri = manipulated.uri;
        } catch (e) {
          console.error('flip error', e);
        }
      }

      // Önizleme ekranına geç ve modal göster
      setCapturedPhoto(uri);
      setShowUploadModal(true);
    } catch (error) {
      console.error('take picture error', error);
      setCameraKey(prev => prev + 1);
      setIsCameraReady(false);
      Alert.alert('Kamera Hatası', 'Fotoğraf çekilemedi. Kamera yeniden başlatıldı, lütfen tekrar deneyin.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleCameraReady = () => {
    setIsCameraReady(true);
  };

  const handleUploadChoice = async (uploadType) => {
    setShowUploadModal(false);
    
    if (uploadType === 'profile') {
      await handleUploadToProfile();
    } else if (uploadType === 'pool') {
      await handleUploadToPool();
    }
  };

  const handleUploadToProfile = async () => {
    if (!capturedPhoto) return;

    setUploading(true);

    try {
      setLatestPhoto(capturedPhoto);

      // Konum bilgisi al
      let locationData = null;
      if (locationPermission && currentLocation) {
        try {
          const { latitude, longitude } = currentLocation.coords;
          const address = await Location.reverseGeocodeAsync({ latitude, longitude });

          if (address && address.length > 0) {
            const location = address[0];
            locationData = {
              city: location.city || location.subregion || 'Bilinmeyen',
              region: location.region || location.subregion || 'Bilinmeyen',
              country: location.country || 'Bilinmeyen',
              latitude,
              longitude,
            };
          }
        } catch (error) {
          console.error('Reverse geocoding hatası:', error);
        }
      }

      // Resize ve compress et
      const resized = await ImageManipulator.manipulateAsync(
        capturedPhoto,
        [{ resize: { width: 800 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      const base64 = await FileSystem.readAsStringAsync(resized.uri, {
        encoding: 'base64',
      });

      await addDoc(collection(db, 'photos'), {
        base64: base64,
        createdAt: serverTimestamp(),
        format: 'jpeg',
        userId: user?.uid || null,
        viewCount: 0,
        location: locationData || null,
        isPoolPhoto: false,
      });

      const base64Uri = `data:image/jpeg;base64,${base64}`;
      setLatestPhoto(base64Uri);

      Alert.alert(
        '✅ Başarılı!',
        'Fotoğrafınız profilinize eklendi.',
        [{ text: 'Tamam', onPress: () => navigation.navigate('Main', { screen: 'Profile' }) }]
      );
    } catch (e) {
      console.error('upload to firebase error', e);
      Alert.alert('Hata', 'Fotoğraf yüklenirken bir hata oluştu');
      setUploading(false);
    }
  };

  const handleUploadToPool = async () => {
    // Kredi kontrolü
    if (userCredits < 10) {
      Alert.alert(
        'Yetersiz Kredi',
        `Günlük havuza fotoğraf yüklemek için 10 kredi gerekiyor.\n\nMevcut krediniz: ${userCredits}\n\nYarın 10 yeni kredi alacaksınız!`,
        [{ text: 'Tamam' }]
      );
      return;
    }

    if (!capturedPhoto || !canUploadToPool) return;

    setUploading(true);

    try {
      // Konum bilgisi al
      let locationData = null;
      if (locationPermission && currentLocation) {
        try {
          const { latitude, longitude } = currentLocation.coords;
          const address = await Location.reverseGeocodeAsync({ latitude, longitude });

          if (address && address.length > 0) {
            const location = address[0];
            locationData = {
              city: location.city || location.subregion || 'Bilinmeyen',
              region: location.region || location.subregion || 'Bilinmeyen',
              country: location.country || 'Bilinmeyen',
              latitude,
              longitude,
            };
          }
        } catch (error) {
          console.error('Reverse geocoding hatası:', error);
        }
      }

      // Resize ve compress et
      const resized = await ImageManipulator.manipulateAsync(
        capturedPhoto,
        [{ resize: { width: 800 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      const base64 = await FileSystem.readAsStringAsync(resized.uri, {
        encoding: 'base64',
      });

      await addDoc(collection(db, 'photos'), {
        base64: base64,
        createdAt: serverTimestamp(),
        format: 'jpeg',
        userId: user?.uid || null,
        viewCount: 0,
        location: locationData || null,
        isPoolPhoto: true,
      });

      // Son yükleme tarihini güncelle ve kredi düşür
      await setDoc(doc(db, 'users', user.uid), {
        lastPoolUpload: serverTimestamp(),
        credits: userCredits - 10
      }, { merge: true });
      
      setUserCredits(userCredits - 10);

      if (locationData) {
        try {
          await addLocationPoint(locationData);
        } catch (error) {
          console.error('Puan ekleme hatası:', error);
        }
      }

      setCanUploadToPool(false);
      Alert.alert(
        '✅ Başarılı! 🎮 Puan Kazandınız!',
        locationData 
          ? `Fotoğrafınız oyun havuzuna eklendi ve ${locationData.city} için takımınıza +1 puan kazandırdınız!\n\n💰 10 kredi harcandı. Kalan: ${userCredits - 10}`
          : `Fotoğrafınız oyun havuzuna eklendi.\n\n💰 10 kredi harcandı. Kalan: ${userCredits - 10}`,
        [{ text: 'Harika!', onPress: () => navigation.navigate('Main', { screen: 'Home' }) }]
      );
    } catch (e) {
      console.error('upload to pool error', e);
      Alert.alert('Hata', 'Fotoğraf yüklenirken bir hata oluştu');
      setUploading(false);
    }
  };

  const handleShare = async () => {
    // Artık bu fonksiyon kullanılmıyor, modal üzerinden seçim yapılıyor
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    setShowUploadModal(false);
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Kamera izni gerekli</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>İzin Ver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Kredi göstergesi component'i
  const CreditIndicator = () => (
    <View style={styles.creditContainer}>
      <Ionicons name="star" size={20} color="#FFD700" />
      <Text style={styles.creditText}>
        {loadingCredits ? '...' : userCredits}
      </Text>
      <Text style={styles.creditLabel}>Kredi</Text>
    </View>
  );

  // Önizleme ekranı
  if (capturedPhoto) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: capturedPhoto }} style={styles.previewImage} />
        
        <View style={styles.previewTopBar}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => navigation.navigate('Main', { screen: 'Home' })}
            disabled={uploading}
          >
            <Ionicons name="close" size={32} color="#fff" />
          </TouchableOpacity>
          
          {/* Konum göstergesi */}
          {locationPermission && currentLocation && (
            <View style={styles.locationBadge}>
              <Ionicons name="location" size={16} color="#fff" />
              <Text style={styles.locationText}>Konum Aktif</Text>
            </View>
          )}
        </View>

        <View style={styles.previewBottomBar}>
          <TouchableOpacity
            style={styles.retakeButton}
            onPress={handleRetake}
            disabled={uploading}
          >
            <Ionicons name="camera-outline" size={28} color="#fff" />
            <Text style={styles.retakeText}>Yeniden Çek</Text>
          </TouchableOpacity>
        </View>

        {/* Upload Choice Modal */}
        <Modal
          visible={showUploadModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowUploadModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme?.card || '#fff' }]}>
              <Text style={[styles.modalTitle, { color: theme?.text || '#000' }]}>
                Fotoğrafı Nereye Eklemek İstersiniz?
              </Text>
              
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme?.button || '#ff4da6' }]}
                onPress={() => handleUploadChoice('profile')}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="person" size={24} color="#fff" />
                    <Text style={styles.modalButtonText}>Profilime Ekle</Text>
                    <Text style={styles.modalButtonSubtext}>Limitsiz paylaşım</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton, 
                  { backgroundColor: (canUploadToPool && userCredits >= 10) ? '#10b981' : '#6b7280' }
                ]}
                onPress={() => handleUploadChoice('pool')}
                disabled={uploading || !canUploadToPool || userCredits < 10}
              >
                {uploading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="game-controller" size={24} color="#fff" />
                    <Text style={styles.modalButtonText}>Günlük Fotoğraf Yükle</Text>
                    <Text style={styles.modalButtonSubtext}>
                      {!canUploadToPool ? 'Bugün eklendi ✓' : 
                       userCredits < 10 ? `Yetersiz kredi (${userCredits}/10)` : 
                       '10 kredi harcanır 💰'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowUploadModal(false)}
                disabled={uploading}
              >
                <Text style={[styles.modalCancelText, { color: theme?.text || '#000' }]}>İptal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        key={cameraKey}
        style={styles.camera}
        facing={facing}
        ref={cameraRef}
        onCameraReady={handleCameraReady}
      />
      {/* Kredi göstergesi */}
      <CreditIndicator />
      {/* Üst bar */}
      <View style={styles.topBar} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.navigate('Main', { screen: 'Home' })}
        >
          <Ionicons name="close" size={32} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.flipButton}
          onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
        >
          <Ionicons name="camera-reverse-outline" size={32} color="#fff" />
        </TouchableOpacity>
      </View>
      {/* Alt bar */}
      <View style={styles.bottomBar} pointerEvents="box-none">
        <TouchableOpacity
          style={[styles.captureButton, (!isCameraReady || isCapturing || uploading) && styles.captureButtonDisabled]}
          onPress={takePicture}
          disabled={!isCameraReady || isCapturing || uploading}
        >
          <View style={styles.captureButtonInner} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  topBar: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditContainer: {
    position: 'absolute',
    top: 50,
    left: '50%',
    marginLeft: -60,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    zIndex: 100,
  },
  creditText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  creditLabel: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.9,
  },
  flipButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  captureButtonDisabled: {
    opacity: 0.45,
  },
  captureButtonInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#fff',
  },
  permissionText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: '#ff4da6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  previewImage: {
    ...StyleSheet.absoluteFillObject,
    resizeMode: 'cover',
  },
  previewTopBar: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  locationText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  previewBottomBar: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 40,
    zIndex: 10,
  },
  retakeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  retakeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  shareButton: {
    backgroundColor: '#ff4da6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
    minWidth: 140,
  },
  shareButtonDisabled: {
    opacity: 0.6,
  },
  shareText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 24,
    textAlign: 'center',
  },
  modalButton: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    minHeight: 100,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  modalButtonSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginTop: 4,
  },
  modalCancelButton: {
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
