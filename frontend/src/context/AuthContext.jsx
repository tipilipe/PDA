// frontend/src/context/AuthContext.jsx
import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../config';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [settingsReady, setSettingsReady] = useState(false); // garante saber quando terminou

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

  // Intercepta 401 globalmente para evitar estado de sessão "meio logado"
  useEffect(() => {
    const id = axios.interceptors.response.use(
      (resp) => resp,
      (error) => {
        const status = error?.response?.status;
        const url = error?.config?.url || '';
        // Não derruba a sessão em erros da IA; o componente mostra mensagem e o usuário não é chutado
        const isAiRoute = url.includes('/api/ai/');
        if (status === 401 && !isAiRoute) {
          try { localStorage.removeItem('pda_token'); } catch {}
          delete axios.defaults.headers.common['Authorization'];
          setUser(null);
          setSettings(null);
          try { window.location.assign('login'); } catch {}
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(id);
  }, []);

  useEffect(() => {
    const loadSettingsAndCompany = async () => {
      if (!user?.token) return;
      try {
        const [selfSettingsRes, profileRes] = await Promise.all([
          axios.get(`${API_BASE}/api/admin/self/settings`).catch(()=>({ data:null })),
          axios.get(`${API_BASE}/api/company/profile`).catch(()=>({ data:null }))
        ]);
        const merged = { ...(selfSettingsRes.data || {}), ...(profileRes.data || {}) };
        // Normaliza para facilitar: coloca companyName e companyAcronym se possível
        if (merged.company && !merged.companyName) merged.companyName = merged.company.name;
        if (merged.company && !merged.companyAcronym) {
          const c = merged.company;
            merged.companyAcronym = c.acronym || c.sigla || c.abbr || c.code || c.shortName || '';
        }
        setSettings(merged);
        setSettingsReady(true);
      } catch (e) {
        setSettings(null);
        setSettingsReady(true);
      }
    };
    loadSettingsAndCompany();
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
    <AuthContext.Provider value={{ user, settings, settingsReady, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;