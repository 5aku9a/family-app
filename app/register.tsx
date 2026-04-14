import { router } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
import { Button, Text, TextInput, View } from "react-native";
import { auth } from "../src/services/firebase";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async () => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      router.replace("/login");
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Text>Регистрация</Text>

      <TextInput placeholder="Email" onChangeText={setEmail} />
      <TextInput placeholder="Пароль" secureTextEntry onChangeText={setPassword} />

      <Button title="Создать аккаунт" onPress={handleRegister} />
    </View>
  );
}