import { render, screen } from '@testing-library/react-native';

import { containsMath, MathText } from '@/components/content/MathText';

// react-native-webview is mocked globally (src/test/setup.ts) as a plain View
// with testID "webview-mock".

describe('containsMath', () => {
  test('detects inline and block delimiters', () => {
    expect(containsMath('La masse de $\\ce{H2SO4}$ vaut…')).toBe(true);
    expect(containsMath('$$x^2 + 1$$')).toBe(true);
    expect(containsMath('98 g/mol')).toBe(false);
    expect(containsMath('')).toBe(false);
  });
});

describe('MathText routing (PLAN decision 5)', () => {
  test('plain text -> fast <Text> path, no WebView mounted', async () => {
    await render(<MathText text="La photosynthèse produit du dioxygène." />);

    expect(screen.getByText('La photosynthèse produit du dioxygène.')).toBeTruthy();
    expect(screen.queryByTestId('math-text-webview')).toBeNull();
    expect(screen.queryByTestId('webview-mock')).toBeNull();
  });

  test('text containing $…$ -> KaTeX WebView path, no raw <Text>', async () => {
    const formula = 'Calcule $M = 2(1) + 32 + 4(16)$ en g/mol.';
    await render(<MathText text={formula} />);

    expect(screen.getByTestId('math-text-webview')).toBeTruthy();
    expect(screen.getByTestId('webview-mock')).toBeTruthy();
    expect(screen.queryByText(formula)).toBeNull();
  });

  test('mhchem chemistry markup routes through the WebView too', async () => {
    await render(<MathText text="Équilibre $\ce{2H2 + O2 -> 2H2O}$" />);
    expect(screen.getByTestId('math-text-webview')).toBeTruthy();
  });

  test('numberOfLines applies on the plain path', async () => {
    await render(<MathText numberOfLines={2} text="Texte simple sans formule." />);
    expect(screen.getByText('Texte simple sans formule.').props.numberOfLines).toBe(2);
  });
});
