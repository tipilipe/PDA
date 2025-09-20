import React from 'react';
import DashboardPage from './DashboardPage';

const dashboardAba = {
  key: 'dashboard',
  label: 'Dashboard',
  path: '/dashboard',
  element: <DashboardPage />, // JSX válido
  adminOnly: false
};

export default dashboardAba;
