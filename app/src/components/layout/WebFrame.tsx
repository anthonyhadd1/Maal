import { createContext, useContext, type PropsWithChildren } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { colors, fonts, radii } from '@/theme/tokens';

const FRAME_WIDTH = 408;
const FRAME_PADDING = 10;
const FRAME_MAX_HEIGHT = 866;
const BREAKPOINT = 560; // en dessous (vrai mobile), plein écran sans cadre

/** Largeur de contenu réelle à l'intérieur du cadre (hors padding du "boîtier"). */
const FRAME_CONTENT_WIDTH = FRAME_WIDTH - FRAME_PADDING * 2;

/**
 * Largeur d'écran EFFECTIVE pour tout calcul de mise en page (position des
 * nœuds de la carte, etc.). `useWindowDimensions()` renvoie la largeur RÉELLE
 * du navigateur — sur un grand écran, WebFrame limite visuellement le rendu à
 * un cadre de téléphone bien plus étroit, donc tout composant qui calcule des
 * positions absolues à partir de `useWindowDimensions().width` place son
 * contenu comme si l'écran faisait 1500px de large, alors qu'il n'est visible
 * que sur ~388px : c'est INVISIBLE, hors du cadre (bug vécu — les nœuds de la
 * carte des niveaux existaient dans le DOM à des centaines de pixels à droite
 * du cadre visible). Tout composant qui a besoin de la largeur pour POSITIONNER
 * des éléments doit utiliser `useEffectiveScreenWidth()`, pas
 * `useWindowDimensions()` directement.
 */
const ScreenWidthContext = createContext<number | null>(null);

export function useEffectiveScreenWidth(): number {
  const framed = useContext(ScreenWidthContext);
  const { width } = useWindowDimensions();
  return framed ?? width;
}

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
          <View style={styles.screen}>
            <ScreenWidthContext.Provider value={FRAME_CONTENT_WIDTH}>
              {children}
            </ScreenWidthContext.Provider>
          </View>
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
    padding: FRAME_PADDING,
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
