import { StyleSheet, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { colors, fonts } from '@/theme/tokens';

/**
 * Web (DEMO-ONLY) build of MathText — see MathText.tsx for the native version.
 *
 * react-native-webview has no web implementation, so the KaTeX-in-WebView math
 * path cannot render in the browser. The demo shows the raw formula source
 * with the `$`/`$$` delimiters stripped and the most common wrappers
 * (`\ce{…}`, `\text{…}`) unwrapped — same spirit as the native offline
 * degradation, never a crash. Plain (math-free) strings render identically
 * to native.
 */

export const MATH_DELIMITER = '$';

export function containsMath(text: string): boolean {
  return text.includes(MATH_DELIMITER);
}

/** Lite readability pass over raw LaTeX for the browser demo. */
function stripMathMarkup(text: string): string {
  return (
    text
      // Unwrap single-argument commands whose payload reads fine as-is.
      .replace(/\\(?:ce|text|mathrm)\{([^{}]*)\}/g, '$1')
      // Drop the math delimiters themselves ($$ first, then $).
      .replace(/\$\$/g, '')
      .replace(/\$/g, '')
  );
}

export interface MathTextProps {
  text: string;
  fontSize?: number;
  lineHeight?: number;
  color?: string;
  /** Plain-path only (WebView content never truncates). */
  numberOfLines?: number;
  /** Extra style for the plain <Text> path. */
  textStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
}

export function MathText({
  text,
  fontSize = 16,
  lineHeight,
  color = colors.neutral[900],
  numberOfLines,
  textStyle,
  style,
}: MathTextProps) {
  const resolvedLineHeight = lineHeight ?? Math.round(fontSize * 1.5);
  const content = containsMath(text) ? stripMathMarkup(text) : text;

  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        styles.plain,
        { fontSize, lineHeight: resolvedLineHeight, color },
        textStyle,
        style as StyleProp<TextStyle>,
      ]}
    >
      {content}
    </Text>
  );
}

const styles = StyleSheet.create({
  plain: {
    fontFamily: fonts.body,
  },
});
