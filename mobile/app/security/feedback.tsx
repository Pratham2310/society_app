import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FeedbackType } from '../../types/security';

export default function FeedbackScreen() {
  const { type, visitorName } = useLocalSearchParams<{ type?: FeedbackType; visitorName?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const feedbackType = type ?? 'status-updated';
  const name = visitorName ?? 'Visitor';

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.centered}>
          <View style={styles.heroCircle}>
            <MaterialIcons name="shield" size={84} color="#A72608" />
            <MaterialIcons name="check" size={34} color="#A72608" style={styles.overlayIcon} />
          </View>
          <Text style={styles.heading}>{feedbackType === 'entry-approved' ? 'Entry Approved' : feedbackType === 'entry-rejected' ? 'Entry Rejected' : feedbackType === 'fraud-reported' ? 'Fraud Report Received' : 'Security Updated'}</Text>
          <Text style={styles.bodyText}>
            {feedbackType === 'entry-approved'
              ? `${name} will be at your gate shortly.`
              : feedbackType === 'entry-rejected'
              ? `The guard has been informed to deny access to ${name}.`
              : feedbackType === 'fraud-reported'
              ? 'Your concern has been sent to Main Gate. Guards are alerted for immediate action.'
              : 'Your status and instructions have been shared with Main Gate security.'}
          </Text>
          {feedbackType === 'entry-approved' && (
            <View style={styles.visitorCard}>
              <Image source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBR88CiEgaaQuNxzP1jChZmDNf36x0ufxzlHpcXZMidtlCwUCrtPlQfc-efhUHp_iEChOcg3-4C8NwMno3epN9nlm3yRHcRE9Tv3xtYf0miem0vDQ4zgmoGBd0hh0kz54VKGMav7jR-Q9c7wAoTTfT_XmGw9lvmaxFA8oGz-AR3r2ySRfsVCaFY_xVjWORyTLrRCP-DGyQ_URiPDEHbvijXkK7l2isrOYu4gcFnas3N2FolorNIJWP6mM52Ln6oHHmaiUB4JO2v7L-v' }} style={styles.visitorImage} />
              <Text style={styles.visitorName}>{name}</Text>
            </View>
          )}
        </View>

        <View style={styles.footerButtons}>
          {feedbackType === 'entry-rejected' ? (
            <>
              <Pressable style={styles.primaryBtn} onPress={() => router.push({ pathname: '/security/feedback' as any, params: { type: 'fraud-reported' } })}>
                <Text style={styles.primaryBtnText}>Report Fraud</Text>
              </Pressable>
              <Pressable style={styles.secondaryBtn} onPress={() => router.replace('/security/security-status' as any)}>
                <Text style={styles.secondaryBtnText}>Back</Text>
              </Pressable>
            </>
          ) : (
            <Pressable style={styles.primaryBtn} onPress={() => router.replace('/security/security-status' as any)}>
              <Text style={styles.primaryBtnText}>Back to Security</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8f6f5' },
  content: { paddingHorizontal: 20, flexGrow: 1, justifyContent: 'space-between' },
  centered: { alignItems: 'center', gap: 12 },
  heroCircle: { marginTop: 18, width: 152, height: 152, borderRadius: 76, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  overlayIcon: { position: 'absolute', bottom: 24, right: 24 },
  heading: { marginTop: 4, fontSize: 34, fontWeight: '800', color: '#090C02', textAlign: 'center' },
  bodyText: { textAlign: 'center', fontSize: 14, lineHeight: 22, color: '#717171', maxWidth: 330 },
  visitorCard: { marginTop: 6, width: '100%', backgroundColor: '#ffffff', borderRadius: 16, padding: 12, alignItems: 'center', gap: 8 },
  visitorImage: { width: 54, height: 54, borderRadius: 12 },
  visitorName: { fontSize: 16, fontWeight: '800', color: '#090C02' },
  footerButtons: { marginTop: 18, gap: 10 },
  primaryBtn: { borderRadius: 16, backgroundColor: '#A72608', paddingVertical: 16 },
  primaryBtnText: { textAlign: 'center', color: '#ffffff', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  secondaryBtn: { borderRadius: 16, borderColor: '#090C02', borderWidth: 2, paddingVertical: 16 },
  secondaryBtnText: { textAlign: 'center', color: '#090C02', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
});
