import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import { API_BASE } from '../config';

const ALL_TABS = [
	{ key: 'pda', label: 'Gerar PDA' },
	{ key: 'ships', label: 'Navios' },
	{ key: 'clients', label: 'Clientes' },
	{ key: 'ports', label: 'Portos' },
	{ key: 'services', label: 'Serviços' },
	{ key: 'pilotage', label: 'Praticagem' },
	{ key: 'port_services', label: 'Vínculos' },
	{ key: 'calculations', label: 'Cálculos' },
	{ key: 'port_remarks', label: 'Observações' },
	{ key: 'profile', label: 'Perfil' },
	{ key: 'admin', label: 'Administração' },
];

const AdminPage = () => {
	const { user } = useContext(AuthContext);
	const [users, setUsers] = useState([]);
	const [metrics, setMetrics] = useState({ ships: 0, clients: 0, pdas: 0 });
	const [companies, setCompanies] = useState([]);
	const [selectedUser, setSelectedUser] = useState(null);
	const [userSettings, setUserSettings] = useState(null);

	const [userForm, setUserForm] = useState({ name: '', email: '', password: '', isAdmin: false, companyId: '' });
	const [companyForm, setCompanyForm] = useState({ name: '', address: '', cnpj: '' });
	const [linkCompanyId, setLinkCompanyId] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [newPassword2, setNewPassword2] = useState('');
	const deleteUser = async () => {
		if (!selectedUser) return;
		if (!confirm(`Tem certeza que deseja excluir o usuário ${selectedUser.name}?`)) return;
		setLoading(true); setError('');
		try {
			await axios.delete(`${API_BASE}/api/admin/users/${selectedUser.id}`);
			const { data: usersData } = await axios.get(`${API_BASE}/api/admin/users`);
			setUsers(usersData);
			setSelectedUser(null);
			setUserSettings(null);
			setLinkCompanyId('');
		} catch (e) {
			setError('Falha ao excluir usuário.');
		} finally { setLoading(false); }
	};

	// Mantém o dropdown de empresa sincronizado com o usuário selecionado
	useEffect(() => {
		if (selectedUser && selectedUser.company_id != null) {
			setLinkCompanyId(String(selectedUser.company_id));
		} else {
			setLinkCompanyId('');
		}
	}, [selectedUser?.company_id]);

	const loadUsers = async () => {
		try {
			const { data } = await axios.get(`${API_BASE}/api/admin/users`);
			setUsers(data);
		} catch (e) {
			setError('Falha ao carregar usuários.');
		}
	};

	const loadMetrics = async () => {
		try {
			const { data } = await axios.get(`${API_BASE}/api/admin/metrics`);
			setMetrics(data);
		} catch (e) {}
	};

		const loadCompanies = async () => {
		try {
			const { data } = await axios.get(`${API_BASE}/api/companies`);
			setCompanies(data);
			} catch (e) { setError('Falha ao carregar empresas.'); }
	};

	const loadUserSettings = async (userId) => {
		try {
			const { data } = await axios.get(`${API_BASE}/api/admin/users/${userId}/settings`);
			setUserSettings(data);
		} catch (e) { setUserSettings({ user_id: userId, is_admin: false, visible_tabs: {} }); }
	};

		useEffect(() => {
			if (!user?.token) return;
			loadUsers();
			loadMetrics();
			loadCompanies();
		}, [user?.token]);

	const submitUser = async (e) => {
		e.preventDefault();
		setLoading(true); setError('');
		try {
			const payload = {
				name: userForm.name,
				email: userForm.email,
				password: userForm.password,
				isAdmin: userForm.isAdmin,
				companyId: userForm.companyId ? Number(userForm.companyId) : undefined,
			};
			const created = await axios.post(`${API_BASE}/api/admin/users`, payload);
			// define settings iniciais (admin flag)
			await axios.put(`${API_BASE}/api/admin/users/${created.data.id}/settings`, { is_admin: userForm.isAdmin });
			// Reflete imediatamente a empresa escolhida, antes do reload
			const chosenId = userForm.companyId ? Number(userForm.companyId) : null;
			const chosenName = chosenId ? (companies.find(c => Number(c.id) === Number(chosenId))?.name || null) : null;
			setSelectedUser({ ...created.data, company_id: chosenId, company_name: chosenName });
			setLinkCompanyId(chosenId ? String(chosenId) : '');
			setUserForm({ name: '', email: '', password: '', isAdmin: false, companyId: '' });
			// Recarrega usuários e mantém seleção no recém-criado (com dados completos do backend)
			const { data: usersData } = await axios.get(`${API_BASE}/api/admin/users`);
			setUsers(usersData);
			const newUser = usersData.find(u => u.id === created.data.id);
			if (newUser) {
				setSelectedUser(newUser);
				await loadUserSettings(newUser.id);
				setLinkCompanyId(newUser.company_id ? String(newUser.company_id) : '');
			}
		} catch (e) {
			setError(e?.response?.data?.error || 'Erro ao cadastrar usuário.');
		} finally { setLoading(false); }
	};

	const saveTabs = async () => {
		if (!selectedUser || !userSettings) return;
		setLoading(true);
		try {
			await axios.put(`${API_BASE}/api/admin/users/${selectedUser.id}/settings`, {
				is_admin: !!userSettings.is_admin,
				visible_tabs: userSettings.visible_tabs || {},
			});
			const { data: usersData } = await axios.get(`${API_BASE}/api/admin/users`);
			setUsers(usersData);
			const found = usersData.find(u => u.id === selectedUser.id);
			if (found) setSelectedUser(found);
		} finally { setLoading(false); }
	};

	const liberatePassword = async () => {
		if (!selectedUser) return;
		setLoading(true);
		try {
			await axios.put(`${API_BASE}/api/admin/users/${selectedUser.id}/settings`, { allow_password_reset: true });
			await loadUserSettings(selectedUser.id);
		} finally { setLoading(false); }
	};

	const adminResetPassword = async () => {
		if (!selectedUser) return;
		if (newPassword.length < 6 || newPassword !== newPassword2) {
			setError('Senha inválida ou não coincide.');
			return;
		}
		setLoading(true); setError('');
		try {
			await axios.post(`${API_BASE}/api/admin/users/${selectedUser.id}/reset-password`, { password: newPassword });
			setNewPassword(''); setNewPassword2('');
		} catch {
			setError('Falha ao redefinir senha.');
		} finally { setLoading(false); }
	};

	const liberateCompanyNameEdit = async () => {
		if (!selectedUser) return;
		setLoading(true);
		try {
			await axios.put(`${API_BASE}/api/admin/users/${selectedUser.id}/settings`, { allow_company_name_edit: true });
			await loadUserSettings(selectedUser.id);
		} finally { setLoading(false); }
	};

	const editUser = async () => {
		if (!selectedUser) return;
		setLoading(true);
		try {
			// Atualiza nome e role conforme is_admin dos settings
			await axios.put(`${API_BASE}/api/admin/users/${selectedUser.id}`, {
				name: selectedUser.name,
				role: userSettings?.is_admin ? 'admin' : 'user',
			});
			const { data: usersData } = await axios.get(`${API_BASE}/api/admin/users`);
			setUsers(usersData);
			const found = usersData.find(u => u.id === selectedUser.id);
			if (found) setSelectedUser(found);
		} catch (e) {
			setError('Falha ao editar usuário.');
		} finally { setLoading(false); }
	};

	const linkCompany = async () => {
		if (!selectedUser || !linkCompanyId) return;
		setLoading(true);
		try {
			const prevId = selectedUser.id;
			const newCompanyId = Number(linkCompanyId);
			await axios.post(`${API_BASE}/api/admin/users/${selectedUser.id}/company`, { companyId: newCompanyId });
			// Atualiza imediatamente o usuário selecionado com a nova empresa
			const newCompanyName = companies.find(c => Number(c.id) === newCompanyId)?.name || selectedUser.company_name;
			setSelectedUser(prev => prev ? { ...prev, company_id: newCompanyId, company_name: newCompanyName } : prev);
			// Recarrega usuários e preserva seleção do mesmo usuário
			const { data: usersData } = await axios.get(`${API_BASE}/api/admin/users`);
			setUsers(usersData);
			const found = usersData.find(u => u.id === prevId);
			setSelectedUser(found || null);
			if (found) {
				await loadUserSettings(found.id);
				setLinkCompanyId(found.company_id ? String(found.company_id) : '');
			} else {
				setUserSettings(null);
				setLinkCompanyId('');
			}
		} finally { setLoading(false); }
	};

	const submitCompany = async (e) => {
		e.preventDefault();
		setLoading(true);
		try {
			await axios.post(`${API_BASE}/api/companies`, companyForm);
			setCompanyForm({ name: '', address: '', cnpj: '' });
			await loadCompanies();
		} finally { setLoading(false); }
	};

	const deactivateCompany = async (id) => {
		if (!confirm('Desativar esta empresa?')) return;
		setLoading(true);
		try {
			await axios.patch(`${API_BASE}/api/companies/${id}/deactivate`);
			await loadCompanies();
		} finally { setLoading(false); }
	};

	const deleteCompany = async (id) => {
		// 3 confirmações com posições diferentes não são triviais sem modal; farei 3 confirms sequenciais.
		if (!confirm('Excluir empresa? (1/3)')) return;
		if (!confirm('Tem certeza? (2/3)')) return;
		if (!confirm('Esta ação é irreversível. Confirmar exclusão? (3/3)')) return;
		setLoading(true);
		try {
			await axios.delete(`${API_BASE}/api/companies/${id}`);
			await loadCompanies();
		} finally { setLoading(false); }
	};

	const toggleTab = (key) => {
		setUserSettings(prev => {
			const vis = { ...(prev?.visible_tabs || {}) };
			const current = vis[key];
			vis[key] = current === true ? false : true; // marca/desmarca; default ao primeiro clique: true
			return { ...prev, visible_tabs: vis };
		});
	};

	return (
		<div>
			{/* Cadastro de usuário */}
			<div className="themed-section">
				<h2 className="admin-section-title">Cadastrar Novo Usuário</h2>
				<form onSubmit={submitUser} className="admin-user-create-form">
					<input className="themed-input" placeholder="Nome" value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} />
					<input className="themed-input" placeholder="Email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} />
					<input className="themed-input" placeholder="Senha" type="password" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} />
					<select className="themed-input" value={userForm.companyId} onChange={e => setUserForm({ ...userForm, companyId: e.target.value })}>
						<option value="">Selecione a empresa</option>
						{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
					</select>
					<label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom:8 }}>
						<input type="checkbox" checked={userForm.isAdmin} onChange={e => setUserForm({ ...userForm, isAdmin: e.target.checked })} />
						Administrador
					</label>
					<button className="btn btn-primary" disabled={loading}>{loading ? 'Cadastrando...' : 'Cadastrar Usuário'}</button>
				</form>
				{error && <div style={{ color: 'salmon', marginTop: 8 }}>{error}</div>}
			</div>

			{/* Lista e detalhes */}
			<div className="themed-section">
				<div className="admin-panels">
					<div>
						<h3 className="admin-section-title">Usuários do Sistema</h3>
						<div style={{ borderTop: '1px solid #3a4662', marginTop: 8, paddingTop: 8 }} />
						<div className="admin-user-list">
							{users.map(u => {
								const active = selectedUser?.id === u.id;
								return (
									<div key={u.id}
										className={`admin-user-item ${active ? 'is-active' : ''}`}
										onClick={() => { setSelectedUser(u); loadUserSettings(u.id); setLinkCompanyId(u.company_id ? String(u.company_id) : ''); }}>
										<div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
											<div>
												<div className="admin-user-item-name">{u.name}</div>
												<div className="meta">{u.email}</div>
												<div className="meta2">Empresa: {u.company_name || 'Sem empresa'}</div>
											</div>
											{u.role?.toLowerCase() === 'admin' && <span className="btn btn-outline-danger" style={{ padding: '2px 8px', fontSize:11 }}>Admin</span>}
										</div>
									</div>
								);
							})}
						</div>
					</div>
					<div>
						<h3 className="admin-section-title">Detalhes do Usuário</h3>
						{!selectedUser ? (
							<div style={{ opacity:.8 }}>Selecione um usuário para ver detalhes e permissões.</div>
						) : (
							<div>
								<div style={{ marginBottom: 12, display:'flex', flexWrap:'wrap', gap:16 }}>
									<div><strong>Nome:</strong><br /><input className="themed-input" value={selectedUser.name} onChange={e => setSelectedUser({ ...selectedUser, name: e.target.value })} /></div>
									<div><strong>Email:</strong><br />{selectedUser.email}</div>
									<div style={{ display:'flex', alignItems:'center', gap:6 }}><strong>Admin:</strong> <input type="checkbox" checked={!!userSettings?.is_admin} onChange={e => setUserSettings({ ...(userSettings || {}), is_admin: e.target.checked })} /></div>
								</div>
								<div style={{ margin: '12px 0' }}>
									<div style={{ fontWeight: 700, marginBottom: 6 }}>Métricas</div>
									<div>Navios: {metrics.ships} | Clientes: {metrics.clients} | PDAs salvos: {metrics.pdas}</div>
								</div>
								<div style={{ margin: '12px 0' }}>
									<div style={{ fontWeight: 700, marginBottom: 8 }}>Permissões de Abas</div>
									<div className="admin-perms">
										{ALL_TABS.map(tab => (
											<label key={tab.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize:13 }}>
												<input type="checkbox" checked={userSettings?.visible_tabs?.[tab.key] === true} onChange={() => toggleTab(tab.key)} />
												{tab.label}
											</label>
										))}
									</div>
								</div>
								<div style={{ margin: '12px 0' }}>
									<div style={{ fontWeight: 700, marginBottom: 8 }}>Empresa do Usuário</div>
									<div style={{ opacity: 0.85, marginBottom: 6 }}>
										{(() => {
											const byId = companies.find(c => Number(c.id) === Number(selectedUser.company_id));
											const byLink = companies.find(c => Number(c.id) === Number(linkCompanyId));
											const name = selectedUser.company_name || byId?.name || byLink?.name;
											return <>Atual: {name || 'Não vinculada'}</>;
										})()}
									</div>
									<div className="admin-inline-form" style={{ marginTop:4 }}>
										<select className="themed-input" value={linkCompanyId} onChange={e => setLinkCompanyId(e.target.value)}>
											<option value="">Selecione uma empresa</option>
											{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
										</select>
										<button className="btn btn-secondary" onClick={linkCompany} disabled={!linkCompanyId}>Vincular</button>
									</div>
								</div>
								<div className="admin-actions">
									<button className="btn btn-primary" onClick={liberatePassword}>Liberar alteração de senha</button>
									<button className="btn btn-primary" style={{ background: '#6f42c1', borderColor: '#6f42c1' }} onClick={liberateCompanyNameEdit}>Liberar edição do nome</button>
									<button className="btn btn-outline-primary" onClick={saveTabs}>Salvar abas</button>
									<button className="btn btn-secondary" onClick={editUser} disabled={loading}>Editar usuário</button>
									<button className="btn btn-outline-danger" onClick={deleteUser} disabled={loading}>Excluir usuário</button>
								</div>
								<div className="admin-reset">
									<div style={{ fontWeight: 700, width:'100%' }}>Redefinir senha (admin)</div>
									<input className="themed-input" type="password" placeholder="Nova senha" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
									<input className="themed-input" type="password" placeholder="Confirmar senha" value={newPassword2} onChange={e => setNewPassword2(e.target.value)} />
									<button className="btn btn-danger" onClick={adminResetPassword} disabled={loading || !newPassword || newPassword !== newPassword2}>Salvar nova senha</button>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Cadastro de Empresas */}
			<div className="themed-section">
				<h3 className="admin-section-title">Cadastro de Empresas</h3>
				<form onSubmit={submitCompany} className="admin-company-create-form">
					<input className="themed-input" placeholder="Nome" value={companyForm.name} onChange={e => setCompanyForm({ ...companyForm, name: e.target.value })} />
					<input className="themed-input" placeholder="Endereço" value={companyForm.address} onChange={e => setCompanyForm({ ...companyForm, address: e.target.value })} />
					<input className="themed-input" placeholder="CNPJ" value={companyForm.cnpj} onChange={e => setCompanyForm({ ...companyForm, cnpj: e.target.value })} />
					<button className="btn btn-primary">Cadastrar Empresa</button>
				</form>
				<div style={{ marginTop: 12 }}>
					<div style={{ fontWeight: 700, marginBottom: 6 }}>Empresas Cadastradas</div>
					<ul style={{ margin: 0, paddingLeft: 18 }}>
						{companies.map(c => (
							<li key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
								<button className="btn btn-outline-warning" onClick={() => deactivateCompany(c.id)} disabled={loading}>Desativar</button>
								<button className="btn btn-outline-danger" onClick={() => deleteCompany(c.id)} disabled={loading}>Excluir</button>
								<span style={{ flex: 1 }}>
									{c.name} {c.cnpj ? `- ${c.cnpj}` : ''} {c.active === false ? '(desativada)' : ''}
								</span>
							</li>
						))}
					</ul>
				</div>
			</div>
		</div>
	);
};

export default AdminPage;
