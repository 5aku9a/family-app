import { router } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
import { ActivityIndicator, Button, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "../src/context/AuthContext";
import { auth } from "../src/services/firebase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  // Если пользователь уже авторизован, перенаправляем на главный экран
  if (user) {
    router.replace("/(tabs)");
    return null;
  }

  const handleLogin = async () => {
    if (!email || !password) {
      alert("Введите email и пароль");
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Перенаправление произойдет автоматически через AuthContext
    } catch (e: any) {
      let errorMessage = "Ошибка при входе";

      // Обработка распространенных ошибок Firebase
      if (e.code === 'auth/user-not-found') {
        errorMessage = "Пользователь с таким email не найден";
      } else if (e.code === 'auth/wrong-password') {
        errorMessage = "Неверный пароль";
      } else if (e.code === 'auth/invalid-email') {
        errorMessage = "Некорректный email";
      } else if (e.code === 'auth/user-disabled') {
        errorMessage = "Аккаунт заблокирован";
      }

      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Семейный бюджет</Text>
      <Text style={styles.subtitle}>Вход в аккаунт</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Пароль"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" />
      ) : (
        <Button title="Войти" onPress={handleLogin} />
      )}

      <View style={styles.registerContainer}>
        <Text>Нет аккаунта? </Text>
        <Button title="Регистрация" onPress={() => router.push("/register")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 30,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
});