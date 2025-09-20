// frontend/src/context/AuthContext.jsx
import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../config';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);

  const parseJwt = (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%'
        + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  };

  // Efeito que roda quando o app carrega para verificar se já existe um token
  useEffect(() => {
    const token = localStorage.getItem('pda_token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const payload = parseJwt(token);
      if (payload) {
        setUser({ id: payload.userId, companyId: payload.companyId, role: payload.role, token });
      } else {
        setUser({ token });
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const loadSelfSettings = async () => {
      if (!user?.token) return;
      try {
  const { data } = await axios.get(`${API_BASE}/api/admin/self/settings`);
        setSettings(data);
      } catch (e) {
        setSettings(null);
      }
    };
    loadSelfSettings();
  }, [user?.token]);

  const login = async (email, password) => {
    try {
  const response = await axios.post(`${API_BASE}/api/auth/login`, { email, password });
  const { token, user: userData } = response.data;

      // 1. Salva o token no localStorage para persistir a sessão
      localStorage.setItem('pda_token', token);
      // 2. Configura o header padrão do Axios para todas as futuras requisições
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  // 3. Atualiza o estado do usuário (com role e companyId extraído do token)
      const payload = parseJwt(token);
      const nextUser = { ...userData, role: payload?.role, companyId: payload?.companyId, token };
      setUser(nextUser);
      try {
  const { data } = await axios.get(`${API_BASE}/api/admin/self/settings`);
        setSettings(data);
      } catch {}
    } catch (error) {
      console.error("Erro no login:", error);
      // Re-lança o erro para que a página de login possa tratá-lo
      throw error;
    }
  };

  const logout = () => {
    // 1. Remove o token do localStorage
    localStorage.removeItem('pda_token');
    // 2. Remove o header do Axios
    delete axios.defaults.headers.common['Authorization'];
    // 3. Limpa o estado do usuário
  setUser(null);
  setSettings(null);
  };

  // Se estiver verificando o token, pode mostrar uma tela de loading
  if (loading) {
    return <div>Verificando autenticação...</div>;
  }

  return (
    <AuthContext.Provider value={{ user, settings, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;