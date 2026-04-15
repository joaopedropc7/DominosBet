import { useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  chooseBotMove,
  createBotMatch,
  getLegalMoves,
  passTurn,
  playMove,
} from '@/game-engine';
import type { DominoMatchState, PlacementSide, PlayedTile } from '@/game-engine/types';
import { useResponsive } from '@/hooks/useResponsive';
import { theme } from '@/theme';
import { SLOT_PX, initBoardSlots, placePiece, placementToPixels } from '@/game-engine/board-slots';
import { DominoTileView } from '../components/DominoTileView';

export function BotMatchScreenView() {
  const [match, setMatch] = useState<DominoMatchState>(() => createBotMatch());
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const { isCompact, width } = useResponsive();
  const { height: screenH } = useWindowDimensions();
  // boardBoxH is measured via onLayout; use screen-based estimate until first layout fires
  const [boardBoxH, setBoardBoxH] = useState(() => Math.max(180, screenH * 0.42));
  const boardLayout = useMemo(
    () => createBoardLayout(match.board, false, width, boardBoxH),
    [match.board, width, boardBoxH],
  );

  // Result overlay animation
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const overlayScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (match.status !== 'finished') return;
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(overlayScale, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }),
    ]).start();
  }, [match.status]);

  const humanMoves = useMemo(() => getLegalMoves(match, 'human'), [match]);
  const selectedTile = match.players.human.hand.find((tile) => tile.id === selectedTileId) ?? null;
  const availableSides = useMemo(
    () => [...new Set(humanMoves.filter((move) => move.tileId === selectedTileId).map((move) => move.side))],
    [humanMoves, selectedTileId],
  );

  useEffect(() => {
    if (match.status !== 'playing' || match.currentPlayer !== 'bot') return;

    const timeout = setTimeout(() => {
      setMatch((current) => runBotTurn(current));
    }, 800);

    return () => clearTimeout(timeout);
  }, [match.currentPlayer, match.status]);

  useEffect(() => {
    if (selectedTileId && !match.players.human.hand.some((tile) => tile.id === selectedTileId)) {
      setSelectedTileId(null);
    }
  }, [match.players.human.hand, selectedTileId]);

  useEffect(() => {
    if (match.status !== 'playing' || match.currentPlayer !== 'human') return;
    if (humanMoves.length > 0) return;

    const timeout = setTimeout(() => {
      setMatch((current) => passTurn(current, 'human', 'Você passou a vez.'));
    }, 700);

    return () => clearTimeout(timeout);
  }, [humanMoves.length, match.currentPlayer, match.status]);

  function handleTilePress(tileId: string) {
    if (match.currentPlayer !== 'human' || match.status !== 'playing') return;

    const tileMoves = humanMoves.filter((move) => move.tileId === tileId);
    if (!tileMoves.length) return;

    setSelectedTileId((current) => (current === tileId ? null : tileId));
  }

  function performHumanPlay(tileId: string, side: PlacementSide) {
    setMatch((current) => playMove(current, 'human', tileId, side));
    setSelectedTileId(null);
  }

  function handleRestart() {
    overlayOpacity.setValue(0);
    overlayScale.setValue(0.8);
    setSelectedTileId(null);
    setMatch(createBotMatch());
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.root}>

        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}>
            <MaterialCommunityIcons name="arrow-left" size={20} color={theme.colors.textMuted} />
          </Pressable>
          <View style={styles.topCenter}>
            <Text style={styles.topTitle}>1v1 · Bot Noir</Text>
            <View style={styles.turnIndicator}>
              <View style={[styles.turnDot, match.currentPlayer === 'human' && styles.turnDotActive]} />
              <Text style={styles.turnLabel}>
                {match.status === 'playing'
                  ? match.currentPlayer === 'human' ? 'Sua vez' : 'Vez do bot'
                  : 'Partida encerrada'}
              </Text>
            </View>
          </View>
          <Pressable onPress={handleRestart} style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}>
            <MaterialCommunityIcons name="restart" size={20} color={theme.colors.textMuted} />
          </Pressable>
        </View>

        {/* Opponent zone */}
        <View style={styles.opponentZone}>
          <View style={styles.opponentAvatar}>
            <Text style={styles.opponentAvatarText}>🤖</Text>
          </View>
          <View style={styles.opponentInfo}>
            <Text style={styles.opponentName}>Bot Noir</Text>
            <View style={styles.opponentCountBadge}>
              <MaterialCommunityIcons name="cards" size={11} color={theme.colors.textFaint} />
              <Text style={styles.opponentCountValue}>{match.players.bot.hand.length} peças</Text>
            </View>
          </View>
          <View style={styles.opponentHand}>
            {match.players.bot.hand.slice(0, Math.min(match.players.bot.hand.length, 7)).map((tile, index) => (
              <View key={`${tile.id}-${index}`} style={styles.opponentTileWrap}>
                <DominoTileView tile={tile} hidden size="xs" />
              </View>
            ))}
          </View>
        </View>

        {/* Board */}
        <View style={styles.boardZone}>
          <View
            style={styles.boardBox}
            onLayout={(e) => setBoardBoxH(e.nativeEvent.layout.height)}>
            <View style={[styles.boardCanvas, { width: boardLayout.width, height: boardLayout.height }]}>

              {/* Real tiles */}
              {match.board.map((tile, index) => {
                const layout = boardLayout.positions[index];
                if (!layout) return null;
                return (
                  <View
                    key={tile.id}
                    style={[
                      styles.boardTileAbsolute,
                      { left: layout.left, top: layout.top },
                    ]}>
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
                  onPress={() => selectedTile && performHumanPlay(selectedTile.id, 'left')}
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
              {availableSides.includes('right') && (
                <Pressable
                  onPress={() => selectedTile && performHumanPlay(selectedTile.id, 'right')}
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
          </View>
        </View>

        {/* Footer / player hand */}
        <View style={styles.footerZone}>
          <View style={styles.footerHeader}>
            <Text style={styles.footerLabel}>Você</Text>
            <Text style={styles.footerCaption}>
              {match.currentPlayer === 'human' && match.status === 'playing'
                ? selectedTile
                  ? 'Toque em uma ponta dourada da mesa.'
                  : humanMoves.length === 0
                    ? 'Sem jogadas. Passando vez…'
                    : 'Selecione uma peça.'
                : match.status === 'playing'
                  ? 'Aguarde o bot…'
                  : ''}
            </Text>
          </View>

          <ScrollView
            horizontal
            bounces={false}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.playerHand, isCompact && styles.playerHandCompact]}>
            {match.players.human.hand.map((tile) => {
              const isPlayable = humanMoves.some((move) => move.tileId === tile.id);
              return (
                <View key={tile.id} style={styles.playerTileWrap}>
                  <DominoTileView
                    tile={tile}
                    size="sm"
                    selected={selectedTileId === tile.id}
                    playable={isPlayable && match.currentPlayer === 'human' && match.status === 'playing'}
                    dimmed={!isPlayable && match.currentPlayer === 'human' && match.status === 'playing'}
                    onPress={() => handleTilePress(tile.id)}
                  />
                </View>
              );
            })}
          </ScrollView>
        </View>

      </View>

      {/* Result overlay */}
      {match.status === 'finished' && match.result && (
        <Animated.View style={[styles.resultOverlay, { opacity: overlayOpacity }]}>
          <ScrollView
            contentContainerStyle={styles.resultScroll}
            showsVerticalScrollIndicator={false}
            bounces={false}>
            <Animated.View style={[styles.resultCard, { transform: [{ scale: overlayScale }] }]}>

              {/* Header */}
              {match.result.winner === 'human' ? (
                <>
                  <Text style={styles.resultEmoji}>🏆</Text>
                  <Text style={styles.resultTitle}>Você venceu!</Text>
                </>
              ) : match.result.winner === 'bot' ? (
                <>
                  <Text style={styles.resultEmoji}>💀</Text>
                  <Text style={styles.resultTitle}>Bot venceu</Text>
                </>
              ) : (
                <>
                  <Text style={styles.resultEmoji}>🤝</Text>
                  <Text style={styles.resultTitle}>Empate</Text>
                </>
              )}
              <Text style={styles.resultReason}>
                {match.result.reason === 'blocked' ? 'Jogo bloqueado — menor pontuação vence' : 'Fechou a mão'}
              </Text>

              {/* Hands reveal — Bot */}
              <View style={styles.resultHandSection}>
                <View style={styles.resultHandHeader}>
                  <Text style={styles.resultHandLabel}>Bot Noir</Text>
                  <Text style={[styles.resultHandPips, match.result.winner === 'bot' && styles.resultPipWinner]}>
                    {match.result.botPips} pts
                  </Text>
                </View>
                {match.players.bot.hand.length === 0 ? (
                  <Text style={styles.resultHandEmpty}>Sem peças — fechou a mão</Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.resultHandTiles}>
                    {match.players.bot.hand.map((tile) => (
                      <View key={tile.id} style={styles.resultTileWrap}>
                        <DominoTileView tile={tile} size="xs" orientation="vertical" />
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>

              {/* Hands reveal — Human */}
              <View style={styles.resultHandSection}>
                <View style={styles.resultHandHeader}>
                  <Text style={styles.resultHandLabel}>Você</Text>
                  <Text style={[styles.resultHandPips, match.result.winner === 'human' && styles.resultPipWinner]}>
                    {match.result.humanPips} pts
                  </Text>
                </View>
                {match.players.human.hand.length === 0 ? (
                  <Text style={styles.resultHandEmpty}>Sem peças — fechou a mão</Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.resultHandTiles}>
                    {match.players.human.hand.map((tile) => (
                      <View key={tile.id} style={styles.resultTileWrap}>
                        <DominoTileView tile={tile} size="xs" orientation="vertical" />
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>

              {/* Action */}
              <Pressable
                onPress={() => router.replace('/')}
                style={({ pressed }) => [styles.resultButton, pressed && styles.resultButtonPressed]}>
                <Text style={styles.resultButtonText}>Voltar ao início</Text>
              </Pressable>

            </Animated.View>
          </ScrollView>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}


function runBotTurn(state: DominoMatchState) {
  if (state.status !== 'playing' || state.currentPlayer !== 'bot') return state;

  const move = chooseBotMove(state);
  if (move) {
    return playMove(state, 'bot', move.tileId, move.side);
  }

  return passTurn(state, 'bot');
}

type GhostPos = { left: number; top: number; width: number; height: number };

function createBoardLayout(board: PlayedTile[], _compact: boolean, viewportWidth: number, containerH: number) {
  // ── SLOT-BASED SERPENTINE ─────────────────────────────────────────────────
  // Each slot is SLOT_PX × SLOT_PX px (28 × 28).
  // Normal piece (left≠right): 2 horizontal slots → 56 × 28 px landscape.
  // Double piece (left=right):  2 vertical   slots → 28 × 56 px portrait.
  // Even rows → LTR; odd rows → RTL.
  // RTL tiles have swapPips=true so tile.right appears at visual-left.
  // The board is fixed to the visible containerH — no scrolling.
  // ─────────────────────────────────────────────────────────────────────────

  const PAD_H = 4, PAD_V = 10;
  const S = SLOT_PX; // 28 px per slot

  const canvasW = viewportWidth - 16;
  const usableW = canvasW - PAD_H * 2;
  const cols = Math.max(4, Math.floor(usableW / S));

  // Row limit derived from the measured container height
  const usableH = containerH - PAD_V * 2;
  const rowLimit = Math.max(2, Math.floor(usableH / S));
  // totalRows is fixed — canvas height never grows beyond visible area
  const totalRows = rowLimit;

  const startCol = Math.floor((cols - 2) / 2);
  const startRow = Math.floor(rowLimit / 2);
  const slotBoard = initBoardSlots(cols, rowLimit, { col: startCol, row: startRow });
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
        // Vertical ghost: 1 slot wide, 2 slots tall, top is the upper slot
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

  // Left ghost: overlaid on the first tile (the chain's left end is always at
  // the start of the serpentine — there is no free space to its left, so we
  // show the ghost as a tappable overlay on top of the first tile itself).
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  root: {
    flex: 1,
    paddingHorizontal: theme.spacing.sm,
    paddingTop: 0,
    paddingBottom: theme.spacing.xs,
  },

  // ── Top bar ──────────────────────────────────────────────
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
  iconButtonPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.8,
  },
  topCenter: {
    alignItems: 'center',
    gap: 4,
  },
  topTitle: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 14,
    letterSpacing: 0.5,
  },
  turnIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  turnDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceHighest,
  },
  turnDotActive: {
    backgroundColor: theme.colors.accent,
  },
  turnLabel: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.4,
  },

  // ── Opponent ─────────────────────────────────────────────
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
  opponentAvatarText: {
    fontSize: 16,
  },
  opponentInfo: {
    gap: 2,
  },
  opponentName: {
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.bodyBold,
    fontSize: 13,
  },
  opponentCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  opponentCountValue: {
    color: theme.colors.textFaint,
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 11,
  },
  opponentHand: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  opponentTileWrap: {
    marginHorizontal: -8,
  },

  // ── Board ─────────────────────────────────────────────────
  boardZone: {
    flex: 1,
    paddingBottom: theme.spacing.xs,
  },
  boardBox: {
    flex: 1,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    backgroundColor: theme.colors.surfaceInset,
    overflow: 'hidden',
    paddingVertical: theme.spacing.xs,
  },
  boardCanvas: {
    alignSelf: 'center',
    position: 'relative',
  },
  boardTileAbsolute: {
    position: 'absolute',
  },
  ghostSlot: {
    position: 'absolute',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primarySoft,
  },
  ghostSlotPressed: {
    backgroundColor: 'rgba(242,202,80,0.25)',
    transform: [{ scale: 0.95 }],
  },

  // ── Footer / hand ─────────────────────────────────────────
  footerZone: {
    gap: theme.spacing.xs,
    paddingBottom: 0,
  },
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
  playerHand: {
    minHeight: 110,
    paddingRight: theme.spacing.xs,
    alignItems: 'flex-end',
  },
  playerHandCompact: {
    paddingHorizontal: theme.spacing.xs,
  },
  playerTileWrap: {
    marginRight: theme.spacing.sm,
  },
  resultScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  resultHandSection: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  resultHandHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
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
  resultHandEmpty: {
    color: 'rgba(255,255,255,0.4)',
    fontFamily: theme.typography.fontFamily.bodyMedium,
    fontSize: 12,
    fontStyle: 'italic',
  },
  resultHandTiles: {
    flexDirection: 'row',
    gap: 6,
    paddingBottom: 2,
  },
  resultTileWrap: {
    // just spacing context for tiles
  },
  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
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
  resultEmoji: {
    fontSize: 52,
  },
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
  resultPipWinner: {
    color: '#F2CA50',
  },
  resultButton: {
    marginTop: 8,
    backgroundColor: '#F2CA50',
    borderRadius: 999,
    paddingVertical: 13,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  resultButtonPressed: {
    transform: [{ scale: 0.97 }],
  },
  resultButtonText: {
    color: '#131313',
    fontFamily: theme.typography.fontFamily.display,
    fontSize: 15,
  },
});
