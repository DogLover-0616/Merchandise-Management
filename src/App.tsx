import { useState, useEffect, useMemo } from 'react';
import { 
  Package, Plus, Trash2, Edit3, CheckCircle2, Truck, Clock, 
  XCircle, TrendingUp, JapaneseYen, LogOut, LogIn, FolderOpen, BarChart3
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { auth, db, provider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';

type Status = '発送待ち' | '発送済み' | '取引終了' | 'キャンセル予定';

interface Category {
  id: string;
  name: string;
  userId: string;
  createdAt?: any;
}

interface Product {
  id: string;
  name: string;
  categoryId: string;
  purchasePrice: number;
  salePrice: number;
  status: Status;
  purchaseDate: string;
  shippingDate: string;
  completionDate: string;
  userId: string;
  createdAt?: any;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showCategoryMaster, setShowCategoryMaster] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'list' | 'chart'>('list');
  const [chartPeriodType, setChartPeriodType] = useState<'month' | 'custom'>('month');
  const [chartMonth, setChartMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [chartStartDate, setChartStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [chartEndDate, setChartEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  const chartData = useMemo(() => {
    const filtered = products.filter(p => {
      // 完了済みのみを対象
      if (p.status !== '取引終了') return false; 
      if (!p.completionDate) return false;
      
      if (chartPeriodType === 'month') {
        return p.completionDate.startsWith(chartMonth);
      } else {
        return (!chartStartDate || p.completionDate >= chartStartDate) && 
               (!chartEndDate || p.completionDate <= chartEndDate);
      }
    });

    const profitMap = new Map<string, number>();
    filtered.forEach(p => {
       const profit = p.salePrice - p.purchasePrice;
       const catId = p.categoryId || 'uncategorized';
       profitMap.set(catId, (profitMap.get(catId) || 0) + profit);
    });

    const data = Array.from(profitMap.entries()).map(([catId, profit]) => {
      if (catId === 'uncategorized') return { name: '未分類', profit };
      const cat = categories.find(c => c.id === catId);
      return { name: cat ? cat.name : '不明', profit };
    });
    
    data.sort((a, b) => b.profit - a.profit);
    return data;
  }, [products, categories, chartPeriodType, chartMonth, chartStartDate, chartEndDate]);
  
  const [formData, setFormData] = useState<Omit<Product, 'id' | 'userId' | 'createdAt'>>({
    name: '',
    categoryId: '',
    purchasePrice: 0,
    salePrice: 0,
    status: '発送待ち',
    purchaseDate: new Date().toISOString().split('T')[0],
    shippingDate: '',
    completionDate: ''
  });

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Firestore listener
  useEffect(() => {
    if (!user) {
      setProducts([]);
      setCategories([]);
      return;
    }

    const qCategories = query(
      collection(db, 'categories'),
      where('userId', '==', user.uid)
    );
    const unsubCategories = onSnapshot(qCategories, (snapshot) => {
      const categoryData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];
      setCategories(categoryData);
    }, (error) => {
      console.error('Error fetching categories:', error);
      alert('カテゴリの取得に失敗しました。Firestoreのセキュリティルールが設定されていない可能性があります。(Error: ' + error.message + ')');
    });
    
    const q = query(
      collection(db, 'products'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productListData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      
      productListData.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      
      setProducts(productListData);
    }, (error) => {
      console.error('Error fetching products:', error);
      alert('データの取得に失敗しました。Firestoreのセキュリティルールが設定されていない可能性があります。');
    });

    return () => {
      unsubscribe();
      unsubCategories();
    };
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed', error);
      alert('ログインに失敗しました');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (editingId) {
        const productRef = doc(db, 'products', editingId);
        await updateDoc(productRef, { ...formData });
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'products'), {
          ...formData,
          userId: user.uid,
          createdAt: Timestamp.now()
        });
      }
      resetForm();
    } catch (error) {
      console.error('Error saving document: ', error);
      alert('保存に失敗しました。Firestoreのセキュリティルールを確認してください。');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      categoryId: '',
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
    setFormData({
      name: product.name,
      categoryId: product.categoryId || '',
      purchasePrice: product.purchasePrice,
      salePrice: product.salePrice,
      status: product.status,
      purchaseDate: product.purchaseDate,
      shippingDate: product.shippingDate,
      completionDate: product.completionDate
    });
    setEditingId(product.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('この商品を削除してもよろしいですか？')) {
      try {
        await deleteDoc(doc(db, 'products', id));
      } catch (error) {
        console.error('Error deleting document: ', error);
        alert('削除に失敗しました。');
      }
    }
  };

  const updateProductDate = async (id: string, field: 'shippingDate' | 'completionDate', value: string) => {
    try {
      const productRef = doc(db, 'products', id);
      await updateDoc(productRef, { [field]: value });
    } catch (error) {
      console.error('Error updating date: ', error);
    }
  };

  const updateStatus = async (id: string, newStatus: Status) => {
    const product = products.find(p => p.id === id);
    if (!product) return;

    const today = new Date().toISOString().split('T')[0];
    let shippingDate = product.shippingDate;
    let completionDate = product.completionDate;

    if (newStatus === '発送済み' && !shippingDate) shippingDate = today;
    if (newStatus === '取引終了' && !completionDate) completionDate = today;

    try {
      const productRef = doc(db, 'products', id);
      await updateDoc(productRef, {
        status: newStatus,
        shippingDate,
        completionDate
      });
    } catch (error) {
      console.error('Error updating status: ', error);
    }
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

  if (!user) {
    return (
      <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', maxWidth: '400px', width: '100%' }}>
          <Package size={64} style={{ color: 'var(--primary)', marginBottom: '1.5rem' }} />
          <h1 style={{ marginBottom: '1rem' }}>物販進捗管理</h1>
          <p style={{ color: 'var(--text-dim)', marginBottom: '2rem' }}>
            データはクラウドに安全に保存され、自分のデータのみを管理できます。
          </p>
          <button className="primary btn-icon" onClick={handleLogin} style={{ width: '100%', justifyContent: 'center', padding: '1rem' }}>
            <LogIn size={20} />
            Googleでログインして始める
          </button>
        </div>
      </div>
    );
  }

  const totalProfit = products.reduce((sum, p) => 
    p.status === '取引終了' ? sum + (p.salePrice - p.purchasePrice) : sum, 0);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim() || !user) return;
    try {
      await addDoc(collection(db, 'categories'), {
        name: newCategoryName.trim(),
        userId: user.uid,
        createdAt: Timestamp.now()
      });
      setNewCategoryName('');
    } catch (error) {
      console.error('Error adding category:', error);
      alert('カテゴリの追加に失敗しました。');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (products.some(p => p.categoryId === id)) {
      alert('このカテゴリは使用されているため削除できません。');
      return;
    }
    if (window.confirm('このカテゴリを削除してもよろしいですか？')) {
      try {
        await deleteDoc(doc(db, 'categories', id));
      } catch (error) {
        console.error('Error deleting category:', error);
      }
    }
  };

  return (
    <div className="container">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <h1>物販進捗管理</h1>
          <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--card-border)' }}>
            <button 
              onClick={() => setActiveTab('list')}
              style={{ background: 'transparent', border: 'none', padding: '0.5rem 1rem', borderBottom: activeTab === 'list' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'list' ? 'var(--text-main)' : 'var(--text-dim)', fontWeight: activeTab === 'list' ? 'bold' : 'normal', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Package size={16} />一覧表示
            </button>
            <button 
              onClick={() => setActiveTab('chart')}
              style={{ background: 'transparent', border: 'none', padding: '0.5rem 1rem', borderBottom: activeTab === 'chart' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'chart' ? 'var(--text-main)' : 'var(--text-dim)', fontWeight: activeTab === 'chart' ? 'bold' : 'normal', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart3 size={16} />利益グラフ
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--surface)', padding: '0.5rem 1rem', borderRadius: '2rem' }}>
            <img src={user.photoURL || ''} alt={user.displayName || 'User'} style={{ width: 24, height: 24, borderRadius: '50%' }} />
            <span style={{ fontSize: '0.9rem' }}>{user.displayName}</span>
            <button onClick={handleLogout} className="btn-icon" style={{ background: 'transparent', padding: '0.25rem', color: 'var(--text-dim)', border: 'none' }} title="ログアウト">
              <LogOut size={16} />
            </button>
          </div>
          <button className="btn-icon" onClick={() => setShowCategoryMaster(true)} style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--card-border)' }}>
            <FolderOpen size={20} />
            カテゴリ管理
          </button>
          <button className="primary btn-icon" onClick={() => setShowForm(true)}>
            <Plus size={20} />
            新規追加
          </button>
        </div>
      </header>

      {activeTab === 'list' ? (
        <>
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
              <th style={{ width: '30%', minWidth: '150px' }}>商品名</th>
              <th>カテゴリ</th>
              <th>金額情報</th>
              <th>ステータス</th>
              <th>日付情報</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {products.map(product => (
              <tr key={product.id}>
                <td style={{ fontWeight: 600, whiteSpace: 'normal', minWidth: '150px', lineHeight: '1.4' }}>{product.name}</td>
                <td>
                  <span style={{ background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.5rem', borderRadius: '0.5rem', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                    {categories.find(c => c.id === product.categoryId)?.name || '未分類'}
                  </span>
                </td>
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
      </>
      ) : (
        <div className="glass-card" style={{ padding: '2rem', marginTop: '2rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap' }}>
            <select 
               value={chartPeriodType}
               onChange={e => setChartPeriodType(e.target.value as 'month' | 'custom')}
               style={{ padding: '0.5rem', background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: '0.5rem', color: 'var(--text-main)' }}
            >
              <option value="month">月ごと</option>
              <option value="custom">期間指定</option>
            </select>
            
            {chartPeriodType === 'month' ? (
              <input 
                 type="month" 
                 value={chartMonth}
                 onChange={e => setChartMonth(e.target.value)}
                 style={{ padding: '0.5rem', background: 'transparent', border: '1px solid var(--card-border)', borderRadius: '0.5rem', color: 'var(--text-main)' }}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input 
                   type="date" 
                   value={chartStartDate}
                   onChange={e => setChartStartDate(e.target.value)}
                   style={{ padding: '0.5rem', background: 'transparent', border: '1px solid var(--card-border)', borderRadius: '0.5rem', color: 'var(--text-main)' }}
                />
                <span>～</span>
                <input 
                   type="date" 
                   value={chartEndDate}
                   onChange={e => setChartEndDate(e.target.value)}
                   style={{ padding: '0.5rem', background: 'transparent', border: '1px solid var(--card-border)', borderRadius: '0.5rem', color: 'var(--text-main)' }}
                />
              </div>
            )}
          </div>

          {chartData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>
              指定された期間に完了した売上がありません。
            </div>
          ) : (
            <div style={{ height: '400px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                  <XAxis dataKey="name" stroke="var(--text-dim)" />
                  <YAxis stroke="var(--text-dim)" />
                  <Tooltip 
                    cursor={{fill: '#ffffff10'}}
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: '0.5rem', color: 'var(--text-main)' }} 
                    formatter={(value) => [`¥${Number(value).toLocaleString()}`, '利益']}
                  />
                  <Legend />
                  <Bar dataKey="profit" name="利益金額" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

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
              <div className="form-group">
                <label>カテゴリ</label>
                <select 
                  required
                  value={formData.categoryId}
                  onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
                >
                  <option value="">カテゴリを選択してください</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
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

      {showCategoryMaster && (
        <div className="modal-overlay">
          <div className="glass-card" style={{ width: '100%', maxWidth: '400px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem' }}>カテゴリ管理</h2>
              <button className="btn-icon" onClick={() => setShowCategoryMaster(false)} style={{ background: 'transparent', padding: '0.5rem' }}>
                <XCircle size={20} style={{ color: 'var(--text-dim)' }} />
              </button>
            </div>
            
            <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <input 
                required
                type="text" 
                value={newCategoryName} 
                onChange={e => setNewCategoryName(e.target.value)} 
                placeholder="新しいカテゴリ名"
                style={{ flex: 1 }}
              />
              <button type="submit" className="primary btn-icon" style={{ padding: '0.5rem 1rem' }}>
                <Plus size={16} /> 追加
              </button>
            </form>

            <div style={{ overflowY: 'auto', flex: 1, border: '1px solid var(--card-border)', borderRadius: '0.75rem', background: 'rgba(0,0,0,0.2)' }}>
              {categories.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.875rem' }}>
                  カテゴリがありません。<br />上から追加してください。
                </div>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {categories.map(cat => (
                    <li key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: '1px solid var(--card-border)' }}>
                      <span>{cat.name}</span>
                      <button 
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="btn-icon" 
                        style={{ background: 'transparent', color: 'var(--status-cancelled)', padding: '0.25rem', border: 'none' }}
                        title="商品が登録されている場合は削除できません"
                      >
                        <Trash2 size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
