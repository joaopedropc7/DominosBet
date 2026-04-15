import { useEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator, Alert, FlatList, Modal, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import {
  adminCreateAffiliateLink,
  adminListAffiliateLinks,
  adminToggleAffiliateLink,
} from '@/services/admin';
import { theme } from '@/theme';
import type { AffiliateLinkRow } from '@/types/database';

export function AdminAffiliatesView() {
  const [links, setLinks] = useState<AffiliateLinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [createVisible, setCreateVisible] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newBonus, setNewBonus] = useState('100');
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setLinks(await adminListAffiliateLinks());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar links.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    const code = newCode.trim();
    const bonus = parseInt(newBonus, 10);
    if (code.length < 3) { Alert.alert('Código inválido', 'Mínimo 3 caracteres.'); return; }
    if (isNaN(bonus) || bonus < 0) { Alert.alert('Bônus inválido', 'Digite um número positivo.'); return; }
    setCreating(true);
    try {
      await adminCreateAffiliateLink(code, newLabel.trim(), bonus);
      setCreateVisible(false);
      setNewCode(''); setNewLabel(''); setNewBonus('100');
      await load();
    } catch (e) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível criar o link.');
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(link: AffiliateLinkRow) {
    Alert.alert(
      link.is_active ? 'Desativar link' : 'Ativar link',
      `Deseja ${link.is_active ? 'desativar' : 'ativar'} o link "${link.code}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: link.is_active ? 'Desativar' : 'Ativar',
          onPress: async () => {
            try {
              await adminToggleAffiliateLink(link.id, !link.is_active);
              await load();
            } catch (e) {
              Alert.alert('Erro', e instanceof Error ? e.message : 'Erro ao alterar status.');
            }
          },
        },
      ],
    );
  }

  return (
    <View style={styles.root}>
      {/* Page header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Afiliados</Text>
          <Text style={styles.pageSubtitle}>Links de convite e rastreamento de campanhas</Text>
        </View>
        <Pressable
          onPress={() => setCreateVisible(true)}
          style={({ pressed }) => [styles.createBtn, pressed && { opacity: 0.85 }]}
        >
          <MaterialCommunityIcons name="plus" size={16} color="#241A00" />
          <Text style={styles.createBtnText}>Novo link</Text>
        </Pressable>
      </View>

      {/* Table header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.col, styles.colCode, styles.colHead]}>Código</Text>
        <Text style={[styles.col, styles.colHead]}>Rótulo</Text>
        <Text style={[styles.col, styles.colHead]}>Bônus</Text>
        <Text style={[styles.col, styles.colHead]}>Usos</Text>
        <Text style={[styles.col, styles.colHead]}>Criado por</Text>
        <Text style={[styles.col, styles.colHead]}>Criado em</Text>
        <Text style={[styles.col, styles.colHead]}>Status</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 60 }} />
      ) : error ? (
        <View style={styles.errorBox}>
          <MaterialCommunityIcons name="alert-circle-outline" size={18} color={theme.colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={links}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <LinkRow
              link={item}
              even={index % 2 === 0}
              onToggle={() => handleToggle(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <MaterialCommunityIcons name="link-variant-off" size={36} color={theme.colors.textFaint} />
              <Text style={styles.emptyText}>Nenhum link criado ainda.</Text>
              <Pressable
                onPress={() => setCreateVisible(true)}
                style={({ pressed }) => [styles.createBtn, pressed && { opacity: 0.85 }]}
              >
                <MaterialCommunityIcons name="plus" size={14} color="#241A00" />
                <Text style={styles.createBtnText}>Criar primeiro link</Text>
              </Pressable>
            </View>
          }
        />
      )}

      {/* Create Modal */}
      <Modal
        visible={createVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setCreateVisible(false)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>Novo link de afiliado</Text>

            <Text style={styles.fieldLabel}>Código único</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="ex: AMIGO2024"
              placeholderTextColor={theme.colors.textFaint}
              value={newCode}
              onChangeText={setNewCode}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <Text style={styles.fieldLabel}>Rótulo (opcional)</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="ex: Campanha verão"
              placeholderTextColor={theme.colors.textFaint}
              value={newLabel}
              onChangeText={setNewLabel}
            />

            <Text style={styles.fieldLabel}>Bônus em moedas por cadastro</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="100"
              placeholderTextColor={theme.colors.textFaint}
              value={newBonus}
              onChangeText={setNewBonus}
              keyboardType="number-pad"
            />

            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.modalBtnCancel, pressed && { opacity: 0.7 }]}
                onPress={() => setCreateVisible(false)}
              >
                <Text style={styles.modalBtnText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.modalBtnConfirm, pressed && { opacity: 0.8 }]}
                onPress={handleCreate}
                disabled={creating}
              >
                {creating
                  ? <ActivityIndicator color="#241A00" size="small" />
                  : <Text style={[styles.modalBtnText, { color: '#241A00' }]}>Criar</Text>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function LinkRow({
  link, even, onToggle,
}: {
  link: AffiliateLinkRow;
  even: boolean;
  onToggle: () => void;
}) {
  const date = new Date(link.created_at).toLocaleDateString('pt-BR');
  return (
    <View style={[styles.tableRow, even && styles.tableRowEven, !link.is_active && styles.tableRowInactive]}>
      <Text style={[styles.col, styles.colCode, styles.codeText]}>{link.code}</Text>
      <Text style={[styles.col, styles.cellText]}>{link.label || '—'}</Text>
      <Text style={[styles.col, styles.cellText]}>+{link.bonus_coins}</Text>
      <Text style={[styles.col, styles.cellText]}>{link.uses_count}</Text>
      <Text style={[styles.col, styles.cellText]}>{link.creator_name}</Text>
      <Text style={[styles.col, styles.cellText]}>{date}</Text>
      <View style={styles.col}>
        <Pressable
          onPress={onToggle}
          style={({ pressed }) => [styles.toggleBtn, pressed && { opacity: 0.7 }]}
        >
          <MaterialCommunityIcons
            name={link.is_active ? 'toggle-switch' : 'toggle-switch-off'}
            size={26}
            color={link.is_active ? theme.colors.accent : theme.colors.textFaint}
          />
          <Text style={[styles.toggleLabel, !link.is_active && { color: theme.colors.textFaint }]}>
            {link.is_active ? 'Ativo' : 'Inativo'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },

  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  pageTitle: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 26,
  },
  pageSubtitle: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 13,
    marginTop: 2,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 9,
  },
  createBtnText: {
    color: '#241A00',
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 13,
  },

  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
    backgroundColor: theme.colors.surface,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  tableRowEven: { backgroundColor: 'rgba(255,255,255,0.015)' },
  tableRowInactive: { opacity: 0.5 },
  col: { flex: 1 },
  colCode: { flex: 1.2 },
  colHead: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  codeText: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 15,
    letterSpacing: 0.5,
  },
  cellText: {
    color: theme.colors.textSoft,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 13,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  toggleLabel: {
    color: theme.colors.accent,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 12,
  },
  list: { paddingBottom: theme.spacing.xxxl },
  emptyWrap: {
    alignItems: 'center',
    gap: theme.spacing.md,
    marginTop: 80,
  },
  emptyText: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 14,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    margin: theme.spacing.xl,
    backgroundColor: 'rgba(255,139,135,0.10)',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  errorText: { color: theme.colors.danger, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 14, flex: 1 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modal: {
    width: 440,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    padding: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  modalTitle: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.display, fontSize: 20, marginBottom: 4 },
  fieldLabel: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginTop: theme.spacing.xs,
  },
  fieldInput: {
    backgroundColor: theme.colors.surfaceHigh,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 15,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    outlineStyle: 'none',
  } as any,
  modalActions: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  modalBtn: {
    flex: 1,
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancel: { backgroundColor: theme.colors.surfaceHigh, borderWidth: 1, borderColor: theme.colors.outline },
  modalBtnConfirm: { backgroundColor: theme.colors.primary },
  modalBtnText: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 14 },
});
