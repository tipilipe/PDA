// Centraliza a configuração de API
// Use VITE_API_BASE para apontar para o backend em produção, ex: https://api.shipstore.com.br
// Se vazio, usa caminhos relativos (recomendado quando frontend e backend estão no mesmo host e prefixo)
const RAW_BASE = import.meta.env.VITE_API_BASE || '';
// Remove barras finais para evitar //api/... que podem resultar em 404 em alguns proxies
export const API_BASE = RAW_BASE.replace(/\/+$/, '');
