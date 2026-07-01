import { fireEvent, render, screen } from '@testing-library/react-native';

import { ClayButton } from '@/components/clay/ClayButton';

describe('ClayButton', () => {
  test('renders its title and fires onPress', async () => {
    const onPress = jest.fn();
    await render(<ClayButton onPress={onPress} title="C'est parti !" />);

    await fireEvent.press(screen.getByText("C'est parti !"));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('disabled: does not fire onPress and exposes the a11y state', async () => {
    const onPress = jest.fn();
    await render(<ClayButton disabled onPress={onPress} testID="btn" title="Continuer" />);

    await fireEvent.press(screen.getByText('Continuer'));

    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByTestId('btn')).toBeDisabled();
  });

  test('loading: shows a spinner, hides the label and blocks presses', async () => {
    const onPress = jest.fn();
    await render(<ClayButton loading onPress={onPress} testID="btn" title="Créer mon compte" />);

    expect(screen.getByTestId('clay-button-spinner')).toBeTruthy();
    expect(screen.queryByText('Créer mon compte')).toBeNull();

    await fireEvent.press(screen.getByTestId('btn'));
    expect(onPress).not.toHaveBeenCalled();
  });

  test('renders every variant without crashing', async () => {
    await render(
      <>
        <ClayButton onPress={() => {}} title="p" variant="primary" />
        <ClayButton onPress={() => {}} title="s" variant="secondary" />
        <ClayButton onPress={() => {}} title="ok" variant="success" />
        <ClayButton onPress={() => {}} title="no" variant="danger" />
        <ClayButton onPress={() => {}} title="au" variant="gold" />
      </>,
    );
    expect(screen.getByText('au')).toBeTruthy();
  });
});
