// =====================================================
// supabase-client.js
// Conexão com o Supabase + funções de autenticação
// =====================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// 👉 Substitua pelos dados do seu projeto (Project Settings > API)
const SUPABASE_URL = 'https://fwtdzswkrouxstweylbd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3dGR6c3drcm91eHN0d2V5bGJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0Njg1NzIsImV4cCI6MjA5NzA0NDU3Mn0.jxt_YA6o2vCka4YGs2BXcDd2mpToQTRzRpF0y8lN0HQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// ============ AUTENTICAÇÃO ============

// Cria uma nova conta
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

// Faz login com e-mail e senha
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

// Faz logout
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Retorna o usuário logado (ou null)
export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

// Executa uma função sempre que o estado de login mudar
// (ex: usuário fez login, logout, ou a sessão expirou)
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}
