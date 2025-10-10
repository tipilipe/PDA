// frontend/src/pages/LoginPage.jsx
import React, { useState, useContext } from 'react';
import AuthContext from '../context/AuthContext';
import ForgotPasswordModal from './ForgotPasswordModal';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useContext(AuthContext);
  const [forgotOpen, setForgotOpen] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      // O redirecionamento será tratado no App.jsx
    } catch (err) {
      setError('Falha no login. Verifique seu email e senha.');
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <form onSubmit={handleSubmit}>
        <h2>Login - Sistema PDA</h2>
        <div>
          <input
            className="themed-input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '300px', marginBottom: '10px' }}
          />
        </div>
        <div>
          <input
            className="themed-input"
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '300px', marginBottom: '10px' }}
          />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
  <button type="submit" className="btn btn-primary btn-block" style={{ width: '100%' }}>Entrar</button>
        <button type="button" onClick={() => setForgotOpen(true)} className="btn btn-link" style={{ width: '100%', marginTop: 8, color: '#0d6efd', background: 'transparent', border: 'none', textAlign: 'left', padding: 0 }}>Esqueci minha senha</button>
      </form>
      <ForgotPasswordModal open={forgotOpen} onClose={() => setForgotOpen(false)} />
    </div>
  );
}

export default LoginPage;