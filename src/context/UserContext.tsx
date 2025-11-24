"use client";
import { createContext, useContext, ReactNode, useState } from "react";

export interface User {
    id: string;
    firstname: string;
    lastname: string;
    email: string;
    createdAt: string;
    globalRole?: "SUPERADMIN" | null;
}

interface UserContextType {
    user: User | null;
    setUser: (user: User | null) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children, initialUser = null }: { children: ReactNode; initialUser?: User | null }) => {
    const [user, setUser] = useState<User | null>(initialUser);

    return <UserContext.Provider value={{ user, setUser }}>{children}</UserContext.Provider>;
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) throw new Error("useUser must be used within UserProvider");
    return context;
};