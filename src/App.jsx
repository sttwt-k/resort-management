import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc,
  Timestamp,
  setDoc,
} from 'firebase/firestore';
import { 
  Calendar, Users, Phone, Camera, CheckCircle, 
  LogOut, MessageSquare, Plus, BarChart2, 
  Save, X, Key, Wallet, Download, Edit, Layers, 
  Settings, Trash2, Lock, Copy, FileText, User, 
  Shield, LogIn, Clock, CreditCard, Coins, ArrowRight, AlertCircle, Search, Car, Menu,
  MessageCircle, Send, LayoutList, ChevronRight, ChevronLeft, Smartphone, Gift, CheckSquare,
  Receipt, Banknote, QrCode, Image as ImageIcon
} from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

// --- Fonts & Styles Injection ---
const fontStyle = document.createElement('style');
fontStyle.innerHTML = `
  @import url('https://fonts.googleapis.com/css2?family=Prompt:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap');
  body { font-family: 'Prompt', sans-serif; background-color: #f1f5f9; }
  
  @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
  
  @keyframes slideUp { from { transform: translate(-50%, 100%); } to { transform: translate(-50%, 0); } }
  .animate-slide-up { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

  .glass-panel { background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.5); }
  
  .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

  .timeline-grid { display: grid; grid-template-columns: 80px repeat(14, 1fr); }
  
  .checkbox-wrapper { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
  .checkbox-wrapper.selected { transform: scale(1.1); border-color: #10b981; background-color: #10b981; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); }
`;
document.head.appendChild(fontStyle);

// --- Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyAZBJxbbrZkl2E8MLhLHdmU0DqRmdEhj0U",
  authDomain: "chanpha-resort.firebaseapp.com",
  projectId: "chanpha-resort",
  storageBucket: "chanpha-resort.firebasestorage.app",
  messagingSenderId: "832616208030",
  appId: "1:832616208030:web:17e70d393aa4977717cd8f",
  measurementId: "G-XZMVYGY9FZ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'my-resort-app-v1';

// --- Constants ---
const DEFAULT_ROOM_SEEDS = [
  { id: '1', name: 'บ้าน 1', type: 'บ้านเตียงเดี่ยว', price: 500 },
  { id: '2', name: 'บ้าน 2', type: 'บ้านเตียงเดี่ยว', price: 500 },
  { id: '3', name: 'บ้าน 3', type: 'บ้านใหญ่', price: 700 },
  { id: '4', name: 'ห้อง 4', type: 'ห้องเตียงเดี่ยว', price: 400 },
  { id: '5', name: 'ห้อง 5', type: 'ห้องเตียงเดี่ยว', price: 400 },
  { id: '6', name: 'ห้อง 6', type: 'ห้องเตียงเดี่ยว', price: 400 },
  { id: '10', name: 'ห้อง 10', type: 'ห้องเตียงคู่', price: 500 },
  { id: '11', name: 'ห้อง 11', type: 'ห้องเตียงคู่', price: 500 },
  { id: 'B1', name: 'ห้อง B1', type: 'ห้องเตียงเดี่ยว', price: 350 },
  { id: 'B2', name: 'ห้อง B2', type: 'ห้องเตียงเดี่ยว', price: 350 },
  { id: 'B3', name: 'ห้อง B3', type: 'ห้องเตียงคู่', price: 500 },
];

const DEFAULT_EXPENSE_CATEGORIES = ['ค่าแรงคนงาน', 'ค่าอินเตอร์เน็ต', 'ของใช้สิ้นเปลือง (สบู่/ทิชชู่)', 'น้ำดื่ม', 'ค่าน้ำ/ค่าไฟ', 'ซ่อมบำรุง', 'อื่นๆ'];
const PAYMENT_METHODS = ['เงินสด', 'เงินโอน'];
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#84cc16', '#64748b'];

// --- Utils ---
const formatDate = (date) => date.toISOString().split('T')[0];

const generateSequentialDocNo = (prefix, dateStr, existingDocs) => {
    const yearMonth = dateStr.slice(0, 7).replace('-', ''); 
    const pattern = new RegExp(`^${prefix}-${yearMonth}-(\\d{3})$`);
    let maxNum = 0;
    existingDocs.forEach(d => {
        [d.docNo, d.checkInDocNo].forEach(code => {
            if(code) {
                const match = code.match(pattern);
                if (match) {
                    const num = parseInt(match[1], 10);
                    if (num > maxNum) maxNum = num;
                }
            }
        });
    });
    const nextNum = String(maxNum + 1).padStart(3, '0');
    return `${prefix}-${yearMonth}-${nextNum}`;
};

const calculateNights = (start, end) => {
  const diff = new Date(end) - new Date(start);
  const days = diff / (1000 * 60 * 60 * 24);
  return days > 0 ? days : 1;
};

const addDays = (dateStr, days) => {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + parseInt(days));
    return formatDate(date);
};

const calculateAge = (dob) => {
    if (!dob) return '';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
};

// Image Compression for Firestore (Base64)
const compressImage = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxWidth = 800;
                const scale = maxWidth / img.width;
                canvas.width = maxWidth;
                canvas.height = img.height * scale;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                // Compress to JPEG with 0.7 quality
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};

const exportToCSV = (data, filename) => {
    if (!data || !data.length) return;
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(fieldName => `"${row[fieldName] || ''}"`).join(','))
    ].join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const generateBookingSummary = (customerName, roomNames, checkInDate, nights, deposit, docNo) => {
    return `ยืนยันการจองห้องพัก "จันผารีสอร์ท" 🌿\n\n👤 คุณ: ${customerName}\n🏠 ห้อง: ${roomNames}\n📅 เข้าพัก: ${checkInDate} (${nights} คืน)\n💰 ยอดมัดจำ: ${Number(deposit).toLocaleString()} บาท\n🔖 เลขที่จอง: ${docNo}\n\n📌 เงื่อนไขการจอง:\nหากต้องการยกเลิกการจอง ต้องแจ้งล่วงหน้าอย่างน้อย 5 วัน เพื่อรับเงินคืนเต็มจำนวน (100%) หากแจ้งช้ากว่ากำหนด ขอสงวนสิทธิ์ในการคืนเงินมัดจำครับ`;
};

// --- Components ---
const Modal = ({ title, isOpen, onClose, children, maxWidth = "max-w-lg" }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 overflow-y-auto">
      <div className={`bg-white rounded-[2rem] shadow-2xl w-full ${maxWidth} relative flex flex-col max-h-[95vh] animate-fade-in overflow-hidden`}>
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <h2 className="text-xl font-bold text-slate-800">{title}</h2>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-500 transition-colors"><X size={20} /></button>
        </div>
        <div className="p-6 overflow-y-auto bg-white custom-scrollbar">{children}</div>
      </div>
    </div>
  );
};

// --- Login Screen ---
const LoginScreen = ({ onLogin }) => {
    const [pass, setPass] = useState('');
    const [error, setError] = useState('');
    const [showOwnerInput, setShowOwnerInput] = useState(false);

    const handleOwnerLogin = (e) => {
        e.preventDefault();
        if (pass === '258989') onLogin('owner');
        else setError('รหัสผ่านไม่ถูกต้อง');
    };

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
                <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-teal-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
            </div>

            <div className="bg-white/90 backdrop-blur-xl p-8 md:p-10 rounded-[2.5rem] shadow-2xl w-full max-w-sm text-center space-y-8 border border-white z-10 relative">
                <div className="space-y-2">
                    <div className="w-20 h-20 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-200 transform rotate-3">
                        <Shield size={40} className="text-white drop-shadow-sm"/>
                    </div>
                    <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Chanpha Resort</h1>
                    <p className="text-slate-500 text-sm font-medium">ระบบจัดการห้องพัก</p>
                </div>

                <div className="space-y-4">
                    {!showOwnerInput && (
                        <button 
                            onClick={() => onLogin('staff')} 
                            className="w-full py-4 bg-white border-2 border-slate-100 hover:border-emerald-400 hover:bg-emerald-50/50 text-slate-600 rounded-2xl transition-all duration-300 flex items-center justify-between px-6 group shadow-sm hover:shadow-lg"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-slate-100 text-slate-500 rounded-xl group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                                    <User size={24}/>
                                </div>
                                <div className="text-left">
                                    <p className="font-bold text-lg text-slate-700 group-hover:text-emerald-800">ทีมงานทั่วไป</p>
                                    <p className="text-xs text-slate-400">สำหรับคุณแม่ / พนักงาน</p>
                                </div>
                            </div>
                            <ArrowRight size={20} className="text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all"/>
                        </button>
                    )}

                    <div className={`transition-all duration-300 ease-in-out`}>
                        {!showOwnerInput ? (
                            <button 
                                onClick={() => setShowOwnerInput(true)} 
                                className="w-full py-4 bg-white border-2 border-slate-100 hover:border-slate-800 text-slate-600 rounded-2xl transition-all duration-300 flex items-center justify-between px-6 group shadow-sm hover:shadow-lg"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-slate-100 text-slate-500 rounded-xl group-hover:bg-slate-800 group-hover:text-white transition-colors">
                                        <Lock size={24}/>
                                    </div>
                                    <div className="text-left">
                                        <p className="font-bold text-lg text-slate-700 group-hover:text-slate-900">เจ้าของกิจการ</p>
                                        <p className="text-xs text-slate-400">เข้าถึงรายงานและตั้งค่า</p>
                                    </div>
                                </div>
                                <ArrowRight size={20} className="text-slate-300 group-hover:text-slate-800 group-hover:translate-x-1 transition-all"/>
                            </button>
                        ) : (
                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 animate-fade-in">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-slate-700 flex items-center gap-2 text-sm"><Lock size={16}/> รหัสผ่านเจ้าของ</h3>
                                    <button onClick={() => {setShowOwnerInput(false); setError(''); setPass('');}} className="text-slate-400 hover:text-slate-600 bg-white p-1 rounded-full shadow-sm"><X size={16}/></button>
                                </div>
                                <form onSubmit={handleOwnerLogin} className="space-y-3">
                                    <input 
                                        type="password" 
                                        placeholder="PIN Code" 
                                        className="w-full p-3 border-0 bg-white rounded-xl text-center text-2xl font-bold tracking-[0.5em] focus:ring-2 focus:ring-emerald-500 shadow-inner text-emerald-800 placeholder:text-slate-200 placeholder:font-normal placeholder:tracking-normal outline-none transition-all"
                                        value={pass}
                                        autoFocus
                                        onChange={(e) => {setPass(e.target.value); setError('');}}
                                    />
                                    {error && <p className="text-red-500 text-xs text-center font-medium bg-red-50 py-1 rounded-lg">{error}</p>}
                                    <button type="submit" className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all transform active:scale-95">
                                        เข้าสู่ระบบ
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                    © 2025 Chanpha Resort Management
                </div>
            </div>
        </div>
    );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); 

  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
    
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(true);

  const [reportMonth, setReportMonth] = useState(formatDate(new Date()).slice(0, 7)); 
  const [reportSelectedDay, setReportSelectedDay] = useState(null); 
  const [isReportDetailOpen, setIsReportDetailOpen] = useState(false); 

  const [dynamicCategories, setDynamicCategories] = useState(DEFAULT_EXPENSE_CATEGORIES);
  const [payeeHistory, setPayeeHistory] = useState([]);
  const [isRoomSettingsOpen, setIsRoomSettingsOpen] = useState(false);
  const [roomForm, setRoomForm] = useState({ id: '', name: '', type: '', price: '' });

  const [isLineModalOpen, setIsLineModalOpen] = useState(false);
  const [lineMessage, setLineMessage] = useState('');
  const [isBookingSummaryOpen, setIsBookingSummaryOpen] = useState(false);
  const [bookingSummaryText, setBookingSummaryText] = useState('');

  // Message Preview State
  const [isMessagePreviewOpen, setIsMessagePreviewOpen] = useState(false);
  const [messagePreviewText, setMessagePreviewText] = useState('');

  // Search State for Guest Directory
  const [guestSearchTerm, setGuestSearchTerm] = useState('');

  // Timeline State
  const [timelineStartDate, setTimelineStartDate] = useState(formatDate(new Date()));

  // Staff Mode State
  const [selectedStaffRooms, setSelectedStaffRooms] = useState([]);
  const [isStaffCheckInModalOpen, setIsStaffCheckInModalOpen] = useState(false);
  const [selectedBookedRoom, setSelectedBookedRoom] = useState(null); // For handling 'booked' room click in staff mode
  const [isStaffBookingModalOpen, setIsStaffBookingModalOpen] = useState(false);
  
  const [staffCheckInForm, setStaffCheckInForm] = useState({
      totalPrice: 0,
      paymentMethod: 'เงินสด',
      isReceiptNeeded: false,
      keyDepositCollected: false,
      billPhoto: null
  });

  const initialBookingForm = {
    id: '', docNo: '', checkInDocNo: '',
    guestName: '', phone: '', checkInDate: '', checkOutDate: '',
    nights: 1,
    deposit: 0, roomPrice: 0, note: '', keyDeposit: 100,
    extraBedPrice: 0, totalPaid: 0, paymentMethod: 'เงินสด',
    selectedAdditionalRooms: [], groupCheckInRooms: [],
    currentPayment: 0,
    licensePlate: '', idCard: '', lineId: '', dob: '', billPhoto: null
  };
  const [formData, setFormData] = useState(initialBookingForm);

  const initialExpenseForm = { docNo: '', title: '', amount: '', category: 'ของใช้สิ้นเปลือง (สบู่/ทิชชู่)', date: formatDate(new Date()), note: '', payee: '', paymentMethod: 'เงินสด', customCategory: '' };
  const [expenseForm, setExpenseForm] = useState(initialExpenseForm);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseModalMode, setExpenseModalMode] = useState('create');

  // Derived State
  const guestDirectory = useMemo(() => {
    const uniqueGuests = {};
    bookings.forEach(b => {
        if(b.guestName && b.guestName !== 'รายวัน walk-in') {
            const key = b.guestName.trim();
            if(!uniqueGuests[key]) {
                uniqueGuests[key] = {
                    name: b.guestName,
                    phone: b.phone || '',
                    licensePlate: b.licensePlate || '',
                    idCard: b.idCard || '',
                    lineId: b.lineId || '',
                    dob: b.dob || '',
                    lastVisit: b.checkInDate,
                    totalVisits: 0
                };
            }
            if(b.phone) uniqueGuests[key].phone = b.phone;
            if(b.licensePlate) uniqueGuests[key].licensePlate = b.licensePlate;
            if(b.idCard) uniqueGuests[key].idCard = b.idCard;
            if(b.lineId) uniqueGuests[key].lineId = b.lineId;
            if(b.dob) uniqueGuests[key].dob = b.dob;
            if(b.checkInDate > uniqueGuests[key].lastVisit) uniqueGuests[key].lastVisit = b.checkInDate;
            uniqueGuests[key].totalVisits += 1;
        }
    });
    return Object.values(uniqueGuests).sort((a,b) => b.lastVisit.localeCompare(a.lastVisit));
  }, [bookings]);

  const communicationData = useMemo(() => {
      const today = formatDate(new Date());
      const tomorrow = addDays(today, 1);
      
      const checkInTomorrow = bookings.filter(b => b.checkInDate === tomorrow && b.status !== 'cancelled').sort((a,b) => a.roomName.localeCompare(b.roomName));
      const checkedOutToday = bookings.filter(b => b.checkOutDate === today && b.status === 'checked-out').sort((a,b) => a.roomName.localeCompare(b.roomName));
      
      return { checkInTomorrow, checkedOutToday };
  }, [bookings]);

  // --- Auth & Data ---
  useEffect(() => {
    const init = async () => { 
        await signInAnonymously(auth); 
    };
    init();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    const qRooms = query(collection(db, 'artifacts', appId, 'public', 'data', 'rooms'));
    const unsubRooms = onSnapshot(qRooms, async (snapshot) => {
        if (snapshot.empty) { 
            await Promise.all(DEFAULT_ROOM_SEEDS.map(r => setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', r.id), r))); 
            setLoading(false); 
        } 
        else { 
            setRooms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b) => a.id.localeCompare(b.id, undefined, { numeric: true }))); 
            setLoading(false); 
        }
    });
    const qBookings = query(collection(db, 'artifacts', appId, 'public', 'data', 'bookings'));
    const unsubBookings = onSnapshot(qBookings, (snapshot) => setBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const qExpenses = query(collection(db, 'artifacts', appId, 'public', 'data', 'expenses'));
    const unsubExpenses = onSnapshot(qExpenses, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setExpenses(docs);
      setPayeeHistory([...new Set(docs.map(d => d.payee).filter(Boolean))]);
      setDynamicCategories([...new Set([...DEFAULT_EXPENSE_CATEGORIES, ...docs.map(d => d.category).filter(Boolean)])]);
    });
    return () => { unsubRooms(); unsubBookings(); unsubExpenses(); };
  }, [user]);

  const showNotification = (msg, type = 'success') => { setNotification({ message: msg, type }); setTimeout(() => setNotification(null), 3000); };

  // --- Logic ---
  const isRoomAvailable = (roomId, start, end, excludeBookingId = null) => {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    return !bookings.some(b => {
        if (b.id === excludeBookingId) return false;
        if (b.roomId !== roomId) return false;
        if (b.status === 'cancelled' || b.status === 'checked-out') return false;
        const bStart = new Date(b.checkInDate).getTime();
        const bEnd = new Date(b.checkOutDate).getTime();
        return s < bEnd && e > bStart;
    });
  };

  const checkRoomStatus = (roomId, date, includeCheckedOut = true) => {
    const targetTime = new Date(date).getTime();
    const todayTime = new Date(formatDate(new Date())).getTime();
    
    const relevantBookings = bookings.filter(b => b.roomId === roomId && b.status !== 'cancelled');
    
    const active = relevantBookings.find(b => {
       if (b.status !== 'occupied') return false;
       const start = new Date(b.checkInDate).getTime();
       const end = new Date(b.checkOutDate).getTime();
       if (targetTime >= start && targetTime < end) return true;
       if (targetTime >= end && targetTime <= todayTime) return true;
       return false;
    });
    if (active) return { status: 'occupied', booking: active };

    const booked = relevantBookings.find(b => {
        if (b.status !== 'booked') return false;
        const start = new Date(b.checkInDate).getTime();
        const end = new Date(b.checkOutDate).getTime();
        return targetTime >= start && targetTime < end;
    });
    if (booked) return { status: 'booked', booking: booked };

    if (includeCheckedOut) {
        const checkedOut = relevantBookings.find(b => {
            if (b.status !== 'checked-out') return false;
            return b.checkOutDate === date || (targetTime >= new Date(b.checkInDate).getTime() && targetTime < new Date(b.checkOutDate).getTime());
        });
        if (checkedOut) return { status: 'checked-out', booking: checkedOut };
    }

    return { status: 'available', booking: null };
  };

  const calculateGroupFinancials = () => {
     const targetBookings = formData.groupCheckInRooms.length > 0 ? bookings.filter(b => formData.groupCheckInRooms.includes(b.id)) : [];
     let grandTotalRoomPrice = 0;
     let grandTotalDeposit = 0;
     let previousTotalPaid = 0;

     targetBookings.forEach(b => {
         const n = calculateNights(b.checkInDate, b.checkOutDate);
         grandTotalRoomPrice += (b.roomPrice * n);
         grandTotalDeposit += (b.deposit || 0);
         previousTotalPaid += (b.totalPaid || 0);
     });
     
     const extra = Number(formData.extraBedPrice);
     const keyDep = Number(formData.keyDeposit);
     const totalBill = grandTotalRoomPrice + extra + keyDep;
     const alreadyPaid = grandTotalDeposit + previousTotalPaid;
     const remainingToCollect = totalBill - alreadyPaid;
     return { totalBill, remainingToCollect, grandTotalDeposit, grandTotalRoomPrice, count: targetBookings.length, alreadyPaid };
  };

  const calculateSingleFinancials = () => {
    const nights = calculateNights(formData.checkInDate, formData.checkOutDate);
    const roomTotal = Number(formData.roomPrice) * nights;
    const grandTotal = roomTotal + Number(formData.extraBedPrice) + Number(formData.keyDeposit); 
    const previouslyPaid = Number(formData.deposit) + Number(formData.totalPaid);
    const remainingToCollect = grandTotal - previouslyPaid;
    return { nights, roomTotal, grandTotal, remainingToCollect, previouslyPaid };
  };

  const handleRoomClick = (room, status, booking) => {
      // Staff Mode Logic
      if (role === 'staff') {
          if (status === 'booked') {
             // Handle checking in an existing booking (showing details)
             setSelectedBookedRoom({ room, booking });
             // Reset staff checkin form for single room booking check-in
             setStaffCheckInForm({
                 totalPrice: 0, // Not used here directly, calculated from booking
                 paymentMethod: 'เงินสด',
                 isReceiptNeeded: false,
                 keyDepositCollected: false,
                 billPhoto: null
             });
             setIsStaffBookingModalOpen(true);
             return;
          }
          
          // For available or checked-out (can re-sell), toggle selection
          if (status === 'available' || status === 'checked-out') {
              if (selectedStaffRooms.includes(room.id)) {
                  setSelectedStaffRooms(prev => prev.filter(id => id !== room.id));
              } else {
                  setSelectedStaffRooms(prev => [...prev, room.id]);
              }
          }
          // For occupied, toggle selection for checkout
          if (status === 'occupied') {
              if (selectedStaffRooms.includes(room.id)) {
                  setSelectedStaffRooms(prev => prev.filter(id => id !== room.id));
              } else {
                  setSelectedStaffRooms(prev => [...prev, room.id]);
              }
          }
          return;
      }

      // Owner Mode Logic
      setSelectedRoom(room);
      if (status === 'available' || status === 'checked-out') {
          const nextDay = new Date(selectedDate); nextDay.setDate(nextDay.getDate() + 1);
          setFormData({
            ...initialBookingForm, checkInDate: selectedDate, checkOutDate: formatDate(nextDay), nights: 1,
            roomPrice: room.price, deposit: 0, docNo: '', checkInDocNo: '', selectedAdditionalRooms: [], groupCheckInRooms: []
          });
          setIsBookingModalOpen(true);
      } else {
          const groupBookings = bookings.filter(b => b.docNo === booking.docNo && b.status === booking.status && b.id !== booking.id);
          const allGroupIds = [booking.id, ...groupBookings.map(b => b.id)];
          const nights = calculateNights(booking.checkInDate, booking.checkOutDate);
          setFormData({
            ...initialBookingForm, ...booking, id: booking.id,
            checkInDate: booking.checkInDate, checkOutDate: booking.checkOutDate, nights,
            deposit: Number(booking.deposit), roomPrice: Number(booking.roomPrice),
            keyDeposit: booking.keyDeposit ? Number(booking.keyDeposit) : (100 * allGroupIds.length),
            selectedAdditionalRooms: [], groupCheckInRooms: allGroupIds,
            currentPayment: 0,
            licensePlate: booking.licensePlate || '', idCard: booking.idCard || '', lineId: booking.lineId || '', dob: booking.dob || '', billPhoto: booking.billPhoto || null
          });
          if (status === 'booked') setIsBookingModalOpen(true);
          else setIsCheckInModalOpen(true);
      }
  };

  const handleStaffBulkAction = async (actionType) => {
      if (selectedStaffRooms.length === 0) return;

      if (actionType === 'checkin') {
          // Calculate total price of selected rooms
          let total = 0;
          selectedStaffRooms.forEach(rId => {
              const room = rooms.find(r => r.id === rId);
              // Only sum available/checked-out rooms
              const { status } = checkRoomStatus(rId, selectedDate, true);
              if (status !== 'occupied' && status !== 'booked') {
                  total += room.price;
              }
          });
          setStaffCheckInForm({
              totalPrice: total,
              paymentMethod: 'เงินสด',
              isReceiptNeeded: false,
              keyDepositCollected: false,
              billPhoto: null
          });
          setIsStaffCheckInModalOpen(true);
      } else if (actionType === 'checkout') {
          if (!confirm(`ยืนยันคืนห้องจำนวน ${selectedStaffRooms.length} ห้อง?`)) return;
          try {
              const batchPromises = selectedStaffRooms.map(rId => {
                  const { status, booking } = checkRoomStatus(rId, selectedDate, false);
                  if (status !== 'occupied') return null;
                  
                  return updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', booking.id), {
                      status: 'checked-out',
                      checkOutDate: selectedDate,
                      checkOutTime: Timestamp.now(),
                      keyDepositReturned: true
                  });
              }).filter(Boolean);

              if(batchPromises.length > 0) await Promise.all(batchPromises);
              showNotification(`คืนห้อง ${batchPromises.length} ห้อง เรียบร้อยแล้ว`);
              setSelectedStaffRooms([]);
          } catch (e) {
              console.error(e);
              showNotification('เกิดข้อผิดพลาด', 'error');
          }
      }
  };

  const confirmStaffCheckIn = async (isBookedRoom = false) => {
      const nextDay = new Date(selectedDate); nextDay.setDate(nextDay.getDate() + 1);
      const checkoutDate = formatDate(nextDay);
      const checkInDocNo = generateSequentialDocNo('RC', selectedDate, bookings);
      
      // Process Image
      let billPhotoString = null;
      if (staffCheckInForm.billPhoto) {
          try {
              billPhotoString = await compressImage(staffCheckInForm.billPhoto);
          } catch (e) { console.error("Error compressing image", e); }
      }

      try {
          if (isBookedRoom && selectedBookedRoom) {
              // Handle Single Booked Room Check-in
              const { booking } = selectedBookedRoom;
              await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', booking.id), {
                  status: 'occupied',
                  checkInTime: Timestamp.now(),
                  checkInDocNo: checkInDocNo,
                  keyDeposit: staffCheckInForm.keyDepositCollected ? 100 : 0, 
                  totalPaid: (booking.totalPrice - booking.deposit) + (staffCheckInForm.keyDepositCollected ? 100 : 0), 
                  paymentMethod: staffCheckInForm.paymentMethod,
                  isReceiptRequested: staffCheckInForm.isReceiptNeeded,
                  billPhoto: billPhotoString
              });
              setIsStaffBookingModalOpen(false);
              showNotification('เช็คอินลูกค้าจอง เรียบร้อยแล้ว');
          } else {
              // Handle Walk-in Bulk
              const batchPromises = selectedStaffRooms.map((rId) => {
                  const room = rooms.find(r => r.id === rId);
                  const { status } = checkRoomStatus(rId, selectedDate, true);
                  if (status === 'occupied' || status === 'booked') return null;

                  return addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'bookings'), {
                      roomId: rId, roomName: room.name, roomPrice: room.price,
                      guestName: 'รายวัน walk-in', phone: '', 
                      checkInDate: selectedDate, checkOutDate: checkoutDate, nights: 1,
                      totalPrice: room.price, 
                      totalPaid: room.price, 
                      deposit: 0, 
                      keyDeposit: staffCheckInForm.keyDepositCollected ? 100 : 0, 
                      extraBedPrice: 0,
                      paymentMethod: staffCheckInForm.paymentMethod,
                      isReceiptRequested: staffCheckInForm.isReceiptNeeded,
                      billPhoto: billPhotoString,
                      status: 'occupied',
                      docNo: generateSequentialDocNo('BK', selectedDate, bookings),
                      checkInDocNo: checkInDocNo,
                      checkInTime: Timestamp.now(),
                      updatedAt: Timestamp.now(), updatedBy: 'staff-mode'
                  });
              }).filter(Boolean);
              
              if(batchPromises.length > 0) await Promise.all(batchPromises);
              showNotification(`เช็คอินเรียบร้อย`);
              setIsStaffCheckInModalOpen(false);
              setSelectedStaffRooms([]);
          }
      } catch (e) {
          console.error(e);
          showNotification('เกิดข้อผิดพลาด', 'error');
      }
  };

  const handleGuestNameChange = (e) => {
    const val = e.target.value;
    const match = guestDirectory.find(g => g.name === val);
    setFormData(prev => ({ 
        ...prev, 
        guestName: val, 
        phone: match ? match.phone : prev.phone,
        licensePlate: match ? match.licensePlate : prev.licensePlate,
        idCard: match ? match.idCard : prev.idCard,
        lineId: match ? match.lineId : prev.lineId,
        dob: match ? match.dob : prev.dob
    }));
  };

  const handleDateChange = (field, value) => {
      if (field === 'checkInDate') {
          const newCheckout = addDays(value, formData.nights);
          setFormData(prev => ({ ...prev, checkInDate: value, checkOutDate: newCheckout }));
      } else if (field === 'nights') {
          const n = parseInt(value) || 1;
          const newCheckout = addDays(formData.checkInDate, n);
          setFormData(prev => ({ ...prev, nights: n, checkOutDate: newCheckout }));
      } else if (field === 'checkOutDate') {
          const n = calculateNights(formData.checkInDate, value);
          setFormData(prev => ({ ...prev, checkOutDate: value, nights: n > 0 ? n : 1 }));
      }
  };

  const openLineReport = () => {
    const occupiedList = []; const bookedList = []; const availableList = [];
    rooms.forEach(r => {
        const { status, booking } = checkRoomStatus(r.id, selectedDate, false);
        if (status === 'occupied') {
            const nights = booking.nights || 1;
            const totalCost = (booking.roomPrice * nights) + (booking.extraBedPrice || 0) + (booking.keyDeposit || 0);
            const totalPaid = (booking.totalPaid || 0) + (booking.deposit || 0);
            const remaining = totalCost - totalPaid;
            const statusText = remaining > 0 ? `(ค้าง ${remaining.toLocaleString()})` : '(ครบ)';
            occupiedList.push(`${r.name} (${booking.guestName}) ${statusText}`);
        }
        else if (status === 'booked') {
            bookedList.push(`${r.name} (${booking.guestName}) - มัดจำ ${Number(booking.deposit || 0).toLocaleString()}`);
        }
        else availableList.push(r.name);
    });
    const message = `สรุปห้องพัก "จันผารีสอร์ท" \nวันที่: ${selectedDate}\n--------------------\n✅ ว่าง (${availableList.length}):\n${availableList.length > 0 ? availableList.join(', ') : '-'}\n\n🏠 เข้าพัก (${occupiedList.length}):\n${occupiedList.length > 0 ? occupiedList.join('\n') : '-'}\n\n📒 จองไว้ (${bookedList.length}):\n${bookedList.length > 0 ? bookedList.join('\n') : '-'}\n--------------------`;
    setLineMessage(message);
    setIsLineModalOpen(true);
  };

  const copyToClipboard = (text) => {
    try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.top = "0"; textArea.style.left = "0"; textArea.style.position = "fixed"; textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (successful) showNotification("คัดลอกแล้ว"); else showNotification("คัดลอกไม่สำเร็จ", "error");
    } catch (err) { showNotification("เกิดข้อผิดพลาด", "error"); }
  };

  const openMessagePreview = (text) => {
      setMessagePreviewText(text);
      setIsMessagePreviewOpen(true);
  };

  const confirmSendMessage = () => {
      const encodedText = encodeURIComponent(messagePreviewText);
      const lineUrl = `https://line.me/R/msg/text/?${encodedText}`;
      window.open(lineUrl, '_blank');
      setIsMessagePreviewOpen(false);
  };

  const handleSaveRoom = async (e) => {
      e.preventDefault();
      if(!roomForm.id || !roomForm.name || !roomForm.price) return alert('กรุณากรอกข้อมูลให้ครบ');
      try { await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomForm.id), { ...roomForm, price: Number(roomForm.price) }); showNotification('บันทึกห้องพักแล้ว'); setRoomForm({ id: '', name: '', type: '', price: '' }); } catch(error) { showNotification('เกิดข้อผิดพลาด', 'error'); }
  };
  const handleDeleteRoom = async (rid) => {
      if(!confirm('ยืนยันลบห้องนี้?')) return;
      try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', rid)); showNotification('ลบห้องพักสำเร็จ'); } catch(e){ showNotification('ลบไม่สำเร็จ', 'error'); }
  };

  const handleBookingSave = async (e) => {
    e.preventDefault();
    if (!user) return;
    
    if(!formData.guestName || !formData.phone) return alert('กรุณากรอกชื่อและเบอร์โทรศัพท์');

    if (!formData.id) { 
        if (!isRoomAvailable(selectedRoom.id, formData.checkInDate, formData.checkOutDate)) return alert(`ห้อง ${selectedRoom.name} ไม่ว่างในช่วงเวลานี้`);
        for (const rid of formData.selectedAdditionalRooms) {
            if (!isRoomAvailable(rid, formData.checkInDate, formData.checkOutDate)) return alert(`ห้องไม่ว่างในช่วงเวลานี้`);
        }
    } else {
        if (!isRoomAvailable(selectedRoom.id, formData.checkInDate, formData.checkOutDate, formData.id)) return alert(`ห้องไม่ว่างในช่วงเวลานี้`);
    }

    const nights = calculateNights(formData.checkInDate, formData.checkOutDate);
    const commonData = {
      guestName: formData.guestName, phone: formData.phone, checkInDate: formData.checkInDate, checkOutDate: formData.checkOutDate,
      nights, note: formData.note, updatedAt: Timestamp.now(), updatedBy: user.uid,
      // Save new fields
      licensePlate: formData.licensePlate || '', idCard: formData.idCard || '', lineId: formData.lineId || '', dob: formData.dob || ''
    };

    try {
      if (!formData.id) { 
        const depositDocNo = generateSequentialDocNo('BK', formData.checkInDate, bookings);
        const roomsToBook = [selectedRoom.id, ...formData.selectedAdditionalRooms];
        const batchPromises = roomsToBook.map((rId, index) => {
            const rConfig = rooms.find(r => r.id === rId);
            return addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'bookings'), {
                ...commonData, roomId: rConfig.id, roomName: rConfig.name, roomPrice: rConfig.price,
                totalPrice: rConfig.price * nights, deposit: index === 0 ? Number(formData.deposit) : 0,
                docNo: depositDocNo, checkInDocNo: '', status: 'booked', createdAt: Timestamp.now(),
                keyDeposit: 0, extraBedPrice: 0, totalPaid: 0, paymentMethod: 'เงินสด'
            });
        });
        await Promise.all(batchPromises);
        const summary = generateBookingSummary(
            formData.guestName,
            roomsToBook.map(id => rooms.find(r=>r.id===id).name).join(', '),
            formData.checkInDate,
            nights,
            formData.deposit,
            depositDocNo
        );
        setBookingSummaryText(summary);
        setIsBookingSummaryOpen(true);
        setIsBookingModalOpen(false);
      } else {
         const roomsToBook = [...formData.selectedAdditionalRooms];
         if(roomsToBook.length > 0) {
             const depositDocNo = formData.docNo;
             const batchPromises = roomsToBook.map((rId) => {
                const rConfig = rooms.find(r => r.id === rId);
                return addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'bookings'), {
                    ...commonData, roomId: rConfig.id, roomName: rConfig.name, roomPrice: rConfig.price,
                    totalPrice: rConfig.price * nights, deposit: 0,
                    docNo: depositDocNo, checkInDocNo: '', status: 'booked', createdAt: Timestamp.now(),
                    keyDeposit: 0, extraBedPrice: 0, totalPaid: 0, paymentMethod: 'เงินสด'
                });
             });
             await Promise.all(batchPromises);
         }
         await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', formData.id), {
             ...commonData, roomPrice: Number(formData.roomPrice), totalPrice: Number(formData.roomPrice) * nights, deposit: Number(formData.deposit)
         });
         
         const summary = generateBookingSummary(
            formData.guestName,
            formData.roomName,
            formData.checkInDate,
            nights,
            formData.deposit,
            formData.docNo
        );
        setBookingSummaryText(summary);
        setIsBookingSummaryOpen(true);

         showNotification('อัปเดตข้อมูลการจองสำเร็จ');
         setIsBookingModalOpen(false);
      }
    } catch (error) { console.error(error); showNotification('เกิดข้อผิดพลาด', 'error'); }
  };

  const handleCheckInSave = async () => {
     if (!user) return;
     const newRcDocNo = formData.checkInDocNo || generateSequentialDocNo('RC', formatDate(new Date()), bookings);
     const paymentInHand = Number(formData.currentPayment);
     
     try {
         const commonUpdate = {
             licensePlate: formData.licensePlate || '',
             idCard: formData.idCard || '',
             lineId: formData.lineId || '',
             dob: formData.dob || '',
             guestName: formData.guestName,
             phone: formData.phone
         };

         if (formData.groupCheckInRooms.length > 1) {
             const allGroupBookings = bookings.filter(b => formData.groupCheckInRooms.includes(b.id));
             let remainingPool = allGroupBookings.reduce((sum, b) => sum + (b.totalPaid || 0), 0) + paymentInHand;
             const updates = allGroupBookings.map(b => {
                 const nights = calculateNights(b.checkInDate, b.checkOutDate);
                 const roomCost = b.roomPrice * nights;
                 let allocated = 0;
                 if (remainingPool >= roomCost) { allocated = roomCost; remainingPool -= roomCost; } 
                 else { allocated = remainingPool; remainingPool = 0; }
                 return { id: b.id, allocated, isPrimary: b.id === formData.id };
             });
             const primaryUpdate = updates.find(u => u.isPrimary);
             if (primaryUpdate) primaryUpdate.allocated += remainingPool;
             const batch = updates.map(u => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', u.id), {
                 ...commonUpdate,
                 status: 'occupied', checkInTime: Timestamp.now(), checkInDocNo: newRcDocNo,
                 totalPaid: u.allocated, keyDeposit: u.isPrimary ? Number(formData.keyDeposit) : 0, 
                 extraBedPrice: u.isPrimary ? Number(formData.extraBedPrice) : 0,
                 paymentMethod: formData.paymentMethod
             }));
             await Promise.all(batch);
         } else {
             const newTotalPaid = Number(formData.totalPaid) + paymentInHand;
             await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', formData.id), {
                 ...commonUpdate,
                 status: 'occupied', checkInTime: Timestamp.now(), checkInDocNo: newRcDocNo,
                 keyDeposit: Number(formData.keyDeposit), extraBedPrice: Number(formData.extraBedPrice),
                 totalPaid: newTotalPaid, paymentMethod: formData.paymentMethod
             });
         }
         showNotification(`บันทึกรายการเรียบร้อย`);
         setIsCheckInModalOpen(false);
     } catch(err) { console.error(err); showNotification('เกิดข้อผิดพลาด', 'error'); }
  };

  const handleCheckout = async () => {
     if(!formData.id) return;
     const today = formatDate(new Date());
     const originalCheckout = formData.checkOutDate;
     const earlyCheckout = today < originalCheckout && today >= formData.checkInDate;
     
     if(earlyCheckout) {
         const newNights = calculateNights(formData.checkInDate, today);
         const actualNights = newNights > 0 ? newNights : 1;
         const newPrice = formData.roomPrice * actualNights;
         if(confirm(`ลูกค้าคืนห้องก่อนกำหนด (${actualNights} คืน)\nต้องการปรับปรุงยอดเงินค่าห้องเป็น ${newPrice.toLocaleString()} บาท หรือไม่?`)) {
             try {
                 await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', formData.id), {
                     checkOutDate: today, nights: actualNights, totalPrice: newPrice,
                     status: 'checked-out', checkOutTime: Timestamp.now(), keyDepositReturned: true
                 });
                 setIsCheckInModalOpen(false); showNotification("เช็คเอาท์และปรับปรุงยอดเงินเรียบร้อย ✅"); return;
             } catch(e) { showNotification('เกิดข้อผิดพลาด', 'error'); return; }
         }
     }
     if(!confirm(`คืนมัดจำกุญแจ ${formData.keyDeposit} บาท แล้ว?\n\nยืนยันเช็คเอาท์?`)) return;
     try {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', formData.id), { status: 'checked-out', checkOutTime: Timestamp.now(), keyDepositReturned: true });
        setIsCheckInModalOpen(false); showNotification("เช็คเอาท์เรียบร้อย ✅");
     } catch (error) { showNotification("เกิดข้อผิดพลาด", "error"); }
  };

  const handleCheckoutSingle = async (bid, keyDep) => {
     if(!confirm(`ยืนยันเช็คเอาท์ห้องนี้? ${keyDep > 0 ? `(อย่าลืมคืนมัดจำ ${keyDep} บาท)` : ''}`)) return;
     try {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', bid), { status: 'checked-out', checkOutTime: Timestamp.now(), keyDepositReturned: true });
        showNotification("เช็คเอาท์เรียบร้อย ✅");
     } catch (error) { showNotification("เกิดข้อผิดพลาด", "error"); }
  };

  const handleDeleteBooking = async () => {
      if(!confirm('ต้องการยกเลิกการจองนี้หรือไม่?')) return;
      try {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', formData.id));
          setIsBookingModalOpen(false); showNotification("ยกเลิกการจองสำเร็จ");
      } catch (error) { showNotification("เกิดข้อผิดพลาด", "error"); }
  };

  const goToCheckIn = () => {
      setIsBookingModalOpen(false);
      setTimeout(() => setIsCheckInModalOpen(true), 100);
  };

  const openExpenseModal = (expense = null) => {
     if (expense) { setExpenseModalMode('edit'); setExpenseForm({ ...initialExpenseForm, ...expense, amount: expense.amount, customCategory: '' }); } 
     else { setExpenseModalMode('create'); setExpenseForm({ ...initialExpenseForm, docNo: '', customCategory: '' }); }
     setIsExpenseModalOpen(true);
  };
  const handleExpenseSubmit = async (e) => {
    e.preventDefault(); if (!user) return;
    const finalCategory = expenseForm.category === 'เพิ่มหมวดหมู่ใหม่...' ? expenseForm.customCategory : expenseForm.category;
    if (!finalCategory) return alert('ระบุหมวดหมู่');
    const payload = { ...expenseForm, amount: Number(expenseForm.amount), category: finalCategory, updatedAt: Timestamp.now(), updatedBy: user.uid };
    delete payload.customCategory; 
    try {
      if (expenseModalMode === 'create') {
         const newDocNo = generateSequentialDocNo('EX', expenseForm.date, expenses);
         await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'expenses'), { ...payload, docNo: newDocNo, createdAt: Timestamp.now() });
         showNotification(`บันทึกรายจ่ายสำเร็จ`);
      } else { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'expenses', expenseForm.id), payload); showNotification('แก้ไขสำเร็จ'); }
      setIsExpenseModalOpen(false);
    } catch (e) {}
  };
  const handleDeleteExpense = async () => { if(confirm('ลบ?')) { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'expenses', expenseForm.id)); setIsExpenseModalOpen(false); } };

  // Image Compression
  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxWidth = 800;
                const scale = maxWidth / img.width;
                canvas.width = maxWidth;
                canvas.height = img.height * scale;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                // Compress to JPEG with 0.7 quality
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};

  // Report Logic
  const reportData = useMemo(() => {
    const targetMonth = reportMonth;
    const dailyRevenue = {};
    const daysInMonth = new Date(Number(targetMonth.split('-')[0]), Number(targetMonth.split('-')[1]), 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) dailyRevenue[`${targetMonth}-${String(i).padStart(2, '0')}`] = 0;
    let monthlyRevenue = 0, monthlyExpense = 0;
    const roomRevenue = {}, reportBookings = [], reportExpenses = [], expenseCats = {};

    Object.keys(dailyRevenue).forEach(dayDate => {
        bookings.forEach(b => {
            if (b.status === 'occupied' || b.status === 'checked-out') {
                if (dayDate >= b.checkInDate && dayDate < b.checkOutDate) {
                    const totalRoomRev = (b.totalPrice || 0) + (b.extraBedPrice || 0);
                    const nights = b.nights || 1;
                    const dailyAvg = totalRoomRev / nights;
                    dailyRevenue[dayDate] += dailyAvg;
                }
            }
        });
        monthlyRevenue += dailyRevenue[dayDate];
    });

    bookings.forEach(b => {
       if (b.checkInDate.startsWith(targetMonth) && (b.status === 'occupied' || b.status === 'checked-out')) {
           const revenue = (b.totalPrice || 0) + (b.extraBedPrice || 0);
           roomRevenue[b.roomName] = (roomRevenue[b.roomName] || 0) + revenue;
           reportBookings.push({ Type: 'รายได้', DocNo: b.checkInDocNo || b.docNo, Date: b.checkInDate, Room: b.roomName, Customer: b.guestName, Amount: revenue });
       }
    });

    expenses.forEach(ex => { if(ex.date.startsWith(targetMonth)) { monthlyExpense += ex.amount; reportExpenses.push({ ...ex }); expenseCats[ex.category] = (expenseCats[ex.category] || 0) + ex.amount; }});
    
    reportBookings.sort((a, b) => a.Date.localeCompare(b.Date));
    reportExpenses.sort((a, b) => a.date.localeCompare(b.date));

    const roomPieData = Object.keys(roomRevenue).map(name => ({ name, value: roomRevenue[name] })).sort((a, b) => b.value - a.value);
    roomPieData.forEach(item => {
        let nights = 0;
        bookings.forEach(b => {
            if(b.roomName === item.name && b.checkInDate.startsWith(targetMonth) && (b.status === 'occupied' || b.status === 'checked-out')) nights += (b.nights || 0);
        });
        item.totalNights = nights;
    });

    return { 
        monthlyRevenue, monthlyExpense, netProfit: monthlyRevenue - monthlyExpense, 
        lineData: Object.keys(dailyRevenue).sort().map(date => ({ date: date.split('-')[2], revenue: dailyRevenue[date] })),
        roomPieData,
        expensePieData: Object.keys(expenseCats).map(name => ({ name, value: expenseCats[name] })), 
        reportBookings, reportExpenses 
    };
  }, [bookings, expenses, reportMonth]);

  const dailyDetails = useMemo(() => {
      if (!reportSelectedDay) return [];
      const details = [];
      bookings.forEach(b => {
          if (b.status === 'occupied' || b.status === 'checked-out') {
              if (reportSelectedDay >= b.checkInDate && reportSelectedDay < b.checkOutDate) {
                  const totalRoomRev = (b.totalPrice || 0) + (b.extraBedPrice || 0);
                  const nights = b.nights || 1;
                  const dailyAvg = totalRoomRev / nights;
                  details.push({ room: b.roomName, guest: b.guestName, amount: dailyAvg });
              }
          }
      });
      return details.sort((a,b) => {
          const roomA = a.room.replace(/\D/g, '');
          const roomB = b.room.replace(/\D/g, '');
          if (roomA && roomB) return parseInt(roomA) - parseInt(roomB);
          return a.room.localeCompare(b.room);
      });
  }, [bookings, reportSelectedDay]);

  const dashboardStats = useMemo(() => {
      let occupied = 0;
      let booked = 0;
      rooms.forEach(r => {
        const { status } = checkRoomStatus(r.id, selectedDate, false);
        if (status === 'occupied') occupied++;
        else if (status === 'booked') booked++;
      });
      const total = rooms.length;
      return { total, occupied, booked, available: total - occupied - booked };
  }, [bookings, rooms, selectedDate]);

  if (loading) return <div className="h-screen flex items-center justify-center text-emerald-600 font-bold bg-slate-100 animate-pulse">กำลังโหลดข้อมูล...</div>;
  if (!role) return <LoginScreen onLogin={setRole} />;

  const availableRoomsForAdd = rooms.filter(r => { if (r.id === selectedRoom?.id) return false; return isRoomAvailable(r.id, formData.checkInDate, formData.checkOutDate); });
  
  const fin = formData.groupCheckInRooms.length > 1 ? calculateGroupFinancials() : calculateSingleFinancials();
  const isGroupCheckIn = formData.groupCheckInRooms.length > 1;
  const grandTotal = isGroupCheckIn ? fin.totalBill : fin.grandTotal;
  const alreadyPaid = isGroupCheckIn ? fin.alreadyPaid : fin.previouslyPaid;
  const remainingBalance = grandTotal - alreadyPaid;
  const remainingAfterCurrentPay = remainingBalance - Number(formData.currentPayment);
  const createTotalRoomCost = formData.selectedAdditionalRooms.reduce((sum, id) => { const r = rooms.find(rm => rm.id === id); return sum + (r ? r.price : 0); }, Number(formData.roomPrice));
  const createGrandTotal = (createTotalRoomCost * formData.nights);
  const currentBookingStatus = bookings.find(b => b.id === formData.id)?.status;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 pb-28 md:pb-20 font-sans">
      {notification && <div className={`fixed top-6 right-6 px-6 py-4 rounded-2xl shadow-xl z-[70] text-white font-medium flex items-center gap-2 animate-fade-in ${notification.type === 'error' ? 'bg-red-500' : 'bg-emerald-600'}`}>{notification.type === 'error' ? <AlertCircle size={20}/> : <CheckCircle size={20}/>} {notification.message}</div>}

      <header className="bg-white/95 backdrop-blur-md text-emerald-900 shadow-sm sticky top-0 z-40 border-b border-white">
        <div className="container mx-auto px-4 md:px-6 py-3 flex justify-between items-center relative">
          <div className="flex items-center gap-3">
              <div className="bg-gradient-to-tr from-emerald-500 to-teal-400 text-white p-2 rounded-xl font-bold shadow-md shadow-emerald-200">CR</div>
              <div>
                  <h1 className="text-xl font-extrabold tracking-tight">Chanpha Resort</h1>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{role === 'owner' ? 'Owner Mode' : 'Staff Mode'}</span>
              </div>
          </div>
          
          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-3">
              {role === 'owner' && (
                  <div className="flex bg-slate-100/80 p-1 rounded-2xl gap-1">
                    <button onClick={() => setCurrentView('dashboard')} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${currentView === 'dashboard' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><Calendar size={18} /> <span className="hidden md:inline">หน้าหลัก</span></button>
                    <button onClick={() => setCurrentView('timeline')} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${currentView === 'timeline' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><LayoutList size={18} /> <span className="hidden md:inline">ไทม์ไลน์</span></button>
                    <button onClick={() => setCurrentView('customers')} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${currentView === 'customers' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><Users size={18} /> <span className="hidden md:inline">ลูกค้า</span></button>
                    <button onClick={() => setCurrentView('expenses')} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${currentView === 'expenses' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><Wallet size={18} /> <span className="hidden md:inline">รายจ่าย</span></button>
                    <button onClick={() => setCurrentView('report')} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${currentView === 'report' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><BarChart2 size={18} /> <span className="hidden md:inline">รายงาน</span></button>
                  </div>
              )}
              {role === 'staff' && (
                  <div className="bg-emerald-50 px-4 py-2 rounded-xl text-emerald-700 font-bold text-sm border border-emerald-100">
                      โหมดใช้งานง่าย (Walk-in)
                  </div>
              )}
              <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>
              {role === 'owner' && <button onClick={() => setIsRoomSettingsOpen(true)} className="p-3 bg-white border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 hover:text-emerald-600 transition-colors shadow-sm"><Settings size={18}/></button>}
              <button onClick={() => setRole(null)} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 hover:text-red-600 transition-colors shadow-sm"><LogOut size={18}/></button>
          </div>

          {/* Mobile Menu Button */}
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-emerald-600 shadow-sm active:scale-95 transition-all">
            {isMobileMenuOpen ? <X size={22}/> : <Menu size={22}/>}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {isMobileMenuOpen && (
            <div className="md:hidden absolute top-full left-0 w-full bg-white/95 backdrop-blur-lg border-t border-slate-100 shadow-xl py-4 px-6 flex flex-col gap-2 z-50 animate-fade-in">
                <button onClick={() => {setCurrentView('dashboard'); setIsMobileMenuOpen(false);}} className={`p-4 rounded-xl text-lg font-bold flex items-center gap-3 ${currentView === 'dashboard' ? 'bg-emerald-50 text-emerald-600' : 'text-slate-500'}`}><Calendar size={24} /> หน้าหลัก</button>
                {role === 'owner' && (
                    <>
                        <button onClick={() => {setCurrentView('timeline'); setIsMobileMenuOpen(false);}} className={`p-4 rounded-xl text-lg font-bold flex items-center gap-3 ${currentView === 'timeline' ? 'bg-emerald-50 text-emerald-600' : 'text-slate-500'}`}><LayoutList size={24} /> ไทม์ไลน์</button>
                        <button onClick={() => {setCurrentView('customers'); setIsMobileMenuOpen(false);}} className={`p-4 rounded-xl text-lg font-bold flex items-center gap-3 ${currentView === 'customers' ? 'bg-emerald-50 text-emerald-600' : 'text-slate-500'}`}><Users size={24} /> ข้อมูลลูกค้า</button>
                        <button onClick={() => {setCurrentView('expenses'); setIsMobileMenuOpen(false);}} className={`p-4 rounded-xl text-lg font-bold flex items-center gap-3 ${currentView === 'expenses' ? 'bg-emerald-50 text-emerald-600' : 'text-slate-500'}`}><Wallet size={24} /> รายจ่าย</button>
                        <button onClick={() => {setCurrentView('report'); setIsMobileMenuOpen(false);}} className={`p-4 rounded-xl text-lg font-bold flex items-center gap-3 ${currentView === 'report' ? 'bg-emerald-50 text-emerald-600' : 'text-slate-500'}`}><BarChart2 size={24} /> รายงาน</button>
                        <hr className="my-2 border-slate-100"/>
                        <button onClick={() => {setIsRoomSettingsOpen(true); setIsMobileMenuOpen(false);}} className="p-4 rounded-xl text-lg font-bold flex items-center gap-3 text-slate-500"><Settings size={24}/> ตั้งค่า</button>
                    </>
                )}
                <button onClick={() => setRole(null)} className="p-4 rounded-xl text-lg font-bold flex items-center gap-3 text-red-500 bg-red-50"><LogOut size={24}/> ออกจากระบบ</button>
            </div>
        )}
      </header>

      <div className="container mx-auto p-3 md:p-6">
        {currentView === 'dashboard' && (
          <div className="space-y-6 animate-fade-in relative">
            {/* Controls */}
            <div className="bg-white/80 backdrop-blur rounded-2xl p-2 flex justify-between items-center gap-2 shadow-sm border border-white">
               <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl shadow-inner border border-slate-100 flex-1 justify-center">
                  <button onClick={() => {const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(formatDate(d));}} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-emerald-600 transition-colors">◀</button>
                  <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-transparent font-black text-lg md:text-xl text-slate-800 outline-none text-center px-1 cursor-pointer font-mono" />
                  <button onClick={() => {const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(formatDate(d));}} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-emerald-600 transition-colors">▶</button>
               </div>
               {role === 'owner' && <button onClick={openLineReport} className="bg-[#06C755] text-white px-4 py-2.5 rounded-xl shadow-lg shadow-green-100 text-sm font-bold flex items-center justify-center gap-1 hover:bg-[#05b54d] transition-transform transform active:scale-95"><MessageSquare size={18}/><span className="hidden md:inline"> สรุป LINE</span></button>}
            </div>

            {/* Room Grid */}
            <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-6 ${role === 'staff' ? 'pb-32' : ''}`}>
              {rooms.map((room) => {
                const { status, booking } = checkRoomStatus(room.id, selectedDate, true);
                
                // --- Styling Logic ---
                let cardClass = "bg-white border-2 border-white hover:border-emerald-300 shadow-sm";
                let statusColor = "bg-slate-100 text-slate-500"; let statusLabel = "ว่าง";
                let icon = <Plus size={28} className="text-slate-300 group-hover:text-emerald-500 transition-colors"/>;
                
                const isOverstay = status === 'occupied' && new Date(selectedDate) >= new Date(booking?.checkOutDate) && selectedDate !== booking?.checkOutDate;
                let remainingAmount = 0;
                
                if (status === 'occupied') {
                      const nights = booking.nights || 1;
                      const totalCost = (booking.roomPrice * nights) + (booking.extraBedPrice || 0) + (booking.keyDeposit || 0);
                      const totalPaid = (booking.totalPaid || 0) + (booking.deposit || 0);
                      remainingAmount = totalCost - totalPaid;
                }

                if (status === 'booked') { cardClass = "bg-yellow-50 border-2 border-yellow-200 shadow-sm"; statusColor = "bg-yellow-200 text-yellow-800"; statusLabel = "จอง"; icon = <Calendar size={24} className="text-yellow-500"/>; }
                if (status === 'occupied') { cardClass = "bg-blue-50 border-2 border-blue-200 shadow-sm"; statusColor = "bg-blue-200 text-blue-800"; statusLabel = "พัก"; icon = <User size={24} className="text-blue-500"/>; }
                if (status === 'checked-out') { cardClass = "bg-slate-200 border-2 border-slate-300 opacity-80 grayscale"; statusColor = "bg-slate-300 text-slate-600"; statusLabel = "ออกแล้ว"; icon = <LogOut size={24} className="text-slate-500"/>; }
                if (isOverstay) { cardClass = "bg-red-50 border-2 border-red-200 shadow-sm"; statusColor = "bg-red-200 text-red-800"; statusLabel = "เกิน"; icon = <AlertCircle size={24} className="text-red-500"/>; }

                // --- Staff Selection Logic ---
                const isSelected = selectedStaffRooms.includes(room.id);
                if (role === 'staff') {
                    if (isSelected) {
                        cardClass = "bg-emerald-50 border-2 border-emerald-500 ring-2 ring-emerald-200 transform scale-95 transition-all shadow-md";
                    }
                }

                return (
                  <div key={room.id} onClick={() => handleRoomClick(room, status, booking)} className={`relative p-4 md:p-6 rounded-3xl cursor-pointer transition-all h-44 md:h-56 flex flex-col justify-between group select-none ${cardClass}`}>
                    <div className="flex justify-between items-start">
                        <span className="font-extrabold text-xl md:text-2xl text-slate-800">{room.name}</span>
                        <div className={`px-2.5 py-1 rounded-lg text-[10px] md:text-xs font-black tracking-wider uppercase ${statusColor}`}>{statusLabel}</div>
                    </div>
                    
                    {/* Staff Selection Checkbox UI */}
                    {role === 'staff' && (
                        <div className={`absolute top-4 right-4 w-6 h-6 rounded-full border-2 flex items-center justify-center checkbox-wrapper ${isSelected ? 'bg-emerald-500 border-emerald-500 selected' : 'bg-white border-slate-200'}`}>
                            {isSelected && <CheckSquare size={14} className="text-white"/>}
                        </div>
                    )}

                    <div className="mt-2 flex flex-col items-center justify-center h-full">
                      {status === 'available' || status === 'checked-out' ? (
                          <>
                            {status === 'available' && (
                                <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-slate-50 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                                    {icon}
                                </div>
                            )}
                            <span className="text-2xl md:text-3xl font-black text-slate-300 group-hover:text-emerald-600 transition-colors">{room.price}</span>
                          </>
                      ) : (
                          <div className="text-center w-full space-y-1">
                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/60 flex items-center justify-center mx-auto mb-1 shadow-sm backdrop-blur-sm">
                                {icon}
                            </div>
                            <p className="font-bold text-base md:text-lg text-slate-800 truncate px-2">{booking.guestName}</p>
                            {status === 'booked' && <p className="text-xs md:text-sm text-yellow-700 font-bold">มัดจำ: {Number(booking.deposit || 0).toLocaleString()}</p>}
                            {status === 'occupied' && (
                                remainingAmount > 0 
                                ? <p className="text-xs md:text-sm text-red-600 font-black bg-white/80 px-2 py-1 rounded-lg border border-red-100">ค้าง {remainingAmount.toLocaleString()}</p>
                                : <p className="text-xs md:text-sm text-emerald-600 font-black flex items-center justify-center gap-1 bg-white/80 px-2 py-1 rounded-lg border border-emerald-100"><CheckCircle size={12}/> ครบแล้ว</p>
                            )}
                          </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Staff Floating Action Bar - Center Bottom */}
            {role === 'staff' && selectedStaffRooms.length > 0 && (
                <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 w-[90%] md:w-auto bg-white/95 backdrop-blur-xl p-3 rounded-[2rem] shadow-2xl border border-slate-100 flex items-center justify-between gap-3 z-[100] animate-slide-up ring-4 ring-slate-100/50">
                    <div className="pl-4 font-black text-slate-700 whitespace-nowrap text-lg flex flex-col leading-tight">
                        <span>เลือก</span>
                        <span className="text-emerald-600">{selectedStaffRooms.length} ห้อง</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => handleStaffBulkAction('checkin')} className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-2">
                            <LogIn size={20}/> เช็คอิน
                        </button>
                        <button onClick={() => handleStaffBulkAction('checkout')} className="bg-white border-2 border-red-100 text-red-500 px-4 py-3 rounded-2xl font-bold hover:bg-red-50 active:scale-95 transition-all">
                            <LogOut size={20}/>
                        </button>
                        <button onClick={() => setSelectedStaffRooms([])} className="p-3 bg-slate-100 rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors">
                            <X size={20}/>
                        </button>
                    </div>
                </div>
            )}
          </div>
        )}

        {currentView === 'timeline' && (
            <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3"><LayoutList className="text-emerald-500"/> ปฏิทินจองห้อง</h2>
                    <div className="flex items-center gap-2">
                        <button onClick={() => {const d = new Date(timelineStartDate); d.setDate(d.getDate() - 7); setTimelineStartDate(formatDate(d));}} className="p-2 hover:bg-slate-100 rounded-lg"><ChevronLeft size={24}/></button>
                        <input type="date" value={timelineStartDate} onChange={(e) => setTimelineStartDate(e.target.value)} className="font-bold text-slate-700 bg-transparent outline-none" />
                        <button onClick={() => {const d = new Date(timelineStartDate); d.setDate(d.getDate() + 7); setTimelineStartDate(formatDate(d));}} className="p-2 hover:bg-slate-100 rounded-lg"><ChevronRight size={24}/></button>
                    </div>
                </div>
                <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-200 overflow-x-auto custom-scrollbar p-6">
                    <div className="min-w-[1000px]">
                        {/* Header Dates */}
                        <div className="timeline-grid mb-4 border-b border-slate-100 pb-2">
                            <div className="font-bold text-slate-400">ห้อง / วันที่</div>
                            {[...Array(14)].map((_, i) => {
                                const date = addDays(timelineStartDate, i);
                                const dayNum = date.split('-')[2];
                                const isWeekend = new Date(date).getDay() === 0 || new Date(date).getDay() === 6;
                                return (
                                    <div key={i} className={`text-center font-bold text-sm ${isWeekend ? 'text-red-500' : 'text-slate-600'}`}>
                                        {dayNum}
                                    </div>
                                );
                            })}
                        </div>
                        {/* Room Rows */}
                        <div className="space-y-2">
                            {rooms.map(room => (
                                <div key={room.id} className="timeline-grid items-center h-12 hover:bg-slate-50 rounded-lg transition-colors">
                                    <div className="font-bold text-slate-700 text-sm px-2">{room.name}</div>
                                    {[...Array(14)].map((_, i) => {
                                        const currentDate = addDays(timelineStartDate, i);
                                        // Include checked-out bookings in timeline
                                        const { status, booking } = checkRoomStatus(room.id, currentDate, true);
                                        
                                        const isStart = booking && booking.checkInDate === currentDate;
                                        
                                        let bgClass = "bg-transparent";
                                        if (status === 'booked') bgClass = "bg-yellow-200 border-y border-yellow-300";
                                        if (status === 'occupied') bgClass = "bg-blue-200 border-y border-blue-300";
                                        if (status === 'checked-out') bgClass = "bg-slate-200 border-y border-slate-300 opacity-60"; 
                                        
                                        let radiusClass = "";
                                        if (isStart) radiusClass = "rounded-l-md border-l";
                                        if (booking && booking.checkOutDate === addDays(currentDate, 1)) radiusClass += " rounded-r-md border-r";

                                        return (
                                            <div key={i} className="h-8 px-1 relative">
                                                {status !== 'available' && (
                                                    <div className={`w-full h-full ${bgClass} ${radiusClass} flex items-center overflow-hidden cursor-pointer transition-opacity hover:opacity-80`} title={`${booking.guestName} (${status})`} onClick={() => handleRoomClick(room, status, booking)}>
                                                        {isStart && <span className="text-[10px] font-bold text-slate-800 whitespace-nowrap pl-2">{booking.guestName}</span>}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {currentView === 'customers' && (
             <div className="space-y-6 animate-fade-in">
                 <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3"><Users className="text-emerald-500"/> ข้อมูลลูกค้า</h2>
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18}/>
                        <input 
                            type="text" 
                            placeholder="ค้นหาชื่อ, เบอร์โทร, ทะเบียนรถ..." 
                            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm transition-all"
                            value={guestSearchTerm}
                            onChange={(e) => setGuestSearchTerm(e.target.value)}
                        />
                    </div>
                 </div>

                 <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider">
                                <tr>
                                    <th className="p-5 border-b border-slate-100">ลูกค้า</th>
                                    <th className="p-5 border-b border-slate-100">ข้อมูลติดต่อ</th>
                                    <th className="p-5 border-b border-slate-100">ข้อมูลรถ/บัตร</th>
                                    <th className="p-5 border-b border-slate-100">วันเกิด/อายุ</th>
                                    <th className="p-5 border-b border-slate-100 text-center">เข้าพัก (ครั้ง)</th>
                                    <th className="p-5 border-b border-slate-100 text-right">ล่าสุด</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-sm">
                                {guestDirectory.filter(g => 
                                    g.name.includes(guestSearchTerm) || 
                                    g.phone.includes(guestSearchTerm) || 
                                    (g.licensePlate && g.licensePlate.includes(guestSearchTerm))
                                ).map((guest, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="p-5 font-bold text-slate-700">{guest.name}</td>
                                        <td className="p-5 text-slate-600 font-mono">
                                            <div>{guest.phone || '-'}</div>
                                            {guest.lineId && <div className="text-xs text-[#06C755] font-bold mt-1 flex items-center gap-1"><MessageCircle size={10}/> {guest.lineId}</div>}
                                        </td>
                                        <td className="p-5">
                                            <div className="space-y-1">
                                                {guest.licensePlate && <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded w-fit"><Car size={12}/> {guest.licensePlate}</div>}
                                                {guest.idCard && <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded w-fit"><CreditCard size={12}/> {guest.idCard}</div>}
                                                {!guest.licensePlate && !guest.idCard && <span className="text-slate-300">-</span>}
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            {guest.dob ? 
                                                <div className="flex items-center gap-2 text-slate-600"><Gift size={14} className="text-pink-400"/> {calculateAge(guest.dob)} ปี</div> 
                                                : <span className="text-slate-300">-</span>
                                            }
                                        </td>
                                        <td className="p-5 text-center">
                                            <span className="bg-emerald-100 text-emerald-700 py-1 px-3 rounded-full text-xs font-bold">{guest.totalVisits}</span>
                                        </td>
                                        <td className="p-5 text-right text-slate-500">{guest.lastVisit}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {guestDirectory.length === 0 && <div className="p-10 text-center text-slate-400">ยังไม่มีข้อมูลลูกค้า</div>}
                    </div>
                 </div>
             </div>
        )}

        {currentView === 'expenses' && (
           <div className="space-y-6 animate-fade-in">
             <div className="flex justify-between items-center">
                 <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3"><Wallet className="text-emerald-500"/> รายจ่าย</h2>
                 <button onClick={() => openExpenseModal()} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 flex items-center gap-2 font-bold transition-all hover:-translate-y-1"><Plus size={18}/> เพิ่มรายจ่าย</button>
             </div>
             <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-sm text-left text-slate-600">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold tracking-wider"><tr><th className="px-6 py-4">เอกสาร</th><th className="px-6 py-4">วันที่</th><th className="px-6 py-4">รายการ</th><th className="px-6 py-4">จ่ายให้</th><th className="px-6 py-4 text-right">จำนวนเงิน</th></tr></thead>
                    <tbody className="divide-y divide-slate-50">
                        {expenses.sort((a,b) => b.docNo.localeCompare(a.docNo)).map(ex => (
                            <tr key={ex.id} className="hover:bg-slate-50/50 cursor-pointer transition-colors" onClick={() => openExpenseModal(ex)}>
                                <td className="px-6 py-4 text-xs text-slate-400 font-mono">{ex.docNo || '-'}</td>
                                <td className="px-6 py-4 font-medium">{ex.date}</td>
                                <td className="px-6 py-4 font-medium text-slate-800">{ex.title} <span className="text-slate-400 text-xs block mt-1">{ex.category}</span></td>
                                <td className="px-6 py-4 text-xs">{ex.payee} <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded ml-1">{ex.paymentMethod}</span></td>
                                <td className="px-6 py-4 text-right font-bold text-red-500">-{ex.amount.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
             </div>
           </div>
        )}

        {currentView === 'report' && (
           <div className="space-y-8 animate-fade-in">
               <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                      <div className="flex items-center gap-4">
                          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3"><BarChart2 className="text-emerald-500"/> ผลประกอบการ</h2>
                          <input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50" />
                      </div>
                      <div className="flex gap-2">
                          <button onClick={() => exportToCSV(reportData.reportBookings, `Income_${reportMonth}`)} className="flex items-center gap-2 text-xs font-bold bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg hover:bg-emerald-100 transition-colors"><Download size={14}/> รายรับ CSV</button>
                          <button onClick={() => exportToCSV(reportData.reportExpenses, `Expense_${reportMonth}`)} className="flex items-center gap-2 text-xs font-bold bg-red-50 text-red-700 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors"><Download size={14}/> รายจ่าย CSV</button>
                      </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                      <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100"><p className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-2">รายได้จริง</p><p className="text-3xl font-black text-emerald-600">฿{reportData.monthlyRevenue.toLocaleString(undefined, {maximumFractionDigits:0})}</p></div>
                      <div className="bg-red-50/50 p-6 rounded-2xl border border-red-100"><p className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-2">ค่าใช้จ่าย</p><p className="text-3xl font-black text-red-600">฿{reportData.monthlyExpense.toLocaleString()}</p></div>
                      <div className={`p-6 rounded-2xl border ${reportData.netProfit >= 0 ? 'bg-blue-50/50 border-blue-100' : 'bg-orange-50/50 border-orange-100'}`}><p className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-2">กำไรสุทธิ</p><p className={`text-3xl font-black ${reportData.netProfit >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>฿{reportData.netProfit.toLocaleString(undefined, {maximumFractionDigits:0})}</p></div>
                  </div>
                  <div className="grid lg:grid-cols-2 gap-8">
                      <div className="bg-white border border-slate-100 rounded-2xl p-6 h-80 shadow-sm">
                          <h3 className="text-sm font-bold text-slate-500 mb-6 text-center">แนวโน้มรายได้รายวัน</h3>
                          <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={reportData.lineData} onClick={(e) => { if(e && e.activePayload) { setReportSelectedDay(`${reportMonth}-${e.activePayload[0].payload.date}`); setIsReportDetailOpen(true); } }}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                  <XAxis dataKey="date" tick={{fontSize: 12, fill: '#94a3b8'}} axisLine={false} tickLine={false} dy={10}/>
                                  <YAxis tick={{fontSize: 12, fill: '#94a3b8'}} axisLine={false} tickLine={false}/>
                                  <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} formatter={(v) => `฿${v.toLocaleString()}`} />
                                  <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={{r:4, fill:'#10b981', strokeWidth:0}} activeDot={{r:6, strokeWidth:0}} />
                              </LineChart>
                          </ResponsiveContainer>
                      </div>
                      <div className="bg-white border border-slate-100 rounded-2xl p-6 h-80 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-500 mb-6 text-center">สัดส่วนค่าใช้จ่าย</h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={reportData.expensePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} label={({percent}) => `${(percent * 100).toFixed(0)}%`}>
                                    {reportData.expensePieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none"/>)}
                                </Pie>
                                <Tooltip formatter={(v) => `฿${v.toLocaleString()}`} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}/>
                                <Legend wrapperStyle={{fontSize: '11px', color: '#64748b'}} iconType="circle"/>
                            </PieChart>
                        </ResponsiveContainer>
                      </div>
                  </div>
                  <div className="mt-8 bg-white border border-slate-100 rounded-2xl p-6 h-96 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-500 mb-6 text-center">ยอดขายตามห้องพัก</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={reportData.roomPieData} layout="vertical" margin={{top: 5, right: 30, left: 40, bottom: 5}}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9"/>
                            <XAxis type="number" hide/>
                            <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 12, fill: '#64748b', fontWeight: 'bold'}} axisLine={false} tickLine={false}/>
                            <Tooltip content={<CustomRevenueTooltip />} />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                                {reportData.roomPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                  </div>
               </div>
           </div>
        )}
      </div>

      {/* --- Modals & Popups --- */}

      {/* Booking Details Modal for Staff */}
      <Modal isOpen={isStaffBookingModalOpen} onClose={() => setIsStaffBookingModalOpen(false)} title="รายละเอียดการจอง">
          {selectedBookedRoom && (
              <div className="space-y-6">
                  <div className="bg-yellow-50 p-5 rounded-2xl border border-yellow-100">
                      <div className="flex justify-between items-start mb-4">
                          <div>
                              <h3 className="text-xl font-bold text-slate-800">{selectedBookedRoom.booking.guestName}</h3>
                              <p className="text-slate-500 text-sm">{selectedBookedRoom.room.name}</p>
                          </div>
                          <span className="bg-yellow-200 text-yellow-800 px-3 py-1 rounded-lg text-xs font-bold">จองแล้ว</span>
                      </div>
                      <div className="space-y-2 text-sm text-slate-700">
                          <div className="flex justify-between"><span>เช็คอิน:</span><span className="font-medium">{selectedBookedRoom.booking.checkInDate}</span></div>
                          <div className="flex justify-between"><span>จำนวนคืน:</span><span className="font-medium">{selectedBookedRoom.booking.nights} คืน</span></div>
                      </div>
                  </div>

                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-3">
                      <h4 className="font-bold text-slate-700 text-sm mb-2 flex items-center gap-2"><Wallet size={16}/> สรุปยอดเงิน</h4>
                      <div className="flex justify-between text-sm"><span>ราคาห้องพักรวม</span><span>{selectedBookedRoom.booking.totalPrice.toLocaleString()}</span></div>
                      <div className="flex justify-between text-sm text-red-500"><span>หัก มัดจำแล้ว</span><span>-{selectedBookedRoom.booking.deposit.toLocaleString()}</span></div>
                      <div className="flex justify-between text-sm text-blue-600"><span>+ ค่ามัดจำกุญแจ</span><span>100</span></div>
                      <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-lg text-emerald-600">
                          <span>ยอดต้องชำระเพิ่ม</span>
                          <span>{(selectedBookedRoom.booking.totalPrice - selectedBookedRoom.booking.deposit + 100).toLocaleString()} ฿</span>
                      </div>
                  </div>

                  <div className="space-y-4 pt-2">
                        <div 
                            className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer select-none hover:bg-slate-50"
                            onClick={() => setStaffCheckInForm({...staffCheckInForm, keyDepositCollected: !staffCheckInForm.keyDepositCollected})}
                        >
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${staffCheckInForm.keyDepositCollected ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300'}`}>
                                {staffCheckInForm.keyDepositCollected && <CheckSquare size={14} className="text-white"/>}
                            </div>
                            <span className="font-bold text-sm text-slate-700">เก็บมัดจำกุญแจแล้ว (100 บาท)</span>
                        </div>

                        <div 
                            className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer select-none hover:bg-slate-50"
                            onClick={() => setStaffCheckInForm({...staffCheckInForm, isReceiptNeeded: !staffCheckInForm.isReceiptNeeded})}
                        >
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${staffCheckInForm.isReceiptNeeded ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300'}`}>
                                {staffCheckInForm.isReceiptNeeded && <CheckSquare size={14} className="text-white"/>}
                            </div>
                            <span className="font-bold text-sm text-slate-700">ต้องการใบเสร็จรับเงิน</span>
                        </div>

                        {staffCheckInForm.isReceiptNeeded && (
                            <div className="flex gap-2 items-center flex-col">
                                <label className="w-full bg-slate-100 text-slate-500 p-3 rounded-xl text-center cursor-pointer hover:bg-slate-200 transition-colors border border-slate-200">
                                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setStaffCheckInForm({...staffCheckInForm, billPhoto: e.target.files[0]})} />
                                    <div className="flex items-center justify-center gap-2 font-bold text-sm">
                                        <Camera size={18}/> {staffCheckInForm.billPhoto ? 'ถ่ายใหม่' : 'ถ่ายรูปบิล'}
                                    </div>
                                </label>
                                {staffCheckInForm.billPhoto && (
                                    <div className="w-full rounded-xl overflow-hidden border border-slate-200 shadow-sm mt-2">
                                        <img src={URL.createObjectURL(staffCheckInForm.billPhoto)} alt="Bill Preview" className="w-full h-auto object-cover max-h-48" />
                                    </div>
                                )}
                            </div>
                        )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                        <button 
                            onClick={() => setStaffCheckInForm({...staffCheckInForm, paymentMethod: 'เงินสด'})}
                            className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${staffCheckInForm.paymentMethod === 'เงินสด' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-400'}`}
                        >
                            <Banknote size={20}/>
                            <span className="font-bold text-xs">เงินสด</span>
                        </button>
                        <button 
                            onClick={() => setStaffCheckInForm({...staffCheckInForm, paymentMethod: 'เงินโอน'})}
                            className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${staffCheckInForm.paymentMethod === 'เงินโอน' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-400'}`}
                        >
                            <QrCode size={20}/>
                            <span className="font-bold text-xs">โอนเงิน</span>
                        </button>
                  </div>

                  <button 
                    onClick={() => confirmStaffCheckIn(true)} 
                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all"
                  >
                      ยืนยันเข้าพัก
                  </button>
              </div>
          )}
      </Modal>

      {/* Staff Walk-in Check-in Modal */}
      <Modal isOpen={isStaffCheckInModalOpen} onClose={() => setIsStaffCheckInModalOpen(false)} title="ยืนยันการรับเงิน (Walk-in)">
          <div className="space-y-6">
              <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100 text-center relative">
                  <p className="text-slate-500 text-sm font-medium mb-1">ยอดชำระรวม ({selectedStaffRooms.length} ห้อง)</p>
                  <input 
                    type="number" 
                    className="text-4xl font-black text-emerald-600 bg-transparent text-center w-full outline-none focus:ring-0" 
                    value={staffCheckInForm.totalPrice}
                    onChange={(e) => setStaffCheckInForm({...staffCheckInForm, totalPrice: Number(e.target.value)})}
                  />
                  <p className="text-slate-400 text-xs">บาท</p>
              </div>

              <div>
                  <label className="block text-slate-600 font-bold mb-3 text-sm">ช่องทางการชำระเงิน</label>
                  <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => setStaffCheckInForm({...staffCheckInForm, paymentMethod: 'เงินสด'})}
                        className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${staffCheckInForm.paymentMethod === 'เงินสด' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 text-slate-400'}`}
                      >
                          <Banknote size={28}/>
                          <span className="font-bold">เงินสด</span>
                      </button>
                      <button 
                        onClick={() => setStaffCheckInForm({...staffCheckInForm, paymentMethod: 'เงินโอน'})}
                        className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${staffCheckInForm.paymentMethod === 'เงินโอน' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-100 text-slate-400'}`}
                      >
                          <QrCode size={28}/>
                          <span className="font-bold">โอนเงิน</span>
                      </button>
                  </div>
              </div>

              <div className="space-y-3">
                <div 
                    className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl cursor-pointer select-none transition-colors hover:bg-slate-100"
                    onClick={() => setStaffCheckInForm({...staffCheckInForm, keyDepositCollected: !staffCheckInForm.keyDepositCollected})}
                >
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${staffCheckInForm.keyDepositCollected ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300'}`}>
                        {staffCheckInForm.keyDepositCollected && <CheckSquare size={16} className="text-white"/>}
                    </div>
                    <span className="font-bold text-slate-700 flex items-center gap-2 text-sm"><Key size={18}/> เก็บมัดจำกุญแจครบถ้วน (100 บาท/ห้อง)</span>
                </div>

                <div 
                    className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl cursor-pointer select-none transition-colors hover:bg-slate-100"
                    onClick={() => setStaffCheckInForm({...staffCheckInForm, isReceiptNeeded: !staffCheckInForm.isReceiptNeeded})}
                >
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${staffCheckInForm.isReceiptNeeded ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300'}`}>
                        {staffCheckInForm.isReceiptNeeded && <CheckSquare size={16} className="text-white"/>}
                    </div>
                    <span className="font-bold text-slate-700 flex items-center gap-2 text-sm"><Receipt size={18}/> ต้องการใบเสร็จรับเงิน</span>
                </div>

                {staffCheckInForm.isReceiptNeeded && (
                    <div className="animate-fade-in flex flex-col items-center">
                        <label className="block w-full bg-white border-2 border-dashed border-slate-300 p-4 rounded-xl text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-all">
                            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setStaffCheckInForm({...staffCheckInForm, billPhoto: e.target.files[0]})} />
                            <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
                                <Camera size={32} className={staffCheckInForm.billPhoto ? 'text-emerald-500' : 'text-slate-400'}/>
                                <span className="font-bold text-sm">{staffCheckInForm.billPhoto ? 'ถ่ายรูปเรียบร้อย (กดเพื่อถ่ายใหม่)' : 'แตะเพื่อถ่ายรูปบิล'}</span>
                            </div>
                        </label>
                        {staffCheckInForm.billPhoto && (
                            <div className="w-full rounded-xl overflow-hidden border border-slate-200 shadow-sm mt-3">
                                <img src={URL.createObjectURL(staffCheckInForm.billPhoto)} alt="Bill Preview" className="w-full h-auto object-cover max-h-48" />
                            </div>
                        )}
                    </div>
                )}
              </div>

              <button 
                onClick={() => confirmStaffCheckIn(false)} 
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all"
              >
                  ยืนยันการเช็คอิน
              </button>
          </div>
      </Modal>

      <Modal isOpen={isLineModalOpen} onClose={() => setIsLineModalOpen(false)} title="ส่งสรุป LINE">
         <div className="space-y-4">
            <div className="bg-slate-100 p-4 rounded-xl text-sm whitespace-pre-wrap font-mono text-slate-700">{lineMessage}</div>
            <button onClick={() => copyToClipboard(lineMessage)} className="w-full py-3 bg-[#06C755] text-white rounded-xl font-bold hover:bg-[#05b54d] flex justify-center items-center gap-2 shadow-lg shadow-green-100"><Copy size={18}/> คัดลอกข้อความ</button>
         </div>
      </Modal>

      <Modal isOpen={isMessagePreviewOpen} onClose={() => setIsMessagePreviewOpen(false)} title="ตัวอย่างข้อความ (แก้ไขได้)">
         <div className="space-y-4">
            <textarea 
                className="w-full h-48 p-4 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono text-slate-800 focus:ring-2 focus:ring-[#06C755] outline-none"
                value={messagePreviewText} 
                onChange={(e) => setMessagePreviewText(e.target.value)}
            />
            <button onClick={confirmSendMessage} className="w-full py-3 bg-[#06C755] text-white rounded-xl font-bold hover:bg-[#05b54d] flex justify-center items-center gap-2 shadow-lg shadow-green-100"><Send size={18}/> ยืนยันส่ง LINE</button>
         </div>
      </Modal>

      <Modal isOpen={isBookingSummaryOpen} onClose={() => setIsBookingSummaryOpen(false)} title="บันทึกการจองสำเร็จ">
         <div className="space-y-4">
            <div className="bg-emerald-50 p-6 rounded-2xl text-sm whitespace-pre-wrap font-mono text-emerald-800 border border-emerald-100 shadow-inner">{bookingSummaryText}</div>
            <button onClick={() => copyToClipboard(bookingSummaryText)} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 flex justify-center items-center gap-2 shadow-lg shadow-emerald-200"><Copy size={18}/> คัดลอกส่งไลน์</button>
         </div>
      </Modal>

      <Modal isOpen={isReportDetailOpen} onClose={() => setIsReportDetailOpen(false)} title={`รายละเอียดวันที่ ${reportSelectedDay}`}>
          {dailyDetails.length > 0 ? (
              <table className="w-full text-sm text-left">
                  <thead className="bg-emerald-50 text-emerald-800 font-bold"><tr><th className="p-3 rounded-l-lg">ห้อง</th><th className="p-3">ลูกค้า</th><th className="p-3 text-right rounded-r-lg">รายได้ (เฉลี่ย/คืน)</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                      {dailyDetails.map((d, idx) => (
                          <tr key={idx}><td className="p-3 font-bold text-slate-700">{d.room}</td><td className="p-3 text-slate-600">{d.guest}</td><td className="p-3 text-right font-bold text-emerald-600">{d.amount.toLocaleString(undefined, {maximumFractionDigits:0})}</td></tr>
                      ))}
                      <tr className="bg-slate-50 font-bold"><td colSpan="2" className="p-3 text-right text-slate-500">รวมทั้งสิ้น</td><td className="p-3 text-right text-emerald-700 text-lg">{dailyDetails.reduce((s, c) => s + c.amount, 0).toLocaleString(undefined, {maximumFractionDigits:0})}</td></tr>
                  </tbody>
              </table>
          ) : <p className="text-center text-slate-400 py-8">ไม่มีรายได้ในวันนี้</p>}
      </Modal>

      <Modal isOpen={isRoomSettingsOpen} onClose={() => setIsRoomSettingsOpen(false)} title="ตั้งค่าระบบ / ผู้ช่วย">
         <div className="space-y-6">
            
            {/* Smart Assistant Section (Moved here) */}
            <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100">
                <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide"><MessageCircle className="text-emerald-500" size={16}/> ผู้ช่วยอัจฉริยะ (Auto-Message)</h3>
                
                <div className="space-y-4">
                    {/* Check-in Tomorrow */}
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                        <h4 className="font-bold text-sm text-slate-700 mb-2 flex items-center gap-2"><LogIn size={14} className="text-blue-500"/> เตรียมเข้าพักพรุ่งนี้ ({communicationData.checkInTomorrow.length})</h4>
                        <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                            {communicationData.checkInTomorrow.map(b => (
                                <div key={b.id} className="flex justify-between items-center text-xs border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                                    <div>
                                        <p className="font-bold text-slate-800">{b.guestName}</p>
                                        <p className="text-slate-500">{b.roomName}</p>
                                        {b.lineId && <p className="text-xs text-[#06C755] font-bold flex items-center gap-1 mt-1"><MessageCircle size={10}/> Line: {b.lineId}</p>}
                                    </div>
                                    <button 
                                        onClick={() => openMessagePreview(
                                            `สวัสดีครับคุณ ${b.guestName} 🙏\nทางจันผารีสอร์ทขอแจ้งเตือนการเข้าพักในวันพรุ่งนี้ครับ 🏠\n\n📍 แผนที่เดินทาง: https://maps.app.goo.gl/s8QbZDrNPNXSGt5X8\n📞 ติดต่อสอบถาม: 08x-xxx-xxxx\n\nหากต้องการความช่วยเหลือเพิ่มเติมแจ้งได้เลยนะครับ`
                                        )}
                                        className="bg-[#06C755] text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 hover:bg-[#05b54d]"
                                    >
                                        <Send size={10}/>
                                    </button>
                                </div>
                            ))}
                            {communicationData.checkInTomorrow.length === 0 && <p className="text-center text-slate-400 text-xs py-2">ไม่มีรายการ</p>}
                        </div>
                    </div>

                    {/* Check-out Today */}
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                        <h4 className="font-bold text-sm text-slate-700 mb-2 flex items-center gap-2"><LogOut size={14} className="text-orange-500"/> ขอบคุณลูกค้า (ออกวันนี้) ({communicationData.checkedOutToday.length})</h4>
                        <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                            {communicationData.checkedOutToday.map(b => (
                                <div key={b.id} className="flex justify-between items-center text-xs border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                                    <div>
                                        <p className="font-bold text-slate-800">{b.guestName}</p>
                                        <p className="text-slate-500">{b.roomName}</p>
                                        {b.lineId && <p className="text-xs text-[#06C755] font-bold flex items-center gap-1 mt-1"><MessageCircle size={10}/> Line: {b.lineId}</p>}
                                    </div>
                                    <button 
                                        onClick={() => openMessagePreview(
                                            `ขอบพระคุณ คุณ ${b.guestName} ที่มาพักที่จันผารีสอร์ทครับ 🌿\nหวังว่าจะได้มีโอกาสต้อนรับอีกครั้งนะครับ\n\nฝากรีวิวเป็นกำลังใจให้เราด้วยนะครับ ⭐⭐⭐⭐⭐\nhttps://maps.app.goo.gl/s8QbZDrNPNXSGt5X8`
                                        )}
                                        className="bg-slate-800 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 hover:bg-slate-900"
                                    >
                                        <Send size={10}/>
                                    </button>
                                </div>
                            ))}
                            {communicationData.checkedOutToday.length === 0 && <p className="text-center text-slate-400 text-xs py-2">ไม่มีรายการ</p>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Room Management Section */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <h4 className="font-bold text-slate-700 mb-3 text-sm">เพิ่ม/แก้ไข ห้องพัก</h4>
                <div className="grid grid-cols-3 gap-3 mb-3">
                    <input placeholder="เลขห้อง (ID)" className="p-2.5 border-0 bg-white rounded-lg shadow-sm" value={roomForm.id} onChange={e => setRoomForm({...roomForm, id: e.target.value})} />
                    <input placeholder="ชื่อห้อง" className="p-2.5 border-0 bg-white rounded-lg shadow-sm" value={roomForm.name} onChange={e => setRoomForm({...roomForm, name: e.target.value})} />
                    <input placeholder="ราคา" type="number" className="p-2.5 border-0 bg-white rounded-lg shadow-sm" value={roomForm.price} onChange={e => setRoomForm({...roomForm, price: e.target.value})} />
                </div>
                <input placeholder="ประเภท (เช่น เตียงเดี่ยว, บ้านพัก)" className="w-full p-2.5 border-0 bg-white rounded-lg shadow-sm mb-3" value={roomForm.type} onChange={e => setRoomForm({...roomForm, type: e.target.value})} />
                <button onClick={handleSaveRoom} className="w-full py-2.5 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-colors">บันทึกห้อง</button>
                
                <div className="max-h-48 overflow-y-auto pt-4 custom-scrollbar">
                    <table className="w-full text-sm text-left">
                        <thead><tr className="text-slate-400 border-b border-slate-100"><th className="pb-2 font-normal">ID</th><th className="pb-2 font-normal">ชื่อ</th><th className="pb-2 font-normal">ราคา</th><th className="pb-2 font-normal">จัดการ</th></tr></thead>
                        <tbody className="divide-y divide-slate-50">
                            {rooms.map(r => (<tr key={r.id}><td className="py-3 text-slate-500">{r.id}</td><td className="font-bold text-slate-700">{r.name}</td><td className="text-emerald-600 font-bold">{r.price}</td><td className="flex gap-2 py-3"><button onClick={() => setRoomForm(r)} className="text-blue-500 bg-blue-50 p-1.5 rounded-lg hover:bg-blue-100"><Edit size={14}/></button><button onClick={() => handleDeleteRoom(r.id)} className="text-red-500 bg-red-50 p-1.5 rounded-lg hover:bg-red-100"><Trash2 size={14}/></button></td></tr>))}
                        </tbody>
                    </table>
                </div>
            </div>
         </div>
      </Modal>

      <Modal isOpen={isBookingModalOpen} onClose={() => setIsBookingModalOpen(false)} title={formData.id ? `แก้ไขการจอง (${formData.docNo})` : `จองห้องพักใหม่`}>
        <div className="space-y-6 font-sans">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                        <h3 className="text-sm font-bold text-slate-600 mb-4 flex items-center gap-2 uppercase tracking-wide"><Calendar size={16} className="text-emerald-500"/> ข้อมูลการเข้าพัก</h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-xs font-bold text-slate-400 mb-1.5">วันที่เข้าพัก</label><input type="date" className="w-full p-2.5 bg-white border-0 rounded-xl text-sm font-bold shadow-sm focus:ring-2 focus:ring-emerald-400" value={formData.checkInDate} onChange={e => handleDateChange('checkInDate', e.target.value)} /></div>
                                <div><label className="block text-xs font-bold text-slate-400 mb-1.5">จำนวนคืน</label><input type="number" min="1" className="w-full p-2.5 bg-white border-0 rounded-xl text-sm font-bold shadow-sm text-center focus:ring-2 focus:ring-emerald-400" value={formData.nights} onChange={e => handleDateChange('nights', e.target.value)} /></div>
                            </div>
                            <div className="flex justify-between items-center px-1"><span className="text-xs text-slate-500 font-medium">เช็คเอาท์:</span><span className="text-sm font-black text-slate-700 bg-slate-200 px-2 py-0.5 rounded">{formData.checkOutDate}</span></div>
                            <div className="pt-4 border-t border-slate-200">
                                <p className="text-xs font-bold text-slate-500 mb-2">จองเพิ่ม (Multi-room)</p>
                                <div className="flex flex-wrap gap-2">
                                    {availableRoomsForAdd.map(r => (
                                        <label key={r.id} className={`cursor-pointer border px-3 py-1.5 rounded-xl text-xs font-bold select-none transition-all ${formData.selectedAdditionalRooms.includes(r.id) ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-200' : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-300'}`}>
                                            <input type="checkbox" className="hidden" checked={formData.selectedAdditionalRooms.includes(r.id)} onChange={e => { if(e.target.checked) setFormData({...formData, selectedAdditionalRooms: [...formData.selectedAdditionalRooms, r.id]}); else setFormData({...formData, selectedAdditionalRooms: formData.selectedAdditionalRooms.filter(id => id !== r.id)}); }} />
                                            {r.name}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative">
                        <div className="absolute top-0 right-0 p-2"><User className="text-slate-100" size={60}/></div>
                        <h3 className="text-sm font-bold text-slate-600 mb-4 flex items-center gap-2 uppercase tracking-wide relative z-10"><User size={16} className="text-emerald-500"/> ข้อมูลลูกค้า</h3>
                        <div className="space-y-3 relative z-10">
                            <div><label className="block text-xs font-bold text-slate-400 mb-1">ชื่อ-สกุล <span className="text-red-500">*</span></label><input list="guestList" type="text" className="w-full p-2.5 bg-slate-50 border-0 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-emerald-400 transition-all" value={formData.guestName} onChange={handleGuestNameChange} placeholder="พิมพ์เพื่อค้นหาลูกค้าเก่า..." /><datalist id="guestList">{guestDirectory.map((g, i) => <option key={i} value={g.name}>{g.phone}</option>)}</datalist></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="block text-xs font-bold text-slate-400 mb-1">เบอร์โทรศัพท์ <span className="text-red-500">*</span></label><input type="tel" className="w-full p-2.5 bg-slate-50 border-0 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-emerald-400 transition-all" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
                                <div><label className="block text-xs font-bold text-emerald-500 mb-1">LINE ID / ชื่อไลน์</label><input type="text" className="w-full p-2.5 bg-emerald-50/50 border-0 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-emerald-400 transition-all" value={formData.lineId} onChange={e => setFormData({...formData, lineId: e.target.value})} placeholder="@ หรือ ชื่อ" /></div>
                            </div>
                            
                            {/* New Fields Area */}
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <div><label className="block text-xs font-bold text-slate-400 mb-1">ทะเบียนรถ</label><input type="text" placeholder="เช่น กก 1234" className="w-full p-2.5 bg-slate-50 border-0 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-emerald-400" value={formData.licensePlate} onChange={e => setFormData({...formData, licensePlate: e.target.value})} /></div>
                                <div><label className="block text-xs font-bold text-slate-400 mb-1">เลขบัตร ปชช.</label><input type="text" placeholder="13 หลัก" className="w-full p-2.5 bg-slate-50 border-0 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-emerald-400" value={formData.idCard} onChange={e => setFormData({...formData, idCard: e.target.value})} /></div>
                            </div>

                            {/* Date of Birth & Age */}
                            <div className="grid grid-cols-3 gap-3 pt-2">
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-slate-400 mb-1">วัน/เดือน/ปีเกิด</label>
                                    <input type="date" className="w-full p-2.5 bg-slate-50 border-0 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-emerald-400" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">อายุ (ปี)</label>
                                    <div className="w-full p-2.5 bg-slate-100 border-0 rounded-xl text-sm font-bold text-center text-slate-600 h-[42px] flex items-center justify-center">
                                        {calculateAge(formData.dob) || '-'}
                                    </div>
                                </div>
                            </div>
                            
                            <div><label className="block text-xs font-bold text-slate-400 mb-1">หมายเหตุ</label><input type="text" className="w-full p-2.5 bg-slate-50 border-0 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-emerald-400" value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} /></div>
                        </div>
                    </div>
                    <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-200">
                        <div className="flex justify-between items-center mb-2"><label className="text-sm font-bold text-yellow-800">เงินมัดจำ (รวม):</label><input type="number" className="w-24 p-2 border-0 rounded-lg text-right font-bold bg-white text-yellow-800 shadow-sm" value={formData.deposit} onChange={e => setFormData({...formData, deposit: e.target.value})} /></div>
                        {!formData.id && (
                            <div className="pt-2 mt-2 border-t border-yellow-200/50">
                                <div className="flex justify-between items-center font-bold text-yellow-900 text-sm">
                                    <span>ยอดรวม ({formData.selectedAdditionalRooms.length + 1} ห้อง):</span>
                                    <span>{createGrandTotal.toLocaleString()} บาท</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex gap-3 pt-4 border-t border-slate-100">
                {formData.id && (
                    <>
                        <button onClick={handleDeleteBooking} className="px-5 py-3 bg-red-50 text-red-500 rounded-xl font-bold hover:bg-red-100 flex items-center gap-2 transition-colors"><Trash2 size={18}/></button>
                        <button onClick={goToCheckIn} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 flex justify-center items-center gap-2 shadow-lg shadow-emerald-200 transition-all transform active:scale-95"><LogIn size={18}/> เช็คอิน</button>
                    </>
                )}
                <button onClick={handleBookingSave} className={`py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 flex justify-center items-center gap-2 shadow-lg shadow-slate-300 transition-all transform active:scale-95 ${formData.id ? 'px-8' : 'w-full'}`}><Save size={18}/> {formData.id ? 'บันทึก' : 'ยืนยันการจอง'}</button>
            </div>
        </div>
      </Modal>

      <Modal isOpen={isCheckInModalOpen} onClose={() => setIsCheckInModalOpen(false)} title={`เช็คอิน / จัดการห้องพัก (${formData.docNo})`} maxWidth="max-w-4xl">
         <div className="space-y-6 font-sans">
            <div className="flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-1/2 space-y-4">
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide"><FileText className="text-blue-500" size={16}/> รายละเอียดห้องพัก</h3>
                        <div className="space-y-3 text-sm text-slate-600">
                            <div className="flex justify-between p-2 bg-slate-50 rounded-lg"><span>ห้องหลัก:</span><span className="font-black text-slate-800 text-lg">{selectedRoom?.name}</span></div>
                            <div className="flex justify-between items-center px-2"><span>ลูกค้า:</span><span className="font-bold text-slate-800">{formData.guestName}</span></div>
                             {/* Show Car/ID if exists */}
                            {(formData.licensePlate || formData.idCard || formData.lineId) && (
                                <div className="flex flex-wrap gap-2 px-2 text-xs text-slate-500">
                                    {formData.lineId && <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded flex items-center gap-1 font-bold"><MessageCircle size={10}/> {formData.lineId}</span>}
                                    {formData.licensePlate && <span className="bg-slate-100 px-2 py-1 rounded flex items-center gap-1"><Car size={10}/> {formData.licensePlate}</span>}
                                    {formData.idCard && <span className="bg-slate-100 px-2 py-1 rounded flex items-center gap-1"><CreditCard size={10}/> {formData.idCard}</span>}
                                </div>
                            )}
                            <div className="flex justify-between items-center px-2"><span>เข้าพัก:</span><span className="font-medium">{formData.checkInDate} ({formData.nights} คืน)</span></div>
                            <div className="flex justify-between pt-2 border-t px-2"><span>สถานะ:</span><span className={`font-bold px-3 py-0.5 rounded-full text-xs ${bookings.find(b=>b.id===formData.id)?.status === 'occupied' ? 'bg-blue-100 text-blue-600' : 'bg-yellow-100 text-yellow-600'}`}>{bookings.find(b=>b.id===formData.id)?.status === 'occupied' ? 'เข้าพักแล้ว' : 'จองแล้ว'}</span></div>
                        </div>
                    </div>
                    {formData.billPhoto && (
                        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                            <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide"><ImageIcon className="text-emerald-500" size={16}/> หลักฐานการโอน / บิล</h3>
                            <div className="rounded-xl overflow-hidden border border-slate-200">
                                <img src={formData.billPhoto} alt="Bill Evidence" className="w-full h-auto object-cover max-h-64" />
                            </div>
                        </div>
                    )}
                    {formData.groupCheckInRooms.length > 1 && (
                        <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-5 shadow-sm">
                            <h3 className="font-bold text-blue-800 mb-3 flex items-center gap-2 text-sm"><Layers size={16}/> ห้องในกลุ่ม ({formData.groupCheckInRooms.length})</h3>
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                {formData.groupCheckInRooms.map(bid => {
                                    const b = bookings.find(x => x.id === bid);
                                    if (!b) return null;
                                    const isOccupied = b.status === 'occupied';
                                    return (
                                        <div key={bid} className="flex justify-between items-center bg-white p-3 rounded-xl border border-blue-100 text-sm shadow-sm">
                                            <span className="font-bold text-slate-700">{b.roomName}</span>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isOccupied ? 'bg-blue-100 text-blue-600' : 'bg-yellow-100 text-yellow-600'}`}>{isOccupied ? 'พัก' : 'จอง'}</span>
                                                {isOccupied && (<button onClick={() => handleCheckoutSingle(b.id, b.keyDeposit)} className="text-[10px] bg-orange-100 text-orange-600 px-2 py-1 rounded border border-orange-200 hover:bg-orange-200">คืนห้อง</button>)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                        <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide"><Key className="text-yellow-500" size={16}/> ประกันกุญแจ</h3>
                        <div className="flex justify-between items-center"><label className="text-sm text-slate-500">ยอดเงินประกัน (คืนตอนออก)</label><div className="flex items-center gap-2"><input type="number" className="w-24 p-2 bg-slate-50 border-0 rounded-lg text-right font-bold text-slate-800" value={formData.keyDeposit} onChange={e => setFormData({...formData, keyDeposit: e.target.value})} /><span className="text-sm text-slate-400">บาท</span></div></div>
                    </div>
                </div>
                <div className="w-full md:w-1/2 space-y-4">
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex justify-between items-center"><h3 className="font-bold text-slate-700 flex items-center gap-2 text-sm uppercase tracking-wide"><CreditCard className="text-emerald-500" size={16}/> สรุปค่าใช้จ่าย</h3>{fin.remainingToCollect <= 0 && <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-1 rounded-full font-bold flex items-center gap-1"><CheckCircle size={10}/> ชำระครบ</span>}</div>
                        <div className="p-5 space-y-3 text-sm">
                            <div className="flex justify-between"><span>ค่าห้องพัก ({fin.count || fin.nights} {fin.count ? 'ห้อง' : 'คืน'})</span><span className="font-medium">{fin.grandTotalRoomPrice?.toLocaleString() || fin.roomTotal?.toLocaleString()}</span></div>
                            <div className="flex justify-between items-center"><span>ค่าบริการเสริม</span><input type="number" className="w-20 bg-slate-50 rounded px-2 py-1 text-right focus:ring-2 focus:ring-emerald-500 outline-none" value={formData.extraBedPrice} onChange={e => setFormData({...formData, extraBedPrice: e.target.value})} /></div>
                            <div className="flex justify-between text-blue-600 font-medium"><span>+ เงินประกันกุญแจ</span><span>{Number(formData.keyDeposit).toLocaleString()}</span></div>
                            <div className="flex justify-between text-slate-400 border-b border-slate-100 pb-3 mb-2"><span>ยอดรวมทั้งสิ้น</span><span className="font-bold text-slate-600">{fin.totalBill?.toLocaleString() || fin.grandTotal?.toLocaleString()}</span></div>
                            <div className="flex justify-between text-emerald-600 font-medium"><span>- ชำระแล้ว (มัดจำ+เดิม)</span><span>-{fin.alreadyPaid?.toLocaleString() || fin.previouslyPaid?.toLocaleString()}</span></div>
                            <div className="flex justify-between items-center pt-2"><span className="font-bold text-lg text-red-500">ยอดคงเหลือสุทธิ</span><span className="font-black text-2xl text-red-500">{fin.remainingToCollect?.toLocaleString()} ฿</span></div>
                        </div>
                        <div className="bg-emerald-50/50 p-5 border-t border-emerald-100">
                            <div className="flex justify-between items-center mb-3"><label className="text-sm font-bold text-emerald-800">รับเงินเพิ่มครั้งนี้</label><div className="flex gap-1"><button onClick={() => setFormData({...formData, currentPayment: fin.remainingToCollect})} className="text-[10px] bg-white border border-emerald-200 text-emerald-600 px-2 py-1 rounded hover:bg-emerald-50 font-bold">จ่ายเต็ม</button><button onClick={() => setFormData({...formData, currentPayment: 0})} className="text-[10px] bg-white border border-slate-200 text-slate-600 px-2 py-1 rounded hover:bg-slate-50">0</button></div></div>
                            <div className="flex flex-col gap-3">
                                <input type="number" className="w-full p-3 rounded-xl border border-emerald-200 text-right font-bold text-xl text-emerald-700 focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm mb-2 bg-white" value={formData.currentPayment} onChange={e => setFormData({...formData, currentPayment: e.target.value})} placeholder="0" />
                                <button onClick={handleCheckInSave} className="w-full bg-emerald-600 text-white px-5 py-3 rounded-xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex justify-center items-center gap-2 active:scale-95"><Coins size={20}/> บันทึกรับเงิน</button>
                            </div>
                            {remainingAfterCurrentPay > 0 && <p className="text-xs text-orange-500 text-right mt-2 font-bold">* จะเหลือค้างอีก {remainingAfterCurrentPay.toLocaleString()} บาท</p>}
                        </div>
                    </div>
                </div>
            </div>
            {(currentBookingStatus === 'occupied' || (!isGroupCheckIn && currentBookingStatus === 'occupied')) && (
                <div className="flex justify-end pt-4 border-t border-slate-100">
                    <button onClick={handleCheckout} className="px-8 py-3 bg-orange-500 text-white rounded-xl font-bold shadow-lg hover:bg-orange-600 flex items-center gap-2 transition-all transform active:scale-95"><LogOut size={20}/> เช็คเอาท์ / คืนห้อง</button>
                </div>
            )}
         </div>
      </Modal>

      <Modal isOpen={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} title={expenseModalMode === 'create' ? `บันทึกรายจ่าย` : `แก้ไขรายจ่าย`}>
         <form onSubmit={handleExpenseSubmit} className="space-y-4 text-sm font-sans">
            <div><label className="block text-slate-500 font-bold mb-1.5 text-xs">วันที่จ่าย</label><input type="date" required className="w-full p-2.5 bg-slate-50 border-0 rounded-xl" value={expenseForm.date} onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} /></div>
            <div><label className="block text-slate-500 font-bold mb-1.5 text-xs">รายการ</label><input type="text" required placeholder="เช่น จ่ายค่าเน็ต 3BB" className="w-full p-2.5 bg-slate-50 border-0 rounded-xl" value={expenseForm.title} onChange={e => setExpenseForm({...expenseForm, title: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-3"><div><label className="block text-slate-500 font-bold mb-1.5 text-xs">หมวดหมู่</label><select className="w-full p-2.5 bg-slate-50 border-0 rounded-xl" value={expenseForm.category} onChange={e => setExpenseForm({...expenseForm, category: e.target.value})}>{dynamicCategories.map(c => <option key={c} value={c}>{c}</option>)}<option value="เพิ่มหมวดหมู่ใหม่...">+ เพิ่มหมวดหมู่ใหม่...</option></select>{expenseForm.category === 'เพิ่มหมวดหมู่ใหม่...' && (<input type="text" placeholder="ระบุชื่อหมวดหมู่" className="w-full p-2.5 mt-2 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-800" value={expenseForm.customCategory} onChange={e => setExpenseForm({...expenseForm, customCategory: e.target.value})} autoFocus/>)}</div><div><label className="block text-slate-500 font-bold mb-1.5 text-xs">จำนวนเงิน</label><input type="number" required className="w-full p-2.5 bg-slate-50 border-0 rounded-xl text-red-500 font-bold" value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} /></div></div>
            <div className="grid grid-cols-2 gap-3"><div><label className="block text-slate-500 font-bold mb-1.5 text-xs">จ่ายให้ใคร</label><input list="payees" type="text" required className="w-full p-2.5 bg-slate-50 border-0 rounded-xl" placeholder="ชื่อผู้รับเงิน" value={expenseForm.payee} onChange={e => setExpenseForm({...expenseForm, payee: e.target.value})} /><datalist id="payees">{payeeHistory.map((p,i) => <option key={i} value={p} />)}</datalist></div><div><label className="block text-slate-500 font-bold mb-1.5 text-xs">ช่องทางจ่าย</label><select className="w-full p-2.5 bg-slate-50 border-0 rounded-xl" value={expenseForm.paymentMethod} onChange={e => setExpenseForm({...expenseForm, paymentMethod: e.target.value})}>{PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}</select></div></div>
            <div><label className="block text-slate-500 font-bold mb-1.5 text-xs">หมายเหตุ</label><input type="text" className="w-full p-2.5 bg-slate-50 border-0 rounded-xl" value={expenseForm.note} onChange={e => setExpenseForm({...expenseForm, note: e.target.value})} /></div>
            <div className="flex gap-2 pt-2">{expenseModalMode === 'edit' && <button type="button" onClick={handleDeleteExpense} className="px-4 bg-red-50 text-red-500 rounded-xl font-bold hover:bg-red-100 transition-colors">ลบ</button>}<button type="submit" className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all transform active:scale-95">{expenseModalMode === 'create' ? 'บันทึกรายจ่าย' : 'อัปเดตข้อมูล'}</button></div>
         </form>
      </Modal>
    </div>
  );
}