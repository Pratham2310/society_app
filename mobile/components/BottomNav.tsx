import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { COLORS } from '../constants/theme';

type TabRoute = '/(tabs)/dashboard' | '/(tabs)/members' | '/(tabs)/finance' | '/(tabs)/events' | '/(tabs)/profile';

const items: ReadonlyArray<{ label: string; route: TabRoute; icon: keyof typeof Ionicons.glyphMap }> = [
  { label: 'Home', route: '/(tabs)/dashboard', icon: 'home' as const },
  { label: 'Members', route: '/(tabs)/members', icon: 'people' as const },
  { label: 'Finance', route: '/(tabs)/finance', icon: 'wallet' as const },
  { label: 'Events', route: '/(tabs)/events', icon: 'calendar' as const },
  { label: 'Profile', route: '/(tabs)/profile', icon: 'person' as const },
];

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={styles.container}>
      {items.map((item) => {
        const active = pathname === item.route;
        return (
          <TouchableOpacity key={item.label} style={styles.item} onPress={() => router.replace(item.route)}>
            <Ionicons name={item.icon} size={21} color={active ? COLORS.primary : COLORS.muted} />
            <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 8,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: `${COLORS.black}0D`,
    backgroundColor: COLORS.background,
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minWidth: 64,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.muted,
  },
  labelActive: {
    color: COLORS.primary,
  },
});
