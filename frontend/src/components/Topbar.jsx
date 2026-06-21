import { RefreshCw, LogOut, Menu } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const ROLE_INFO = {
  ADMIN:         { label: 'Administrator',    color: '#f59e0b' },
  OWNER:         { label: 'Business Owner',   color: '#84cc16' },
  SALES:         { label: 'Sales Manager',    color: '#14b8a6' },
  PURCHASE:      { label: 'Purchase Manager', color: '#06b6d4' },
  MANUFACTURING: { label: 'Mfg. Manager',     color: '#8b5cf6' },
  INVENTORY:     { label: 'Inv. Manager',     color: '#10b981' },
};

export default function Topbar({ title, subtitle, onRefresh, toggleSidebar }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const role = user?.role || 'ADMIN';
  const info = ROLE_INFO[role] || { label: role, color: 'var(--accent-teal)' };

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <header className="topbar">
      <div className="topbar-left" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={toggleSidebar} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
          <Menu size={24} />
        </button>
        <h2 style={{ fontSize: 20, color: 'var(--text-primary)', margin: 0, fontWeight: 800, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>Master Menu</h2>
      </div>

      <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ background: 'var(--accent-teal)', color: '#fff', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, boxShadow: '0 4px 12px rgba(104, 213, 193, 0.3)' }}>🪑</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: 16, margin: 0, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>Shiv Furniture Works</h2>
          <span style={{ fontSize: 11, color: 'var(--accent-teal)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Mini ERP System</span>
        </div>
      </div>
      <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {role && <span className="role-badge">{info.label}</span>}
        
        {onRefresh && (
          <button className="topbar-btn" onClick={onRefresh} title="Refresh"><RefreshCw size={15} /></button>
        )}

        <div style={{ width: 1, height: 24, background: 'var(--glass-border)' }}></div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="user-avatar" style={{ background: `linear-gradient(135deg, ${info.color}, var(--primary))`, width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            {user?.name?.charAt(0)?.toUpperCase() || 'A'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', marginRight: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{user?.name || 'Guest'}</span>
          </div>
          <motion.button onClick={handleLogout} title="Logout"
            style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--accent-red)', cursor: 'pointer', padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            whileHover={{ scale: 1.05, background: 'rgba(239, 68, 68, 0.15)' }}>
            <LogOut size={15} />
          </motion.button>
        </div>

      </div>
    </header>
  );
}
