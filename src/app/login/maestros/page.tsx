import { Suspense } from "react";
import MaestrosClient from "./MaestrosClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default function Page() {
    return (
        <Suspense fallback={<Fallback />}>
            <MaestrosClient />
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
