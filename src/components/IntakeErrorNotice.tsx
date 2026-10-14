import { MessageCircle } from 'lucide-react';

export default function IntakeErrorNotice({ message }: { message: string }) {
  const canContactAdmin = /administrador/i.test(message);
  const preparedMessage = message.match(/«([^»]+)»/)?.[1]
    || `Hola, necesito ayuda con Pendientes. El sistema muestra: ${message}`;
  const whatsappUrl = `https://wa.me/573122827999?text=${encodeURIComponent(preparedMessage)}`;

  return <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4">
    <p role="alert" className="text-sm leading-relaxed text-amber-950 [overflow-wrap:anywhere]">{message}</p>
    {canContactAdmin && <div className="mt-3">
      <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">
        <MessageCircle size={18} aria-hidden="true" />
        Enviar al administrador por WhatsApp
      </a>
      <p className="mt-2 text-xs text-slate-600">Se abrirá WhatsApp con el mensaje preparado. Revísalo y presiona Enviar.</p>
    </div>}
  </div>;
}
