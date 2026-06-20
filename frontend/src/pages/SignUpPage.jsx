import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Mail, User, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth, ROLE_HOME } from '../context/AuthContext';
import api from '../api';

const ROLES = [
  { value: 'SALES',         emoji: '🛒', name: 'Sales Manager' },
  { value: 'PURCHASE',      emoji: '🚛', name: 'Purchase Manager' },
  { value: 'MANUFACTURING', emoji: '🏭', name: 'Manufacturing Manager' },
  { value: 'INVENTORY',     emoji: '📦', name: 'Inventory Manager' },
  { value: 'OWNER',         emoji: '📈', name: 'Business Owner' },
  { value: 'ADMIN',         emoji: '👑', name: 'Admin (Full Access)' }
];

export default function SignUpPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const [form, setForm] = useState({ name: '', email: '', password: '', role: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(ROLE_HOME[user.role] || '/dashboard', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password || !form.role) {
      setError('All fields are required');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await api.post('/auth/register', {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role
      });
      setSuccess('Account created successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please check your inputs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page" style={{ padding: '40px 20px' }}>
      <motion.div className="login-card" style={{ maxWidth: 420 }}
        initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 26 }}>

        <div className="login-logo">
          <div className="logo-box">🪑</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>Create Account</h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Register a new user in Shiv Furniture ERP</p>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div className="toast-item toast-error" style={{ marginBottom: 16, minWidth: 'auto', width: '100%' }}
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <AlertCircle size={14} /> {error}
            </motion.div>
          )}
          {success && (
            <motion.div className="toast-item toast-success" style={{ marginBottom: 16, minWidth: 'auto', width: '100%' }}
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <CheckCircle2 size={14} /> {success}
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <div style={{ position: 'relative' }}>
              <User size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="form-input" type="text" placeholder="Enter full name"
                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                style={{ paddingLeft: 36 }} required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="form-input" type="email" placeholder="your@email.com"
                value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                style={{ paddingLeft: 36 }} required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="form-input" type={showPass ? 'text' : 'password'}
                placeholder="Create password" value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                style={{ paddingLeft: 36, paddingRight: 38 }} required />
              <button type="button" onClick={() => setShowPass(!showPass)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">User Role</label>
            <select className="form-select" value={form.role}
              onChange={e => setForm({ ...form, role: e.target.value })} required>
              <option value="" disabled>Select role...</option>
              {ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.emoji} {r.name}</option>
              ))}
            </select>
          </div>

          <motion.button type="submit" className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: 8 }}
            disabled={loading} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
            {loading ? 'Creating Account...' : '🚀 Sign Up'}
          </motion.button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--text-secondary)' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 600 }}>Sign In</Link>
        </p>
      </motion.div>
    </div>
  );
}
