# FamilySpace

FamilySpace — мобильное приложение для организации семейного пространства и совместного управления повседневными задачами.

## Возможности

- Регистрация и авторизация пользователей
- Создание семейных групп
- Управление семейным бюджетом
- Учет доходов и расходов
- Категории операций
- Календарь событий
- Подписки и регулярные платежи
- Статистика и аналитика
- Управление профилем пользователей
- Синхронизация данных между участниками семьи

## Технологии

- React Native
- TypeScript
- Expo
- Firebase Authentication
- Cloud Firestore
- React Navigation
- Git

## Архитектура проекта

family-app
│
├── app/                # Экраны приложения (Expo Router)
│   ├── (auth)/         # Авторизация
│   └── (tabs)/         # Основные разделы
│
├── src/
│   ├── services/       # Работа с Firebase и бизнес-логика
│   ├── context/        # Глобальное состояние
│   ├── types/          # TypeScript-интерфейсы
│   └── components/     # Переиспользуемые компоненты
│
├── assets/             # Шрифты и изображения
└── package.json

## Скриншоты

<p align="center">
<img width="220" alt="image" src="https://github.com/user-attachments/assets/31608a5e-68db-4f3f-84f2-48cd02a4c17d" />
<img width="220" alt="image" src="https://github.com/user-attachments/assets/1a3eb13b-5463-473c-9b37-4bb54a457b33" />
</p>

<p align="center">
<img width="220" alt="image" src="https://github.com/user-attachments/assets/17c58d52-5230-4e07-a15c-6829248825c5" /> 
<img width="220" alt="image" src="https://github.com/user-attachments/assets/e75eb62a-5b7f-4e5d-91b0-27d742ea5243" /> 
<img width="220" alt="image" src="https://github.com/user-attachments/assets/bed96b8f-da76-425d-887f-ae00c249308d" />
<img width="220" alt="image" src="https://github.com/user-attachments/assets/dd345e3e-9226-45a4-927d-3dc8cceef366" />
<img width="220" alt="image" src="https://github.com/user-attachments/assets/78044285-c0b0-402b-9944-6ae2bf11d43d" />
</p>

## Установка

```bash
git clone ...
npm install
npx expo start
