import { useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOnlineMatch } from '@/hooks/useOnlineMatch';
import { canOnlinePlayerMove, getOnlineLegalMoves } from '@/game-engine/online-game';
import type { OnlinePlayedTile } from '@/types/database';
import { useResponsive } from '@/hooks/useResponsive';
import { theme } from '@/theme';
import { SLOT_PX, initBoardSlots, placePiece, placementToPixels } from '@/game-engine/board-slots';
import { DominoTileView } from '../components/DominoTileView';

interface OnlineMatchScreenViewProps {
  roomId: string;
  role: 'p1' | 'p2';
  myUserId: string;
  myName: string;
}

export function OnlineMatchScreenView({
  roomId,
  role,
  myUserId,
  myName,
}: OnlineMatchScreenViewProps) {
  const { isCompact, width } = useResponsive();
  const { height: screenH } = useWindowDimensions();
  const [boardBoxH, setBoardBoxH] = useState(() => Math.max(180, screenH * 0.42));
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);

  const {
    phase,
    game,
    myRole,
    isMyturn,
    error,
    playTile,
    drawTile,
    passTurn,
    abandonGame,
  } = useOnlineMatch({ roomId, role, myUserId, myName });

  // ── Result overlay animation ──────────────────────────────────────────────
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const overlayScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (phase !== 'finished') return;
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(overlayScale, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }),
    ]).start();
  }, [phase]);

  // ── Derived game data ─────────────────────────────────────────────────────
  const myHand = useMemo(() => {
    if (!game) return [];
    return myRole === 'p1' ? game.p1Hand : game.p2Hand;
  }, [game, myRole]);

  const opponentHand = useMemo(() => {
    if (!game) return [];
    return myRole === 'p1' ? game.p2Hand : game.p1Hand;
  }, [game, myRole]);

  const opponentName = useMemo(() => {
    if (!game) return 'Adversário';
    return myRole === 'p1' ? game.p2Name : game.p1Name;
  }, [game, myRole]);

  const myLegalMoves = useMemo(
    () => (game && phase === 'playing' ? getOnlineLegalMoves(game, myRole) : []),
    [game, myRole, phase],
  );

  const selectedTile = myHand.find((t) => t.id === selectedTileId) ?? null;

  const availableSides = useMemo(
    () => [...new Set(myLegalMoves.filter((m) => m.tileId === selectedTileId).map((m) => m.side))],
    [myLegalMoves, selectedTileId],
  );

  const canPlay = myLegalMoves.length > 0;
  const canDraw = game ? game.boneyard.length > 0 : false;

  const boardLayout = useMemo(
    () => game ? createBoardLayout(game.board, width, boardBoxH) : null,
    [game?.board, width, boardBoxH],
  );

  // ── Auto-pass when no moves and empty boneyard ────────────────────────────
  useEffect(() => {
    if (!game || !isMyturn || canPlay || canDraw || phase !== 'playing') return;
    const t = setTimeout(() => passTurn(), 700);
    return () => clearTimeout(t);
  }, [isMyturn, canPlay, canDraw, phase]);

  // ── Deselect tile if it was played ───────────────────────────────────────
  useEffect(() => {
    if (selectedTileId && !myHand.some((t) => t.id === selectedTileId)) {
      setSelectedTileId(null);
    }
  }, [myHand, selectedTileId]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleTilePress(tileId: string) {
    if (!isMyturn || phase !== 'playing') return;
    const hasMove = myLegalMoves.some((m) => m.tileId === tileId);
    if (!hasMove) return;
    setSelectedTileId((cur) => (cur === tileId ? null : tileId));
  }

  function handleAbandon() {
    Alert.alert('Desistir', 'Tem certeza que deseja abandonar a partida? Seu adversário vencerá.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desistir',
        style: 'destructive',
        onPress: async () => {
          await abandonGame();
          router.replace('/');
        },
      },
    ]);
  }

  // ── Phases: loading / waiting ─────────────────────────────────────────────
  if (phase === 'loading' || phase === 'starting') {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
        <Text style={styles.waitText}>
          {phase === 'starting' ? 'Iniciando partida…' : 'Carregando…'}
        </Text>
      </SafeAreaView>
    );
  }

  if (phase === 'waiting') {
    return (
      <SafeAreaView style={styles.centered}>
        <MaterialCommunityIcons name="account-search-outline" size={48} color={theme.colors.primary} />
        <Text style={styles.waitTitle}>Aguardando adversário</Text>
        <Text style={styles.waitText}>Compartilhe o link ou aguarde alguém entrar…</Text>
        <Pressable
          onPress={() => { abandonGame(); router.replace('/'); }}
          style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.cancelBtnText}>Cancelar</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (phase === 'error') {
    return (
      <SafeAreaView style={styles.centered}>
        <MaterialCommunityIcons name="alert-circle-outline" size={40} color={theme.colors.danger} />
        <Text style={styles.errorText}>{error || 'Erro desconhecido.'}</Text>
        <Pressable onPress={() => router.replace('/')} style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}>
          <Text style={styles.cancelBtnText}>Voltar</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ── Playing / Finished ────────────────────────────────────────────────────
  const isMyTurnLabel = isMyturn ? 'Sua vez' : `Vez de ${opponentName}`;
  const statusLabel = phase === 'playing' ? isMyTurnLabel : 'Partida encerrada';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.root}>

        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable
            onPress={handleAbandon}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
          >
            <MaterialCommunityIcons name="flag-outline" size={18} color={theme.colors.textMuted} />
          </Pressable>
          <View style={styles.topCenter}>
            <Text style={styles.topTitle}>1v1 Online</Text>
            <View style={styles.turnIndicator}>
              <View style={[styles.turnDot, isMyturn && styles.turnDotActive]} />
              <Text style={styles.turnLabel}>{statusLabel}</Text>
            </View>
          </View>
          {/* Boneyard count */}
          <View style={[styles.iconButton, { flexDirection: 'row', gap: 4 }]}>
            <MaterialCommunityIcons name="cards" size={13} color={theme.colors.textFaint} />
            <Text style={styles.boneyardCount}>{game?.boneyard.length ?? 0}</Text>
          </View>
        </View>

        {/* Opponent zone */}
        <View style={styles.opponentZone}>
          <View style={styles.opponentAvatar}>
            <MaterialCommunityIcons name="account" size={16} color={theme.colors.primary} />
          </View>
          <View style={styles.opponentInfo}>
            <Text style={styles.opponentName}>{opponentName}</Text>
            <View style={styles.opponentCountBadge}>
              <MaterialCommunityIcons name="cards" size={11} color={theme.colors.textFaint} />
              <Text style={styles.opponentCountValue}>{opponentHand.length} peças</Text>
            </View>
          </View>
          <View style={styles.opponentHand}>
            {opponentHand.slice(0, Math.min(opponentHand.length, 7)).map((tile, i) => (
              <View key={`${tile.id}-${i}`} style={styles.opponentTileWrap}>
                <DominoTileView tile={tile} hidden size="xs" />
              </View>
            ))}
          </View>
        </View>

        {/* Board */}
        <View style={styles.boardZone}>
          <View
            style={styles.boardBox}
            onLayout={(e) => setBoardBoxH(e.nativeEvent.layout.height)}
          >
            {boardLayout && (
              <View style={[styles.boardCanvas, { width: boardLayout.width, height: boardLayout.height }]}>
                {game?.board.map((tile, index) => {
                  const layout = boardLayout.positions[index];
                  if (!layout) return null;
                  return (
                    <View
                      key={tile.id}
                      style={[styles.boardTileAbsolute, { left: layout.left, top: layout.top }]}
                    >
                      <DominoTileView
                        tile={layout.swapPips ? { ...tile, left: tile.right, right: tile.left } : tile}
                        size="xs"
                        orientation={layout.orientation}
                      />
                    </View>
                  );
                })}

                {/* Ghost slots */}
                {availableSides.includes('left') && boardLayout.leftGhostPos && (
                  <Pressable
                    onPress={() => selectedTile && playTile(selectedTile.id, 'left')}
                    style={({ pressed }) => [
                      styles.ghostSlot,
                      {
                        left: boardLayout.leftGhostPos.left,
                        top: boardLayout.leftGhostPos.top,
                        width: boardLayout.leftGhostPos.width,
                        height: boardLayout.leftGhostPos.height,
                      },
                      pressed && styles.ghostSlotPressed,
                    ]}
                  />
                )}
                {availableSides.includes('right') && boardLayout.rightGhostPos && (
                  <Pressable
                    onPress={() => selectedTile && playTile(selectedTile.id, 'right')}
                    style={({ pressed }) => [
                      styles.ghostSlot,
                      {
                        left: boardLayout.rightGhostPos.left,
                        top: boardLayout.rightGhostPos.top,
                        width: boardLayout.rightGhostPos.width,
                        height: boardLayout.rightGhostPos.height,
                      },
                      pressed && styles.ghostSlotPressed,
                    ]}
                  />
                )}
              </View>
            )}
          </View>
        </View>

        {/* Footer / player hand */}
        <View style={styles.footerZone}>
          <View style={styles.footerHeader}>
            <Text style={styles.footerLabel}>Você</Text>
            <Text style={styles.footerCaption}>
              {isMyturn && phase === 'playing'
                ? selectedTile
                  ? 'Toque em uma ponta dourada da mesa.'
                  : !canPlay && !canDraw
                    ? 'Sem jogadas. Passando vez…'
                    : !canPlay && canDraw
                      ? 'Sem jogadas — compre uma peça.'
                      : 'Selecione uma peça.'
                : phase === 'playing'
                  ? `Aguarde ${opponentName}…`
                  : ''}
            </Text>
          </View>

          {/* Hand row */}
          <ScrollView
            horizontal
            bounces={false}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.playerHand, isCompact && styles.playerHandCompact]}
          >
            {myHand.map((tile) => {
              const isPlayable = myLegalMoves.some((m) => m.tileId === tile.id);
              return (
                <View key={tile.id} style={styles.playerTileWrap}>
                  <DominoTileView
                    tile={tile}
                    size="sm"
                    selected={selectedTileId === tile.id}
                    playable={isPlayable && isMyturn && phase === 'playing'}
                    dimmed={!isPlayable && isMyturn && phase === 'playing'}
                    onPress={() => handleTilePress(tile.id)}
                  />
                </View>
              );
            })}
          </ScrollView>

          {/* Draw button — only when it's my turn, no legal plays, boneyard not empty */}
          {isMyturn && !canPlay && canDraw && phase === 'playing' && (
            <Pressable
              onPress={drawTile}
              style={({ pressed }) => [styles.drawBtn, pressed && { opacity: 0.8 }]}
            >
              <MaterialCommunityIcons name="cards-playing-outline" size={16} color="#241A00" />
              <Text style={styles.drawBtnText}>Comprar peça ({game?.boneyard.length})</Text>
            </Pressable>
          )}
        </View>

      </View>

      {/* Result overlay */}
      {phase === 'finished' && game?.result && (
        <Animated.View style={[styles.resultOverlay, { opacity: overlayOpacity }]}>
          <ScrollView
            contentContainerStyle={styles.resultScroll}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <Animated.View style={[styles.resultCard, { transform: [{ scale: overlayScale }] }]}>

              {game.result.winner === myRole ? (
                <>
                  <Text style={styles.resultEmoji}>🏆</Text>
                  <Text style={styles.resultTitle}>Você venceu!</Text>
                </>
              ) : game.result.winner === 'draw' ? (
                <>
                  <Text style={styles.resultEmoji}>🤝</Text>
                  <Text style={styles.resultTitle}>Empate</Text>
                </>
              ) : (
                <>
                  <Text style={styles.resultEmoji}>💀</Text>
                  <Text style={styles.resultTitle}>{opponentName} venceu</Text>
                </>
              )}
              <Text style={styles.resultReason}>
                {game.result.reason === 'blocked'
                  ? 'Jogo bloqueado — menor pontuação vence'
                  : game.result.reason === 'abandoned'
                    ? 'Adversário desistiu'
                    : 'Fechou a mão'}
              </Text>

              {/* Hands reveal */}
              {[
                { label: opponentName, hand: opponentHand, pips: myRole === 'p1' ? game.result.p2Pips : game.result.p1Pips, isWinner: game.result.winner !== myRole && game.result.winner !== 'draw' },
                { label: 'Você', hand: myHand, pips: myRole === 'p1' ? game.result.p1Pips : game.result.p2Pips, isWinner: game.result.winner === myRole },
              ].map(({ label, hand, pips, isWinner }) => (
                <View key={label} style={styles.resultHandSection}>
                  <View style={styles.resultHandHeader}>
                    <Text style={styles.resultHandLabel}>{label}</Text>
                    <Text style={[styles.resultHandPips, isWinner && styles.resultPipWinner]}>
                      {pips} pts
                    </Text>
                  </View>
                  {hand.length === 0 ? (
                    <Text style={styles.resultHandEmpty}>Sem peças — fechou a mão</Text>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.resultHandTiles}>
                      {hand.map((tile) => (
                        <View key={tile.id} style={styles.resultTileWrap}>
                          <DominoTileView tile={tile} size="xs" orientation="vertical" />
                        </View>
                      ))}
                    </ScrollView>
                  )}
                </View>
              ))}

              <Pressable
                onPress={() => router.replace('/')}
                style={({ pressed }) => [styles.resultButton, pressed && styles.resultButtonPressed]}
              >
                <Text style={styles.resultButtonText}>Voltar ao início</Text>
              </Pressable>
            </Animated.View>
          </ScrollView>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

// ── Board layout (identical to BotMatchScreenView) ─────────────────────────
type GhostPos = { left: number; top: number; width: number; height: number };

function createBoardLayout(board: OnlinePlayedTile[], viewportWidth: number, containerH: number) {
  const PAD_H = 4, PAD_V = 10;
  const S = SLOT_PX;

  const canvasW = viewportWidth - 16;
  const usableW = canvasW - PAD_H * 2;
  const cols = Math.max(4, Math.floor(usableW / S));

  const usableH = containerH - PAD_V * 2;
  const rowLimit = Math.max(2, Math.floor(usableH / S));
  const totalRows = rowLimit;

  const slotBoard = initBoardSlots(cols, rowLimit);
  for (const tile of board) placePiece(slotBoard, tile as any);

  let { cursor, direction } = slotBoard;
  let ghostIsVertical = slotBoard.cornerPending > 0;

  if (cursor.col < 0 || cursor.col >= cols) {
    const end = slotBoard.chainEndCoord ?? { col: direction === 'ltr' ? cols - 1 : 0, row: cursor.row };
    direction = direction === 'ltr' ? 'rtl' : 'ltr';
    cursor = { col: end.col, row: end.row + 1 };
    ghostIsVertical = true;
  }

  const canvasH = containerH;

  const positions = board.map((_, i) => {
    const p = slotBoard.placements[i];
    if (!p) return null;
    const px = placementToPixels(p, totalRows, PAD_H, PAD_V);
    return { left: px.left, top: px.top, swapPips: p.swapPips, orientation: p.orientation };
  });

  const rightGhostPos: GhostPos = ghostIsVertical
    ? { left: PAD_H + cursor.col * S, top: PAD_V + (totalRows - 1 - (cursor.row + 1)) * S, width: S, height: S * 2 }
    : { left: PAD_H + (direction === 'ltr' ? cursor.col : cursor.col - 1) * S, top: PAD_V + (totalRows - 1 - cursor.row) * S, width: S * 2, height: S };

  const firstP = slotBoard.placements[0];
  const leftGhostPos: GhostPos = firstP
    ? {
        left: PAD_H + Math.min(firstP.slotA.col, firstP.slotB.col) * S,
        top: PAD_V + (totalRows - 1 - Math.max(firstP.slotA.row, firstP.slotB.row)) * S,
        width: firstP.orientation === 'vertical' ? S : S * 2,
        height: firstP.orientation === 'vertical' ? S * 2 : S,
      }
    : { left: PAD_H, top: PAD_V, width: S * 2, height: S };

  return { width: canvasW, height: canvasH, positions, leftGhostPos, rightGhostPos };
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  root: {
    flex: 1,
    paddingHorizontal: theme.spacing.sm,
    paddingTop: 0,
    paddingBottom: theme.spacing.xs,
  },
  centered: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.xl,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  iconButtonPressed: { transform: [{ scale: 0.95 }], opacity: 0.8 },
  topCenter: { alignItems: 'center', gap: 4 },
  topTitle: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 14,
    letterSpacing: 0.5,
  },
  turnIndicator: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  turnDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: theme.colors.surfaceHighest },
  turnDotActive: { backgroundColor: theme.colors.accent },
  turnLabel: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.4,
  },
  boneyardCount: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
  },

  // Opponent
  opponentZone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  opponentAvatar: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  opponentInfo: { gap: 2 },
  opponentName: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 13,
  },
  opponentCountBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  opponentCountValue: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 11,
  },
  opponentHand: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  opponentTileWrap: { marginHorizontal: -8 },

  // Board
  boardZone: { flex: 1, paddingBottom: theme.spacing.xs },
  boardBox: {
    flex: 1,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    backgroundColor: theme.colors.surfaceInset,
    overflow: 'hidden',
    paddingVertical: theme.spacing.xs,
  },
  boardCanvas: { alignSelf: 'center', position: 'relative' },
  boardTileAbsolute: { position: 'absolute' },
  ghostSlot: {
    position: 'absolute',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primarySoft,
  },
  ghostSlotPressed: { backgroundColor: 'rgba(242,202,80,0.25)', transform: [{ scale: 0.95 }] },

  // Footer
  footerZone: { gap: theme.spacing.xs, paddingBottom: 0 },
  footerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  footerLabel: {
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  footerCaption: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 11,
  },
  playerHand: { minHeight: 110, paddingRight: theme.spacing.xs, alignItems: 'flex-end' },
  playerHandCompact: { paddingHorizontal: theme.spacing.xs },
  playerTileWrap: { marginRight: theme.spacing.sm },
  drawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: 12,
    marginTop: theme.spacing.xs,
  },
  drawBtnText: {
    color: '#241A00',
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 14,
  },

  // Wait/error states
  waitTitle: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 22,
    textAlign: 'center',
  },
  waitText: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 14,
    textAlign: 'center',
  },
  errorText: {
    color: theme.colors.danger,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 14,
    textAlign: 'center',
  },
  cancelBtn: {
    backgroundColor: theme.colors.surfaceHigh,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    marginTop: theme.spacing.md,
  },
  cancelBtnText: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 14,
  },

  // Result overlay
  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  resultScroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 24 },
  resultCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.35)',
    padding: 28,
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  resultEmoji: { fontSize: 52 },
  resultTitle: {
    color: '#FFF7E7',
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 26,
    marginTop: 4,
  },
  resultReason: {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
  resultHandSection: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  resultHandHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultHandLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  resultHandPips: {
    color: '#FFF7E7',
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 16,
  },
  resultPipWinner: { color: '#F2CA50' },
  resultHandEmpty: {
    color: 'rgba(255,255,255,0.4)',
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 12,
    fontStyle: 'italic',
  },
  resultHandTiles: { flexDirection: 'row', gap: 6, paddingBottom: 2 },
  resultTileWrap: {},
  resultButton: {
    marginTop: 8,
    backgroundColor: '#F2CA50',
    borderRadius: 999,
    paddingVertical: 13,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  resultButtonPressed: { transform: [{ scale: 0.97 }] },
  resultButtonText: {
    color: '#131313',
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 15,
  },
});
