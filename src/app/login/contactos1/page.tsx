import { Suspense } from "react";
import Contactos1Client from "./Contactos1Client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default function Page() {
    return (
        <Suspense fallback={<Fallback />}>
            <Contactos1Client />
        </Suspense>
    );
}

function Fallback() {
    return (
        <main className="min-h-[100dvh] grid place-items-center">
            <div>Cargando…</div>
        </main>
    );
}
