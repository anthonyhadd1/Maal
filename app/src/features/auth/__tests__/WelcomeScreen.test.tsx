import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { WelcomeScreen } from '@/features/auth/WelcomeScreen';
import '@/i18n';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn(), dismissTo: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <WelcomeScreen />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockRouter.push.mockClear();
});

describe('WelcomeScreen — "le départ" ink landing', () => {
  test('renders the two-line headline and the support line', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Ton concours devient')).toBeTruthy();
    expect(getByText('un jeu.')).toBeTruthy();
    expect(
      getByText(
        'Les vraies annales du concours USJ, à jouer niveau par niveau : XP, séries, ligues, défis entre amis.',
      ),
    ).toBeTruthy();
  });

  test('the vignette is decorative — hidden from the accessibility tree', async () => {
    const { getByTestId, queryByTestId } = await renderScreen();

    // Hidden by default (aria-hidden + no-hide-descendants)…
    expect(queryByTestId('welcome-vignette')).toBeNull();
    // …but genuinely rendered: reachable only with includeHiddenElements.
    expect(getByTestId('welcome-vignette', { includeHiddenElements: true })).toBeTruthy();
  });

  test('Commencer routes to /register', async () => {
    const { getByTestId } = await renderScreen();

    fireEvent.press(getByTestId('welcome-start'));

    expect(mockRouter.push).toHaveBeenCalledWith('/register');
  });

  test('the sign-in row routes to /login', async () => {
    const { getByTestId } = await renderScreen();

    fireEvent.press(getByTestId('welcome-login'));

    expect(mockRouter.push).toHaveBeenCalledWith('/login');
  });
});
