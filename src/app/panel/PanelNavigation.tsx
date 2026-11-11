'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Heart, Home, Leaf, User, Users } from 'lucide-react';

const destinations = [
    { href: '/panel', label: 'Dashboard', Icon: Home },
    { href: '/panel/contactos', label: 'Nueva Alma', Icon: User },
    { href: '/panel/servidores', label: 'Servidores', Icon: Users },
    { href: '/panel/semillas', label: 'Semillas', Icon: Leaf },
    { href: '/panel/devocionales', label: 'Devocionales', Icon: BookOpen },
    { href: '/panel/restauracion', label: 'Restauración', Icon: Heart },
];

export default function PanelNavigation() {
    const pathname = usePathname();
    return destinations.map(({ href, label, Icon }) => {
        const active = pathname === href || (href !== '/panel' && pathname?.startsWith(`${href}/`));
        return <Link key={href} href={href} className="nav-item" title={label} aria-label={label} aria-current={active ? 'page' : undefined}>
            <Icon size={17} strokeWidth={1.75} className="nav-icon" aria-hidden="true" />
            <span className="nav-text">{label}</span>
        </Link>;
    });
}
