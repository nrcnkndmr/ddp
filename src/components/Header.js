import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function Header({ navigation, title = 'DDP' }) {
  return (
    <SafeAreaView style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#ffe6f0' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 }}>
        <View style={{ width: 40 }} />
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#ff4da6' }}>{title}</Text>
        <TouchableOpacity style={{ width: 40, alignItems: 'flex-end' }} onPress={() => navigation.navigate('Settings')}>
          <Ionicons name="settings-outline" size={24} color="#ff4da6" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
