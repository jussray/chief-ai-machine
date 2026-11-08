import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0b1020' },
        headerTintColor: '#f8fafc',
        contentStyle: { backgroundColor: '#060913' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Chief AI' }} />
    </Stack>
  );
}
