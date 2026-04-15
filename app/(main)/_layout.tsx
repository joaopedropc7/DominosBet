import { Stack } from 'expo-router';

export default function MainLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade_from_bottom',
        animationDuration: 280,
        animationTypeForReplace: 'push',
        gestureEnabled: true,
      }}
    />
  );
}
