import { Suspense } from "react";
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import BienvenidaClient from "./BienvenidaClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default function Page() {
    const cookieStore = cookies();
    const isProd = process.env.NODE_ENV === 'production';
    const COOKIE_NAME = isProd ? '__Host-session' : 'session';
    const token = cookieStore.get(COOKIE_NAME)?.value;

    let cedula: string | undefined = undefined;
    if (token && process.env.JWT_SECRET) {
        try {
            const payload = jwt.verify(token, process.env.JWT_SECRET) as any;
            cedula = String(payload?.cedula || '');
        } catch {}
    }
    return (
        <Suspense fallback={<Fallback />}>
            <BienvenidaClient cedula={cedula} />
        </Suspense>
    );
}

function Fallback() {
    return (
        <main className="min-h-screen grid place-items-center bg-gradient-to-br from-gray-50 via-white to-blue-100">
            <div className="bg-white/40 backdrop-blur-xl p-8 rounded-2xl shadow-xl">
                Cargando…
            </div>
        </main>
    );
}
