import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API } from '../constants/api';
import { COLORS } from '../constants/Colors';
import { useAuth, useRole } from '../context/AuthContext';

type CatalogItem = {
  _id: string;
  name: string;
  icon: string;
  category: 'amenity' | 'security' | 'utility' | 'parking' | 'other';
  color: string;
  description?: string;
};

type MapItem = {
  _id: string;
  serviceId: CatalogItem;
  customName?: string;
  mapPosition: { x: number; y: number };
  status: 'open' | 'closed' | 'maintenance';
  operatingHours?: { open?: string; close?: string };
  notes?: string;
};

type Amenity = {
  _id: string;
  name: string;
  icon?: string;
  openTime: string;
  closeTime: string;
  isBookable: boolean;
  requiresApproval?: boolean;
  busyNow?: boolean;
  busyUntil?: string | null;
  todayCount?: number;
};

const STATUS_COLOR: Record<MapItem['status'], string> = {
  open:        '#1d7a3a',
  closed:      '#922207',
  maintenance: '#c98a00',
};

const CATEGORIES: Array<{ key: 'All' | CatalogItem['category']; label: string }> = [
  { key: 'All',      label: 'All' },
  { key: 'amenity',  label: 'Amenities' },
  { key: 'security', label: 'Security' },
  { key: 'utility',  label: 'Utilities' },
  { key: 'parking',  label: 'Parking' },
];

const MAP_HEIGHT = 280;

export default function SocietyMapScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { token } = useAuth();
  const { isSecretary, isManager } = useRole();
  const canEdit = isSecretary || isManager;

  const [loading, setLoading]   = useState(true);
  const [items, setItems]       = useState<MapItem[]>([]);
  const [catalog, setCatalog]   = useState<CatalogItem[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [activeCategory, setActiveCategory] = useState<typeof CATEGORIES[number]['key']>('All');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editing, setEditing]   = useState<MapItem | null>(null);
  const [addForm, setAddForm]   = useState<{ serviceId: string; x: string; y: string; customName: string }>({
    serviceId: '', x: '50', y: '50', customName: '',
  });
  const [editForm, setEditForm] = useState<{ x: string; y: string; status: MapItem['status']; customName: string; notes: string }>({
    x: '50', y: '50', status: 'open', customName: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  const loadMap = async () => {
    if (!token) return;
    try {
      const [mapRes, catRes, amenRes] = await Promise.all([
        fetch(API.MAP,         { headers: { Authorization: `Bearer ${token}` } }),
        fetch(API.MAP_CATALOG, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(API.AMENITIES,   { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const mapJson = await mapRes.json();
      const catJson = await catRes.json();
      const amenJson = await amenRes.json();
      if (Array.isArray(mapJson?.data)) setItems(mapJson.data);
      if (Array.isArray(catJson?.data)) setCatalog(catJson.data);
      if (Array.isArray(amenJson?.data)) setAmenities(amenJson.data);
    } catch {
      // Empty state when backend is unavailable.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMap(); }, [token]);

  const filteredItems = useMemo(() => {
    if (activeCategory === 'All') return items;
    return items.filter((it) => it.serviceId?.category === activeCategory);
  }, [activeCategory, items]);

  const unplacedCatalog = useMemo(() => {
    const placedIds = new Set(items.map((it) => String(it.serviceId?._id)));
    return catalog.filter((c) => !placedIds.has(String(c._id)));
  }, [items, catalog]);

  const submitAdd = async () => {
    if (!addForm.serviceId) {
      Alert.alert('Pick an item', 'Select a catalog item to place on the map.');
      return;
    }
    const x = Math.max(0, Math.min(100, Number(addForm.x) || 50));
    const y = Math.max(0, Math.min(100, Number(addForm.y) || 50));
    setSaving(true);
    try {
      const res = await fetch(API.MAP, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          serviceId: addForm.serviceId,
          mapPosition: { x, y },
          customName: addForm.customName.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to add');
      setShowAddModal(false);
      setAddForm({ serviceId: '', x: '50', y: '50', customName: '' });
      loadMap();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not add item');
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async () => {
    if (!editing) return;
    const x = Math.max(0, Math.min(100, Number(editForm.x) || 50));
    const y = Math.max(0, Math.min(100, Number(editForm.y) || 50));
    setSaving(true);
    try {
      const res = await fetch(API.MAP_ITEM(editing._id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mapPosition: { x, y },
          status: editForm.status,
          customName: editForm.customName.trim(),
          notes: editForm.notes.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to update');
      setShowEditModal(false);
      setEditing(null);
      loadMap();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not update');
    } finally {
      setSaving(false);
    }
  };

  const removeItem = (item: MapItem) => {
    Alert.alert('Remove from map', `Remove "${item.customName || item.serviceId?.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await fetch(API.MAP_ITEM(item._id), {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || 'Failed');
            loadMap();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Could not remove');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard' as any))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Society Map</Text>
        {canEdit ? (
          <TouchableOpacity
            style={styles.addBtnHeader}
            onPress={() => { setAddForm({ serviceId: '', x: '50', y: '50', customName: '' }); setShowAddModal(true); }}
          >
            <Ionicons name="add" size={16} color={COLORS.white} />
            <Text style={styles.addBtnHeaderText}>ADD</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Map canvas */}
        <View style={styles.mapCard}>
          <View style={styles.mapCanvas}>
            {loading ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginTop: MAP_HEIGHT / 2 - 12 }} />
            ) : filteredItems.length === 0 ? (
              <View style={styles.emptyMap}>
                <Ionicons name="map-outline" size={32} color={COLORS.slate[400]} />
                <Text style={styles.emptyMapText}>
                  {canEdit
                    ? 'No items on the map yet. Tap ADD to place pool, gym, gates, etc.'
                    : 'The secretary has not configured the society map yet.'}
                </Text>
              </View>
            ) : (
              filteredItems.map((it) => {
                const cat   = it.serviceId;
                const color = cat?.color || COLORS.primary;
                return (
                  <TouchableOpacity
                    key={it._id}
                    style={[
                      styles.pin,
                      {
                        left:  `${Math.max(2, Math.min(95, it.mapPosition.x))}%`,
                        top:   `${Math.max(2, Math.min(92, it.mapPosition.y))}%`,
                        backgroundColor: color,
                      },
                    ]}
                    onPress={() => {
                      if (!canEdit) {
                        Alert.alert(it.customName || cat?.name || 'Item', `${cat?.description || ''}\nStatus: ${it.status}`);
                        return;
                      }
                      setEditing(it);
                      setEditForm({
                        x: String(it.mapPosition.x),
                        y: String(it.mapPosition.y),
                        status: it.status,
                        customName: it.customName || '',
                        notes: it.notes || '',
                      });
                      setShowEditModal(true);
                    }}
                  >
                    <Ionicons name={(cat?.icon as any) || 'location'} size={16} color={COLORS.white} />
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          <Text style={styles.mapHint}>
            {canEdit ? 'Tap a pin to edit its position or status.' : 'Tap a pin to see details.'}
          </Text>
        </View>

        {/* Category filter */}
        <View style={styles.categoryRow}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c.key}
              style={[styles.categoryChip, activeCategory === c.key && styles.categoryChipActive]}
              onPress={() => setActiveCategory(c.key)}
            >
              <Text style={[styles.categoryChipText, activeCategory === c.key && styles.categoryChipTextActive]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Bookable society amenities — shown under the Amenities / All filter */}
        {(activeCategory === 'amenity' || activeCategory === 'All') && amenities.length > 0 ? (
          <View style={{ paddingHorizontal: 24, gap: 10, marginBottom: 10 }}>
            <Text style={styles.blockHeading}>Amenities</Text>
            {amenities.map((a) => (
              <TouchableOpacity
                key={`am-${a._id}`}
                style={styles.itemRow}
                activeOpacity={a.isBookable ? 0.85 : 1}
                onPress={() => a.isBookable && router.push('/amenities')}
              >
                <View style={[styles.itemIcon, { backgroundColor: `${COLORS.primary}1A` }]}>
                  <Ionicons name={(a.icon as any) || 'business'} size={20} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{a.name}</Text>
                  <Text style={styles.itemMeta}>
                    {a.openTime}–{a.closeTime}{a.requiresApproval ? '  •  NEEDS APPROVAL' : ''}
                  </Text>
                  {a.isBookable ? (
                    <View style={styles.amenityStatusLine}>
                      <View style={[styles.amenityStatusDot, { backgroundColor: a.busyNow ? '#922207' : '#1d7a3a' }]} />
                      <Text style={[styles.amenityStatusText, { color: a.busyNow ? '#922207' : '#1d7a3a' }]}>
                        {a.busyNow ? `BUSY · till ${a.busyUntil}` : 'FREE NOW'}
                      </Text>
                      {a.todayCount ? <Text style={styles.amenityStatusSub}>· {a.todayCount} today</Text> : null}
                    </View>
                  ) : null}
                </View>
                {a.isBookable ? (
                  <View style={styles.amenityBookPill}><Text style={styles.amenityBookText}>BOOK</Text></View>
                ) : (
                  <View style={[styles.amenityBookPill, styles.amenityInfoPill]}><Text style={styles.amenityInfoText}>INFO</Text></View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {/* Item list */}
        <View style={{ paddingHorizontal: 24, gap: 10 }}>
          {filteredItems.map((it) => {
            const cat = it.serviceId;
            return (
              <View key={it._id} style={styles.itemRow}>
                <View style={[styles.itemIcon, { backgroundColor: `${cat?.color || COLORS.primary}1A` }]}>
                  <Ionicons name={(cat?.icon as any) || 'location'} size={20} color={cat?.color || COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{it.customName || cat?.name || 'Item'}</Text>
                  <Text style={styles.itemMeta}>
                    {(cat?.category || 'amenity').toUpperCase()}  •  ({Math.round(it.mapPosition.x)}, {Math.round(it.mapPosition.y)})
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLOR[it.status]}1A` }]}>
                  <Text style={[styles.statusBadgeText, { color: STATUS_COLOR[it.status] }]}>{it.status.toUpperCase()}</Text>
                </View>
                {canEdit ? (
                  <TouchableOpacity onPress={() => removeItem(it)} style={styles.removeBtn}>
                    <Ionicons name="trash-outline" size={16} color={COLORS.slate[500]} />
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Add modal */}
      <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Place on Map</Text>
            <Text style={styles.modalSub}>Pick a catalog item, then choose its position (0–100).</Text>

            <ScrollView style={styles.catalogList} showsVerticalScrollIndicator={false}>
              {unplacedCatalog.length === 0 ? (
                <Text style={styles.catalogEmpty}>Every catalog item is already on the map.</Text>
              ) : (
                unplacedCatalog.map((c) => (
                  <TouchableOpacity
                    key={c._id}
                    style={[styles.catalogRow, addForm.serviceId === c._id && styles.catalogRowActive]}
                    onPress={() => setAddForm({ ...addForm, serviceId: c._id, customName: c.name })}
                  >
                    <View style={[styles.catIcon, { backgroundColor: `${c.color}1A` }]}>
                      <Ionicons name={c.icon as any} size={18} color={c.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.catName}>{c.name}</Text>
                      <Text style={styles.catCat}>{c.category}</Text>
                    </View>
                    {addForm.serviceId === c._id ? <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} /> : null}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <View style={styles.coordRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.coordLabel}>X (0–100)</Text>
                <TextInput
                  style={styles.coordInput}
                  keyboardType="number-pad"
                  value={addForm.x}
                  onChangeText={(t) => setAddForm({ ...addForm, x: t })}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.coordLabel}>Y (0–100)</Text>
                <TextInput
                  style={styles.coordInput}
                  keyboardType="number-pad"
                  value={addForm.y}
                  onChangeText={(t) => setAddForm({ ...addForm, y: t })}
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnGhost]} onPress={() => setShowAddModal(false)}>
                <Text style={styles.modalBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary, saving && { opacity: 0.6 }]}
                disabled={saving}
                onPress={submitAdd}
              >
                <Text style={styles.modalBtnPrimaryText}>{saving ? 'Saving…' : 'Place'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit modal */}
      <Modal visible={showEditModal} transparent animationType="fade" onRequestClose={() => setShowEditModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit {editing?.customName || editing?.serviceId?.name}</Text>

            <TextInput
              style={styles.coordInput}
              placeholder="Custom name (optional)"
              placeholderTextColor={COLORS.slate[400]}
              value={editForm.customName}
              onChangeText={(t) => setEditForm({ ...editForm, customName: t })}
            />

            <View style={styles.coordRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.coordLabel}>X (0–100)</Text>
                <TextInput
                  style={styles.coordInput}
                  keyboardType="number-pad"
                  value={editForm.x}
                  onChangeText={(t) => setEditForm({ ...editForm, x: t })}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.coordLabel}>Y (0–100)</Text>
                <TextInput
                  style={styles.coordInput}
                  keyboardType="number-pad"
                  value={editForm.y}
                  onChangeText={(t) => setEditForm({ ...editForm, y: t })}
                />
              </View>
            </View>

            <View style={styles.statusRow}>
              {(['open', 'closed', 'maintenance'] as const).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.statusChip, editForm.status === s && { backgroundColor: STATUS_COLOR[s] }]}
                  onPress={() => setEditForm({ ...editForm, status: s })}
                >
                  <Text style={[styles.statusChipText, editForm.status === s && { color: COLORS.white }]}>{s.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.coordInput, { height: 64, textAlignVertical: 'top' }]}
              placeholder="Notes (optional)"
              placeholderTextColor={COLORS.slate[400]}
              multiline
              value={editForm.notes}
              onChangeText={(t) => setEditForm({ ...editForm, notes: t })}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnGhost]} onPress={() => setShowEditModal(false)}>
                <Text style={styles.modalBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary, saving && { opacity: 0.6 }]}
                disabled={saving}
                onPress={submitEdit}
              >
                <Text style={styles.modalBtnPrimaryText}>{saving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  addBtnHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.primary },
  addBtnHeaderText: { color: COLORS.white, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },

  mapCard: { margin: 24, borderRadius: 20, backgroundColor: COLORS.white, padding: 14 },
  mapCanvas: { height: MAP_HEIGHT, borderRadius: 14, backgroundColor: '#eef3ed', position: 'relative', overflow: 'hidden', borderWidth: 1, borderColor: COLORS.slate[200] },
  emptyMap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 8 },
  emptyMapText: { fontSize: 12, color: COLORS.slate[500], textAlign: 'center' },
  pin: { position: 'absolute', width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 3, borderWidth: 2, borderColor: COLORS.white, transform: [{ translateX: -15 }, { translateY: -15 }] },
  mapHint: { marginTop: 8, fontSize: 11, color: COLORS.slate[500], textAlign: 'center' },

  categoryRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 24, marginBottom: 14, flexWrap: 'wrap' },
  categoryChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.slate[200] },
  categoryChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  categoryChipText: { fontSize: 11, fontWeight: '700', color: COLORS.slate[500] },
  categoryChipTextActive: { color: COLORS.white },

  blockHeading: { fontSize: 16, fontWeight: '800', color: COLORS.dark, marginBottom: 2 },
  amenityBookPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: COLORS.primary },
  amenityBookText: { fontSize: 10, fontWeight: '800', color: COLORS.white, letterSpacing: 1 },
  amenityInfoPill: { backgroundColor: COLORS.slate[100] },
  amenityInfoText: { fontSize: 10, fontWeight: '800', color: COLORS.slate[500], letterSpacing: 1 },
  amenityStatusLine: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  amenityStatusDot: { width: 6, height: 6, borderRadius: 3 },
  amenityStatusText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  amenityStatusSub: { fontSize: 9, color: COLORS.slate[400] },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.white, borderRadius: 14, padding: 12 },
  itemIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  itemName: { fontSize: 14, fontWeight: '800', color: COLORS.dark },
  itemMeta: { fontSize: 10, color: COLORS.slate[500], fontWeight: '700', letterSpacing: 0.5, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  removeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.slate[100] },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: COLORS.white, borderRadius: 18, padding: 20, gap: 12, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.dark },
  modalSub: { fontSize: 12, color: COLORS.slate[500] },
  catalogList: { maxHeight: 220 },
  catalogEmpty: { fontSize: 12, color: COLORS.slate[400], textAlign: 'center', padding: 20 },
  catalogRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, marginBottom: 6, backgroundColor: COLORS.slate[100] },
  catalogRowActive: { backgroundColor: `${COLORS.primary}1A` },
  catIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  catName: { fontSize: 13, fontWeight: '700', color: COLORS.dark },
  catCat: { fontSize: 10, color: COLORS.slate[500], fontWeight: '700', marginTop: 2, letterSpacing: 0.6 },
  coordRow: { flexDirection: 'row', gap: 10 },
  coordLabel: { fontSize: 10, fontWeight: '800', color: COLORS.slate[500], letterSpacing: 0.8, marginBottom: 4 },
  coordInput: { padding: 12, borderWidth: 1, borderColor: COLORS.slate[200], borderRadius: 10, fontSize: 14, color: COLORS.dark, backgroundColor: COLORS.background },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusChip: { flex: 1, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.slate[100], alignItems: 'center' },
  statusChipText: { fontSize: 10, fontWeight: '800', color: COLORS.slate[600], letterSpacing: 0.6 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
  modalBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999 },
  modalBtnGhost: { backgroundColor: COLORS.slate[100] },
  modalBtnGhostText: { fontSize: 13, fontWeight: '700', color: COLORS.dark },
  modalBtnPrimary: { backgroundColor: COLORS.primary },
  modalBtnPrimaryText: { fontSize: 13, fontWeight: '700', color: COLORS.white },
});
