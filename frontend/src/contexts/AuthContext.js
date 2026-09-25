import React, { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin, register as apiRegister, getMe } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }

    getMe()
      .then(({ data }) => setUser(data.user))
      .catch(() => { localStorage.removeItem('token'); })
      .finally(() => setLoading(false));
  }, []);

  const login = async (credentials) => {
    const { data } = await apiLogin(credentials);
    localStorage.setItem('token', data.token);
    setUser(data.user);
    return data;
  };

  const register = async (userData) => {
    const { data } = await apiRegister(userData);
    localStorage.setItem('token', data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const updateLocalUser = (patch) => setUser((u) => ({ ...u, ...patch }));

  const isCM = () => user?.role === 'cm';
  const isAdmin = () => ['cm', 'super_admin'].includes(user?.role);
  const isEmployee = () => ['employee', 'department_head'].includes(user?.role);
  const isCitizen = () => user?.role === 'citizen';

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateLocalUser, isCM, isAdmin, isEmployee, isCitizen }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
