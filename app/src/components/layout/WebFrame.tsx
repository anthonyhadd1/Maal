import type { PropsWithChildren } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { colors, fonts, radii } from '@/theme/tokens';

const FRAME_WIDTH = 408;
const FRAME_MAX_HEIGHT = 866;
const BREAKPOINT = 560; // en dessous (vrai mobile), plein écran sans cadre

/**
 * Démo web uniquement : sur un grand écran, l'app s'affiche dans un « téléphone »
 * centré sur un fond de marque au lieu de s'étirer sur toute la fenêtre.
 * Sur natif (et sur un petit écran web), rendu passthrough intégral.
 */
export function WebFrame({ children }: PropsWithChildren) {
  const { width, height } = useWindowDimensions();

  if (Platform.OS !== 'web' || width < BREAKPOINT) {
    return <>{children}</>;
  }

  const frameHeight = Math.min(FRAME_MAX_HEIGHT, height - 56);

  return (
    <View style={styles.backdrop}>
      <View style={[styles.blob, styles.blobTop]} />
      <View style={[styles.blob, styles.blobBottom]} />
      <View style={styles.stage}>
        <View style={[styles.frame, { height: frameHeight }]}>
          <View style={styles.screen}>{children}</View>
        </View>
        <Text style={styles.caption}>Aperçu web — l'app est conçue pour mobile</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.primary[700],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.35,
  },
  blobTop: {
    width: 640,
    height: 640,
    top: -220,
    left: -160,
    backgroundColor: colors.primary[500],
  },
  blobBottom: {
    width: 720,
    height: 720,
    bottom: -300,
    right: -200,
    backgroundColor: colors.primary[600],
  },
  stage: {
    alignItems: 'center',
  },
  frame: {
    width: FRAME_WIDTH,
    borderRadius: radii.xl + 12,
    padding: 10,
    backgroundColor: colors.neutral[900],
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 60,
    shadowOffset: { width: 0, height: 30 },
  },
  screen: {
    flex: 1,
    borderRadius: radii.xl + 2,
    overflow: 'hidden',
    backgroundColor: colors.neutral[50],
  },
  caption: {
    marginTop: 14,
    color: colors.primary[300],
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
});
