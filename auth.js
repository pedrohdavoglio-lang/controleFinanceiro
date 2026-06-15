import { signIn, signUp, signOut, onAuthStateChange } from './supabase-client.js';

const loginScreen  = document.getElementById('loginScreen');
const mainApp      = document.getElementById('mainApp');
const loginForm    = document.getElementById('loginForm');
const loginEmail   = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginError   = document.getElementById('loginError');
const loginBtn     = document.getElementById('loginBtn');
const signupBtn    = document.getElementById('signupBtn');
const logoutBtn    = document.getElementById('logoutBtn');

function showApp() {
  loginScreen.style.display = 'none';
  mainApp.style.display = '';
}

function showLogin() {
  loginScreen.style.display = '';
  mainApp.style.display = 'none';
}

function setMsg(msg, isSuccess = false) {
  loginError.textContent = msg;
  loginError.className = isSuccess ? 'login-error login-success' : 'login-error';
}

onAuthStateChange((event, session) => {
  if (session?.user) showApp();
  else showLogin();
});

loginForm.onsubmit = async e => {
  e.preventDefault();
  setMsg('');
  loginBtn.disabled = true;
  try {
    await signIn(loginEmail.value.trim(), loginPassword.value);
    // onAuthStateChange cuida de mostrar o app após o login
  } catch (err) {
    setMsg(err.message || 'Erro ao entrar.');
    loginBtn.disabled = false;
  }
};

signupBtn.onclick = async () => {
  if (!loginEmail.value.trim() || !loginPassword.value) {
    setMsg('Preencha e-mail e senha para criar conta.');
    return;
  }
  setMsg('');
  signupBtn.disabled = true;
  try {
    await signUp(loginEmail.value.trim(), loginPassword.value);
    setMsg('Conta criada! Verifique seu e-mail para confirmar.', true);
    loginPassword.value = '';
  } catch (err) {
    setMsg(err.message || 'Erro ao criar conta.');
  }
  signupBtn.disabled = false;
};

logoutBtn.onclick = () => signOut();
