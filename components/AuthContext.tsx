import React, { createContext, useContext } from 'react';
import type { AuthContextType } from '../types';

/**
 * The open-source BYOK build has no accounts, no hosted backend and no admin users.
 * Everything runs in the browser with the user's own API keys, and the library is
 * kept in localStorage. This provider keeps the existing component API intact.
 */
const noAccounts = async () => {
    throw new Error('Accounts are not available in the open-source build. Your work is saved in this browser.');
};

const value: AuthContextType = {
    user: null,
    loading: false,
    isAdmin: false,
    signInGoogle: noAccounts,
    signInEmailPassword: noAccounts,
    signUpEmail: noAccounts,
    signInWithOtp: noAccounts,
    signOut: async () => { },
    updateName: noAccounts,
    error: null,
    configError: null,
    features: {
        requireProForWav: false,
        requireProForVideo: false,
        videoCreditCost: 0,
        stemCreditCost: 0,
    },
};

const AuthContext = createContext<AuthContextType>(value);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
);
