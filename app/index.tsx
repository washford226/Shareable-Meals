import React, { useEffect, useState } from "react";
import { View, Text, FlatList } from "react-native";
import { supabase } from "./utils_supabase";
import { Redirect } from "expo-router";

export default function Index() {
  // If you want to redirect to login, uncomment the next line and remove the rest of the component.
  // return <Redirect href="../(auth)/login" />;

  type Todo = { id: number; title: string }; // Adjust fields as needed
  const [todos, setTodos] = useState<Todo[]>([]);

  useEffect(() => {
    const getTodos = async () => {
      try {
        const { data: todos, error } = await supabase.from("todos").select();

        if (error) {
          console.error("Error fetching todos:", error.message);
          return;
        }

        if (todos && todos.length > 0) {
          setTodos(todos);
        } else {
          setTodos([]);
        }
      } catch (error: any) {
        console.error("Error fetching todos:", error.message);
      }
    };

    getTodos();
  }, []);

  useEffect(() => {
  const testConnection = async () => {
    const { error } = await supabase.auth.getSession();
    if (error) {
      console.error("Supabase connection/auth error:", error.message);
    } else {
      console.log("Supabase connection successful!");
    }
  };
  testConnection();
}, []);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Todo List</Text>
      <FlatList
        data={todos}
        keyExtractor={(item) => item.id?.toString() ?? Math.random().toString()}
        renderItem={({ item }) => <Text>{item.title}</Text>}
        ListEmptyComponent={<Text>No todos found.</Text>}
      />
    </View>
  );
}