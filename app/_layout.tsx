// app/_layout.tsx
import "../polyfills"; // Import polyfills first
import React from "react";
import { Stack } from "expo-router";
import { ThemeProvider } from "../context/ThemeContext";

export default function Layout() {
  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
