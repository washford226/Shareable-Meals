import React from "react";
import { Stack } from "expo-router";
import { ThemeProvider } from "@/context/ThemeContext";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <Stack>
        <Stack.Screen
          name="index"
          options={{
            title: "Balance Bytes", // Set the custom title here
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}