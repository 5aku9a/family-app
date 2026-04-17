import { router } from "expo-router";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useState } from "react";
import { ActivityIndicator, Alert, Button, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { auth, db } from "../src/services/firebase";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!email || !password || !displayName) {
      Alert.alert("Ошибка", "Заполните все поля");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Ошибка", "Пароли не совпадают");
      return;
    }

    setLoading(true);
    try {
      let user;

      // Попытка создать нового пользователя
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        user = userCredential.user;
        await updateProfile(user, { displayName });
        console.log("✅ Новый пользователь создан в Auth");
      } catch (authError: any) {
        // Если пользователь уже существует в Auth (email-already-in-use)
        if (authError.code === 'auth/email-already-in-use') {
          console.log("⚠️ Email занят, проверяем наличие профиля...");
          // Пробуем войти, чтобы получить объект пользователя
          const signInCredential = await signInWithEmailAndPassword(auth, email, password);
          user = signInCredential.user;
        } else {
          throw authError;
        }
      }

      // Проверяем, есть ли документ профиля в Firestore
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // Если профиля нет (например, после очистки БД), создаем его
        console.log("📝 Профиль не найден, создаем новый документ...");
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: displayName,
          familyId: null,
          createdAt: serverTimestamp(),
          photoURL: null,
        });
      } else {
        console.log("✅ Профиль уже существует");
      }

      // Переход в приложение
      router.replace("/(tabs)/profile");

    } catch (e: any) {
      console.error("Ошибка регистрации:", e);
      let message = "Не удалось зарегистрироваться";
      
      if (e.code === 'auth/invalid-email') message = "Некорректный email";
      if (e.code === 'auth/weak-password') message = "Пароль минимум 6 символов";
      if (e.code === 'auth/user-disabled') message = "Аккаунт заблокирован";
      
      Alert.alert("Ошибка", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Создать аккаунт</Text>
      <Text style={styles.subtitle}>Для ведения семейного бюджета</Text>

      <TextInput style={styles.input} placeholder="Ваше имя" value={displayName} onChangeText={setDisplayName} />
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Пароль" secureTextEntry value={password} onChangeText={setPassword} />
      <TextInput style={styles.input} placeholder="Подтвердите пароль" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />

      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" />
      ) : (
        <Button title="Зарегистрироваться / Войти" onPress={handleRegister} />
      )}

      <View style={styles.loginContainer}>
        <Text>Уже есть аккаунт? </Text>
        <Button title="Войти" onPress={() => router.push("/login")} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 10, color: '#333' },
  subtitle: { fontSize: 16, textAlign: 'center', color: '#666', marginBottom: 30 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 15, fontSize: 16 },
  loginContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
});