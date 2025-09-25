// backend/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Chave JWT: usa variável de ambiente em produção, com fallback para dev
const JWT_SECRET = process.env.JWT_SECRET || 'sua-chave-secreta-super-dificil-de-adivinhar';

module.exports = (pool) => {
  // ROTA DE CADASTRO DE NOVO USUÁRIO E EMPRESA
  router.post('/register', async (req, res) => {
    const { companyName, userName, email, password } = req.body;

    if (!companyName || !email || !password) {
      return res.status(400).json({ error: 'Nome da empresa, email e senha são obrigatórios.' });
    }

    const client = await pool.connect(); // Pega uma conexão do pool para fazer uma transação
    try {
      await client.query('BEGIN'); // Inicia a transação

      // 1. Criptografa a senha do usuário
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);

      // 2. Cria a nova empresa
      const companyQuery = 'INSERT INTO companies (name) VALUES ($1) RETURNING id';
      const companyResult = await client.query(companyQuery, [companyName]);
      const newCompanyId = companyResult.rows[0].id;

      // 3. Cria o novo usuário e o associa à empresa recém-criada
      const userQuery = 'INSERT INTO users (name, email, password_hash, company_id, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role';
      // Para o seu caso, o primeiro usuário pode ser um 'admin' da empresa dele
      const userResult = await client.query(userQuery, [userName, email, password_hash, newCompanyId, 'admin']);

      await client.query('COMMIT'); // Se tudo deu certo, efetiva as alterações no banco
      res.status(201).json({
        message: 'Empresa e usuário criados com sucesso!',
        user: userResult.rows[0]
      });

    } catch (err) {
      await client.query('ROLLBACK'); // Se algo deu errado, desfaz tudo
      console.error('Erro no cadastro:', err);
      res.status(500).json({ error: 'Erro ao registrar usuário. O email já pode estar em uso.' });
    } finally {
      client.release(); // Libera a conexão de volta para o pool
    }
  });

  // ROTA DE LOGIN
  router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
      // Busca o usuário pelo email
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      const user = result.rows[0];

      if (!user) {
        return res.status(400).json({ error: 'Email ou senha inválidos.' });
      }

      // Compara a senha enviada com a senha criptografada no banco
      const isMatch = await bcrypt.compare(password, user.password_hash);

      if (!isMatch) {
        return res.status(400).json({ error: 'Email ou senha inválidos.' });
      }

      // Se a senha estiver correta, gera um token JWT
      const payload = {
        userId: user.id,
        companyId: user.company_id,
        role: user.role,
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' }); // Token expira em 8 horas

      res.json({
        message: 'Login bem-sucedido!',
        token: token,
        user: { id: user.id, name: user.name, email: user.email }
      });

    } catch (err) {
      console.error('Erro no login:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // Verifica se usuário está liberado para redefinir a senha
  router.post('/check-reset', async (req, res) => {
    const { email } = req.body;
    try {
      const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      const user = result.rows[0];
      if (!user) return res.status(404).json({ allow: false });
      const settings = await pool.query('SELECT allow_password_reset FROM admin_user_settings WHERE user_id = $1', [user.id]);
      const allow = settings.rows[0]?.allow_password_reset === true;
      res.json({ allow, userId: user.id });
    } catch (err) {
      console.error('Erro no check-reset:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // Redefine a senha caso esteja liberado e consome a liberação
  router.post('/reset-password', async (req, res) => {
    const { userId, password } = req.body;
    if (!userId || !password) return res.status(400).json({ error: 'Dados insuficientes.' });
    try {
      const flag = await pool.query('SELECT allow_password_reset FROM admin_user_settings WHERE user_id = $1', [userId]);
      if (!flag.rows[0]?.allow_password_reset) {
        return res.status(403).json({ error: 'Redefinição não liberada.' });
      }
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, userId]);
      await pool.query('UPDATE admin_user_settings SET allow_password_reset = FALSE WHERE user_id = $1', [userId]);
      res.json({ message: 'Senha atualizada com sucesso.' });
    } catch (err) {
      console.error('Erro no reset-password:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  return router;
};

// Rota utilitária fora do factory (evita necessidade de pool)
module.exports.meRoute = (app) => {
  const { protect } = require('../middleware/authMiddleware');
  app.get('/api/auth/me', protect, (req, res) => {
    res.json({ ok: true, user: req.user });
  });
};