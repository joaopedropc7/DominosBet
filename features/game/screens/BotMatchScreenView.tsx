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
import type { DominoMatchState, PlacementSide } from '@/game-engine/types';
import { useResponsive } from '@/hooks/useResponsive';
import { theme } from '@/theme';
import { computeLinearLayout } from '@/game-engine/board-slots';
import { DominoTileView } from '../components/DominoTileView';

export function BotMatchScreenView() {
  const [match, setMatch] = useState<DominoMatchState>(() => createBotMatch());
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const { isCompact, width } = useResponsive();
  const { height: screenH } = useWindowDimensions();
  // boardBoxH is measured via onLayout; use screen-based estimate until first layout fires
  const [boardBoxH, setBoardBoxH] = useState(() => Math.max(180, screenH * 0.42));
  const boardLayout = useMemo(
    () => computeLinearLayout(match.board, boardBoxH, width),
    [match.board, boardBoxH, width],
  );

  const boardScrollRef = useRef<ScrollView>(null);
  const hasScrolledRef = useRef(false);

  // Scroll to center the anchor tile when the first tile is placed
  useEffect(() => {
    if (match.board.length === 1 && !hasScrolledRef.current && boardScrollRef.current) {
      hasScrolledRef.current = true;
      boardScrollRef.current.scrollTo({ x: boardLayout.anchorScrollX, animated: false });
    }
    if (match.board.length === 0) hasScrolledRef.current = false;
  }, [match.board.length, boardLayout.anchorScrollX]);

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
    hasScrolledRef.current = false;
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
            <ScrollView
              ref={boardScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              contentContainerStyle={{ width: boardLayout.canvasWidth, height: boardLayout.canvasHeight }}
            >
              {/* Tiles — stable positions from computeLinearLayout */}
              {match.board.map((tile) => {
                const pos = boardLayout.tilePositions.find((p) => p.tileId === tile.id);
                if (!pos) return null;
                return (
                  <View
                    key={tile.id}
                    style={[styles.boardTileAbsolute, { left: pos.left, top: pos.top }]}>
                    <DominoTileView
                      tile={pos.swapPips ? { ...tile, left: tile.right, right: tile.left } : tile}
                      size="xs"
                      orientation={pos.orientation}
                    />
                  </View>
                );
              })}

              {/* Ghost drop zones */}
              {availableSides.includes('left') && boardLayout.leftGhost && (
                <Pressable
                  onPress={() => selectedTile && performHumanPlay(selectedTile.id, 'left')}
                  style={({ pressed }) => [
                    styles.ghostSlot,
                    {
                      left: boardLayout.leftGhost!.left,
                      top: boardLayout.leftGhost!.top,
                      width: boardLayout.leftGhost!.width,
                      height: boardLayout.leftGhost!.height,
                    },
                    pressed && styles.ghostSlotPressed,
                  ]}
                />
              )}
              {availableSides.includes('right') && boardLayout.rightGhost && (
                <Pressable
                  onPress={() => selectedTile && performHumanPlay(selectedTile.id, 'right')}
                  style={({ pressed }) => [
                    styles.ghostSlot,
                    {
                      left: boardLayout.rightGhost!.left,
                      top: boardLayout.rightGhost!.top,
                      width: boardLayout.rightGhost!.width,
                      height: boardLayout.rightGhost!.height,
                    },
                    pressed && styles.ghostSlotPressed,
                  ]}
                />
              )}
            </ScrollView>
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
