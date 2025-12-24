import React from 'react';
import { View, Text } from 'react-native';
import Header from '../components/Header';

export default function SettingsScreen({ navigation }) {
  return (
    <View style={{ flex:1, backgroundColor:'#fff' }}>
      <Header navigation={navigation} title="Ayarlar" />
      <View style={{ padding:20 }}>
        <Text>Burada uygulama ayarları yer alır.</Text>
      </View>
    </View>
  );
}
