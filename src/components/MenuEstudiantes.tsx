// src/components/MenuEstudiantes.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './MenuEstudiantes.css';

export default function MenuEstudiantes() {
    const path = usePathname();
    const items = [
        { label: 'Crear Estudiante', href: '/estudiantes' },
        { label: 'Consultar Estudiante', href: '/estudiantes/consultar' },
        { label: 'Asignar Notas', href: '/estudiantes/asignar-notas' },
        { label: 'Salir', href: '/' },
    ];

    return (
        <aside className="menu-estudiantes__sidebar">
            {items.map(({ label, href }) => {
                const active = path === href;
                const itemClass = active
                    ? 'menu-estudiantes__item menu-estudiantes__item--active'
                    : 'menu-estudiantes__item';

                return (
                    <Link key={href} href={href} className={itemClass}>
                        {label}
                    </Link>
                );
            })}
        </aside>
    );
}
