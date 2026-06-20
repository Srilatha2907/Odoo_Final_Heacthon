import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Mail, Eye, EyeOff, ArrowLeft, AlertCircle } from 'lucide-react';
import { useAuth, ROLE_HOME } from '../context/AuthContext';

const ROLES = [
  { value: 'ADMIN',         emoji: '👑', name: 'Admin',              desc: 'Full access' },
  { value: 'SALES',         emoji: '🛒', name: 'Sales Manager',       desc: 'Sales orders' },
  { value: 'PURCHASE',      emoji: '🚛', name: 'Purchase Manager',    desc: 'Purchase orders' },
  { value: 'MANUFACTURING', emoji: '🏭', name: 'Mfg. Manager',        desc: 'Manufacturing' },
  { value: 'INVENTORY',     emoji: '📦', name: 'Inventory Manager',   desc: 'Stock & ledger' },
  { value: 'OWNER',         emoji: '📈', name: 'Business Owner',      desc: 'Reports & overview' },
];

const DEMO = {
  ADMIN:         { email: 'admin@shivfurniture.com',    password: 'admin123' },
  OWNER:         { email: 'owner@shivfurniture.com',    password: 'owner123' },
  SALES:         { email: 'sales@shivfurniture.com',    password: 'sales123' },
  PURCHASE:      { email: 'purchase@shivfurniture.com', password: 'purchase123' },
  MANUFACTURING: { email: 'mfg@shivfurniture.com',      password: 'mfg123' },
  INVENTORY:     { email: 'inventory@shivfurniture.com',password: 'inv123' },
};

export default function LoginPage() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate   = useNavigate();
  const location   = useLocation();
  const from       = location.state?.from || null;

  const [step, setStep]               = useState('role');
  const [selectedRole, setSelectedRole] = useState('');
  const [form, setForm]               = useState({ email: '', password: '', rememberMe: false });
  const [showPass, setShowPass]       = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(from || ROLE_HOME[user.role] || '/dashboard', { replace: true });
    }
  }, [isAuthenticated, user, navigate, from]);

  const selectedInfo = ROLES.find(r => r.value === selectedRole);

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setForm(f => ({ ...f, email: '', password: '' })); // Leave fields empty!
    setError('');
  };

  const handleContinue = () => {
    if (!selectedRole) { setError('Please select your role'); return; }
    setStep('credentials');
    setError('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { setError('Email and password are required'); return; }
    setLoading(true);
    setError('');
    try {
      const user = await login({ email: form.email, password: form.password, rememberMe: form.rememberMe });
      if (user.role !== selectedRole) {
        setError(`This account is not a ${selectedInfo?.name}. Please check your credentials.`);
        return;
      }
      navigate(from || ROLE_HOME[user.role] || '/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <motion.div className="login-card"
        initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 26 }}>

          <div className="login-logo">
            <motion.div className="logo-box" animate={{ rotateY: [0, 8, -8, 0] }} transition={{ duration: 5, repeat: Infinity }}>🪑</motion.div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>Welcome Back</h1>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Sign in to Shiv Furniture ERP</p>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div className="toast-item toast-error" style={{ marginBottom: 16 }}
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <AlertCircle size={14} /> {error}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {/* STEP 1: Role Selection */}
            {step === 'role' && (
              <motion.div key="role" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="form-label" style={{ marginBottom: 10 }}>Select Your Role</div>
                <div className="role-selector">
                  {ROLES.map(r => (
                    <motion.div key={r.value}
                      className={`role-option ${selectedRole === r.value ? 'selected' : ''}`}
                      onClick={() => handleRoleSelect(r.value)}
                      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                      <div className="r-emoji">{r.emoji}</div>
                      <div className="r-name">{r.name}</div>
                      <div className="r-desc">{r.desc}</div>
                    </motion.div>
                  ))}
                </div>
                <motion.button className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: 10 }}
                  onClick={handleContinue} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                  Continue →
                </motion.button>
                <p style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: 'var(--text-muted)', display: 'flex', justifyContent: 'center', gap: 12 }}>
                  <Link to="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>← Back to Home</Link>
                  <span>·</span>
                  <Link to="/signup" style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 600 }}>Create Account</Link>
                </p>
              </motion.div>
            )}

            {/* STEP 2: Credentials */}
            {step === 'credentials' && (
              <motion.div key="creds" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                {/* Selected role chip */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.25)', borderRadius: 10, marginBottom: 20 }}>
                  <span style={{ fontSize: 20 }}>{selectedInfo?.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-teal)' }}>{selectedInfo?.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{selectedInfo?.desc}</div>
                  </div>
                  <button onClick={() => { setStep('role'); setError(''); }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <ArrowLeft size={14} />
                  </button>
                </div>

                <form onSubmit={handleLogin}>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <label className="form-label" style={{ margin: 0 }}>Password</label>
                      <Link to="/forgot-password" style={{ fontSize: 11, color: 'var(--accent-teal)', textDecoration: 'none' }}>Forgot password?</Link>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <Lock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input className="form-input" type={showPass ? 'text' : 'password'}
                        placeholder="Enter password" value={form.password}
                        onChange={e => setForm({ ...form, password: e.target.value })}
                        style={{ paddingLeft: 36, paddingRight: 38 }} required />
                      <button type="button" onClick={() => setShowPass(!showPass)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Remember Me */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                    <input id="remember" type="checkbox" checked={form.rememberMe}
                      onChange={e => setForm({ ...form, rememberMe: e.target.checked })}
                      style={{ width: 14, height: 14, accentColor: 'var(--accent-teal)', cursor: 'pointer' }} />
                    <label htmlFor="remember" style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      Remember me for 7 days
                    </label>
                  </div>

                  <motion.button type="submit" className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                    disabled={loading} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                    {loading
                      ? <><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block', marginRight: 8 }} />Signing in...</>
                      : `🔐 Sign In as ${selectedInfo?.name}`}
                  </motion.button>
                </form>

                <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
                  Don't have an account? <Link to="/signup" style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 600 }}>Sign Up</Link>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
    </div>
  );
}
