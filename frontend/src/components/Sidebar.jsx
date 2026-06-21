import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutDashboard, Package, ShoppingCart, Truck, Factory, BarChart3, LogOut, Layers, Users, Menu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/dashboard',     icon: <LayoutDashboard size={16}/>, label: 'Dashboard',       roles: ['ADMIN', 'OWNER'] },
  { to: '/products',      icon: <Package size={16}/>,         label: 'Products',         roles: ['ADMIN', 'OWNER'] },
  { to: '/sales',         icon: <ShoppingCart size={16}/>,    label: 'Sales Orders',     roles: ['ADMIN', 'SALES'] },
  { to: '/purchase',      icon: <Truck size={16}/>,           label: 'Purchase Orders',  roles: ['ADMIN', 'PURCHASE'] },
  { to: '/manufacturing', icon: <Factory size={16}/>,         label: 'Manufacturing',    roles: ['ADMIN', 'MANUFACTURING'] },
  { to: '/inventory',     icon: <Layers size={16}/>,          label: 'Inventory',        roles: ['ADMIN', 'INVENTORY'] },
  { to: '/reports',       icon: <BarChart3 size={16}/>,       label: 'Reports',          roles: ['ADMIN', 'OWNER', 'SALES', 'PURCHASE', 'MANUFACTURING', 'INVENTORY'] },
  { to: '/users',         icon: <Users size={16}/>,           label: 'User Management',  roles: ['ADMIN'] },
];

const ROLE_INFO = {
  ADMIN:         { label: 'Administrator',    emoji: '👑', color: '#f59e0b' },
  OWNER:         { label: 'Business Owner',   emoji: '📈', color: '#84cc16' },
  SALES:         { label: 'Sales Manager',    emoji: '🛒', color: '#14b8a6' },
  PURCHASE:      { label: 'Purchase Manager', emoji: '🚛', color: '#06b6d4' },
  MANUFACTURING: { label: 'Mfg. Manager',     emoji: '🏭', color: '#8b5cf6' },
  INVENTORY:     { label: 'Inv. Manager',     emoji: '📦', color: '#10b981' },
};

export default function Sidebar({ isOpen, toggleSidebar }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const role     = user?.role || 'ADMIN';
  const info     = ROLE_INFO[role] || { label: role, emoji: '👤', color: 'var(--accent-teal)' };
  const visible  = NAV.filter(n => n.roles.includes(role));

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <motion.aside className="sidebar"
      initial={false} animate={{ width: isOpen ? 260 : 80 }}
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      style={{ overflowX: 'hidden' }}>



      {/* Role badge */}
      <div style={{ padding: isOpen ? '10px 16px' : '10px 8px', borderBottom: '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: isOpen ? 'flex-start' : 'center', gap: 8, padding: isOpen ? '8px 12px' : '8px 0', borderRadius: 8, background: `${info.color}15`, border: `1px solid ${info.color}30` }}>
          <span style={{ fontSize: 16 }}>{info.emoji}</span>
          {isOpen && (
            <div style={{ whiteSpace: 'nowrap' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: info.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{info.label}</div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav" style={{ padding: isOpen ? '16px 12px' : '16px 8px' }}>
        {isOpen && <div className="nav-section-label">Navigation</div>}
        {visible.map(item => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ justifyContent: isOpen ? 'flex-start' : 'center', padding: isOpen ? '10px 12px' : '10px 0' }} title={!isOpen ? item.label : undefined}>
            <span className="nav-icon">{item.icon}</span>
            {isOpen && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
          </NavLink>
        ))}
      </nav>


    </motion.aside>
  );
}
