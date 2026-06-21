import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, ChevronDown, ChevronUp, CheckCircle2, XCircle, Truck, Clock, ShoppingCart, TrendingUp, AlertCircle, Save, X } from 'lucide-react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';

const STATUS_COLORS = { DRAFT:'#8b5cf6', CONFIRMED:'#14b8a6', DELIVERED:'#10b981', CANCELLED:'#ef4444' };
const ttStyle = { background:'#071412', border:'1px solid rgba(20,184,166,0.2)', borderRadius:8, color:'#e2fef8', fontSize:12 };

export default function SalesPage() {
  const [orders, setOrders]     = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [saving, setSaving]     = useState(false);
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [o, p] = await Promise.all([api.get('/sales'), api.get('/products')]);
      setOrders(o.data); setProducts(p.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (form) => {
    setSaving(true);
    try { 
      const res = await api.post('/sales', form); 
      if (res.data?.missingStock) {
        toast.warning(res.data.autoMessage || 'Sales order created with shortages.');
      } else {
        toast.success(res.data?.autoMessage || 'Sales order created and confirmed!');
      }
      setShowCreate(false); 
      load(); 
    }
    catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleAction = async (id, action, msg) => {
    try { 
      const res = await api.patch(`/sales/${id}/${action}`); 
      // Orchestrator returns detailed messages about shortages vs delivery
      const finalMsg = res.data?.message || msg;
      
      if (res.data?.missingStock) toast.warning(finalMsg);
      else toast.success(finalMsg);
      
      load(); 
    }
    catch (err) { toast.error(err.response?.data?.error || `Failed to ${action}`); }
  };

  const filtered = orders.filter(o => {
    const ms = o.customer_name?.toLowerCase().includes(search.toLowerCase());
    const mf = statusFilter === 'ALL' || o.status === statusFilter;
    return ms && mf;
  });

  const chartData = ['DRAFT','CONFIRMED','DELIVERED','CANCELLED'].map(s => ({
    status: s,
    value: orders.filter(o=>o.status===s).reduce((sum,o)=>sum+((o.items||[]).reduce((s,i)=>s+Number(i.sales_price||0)*Number(i.quantity),0)),0)
  }));

  const totalRev = orders.filter(o=>o.status==='DELIVERED').reduce((sum,o)=>sum+((o.items||[]).reduce((s,i)=>s+Number(i.sales_price||0)*Number(i.quantity),0)),0);

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div>
      <Toast toasts={toast.toasts} />

      {/* KPIs */}
      <div className="kpi-grid" style={{ gridTemplateColumns:'repeat(5,1fr)', marginBottom:24 }}>
        {[
          { label:'Total Orders',  value:orders.length,                                              color:'teal',   icon:<ShoppingCart size={18}/> },
          { label:'Draft',         value:orders.filter(o=>o.status==='DRAFT').length,                color:'purple', icon:<Clock size={18}/> },
          { label:'Confirmed',     value:orders.filter(o=>o.status==='CONFIRMED').length,            color:'cyan',   icon:<CheckCircle2 size={18}/> },
          { label:'Delivered',     value:orders.filter(o=>o.status==='DELIVERED').length,            color:'green',  icon:<Truck size={18}/> },
          { label:'Revenue (₹)',   value:`₹${totalRev.toLocaleString('en-IN')}`,                    color:'orange', icon:<TrendingUp size={18}/> },
        ].map((k,i) => (
          <motion.div key={k.label} className={`kpi-card ${k.color}`}
            initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.07 }} whileHover={{ scale:1.03 }}>
            <div className="kpi-icon">{k.icon}</div>
            <div className="kpi-value" style={{ fontSize:typeof k.value==='string'?16:26 }}>{k.value}</div>
            <div className="kpi-label">{k.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Chart + Flow */}
      <div className="grid-2" style={{ marginBottom:24 }}>
        <motion.div className="chart-wrapper" initial={{ opacity:0, x:-16 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.2 }}>
          <div className="chart-title">Revenue by Status</div>
          <div className="chart-subtitle">Total order value by stage</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} barSize={36}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="status" stroke="#475569" fontSize={10} />
              <YAxis stroke="#475569" fontSize={10} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={v=>[`₹${Number(v).toLocaleString('en-IN')}`, 'Value']} contentStyle={ttStyle} />
              <Bar dataKey="value" radius={[6,6,0,0]}>{chartData.map(e=><Cell key={e.status} fill={STATUS_COLORS[e.status]}/>)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
        <motion.div className="glass-card" style={{ padding:22 }} initial={{ opacity:0, x:16 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.25 }}>
          <div className="chart-title" style={{ marginBottom:14 }}>🛒 Sales Flow</div>
          {[
            { step:'1', label:'Create SO',  desc:'Add customer & products', color:'var(--accent-purple)' },
            { step:'2', label:'Confirm',    desc:'Reserves stock for customer', color:'var(--accent-teal)' },
            { step:'3', label:'Deliver',    desc:'Ship goods → deduct stock', color:'var(--accent-green)' },
          ].map(s=>(
            <div key={s.step} style={{ display:'flex', gap:10, marginBottom:12, alignItems:'flex-start' }}>
              <div style={{ width:26, height:26, borderRadius:'50%', background:s.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'white', flexShrink:0 }}>{s.step}</div>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{s.label}</div>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Toolbar */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ position:'relative', flex:1, minWidth:220 }}>
          <Search size={14} style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }} />
          <input className="form-input" style={{ paddingLeft:34 }} placeholder="Search customer..." value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        {['ALL','DRAFT','CONFIRMED','DELIVERED','CANCELLED'].map(s=>(
          <button key={s} className={`btn btn-sm ${statusFilter===s?'btn-primary':'btn-ghost'}`} onClick={()=>setStatusFilter(s)}>{s==='ALL'?'All':s}</button>
        ))}
        <motion.button className="btn btn-primary btn-sm" onClick={()=>setShowCreate(true)} whileHover={{ scale:1.03 }}>
          <Plus size={14}/> New SO
        </motion.button>
      </div>

      {/* Table */}
      <motion.div className="table-container" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}>
        <div className="table-header"><span className="table-title"><ShoppingCart size={15} style={{ display:'inline', marginRight:8 }}/>Sales Orders ({filtered.length})</span></div>
        <table>
          <thead><tr><th>SO #</th><th>Customer</th><th>Status</th><th>Items</th><th>Total</th><th>Date</th><th>Actions</th><th/></tr></thead>
          <tbody>
            {filtered.length===0
              ? <tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:'var(--text-muted)' }}>No orders found</td></tr>
              : filtered.map((o,i) => {
                  const items = (o.items||[]).filter(it=>it.product_id);
                  const total = items.reduce((s,it)=>s+Number(it.sales_price||0)*Number(it.quantity),0);
                  const isExp = expanded===o.id;
                  const canDeliver = items.every(it => Number(it.on_hand_qty || 0) >= Number(it.quantity));

                  return (
                    <AnimatePresence key={o.id}>
                      <motion.tr initial={{ opacity:0,x:-10 }} animate={{ opacity:1,x:0 }} transition={{ delay:i*0.04 }}>
                        <td style={{ fontWeight:700, color:'var(--accent-teal)' }}>SO-{String(o.id).padStart(4,'0')}</td>
                        <td>{o.customer_name}</td>
                        <td><Badge status={o.status}/></td>
                        <td style={{ color:'var(--text-secondary)' }}>{items.length}</td>
                        <td style={{ color:'var(--accent-green)', fontWeight:600 }}>₹{total.toLocaleString('en-IN')}</td>
                        <td style={{ color:'var(--text-muted)', fontSize:12 }}>{new Date(o.created_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</td>
                        <td>
                          <div style={{ display:'flex', gap:5 }}>
                            {o.status==='DRAFT' && <>
                              <motion.button className="btn btn-primary btn-xs" whileHover={{ scale:1.05 }} onClick={()=>handleAction(o.id,'confirm','Order Confirmed!')}><CheckCircle2 size={12}/> Confirm</motion.button>
                              <motion.button className="btn btn-ghost btn-xs" whileHover={{ scale:1.05 }} onClick={()=>handleAction(o.id,'cancel','Cancelled')} style={{ color:'var(--accent-red)' }}><XCircle size={12}/></motion.button>
                            </>}
                            {o.status==='CONFIRMED' && <>
                              {canDeliver ? (
                                <motion.button className="btn btn-success btn-xs" whileHover={{ scale:1.05 }} onClick={()=>handleAction(o.id,'deliver','🚚 Delivered!')}><Truck size={12}/> Deliver</motion.button>
                              ) : (
                                <span style={{ fontSize:11, color:'var(--accent-orange)', fontWeight:600, padding:'4px 8px', background:'rgba(245, 158, 11, 0.1)', borderRadius:4 }}>Waiting for Stock</span>
                              )}
                              <motion.button className="btn btn-ghost btn-xs" whileHover={{ scale:1.05 }} onClick={()=>handleAction(o.id,'cancel','Cancelled')} style={{ color:'var(--accent-red)' }}><XCircle size={12}/></motion.button>
                            </>}
                            {['DELIVERED','CANCELLED'].includes(o.status) && <span style={{ fontSize:12, color:'var(--text-muted)' }}>—</span>}
                          </div>
                        </td>
                        <td><button onClick={()=>setExpanded(isExp?null:o.id)} style={{ background:'none',border:'none',color:'var(--text-muted)',cursor:'pointer',padding:4 }}>{isExp?<ChevronUp size={15}/>:<ChevronDown size={15}/>}</button></td>
                      </motion.tr>
                      {isExp && (
                        <motion.tr initial={{ opacity:0 }} animate={{ opacity:1 }}>
                          <td colSpan={8} style={{ background:'rgba(20,184,166,0.03)', padding:'14px 22px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                            <table style={{ width:'100%' }}>
                              <thead><tr>{['Product','Qty','Unit Price','Line Total'].map(h=><th key={h} style={{ padding:'4px 8px', textAlign:'left', fontSize:11, color:'var(--text-muted)', background:'transparent' }}>{h}</th>)}</tr></thead>
                              <tbody>
                                {items.map((it,j)=>(
                                  <tr key={j}>
                                    <td style={{ padding:'5px 8px', fontSize:13 }}>{it.product_name}</td>
                                    <td style={{ padding:'5px 8px', fontSize:13, color:'var(--text-secondary)' }}>{it.quantity}</td>
                                    <td style={{ padding:'5px 8px', fontSize:13, color:'var(--text-secondary)' }}>₹{Number(it.sales_price||0).toLocaleString()}</td>
                                    <td style={{ padding:'5px 8px', fontSize:13, color:'var(--accent-green)', fontWeight:600 }}>₹{(Number(it.sales_price||0)*Number(it.quantity)).toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </motion.tr>
                      )}
                    </AnimatePresence>
                  );
              })
            }
          </tbody>
        </table>
      </motion.div>

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={()=>setShowCreate(false)} title="🛒 New Sales Order">
        <CreateSOForm products={products} onSave={handleCreate} onCancel={()=>setShowCreate(false)} saving={saving} />
      </Modal>
    </div>
  );
}

function CreateSOForm({ products, onSave, onCancel, saving }) {
  const [customerName, setCustomerName] = useState('');
  const [items, setItems] = useState([{ product_id:'', quantity:1 }]);
  const addItem = () => setItems(it=>[...it,{ product_id:'', quantity:1 }]);
  const removeItem = i => setItems(it=>it.filter((_,idx)=>idx!==i));
  const updateItem = (i,k,v) => { const a=[...items]; a[i]={...a[i],[k]:v}; setItems(a); };
  const getProduct = id => products.find(p=>p.id===Number(id));
  const totalValue = items.reduce((sum,item)=>{ const p=getProduct(item.product_id); return sum+(p?Number(p.sales_price)*Number(item.quantity):0); },0);

  const handleSave = () => {
    if (!customerName.trim()) return alert('Customer name required');
    if (items.some(i=>!i.product_id)) return alert('Select a product for all items');
    onSave({ customer_name:customerName, items:items.map(i=>({ product_id:Number(i.product_id), quantity:Number(i.quantity) })) });
  };

  return (
    <div>
      <div className="form-group"><label className="form-label">Customer Name *</label><input className="form-input" value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="Customer name" /></div>
      <div style={{ marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
          <label className="form-label" style={{ margin:0 }}>Order Items *</label>
          <button className="btn btn-ghost btn-xs" onClick={addItem}><Plus size={12}/> Add</button>
        </div>
        {items.map((item,i)=>{
          const p=getProduct(item.product_id);
          const avail = p ? p.on_hand_qty-p.reserved_qty : 0;
          const overQty = p && Number(item.quantity)>avail;
          return (
            <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 80px 90px 100px 30px', gap:8, marginBottom:8, alignItems:'center' }}>
              <select className="form-select" value={item.product_id} onChange={e=>updateItem(i,'product_id',e.target.value)}>
                <option value="">Select...</option>
                {products.map(prod=><option key={prod.id} value={prod.id}>{prod.name}</option>)}
              </select>
              <input className="form-input" type="number" min="1" value={item.quantity} onChange={e=>updateItem(i,'quantity',e.target.value)} style={{ borderColor:overQty?'var(--accent-red)':'' }} />
              <div style={{ textAlign:'center', fontSize:13, fontWeight:600, color:!p?'var(--text-muted)':avail<=0?'var(--accent-red)':'var(--accent-green)' }}>
                {p?avail:'—'} {overQty&&<AlertCircle size={11} style={{ display:'inline' }}/>}
              </div>
              <div style={{ fontSize:13, color:'var(--accent-green)', fontWeight:600 }}>₹{(p?Number(p.sales_price)*Number(item.quantity):0).toLocaleString()}</div>
              <button onClick={()=>removeItem(i)} disabled={items.length===1} style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:6, color:items.length===1?'var(--text-muted)':'var(--accent-red)', cursor:items.length===1?'not-allowed':'pointer', width:30, height:36, display:'flex', alignItems:'center', justifyContent:'center' }}><X size={12}/></button>
            </div>
          );
        })}
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 14px', background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:10, marginBottom:18 }}>
        <span style={{ fontSize:13, color:'var(--text-secondary)' }}>Total</span>
        <span style={{ color:'var(--accent-green)', fontWeight:700 }}>₹{totalValue.toLocaleString('en-IN')}</span>
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
        <motion.button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving} whileHover={{ scale:1.02 }}>
          <Save size={13}/> {saving?'Creating...':'Create SO'}
        </motion.button>
      </div>
    </div>
  );
}
