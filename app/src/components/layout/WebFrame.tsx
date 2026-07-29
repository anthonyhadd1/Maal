import { createContext, useContext, type PropsWithChildren } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { InkBackdrop } from '@/components/layout/InkBackdrop';
import { withAlpha } from '@/lib/color';
import { colors, fonts, radii, spacing } from '@/theme/tokens';

const FRAME_WIDTH = 408;
const FRAME_PADDING = spacing.m;
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
 * Même principe que la largeur, pour la HAUTEUR : dans le cadre,
 * `useWindowDimensions().height` renvoie la hauteur du NAVIGATEUR alors que
 * l'écran rendu ne mesure que `min(866, h − 56) − padding` — environ 80px de
 * MOINS. Tout écran qui dégrade sa mise en page selon la hauteur (ex.
 * welcome et son mode « court ») doit lire cette valeur, sinon il choisit la
 * variante haute alors que le cadre n'a la place que pour la courte, et le
 * bas (CTA) est rogné par l'`overflow: hidden` du cadre.
 */
const ScreenHeightContext = createContext<number | null>(null);

export function useEffectiveScreenHeight(): number {
  const framed = useContext(ScreenHeightContext);
  const { height } = useWindowDimensions();
  return framed ?? height;
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
      <InkBackdrop glowOpacity={0.18} glowSize={720} glowTop="-12%" />
      <View style={styles.stage}>
        <View style={[styles.frame, { height: frameHeight }]}>
          <View style={styles.screen}>
            <ScreenWidthContext.Provider value={FRAME_CONTENT_WIDTH}>
              <ScreenHeightContext.Provider value={frameHeight - FRAME_PADDING * 2}>
                {children}
              </ScreenHeightContext.Provider>
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
    // Même langage « encre » que welcome/login (InkBackdrop) — la démo web
    // lit alors comme une maquette d'appareil sur fond studio, pas comme une
    // page violette à part.
    flex: 1,
    backgroundColor: colors.inkBottom,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  stage: {
    alignItems: 'center',
  },
  frame: {
    width: FRAME_WIDTH,
    borderRadius: radii.xl + 12,
    padding: FRAME_PADDING,
    backgroundColor: colors.neutral[900],
    // Fin liseré clair pour détacher le boîtier du fond encre (les deux sont
    // quasi noirs) + ombre portée douce.
    borderWidth: 1,
    borderColor: withAlpha(colors.neutral[0], 0.1),
    shadowColor: '#000000',
    shadowOpacity: 0.6,
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
    marginTop: spacing.m,
    color: withAlpha(colors.neutral[0], 0.45),
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
});
