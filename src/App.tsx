import { useState, useEffect } from 'react';
import { 
  Package, 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  Truck, 
  Clock, 
  XCircle,
  TrendingUp,
  JapaneseYen
} from 'lucide-react';

type Status = '発送待ち' | '発送済み' | '取引終了' | 'キャンセル予定';

interface Product {
  id: string;
  name: string;
  purchasePrice: number;
  salePrice: number;
  status: Status;
  purchaseDate: string;
  shippingDate: string;
  completionDate: string;
}

const STORAGE_KEY = 'venda_management_products';

export default function App() {
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved products', e);
      }
    }
    return [];
  });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Omit<Product, 'id'>>({
    name: '',
    purchasePrice: 0,
    salePrice: 0,
    status: '発送待ち',
    purchaseDate: new Date().toISOString().split('T')[0],
    shippingDate: '',
    completionDate: ''
  });

  // Save to local storage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  }, [products]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      setProducts(prev => prev.map(p => p.id === editingId ? { ...formData, id: p.id } : p));
      setEditingId(null);
    } else {
      const newProduct: Product = {
        ...formData,
        id: crypto.randomUUID()
      };
      setProducts(prev => [newProduct, ...prev]);
    }
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      purchasePrice: 0,
      salePrice: 0,
      status: '発送待ち',
      purchaseDate: new Date().toISOString().split('T')[0],
      shippingDate: '',
      completionDate: ''
    });
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (product: Product) => {
    setFormData({ ...product });
    setEditingId(product.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('この商品を削除してもよろしいですか？')) {
      setProducts(prev => prev.filter(p => p.id !== id));
    }
  };

  const updateProductDate = (id: string, field: 'shippingDate' | 'completionDate', value: string) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const updateStatus = (id: string, newStatus: Status) => {
    setProducts(prev => prev.map(p => {
      if (p.id === id) {
        const today = new Date().toISOString().split('T')[0];
        let shippingDate = p.shippingDate;
        let completionDate = p.completionDate;

        if (newStatus === '発送済み' && !shippingDate) shippingDate = today;
        if (newStatus === '取引終了' && !completionDate) completionDate = today;

        return { ...p, status: newStatus, shippingDate, completionDate };
      }
      return p;
    }));
  };

  const getStatusIcon = (status: Status) => {
    switch (status) {
      case '発送待ち': return <Clock size={16} />;
      case '発送済み': return <Truck size={16} />;
      case '取引終了': return <CheckCircle2 size={16} />;
      case 'キャンセル予定': return <XCircle size={16} />;
    }
  };

  const getStatusClass = (status: Status) => {
    switch (status) {
      case '発送待ち': return 'status-pending';
      case '発送済み': return 'status-shipped';
      case '取引終了': return 'status-completed';
      case 'キャンセル予定': return 'status-cancelled';
    }
  };

  const totalProfit = products.reduce((sum, p) => 
    p.status === '取引終了' ? sum + (p.salePrice - p.purchasePrice) : sum, 0);

  return (
    <div className="container">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>物販進捗管理</h1>
        <button className="primary btn-icon" onClick={() => setShowForm(true)}>
          <Plus size={20} />
          新規追加
        </button>
      </header>

      <div className="grid">
        <div className="stat-card glass-card">
          <label><Package size={14} style={{ marginRight: 4 }} /> 登録商品数</label>
          <div className="stat-value">{products.length} <span style={{ fontSize: '1rem', color: 'var(--text-dim)' }}>個</span></div>
        </div>
        <div className="stat-card glass-card">
          <label><TrendingUp size={14} style={{ marginRight: 4 }} /> 合計利益 (完了分)</label>
          <div className="stat-value" style={{ color: 'var(--status-completed)' }}>
            ¥{totalProfit.toLocaleString()}
          </div>
        </div>
        <div className="stat-card glass-card">
          <label><JapaneseYen size={14} style={{ marginRight: 4 }} /> 在庫原価 (未完了)</label>
          <div className="stat-value" style={{ color: 'var(--status-pending)' }}>
            ¥{products.filter(p => p.status !== '取引終了').reduce((s, p) => s + p.purchasePrice, 0).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: '40%', minWidth: '200px' }}>商品名</th>
              <th>金額情報</th>
              <th>ステータス</th>
              <th>日付情報</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {products.map(product => (
              <tr key={product.id}>
                <td style={{ fontWeight: 600, whiteSpace: 'normal', minWidth: '200px', lineHeight: '1.4' }}>{product.name}</td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                      <span style={{ color: 'var(--text-dim)' }}>販売:</span>
                      <span>¥{product.salePrice.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                      <span style={{ color: 'var(--text-dim)' }}>仕入:</span>
                      <span>¥{product.purchasePrice.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontWeight: 'bold', paddingTop: '0.25rem', borderTop: '1px solid var(--card-border)' }}>
                      <span>利益:</span>
                      <span style={{ 
                        color: product.salePrice - product.purchasePrice > 0 ? 'var(--status-completed)' : 
                               product.salePrice - product.purchasePrice < 0 ? 'var(--status-cancelled)' : 'inherit'
                      }}>
                        ¥{(product.salePrice - product.purchasePrice).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`status-badge btn-icon ${getStatusClass(product.status)}`}>
                    {getStatusIcon(product.status)}
                    {product.status}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', minWidth: '2rem' }}>仕入:</span>
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.875rem', padding: '0.15rem 0.25rem' }}>{product.purchaseDate}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', minWidth: '2rem' }}>発送:</span>
                      <input 
                        type="date" 
                        value={product.shippingDate || ''} 
                        onChange={e => updateProductDate(product.id, 'shippingDate', e.target.value)}
                        style={{ background: 'transparent', border: '1px solid var(--card-border)', padding: '0.15rem 0.25rem', color: 'var(--text-main)', borderRadius: '0.25rem', outline: 'none', cursor: 'pointer', fontSize: '0.8rem' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', minWidth: '2rem' }}>到着:</span>
                      <input 
                        type="date" 
                        value={product.completionDate || ''} 
                        onChange={e => updateProductDate(product.id, 'completionDate', e.target.value)}
                        style={{ background: 'transparent', border: '1px solid var(--card-border)', padding: '0.15rem 0.25rem', color: 'var(--text-main)', borderRadius: '0.25rem', outline: 'none', cursor: 'pointer', fontSize: '0.8rem' }}
                      />
                    </div>
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button onClick={() => updateStatus(product.id, '発送待ち')} title="発送待ちに変更" style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--status-pending)', padding: '0.5rem' }}>
                      <Clock size={16} />
                    </button>
                    <button onClick={() => updateStatus(product.id, '発送済み')} title="発送済みに変更" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--status-shipped)', padding: '0.5rem' }}>
                      <Truck size={16} />
                    </button>
                    <button onClick={() => updateStatus(product.id, '取引終了')} title="完了に変更" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-completed)', padding: '0.5rem', borderRadius: '0.75rem', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckCircle2 size={16} />
                    </button>
                    <button onClick={() => updateStatus(product.id, 'キャンセル予定')} title="キャンセルに変更" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-cancelled)', padding: '0.5rem' }}>
                      <XCircle size={16} />
                    </button>
                    <div style={{ width: '1px', height: '24px', background: 'var(--card-border)', margin: '0 0.25rem' }}></div>
                    <button onClick={() => handleEdit(product)} title="編集" style={{ background: 'rgba(255,255,255,0.05)', color: 'white', padding: '0.5rem' }}>
                      <Edit3 size={16} />
                    </button>
                    <button onClick={() => handleDelete(product.id)} title="削除" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-cancelled)', padding: '0.5rem' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {products.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-dim)' }}>
            <Package size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
            <p>商品が登録されていません。「新規追加」ボタンから登録してください。</p>
          </div>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="glass-card" style={{ width: '100%', maxWidth: '500px' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{editingId ? '商品情報を編集' : '新規商品を追加'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>商品名</label>
                <input 
                  required 
                  type="text" 
                  value={formData.name} 
                  onChange={e => setFormData({ ...formData, name: e.target.value })} 
                  placeholder="例: iPhone 15 Pro"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>仕入金額 (¥)</label>
                  <input 
                    required 
                    type="number" 
                    value={formData.purchasePrice} 
                    onChange={e => setFormData({ ...formData, purchasePrice: Number(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label>販売金額 (¥)</label>
                  <input 
                    required 
                    type="number" 
                    value={formData.salePrice} 
                    onChange={e => setFormData({ ...formData, salePrice: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>ステータス</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {(['発送待ち', '発送済み', '取引終了', 'キャンセル予定'] as Status[]).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setFormData({ ...formData, status: s })}
                      className={`status-badge btn-icon ${formData.status === s ? getStatusClass(s) : ''}`}
                      style={{ 
                        opacity: formData.status === s ? 1 : 0.6,
                        border: formData.status === s ? '1px solid currentColor' : '1px solid var(--card-border)',
                        background: formData.status === s ? undefined : 'transparent'
                      }}
                    >
                      {getStatusIcon(s)}
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                <div className="form-group">
                  <label>仕入日</label>
                  <input 
                    type="date" 
                    value={formData.purchaseDate} 
                    onChange={e => setFormData({ ...formData, purchaseDate: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>発送日</label>
                  <input 
                    type="date" 
                    value={formData.shippingDate} 
                    onChange={e => setFormData({ ...formData, shippingDate: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>到着日(完了)</label>
                  <input 
                    type="date" 
                    value={formData.completionDate} 
                    onChange={e => setFormData({ ...formData, completionDate: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={resetForm} style={{ background: 'transparent', border: '1px solid var(--card-border)' }}>
                  キャンセル
                </button>
                <button type="submit" className="primary">
                  {editingId ? '更新する' : '登録する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
