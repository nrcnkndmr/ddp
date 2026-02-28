import React from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, SafeAreaView, ScrollView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../firebaseConfig';
import { collection, query, orderBy, onSnapshot, doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { PhotoContext } from '../context/PhotoContext';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { RollingContext } from '../context/RollingContext';
import Header from '../components/Header';

export default function HomeScreen({ navigation }) {
  const { latestPhoto } = React.useContext(PhotoContext);
  const { user } = React.useContext(AuthContext);
  const { theme, isDark } = React.useContext(ThemeContext);
  const { setIsRolling: setIsRollingContext } = React.useContext(RollingContext);
  const [feedPhotos, setFeedPhotos] = React.useState([]);
  const [randomPhoto, setRandomPhoto] = React.useState(null);
  const [photoOwner, setPhotoOwner] = React.useState(null);
  const [displayedPhoto, setDisplayedPhoto] = React.useState(null);
  const [displayedOwner, setDisplayedOwner] = React.useState(null);
  const viewedPhotos = React.useRef(new Set());
  const imageOpacity = React.useRef(new Animated.Value(1)).current;
  const pendingPhoto = React.useRef(null);
  const pendingOwner = React.useRef(null);
  const isRolling = React.useRef(false);
  const hasInitialPhoto = React.useRef(false);

  // Dice button press handler
  React.useEffect(() => {
    const unsubscribe = navigation.getParent()?.addListener('tabPress', (e) => {
      if (navigation.isFocused() && feedPhotos.length > 0 && !isRolling.current) {
        isRolling.current = true;
        setIsRollingContext(true);
        
        // Filter out current photo and select from remaining
        let availablePhotos = feedPhotos;
        if (displayedPhoto && feedPhotos.length > 1) {
          availablePhotos = feedPhotos.filter(photo => photo.id !== displayedPhoto.id);
        }
        
        const randomIndex = Math.floor(Math.random() * availablePhotos.length);
        setRandomPhoto(availablePhotos[randomIndex]);
        
        // Release lock after transition completes
        setTimeout(() => {
          isRolling.current = false;
          setIsRollingContext(false);
        }, 400);
      }
    });
    return unsubscribe;
  }, [navigation, feedPhotos, setIsRollingContext, displayedPhoto]);

  React.useEffect(() => {
    const q = query(collection(db, 'photos'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const arr = snapshot.docs.map((d) => {
        const data = d.data();
        if (data.base64) {
          const format = data.format || 'jpeg';
          data.url = `data:image/${format};base64,${data.base64}`;
        }
        return { id: d.id, ...data };
      });
      setFeedPhotos(arr);
      if (arr.length > 0 && !hasInitialPhoto.current) {
        hasInitialPhoto.current = true;
        const randomIndex = Math.floor(Math.random() * arr.length);
        setRandomPhoto(arr[randomIndex]);
      }
    }, (err) => console.error('photos snapshot error', err));
    return unsub;
  }, []);

  React.useEffect(() => {
    if (!randomPhoto) return;
    
    // Store pending photo
    pendingPhoto.current = randomPhoto;
    
    const fetchPhotoOwner = async () => {
      if (randomPhoto.userId) {
        try {
          const userDoc = await getDoc(doc(db, 'users', randomPhoto.userId));
          if (userDoc.exists()) {
            pendingOwner.current = userDoc.data();
          } else {
            pendingOwner.current = { username: 'ddp_user' };
          }
        } catch (err) {
          console.error('Error fetching user:', err);
          pendingOwner.current = { username: 'ddp_user' };
        }
      }
      
      // Set initial displayed photo and owner after fetching
      if (!displayedPhoto) {
        setDisplayedPhoto(randomPhoto);
        setDisplayedOwner(pendingOwner.current);
      }
    };
    
    const incrementViewCount = async () => {
      if (randomPhoto && randomPhoto.id && !viewedPhotos.current.has(randomPhoto.id)) {
        try {
          viewedPhotos.current.add(randomPhoto.id);
          const photoRef = doc(db, 'photos', randomPhoto.id);
          await updateDoc(photoRef, {
            viewCount: increment(1)
          });
        } catch (err) {
          console.error('Error incrementing view count:', err);
        }
      }
    };
    
    fetchPhotoOwner();
    incrementViewCount();
  }, [randomPhoto, displayedPhoto]);

  const displayPhoto = displayedPhoto || (latestPhoto ? { url: latestPhoto } : null);

  const handleUserPress = () => {
    if (randomPhoto && randomPhoto.userId) {
      // Eğer kendi hesabımsa Profile tab'ına geç
      if (randomPhoto.userId === user?.uid) {
        navigation.navigate('Profile');
      } else {
        // Başka birinin hesabıysa UserProfile'e git
        navigation.navigate('UserProfile', { userId: randomPhoto.userId });
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header navigation={navigation} title='Anasayfa'/>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.homeContent}>
          <View style={[styles.photoArea, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          {displayPhoto ? (
            <>
              {displayedOwner && (
                <TouchableOpacity 
                  style={[styles.photoHeader, { backgroundColor: theme.card, borderBottomColor: theme.cardBorder }]}
                  onPress={handleUserPress}
                  activeOpacity={0.7}
                >
                  <View style={styles.userAvatar}>
                    <Text style={styles.avatarText}>
                      {(() => {
                        const name = displayedOwner.username || 'D';
                        const parts = name.trim().split(' ');
                        if (parts.length === 1) {
                          return parts[0].slice(0, 2).toUpperCase();
                        }
                        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                      })()}
                    </Text>
                  </View>
                  <Text style={[styles.username, { color: theme.text }]}>{displayedOwner.username || 'ddp_user'}</Text>
                  
                  <View style={styles.viewCountContainer}>
                    <Ionicons name="eye" size={18} color={theme.subText} />
                    <Text style={[styles.viewCount, { color: theme.subText }]}>
                      {displayPhoto.viewCount ? displayPhoto.viewCount.toLocaleString() : '0'}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              <Animated.Image 
                key={displayPhoto.url}
                source={{ uri: displayPhoto.url }} 
                style={[styles.photo, { opacity: imageOpacity }]}
              />
              <Image 
                source={{ uri: pendingPhoto.current?.url || displayPhoto.url }}
                style={{ width: 0, height: 0, position: 'absolute' }}
                onLoad={() => {
                  // Only update if this is a new photo
                  if (pendingPhoto.current && pendingPhoto.current.id !== displayPhoto.id) {
                    // Fade out current
                    Animated.timing(imageOpacity, {
                      toValue: 0,
                      duration: 120,
                      useNativeDriver: true,
                    }).start(() => {
                      // Switch to new photo and owner together
                      setDisplayedPhoto(pendingPhoto.current);
                      setDisplayedOwner(pendingOwner.current);
                      // Fade in new
                      setTimeout(() => {
                        Animated.timing(imageOpacity, {
                          toValue: 1,
                          duration: 250,
                          useNativeDriver: true,
                        }).start();
                      }, 30);
                    });
                  }
                }}
              />
            </>
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="image-outline" size={48} color={theme.button} />
              <Text style={[styles.placeholderText, { color: theme.subText }]}>Henüz fotoğraf yok</Text>
            </View>
          )}
        </View>
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  homeContent: { 
    flex: 1, 
    padding: 16 
  },
  photoArea: { 
    flex: 1, 
    borderRadius: 12, 
    overflow: 'hidden', 
    borderWidth: 1,
  },
  photoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ff4da6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  username: {
    fontWeight: '600',
    fontSize: 14,
    flex: 1,
  },
  viewCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewCount: {
    fontSize: 13,
    fontWeight: '500',
  },
  placeholder: { 
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { 
    marginTop: 8 
  },
  photo: { 
    width: '100%', 
    flex: 1,
    resizeMode: 'cover' 
  },
});
