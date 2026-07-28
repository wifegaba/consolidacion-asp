
'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

type Log = {
    id: number;
    nombre: string;
    cedula: string;
    fecha_acceso: string;
    rol_usado: string;
    user_agent: string;
    servidor_id: string;
};

export default function AuditoriaPage() {
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const fetchLogs = async (page = 1) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/auditoria?page=${page}&limit=10`);
            const json = await res.json();

            if (json.error) throw new Error(json.error);

            // Si la API devuelve el formato nuevo con meta:
            if (json.meta) {
                setLogs(json.data || []);
                setTotalPages(json.meta.totalPages);
                setCurrentPage(json.meta.page);
            } else {
                // Fallback para formato antiguo
                setLogs(json.data || []);
            }
        } catch (e: any) {
            console.error(e);
            setError(e.message || 'Error cargando logs. ¿Existe la tabla auditoria_accesos?');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs(1);
        // Auto refresh cada 30s
        const interval = setInterval(() => fetchLogs(currentPage), 30000); // Refresca página actual
        return () => clearInterval(interval);
    }, [currentPage]); // Re-ejecutar si cambia página

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            fetchLogs(newPage);
        }
    };

    return (
        <div className="min-h-screen bg-neutral-950 text-emerald-500 p-6 font-mono selection:bg-emerald-900 selection:text-white">
            <div className="max-w-7xl mx-auto">
                <header className="flex items-center justify-between mb-8 border-b border-green-900/50 pb-4">
                    <div>
                        <h1 className="text-4xl font-mono text-green-400 font-bold tracking-tighter mb-2 glitch-text">
                            /// AUDITORIA CRM MINISTERIAL
                        </h1>
                        <div className="flex items-center gap-2 text-xs font-mono text-green-700 tracking-widest">
                            <span className="animate-pulse">●</span>
                            <span>TOP SECRET</span>
                            <span>•</span>
                            <span>AUTHORIZED PERSONNEL ONLY</span>
                        </div>
                    </div>
                    <button
                        onClick={() => fetchLogs(currentPage)}
                        disabled={loading}
                        className="px-4 py-2 border border-green-800 text-green-500 font-mono text-sm hover:bg-green-900/20 active:bg-green-900/40 transition-colors uppercase tracking-wider disabled:opacity-50"
                    >
                        {loading ? 'SYNCING...' : 'REFRESH_DATA'}
                    </button>
                </header>

                {error && (
                    <div className="bg-red-950/30 border border-red-900 text-red-400 p-4 mb-6 rounded text-sm">
                        [ERROR_CRITICAL]: {error}
                        <br />
                        <span className="text-xs opacity-70">Hint: Asegúrate de ejecutar el script SQL para crear la tabla 'auditoria_accesos'.</span>
                    </div>
                )}

                <div className="overflow-x-auto border border-emerald-900/50 rounded bg-neutral-900/50 shadow-2xl">
                    <table className="w-full text-xs md:text-sm text-left">
                        <thead className="text-xs uppercase bg-emerald-950/20 text-emerald-600 font-bold tracking-wider">
                            <tr>
                                <th className="px-6 py-3 border-b border-emerald-900">Timestamp</th>
                                <th className="px-6 py-3 border-b border-emerald-900">User / ID</th>
                                <th className="px-6 py-3 border-b border-emerald-900">Role Identity</th>
                                <th className="px-6 py-3 border-b border-emerald-900">Device Signature</th>
                                <th className="px-6 py-3 border-b border-emerald-900 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-emerald-900/30">
                            {loading && logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-emerald-800 animate-pulse">
                                        [ESTABLISHING_UPLINK...]
                                    </td>
                                </tr>
                            ) : logs.map((log) => (
                                <motion.tr
                                    key={log.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="hover:bg-emerald-900/10 transition-colors"
                                >
                                    <td className="px-6 py-3 whitespace-nowrap font-mono text-emerald-300">
                                        {new Date(log.fecha_acceso).toLocaleString('es-CO')}
                                    </td>
                                    <td className="px-6 py-3">
                                        <div className="font-bold text-emerald-200">{log.nombre || 'Unknown'}</div>
                                        <div className="text-xs text-emerald-700 font-mono">{log.cedula}</div>
                                    </td>
                                    <td className="px-6 py-3">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-950 text-emerald-400 border border-emerald-900">
                                            {log.rol_usado}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 max-w-[200px] truncate text-emerald-600" title={log.user_agent}>
                                        {log.user_agent}
                                    </td>
                                    <td className="px-6 py-3 text-right">
                                        <span className="text-emerald-500 font-bold text-[10px]">
                                            [GRANTED]
                                        </span>
                                    </td>
                                </motion.tr>
                            ))}

                            {!loading && logs.length === 0 && !error && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-emerald-800">
                                        [NO_DATA_FOUND]
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="mt-6 flex justify-between items-center text-xs font-mono select-none">
                    <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1 || loading}
                        className="px-4 py-2 border border-green-900 text-green-600 hover:text-green-400 hover:border-green-500 disabled:opacity-30 disabled:hover:text-green-600 disabled:hover:border-green-900 transition-colors uppercase"
                    >
                        &lt; ANTERIOR
                    </button>

                    <div className="text-green-800 tracking-widest">
                        [ PAGINA <span className="text-green-400">{currentPage}</span> DE <span className="text-green-400">{totalPages || 1}</span> ]
                    </div>

                    <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage >= totalPages || loading}
                        className="px-4 py-2 border border-green-900 text-green-600 hover:text-green-400 hover:border-green-500 disabled:opacity-30 disabled:hover:text-green-600 disabled:hover:border-green-900 transition-colors uppercase"
                    >
                        SIGUIENTE &gt;
                    </button>
                </div>
            </div>
        </div>
    );
}
