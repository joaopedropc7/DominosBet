import { useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  createFourPlayerMatch,
  getLegalMoves4P,
  passTurn4P,
  playMove4P,
  runBotTurn4P,
} from '@/game-engine/index-4p';
import type { FourPlayerId, FourPlayerMatchState } from '@/game-engine/types-4p';
import type { PlacementSide, PlayedTile } from '@/game-engine/types';
import { useResponsive } from '@/hooks/useResponsive';
import { theme } from '@/theme';
import { SLOT_PX, initBoardSlots, placePiece, placementToPixels } from '@/game-engine/board-slots';
import { DominoTileView } from '../components/DominoTileView';

const TEAM_COLORS = { team_a: theme.colors.accent, team_b: theme.colors.primary };
const BOT_ORDER: FourPlayerId[] = ['p2', 'p3', 'p4'];

export function FourPlayerMatchScreenView() {
  const [match, setMatch] = useState<FourPlayerMatchState>(() => createFourPlayerMatch());
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const { isCompact, width } = useResponsive();
  const { height: screenH } = useWindowDimensions();
  const [boardBoxH, setBoardBoxH] = useState(() => Math.max(180, screenH * 0.42));
  const boardLayout = useMemo(
    () => createBoardLayout(match.board, false, width, boardBoxH),
    [match.board, width, boardBoxH],
  );

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const overlayScale  = useRef(new Animated.Value(0.85)).current;

  const humanMoves = useMemo(() => getLegalMoves4P(match, 'p1'), [match]);
  const selectedTile = match.players.p1.hand.find(t => t.id === selectedTileId) ?? null;
  const availableSides = useMemo(
    () => [...new Set(humanMoves.filter(m => m.tileId === selectedTileId).map(m => m.side))],
    [humanMoves, selectedTileId],
  );

  // Show result overlay
  useEffect(() => {
    if (match.status !== 'finished') return;
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(overlayScale, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }),
    ]).start();
  }, [match.status]);

  // Run bot turns with delay
  useEffect(() => {
    if (match.status !== 'playing') return;
    const currentPlayer = match.players[match.currentPlayer];
    if (!currentPlayer.isBot) return;

    const timeout = setTimeout(() => {
      setMatch(s => runBotTurn4P(s));
    }, 700);
    return () => clearTimeout(timeout);
  }, [match.currentPlayer, match.status]);

  // Auto-pass human if no moves
  useEffect(() => {
    if (match.status !== 'playing' || match.currentPlayer !== 'p1') return;
    if (humanMoves.length > 0) return;
    const timeout = setTimeout(() => {
      setMatch(s => passTurn4P(s, 'p1', 'Você não tem jogadas. Vez passada.'));
    }, 700);
    return () => clearTimeout(timeout);
  }, [humanMoves.length, match.currentPlayer, match.status]);

  // Clear selected tile if no longer in hand
  useEffect(() => {
    if (selectedTileId && !match.players.p1.hand.some(t => t.id === selectedTileId)) {
      setSelectedTileId(null);
    }
  }, [match.players.p1.hand, selectedTileId]);

  function handleTilePress(tileId: string) {
    if (match.currentPlayer !== 'p1' || match.status !== 'playing') return;
    if (!humanMoves.some(m => m.tileId === tileId)) return;
    setSelectedTileId(cur => cur === tileId ? null : tileId);
  }

  function handlePlay(side: PlacementSide) {
    if (!selectedTile) return;
    setMatch(s => playMove4P(s, 'p1', selectedTile.id, side));
    setSelectedTileId(null);
  }

  function handleRestart() {
    overlayOpacity.setValue(0);
    overlayScale.setValue(0.85);
    setSelectedTileId(null);
    setMatch(createFourPlayerMatch());
  }

  const isHumanTurn = match.currentPlayer === 'p1' && match.status === 'playing';
  const result = match.result;
  const humanWon = result?.winnerTeam === 'team_a';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.root}>

        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}>
            <MaterialCommunityIcons name="arrow-left" size={20} color={theme.colors.textMuted} />
          </Pressable>
          <View style={styles.topCenter}>
            <Text style={styles.topTitle}>4 Jogadores</Text>
            <View style={styles.turnRow}>
              <View style={[styles.turnDot, { backgroundColor: match.currentPlayer === 'p1' ? theme.colors.accent : theme.colors.surfaceHighest }]} />
              <Text style={styles.turnLabel}>
                {match.status === 'playing'
                  ? match.currentPlayer === 'p1' ? 'Sua vez' : `Vez de ${match.players[match.currentPlayer].name}`
                  : 'Partida encerrada'}
              </Text>
            </View>
          </View>
          <Pressable onPress={handleRestart} style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}>
            <MaterialCommunityIcons name="restart" size={20} color={theme.colors.textMuted} />
          </Pressable>
        </View>

        {/* Opponents strip */}
        <View style={styles.opponentsStrip}>
          {BOT_ORDER.map(pid => {
            const p = match.players[pid];
            const isActive = match.currentPlayer === pid && match.status === 'playing';
            const teamColor = TEAM_COLORS[p.teamId];
            return (
              <View key={pid} style={[styles.opponentCard, isActive && styles.opponentCardActive]}>
                <View style={[styles.opponentAvatarWrap, { borderColor: teamColor }]}>
                  <Text style={styles.opponentEmoji}>{pid === 'p3' ? '🤝' : '🤖'}</Text>
                </View>
                <Text style={styles.opponentName}>{p.name}</Text>
                <Text style={styles.opponentTileCount}>{p.hand.length}</Text>
                <View style={styles.opponentHandPeek}>
                  {p.hand.slice(0, Math.min(p.hand.length, 5)).map((tile, i) => (
                    <View key={`${tile.id}-${i}`} style={styles.opponentTileWrap}>
                      <DominoTileView tile={tile} hidden size="xs" />
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>

        {/* Board */}
        <View style={styles.boardZone}>
          <View
            style={styles.boardBox}
            onLayout={(e) => setBoardBoxH(e.nativeEvent.layout.height)}>
            <View style={[styles.boardCanvas, { width: boardLayout.width, height: boardLayout.height }]}>

              {/* Tiles */}
              {match.board.map((tile, index) => {
                const layout = boardLayout.positions[index];
                if (!layout) return null;
                return (
                  <View key={tile.id} style={[styles.tileAbsolute, { left: layout.left, top: layout.top }]}>
                    <DominoTileView
                      tile={layout.swapPips ? { ...tile, left: tile.right, right: tile.left } : tile}
                      size="xs"
                      orientation={layout.orientation}
                    />
                  </View>
                );
              })}

              {/* Ghost slots — rendered after tiles so they sit on top */}
              {availableSides.includes('left') && (
                <Pressable
                  onPress={() => handlePlay('left')}
                  style={({ pressed }) => [
                    styles.ghostSlot,
                    { left: boardLayout.leftGhostPos.left, top: boardLayout.leftGhostPos.top, width: boardLayout.leftGhostPos.width, height: boardLayout.leftGhostPos.height },
                    pressed && styles.ghostSlotPressed,
                  ]}
                />
              )}
              {availableSides.includes('right') && (
                <Pressable
                  onPress={() => handlePlay('right')}
                  style={({ pressed }) => [
                    styles.ghostSlot,
                    { left: boardLayout.rightGhostPos.left, top: boardLayout.rightGhostPos.top, width: boardLayout.rightGhostPos.width, height: boardLayout.rightGhostPos.height },
                    pressed && styles.ghostSlotPressed,
                  ]}
                />
              )}
            </View>
          </View>
        </View>

        {/* Human hand */}
        <View style={styles.handZone}>
          <View style={styles.handHeader}>
            <View style={[styles.teamBadge, { backgroundColor: TEAM_COLORS.team_a + '22', borderColor: TEAM_COLORS.team_a }]}>
              <Text style={[styles.teamBadgeText, { color: TEAM_COLORS.team_a }]}>Time A · Você + Ally</Text>
            </View>
            <Text style={styles.handCaption}>
              {isHumanTurn
                ? selectedTile
                  ? 'Toque num slot tracejado.'
                  : humanMoves.length === 0
                    ? 'Sem jogadas, passando…'
                    : 'Selecione uma peça.'
                : match.status === 'playing'
                  ? `Vez de ${match.players[match.currentPlayer].name}…`
                  : ''}
            </Text>
          </View>
          <ScrollView
            horizontal bounces={false} showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.hand, isCompact && styles.handCompact]}>
            {match.players.p1.hand.map(tile => {
              const isPlayable = humanMoves.some(m => m.tileId === tile.id);
              return (
                <View key={tile.id} style={styles.handTileWrap}>
                  <DominoTileView
                    tile={tile} size="sm"
                    selected={selectedTileId === tile.id}
                    playable={isPlayable && isHumanTurn}
                    dimmed={!isPlayable && isHumanTurn}
                    onPress={() => handleTilePress(tile.id)}
                  />
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* Result overlay */}
      {match.status === 'finished' && result && (
        <Animated.View style={[styles.resultOverlay, { opacity: overlayOpacity }]}>
          <ScrollView contentContainerStyle={styles.resultScroll} showsVerticalScrollIndicator={false} bounces={false}>
            <Animated.View style={[styles.resultCard, { transform: [{ scale: overlayScale }] }]}>

              <Text style={styles.resultEmoji}>{humanWon ? '🏆' : result.winnerTeam === 'draw' ? '🤝' : '💀'}</Text>
              <Text style={styles.resultTitle}>
                {humanWon ? 'Seu time venceu!' : result.winnerTeam === 'draw' ? 'Empate!' : 'Time adversário venceu'}
              </Text>
              <Text style={styles.resultReason}>
                {result.reason === 'blocked' ? 'Jogo bloqueado — menor pontuação vence' : 'Mão fechada'}
              </Text>

              {/* Team A */}
              <View style={[styles.teamResult, { borderColor: TEAM_COLORS.team_a + '66' }]}>
                <Text style={[styles.teamResultTitle, { color: TEAM_COLORS.team_a }]}>Time A · {result.pipsByTeam.team_a} pts</Text>
                {(['p1', 'p3'] as FourPlayerId[]).map(pid => (
                  <View key={pid} style={styles.playerRow}>
                    <Text style={styles.playerRowName}>{match.players[pid].name}</Text>
                    <Text style={[styles.playerRowPips, humanWon && styles.winnerPips]}>{result.pipsByPlayer[pid]} pts</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.revealHand}>
                      {match.players[pid].hand.map(tile => (
                        <View key={tile.id} style={{ marginRight: 4 }}>
                          <DominoTileView tile={tile} size="xs" orientation="vertical" />
                        </View>
                      ))}
                      {match.players[pid].hand.length === 0 && <Text style={styles.emptyHand}>Fechou a mão</Text>}
                    </ScrollView>
                  </View>
                ))}
              </View>

              {/* Team B */}
              <View style={[styles.teamResult, { borderColor: TEAM_COLORS.team_b + '66' }]}>
                <Text style={[styles.teamResultTitle, { color: TEAM_COLORS.team_b }]}>Time B · {result.pipsByTeam.team_b} pts</Text>
                {(['p2', 'p4'] as FourPlayerId[]).map(pid => (
                  <View key={pid} style={styles.playerRow}>
                    <Text style={styles.playerRowName}>{match.players[pid].name}</Text>
                    <Text style={[styles.playerRowPips, !humanWon && result.winnerTeam !== 'draw' && styles.winnerPips]}>{result.pipsByPlayer[pid]} pts</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.revealHand}>
                      {match.players[pid].hand.map(tile => (
                        <View key={tile.id} style={{ marginRight: 4 }}>
                          <DominoTileView tile={tile} size="xs" orientation="vertical" />
                        </View>
                      ))}
                      {match.players[pid].hand.length === 0 && <Text style={styles.emptyHand}>Fechou a mão</Text>}
                    </ScrollView>
                  </View>
                ))}
              </View>

              <Pressable
                onPress={() => router.replace('/')}
                style={({ pressed }) => [styles.resultBtn, pressed && styles.resultBtnPressed]}>
                <Text style={styles.resultBtnText}>Voltar ao início</Text>
              </Pressable>
            </Animated.View>
          </ScrollView>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

// ── Board layout ──────────────────────────────────────────────────────────

type GhostPos = { left: number; top: number; width: number; height: number };

function createBoardLayout(board: PlayedTile[], _compact: boolean, viewportWidth: number, containerH: number) {
  const PAD_H = 4, PAD_V = 10;
  const S = SLOT_PX;

  const canvasW = viewportWidth - 16;
  const usableW = canvasW - PAD_H * 2;
  const cols = Math.max(4, Math.floor(usableW / S));

  // Row limit derived from the measured container height — no scrolling
  const usableH = containerH - PAD_V * 2;
  const rowLimit = Math.max(2, Math.floor(usableH / S));
  const totalRows = rowLimit; // fixed

  const slotBoard = initBoardSlots(cols, rowLimit);
  for (const tile of board) placePiece(slotBoard, tile);

  // Resolve the effective cursor.
  // If it is out-of-bounds, the NEXT placePiece call will trigger wrap +
  // enter corner mode — pre-apply that so the ghost shows the correct position.
  let { cursor, direction } = slotBoard;
  let ghostIsVertical = slotBoard.cornerPending > 0;

  if (cursor.col < 0 || cursor.col >= cols) {
    const end = slotBoard.chainEndCoord
      ?? { col: direction === 'ltr' ? cols - 1 : 0, row: cursor.row };
    direction = direction === 'ltr' ? 'rtl' : 'ltr';
    cursor = { col: end.col, row: end.row + 1 };
    ghostIsVertical = true; // next piece triggers wrap → corner mode
  }

  const canvasH = containerH; // fixed to visible area — no scrolling

  const positions = board.map((_, i) => {
    const p = slotBoard.placements[i];
    if (!p) return null;
    const px = placementToPixels(p, totalRows, PAD_H, PAD_V);
    return { left: px.left, top: px.top, swapPips: p.swapPips, orientation: p.orientation };
  });

  // Right ghost: vertical (corner mode) or horizontal (normal)
  const rightGhostPos: GhostPos = ghostIsVertical
    ? {
        left:   PAD_H + cursor.col * S,
        top:    PAD_V + (totalRows - 1 - (cursor.row + 1)) * S,
        width:  S,
        height: S * 2,
      }
    : {
        left:   PAD_H + (direction === 'ltr' ? cursor.col : cursor.col - 1) * S,
        top:    PAD_V + (totalRows - 1 - cursor.row) * S,
        width:  S * 2,
        height: S,
      };

  // Left ghost: overlaid on the first tile (chain's left end is always at the
  // serpentine start — no free space to its left, so the ghost overlays the tile).
  const firstP = slotBoard.placements[0];
  const leftGhostPos: GhostPos = firstP
    ? {
        left:   PAD_H + Math.min(firstP.slotA.col, firstP.slotB.col) * S,
        top:    PAD_V + (totalRows - 1 - Math.max(firstP.slotA.row, firstP.slotB.row)) * S,
        width:  firstP.orientation === 'vertical' ? S : S * 2,
        height: firstP.orientation === 'vertical' ? S * 2 : S,
      }
    : { left: PAD_H, top: PAD_V, width: S * 2, height: S };

  return { width: canvasW, height: canvasH, positions, leftGhostPos, rightGhostPos };
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  root: { flex: 1, paddingHorizontal: theme.spacing.sm, paddingTop: 0, paddingBottom: theme.spacing.xs },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: theme.spacing.xs, marginBottom: 4 },
  iconBtn: { width: 36, height: 36, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.outline, alignItems: 'center', justifyContent: 'center' },
  iconBtnPressed: { opacity: 0.7 },
  topCenter: { alignItems: 'center', gap: 4 },
  topTitle: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.display, fontSize: 14, letterSpacing: 0.5 },
  turnRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  turnDot: { width: 6, height: 6, borderRadius: 999 },
  turnLabel: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 11 },

  opponentsStrip: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  opponentCard: { flex: 1, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.outline, padding: 6, alignItems: 'center', gap: 2 },
  opponentCardActive: { borderColor: theme.colors.primary },
  opponentAvatarWrap: { width: 28, height: 28, borderRadius: 999, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceHigh },
  opponentEmoji: { fontSize: 14 },
  opponentName: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 },
  opponentTileCount: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.display, fontSize: 16 },
  opponentHandPeek: { flexDirection: 'row', marginTop: 2 },
  opponentTileWrap: { marginHorizontal: -6 },

  boardZone: { flex: 1, marginBottom: 6 },
  boardBox: { flex: 1, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.outline, backgroundColor: theme.colors.surfaceInset, overflow: 'hidden', paddingVertical: theme.spacing.xs },
  boardCanvas: { alignSelf: 'center', position: 'relative' },
  tileAbsolute: { position: 'absolute' },
  ghostSlot: { position: 'absolute', borderWidth: 2, borderStyle: 'dashed', borderColor: theme.colors.primary, borderRadius: theme.radius.sm, backgroundColor: theme.colors.primarySoft },
  ghostSlotPressed: { backgroundColor: 'rgba(242,202,80,0.25)', transform: [{ scale: 0.95 }] },

  handZone: { gap: theme.spacing.xs },
  handHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 },
  teamBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill, borderWidth: 1 },
  teamBadgeText: { fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 },
  handCaption: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 11 },
  hand: { minHeight: 100, paddingRight: theme.spacing.xs, alignItems: 'flex-end' },
  handCompact: { paddingHorizontal: theme.spacing.xs },
  handTileWrap: { marginRight: theme.spacing.sm },

  resultOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.72)', zIndex: 10 },
  resultScroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 24 },
  resultCard: { backgroundColor: theme.colors.surface, borderRadius: 24, borderWidth: 1, borderColor: theme.colors.outline, padding: 24, width: '100%', alignItems: 'center', gap: 10 },
  resultEmoji: { fontSize: 48 },
  resultTitle: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.display, fontSize: 24 },
  resultReason: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 12, textAlign: 'center', marginBottom: 4 },

  teamResult: { width: '100%', borderWidth: 1, borderRadius: theme.radius.md, padding: 12, gap: 8 },
  teamResultTitle: { fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 },
  playerRow: { gap: 4 },
  playerRowName: { color: theme.colors.textMuted, fontFamily: theme.typography.fontFamily.bodyBold, fontSize: 13 },
  playerRowPips: { color: theme.colors.text, fontFamily: theme.typography.fontFamily.display, fontSize: 18 },
  winnerPips: { color: theme.colors.primary },
  revealHand: { flexDirection: 'row', gap: 4 },
  emptyHand: { color: theme.colors.textFaint, fontFamily: theme.typography.fontFamily.bodyMedium, fontSize: 12, fontStyle: 'italic' },

  resultBtn: { marginTop: 8, backgroundColor: theme.colors.primary, borderRadius: 999, paddingVertical: 13, paddingHorizontal: 32, width: '100%', alignItems: 'center' },
  resultBtnPressed: { transform: [{ scale: 0.97 }] },
  resultBtnText: { color: theme.colors.background, fontFamily: theme.typography.fontFamily.display, fontSize: 15 },
});
