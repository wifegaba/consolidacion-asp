'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, User, BookOpen, X, CheckCircle, Calendar } from 'lucide-react';

interface PendingStudent {
    id: string;
    nombre: string;
    foto_path: string | null;
    missedClasses: number[];
    missedDates?: string[];
}

interface PendingStudentsModalProps {
    isOpen: boolean;
    students: PendingStudent[];
    fotoUrls: Record<string, string>;
    onClose: () => void;
    onMarkAsLeveled?: (inscripcionId: string, claseNumero: number) => Promise<void>;
}

export function PendingStudentsModal({
    isOpen,
    students,
    fotoUrls,
    onClose,
    onMarkAsLeveled
}: PendingStudentsModalProps) {
    const [levelingKey, setLevelingKey] = useState<string | null>(null);
    const [confirmDialog, setConfirmDialog] = useState<{ studentName: string; claseNum: number; studentId: string } | null>(null);

    if (!isOpen) return null;

    const generateAvatar = (name: string) => {
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=200`;
    };

    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('es-CO', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        } catch {
            return '';
        }
    };

    const handleConfirmLevel = async () => {
        if (!confirmDialog || !onMarkAsLeveled) return;

        const key = `${confirmDialog.studentId}-${confirmDialog.claseNum}`;
        setLevelingKey(key);
        setConfirmDialog(null);

        try {
            await onMarkAsLeveled(confirmDialog.studentId, confirmDialog.claseNum);
        } finally {
            setLevelingKey(null);
        }
    };

    // Flatten students with their individual classes for display
    const pendingEntries: Array<{ student: PendingStudent; classNum: number; classDate?: string; key: string }> = [];
    students.forEach(student => {
        student.missedClasses.forEach((classNum, idx) => {
            pendingEntries.push({
                student,
                classNum,
                classDate: student.missedDates?.[idx],
                key: `${student.id}-${classNum}`
            });
        });
    });

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        transition={{ type: 'spring', duration: 0.5, bounce: 0.3 }}
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-3xl bg-gradient-to-br from-white via-orange-50/30 to-red-50/40 shadow-[0_20px_70px_-10px_rgba(0,0,0,0.3)] ring-1 ring-white/60 backdrop-blur-xl"
                    >
                        {/* Decorative Background Elements */}
                        <div className="pointer-events-none absolute -top-20 -right-20 h-40 w-40 rounded-full bg-gradient-to-br from-orange-400/20 to-red-500/20 blur-3xl" />
                        <div className="pointer-events-none absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-gradient-to-tr from-amber-400/20 to-orange-500/20 blur-3xl" />

                        {/* Header */}
                        <div className="relative border-b border-orange-200/50 bg-white/50 backdrop-blur-md px-6 py-5">
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 p-2 rounded-full bg-white/80 text-gray-600 hover:bg-white hover:text-gray-900 transition-all active:scale-95"
                            >
                                <X size={20} />
                            </button>

                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-full bg-gradient-to-br from-orange-400 via-red-500 to-orange-600 shadow-lg">
                                    <AlertTriangle className="h-6 w-6 text-white" strokeWidth={2.5} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black tracking-tight text-gray-900">
                                        Pendientes por Nivelar
                                    </h2>
                                    <p className="text-sm text-gray-600 mt-0.5">
                                        {pendingEntries.length} {pendingEntries.length === 1 ? 'clase pendiente' : 'clases pendientes'} de nivelación
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Entries List - Each class as separate entry */}
                        <div className="relative overflow-y-auto max-h-[calc(85vh-180px)] p-6 space-y-3">
                            {pendingEntries.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
                                    <p className="text-lg font-medium">¡No hay pendientes!</p>
                                    <p className="text-sm">Todos los estudiantes están nivelados.</p>
                                </div>
                            ) : (
                                pendingEntries.map(({ student, classNum, classDate, key }, index) => {
                                    const photoUrl = student.foto_path
                                        ? fotoUrls[student.foto_path] || generateAvatar(student.nombre)
                                        : generateAvatar(student.nombre);
                                    const isLeveling = levelingKey === key;

                                    return (
                                        <motion.div
                                            key={key}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.03 }}
                                            className="relative group rounded-2xl bg-gradient-to-br from-white/90 to-orange-50/60 border border-orange-200/40 p-4 shadow-sm hover:shadow-md transition-all"
                                        >
                                            <div className="flex items-center gap-4">
                                                {/* Student Photo */}
                                                <div className="flex-shrink-0">
                                                    <div className="h-12 w-12 rounded-full ring-2 ring-orange-200/50 overflow-hidden shadow-sm">
                                                        <img
                                                            src={photoUrl}
                                                            alt={student.nombre}
                                                            className="h-full w-full object-cover"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Info */}
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-bold text-gray-900 text-sm truncate">
                                                        {student.nombre}
                                                    </h3>
                                                    <div className="flex items-center gap-3 mt-1">
                                                        <span className="inline-flex items-center gap-1 text-red-700 font-semibold text-xs">
                                                            <BookOpen className="h-3.5 w-3.5" />
                                                            Clase #{classNum}
                                                        </span>
                                                        {classDate && (
                                                            <span className="inline-flex items-center gap-1 text-gray-500 text-xs">
                                                                <Calendar className="h-3 w-3" />
                                                                {formatDate(classDate)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Level Button */}
                                                {onMarkAsLeveled && (
                                                    <button
                                                        onClick={() => setConfirmDialog({
                                                            studentName: student.nombre,
                                                            claseNum: classNum,
                                                            studentId: student.id
                                                        })}
                                                        disabled={isLeveling}
                                                        className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 text-white text-xs font-bold shadow-md hover:from-emerald-600 hover:to-green-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        <CheckCircle className="h-4 w-4" />
                                                        {isLeveling ? 'Nivelando...' : 'Nivelar'}
                                                    </button>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer */}
                        <div className="relative border-t border-orange-200/50 bg-white/50 backdrop-blur-md px-6 py-4">
                            <button
                                onClick={onClose}
                                className="w-full rounded-xl bg-gradient-to-r from-orange-500 via-red-500 to-orange-500 px-4 py-3 font-bold text-white shadow-[0_4px_20px_rgba(249,115,22,0.4)] ring-1 ring-orange-400/20 transition-all hover:from-orange-600 hover:via-red-600 hover:to-orange-600 hover:shadow-[0_6px_30px_rgba(249,115,22,0.5)] active:scale-95"
                            >
                                Cerrar
                            </button>
                        </div>

                        {/* Bottom Decorative Line */}
                        <div className="h-1.5 w-full bg-gradient-to-r from-orange-400 via-red-500 to-orange-400" />
                    </motion.div>

                    {/* Confirmation Dialog */}
                    <AnimatePresence>
                        {confirmDialog && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
                                onClick={() => setConfirmDialog(null)}
                            >
                                <motion.div
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.95, opacity: 0 }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl ring-1 ring-black/10 overflow-hidden"
                                >
                                    <div className="p-6 text-center">
                                        <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center">
                                            <CheckCircle className="h-8 w-8 text-emerald-600" />
                                        </div>
                                        <h3 className="text-lg font-bold text-gray-900 mb-2">
                                            Confirmar Nivelación
                                        </h3>
                                        <p className="text-sm text-gray-600">
                                            ¿Confirma que <span className="font-semibold text-gray-800">{confirmDialog.studentName}</span> ha completado satisfactoriamente la nivelación de la <span className="font-semibold text-emerald-700">Clase #{confirmDialog.claseNum}</span>?
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 border-t border-gray-100">
                                        <button
                                            onClick={() => setConfirmDialog(null)}
                                            className="px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={handleConfirmLevel}
                                            className="px-4 py-3 text-sm font-semibold text-emerald-600 hover:bg-emerald-50 border-l border-gray-100 transition-colors"
                                        >
                                            Sí, Nivelar
                                        </button>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
