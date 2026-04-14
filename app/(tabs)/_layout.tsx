import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="budget" options={{ title: "Бюджет" }} />
      <Tabs.Screen name="tasks" options={{ title: "Задачи" }} />
      <Tabs.Screen name="subscriptions" options={{ title: "Подписки" }} />
      <Tabs.Screen name="profile" options={{ title: "Профиль" }} />
    </Tabs>
  );
}