// src/components/MenuEstudiantes.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { UserPlus, Search, NotebookPen, LogOut } from 'lucide-react';
import './MenuEstudiantes.css';

type Item = {
    label: string;
    href: string;
    Icon: LucideIcon;
};

export default function MenuEstudiantes() {
    const path = usePathname();

    const items: Item[] = [
        { label: 'Crear Estudiante', href: '/estudiantes',            Icon: UserPlus },
        { label: 'Asignar Notas', href: '/estudiantes/asignar-notas', Icon: NotebookPen },
        { label: 'Salir', href: '/', Icon: LogOut },
    ];

    return (
        <aside className="menu-estudiantes__sidebar">
            {items.map(({ label, href, Icon }) => {
                const active = path === href;
                const itemClass = active
                    ? 'menu-estudiantes__item menu-estudiantes__item--active'
                    : 'menu-estudiantes__item';

                return (
                    <Link
                        key={href}
                        href={href}
                        className={itemClass}
                        aria-current={active ? 'page' : undefined}
                    >
                        <Icon className="menu-estudiantes__icon" aria-hidden />
                        <span className="menu-estudiantes__label">{label}</span>
                    </Link>
                );
            })}
        </aside>
    );
}
