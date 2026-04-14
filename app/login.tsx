import { router } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
import { Button, Text, TextInput, View } from "react-native";
import { auth } from "../src/services/firebase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace("/(tabs)");
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Text>Логин</Text>

      <TextInput placeholder="Email" onChangeText={setEmail} />
      <TextInput placeholder="Пароль" secureTextEntry onChangeText={setPassword} />

      <Button title="Войти" onPress={handleLogin} />
      <Button title="Регистрация" onPress={() => router.push("/register")} />
    </View>
  );
}