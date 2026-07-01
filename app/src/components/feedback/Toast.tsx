import { CheckCircle2, Info, XCircle } from 'lucide-react-native';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ClaySurface } from '@/components/clay/ClaySurface';
import { colors, spacing, typography } from '@/theme/tokens';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastOptions {
  type?: ToastType;
  message: string;
}

interface ToastContextValue {
  show: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 3_000;

const ICONS: Record<ToastType, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const ICON_COLORS: Record<ToastType, string> = {
  success: colors.success,
  error: colors.danger,
  info: colors.primary[500],
};

interface ActiveToast extends Required<ToastOptions> {
  id: number;
}

/**
 * Top clay toast. Auto-dismisses after 3s. Announced politely to screen
 * readers — never steals focus.
 */
export function ToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<ActiveToast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);

  const show = useCallback((options: ToastOptions) => {
    if (timer.current) clearTimeout(timer.current);
    nextId.current += 1;
    setToast({ type: options.type ?? 'info', message: options.message, id: nextId.current });
    timer.current = setTimeout(() => setToast(null), AUTO_DISMISS_MS);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? <ToastView key={toast.id} toast={toast} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ toast }: { toast: ActiveToast }) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-96);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withSpring(0, { damping: 16, stiffness: 220 });
    opacity.value = withTiming(1, { duration: 160 });
  }, [translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const Icon = ICONS[toast.type];

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrapper, { top: insets.top + spacing.s }, animatedStyle]}
    >
      <ClaySurface radius="m" shadow="floating" style={styles.toast}>
        <View
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={styles.content}
        >
          <Icon color={ICON_COLORS[toast.type]} size={20} />
          <Text numberOfLines={2} style={styles.message}>
            {toast.message}
          </Text>
        </View>
      </ClaySurface>
    </Animated.View>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: spacing.l,
    right: spacing.l,
    zIndex: 1000,
    alignItems: 'center',
  },
  toast: {
    width: '100%',
    maxWidth: 480,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
  },
  message: {
    ...typography.smallMedium,
    color: colors.neutral[900],
    flexShrink: 1,
  },
});
