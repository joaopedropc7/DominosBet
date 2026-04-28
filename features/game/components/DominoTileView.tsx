import { Pressable, StyleSheet, View } from 'react-native';
import type { DominoTile } from '@/game-engine/types';
import { theme } from '@/theme';

type DominoOrientation = 'vertical' | 'horizontal' | 'auto';
type DominoSize = 'xs' | 'sm' | 'md' | 'lg';

interface DominoTileViewProps {
  tile: DominoTile;
  selected?: boolean;
  playable?: boolean;
  hidden?: boolean;
  orientation?: DominoOrientation;
  size?: DominoSize;
  dimmed?: boolean;
  onPress?: () => void;
}

// [row, col] grid positions (0..2 × 0..2)
const PIP_LAYOUTS: Record<number, [number, number][]> = {
  0: [],
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

// Per-size metrics that scale pips and padding proportionally
const SIZE_METRICS: Record<DominoSize, { pip: number; pad: number; dividerGap: number }> = {
  xs: { pip: 4,  pad: 3,  dividerGap: 3 },
  sm: { pip: 6,  pad: 5,  dividerGap: 5 },
  md: { pip: 9,  pad: 8,  dividerGap: 8 },
  lg: { pip: 11, pad: 10, dividerGap: 10 },
};

export function DominoTileView({
  tile,
  selected = false,
  playable = false,
  hidden = false,
  orientation = 'vertical',
  size = 'md',
  dimmed = false,
  onPress,
}: DominoTileViewProps) {
  const resolvedOrientation =
    orientation === 'auto'
      ? tile.left === tile.right ? 'vertical' : 'horizontal'
      : orientation;
  const isHorizontal = resolvedOrientation === 'horizontal';
  const sizeStyle = getSizeStyle(size, isHorizontal);
  const metrics = SIZE_METRICS[size];

  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.shell, pressed && onPress && styles.pressed]}>
      <View
        style={[
          styles.base,
          sizeStyle,
          isHorizontal ? styles.horizontal : styles.vertical,
          hidden && styles.hiddenTile,
          playable && styles.playable,
          selected && styles.selected,
          dimmed && styles.dimmed,
        ]}>
        <Half value={tile.left} hidden={hidden} isHorizontal={isHorizontal} metrics={metrics} />
        <View
          style={[
            styles.divider,
            isHorizontal
              ? [styles.dividerVertical,   { marginVertical: metrics.dividerGap }]
              : [styles.dividerHorizontal, { marginHorizontal: metrics.dividerGap }],
          ]}
        />
        <Half value={tile.right} hidden={hidden} isHorizontal={isHorizontal} metrics={metrics} />
      </View>
    </Pressable>
  );
}

function Half({
  value,
  hidden,
  isHorizontal,
  metrics,
}: {
  value: number;
  hidden: boolean;
  isHorizontal: boolean;
  metrics: { pip: number; pad: number };
}) {
  return (
    <View
      style={[
        styles.half,
        { padding: metrics.pad },
        isHorizontal && styles.halfHorizontal,
      ]}>
      {hidden ? (
        <View style={styles.hiddenCore} />
      ) : (
        // 3×3 flexbox grid — works reliably on Android/iOS unlike
        // position:absolute + percentage top/left inside flex:1 containers
        <View style={styles.pipGrid}>
          {([0, 1, 2] as const).map((row) => (
            <View key={row} style={styles.pipRow}>
              {([0, 1, 2] as const).map((col) => {
                const hasPip = PIP_LAYOUTS[value].some(([r, c]) => r === row && c === col);
                return (
                  <View key={col} style={styles.pipCell}>
                    {hasPip && (
                      <View
                        style={[
                          styles.pip,
                          {
                            width: metrics.pip,
                            height: metrics.pip,
                            borderRadius: metrics.pip / 2,
                          },
                        ]}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function getSizeStyle(size: DominoSize, isHorizontal: boolean) {
  if (size === 'xs') return isHorizontal ? styles.xsmallHorizontal : styles.xsmallVertical;
  if (size === 'sm') return isHorizontal ? styles.smallHorizontal  : styles.smallVertical;
  if (size === 'lg') return isHorizontal ? styles.largeHorizontal  : styles.largeVertical;
  return isHorizontal ? styles.mediumHorizontal : styles.mediumVertical;
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 5,
  },
  pressed: {
    transform: [{ translateY: -2 }],
  },
  base: {
    backgroundColor: '#F4F0DE',
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#1A1A1A',
    overflow: 'hidden',
  },
  vertical: {
    flexDirection: 'column',
  },
  horizontal: {
    flexDirection: 'row',
  },

  // ── Sizes ──────────────────────────────────────────────────
  xsmallVertical:   { width: 28,  height: 56  },
  xsmallHorizontal: { width: 56,  height: 28  },
  smallVertical:    { width: 44,  height: 88  },
  smallHorizontal:  { width: 88,  height: 44  },
  mediumVertical:   { width: 64,  height: 128 },
  mediumHorizontal: { width: 128, height: 64  },
  largeVertical:    { width: 80,  height: 160 },
  largeHorizontal:  { width: 160, height: 80  },

  // ── States ─────────────────────────────────────────────────
  playable: {
    borderColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  selected: {
    transform: [{ translateY: -8 }],
  },
  dimmed: {
    opacity: 0.4,
  },
  hiddenTile: {
    backgroundColor: '#E8E4D0',
    borderColor: 'rgba(0,0,0,0.15)',
  },

  // ── Layout internals ───────────────────────────────────────
  half: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  halfHorizontal: {},
  divider: {
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  dividerHorizontal: {
    height: 1,
  },
  dividerVertical: {
    width: 1,
  },
  pipGrid: {
    flex: 1,
    alignSelf: 'stretch',
    flexDirection: 'column',
  },
  pipRow: {
    flex: 1,
    flexDirection: 'row',
  },
  pipCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pip: {
    backgroundColor: '#111111',
  },
  hiddenCore: {
    width: '60%',
    height: '60%',
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
});
