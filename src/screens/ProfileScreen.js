import React from 'react';
import { View, Text, FlatList } from 'react-native';
import Header from '../components/Header';

export default function ProfileScreen({ navigation }) {
  const samplePhotos = Array.from({ length: 9 }).map((_, i) => ({ id: i }));
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Header navigation={navigation} title="DDP" />
      <View style={{ flexDirection: 'row', padding: 16, alignItems: 'center' }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#ffddee', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>DD</Text>
        </View>
        <View style={{ marginLeft: 16, flex: 1 }}>
          <Text style={{ fontWeight: '700', fontSize: 18 }}>ddp_user</Text>
          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            <View style={{ marginRight: 12, alignItems: 'center' }}><Text style={{ fontWeight: '700' }}>12</Text><Text>Gönderi</Text></View>
            <View style={{ marginRight: 12, alignItems: 'center' }}><Text style={{ fontWeight: '700' }}>340</Text><Text>Takipçi</Text></View>
            <View style={{ marginRight: 12, alignItems: 'center' }}><Text style={{ fontWeight: '700' }}>180</Text><Text>Takip</Text></View>
          </View>
        </View>
      </View>
      <FlatList data={samplePhotos} keyExtractor={(i)=>String(i.id)} numColumns={3} columnWrapperStyle={{ justifyContent: 'space-between' }} contentContainerStyle={{ padding: 8 }} renderItem={({item})=>(<View style={{ width: (300-48)/3, height: (300-48)/3, marginBottom: 8, backgroundColor: '#fff0f6', borderWidth:1, borderColor:'#ffe6f0' }} />)} />
    </View>
  );
}
