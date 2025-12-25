import React from 'react';
import { View, Text, Image } from 'react-native';
import Header from '../components/Header';
import { PhotoContext } from '../context/PhotoContext';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

export default function HomeScreen({ navigation }) {
  const { latestPhoto } = React.useContext(PhotoContext);
  const [feedPhotos, setFeedPhotos] = React.useState([]);

  React.useEffect(() => {
    const q = query(collection(db, 'photos'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const arr = snapshot.docs.map((d) => {
        const data = d.data();
        // Base64'ü data URI formatına çevir
        if (data.base64) {
          const format = data.format || 'jpeg';
          data.url = `data:image/${format};base64,${data.base64}`;
        }
        return { id: d.id, ...data };
      });
      setFeedPhotos(arr);
    }, (err) => console.log('photos snapshot error', err));
    return unsub;
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Header navigation={navigation} />
      <View style={{ flex: 1, padding: 16 }}>
        <View style={{ flex: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: '#ffe6f0', alignItems: 'center', justifyContent: 'center' }}>
          {feedPhotos && feedPhotos.length > 0 ? (
            <Image source={{ uri: feedPhotos[0].url }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
          ) : latestPhoto ? (
            <Image source={{ uri: latestPhoto }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
          ) : (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: '#ff9fcf', marginTop: 8 }}>Henüz fotoğraf yok</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
