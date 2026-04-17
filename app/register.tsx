import { router } from "expo-router";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useState } from "react";
import { ActivityIndicator, Button, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "../src/context/AuthContext";
import { auth, db } from "../src/services/firebase";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  // Если пользователь уже авторизован, перенаправляем на главный экран
  if (user) {
    router.replace("/(tabs)");
    return null;
  }

  const handleRegister = async () => {
    // Валидация полей
    if (!email || !password || !displayName) {
      alert("Заполните все поля");
      return;
    }

    if (password !== confirmPassword) {
      alert("Пароли не совпадают");
      return;
    }

    if (password.length < 6) {
      alert("Пароль должен быть не менее 6 символов");
      return;
    }

    setLoading(true);
    try {
      // Создаем пользователя в Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Обновляем профиль пользователя (имя)
      await updateProfile(user, {
        displayName: displayName,
      });

      // Создаем документ пользователя в Firestore
      await setDoc(doc(db, "users", user.uid), {
        email: email,
        displayName: displayName,
        createdAt: new Date(),
        familyId: null, // Пока без семьи
      });

      // Перенаправление произойдет автоматически через AuthContext
    } catch (e: any) {
      let errorMessage = "Ошибка при регистрации";

      // Обработка распространенных ошибок Firebase
      if (e.code === 'auth/email-already-in-use') {
        errorMessage = "Этот email уже зарегистрирован";
      } else if (e.code === 'auth/invalid-email') {
        errorMessage = "Некорректный email";
      } else if (e.code === 'auth/weak-password') {
        errorMessage = "Пароль слишком слабый";
      } else if (e.code === 'auth/operation-not-allowed') {
        errorMessage = "Регистрация отключена";
      }

      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Семейный бюджет</Text>
      <Text style={styles.subtitle}>Регистрация</Text>

      <TextInput
        style={styles.input}
        placeholder="Ваше имя"
        value={displayName}
        onChangeText={setDisplayName}
      />
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
      <TextInput
        style={styles.input}
        placeholder="Подтвердите пароль"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" />
      ) : (
        <Button title="Создать аккаунт" onPress={handleRegister} />
      )}

      <View style={styles.loginContainer}>
        <Text>Уже есть аккаунт? </Text>
        <Button title="Войти" onPress={() => router.push("/login")} />
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
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
});