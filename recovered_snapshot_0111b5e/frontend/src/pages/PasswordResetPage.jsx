import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../config';

function PasswordResetPage({ user, onPasswordChanged }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
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
  await axios.post(`${API_BASE}/api/auth/reset-password`, {
        userId: user.id,
        password,
      });
      setSuccess('Senha alterada com sucesso! Faça login novamente.');
      onPasswordChanged && onPasswordChanged();
    } catch (err) {
      setError('Erro ao alterar senha.');
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <form onSubmit={handleSubmit}>
        <h2>Defina uma nova senha</h2>
        <div>
          <input
            type="password"
            placeholder="Nova senha"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{ width: '300px', padding: '10px', marginBottom: '10px' }}
          />
        </div>
        <div>
          <input
            type="password"
            placeholder="Confirme a senha"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            style={{ width: '300px', padding: '10px', marginBottom: '10px' }}
          />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        {success && <p style={{ color: 'green' }}>{success}</p>}
  <button type="submit" className="btn btn-primary btn-block" style={{ width: '100%', padding: '10px' }}>Salvar nova senha</button>
      </form>
    </div>
  );
}

export default PasswordResetPage;
