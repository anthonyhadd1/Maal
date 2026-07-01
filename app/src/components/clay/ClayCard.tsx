import type { PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';

import { ClaySurface, type ClaySurfaceProps } from '@/components/clay/ClaySurface';
import { spacing } from '@/theme/tokens';

/** Padded clay card — the default content container. */
export function ClayCard({
  children,
  radius = 'l',
  style,
  ...rest
}: PropsWithChildren<ClaySurfaceProps>) {
  return (
    <ClaySurface radius={radius} style={[styles.card, style]} {...rest}>
      {children}
    </ClaySurface>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.l,
  },
});
