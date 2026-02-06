
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

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/auditoria');
            const json = await res.json();
            if (json.error) throw new Error(json.error);
            setLogs(json.data || []);
        } catch (e: any) {
            console.error(e);
            setError(e.message || 'Error cargando logs. ¿Existe la tabla auditoria_accesos?');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        // Auto refresh cada 30s
        const interval = setInterval(fetchLogs, 30000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="min-h-screen bg-neutral-950 text-emerald-500 p-6 font-mono selection:bg-emerald-900 selection:text-white">
            <div className="max-w-7xl mx-auto">
                <header className="flex items-center justify-between mb-8 border-b border-emerald-900/50 pb-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-emerald-400">
                            <span className="mr-2 opacity-50">///</span>
                            SYSTEM ACCESS LOGS
                        </h1>
                        <p className="text-xs text-emerald-700 mt-1 uppercase tracking-widest">
                            Top Secret • Authorized Personnel Only
                        </p>
                    </div>
                    <button
                        onClick={fetchLogs}
                        disabled={loading}
                        className="px-4 py-2 text-xs border border-emerald-800 hover:bg-emerald-900/30 transition rounded text-emerald-400 disabled:opacity-50"
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
            </div>
        </div>
    );
}
