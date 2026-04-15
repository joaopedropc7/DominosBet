import { useCallback, useEffect, useRef, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator, Alert, FlatList, Modal, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { adminAdjustBalance, adminListUsers, adminSetBan } from '@/services/admin';
import { theme } from '@/theme';
import type { ProfileRow } from '@/types/database';
import { formatCoins } from '@/utils/format';

export function AdminUsersView() {
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedUser, setSelectedUser] = useState<ProfileRow | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (term = '') => {
    setLoading(true);
    setError('');
    try {
      setUsers(await adminListUsers(term));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function onSearchChange(text: string) {
    setSearch(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(text), 400);
  }

  function openUserModal(user: ProfileRow) {
    setSelectedUser(user);
    setAdjustAmount('');
    setAdjustReason('');
    setModalVisible(true);
  }

  async function handleAdjustBalance() {
    if (!selectedUser) return;
    const amount = parseInt(adjustAmount, 10);
    if (isNaN(amount) || amount === 0) {
      Alert.alert('Valor inválido', 'Digite um valor diferente de zero.');
      return;
    }
    if (!adjustReason.trim()) {
      Alert.alert('Motivo obrigatório', 'Informe o motivo do ajuste.');
      return;
    }
    setSaving(true);
    try {
      await adminAdjustBalance(selectedUser.id, amount, adjustReason.trim());
      setModalVisible(false);
      await load(search);
    } catch (e) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível ajustar o saldo.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleBan(user: ProfileRow) {
    Alert.alert(
      user.is_banned ? 'Desbanir usuário' : 'Banir usuário',
      `Confirmar ${user.is_banned ? 'desbanimento' : 'banimento'} de ${user.display_name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: user.is_banned ? 'Desbanir' : 'Banir',
          style: user.is_banned ? 'default' : 'destructive',
          onPress: async () => {
            try {
              await adminSetBan(user.id, !user.is_banned);
              await load(search);
            } catch (e) {
              Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível alterar status.');
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
          <Text style={styles.pageTitle}>Usuários</Text>
          <Text style={styles.pageSubtitle}>Gerencie contas, saldo e acesso</Text>
        </View>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={16} color={theme.colors.textFaint} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nome ou e-mail..."
            placeholderTextColor={theme.colors.textFaint}
            value={search}
            onChangeText={onSearchChange}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <Pressable onPress={() => { setSearch(''); load(''); }}>
              <MaterialCommunityIcons name="close-circle" size={15} color={theme.colors.textFaint} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Table header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.col, styles.colWide, styles.colHead]}>Usuário</Text>
        <Text style={[styles.col, styles.colHead]}>Saldo</Text>
        <Text style={[styles.col, styles.colHead]}>Partidas</Text>
        <Text style={[styles.col, styles.colHead]}>Nível</Text>
        <Text style={[styles.col, styles.colHead]}>Status</Text>
        <Text style={[styles.col, styles.colActions, styles.colHead]}>Ações</Text>
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
          data={users}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <UserRow
              user={item}
              even={index % 2 === 0}
              onAdjust={() => openUserModal(item)}
              onToggleBan={() => handleToggleBan(item)}
            />
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Nenhum usuário encontrado.</Text>
          }
        />
      )}

      {/* Adjust Balance Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <Text style={styles.modalTitle}>{selectedUser?.display_name}</Text>
            <Text style={styles.modalSubtitle}>
              Saldo atual: {formatCoins(selectedUser?.balance ?? 0)} moedas
            </Text>

            <Text style={styles.fieldLabel}>Valor do ajuste (use − para débito)</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="ex: 500 ou -200"
              placeholderTextColor={theme.colors.textFaint}
              value={adjustAmount}
              onChangeText={setAdjustAmount}
              keyboardType="numbers-and-punctuation"
            />

            <Text style={styles.fieldLabel}>Motivo</Text>
            <TextInput
              style={[styles.fieldInput, styles.fieldInputMulti]}
              placeholder="ex: Bônus de evento"
              placeholderTextColor={theme.colors.textFaint}
              value={adjustReason}
              onChangeText={setAdjustReason}
              multiline
            />

            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.modalBtnCancel, pressed && { opacity: 0.7 }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalBtnText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.modalBtnConfirm, pressed && { opacity: 0.8 }]}
                onPress={handleAdjustBalance}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#241A00" size="small" />
                  : <Text style={[styles.modalBtnText, { color: '#241A00' }]}>Aplicar</Text>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function UserRow({
  user, even, onAdjust, onToggleBan,
}: {
  user: ProfileRow;
  even: boolean;
  onAdjust: () => void;
  onToggleBan: () => void;
}) {
  return (
    <View style={[styles.tableRow, even && styles.tableRowEven, user.is_banned && styles.tableRowBanned]}>
      {/* Name + email */}
      <View style={[styles.col, styles.colWide, { gap: 2 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.userName}>{user.display_name}</Text>
          {user.is_admin && <Badge label="Admin" accent />}
        </View>
        <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
      </View>
      <Text style={styles.col}>{formatCoins(user.balance)}</Text>
      <Text style={styles.col}>{user.matches_count}</Text>
      <Text style={styles.col}>{user.level}</Text>
      <View style={styles.col}>
        <Badge
          label={user.is_banned ? 'Banido' : 'Ativo'}
          danger={user.is_banned}
        />
      </View>
      <View style={[styles.col, styles.colActions, { flexDirection: 'row', gap: 6 }]}>
        <ActionBtn icon="cash-plus" color={theme.colors.primary} onPress={onAdjust} />
        <ActionBtn
          icon={user.is_banned ? 'account-check' : 'account-cancel'}
          color={user.is_banned ? theme.colors.accent : theme.colors.danger}
          onPress={onToggleBan}
        />
      </View>
    </View>
  );
}

function Badge({ label, accent = false, danger = false }: { label: string; accent?: boolean; danger?: boolean }) {
  return (
    <View style={[
      styles.badge,
      accent && styles.badgeAccent,
      danger && styles.badgeDanger,
    ]}>
      <Text style={[
        styles.badgeText,
        accent && { color: theme.colors.primary },
        danger && { color: theme.colors.danger },
      ]}>{label}</Text>
    </View>
  );
}

function ActionBtn({ icon, color, onPress }: { icon: string; color: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
    >
      <MaterialCommunityIcons name={icon as any} size={16} color={color} />
    </Pressable>
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
    gap: theme.spacing.lg,
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 9,
    minWidth: 260,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 13,
    padding: 0,
    outlineStyle: 'none',
  } as any,

  // Table
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  tableRowEven: {
    backgroundColor: 'rgba(255,255,255,0.015)',
  },
  tableRowBanned: {
    opacity: 0.55,
  },
  col: {
    flex: 1,
    color: theme.colors.textSoft,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 13,
  },
  colWide: { flex: 2.5 },
  colActions: { flex: 1, maxWidth: 80 },
  colHead: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  list: { paddingBottom: theme.spacing.xxxl },
  userName: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 14,
  },
  userEmail: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.body,
    fontSize: 12,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceHigh,
  },
  badgeAccent: { backgroundColor: theme.colors.primarySoft },
  badgeDanger: { backgroundColor: 'rgba(255,139,135,0.12)' },
  badgeText: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 60,
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

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modal: {
    width: 420,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    padding: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  modalTitle: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.display, fontSize: 20 },
  modalSubtitle: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 13 },
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
  fieldInputMulti: { minHeight: 72, textAlignVertical: 'top' },
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
