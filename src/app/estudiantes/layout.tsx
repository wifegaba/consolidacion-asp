'use client';

import type { ReactNode } from 'react';
import MenuEstudiantes from '@/components/MenuEstudiantes';
import { ToastProvider } from '@/components/ToastProvider';
import './estudiantes-layout.css';

export default function EstudiantesLayout({ children }: { children: ReactNode }) {
    return (
        <div className="est-wrapper">
            <MenuEstudiantes />
            <ToastProvider>
                <main className="est-main">
                    <div className="est-card">
                        {children}
                    </div>
                </main>
            </ToastProvider>
        </div>
    );
}
