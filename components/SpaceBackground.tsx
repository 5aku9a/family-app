import React, { useEffect, useState } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';

const { width, height } = Dimensions.get('window');

interface Star {
  id: number;
  top: number;
  left: number;
  size: number;
  opacity: Animated.Value;
}

export default function SpaceBackground() {
  const [stars, setStars] = useState<Star[]>([]);

  useEffect(() => {
    const newStars: Star[] = Array.from({ length: 60 }).map((_, i) => {
      const opacity = new Animated.Value(Math.random() * 0.5 + 0.3);
      
      // Анимация мерцания
      Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: Math.random() * 0.5 + 0.8,
            duration: Math.random() * 2000 + 1000,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: Math.random() * 0.3 + 0.2,
            duration: Math.random() * 2000 + 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      return {
        id: i,
        top: Math.random() * height,
        left: Math.random() * width,
        size: Math.random() * 2 + 1,
        opacity,
      };
    });
    setStars(newStars);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.gradient} />
      

      {stars.map((star) => (
        <Animated.View
          key={star.id}
          style={[
            styles.star,
            {
              top: star.top,
              left: star.left,
              width: star.size,
              height: star.size,
              opacity: star.opacity,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0B1120', // Базовый цвет

  },
  star: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 99,
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 2,
  },
});