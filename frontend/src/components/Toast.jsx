import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react';

const ICONS = { success: <CheckCircle size={15} />, error: <XCircle size={15} />, info: <Info size={15} />, warning: <AlertTriangle size={15} /> };

export default function Toast({ toasts = [] }) {
  return (
    <div className="toast">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div key={t.id} className={`toast-item toast-${t.type}`}
            initial={{ opacity: 0, x: 60, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}>
            {ICONS[t.type]} {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
