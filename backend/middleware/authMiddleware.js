// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = 'sua-chave-secreta-super-dificil-de-adivinhar'; // A mesma chave secreta do auth.js

const protect = (req, res, next) => {
  let token;

  // O token vem no cabeçalho da requisição, no formato "Bearer <token>"
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // 1. Pega o token do cabeçalho (remove o "Bearer ")
      token = req.headers.authorization.split(' ')[1];

      // 2. Verifica se o token é válido usando a nossa chave secreta
      const decoded = jwt.verify(token, JWT_SECRET);

      // 3. Se for válido, anexa os dados do usuário (payload) na própria requisição
      // Agora, todas as rotas protegidas terão acesso a req.user
      req.user = decoded;

      next(); // Passa para a próxima etapa (a rota que o usuário queria acessar)
    } catch (error) {
      console.error('Erro na autenticação do token:', error);
      res.status(401).json({ error: 'Não autorizado, token falhou.' });
    }
  }

  if (!token) {
    res.status(401).json({ error: 'Não autorizado, nenhum token encontrado.' });
  }
};

module.exports = { protect };