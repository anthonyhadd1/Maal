import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { colors, fonts } from '@/theme/tokens';

/**
 * Formula-aware text (PLAN reconciled decision 5).
 *
 * FAST PATH (the vast majority of questions): no `$` in the string -> a plain
 * <Text>. Zero WebView cost.
 *
 * MATH PATH: `$...$` / `$$...$$` (incl. mhchem `$\ce{...}$`) -> KaTeX inside a
 * react-native-webview, auto-sized via postMessage.
 *
 * TRADEOFF (documented per plan): KaTeX is loaded from the jsDelivr CDN.
 * Offline, the scripts fail to load and the WebView gracefully degrades to
 * the raw text (the source text is in the DOM before render). Vendoring the
 * KaTeX build into the app bundle is the follow-up swap — it only touches
 * this file (replace the CDN <link>/<script> tags with inlined assets).
 */

export const MATH_DELIMITER = '$';

export function containsMath(text: string): boolean {
  return text.includes(MATH_DELIMITER);
}

const KATEX_VERSION = '0.16.21';
const KATEX_BASE = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist`;

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHtml(text: string, fontSize: number, color: string, lineHeight: number): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<link rel="stylesheet" href="${KATEX_BASE}/katex.min.css" />
<script src="${KATEX_BASE}/katex.min.js"></script>
<script src="${KATEX_BASE}/contrib/mhchem.min.js"></script>
<script src="${KATEX_BASE}/contrib/auto-render.min.js"></script>
<style>
  html, body { margin: 0; padding: 0; background: transparent; }
  body {
    color: ${color};
    font-family: -apple-system, Roboto, 'Segoe UI', sans-serif;
    font-size: ${fontSize}px;
    line-height: ${lineHeight}px;
    overflow-wrap: break-word;
  }
  .katex { font-size: 1.06em; }
</style>
</head>
<body><div id="content">${escapeHtml(text)}</div>
<script>
  function postHeight() {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(String(document.body.scrollHeight || document.documentElement.scrollHeight));
    }
  }
  window.addEventListener('load', function () {
    try {
      if (window.renderMathInElement) {
        window.renderMathInElement(document.getElementById('content'), {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false }
          ],
          throwOnError: false
        });
      }
    } catch (e) { /* offline / CDN failure: raw text stays visible */ }
    postHeight();
    setTimeout(postHeight, 250);
    setTimeout(postHeight, 900);
  });
</script>
</body>
</html>`;
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

/**
 * Shared formula-aware text. Used by question stems, answer options and
 * explanations — swap the rendering engine here, nowhere else.
 */
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
  const [webViewHeight, setWebViewHeight] = useState(resolvedLineHeight);
  const hasMath = containsMath(text);

  const html = useMemo(
    () => (hasMath ? buildHtml(text, fontSize, color, resolvedLineHeight) : ''),
    [hasMath, text, fontSize, color, resolvedLineHeight],
  );

  if (!hasMath) {
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
        {text}
      </Text>
    );
  }

  const onMessage = (event: WebViewMessageEvent) => {
    const next = Number(event.nativeEvent.data);
    if (Number.isFinite(next) && next > 0 && Math.abs(next - webViewHeight) > 2) {
      setWebViewHeight(next);
    }
  };

  return (
    <View style={[{ height: webViewHeight }, style]} testID="math-text-webview">
      <WebView
        androidLayerType="software"
        containerStyle={styles.transparent}
        javaScriptEnabled
        onMessage={onMessage}
        originWhitelist={['*']}
        scrollEnabled={false}
        setSupportMultipleWindows={false}
        showsVerticalScrollIndicator={false}
        source={{ html }}
        style={[styles.transparent, { height: webViewHeight }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  plain: {
    fontFamily: fonts.body,
  },
  transparent: {
    backgroundColor: 'transparent',
  },
});
