import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Header from '../components/Header';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { storage, db } from '../../firebaseConfig';
import { PhotoContext } from '../context/PhotoContext';
import { Ionicons } from '@expo/vector-icons';

export default function CameraScreen({ navigation }) {
  const { setLatestPhoto } = React.useContext(PhotoContext);
  const [cameraType, setCameraType] = useState('back');

  useEffect(() => {
    const openCamera = async () => {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') return;
      let result;
      try {
        result = await ImagePicker.launchCameraAsync({ quality: 0.8, cameraType: cameraType, allowsEditing: false });
      } catch (err) {
        console.log('launchCameraAsync error', err);
        return;
      }
      console.log('camera result', result);
      if (!result.canceled) {
        let uri = result.assets && result.assets[0] && result.assets[0].uri;
        if (cameraType === 'front') {
          try {
            const manipulated = await ImageManipulator.manipulateAsync(uri, [{ flip: ImageManipulator.FlipType.Horizontal }], { compress: 1, format: ImageManipulator.SaveFormat.JPEG });
            uri = manipulated.uri;
          } catch (e) {}
        }
        setLatestPhoto(uri);
        try {
          const response = await fetch(uri);
          const blob = await response.blob();
          const filename = `photos/${Date.now()}-${Math.random().toString(36).slice(2,9)}.jpg`;
          const storageRef = ref(storage, filename);
          await uploadBytes(storageRef, blob);
          const downloadURL = await getDownloadURL(storageRef);
          await addDoc(collection(db, 'photos'), { url: downloadURL, createdAt: serverTimestamp() });
          setLatestPhoto(downloadURL);
        } catch (e) {
          console.log('upload to firebase error', e);
        }
        navigation.navigate('Main', { screen: 'Home' });
      } else {
        console.log('camera cancelled or not available');
      }
    };

    const unsub = navigation.addListener('focus', () => { openCamera(); });
    return unsub;
  }, [cameraType, navigation, setLatestPhoto]);

  return (
    <View style={{ flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
      <Header navigation={navigation} title="Kamera" />
      <View style={{ padding: 20 }}>
        <TouchableOpacity style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#ff4da6', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }} onPress={() => setCameraType((t) => (t === 'back' ? 'front' : 'back'))}>
          <Ionicons name="camera-reverse-outline" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={{ textAlign: 'center', color: '#666' }}>Kamera açılacak...</Text>
      </View>
    </View>
  );
}
