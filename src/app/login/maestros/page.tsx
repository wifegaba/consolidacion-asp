import { Suspense } from "react";
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import MaestrosClient from "./MaestrosClient";
import "../../panel/contactos/contactos.css";
import "../../panel/servidores/servidores.css";

import PremiumLoader from "../../components/PremiumLoader";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function Page() {
    const cookieStore = await cookies();
    // Lee ambas variantes por robustez, sin depender estrictamente de NODE_ENV
    const token = cookieStore.get('__Host-session')?.value ?? cookieStore.get('session')?.value;

    let cedula: string | undefined = undefined;
    if (token && process.env.JWT_SECRET) {
        try {
            const payload = jwt.verify(token, process.env.JWT_SECRET) as any;
            cedula = String(payload?.cedula || '');
        } catch { }
    }
    return (
        <Suspense fallback={<Fallback />}>
            <MaestrosClient cedula={cedula} />
        </Suspense>
    );
}

function Fallback() {
    return (
        <PremiumLoader fullscreen text="Cargando panel..." />
    );
}
