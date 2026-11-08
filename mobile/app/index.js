import { useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ASSET_KINDS,
  createIntelligenceAsset,
  createPortableSnapshot,
  parsePortableSnapshot,
  validateIntelligenceAsset,
} from '../../src/domain/intelligence.js';

export default function ChiefMobile() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [kind, setKind] = useState('prompt');
  const [assets, setAssets] = useState([]);
  const [snapshotInput, setSnapshotInput] = useState('');
  const [snapshotSummary, setSnapshotSummary] = useState(null);
  const [message, setMessage] = useState(null);

  const snapshot = useMemo(() => createPortableSnapshot({ assets }), [assets]);

  async function addAsset() {
    setMessage(null);
    try {
      const asset = createIntelligenceAsset({
        title,
        content,
        kind,
        status: 'draft',
        source: 'chief-mobile-local',
        provider: 'provider-neutral',
      });
      const validation = validateIntelligenceAsset(asset);
      if (!validation.valid) throw new Error(validation.errors.join('; '));
      setAssets((current) => [...current, asset]);
      setTitle('');
      setContent('');
      setMessage(`Saved ${asset.kind} draft to this in-memory session.`);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create the intelligence asset.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }

  async function inspectSnapshot() {
    setMessage(null);
    setSnapshotSummary(null);
    try {
      const parsedJson = JSON.parse(snapshotInput);
      const parsed = parsePortableSnapshot(parsedJson);
      const summary = {
        assets: parsed.assets.length,
        customPrompts: parsed.customPrompts.length,
        stars: parsed.stars.length,
        goals: Array.isArray(parsed.goals) ? parsed.goals.length : null,
      };
      setSnapshotSummary(summary);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Snapshot could not be parsed.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }

  async function shareSnapshot() {
    if (!assets.length) {
      setMessage('Create at least one local asset before sharing a snapshot.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    await Haptics.selectionAsync();
    await Share.share({
      title: 'Chief founder-intelligence snapshot',
      message: JSON.stringify(snapshot, null, 2),
    });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>OFFLINE FOUNDER INTELLIGENCE</Text>
          <Text style={styles.title}>Chief logic, without shipping Chief's secrets.</Text>
          <Text style={styles.subtitle}>
            Create and validate portable founder-intelligence assets on-device using Chief's canonical schema. No model provider is called and no bundled prompt catalog is exposed.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Create local asset</Text>
          <Text style={styles.label}>Kind</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {ASSET_KINDS.map((assetKind) => (
              <Pressable
                accessibilityRole="button"
                key={assetKind}
                onPress={() => setKind(assetKind)}
                style={[styles.chip, kind === assetKind && styles.chipActive]}
              >
                <Text style={[styles.chipText, kind === assetKind && styles.chipTextActive]}>{assetKind}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.label}>Title</Text>
          <TextInput
            accessibilityLabel="Asset title"
            onChangeText={setTitle}
            placeholder="What is this intelligence asset?"
            placeholderTextColor="#64748b"
            style={styles.input}
            value={title}
          />

          <Text style={styles.label}>Content</Text>
          <TextInput
            accessibilityLabel="Asset content"
            multiline
            onChangeText={setContent}
            placeholder="Founder-authored content stays local until you explicitly share it."
            placeholderTextColor="#64748b"
            style={[styles.input, styles.textarea]}
            textAlignVertical="top"
            value={content}
          />

          <Pressable accessibilityRole="button" onPress={() => void addAsset()} style={styles.primaryButton}>
            <Text style={styles.primaryText}>Validate + add locally</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.sectionTitle}>Session snapshot</Text>
              <Text style={styles.muted}>{assets.length} validated asset{assets.length === 1 ? '' : 's'}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => void shareSnapshot()} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>Share explicitly</Text>
            </Pressable>
          </View>
          {assets.slice(-5).reverse().map((asset) => (
            <View key={asset.id} style={styles.listItem}>
              <Text style={styles.itemTitle}>{asset.title}</Text>
              <Text style={styles.muted}>{asset.kind} · {asset.status} · v{asset.version}</Text>
            </View>
          ))}
          {!assets.length ? <Text style={styles.muted}>Nothing is persisted or transmitted automatically.</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Inspect portable snapshot</Text>
          <Text style={styles.muted}>Paste a Chief portable snapshot. Validation runs locally and reports counts without executing provider or FCR actions.</Text>
          <TextInput
            accessibilityLabel="Portable snapshot JSON"
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            onChangeText={setSnapshotInput}
            placeholder='{"format":"founder-intelligence-snapshot", ...}'
            placeholderTextColor="#64748b"
            style={[styles.input, styles.snapshotInput]}
            textAlignVertical="top"
            value={snapshotInput}
          />
          <Pressable accessibilityRole="button" onPress={() => void inspectSnapshot()} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Validate snapshot</Text>
          </Pressable>
          {snapshotSummary ? (
            <View style={styles.summaryGrid}>
              <Metric label="Assets" value={snapshotSummary.assets} />
              <Metric label="Custom" value={snapshotSummary.customPrompts} />
              <Metric label="Stars" value={snapshotSummary.stars} />
              <Metric label="Goals" value={snapshotSummary.goals ?? 'legacy'} />
            </View>
          ) : null}
        </View>

        <View style={styles.boundaryCard}>
          <Text style={styles.boundaryTitle}>Authority + privacy boundary</Text>
          <Text style={styles.boundaryText}>
            This carrier performs local schema work only. It has no provider key, no model execution, no FCR mutation authority, no bundled proprietary prompt catalog, and no approved store identifier yet. Sharing is a user-triggered export of the exact local snapshot.
          </Text>
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{String(value)}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#060913' },
  content: { padding: 20, paddingBottom: 48, gap: 16 },
  hero: { gap: 8, paddingTop: 12 },
  eyebrow: { color: '#a78bfa', fontSize: 12, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: '#f8fafc', fontSize: 30, lineHeight: 36, fontWeight: '900' },
  subtitle: { color: '#94a3b8', fontSize: 15, lineHeight: 22 },
  card: { backgroundColor: '#111827', borderColor: '#312e81', borderRadius: 20, borderWidth: 1, gap: 12, padding: 18 },
  sectionTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '900' },
  label: { color: '#cbd5e1', fontSize: 13, fontWeight: '800' },
  input: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: '#334155', backgroundColor: '#080d19', color: '#f8fafc', paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  textarea: { minHeight: 140 },
  snapshotInput: { minHeight: 160, fontFamily: 'monospace' },
  chipRow: { gap: 8, paddingVertical: 2 },
  chip: { borderColor: '#334155', borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { backgroundColor: '#6d28d9', borderColor: '#8b5cf6' },
  chipText: { color: '#94a3b8', fontSize: 12, fontWeight: '800' },
  chipTextActive: { color: '#f5f3ff' },
  primaryButton: { backgroundColor: '#6d28d9', borderRadius: 14, alignItems: 'center', paddingVertical: 14 },
  primaryText: { color: '#ffffff', fontWeight: '900' },
  secondaryButton: { borderColor: '#8b5cf6', borderWidth: 1, borderRadius: 14, alignItems: 'center', paddingVertical: 11, paddingHorizontal: 14 },
  secondaryText: { color: '#ddd6fe', fontWeight: '900', fontSize: 13 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  listItem: { borderTopColor: '#1f2937', borderTopWidth: 1, paddingTop: 10, gap: 3 },
  itemTitle: { color: '#e5e7eb', fontSize: 14, fontWeight: '800' },
  muted: { color: '#94a3b8', fontSize: 12, lineHeight: 18 },
  summaryGrid: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, backgroundColor: '#080d19', borderRadius: 12, padding: 10, gap: 2 },
  metricValue: { color: '#f5f3ff', fontSize: 17, fontWeight: '900' },
  metricLabel: { color: '#7c3aed', fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  boundaryCard: { backgroundColor: '#160f24', borderColor: '#7c3aed', borderWidth: 1, borderRadius: 16, padding: 14, gap: 6 },
  boundaryTitle: { color: '#c4b5fd', fontSize: 13, fontWeight: '900' },
  boundaryText: { color: '#a5b4fc', fontSize: 12, lineHeight: 18 },
  message: { color: '#cbd5e1', fontSize: 13, lineHeight: 19 },
});
