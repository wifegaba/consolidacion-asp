import { Suspense } from "react";
import BienvenidaClient from "./BienvenidaClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default function Page() {
    return (
        <Suspense fallback={<Fallback />}>
            <BienvenidaClient />
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
