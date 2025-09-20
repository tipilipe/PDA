import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../config';

function ForgotPasswordModal({ open, onClose }) {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState(1); // 1: pedir email, 2: redefinir senha
  const [userId, setUserId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const handleCheck = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
  const res = await axios.post(`${API_BASE}/api/auth/check-reset`, { email });
      if (res.data.allow) {
        setUserId(res.data.userId);
        setStep(2);
      } else {
        setError('A redefinição de senha não está liberada para este usuário. Solicite ao administrador.');
      }
    } catch (err) {
      setError('Usuário não encontrado.');
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }
    try {
  await axios.post(`${API_BASE}/api/auth/reset-password`, { userId, password });
      setSuccess('Senha alterada com sucesso! Faça login novamente.');
      setStep(1);
      setEmail('');
      setPassword('');
      setConfirm('');
      setTimeout(onClose, 2000);
    } catch (err) {
      setError('Erro ao redefinir senha.');
    }
  };

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: '#fff', padding: 32, borderRadius: 8, minWidth: 350 }}>
        {step === 1 && (
          <form onSubmit={handleCheck}>
            <h3>Esqueci minha senha</h3>
            <input
              type="email"
              placeholder="Digite seu email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{ width: '100%', padding: 10, marginBottom: 10 }}
            />
            {error && <p style={{ color: 'red' }}>{error}</p>}
            {success && <p style={{ color: 'green' }}>{success}</p>}
            <button type="submit" className="btn btn-primary btn-block" style={{ width: '100%', padding: 10 }}>Verificar</button>
            <button type="button" className="btn btn-outline-primary btn-block" style={{ width: '100%', marginTop: 8 }} onClick={onClose}>Cancelar</button>
          </form>
        )}
        {step === 2 && (
          <form onSubmit={handleReset}>
            <h3>Redefinir senha</h3>
            <input
              type="password"
              placeholder="Nova senha"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{ width: '100%', padding: 10, marginBottom: 10 }}
            />
            <input
              type="password"
              placeholder="Confirme a senha"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              style={{ width: '100%', padding: 10, marginBottom: 10 }}
            />
            {error && <p style={{ color: 'red' }}>{error}</p>}
            {success && <p style={{ color: 'green' }}>{success}</p>}
            <button type="submit" className="btn btn-primary btn-block" style={{ width: '100%', padding: 10 }}>Salvar nova senha</button>
            <button type="button" className="btn btn-outline-primary btn-block" style={{ width: '100%', marginTop: 8 }} onClick={onClose}>Cancelar</button>
          </form>
        )}
      </div>
    </div>
  );
}

export default ForgotPasswordModal;
