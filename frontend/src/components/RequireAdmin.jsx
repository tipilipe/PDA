import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import AuthContext from '../context/AuthContext';

const RequireAdmin = ({ children }) => {
	const { user } = useContext(AuthContext);
	const location = useLocation();

	if (!user) {
		return <Navigate to="/" state={{ from: location }} replace />;
	}

		// Se não temos role (token antigo ou backend não retornou), não bloqueia
		if (!user.role) {
			return children;
		}

		const isAdmin = user.role === 'admin' || user.role === 'ADMIN' || user.role === 'superadmin';
		if (!isAdmin) {
		return (
			<div className="themed-section">
				<h2>Acesso restrito</h2>
				<p>Você não tem permissão para acessar esta área.</p>
			</div>
		);
	}

	return children;
};

export default RequireAdmin;
