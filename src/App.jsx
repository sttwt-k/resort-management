import React, { useState, useEffect, useMemo } from 'react';
import { auth, db, storage, appId } from './lib/firebase';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import {
  collection, addDoc, query, onSnapshot, doc, updateDoc, deleteDoc, Timestamp, setDoc,
} from 'firebase/firestore';
import { ref as storageRef, deleteObject } from 'firebase/storage';
import { Modal, ConfirmModal } from './components/Modal';
import { LoginScreen } from './components/LoginScreen';
import {
  DEFAULT_ROOM_SEEDS, DEFAULT_EXPENSE_CATEGORIES, PAYMENT_METHODS, COLORS, TEMP_DURATIONS,
  getNowTimeStr, formatDate, addDays, calculateNights, calculateAge,
  generateSequentialDocNo, uploadBillPhoto, exportToCSV, generateBookingSummary,
  formatThaiDate, THAI_MONTHS_SHORT, THAI_DAYS_SHORT,
} from './lib/utils';
import { 
  Calendar, Users, Phone, Camera, CheckCircle, 
  LogOut, MessageSquare, Plus, BarChart2, 
  Save, X, Key, Wallet, Download, Edit, Layers, 
  Settings, Trash2, Lock, Copy, FileText, User, 
  Shield, LogIn, Clock, CreditCard, Coins, ArrowRight, AlertCircle, Search, Car, Menu,
  MessageCircle, Send, LayoutList, ChevronRight, ChevronLeft, Smartphone, Gift, CheckSquare,
  Receipt, Banknote, QrCode, Image as ImageIcon, Moon, Package, Minus
} from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

// --- Fonts & Styles Injection ---
if (!document.getElementById('custom-font-style')) {
  const fontStyle = document.createElement('style');
  fontStyle.id = 'custom-font-style';
  fontStyle.innerHTML = `
    @import url('https://fonts.googleapis.com/css2?family=Prompt:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap');
    body { font-family: 'Prompt', sans-serif; background-color: #f1f5f9; overflow-x: hidden; max-width: 100vw; }
    
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
    
    @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
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
}

// --- Custom Components ---
const CustomRevenueTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-white p-3 border border-slate-100 rounded-xl shadow-xl text-sm">
                <p className="font-bold text-slate-800 mb-1">{data.name}</p>
                <p className="text-emerald-600 font-bold">รายได้: {data.value.toLocaleString()} ฿</p>
                <p className="text-slate-500 text-xs">จำนวน: {data.totalNights} คืน</p>
            </div>
        );
    }
    return null;
};

const CustomDailyTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-white p-4 border border-slate-100 rounded-xl shadow-xl z-50 min-w-[150px]">
                <p className="font-bold text-slate-500 mb-2 border-b border-slate-100 pb-2 text-xs">วันที่ {label}</p>
                <div className="space-y-1">
                   <p className="text-emerald-600 font-black text-xl leading-none mb-3">{data.revenue.toLocaleString(undefined, {maximumFractionDigits:0})} <span className="text-sm font-bold">฿</span></p>
                   <div className="flex items-center justify-between text-xs font-bold bg-emerald-50 text-emerald-700 px-2 py-1.5 rounded-lg mb-1">
                       <span className="flex items-center gap-1"><Banknote size={12}/> เงินสด</span>
                       <span>{data.cash.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                   </div>
                   <div className="flex items-center justify-between text-xs font-bold bg-blue-50 text-blue-700 px-2 py-1.5 rounded-lg">
                       <span className="flex items-center gap-1"><QrCode size={12}/> เงินโอน</span>
                       <span>{data.transfer.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                   </div>
                </div>
            </div>
        );
    }
    return null;
};

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); 
  const [useMockData, setUseMockData] = useState(false);

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
  const [confirmDialog, setConfirmDialog] = useState(null);

  const [reportMonth, setReportMonth] = useState(formatDate(new Date()).slice(0, 7)); 
  const [reportSelectedDay, setReportSelectedDay] = useState(null); 
  const [isReportDetailOpen, setIsReportDetailOpen] = useState(false); 
  const [reportViewMode, setReportViewMode] = useState('weekly');
  const [selectedReportWeek, setSelectedReportWeek] = useState(0);
  const [reportDayPopup, setReportDayPopup] = useState(null);

  const [dynamicCategories, setDynamicCategories] = useState(DEFAULT_EXPENSE_CATEGORIES);
  const [payeeHistory, setPayeeHistory] = useState([]);
  const [isRoomSettingsOpen, setIsRoomSettingsOpen] = useState(false);
  const [roomForm, setRoomForm] = useState({ id: '', name: '', type: '', price: '' });

  const [isLineModalOpen, setIsLineModalOpen] = useState(false);
  const [lineMessage, setLineMessage] = useState('');
  const [isBookingSummaryOpen, setIsBookingSummaryOpen] = useState(false);
  const [bookingSummaryText, setBookingSummaryText] = useState('');

  const [isMessagePreviewOpen, setIsMessagePreviewOpen] = useState(false);
  const [messagePreviewText, setMessagePreviewText] = useState('');

  const [guestSearchTerm, setGuestSearchTerm] = useState('');
  const [timelineStartDate, setTimelineStartDate] = useState(formatDate(new Date()));

  const [selectedStaffRooms, setSelectedStaffRooms] = useState([]);
  const [isStaffCheckInModalOpen, setIsStaffCheckInModalOpen] = useState(false);
  const [selectedBookedRoom, setSelectedBookedRoom] = useState(null); 
  const [isStaffBookingModalOpen, setIsStaffBookingModalOpen] = useState(false);
  const [isTempModalOpen, setIsTempModalOpen] = useState(false);
  const [tempRoom, setTempRoom] = useState(null);
  const [tempForm, setTempForm] = useState({ guestName: '', price: 200, durationHours: 3, paymentMethod: 'เงินสด', keyDepositCollected: false });
  
  const [staffCheckInForm, setStaffCheckInForm] = useState({
      guestName: '',
      checkInTimeStr: getNowTimeStr(),
      totalPrice: 0,
      nights: 1,
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
    licensePlate: '', idCard: '', lineId: '', dob: '', billPhotoUrl: null,
    checkInTimeStr: getNowTimeStr(), checkOutTimeStr: ''
  };
  const [formData, setFormData] = useState(initialBookingForm);

  const initialExpenseForm = { docNo: '', title: '', amount: '', category: 'ของใช้สิ้นเปลือง (สบู่/ทิชชู่)', date: formatDate(new Date()), note: '', payee: '', paymentMethod: 'เงินสด', customCategory: '' };
  const [expenseForm, setExpenseForm] = useState(initialExpenseForm);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  // ── Consumables / Stock ──
  const [consumables, setConsumables] = useState([]);
  const [consumableLogs, setConsumableLogs] = useState([]);
  const [consumableCategories, setConsumableCategories] = useState([]);
  const [isConsumableItemModalOpen, setIsConsumableItemModalOpen] = useState(false);
  const [consumableItemForm, setConsumableItemForm] = useState({id:'', name:'', unit:'ชิ้น', packUnit:'', unitsPerPack:0, minStock:5, category:''});
  const [consumableItemFormMode, setConsumableItemFormMode] = useState('create');
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [restockTarget, setRestockTarget] = useState(null);
  const [restockQty, setRestockQty] = useState('');
  const [restockIsPackUnit, setRestockIsPackUnit] = useState(false);
  const [restockTotalCost, setRestockTotalCost] = useState('');
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState(null);
  const [transferForm, setTransferForm] = useState({qty:'', direction:'toRoom'});
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({id:'', name:'', showToStaff:true, color:'#10b981'});
  // Purchase session (multi-item)
  const [isPurchaseSessionOpen, setIsPurchaseSessionOpen] = useState(false);
  const [purchaseSession, setPurchaseSession] = useState({store:'', date:'', items:[]});
  // Log editing
  const [isEditLogModalOpen, setIsEditLogModalOpen] = useState(false);
  const [editLogTarget, setEditLogTarget] = useState(null);
  const [editLogForm, setEditLogForm] = useState({qty:'', cost:'', date:'', note:''});
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ mode:'count', consumableId:'', newCount:'', deltaDir:'+', deltaQty:'', date:'', note:'' });
  const [stockCategoryFilter, setStockCategoryFilter] = useState('');
  const [isUseConsumableModalOpen, setIsUseConsumableModalOpen] = useState(false);
  const [usageTargetRoomId, setUsageTargetRoomId] = useState(null);
  const [consumableUsageMap, setConsumableUsageMap] = useState({});
  const [stockSubTab, setStockSubTab] = useState('items');
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  // Housekeeping
  const [isHousekeepingViewOpen, setIsHousekeepingViewOpen] = useState(false);
  const [isCleaningRecordOpen, setIsCleaningRecordOpen] = useState(false);
  const [cleaningTargetRoomId, setCleaningTargetRoomId] = useState(null);
  const [cleaningUsageMap, setCleaningUsageMap] = useState({});
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
    let isMounted = true;
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        if (isMounted) {
            const isBlocked = error.code === 'auth/requests-from-referer-blocked' || error.message.includes('blocked');
            if (isBlocked) {
                 console.warn("Firebase Auth blocked in Preview environment. Switching to Demo Mode.");
            } else {
                 console.error("Authentication Error:", error);
            }
            setUseMockData(true);
            setUser({ uid: 'mock-user', isAnonymous: true });
            setLoading(false);
            if (!notification) {
                showNotification('เชื่อมต่อ Firebase ไม่ได้ (ติดสิทธิ์ Domain) - สลับใช้โหมดจำลองข้อมูล', 'error');
            }
        }
      }
    };
    
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (u) => {
        if (isMounted) {
            if (u) {
                setUser(u);
                setUseMockData(false);
                setLoading(false);
            }
        }
    });

    return () => {
        isMounted = false;
        unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (useMockData) {
        setRooms(DEFAULT_ROOM_SEEDS);
        setBookings([
            { id: 'm1', roomId: '1', roomName: 'บ้าน 1', guestName: 'คุณสมชาย (ตัวอย่าง)', checkInDate: formatDate(new Date()), checkOutDate: addDays(formatDate(new Date()), 1), status: 'occupied', totalPrice: 500, deposit: 0, totalPaid: 0, paymentMethod: 'เงินโอน' },
            { id: 'm2', roomId: '3', roomName: 'บ้าน 3', guestName: 'คุณสมหญิง (ตัวอย่าง)', checkInDate: addDays(formatDate(new Date()), 1), checkOutDate: addDays(formatDate(new Date()), 2), status: 'booked', totalPrice: 700, deposit: 300, totalPaid: 0, paymentMethod: 'เงินสด' }
        ]);
        setExpenses([
             { id: 'e1', title: 'ซื้อน้ำดื่ม', amount: 50, category: 'น้ำดื่ม', date: formatDate(new Date()), docNo: 'EX-Mock-001', payee: '7-11', paymentMethod: 'เงินสด' }
        ]);
        setLoading(false);
        return;
    }

    if (!user) return;
    
    const qRooms = query(collection(db, 'artifacts', appId, 'public', 'data', 'rooms'));
    const unsubRooms = onSnapshot(qRooms, 
        async (snapshot) => {
            if (snapshot.empty) { 
                await Promise.all(DEFAULT_ROOM_SEEDS.map(r => setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', r.id), r))); 
                setLoading(false); 
            } 
            else { 
                setRooms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b) => a.id.localeCompare(b.id, undefined, { numeric: true }))); 
                setLoading(false); 
            }
        },
        (error) => {
            console.error("Error fetching rooms:", error);
            setUseMockData(true);
            setLoading(false);
        }
    );

    const qBookings = query(collection(db, 'artifacts', appId, 'public', 'data', 'bookings'));
    const unsubBookings = onSnapshot(qBookings, 
        (snapshot) => setBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
        (error) => console.error("Error fetching bookings:", error)
    );

    const qExpenses = query(collection(db, 'artifacts', appId, 'public', 'data', 'expenses'));
    const unsubExpenses = onSnapshot(qExpenses, 
        (snapshot) => {
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setExpenses(docs);
            setPayeeHistory([...new Set(docs.map(d => d.payee).filter(Boolean))]);
            setDynamicCategories([...new Set([...DEFAULT_EXPENSE_CATEGORIES, ...docs.map(d => d.category).filter(Boolean)])]);
        },
        (error) => console.error("Error fetching expenses:", error)
    );

    const qConsumables = query(collection(db, 'artifacts', appId, 'public', 'data', 'consumables'));
    const unsubConsumables = onSnapshot(qConsumables, snap => setConsumables(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    const qConsumableLogs = query(collection(db, 'artifacts', appId, 'public', 'data', 'consumableLogs'));
    const unsubConsumableLogs = onSnapshot(qConsumableLogs, snap => setConsumableLogs(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    const qCategories = query(collection(db, 'artifacts', appId, 'public', 'data', 'consumableCategories'));
    const unsubCategories = onSnapshot(qCategories, snap => {
      const cats = snap.docs.map(d => ({id: d.id, ...d.data()}));
      if (cats.length === 0) {
        // seed defaults on first run
        const defaults = [
          {name:'ทำความสะอาด', showToStaff:true, color:'#f97316'},
          {name:'ของใช้เติมห้อง', showToStaff:true, color:'#10b981'},
          {name:'ผ้า', showToStaff:true, color:'#3b82f6'},
        ];
        defaults.forEach(c => addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'consumableCategories'), c));
      } else {
        setConsumableCategories(cats);
      }
    });

    return () => { unsubRooms(); unsubBookings(); unsubExpenses(); unsubConsumables(); unsubConsumableLogs(); unsubCategories(); };
  }, [user, useMockData]);

  const showNotification = (msg, type = 'success') => { setNotification({ message: msg, type }); setTimeout(() => setNotification(null), 3000); };
  const showConfirm = (options) => setConfirmDialog(options);

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

    const temporary = relevantBookings.find(b => {
      if (b.status !== 'temporary') return false;
      if (b.checkInDate === date) return true;
      const start = new Date(b.checkInDate).getTime();
      const end = new Date(b.checkOutDate).getTime();
      return (targetTime >= start && targetTime < end) || (targetTime >= end && targetTime <= todayTime);
    });
    if (temporary) return { status: 'temporary', booking: temporary };
    
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

  const handleRoomClick = (room, status, booking, source = 'dashboard') => {
      if (role === 'staff') {
          // Dirty room → open cleaning modal directly
          if (status === 'available' && room.cleaningStatus === 'dirty') {
              openCleaningRecord(room.id);
              return;
          }
          if (status === 'booked') {
             setSelectedBookedRoom({ room, booking });
             setStaffCheckInForm({
                 totalPrice: 0,
                 nights: 1,
                 paymentMethod: 'เงินสด',
                 isReceiptNeeded: false,
                 keyDepositCollected: false,
                 billPhoto: null
             });
             setIsStaffBookingModalOpen(true);
             return;
          }
          if (status === 'available' || status === 'checked-out') {
              if (selectedStaffRooms.includes(room.id)) {
                  setSelectedStaffRooms(prev => prev.filter(id => id !== room.id));
              } else {
                  setSelectedStaffRooms(prev => [...prev, room.id]);
              }
          }
          if (status === 'occupied') {
              if (selectedStaffRooms.includes(room.id)) {
                  setSelectedStaffRooms(prev => prev.filter(id => id !== room.id));
              } else {
                  setSelectedStaffRooms(prev => [...prev, room.id]);
              }
          }
          return;
      }

      setSelectedRoom(room);
      const isClickingPastBooking = booking && source === 'timeline'; 

      if (status === 'available' || (status === 'checked-out' && !isClickingPastBooking)) {
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
            licensePlate: booking.licensePlate || '', idCard: booking.idCard || '', lineId: booking.lineId || '', dob: booking.dob || '', billPhotoUrl: booking.billPhotoUrl || null,
            paymentMethod: booking.paymentMethod || 'เงินสด',
            checkInTimeStr: booking.checkInTimeStr || '',
            checkOutTimeStr: booking.checkOutTimeStr || ''
          });
          
          if (status === 'booked') {
              setIsBookingModalOpen(true);
          } else {
              setIsCheckInModalOpen(true);
          }
      }
  };

  const handleStaffNightsChange = (newNights) => {
      const n = Math.max(1, parseInt(newNights) || 1); 
      let baseTotal = 0;
      selectedStaffRooms.forEach(rId => {
          const room = rooms.find(r => r.id === rId);
          if (room) baseTotal += room.price;
      });
      setStaffCheckInForm({
          ...staffCheckInForm,
          nights: n,
          totalPrice: baseTotal * n 
      });
  };

  const handleStaffBulkAction = async (actionType) => {
      if (selectedStaffRooms.length === 0) return;

      if (actionType === 'checkin') {
          let total = 0;
          selectedStaffRooms.forEach(rId => {
              const room = rooms.find(r => r.id === rId);
              const { status } = checkRoomStatus(rId, selectedDate, true);
              if (status !== 'occupied' && status !== 'booked') {
                  total += room.price;
              }
          });
          setStaffCheckInForm({
              totalPrice: total,
              nights: 1, 
              paymentMethod: 'เงินสด',
              isReceiptNeeded: false,
              keyDepositCollected: false,
              billPhoto: null
          });
          setIsStaffCheckInModalOpen(true);
      } else if (actionType === 'checkout') {
          showConfirm({
              title: 'ยืนยันคืนห้อง',
              message: `คืนห้องจำนวน ${selectedStaffRooms.length} ห้อง?`,
              confirmLabel: 'คืนห้อง',
              variant: 'default',
              onConfirm: async () => {
                  try {
                      if (useMockData) { showNotification('โหมดตัวอย่าง: คืนห้องสำเร็จ'); setSelectedStaffRooms([]); return; }
                      const checkoutRooms = selectedStaffRooms.map(rId => {
                          const { status, booking } = checkRoomStatus(rId, selectedDate, false);
                          if (status !== 'occupied') return null;
                          return { rId, booking };
                      }).filter(Boolean);
                      const batchPromises = checkoutRooms.flatMap(({ rId, booking }) => [
                          updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', booking.id), {
                              status: 'checked-out', checkOutDate: selectedDate,
                              checkOutTime: Timestamp.now(), keyDepositReturned: true
                          }),
                          updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', rId), { cleaningStatus: 'dirty' })
                      ]);
                      if(batchPromises.length > 0) await Promise.all(batchPromises);
                      showNotification(`คืนห้อง ${checkoutRooms.length} ห้อง เรียบร้อยแล้ว`);
                      setSelectedStaffRooms([]);
                  } catch (e) {
                      console.error(e);
                      showNotification('เกิดข้อผิดพลาด', 'error');
                  }
              }
          });
      }
  };

  const confirmStaffCheckIn = async (isBookedRoom = false) => {
      if (useMockData) { showNotification('โหมดตัวอย่าง: บันทึกข้อมูลสำเร็จ'); setIsStaffCheckInModalOpen(false); setIsStaffBookingModalOpen(false); setSelectedStaffRooms([]); return; }

      const checkInNights = staffCheckInForm.nights || 1;
      const checkoutDate = addDays(selectedDate, checkInNights); 
      const checkInDocNo = generateSequentialDocNo('RC', selectedDate, bookings);

      // Upload bill photo to Firebase Storage (not Firestore) — avoids 1MB doc limit
      const billPhotoUrl = await uploadBillPhoto(staffCheckInForm.billPhoto, checkInDocNo);

      try {
          if (isBookedRoom && selectedBookedRoom) {
              const { booking } = selectedBookedRoom;
              await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', booking.id), {
                  status: 'occupied',
                  checkInTime: Timestamp.now(),
                  checkInTimeStr: getNowTimeStr(),
                  checkInDocNo: checkInDocNo,
                  keyDeposit: staffCheckInForm.keyDepositCollected ? 100 : 0,
                  totalPaid: (booking.totalPrice - booking.deposit) + (staffCheckInForm.keyDepositCollected ? 100 : 0),
                  paymentMethod: staffCheckInForm.paymentMethod,
                  isReceiptRequested: staffCheckInForm.isReceiptNeeded,
                  billPhotoUrl: billPhotoUrl || null,
              });
              setIsStaffBookingModalOpen(false);
              showNotification('เช็คอินลูกค้าจอง เรียบร้อยแล้ว');
          } else {
              const pricePerRoom = staffCheckInForm.totalPrice / selectedStaffRooms.length;
              const batchPromises = selectedStaffRooms.map((rId) => {
                  const room = rooms.find(r => r.id === rId);
                  const { status } = checkRoomStatus(rId, selectedDate, true);
                  if (status === 'occupied' || status === 'booked') return null;
                  return addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'bookings'), {
                      roomId: rId, roomName: room.name, roomPrice: room.price,
                      guestName: staffCheckInForm.guestName || 'walk-in', phone: '',
                      checkInDate: selectedDate,
                      checkOutDate: checkoutDate,
                      nights: checkInNights,
                      totalPrice: pricePerRoom,
                      totalPaid: pricePerRoom,
                      deposit: 0,
                      keyDeposit: staffCheckInForm.keyDepositCollected ? 100 : 0,
                      extraBedPrice: 0,
                      paymentMethod: staffCheckInForm.paymentMethod,
                      isReceiptRequested: staffCheckInForm.isReceiptNeeded,
                      billPhotoUrl: billPhotoUrl || null,
                      status: 'occupied',
                      docNo: generateSequentialDocNo('BK', selectedDate, bookings),
                      checkInDocNo: checkInDocNo,
                      checkInTime: Timestamp.now(),
                      checkInTimeStr: getNowTimeStr(),
                      updatedAt: Timestamp.now(), updatedBy: 'staff-mode'
                  });
              }).filter(Boolean);
              if(batchPromises.length > 0) await Promise.all(batchPromises);
              showNotification(`เช็คอินเรียบร้อย (${checkInNights} คืน)`);
              setIsStaffCheckInModalOpen(false);
              setStaffCheckInForm(prev => ({...prev, guestName: '', checkInTimeStr: getNowTimeStr(), billPhoto: null}));
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
            const totalCost = (booking.roomPrice * nights) + (booking.extraBedPrice || 0);
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
    const message = `สรุปห้องพัก "จันผารีสอร์ท" \nวันที่: ${formatThaiDate(selectedDate, 'full')}\n--------------------\n✅ ว่าง (${availableList.length}):\n${availableList.length > 0 ? availableList.join(', ') : '-'}\n\n🏠 เข้าพัก (${occupiedList.length}):\n${occupiedList.length > 0 ? occupiedList.join('\n') : '-'}\n\n📒 จองไว้ (${bookedList.length}):\n${bookedList.length > 0 ? bookedList.join('\n') : '-'}\n--------------------`;
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
      if (useMockData) { showNotification('โหมดตัวอย่าง: บันทึกห้องพักแล้ว'); setRoomForm({ id: '', name: '', type: '', price: '' }); return; }
      try { await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomForm.id), { ...roomForm, price: Number(roomForm.price) }); showNotification('บันทึกห้องพักแล้ว'); setRoomForm({ id: '', name: '', type: '', price: '' }); } catch(error) { showNotification('เกิดข้อผิดพลาด', 'error'); }
  };
  
  const handleDeleteRoom = (rid) => {
      showConfirm({
          title: 'ลบห้องพัก',
          message: 'ยืนยันลบห้องนี้? ข้อมูลจะหายถาวร',
          confirmLabel: 'ลบ',
          variant: 'danger',
          onConfirm: async () => {
              if (useMockData) { showNotification('โหมดตัวอย่าง: ลบห้องสำเร็จ'); return; }
              try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', rid)); showNotification('ลบห้องพักสำเร็จ'); } catch(e){ showNotification('ลบไม่สำเร็จ', 'error'); }
          }
      });
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

    if (useMockData) { 
        showNotification('โหมดตัวอย่าง: บันทึกการจองสำเร็จ'); 
        setIsBookingModalOpen(false); 
        return; 
    }

    const nights = calculateNights(formData.checkInDate, formData.checkOutDate);
    const commonData = {
      guestName: formData.guestName, phone: formData.phone, checkInDate: formData.checkInDate, checkOutDate: formData.checkOutDate,
      nights, note: formData.note, updatedAt: Timestamp.now(), updatedBy: user.uid,
      licensePlate: formData.licensePlate || '', idCard: formData.idCard || '', lineId: formData.lineId || '', dob: formData.dob || ''
    };

    try {
      if (!formData.id) { 
        const depositDocNo = generateSequentialDocNo('BK', formData.checkInDate, bookings);
        const roomsToBook = [selectedRoom.id, ...formData.selectedAdditionalRooms];
        const totalDeposit = Number(formData.deposit) || 0;
        const depositPerRoom = roomsToBook.length > 0 ? Math.floor(totalDeposit / roomsToBook.length) : 0;

        const batchPromises = roomsToBook.map((rId, index) => {
            const rConfig = rooms.find(r => r.id === rId);
            return addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'bookings'), {
                ...commonData, roomId: rConfig.id, roomName: rConfig.name, roomPrice: rConfig.price,
                totalPrice: rConfig.price * nights, 
                deposit: depositPerRoom,
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
         // ✅ BUG FIX 5: Add new rooms to group if any selected
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

         // อัปเดตห้องหลัก
         await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', formData.id), {
             ...commonData, roomPrice: Number(formData.roomPrice), totalPrice: Number(formData.roomPrice) * nights, deposit: Number(formData.deposit)
         });

         // ✅ BUG FIX 5: Sync guest info and dates to all sibling rooms in the group
         const siblingIds = formData.groupCheckInRooms.filter(id => id !== formData.id);
         if (siblingIds.length > 0) {
             const siblingUpdates = siblingIds.map(id =>
                 updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', id), {
                     guestName: formData.guestName,
                     phone: formData.phone,
                     checkInDate: formData.checkInDate,
                     checkOutDate: formData.checkOutDate,
                     nights,
                     note: formData.note,
                     licensePlate: formData.licensePlate || '',
                     idCard: formData.idCard || '',
                     lineId: formData.lineId || '',
                     dob: formData.dob || '',
                     updatedAt: Timestamp.now()
                 })
             );
             await Promise.all(siblingUpdates);
         }
         
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
     if (useMockData) { showNotification('โหมดตัวอย่าง: บันทึกข้อมูลสำเร็จ'); setIsCheckInModalOpen(false); return; }

     const existingBooking = bookings.find(b => b.id === formData.id);
     const isAlreadyCheckedOut = existingBooking?.status === 'checked-out';
     const isAlreadyOccupied = existingBooking?.status === 'occupied';
     const newRcDocNo = formData.checkInDocNo || generateSequentialDocNo('RC', formatDate(new Date()), bookings);
     const paymentInHand = Number(formData.currentPayment);
     const commonUpdate = {
         licensePlate: formData.licensePlate || '', idCard: formData.idCard || '',
         lineId: formData.lineId || '', dob: formData.dob || '',
         guestName: formData.guestName, phone: formData.phone
     };

     if (formData.groupCheckInRooms.length > 1) {
         const allGroupBookings = bookings.filter(b => formData.groupCheckInRooms.includes(b.id));

         const doGroupSave = async () => {
             try {
                 let remainingPool = allGroupBookings.reduce((sum, b) => sum + (b.totalPaid || 0), 0) + paymentInHand;
                 const updates = allGroupBookings.map(b => {
                     const nights = calculateNights(b.checkInDate, b.checkOutDate);
                     const roomCost = b.roomPrice * nights;
                     let allocated = 0;
                     if (remainingPool >= roomCost) { allocated = roomCost; remainingPool -= roomCost; }
                     else { allocated = remainingPool; remainingPool = 0; }
                     return { id: b.id, allocated, isPrimary: b.id === formData.id, bStatus: b.status };
                 });
                 const primaryUpdate = updates.find(u => u.isPrimary);
                 if (primaryUpdate) primaryUpdate.allocated += remainingPool;
                 const batch = updates.map(u => {
                     const targetBStatus = u.bStatus === 'checked-out' ? 'checked-out' : 'occupied';
                     const bTimeUpdate = u.bStatus === 'booked' ? { checkInTime: Timestamp.now(), checkInTimeStr: formData.checkInTimeStr || getNowTimeStr() } : {};
                     return updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', u.id), {
                         ...commonUpdate, ...bTimeUpdate, status: targetBStatus, checkInDocNo: newRcDocNo,
                         totalPaid: u.allocated, keyDeposit: u.isPrimary ? Number(formData.keyDeposit) : 0,
                         extraBedPrice: u.isPrimary ? Number(formData.extraBedPrice) : 0,
                         paymentMethod: formData.paymentMethod
                     });
                 });
                 await Promise.all(batch);
                 showNotification('บันทึกรายการเรียบร้อย');
                 setIsCheckInModalOpen(false);
             } catch(err) { console.error(err); showNotification('เกิดข้อผิดพลาด', 'error'); }
         };

         // ✅ BUG FIX 4: Warn if payment pool is insufficient
         const totalRequired = allGroupBookings.reduce((sum, b) => {
             const n = calculateNights(b.checkInDate, b.checkOutDate);
             return sum + (b.roomPrice * n);
         }, 0) + Number(formData.extraBedPrice) + Number(formData.keyDeposit);
         const totalCovered = allGroupBookings.reduce((sum, b) =>
             sum + (b.deposit || 0) + (b.totalPaid || 0), 0) + paymentInHand;
         if (totalCovered < totalRequired) {
             const shortfall = (totalRequired - totalCovered).toLocaleString();
             showConfirm({
                 title: 'ยอดเงินยังไม่ครบ',
                 message: `ยอดเงินรวมยังไม่ครบ ขาดอีก ${shortfall} บาท\nต้องการบันทึกต่อหรือไม่?`,
                 confirmLabel: 'บันทึกต่อ',
                 variant: 'warning',
                 onConfirm: doGroupSave
             });
             return;
         }
         await doGroupSave();
     } else {
         try {
             const newTotalPaid = Number(formData.totalPaid) + paymentInHand;
             const targetStatus = isAlreadyCheckedOut ? 'checked-out' : 'occupied';
             const timeUpdate = (!isAlreadyCheckedOut && !isAlreadyOccupied) ? { checkInTime: Timestamp.now(), checkInTimeStr: formData.checkInTimeStr || getNowTimeStr() } : {};
             await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', formData.id), {
                 ...commonUpdate, ...timeUpdate, status: targetStatus, checkInDocNo: newRcDocNo,
                 keyDeposit: Number(formData.keyDeposit), extraBedPrice: Number(formData.extraBedPrice),
                 totalPaid: newTotalPaid, paymentMethod: formData.paymentMethod,
                 ...(formData.checkOutTimeStr ? { checkOutTimeStr: formData.checkOutTimeStr } : {})
             });
             showNotification('บันทึกรายการเรียบร้อย');
             setIsCheckInModalOpen(false);
         } catch(err) { console.error(err); showNotification('เกิดข้อผิดพลาด', 'error'); }
     }
  };

  const handleCheckout = () => {
     if(!formData.id) return;
     if (useMockData) { showNotification('โหมดตัวอย่าง: เช็คเอาท์สำเร็จ'); setIsCheckInModalOpen(false); return; }
     const today = formatDate(new Date());
     const originalCheckout = formData.checkOutDate;
     const earlyCheckout = today < originalCheckout && today >= formData.checkInDate;

     const doCheckout = async (adjustedNights = null, adjustedPrice = null) => {
         try {
             const payload = { status: 'checked-out', checkOutTime: Timestamp.now(), checkOutTimeStr: getNowTimeStr(), keyDepositReturned: true };
             if (adjustedNights) { payload.checkOutDate = today; payload.nights = adjustedNights; payload.totalPrice = adjustedPrice; }
             // Update all rooms in the group to needs-cleaning
             const groupBids = formData.groupCheckInRooms?.length > 0 ? formData.groupCheckInRooms : [formData.id];
             const groupBookingDocs = bookings.filter(b => groupBids.includes(b.id));
             await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', formData.id), payload);
             await Promise.all(groupBookingDocs.map(b =>
               b.roomId ? updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', b.roomId), { cleaningStatus: 'dirty' }) : null
             ).filter(Boolean));
             setIsCheckInModalOpen(false);
             showNotification(adjustedNights ? "เช็คเอาท์และปรับปรุงยอดเงินเรียบร้อย ✅" : "เช็คเอาท์เรียบร้อย ✅");
         } catch(e) { showNotification('เกิดข้อผิดพลาด', 'error'); }
     };

     if(earlyCheckout) {
         const newNights = calculateNights(formData.checkInDate, today);
         const actualNights = newNights > 0 ? newNights : 1;
         const newPrice = formData.roomPrice * actualNights;
         showConfirm({
             title: 'คืนห้องก่อนกำหนด',
             message: `ลูกค้าคืนห้องก่อนกำหนด (${actualNights} คืน)\nต้องการปรับยอดค่าห้องเป็น ${newPrice.toLocaleString()} บาท หรือไม่?`,
             confirmLabel: 'ปรับยอดและเช็คเอาท์',
             cancelLabel: 'เช็คเอาท์ราคาเดิม',
             variant: 'warning',
             onConfirm: () => doCheckout(actualNights, newPrice)
         });
         return;
     }

     const keyDep = Number(formData.keyDeposit);
     showConfirm({
         title: 'ยืนยันเช็คเอาท์',
         message: keyDep > 0 ? `คืนมัดจำกุญแจ ${keyDep.toLocaleString()} บาท แล้ว?\n\nยืนยันเช็คเอาท์?` : 'ยืนยันเช็คเอาท์?',
         confirmLabel: 'เช็คเอาท์',
         variant: 'default',
         onConfirm: () => doCheckout()
     });
  };

  const handleCheckoutSingle = (bid, keyDep) => {
     showConfirm({
         title: 'ยืนยันเช็คเอาท์',
         message: `ยืนยันเช็คเอาท์ห้องนี้?${keyDep > 0 ? `\n(อย่าลืมคืนมัดจำ ${keyDep} บาท)` : ''}`,
         confirmLabel: 'เช็คเอาท์',
         variant: 'default',
         onConfirm: async () => {
             if (useMockData) { showNotification('โหมดตัวอย่าง: เช็คเอาท์สำเร็จ'); return; }
             try {
                 await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', bid), { status: 'checked-out', checkOutTime: Timestamp.now(), checkOutTimeStr: getNowTimeStr(), keyDepositReturned: true });
                 const bkDoc = bookings.find(b => b.id === bid);
                 if (bkDoc?.roomId) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', bkDoc.roomId), { cleaningStatus: 'dirty' });
                 showNotification("เช็คเอาท์เรียบร้อย ✅");
             } catch (error) { showNotification("เกิดข้อผิดพลาด", "error"); }
         }
     });
  };

  const handleCheckInSingle = (bid, roomName) => {
     showConfirm({
         title: 'ยืนยันเช็คอิน',
         message: `เช็คอิน ${roomName}?`,
         confirmLabel: 'เช็คอิน',
         variant: 'default',
         onConfirm: async () => {
             if (useMockData) { showNotification('โหมดตัวอย่าง: เช็คอินสำเร็จ'); return; }
             try {
                 await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', bid), {
                     status: 'occupied',
                     checkInTime: Timestamp.now(),
                     checkInTimeStr: getNowTimeStr(),
                 });
                 showNotification(`เช็คอิน ${roomName} เรียบร้อยแล้ว ✅`);
             } catch (error) { showNotification("เกิดข้อผิดพลาด", "error"); }
         }
     });
  };

  const handleDeleteBooking = () => {
      showConfirm({
          title: 'ยกเลิกการจอง',
          message: 'ต้องการยกเลิกการจองนี้หรือไม่?\nข้อมูลจะถูกลบถาวร',
          confirmLabel: 'ยกเลิกการจอง',
          variant: 'danger',
          onConfirm: async () => {
              if (useMockData) { showNotification('โหมดตัวอย่าง: ยกเลิกสำเร็จ'); setIsBookingModalOpen(false); return; }
              try {
                  await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', formData.id));
                  setIsBookingModalOpen(false); showNotification("ยกเลิกการจองสำเร็จ");
              } catch (error) { showNotification("เกิดข้อผิดพลาด", "error"); }
          }
      });
  };

  const goToCheckIn = () => {
      setIsBookingModalOpen(false);
      setTimeout(() => setIsCheckInModalOpen(true), 100);
  };

  const openTempModal = (room) => {
      setTempRoom(room);
      setTempForm({ guestName: '', price: room.price, durationHours: 3, paymentMethod: 'เงินสด', keyDepositCollected: false });
      setIsTempModalOpen(true);
  };

  const handleTempCheckIn = async () => {
      if (!tempRoom) return;
      if (useMockData) {
          const now = new Date();
          const out = new Date(now.getTime() + tempForm.durationHours * 3600000);
          showNotification(`เช็คอินชั่วคราว ออก ${out.toTimeString().slice(0,5)} น.`);
          setIsTempModalOpen(false); return;
      }
      const now = new Date();
      const checkInTimeStr = now.toTimeString().slice(0,5);
      const checkOutDT = new Date(now.getTime() + tempForm.durationHours * 3600000);
      const scheduledCheckOutTimeStr = checkOutDT.toTimeString().slice(0,5);
      const checkInDate = formatDate(now);
      const checkOutDate = formatDate(checkOutDT);
      try {
          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'bookings'), {
              roomId: tempRoom.id, roomName: tempRoom.name,
              guestName: tempForm.guestName || 'ลูกค้าชั่วคราว',
              checkInDate, checkOutDate,
              checkInTimeStr, scheduledCheckOutTimeStr,
              durationHours: tempForm.durationHours,
              totalPrice: tempForm.price, totalPaid: tempForm.price,
              deposit: 0, keyDeposit: tempForm.keyDepositCollected ? 100 : 0,
              extraBedPrice: 0, paymentMethod: tempForm.paymentMethod,
              status: 'temporary', nights: 0, roomPrice: tempRoom.price,
              docNo: generateSequentialDocNo('TM', checkInDate, bookings),
              checkInTime: Timestamp.now(), createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
          });
          showNotification(`เช็คอินชั่วคราว — ออก ${scheduledCheckOutTimeStr} น.`);
          setIsTempModalOpen(false); setTempRoom(null);
      } catch(e) { console.error(e); showNotification('เกิดข้อผิดพลาด', 'error'); }
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
    if (useMockData) { showNotification('โหมดตัวอย่าง: บันทึกรายจ่ายสำเร็จ'); setIsExpenseModalOpen(false); return; }
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

  const handleDeleteExpense = () => {
    showConfirm({
        title: 'ลบรายจ่าย',
        message: 'ต้องการลบรายการนี้หรือไม่?',
        confirmLabel: 'ลบ',
        variant: 'danger',
        onConfirm: async () => {
            if(useMockData){ showNotification('ลบสำเร็จ (ตัวอย่าง)'); setIsExpenseModalOpen(false); return; }
            try {
                await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'expenses', expenseForm.id));
                setIsExpenseModalOpen(false);
                showNotification('ลบรายจ่ายสำเร็จ');
            } catch(e) { showNotification('เกิดข้อผิดพลาด', 'error'); }
        }
    });
  };

  // ── Consumable Handlers ──────────────────────────────────────────────────────
  const openConsumableItemModal = (item = null) => {
    if (item) {
      setConsumableItemForm({id: item.id, name: item.name, unit: item.unit, packUnit: item.packUnit||'', unitsPerPack: item.unitsPerPack||0, minStock: item.minStock||5, category: item.category||''});
      setConsumableItemFormMode('edit');
    } else {
      setConsumableItemForm({id:'', name:'', unit:'ชิ้น', packUnit:'', unitsPerPack:0, minStock:5, category: consumableCategories[0]?.name||''});
      setConsumableItemFormMode('create');
    }
    setIsConsumableItemModalOpen(true);
  };

  const handleSaveConsumableItem = async (e) => {
    e.preventDefault();
    const payload = {
      name: consumableItemForm.name, unit: consumableItemForm.unit,
      packUnit: consumableItemForm.packUnit,
      unitsPerPack: Number(consumableItemForm.unitsPerPack)||0,
      minStock: Number(consumableItemForm.minStock)||0,
      category: consumableItemForm.category||'',
    };
    try {
      if (consumableItemFormMode === 'create') {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'consumables'), {...payload, stockQty: 0, mainStock: 0, roomStock: 0, avgCostPerUnit: 0, createdAt: Timestamp.now()});
        showNotification('เพิ่มรายการแล้ว');
      } else {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'consumables', consumableItemForm.id), payload);
        showNotification('บันทึกการแก้ไขแล้ว');
      }
      setIsConsumableItemModalOpen(false);
    } catch(e) { showNotification('เกิดข้อผิดพลาด', 'error'); }
  };

  const handleDeleteConsumableItem = () => {
    showConfirm({ title: 'ลบรายการ', message: `ลบ "${consumableItemForm.name}" ออกจากระบบ?`, variant: 'danger', confirmLabel: 'ลบ',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'consumables', consumableItemForm.id));
          showNotification('ลบแล้ว'); setIsConsumableItemModalOpen(false);
        } catch(e) { showNotification('ลบไม่สำเร็จ', 'error'); }
      }
    });
  };

  const openRestockModal = (item) => { setRestockTarget(item); setRestockQty(''); setRestockIsPackUnit(false); setIsRestockModalOpen(true); };

  const handleRestock = async () => {
    if (!restockTarget || !restockQty) return;
    const unitsToAdd = restockIsPackUnit ? Number(restockQty) * (restockTarget.unitsPerPack||1) : Number(restockQty);
    const costForLog = unitsToAdd * (restockTarget.avgCostPerUnit||restockTarget.costPerUnit||0);
    const currentMain = restockTarget.mainStock ?? restockTarget.stockQty ?? 0;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'consumables', restockTarget.id), { mainStock: currentMain + unitsToAdd, stockQty: currentMain + unitsToAdd });
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'consumableLogs'), {
        consumableId: restockTarget.id, consumableName: restockTarget.name,
        qty: unitsToAdd, unit: restockTarget.unit, logType: 'restock',
        date: selectedDate, cost: costForLog,
        note: restockIsPackUnit ? `เติม ${restockQty} ${restockTarget.packUnit}` : '',
        createdAt: Timestamp.now(),
      });
      showNotification(`เติมสต๊อก ${unitsToAdd} ${restockTarget.unit}`); setIsRestockModalOpen(false);
    } catch(e) { showNotification('เกิดข้อผิดพลาด', 'error'); }
  };

  // ── Transfer between main ↔ room storage ──
  const openTransferModal = (item) => {
    setTransferTarget(item);
    setTransferForm({qty:'', direction:'toRoom'});
    setIsTransferModalOpen(true);
  };

  const handleTransfer = async () => {
    if (!transferTarget || !transferForm.qty) return;
    const qty = Number(transferForm.qty);
    const currentMain = transferTarget.mainStock ?? transferTarget.stockQty ?? 0;
    const currentRoom = transferTarget.roomStock ?? 0;
    let newMain = currentMain, newRoom = currentRoom;
    if (transferForm.direction === 'toRoom') {
      if (qty > currentMain) { showNotification('คลังหลักไม่พอ', 'error'); return; }
      newMain = currentMain - qty; newRoom = currentRoom + qty;
    } else {
      if (qty > currentRoom) { showNotification('คลังห้องพักไม่พอ', 'error'); return; }
      newMain = currentMain + qty; newRoom = currentRoom - qty;
    }
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'consumables', transferTarget.id), {
        mainStock: newMain, roomStock: newRoom, stockQty: newMain + newRoom,
      });
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'consumableLogs'), {
        consumableId: transferTarget.id, consumableName: transferTarget.name,
        qty, unit: transferTarget.unit, logType: 'transfer',
        direction: transferForm.direction,
        date: selectedDate, cost: 0, note: transferForm.direction === 'toRoom' ? 'โอนไปคลังห้องพัก' : 'คืนคลังหลัก',
        createdAt: Timestamp.now(),
      });
      showNotification(`โอน ${qty} ${transferTarget.unit} เรียบร้อยแล้ว ✅`);
      setIsTransferModalOpen(false);
    } catch(e) { showNotification('เกิดข้อผิดพลาด', 'error'); }
  };

  // ── Category management ──
  const openCategoryModal = (cat = null) => {
    if (cat) setCategoryForm({id: cat.id, name: cat.name, showToStaff: cat.showToStaff !== false, color: cat.color || '#10b981'});
    else setCategoryForm({id:'', name:'', showToStaff:true, color:'#10b981'});
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) return;
    const payload = {name: categoryForm.name.trim(), showToStaff: categoryForm.showToStaff, color: categoryForm.color || '#10b981'};
    try {
      if (categoryForm.id) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'consumableCategories', categoryForm.id), payload);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'consumableCategories'), payload);
      }
      showNotification('บันทึกหมวดหมู่แล้ว'); setIsCategoryModalOpen(false);
    } catch(e) { showNotification('เกิดข้อผิดพลาด', 'error'); }
  };

  // --- Purchase Session (multi-item) ---
  const openPurchaseSession = () => {
    setPurchaseSession({ store: '', date: formatDate(new Date()), items: [{ consumableId: '', qty: '', conversionFactor: '1', totalCost: '', note: '' }] });
    setIsPurchaseSessionOpen(true);
  };

  const handleSavePurchaseSession = async () => {
    const validItems = purchaseSession.items.filter(it => it.consumableId && Number(it.qty) > 0 && Number(it.totalCost) >= 0);
    if (validItems.length === 0) { showNotification('กรอกข้อมูลให้ครบ', 'error'); return; }
    if (useMockData) { showNotification('โหมดตัวอย่าง: บันทึกสำเร็จ'); setIsPurchaseSessionOpen(false); return; }
    try {
      const date = purchaseSession.date || formatDate(new Date());
      const totalExpense = validItems.reduce((s, it) => s + Number(it.totalCost), 0);
      // Update each consumable
      for (const it of validItems) {
        const item = consumables.find(c => c.id === it.consumableId);
        if (!item) continue;
        const rawQty = Number(it.qty);
        const convFactor = Math.max(1, Number(it.conversionFactor) || 1);
        const unitsToAdd = rawQty * convFactor; // convert purchase units → base units
        const totalCost = Number(it.totalCost);
        const ppu = unitsToAdd > 0 ? totalCost / unitsToAdd : 0;
        const currentMain = item.mainStock ?? item.stockQty ?? 0;
        const currentAvg = item.avgCostPerUnit ?? item.costPerUnit ?? 0;
        const newAvg = (currentMain + unitsToAdd) > 0
          ? (currentMain * currentAvg + totalCost) / (currentMain + unitsToAdd) : ppu;
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'consumables', item.id), {
          mainStock: currentMain + unitsToAdd,
          roomStock: item.roomStock ?? 0,
          avgCostPerUnit: Math.round(newAvg * 100) / 100,
        });
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'consumableLogs'), {
          consumableId: item.id, consumableName: item.name,
          qty: unitsToAdd, unit: item.unit, logType: 'purchase',
          cost: totalCost, date, createdAt: Timestamp.now(),
          note: it.note || (purchaseSession.store ? `ร้าน: ${purchaseSession.store}` : ''),
        });
      }
      // Single expense record for the whole purchase
      if (totalExpense > 0) {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'expenses'), {
          date, title: `ซื้อของใช้${purchaseSession.store ? ` — ${purchaseSession.store}` : ''}`,
          amount: totalExpense, category: 'ของใช้สิ้นเปลือง (สบู่/ทิชชู่)',
          payee: purchaseSession.store || 'ร้านค้า', paymentMethod: 'เงินสด', note: '',
          createdAt: Timestamp.now(),
        });
      }
      showNotification(`บันทึกการซื้อ ${validItems.length} รายการ ✅`);
      setIsPurchaseSessionOpen(false);
    } catch(e) { console.error(e); showNotification('เกิดข้อผิดพลาด', 'error'); }
  };

  // --- Log editing ---
  const openEditLog = (log) => {
    setEditLogTarget(log);
    setEditLogForm({ qty: log.qty, cost: log.cost || 0, date: log.date || '', note: log.note || '' });
    setIsEditLogModalOpen(true);
  };

  // --- Stock Adjustment ---
  const openAdjustModal = (item = null) => {
    setAdjustForm({
      mode: 'count',
      consumableId: item ? item.id : '',
      newCount: '',
      deltaDir: '+',
      deltaQty: '',
      date: formatDate(new Date()),
      note: '',
    });
    setIsAdjustModalOpen(true);
  };

  const handleSaveAdjustment = async () => {
    if (!adjustForm.consumableId) { showNotification('เลือกรายการก่อน', 'error'); return; }
    const item = consumables.find(c => c.id === adjustForm.consumableId);
    if (!item) return;
    if (useMockData) { showNotification('โหมดตัวอย่าง: ปรับปรุงสต๊อกแล้ว'); setIsAdjustModalOpen(false); return; }

    const currentMain = item.mainStock ?? item.stockQty ?? 0;
    let delta = 0;
    let newStock = 0;

    if (adjustForm.mode === 'count') {
      if (adjustForm.newCount === '') { showNotification('กรอกยอดที่นับได้', 'error'); return; }
      newStock = Math.max(0, Number(adjustForm.newCount));
      delta = newStock - currentMain;
    } else {
      if (!adjustForm.deltaQty) { showNotification('กรอกจำนวนที่ปรับ', 'error'); return; }
      delta = adjustForm.deltaDir === '+' ? Number(adjustForm.deltaQty) : -Number(adjustForm.deltaQty);
      newStock = Math.max(0, currentMain + delta);
    }

    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'consumables', item.id), {
        mainStock: newStock,
        roomStock: item.roomStock ?? 0,
      });
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'consumableLogs'), {
        consumableId: item.id,
        consumableName: item.name,
        qty: Math.abs(delta),
        unit: item.unit,
        logType: 'adjustment',
        adjustDir: delta >= 0 ? '+' : '-',
        cost: 0,
        date: adjustForm.date || formatDate(new Date()),
        note: adjustForm.note || (adjustForm.mode === 'count' ? `นับสต๊อก: ${currentMain}→${newStock}` : ''),
        createdAt: Timestamp.now(),
      });
      showNotification(delta === 0 ? 'ยืนยันยอดสต๊อกแล้ว ✅' : `ปรับสต๊อกแล้ว (${delta >= 0 ? '+' : ''}${delta} ${item.unit}) ✅`);
      setIsAdjustModalOpen(false);
    } catch(e) { console.error(e); showNotification('เกิดข้อผิดพลาด', 'error'); }
  };

  const handleSaveLogEdit = async () => {
    if (!editLogTarget) return;
    if (useMockData) { showNotification('โหมดตัวอย่าง: แก้ไขสำเร็จ'); setIsEditLogModalOpen(false); return; }
    try {
      const oldQty = Number(editLogTarget.qty);
      const newQty = Number(editLogForm.qty);
      const delta  = newQty - oldQty;
      // Update the log record
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'consumableLogs', editLogTarget.id), {
        qty: newQty,
        cost: Number(editLogForm.cost),
        date: editLogForm.date,
        note: editLogForm.note,
      });
      // Adjust the consumable stock to reflect the qty change
      if (delta !== 0) {
        const item = consumables.find(c => c.id === editLogTarget.consumableId);
        if (item) {
          const currentMain = item.mainStock ?? item.stockQty ?? 0;
          const currentRoom = item.roomStock ?? 0;
          let updates = {};
          if (editLogTarget.logType === 'purchase') {
            updates.mainStock = Math.max(0, currentMain + delta);
          } else if (editLogTarget.logType === 'use') {
            updates.mainStock = Math.max(0, currentMain - delta);
          } else if (editLogTarget.logType === 'transfer') {
            updates.mainStock = Math.max(0, currentMain - delta);
            updates.roomStock  = Math.max(0, currentRoom + delta);
          }
          if (Object.keys(updates).length > 0) {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'consumables', item.id), updates);
          }
        }
      }
      showNotification('แก้ไขประวัติและอัพเดตสต๊อกแล้ว ✅'); setIsEditLogModalOpen(false);
    } catch(e) { console.error(e); showNotification('เกิดข้อผิดพลาด', 'error'); }
  };

  const handleDeleteLog = async () => {
    if (!editLogTarget) return;
    showConfirm({ title: 'ลบประวัติ', message: `ลบรายการนี้ออกจากประวัติ?`, variant: 'danger', confirmLabel: 'ลบ',
      onConfirm: async () => {
        try {
          const item = consumables.find(c => c.id === editLogTarget.consumableId);
          if (item) {
            const oldQty = Number(editLogTarget.qty);
            const currentMain = item.mainStock ?? item.stockQty ?? 0;
            const currentRoom = item.roomStock ?? 0;
            let updates = {};
            if (editLogTarget.logType === 'purchase') {
              updates.mainStock = Math.max(0, currentMain - oldQty);
            } else if (editLogTarget.logType === 'use') {
              updates.mainStock = currentMain + oldQty;
            } else if (editLogTarget.logType === 'transfer') {
              updates.mainStock = currentMain + oldQty;
              updates.roomStock  = Math.max(0, currentRoom - oldQty);
            }
            if (Object.keys(updates).length > 0) {
              await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'consumables', item.id), updates);
            }
          }
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'consumableLogs', editLogTarget.id));
          showNotification('ลบแล้ว'); setIsEditLogModalOpen(false);
        } catch(e) { showNotification('ลบไม่สำเร็จ','error'); }
      }
    });
  };

  // --- Housekeeping handlers ---
  const openCleaningRecord = (roomId) => {
    setCleaningTargetRoomId(roomId);
    setCleaningUsageMap({});
    setIsCleaningRecordOpen(true);
  };

  const handleMarkRoomClean = async () => {
    if (!cleaningTargetRoomId) return;
    if (useMockData) { showNotification('โหมดตัวอย่าง: ห้องสะอาดแล้ว ✅'); setIsCleaningRecordOpen(false); return; }
    try {
      // Record consumables used during cleaning
      const usedEntries = Object.entries(cleaningUsageMap).filter(([,v]) => Number(v) > 0);
      const today = formatDate(new Date());
      for (const [cId, qty] of usedEntries) {
        const item = consumables.find(c => c.id === cId);
        if (!item) continue;
        const numQty = Number(qty);
        const currentRoom = item.roomStock ?? 0;
        const currentMain = item.mainStock ?? item.stockQty ?? 0;
        const newRoomStock = Math.max(0, currentRoom - numQty);
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'consumables', item.id), {
          roomStock: newRoomStock,
          stockQty: currentMain + newRoomStock,
        });
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'consumableLogs'), {
          consumableId: item.id, consumableName: item.name, qty: numQty,
          unit: item.unit, logType: 'use', cost: numQty * (item.avgCostPerUnit ?? 0),
          date: today, roomId: cleaningTargetRoomId,
          note: 'ทำความสะอาดห้อง', createdAt: Timestamp.now(),
        });
      }
      // Mark room clean
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', cleaningTargetRoomId), { cleaningStatus: 'clean' });
      showNotification('ทำความสะอาดเสร็จแล้ว ✅');
      setIsCleaningRecordOpen(false);
    } catch(e) { console.error(e); showNotification('เกิดข้อผิดพลาด', 'error'); }
  };

  const handleDeleteCategory = async () => {
    if (!categoryForm.id) return;
    showConfirm({ title:'ลบหมวดหมู่', message:`ลบ "${categoryForm.name}"?`, variant:'danger', confirmLabel:'ลบ',
      onConfirm: async () => {
        try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'consumableCategories', categoryForm.id)); setIsCategoryModalOpen(false); }
        catch(e) { showNotification('ลบไม่สำเร็จ','error'); }
      }
    });
  };

  const openUseConsumableModal = (roomId) => { setUsageTargetRoomId(roomId); setConsumableUsageMap({}); setIsUseConsumableModalOpen(true); };

  const handleRecordUsage = async () => {
    const entries = Object.entries(consumableUsageMap).filter(([, qty]) => Number(qty) > 0);
    if (entries.length === 0) { showNotification('ยังไม่ได้ใส่จำนวน', 'error'); return; }
    const room = rooms.find(r => r.id === usageTargetRoomId);
    try {
      await Promise.all(entries.flatMap(([cId, qty]) => {
        const item = consumables.find(c => c.id === cId);
        if (!item) return [];
        const numQty = Number(qty);
        return [
          updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'consumables', cId), {
            roomStock: Math.max(0, (item.roomStock ?? 0) - numQty),
            stockQty: Math.max(0, (item.mainStock ?? item.stockQty ?? 0)) + Math.max(0, (item.roomStock ?? 0) - numQty),
          }),
          addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'consumableLogs'), {
            consumableId: cId, consumableName: item.name, qty: numQty, unit: item.unit,
            logType: 'use', roomId: usageTargetRoomId, roomName: room?.name||'',
            date: selectedDate, cost: numQty * (item.avgCostPerUnit||item.costPerUnit||0), note: '', createdAt: Timestamp.now(),
          }),
        ];
      }));
      showNotification('บันทึกของใช้เรียบร้อย'); setIsUseConsumableModalOpen(false);
    } catch(e) { showNotification('เกิดข้อผิดพลาด', 'error'); }
  };

  // ✅ BUG FIX 3: Report Logic — roomRevenue now accumulates from daily loop (consistent with line chart)
  // and reportBookings counts pro-rated revenue for cross-month bookings
  const reportData = useMemo(() => {
    const targetMonth = reportMonth;
    if (!targetMonth) return { monthlyRevenue: 0, monthlyCash: 0, monthlyTransfer: 0, monthlyExpense: 0, netProfit: 0, lineData: [], roomPieData: [], expensePieData: [], reportBookings: [], reportExpenses: [] };
    
    const dailyRevenue = {};
    const year = parseInt(targetMonth.split('-')[0]);
    const month = parseInt(targetMonth.split('-')[1]);
    const daysInMonth = new Date(year, month, 0).getDate();
    
    for (let i = 1; i <= daysInMonth; i++) dailyRevenue[`${targetMonth}-${String(i).padStart(2, '0')}`] = { revenue: 0, cash: 0, transfer: 0 };
    let monthlyRevenue = 0, monthlyCash = 0, monthlyTransfer = 0, monthlyExpense = 0;
    // ✅ roomRevenue now built inside daily loop so cross-month bookings are counted correctly
    const roomRevenue = {}, reportBookings = [], reportExpenses = [], expenseCats = {};

    Object.keys(dailyRevenue).forEach(dayDate => {
        bookings.forEach(b => {
            if (b.status === 'occupied' || b.status === 'checked-out') {
                if (dayDate >= b.checkInDate && dayDate < b.checkOutDate) {
                    const totalRoomRev = (b.totalPrice || 0) + (b.extraBedPrice || 0);
                    const nights = b.nights || 1;
                    const dailyAvg = totalRoomRev / nights;
                    
                    dailyRevenue[dayDate].revenue += dailyAvg;
                    if (b.paymentMethod === 'เงินโอน') {
                        dailyRevenue[dayDate].transfer += dailyAvg;
                    } else {
                        dailyRevenue[dayDate].cash += dailyAvg;
                    }
                    // ✅ Accumulate roomRevenue daily — handles cross-month bookings correctly
                    roomRevenue[b.roomName] = (roomRevenue[b.roomName] || 0) + dailyAvg;
                }
            }
        });
        monthlyRevenue += dailyRevenue[dayDate].revenue;
        monthlyCash += dailyRevenue[dayDate].cash;
        monthlyTransfer += dailyRevenue[dayDate].transfer;
    });

    // ✅ reportBookings: count bookings that overlap with this month (not just startsWith)
    const monthStart = `${targetMonth}-01`;
    const monthEnd = `${targetMonth}-${String(daysInMonth).padStart(2, '0')}`;
    bookings.forEach(b => {
       if ((b.status === 'occupied' || b.status === 'checked-out') &&
           b.checkInDate <= monthEnd && b.checkOutDate > monthStart) {
           const totalRoomRev = (b.totalPrice || 0) + (b.extraBedPrice || 0);
           const nights = b.nights || 1;
           const dailyRate = totalRoomRev / nights;
           // Pro-rate: count only nights that fall within this month
           const effectiveStart = b.checkInDate > monthStart ? b.checkInDate : monthStart;
           const effectiveEnd = b.checkOutDate <= addDays(monthEnd, 1) ? b.checkOutDate : addDays(monthEnd, 1);
           const nightsInMonth = Math.max(calculateNights(effectiveStart, effectiveEnd), 0);
           const proRatedRevenue = Math.round(dailyRate * nightsInMonth);
           reportBookings.push({ 
               Type: 'รายได้', DocNo: b.checkInDocNo || b.docNo, 
               CheckIn: b.checkInDate, CheckOut: b.checkOutDate,
               Room: b.roomName, Customer: b.guestName, Amount: proRatedRevenue 
           });
       }
    });

    expenses.forEach(ex => { if(ex.date && ex.date.startsWith(targetMonth)) { monthlyExpense += ex.amount; reportExpenses.push({ ...ex }); expenseCats[ex.category] = (expenseCats[ex.category] || 0) + ex.amount; }});
    
    reportBookings.sort((a, b) => a.CheckIn.localeCompare(b.CheckIn));
    reportExpenses.sort((a, b) => a.date.localeCompare(b.date));

    const roomPieData = Object.keys(roomRevenue).map(name => ({ name, value: Math.round(roomRevenue[name]) })).sort((a, b) => b.value - a.value);
    roomPieData.forEach(item => {
        let nights = 0;
        bookings.forEach(b => {
            if(b.roomName === item.name && (b.status === 'occupied' || b.status === 'checked-out')) {
                // Count nights overlapping this month
                if (b.checkInDate <= monthEnd && b.checkOutDate > monthStart) {
                    const effectiveStart = b.checkInDate > monthStart ? b.checkInDate : monthStart;
                    const effectiveEnd = b.checkOutDate <= addDays(monthEnd, 1) ? b.checkOutDate : addDays(monthEnd, 1);
                    nights += Math.max(calculateNights(effectiveStart, effectiveEnd), 0);
                }
            }
        });
        item.totalNights = nights;
    });

    return { 
        monthlyRevenue, monthlyCash, monthlyTransfer, monthlyExpense, netProfit: monthlyRevenue - monthlyExpense, 
        lineData: Object.keys(dailyRevenue).sort().map(date => ({ 
            date: date.split('-')[2], 
            revenue: dailyRevenue[date].revenue,
            cash: dailyRevenue[date].cash,
            transfer: dailyRevenue[date].transfer
        })),
        roomPieData,
        expensePieData: Object.keys(expenseCats).map(name => ({ name, value: expenseCats[name] })), 
        reportBookings, reportExpenses 
    };
  }, [bookings, expenses, reportMonth]);

  const weeklyBreakdown = useMemo(() => {
    const weeks = [[], [], [], []];
    reportData.lineData.forEach((d) => {
      const dayNum = parseInt(d.date);
      const weekIdx = Math.min(Math.floor((dayNum - 1) / 7), 3);
      weeks[weekIdx].push({ ...d, dayNum });
    });
    return weeks;
  }, [reportData.lineData]);

  const monthHistorySummary = useMemo(() => {
    const thaiMonthNames = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    const computeMonth = (monthKey) => {
      const [y, m] = monthKey.split('-').map(Number);
      const dim = new Date(y, m, 0).getDate();
      const mStart = `${monthKey}-01`;
      const mEnd = `${monthKey}-${String(dim).padStart(2,'0')}`;
      let income = 0;
      bookings.forEach(b => {
        if ((b.status === 'occupied' || b.status === 'checked-out') &&
            b.checkInDate <= mEnd && b.checkOutDate > mStart) {
          const rev = (b.totalPrice || 0) + (b.extraBedPrice || 0);
          const n = b.nights || 1;
          const daily = rev / n;
          const effStart = b.checkInDate > mStart ? b.checkInDate : mStart;
          const effEnd = b.checkOutDate <= addDays(mEnd, 1) ? b.checkOutDate : addDays(mEnd, 1);
          const nightsIn = Math.max(calculateNights(effStart, effEnd), 0);
          income += Math.round(daily * nightsIn);
        }
      });
      let expense = 0;
      expenses.forEach(ex => { if (ex.date && ex.date.startsWith(monthKey)) expense += ex.amount; });
      return { income, expense };
    };
    const results = [];
    for (let i = 5; i >= 0; i--) {
      const base = new Date(reportMonth + '-01');
      base.setMonth(base.getMonth() - i);
      const curKey = formatDate(base).slice(0,7);
      const prevBase = new Date(base);
      prevBase.setFullYear(prevBase.getFullYear() - 1);
      const prevKey = formatDate(prevBase).slice(0,7);
      const cur = computeMonth(curKey);
      const prev = computeMonth(prevKey);
      const cm = parseInt(curKey.split('-')[1]);
      const cy = parseInt(curKey.split('-')[0]);
      results.push({
        monthKey: curKey,
        label: `${thaiMonthNames[cm-1]} ${(cy+543).toString().slice(-2)}`,
        shortLabel: thaiMonthNames[cm-1],
        income: cur.income,
        expense: cur.expense,
        profit: cur.income - cur.expense,
        prevIncome: prev.income,
      });
    }
    return results;
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
                  details.push({ room: b.roomName, guest: b.guestName, amount: dailyAvg, paymentMethod: b.paymentMethod || 'เงินสด' });
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

  const occupancyData = useMemo(() => {
    const [year, month] = reportMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthStart = `${reportMonth}-01`;
    const monthEnd = `${reportMonth}-${String(daysInMonth).padStart(2, '0')}`;
    return rooms.map(room => {
      let occupiedNights = 0;
      bookings.forEach(b => {
        if (b.roomId !== room.id) return;
        if (b.status !== 'occupied' && b.status !== 'checked-out') return;
        const start = b.checkInDate >= monthStart ? b.checkInDate : monthStart;
        const end = b.checkOutDate <= monthEnd ? b.checkOutDate : monthEnd;
        const diff = (new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24);
        if (diff > 0) occupiedNights += diff;
      });
      const nights = Math.min(Math.round(occupiedNights), daysInMonth);
      return {
        roomName: room.name,
        roomId: room.id,
        occupiedNights: nights,
        rate: Math.round((nights / daysInMonth) * 100),
        daysInMonth,
      };
    }).sort((a, b) => b.rate - a.rate);
  }, [rooms, bookings, reportMonth]);

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
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-100 text-slate-800 pb-28 md:pb-20 font-sans">
      {notification && <div className={`fixed top-6 right-6 px-6 py-4 rounded-2xl shadow-xl z-[70] text-white font-medium flex items-center gap-2 animate-fade-in ${notification.type === 'error' ? 'bg-red-500' : 'bg-emerald-600'}`}>{notification.type === 'error' ? <AlertCircle size={20}/> : <CheckCircle size={20}/>} {notification.message}</div>}
      <ConfirmModal dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />

      <header className="bg-white/95 backdrop-blur-md text-emerald-900 shadow-sm sticky top-0 z-40 border-b border-white">
        <div className="w-full max-w-full px-3 md:px-6 py-3 flex justify-between items-center relative gap-2">
          <div className="flex items-center gap-2 flex-shrink-0">
              <div className="bg-gradient-to-tr from-emerald-500 to-teal-400 text-white p-2 rounded-xl font-bold shadow-md shadow-emerald-200 text-sm flex-shrink-0">CR</div>
              <div className="min-w-0">
                  <h1 className="text-base md:text-xl font-extrabold tracking-tight leading-tight">Chanpha Resort</h1>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                      {role === 'owner' ? 'Owner Mode' : 'Staff Mode'}
                      {useMockData && <span className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded ml-1 animate-pulse">DEMO</span>}
                  </span>
              </div>
          </div>
          
          <div className="hidden md:flex items-center gap-3">
              {role === 'owner' && (
                  <div className="flex bg-slate-100/80 p-1 rounded-2xl gap-1">
                    <button onClick={() => setCurrentView('dashboard')} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${currentView === 'dashboard' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><Calendar size={18} /> <span className="hidden md:inline">หน้าหลัก</span></button>
                    <button onClick={() => setCurrentView('timeline')} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${currentView === 'timeline' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><LayoutList size={18} /> <span className="hidden md:inline">ไทม์ไลน์</span></button>
                    <button onClick={() => setCurrentView('customers')} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${currentView === 'customers' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><Users size={18} /> <span className="hidden md:inline">ลูกค้า</span></button>
                    <button onClick={() => setCurrentView('expenses')} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${currentView === 'expenses' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><Wallet size={18} /> <span className="hidden md:inline">รายจ่าย</span></button>
                    <button onClick={() => setCurrentView('stock')} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${currentView === 'stock' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><Package size={18} /> <span className="hidden md:inline">สต๊อก</span></button>
                    <button onClick={() => setCurrentView('report')} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${currentView === 'report' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><BarChart2 size={18} /> <span className="hidden md:inline">รายงาน</span></button>
                  </div>
              )}
              {role === 'staff' && (
                  <div className="flex items-center gap-2">
                      {(() => {
                        const dirtyCount = rooms.filter(r => r.cleaningStatus === 'dirty').length;
                        return (
                          <button onClick={() => setIsHousekeepingViewOpen(true)} className={`relative px-3 py-2 rounded-xl font-bold text-sm flex items-center gap-1.5 transition-all ${dirtyCount > 0 ? 'bg-purple-100 text-purple-700 border border-purple-300 animate-pulse' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>
                            🧹 <span className="hidden sm:inline">แม่บ้าน</span>
                            {dirtyCount > 0 && <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center">{dirtyCount}</span>}
                          </button>
                        );
                      })()}
                      {selectedStaffRooms.length > 0 ? (
                          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 p-1.5 rounded-xl animate-fade-in shadow-sm">
                              <span className="font-black text-emerald-700 px-2 text-sm">{selectedStaffRooms.length} ห้อง</span>
                              <button onClick={() => handleStaffBulkAction('checkin')} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-bold shadow-md hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-1 text-sm"><LogIn size={16}/> เช็คอิน</button>
                              <button onClick={() => { if(selectedStaffRooms.length === 1){ const r = rooms.find(x => x.id === selectedStaffRooms[0]); if(r){ openTempModal(r); setSelectedStaffRooms([]); } } else showNotification('เลือก 1 ห้องสำหรับลูกค้าชั่วคราว', 'error'); }} className="bg-amber-500 text-white px-3 py-1.5 rounded-lg font-bold shadow-md hover:bg-amber-600 active:scale-95 transition-all flex items-center gap-1 text-sm"><Clock size={16}/> ชม.</button>
                              <button onClick={() => handleStaffBulkAction('checkout')} className="bg-white border border-red-200 text-red-600 px-3 py-1.5 rounded-lg font-bold hover:bg-red-50 active:scale-95 transition-all flex items-center gap-1 text-sm"><LogOut size={16}/> คืนห้อง</button>
                              <button onClick={() => setSelectedStaffRooms([])} className="p-1 text-slate-400 hover:text-slate-600 bg-white rounded-full shadow-sm"><X size={16}/></button>
                          </div>
                      ) : (
                          <div className="bg-emerald-50 px-4 py-2 rounded-xl text-emerald-700 font-bold text-sm border border-emerald-100">
                              โหมดใช้งานง่าย (Walk-in)
                          </div>
                      )}
                  </div>
              )}
              <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>
              {role === 'owner' && <button onClick={() => setIsRoomSettingsOpen(true)} className="p-3 bg-white border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 hover:text-emerald-600 transition-colors shadow-sm"><Settings size={18}/></button>}
              <button onClick={() => setRole(null)} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 hover:text-red-600 transition-colors shadow-sm"><LogOut size={18}/></button>
          </div>

          <div className="flex md:hidden items-center gap-1.5 min-w-0">
              {role === 'staff' && selectedStaffRooms.length > 0 && (
                  <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 px-1.5 py-1 rounded-xl animate-fade-in shadow-sm">
                      <span className="font-black text-emerald-700 px-1 text-xs">{selectedStaffRooms.length}</span>
                      <button onClick={() => handleStaffBulkAction('checkin')} className="bg-emerald-600 text-white w-9 h-8 rounded-lg font-bold shadow-md hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center"><LogIn size={15}/></button>
                      <button onClick={() => { if(selectedStaffRooms.length === 1){ const r = rooms.find(x => x.id === selectedStaffRooms[0]); if(r){ openTempModal(r); setSelectedStaffRooms([]); } } else showNotification('เลือก 1 ห้อง', 'error'); }} className="bg-amber-500 text-white w-9 h-8 rounded-lg font-bold hover:bg-amber-600 active:scale-95 transition-all flex items-center justify-center"><Clock size={15}/></button>
                      <button onClick={() => handleStaffBulkAction('checkout')} className="bg-white border border-red-200 text-red-500 w-9 h-8 rounded-lg font-bold hover:bg-red-50 active:scale-95 transition-all flex items-center justify-center"><LogOut size={15}/></button>
                      <button onClick={() => setSelectedStaffRooms([])} className="w-7 h-7 text-slate-400 hover:text-slate-600 bg-white rounded-full shadow-sm flex items-center justify-center"><X size={14}/></button>
                  </div>
              )}
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-emerald-600 shadow-sm active:scale-95 transition-all flex-shrink-0">
                {isMobileMenuOpen ? <X size={22}/> : <Menu size={22}/>}
              </button>
          </div>
        </div>

        {isMobileMenuOpen && (
            <div className="md:hidden absolute top-full left-0 w-full bg-white/95 backdrop-blur-lg border-t border-slate-100 shadow-xl py-4 px-6 flex flex-col gap-2 z-50 animate-fade-in">
                <button onClick={() => {setCurrentView('dashboard'); setIsMobileMenuOpen(false);}} className={`p-4 rounded-xl text-lg font-bold flex items-center gap-3 ${currentView === 'dashboard' ? 'bg-emerald-50 text-emerald-600' : 'text-slate-500'}`}><Calendar size={24} /> หน้าหลัก</button>
                {role === 'owner' && (
                    <>
                        <button onClick={() => {setCurrentView('timeline'); setIsMobileMenuOpen(false);}} className={`p-4 rounded-xl text-lg font-bold flex items-center gap-3 ${currentView === 'timeline' ? 'bg-emerald-50 text-emerald-600' : 'text-slate-500'}`}><LayoutList size={24} /> ไทม์ไลน์</button>
                        <button onClick={() => {setCurrentView('customers'); setIsMobileMenuOpen(false);}} className={`p-4 rounded-xl text-lg font-bold flex items-center gap-3 ${currentView === 'customers' ? 'bg-emerald-50 text-emerald-600' : 'text-slate-500'}`}><Users size={24} /> ข้อมูลลูกค้า</button>
                        <button onClick={() => {setCurrentView('expenses'); setIsMobileMenuOpen(false);}} className={`p-4 rounded-xl text-lg font-bold flex items-center gap-3 ${currentView === 'expenses' ? 'bg-emerald-50 text-emerald-600' : 'text-slate-500'}`}><Wallet size={24} /> รายจ่าย</button>
                        <button onClick={() => {setCurrentView('stock'); setIsMobileMenuOpen(false);}} className={`p-4 rounded-xl text-lg font-bold flex items-center gap-3 ${currentView === 'stock' ? 'bg-emerald-50 text-emerald-600' : 'text-slate-500'}`}><Package size={24} /> สต๊อกของใช้</button>
                        <button onClick={() => {setCurrentView('report'); setIsMobileMenuOpen(false);}} className={`p-4 rounded-xl text-lg font-bold flex items-center gap-3 ${currentView === 'report' ? 'bg-emerald-50 text-emerald-600' : 'text-slate-500'}`}><BarChart2 size={24} /> รายงาน</button>
                        <hr className="my-2 border-slate-100"/>
                        <button onClick={() => {setIsRoomSettingsOpen(true); setIsMobileMenuOpen(false);}} className="p-4 rounded-xl text-lg font-bold flex items-center gap-3 text-slate-500"><Settings size={24}/> ตั้งค่า</button>
                    </>
                )}
                {role === 'staff' && (
                  <button onClick={() => { setIsHousekeepingViewOpen(true); setIsMobileMenuOpen(false); }} className="p-4 rounded-xl text-lg font-bold flex items-center gap-3 text-purple-700 bg-purple-50">
                    🧹 แม่บ้าน
                    {rooms.filter(r => r.cleaningStatus === 'dirty').length > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-xs font-black rounded-full px-2 py-0.5">{rooms.filter(r => r.cleaningStatus === 'dirty').length} ห้อง</span>
                    )}
                  </button>
                )}
                <button onClick={() => setRole(null)} className="p-4 rounded-xl text-lg font-bold flex items-center gap-3 text-red-500 bg-red-50"><LogOut size={24}/> ออกจากระบบ</button>
            </div>
        )}
      </header>

      <div className="container mx-auto p-3 md:p-6">
        {currentView === 'dashboard' && (
          <div className="space-y-6 animate-fade-in relative">
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col items-center justify-center relative overflow-hidden group hover:shadow-md transition-shadow">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1 z-10">ห้องทั้งหมด</p>
                    <p className="text-3xl md:text-4xl font-black text-slate-800 z-10">{dashboardStats.total}</p>
                </div>
                <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-emerald-200 flex flex-col items-center justify-center relative overflow-hidden group hover:shadow-md transition-shadow">
                    <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-1 z-10">ว่างพร้อมขาย</p>
                    <p className="text-3xl md:text-4xl font-black text-emerald-600 z-10">{dashboardStats.available}</p>
                </div>
                <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-yellow-200 flex flex-col items-center justify-center relative overflow-hidden group hover:shadow-md transition-shadow">
                    <p className="text-yellow-400 text-xs font-bold uppercase tracking-widest mb-1 z-10">จองวันนี้</p>
                    <p className="text-3xl md:text-4xl font-black text-yellow-500 z-10">{dashboardStats.booked}</p>
                </div>
                <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-blue-200 flex flex-col items-center justify-center relative overflow-hidden group hover:shadow-md transition-shadow">
                    <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-1 z-10">เข้าพักอยู่</p>
                    <p className="text-3xl md:text-4xl font-black text-blue-600 z-10">{dashboardStats.occupied}</p>
                </div>
            </div>

            <div className="bg-white/80 backdrop-blur rounded-2xl p-2 flex justify-between items-center gap-2 shadow-sm border border-white">
               <div className="flex flex-col items-center bg-white px-3 py-1.5 rounded-xl shadow-inner border border-slate-100 flex-1 justify-center">
                  <div className="flex items-center gap-2">
                    <button onClick={() => {const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(formatDate(d));}} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-emerald-600 transition-colors">◀</button>
                    <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-transparent font-black text-base text-slate-800 outline-none text-center px-1 cursor-pointer font-mono" />
                    <button onClick={() => {const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(formatDate(d));}} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-emerald-600 transition-colors">▶</button>
                  </div>
                  <span className="text-xs font-bold text-emerald-600">{formatThaiDate(selectedDate, 'full')}</span>
               </div>
               {role === 'owner' && <button onClick={openLineReport} className="bg-[#06C755] text-white px-4 py-2.5 rounded-xl shadow-lg shadow-green-100 text-sm font-bold flex items-center justify-center gap-1 hover:bg-[#05b54d] transition-transform transform active:scale-95"><MessageSquare size={18}/><span className="hidden md:inline"> สรุป LINE</span></button>}
            </div>

            <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-6 ${role === 'staff' ? 'pb-10' : ''}`}>
              {rooms.map((room) => {
                const { status, booking } = checkRoomStatus(room.id, selectedDate, false);
                let cardClass = "bg-white border-2 border-white hover:border-emerald-300 shadow-sm";
                let statusColor = "bg-slate-100 text-slate-500"; let statusLabel = "ว่าง";
                let icon = <Plus size={28} className="text-slate-300 group-hover:text-emerald-500 transition-colors"/>;
                const isOverstay = status === 'occupied' && new Date(selectedDate) >= new Date(booking?.checkOutDate) && selectedDate !== booking?.checkOutDate;
                let remainingAmount = 0;
                if (status === 'occupied') {
                      const nights = booking.nights || 1;
                      // keyDeposit excluded: it's a refundable security deposit tracked separately
                      const totalCost = (booking.roomPrice * nights) + (booking.extraBedPrice || 0);
                      const totalPaid = (booking.totalPaid || 0) + (booking.deposit || 0);
                      remainingAmount = totalCost - totalPaid;
                }
                if (status === 'available' && room.cleaningStatus === 'dirty') { cardClass = "bg-purple-50 border-2 border-purple-200 shadow-sm"; statusColor = "bg-purple-200 text-purple-800"; statusLabel = "รอสะอาด"; icon = <span className="text-2xl">🧹</span>; }
                if (status === 'booked') { cardClass = "bg-yellow-50 border-2 border-yellow-200 shadow-sm"; statusColor = "bg-yellow-200 text-yellow-800"; statusLabel = "จอง"; icon = <Calendar size={24} className="text-yellow-500"/>; }
                if (status === 'occupied') { cardClass = "bg-blue-50 border-2 border-blue-200 shadow-sm"; statusColor = "bg-blue-200 text-blue-800"; statusLabel = "พัก"; icon = <User size={24} className="text-blue-500"/>; }
                if (status === 'temporary') { cardClass = "bg-amber-50 border-2 border-amber-300 shadow-sm"; statusColor = "bg-amber-200 text-amber-800"; statusLabel = "ชั่วคราว"; icon = <Clock size={24} className="text-amber-500"/>; }
                if (isOverstay) { cardClass = "bg-red-50 border-2 border-red-200 shadow-sm"; statusColor = "bg-red-200 text-red-800"; statusLabel = "เกิน"; icon = <AlertCircle size={24} className="text-red-500"/>; }
                const isSelected = selectedStaffRooms.includes(room.id);
                if (role === 'staff') {
                    if (isSelected) {
                        cardClass = "bg-emerald-50 border-2 border-emerald-500 ring-2 ring-emerald-200 transform scale-95 transition-all shadow-md";
                    }
                }
                return (
                  <div key={room.id} onClick={() => handleRoomClick(room, status, booking, 'dashboard')} className={`relative p-4 md:p-6 rounded-3xl cursor-pointer transition-all h-48 md:h-56 flex flex-col group select-none ${cardClass}`}>
                    {/* ปุ่มชั่วคราว — เฉพาะ owner + ห้องว่าง */}
                    {role === 'owner' && status === 'available' && (
                        <button
                            onClick={(e) => { e.stopPropagation(); openTempModal(room); }}
                            className="absolute bottom-3 right-3 text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-bold border border-amber-200 hover:bg-amber-200 transition-colors z-10"
                        >ชั่วคราว</button>
                    )}
                    <div className="relative w-full mb-2 flex items-start justify-between min-h-[32px]">
                         {role === 'staff' && (
                             <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center checkbox-wrapper z-10 flex-shrink-0 ${isSelected ? 'bg-emerald-500 border-emerald-500 selected' : 'bg-white border-slate-200'}`}>
                                 {isSelected && <CheckSquare size={14} className="text-white"/>}
                             </div>
                         )}
                         <span className={`font-extrabold text-lg md:text-2xl text-slate-800 truncate flex-1 ${role === 'staff' ? 'pl-3' : ''}`}>{room.name}</span>
                         <div className={`px-2 py-1 rounded-lg text-[10px] md:text-xs font-black tracking-wider uppercase z-10 flex-shrink-0 ${statusColor}`}>{statusLabel}</div>
                     </div>
                    <div className="flex-1 flex flex-col items-center justify-center">
                      {status === 'available' ? (
                          <>
                            <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-slate-50 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                                {icon}
                            </div>
                            <span className="text-2xl md:text-3xl font-black text-slate-300 group-hover:text-emerald-600 transition-colors">{room.price}</span>
                          </>
                      ) : (
                          <div className="text-center w-full space-y-1 flex flex-col items-center">
                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/60 flex items-center justify-center mx-auto mb-1 shadow-sm backdrop-blur-sm">
                                {icon}
                            </div>
                            <p className="font-bold text-base md:text-lg text-slate-800 truncate px-2 w-full">{booking.guestName}</p>
                            {status === 'booked' && <p className="text-xs md:text-sm text-yellow-700 font-bold">มัดจำ: {Number(booking.deposit || 0).toLocaleString()}</p>}
                            {status === 'occupied' && (
                                remainingAmount > 0 
                                ? <p className="text-[10px] md:text-xs text-red-600 font-black bg-white/80 px-2 py-0.5 rounded-lg border border-red-100">ค้าง {remainingAmount.toLocaleString()}</p>
                                : <p className="text-[10px] md:text-xs text-emerald-600 font-black flex items-center justify-center gap-1 bg-white/80 px-2 py-0.5 rounded-lg border border-emerald-100"><CheckCircle size={10}/> ครบแล้ว</p>
                            )}
                            {status === 'temporary' && (
                                <p className="text-[10px] md:text-xs text-amber-700 font-black bg-amber-100/80 px-2 py-0.5 rounded-lg border border-amber-200">
                                    ออก {booking.scheduledCheckOutTimeStr || '?'} น.
                                </p>
                            )}
                            {booking?.checkInTimeStr && status === 'occupied' && (
                                <p className="text-[10px] text-blue-400 font-bold">เข้า {booking.checkInTimeStr} น.</p>
                            )}
                            {role === 'staff' && status === 'occupied' && consumables.length > 0 && (
                                <button onClick={(e) => { e.stopPropagation(); openUseConsumableModal(room.id); }} className="mt-1 text-[10px] bg-purple-100 text-purple-700 px-2 py-1 rounded-lg font-bold border border-purple-200 hover:bg-purple-200 flex items-center gap-1 mx-auto">
                                    <Package size={10}/> ของใช้
                                </button>
                            )}
                            {booking?.checkOutDate && (
                                <p className="text-[10px] md:text-xs text-slate-500 font-bold bg-slate-100 px-2 py-1 rounded-md mt-1 border border-slate-200">
                                    ออก: {booking.checkOutDate.split('-').reverse().join('/')}
                                </p>
                            )}
                          </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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
                <div className="flex flex-wrap gap-3 bg-white px-5 py-3 rounded-2xl shadow-sm border border-slate-200 text-xs font-bold">
                    <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-yellow-200 border border-yellow-300 inline-block"/><span className="text-slate-600">จอง (Booked)</span></span>
                    <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-blue-200 border border-blue-300 inline-block"/><span className="text-slate-600">กำลังพัก (Occupied)</span></span>
                    <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-slate-200 border border-slate-300 opacity-60 inline-block"/><span className="text-slate-600">คืนห้องแล้ว (Checked-out)</span></span>
                </div>
                <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-200 overflow-x-auto custom-scrollbar p-4">
                    <div className="min-w-[1000px]">
                        {/* Header row */}
                        <div className="timeline-grid mb-0">
                            <div className="font-bold text-slate-400 text-xs px-2 flex items-end pb-2">ห้อง</div>
                            {[...Array(14)].map((_, i) => {
                                const date = addDays(timelineStartDate, i);
                                const d = new Date(date + 'T00:00:00');
                                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                const isToday = date === formatDate(new Date());
                                return (
                                    <div key={i} className={`text-center border-l border-slate-300 py-1 ${isToday ? 'bg-emerald-50 rounded-t-lg' : ''}`}>
                                        <div className={`text-[9px] font-bold ${isWeekend ? 'text-red-400' : 'text-slate-400'}`}>{THAI_DAYS_SHORT[d.getDay()]}</div>
                                        <div className={`text-sm font-black ${isToday ? 'text-emerald-600' : isWeekend ? 'text-red-500' : 'text-slate-700'}`}>{d.getDate()}</div>
                                        <div className={`text-[9px] font-bold ${isWeekend ? 'text-red-400' : 'text-slate-400'}`}>{THAI_MONTHS_SHORT[d.getMonth()]}</div>
                                    </div>
                                );
                            })}
                        </div>
                        {/* Divider */}
                        <div className="border-t-2 border-slate-400 mb-0"/>
                        {/* Room rows */}
                        <div className="">
                            {rooms.map((room, rIdx) => (
                                <div key={room.id} className={`timeline-grid items-center h-11 hover:bg-slate-50 transition-colors group ${rIdx < rooms.length - 1 ? 'border-b border-slate-200' : ''}`}>
                                    <div className="font-bold text-slate-700 text-xs px-2 truncate">{room.name}</div>
                                    {[...Array(14)].map((_, i) => {
                                        const currentDate = addDays(timelineStartDate, i);
                                        const isToday = currentDate === formatDate(new Date());
                                        const { status, booking } = checkRoomStatus(room.id, currentDate, true);

                                        // Also check if this day is the departure (checkOutDate) of a booking
                                        const departureBooking = status === 'available'
                                            ? bookings.find(b => b.roomId === room.id && b.status !== 'cancelled' && b.checkOutDate === currentDate)
                                            : null;
                                        const isDepartureOnly = !!departureBooking;

                                        const cellBg = isToday ? 'bg-emerald-50/60' : '';

                                        if (status === 'available' && !isDepartureOnly) {
                                            return <div key={i} className={`h-full border-l border-slate-300 ${cellBg}`}/>;
                                        }

                                        const effectiveBooking = isDepartureOnly ? departureBooking : booking;
                                        const effectiveStatus  = isDepartureOnly ? departureBooking.status : status;

                                        const isArrival   = !isDepartureOnly && effectiveBooking.checkInDate === currentDate;
                                        const isDeparture = isDepartureOnly; // checkOutDate day
                                        // Show name on first full-width cell (day after arrival); fall back to arrival cell for 1-night stays
                                        const isFirstMiddle = !isArrival && !isDeparture && currentDate === addDays(effectiveBooking.checkInDate, 1);
                                        const bookingNights = calculateNights(effectiveBooking.checkInDate, effectiveBooking.checkOutDate);
                                        const showGuestName = isFirstMiddle || (isArrival && bookingNights <= 1);

                                        let bgClass = 'bg-yellow-300 border-yellow-400';
                                        if (effectiveStatus === 'occupied')     bgClass = 'bg-blue-300 border-blue-400';
                                        if (effectiveStatus === 'checked-out')  bgClass = 'bg-slate-200 border-slate-300 opacity-50';

                                        // Bar spans: middle of arrival day → middle of departure day
                                        let leftPct = '0%', widthPct = '100%';
                                        let roundL = false, roundR = false;
                                        if (isArrival)   { leftPct = '50%'; widthPct = '50%'; roundL = true; }
                                        if (isDeparture) { leftPct = '0%';  widthPct = '50%'; roundR = true; }
                                        const roundClass = `${roundL ? 'rounded-l-full' : ''} ${roundR ? 'rounded-r-full' : ''}`;

                                        return (
                                            <div key={i} className={`relative h-full border-l border-slate-300 ${cellBg}`}>
                                                <div
                                                    className={`absolute top-1/2 -translate-y-1/2 h-6 ${bgClass} border ${roundClass} flex items-center overflow-hidden cursor-pointer hover:opacity-80 transition-opacity`}
                                                    style={{ left: leftPct, width: widthPct }}
                                                    title={`${effectiveBooking.guestName} (${effectiveStatus})`}
                                                    onClick={() => handleRoomClick(room, effectiveStatus, effectiveBooking, 'timeline')}
                                                >
                                                    {showGuestName && <span className="text-[9px] font-bold text-slate-800 whitespace-nowrap pl-2 overflow-hidden">{effectiveBooking.guestName}</span>}
                                                </div>
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
                            placeholder="ค้นหาชื่อ, เบอร์โทร, ทะเบียนรถ, LINE ID..." 
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
                                {/* ✅ BUG FIX 2: Case-insensitive search + LINE ID search */}
                                {guestDirectory.filter(g => {
                                    const term = guestSearchTerm.toLowerCase();
                                    if (!term) return true;
                                    return (
                                        g.name.toLowerCase().includes(term) ||
                                        (g.phone && g.phone.includes(term)) ||
                                        (g.licensePlate && g.licensePlate.toLowerCase().includes(term)) ||
                                        (g.lineId && g.lineId.toLowerCase().includes(term))
                                    );
                                }).map((guest, idx) => (
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
                        {/* ✅ BUG FIX 1: Safe sort — no crash if docNo is null */}
                        {[...expenses].sort((a, b) => {
                            const dateCompare = (b.date || '').localeCompare(a.date || '');
                            if (dateCompare !== 0) return dateCompare;
                            return (b.docNo || '').localeCompare(a.docNo || '');
                        }).map(ex => (
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

        {currentView === 'stock' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3"><Package className="text-emerald-500"/> สต๊อกของใช้</h2>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => openAdjustModal()} className="bg-amber-500 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-amber-200 hover:bg-amber-600 flex items-center gap-2 font-bold transition-all hover:-translate-y-1">
                  <Layers size={18}/> ปรับปรุงสต๊อก
                </button>
                <button onClick={openPurchaseSession} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 flex items-center gap-2 font-bold transition-all hover:-translate-y-1">
                  <Receipt size={18}/> ซื้อของ
                </button>
                {(() => {
                  const lowCount = consumables.filter(item => {
                    const s = item.mainStock ?? item.stockQty ?? 0;
                    return s <= (item.minStock ?? 0);
                  }).length;
                  return (
                    <button onClick={() => setIsReorderModalOpen(true)} className="relative bg-white border border-amber-300 text-amber-700 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-amber-50 transition-all hover:-translate-y-1">
                      <AlertCircle size={18}/> แนะนำซื้อ
                      {lowCount > 0 && <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">{lowCount}</span>}
                    </button>
                  );
                })()}
                {stockSubTab === 'items' && (
                  <button onClick={() => openConsumableItemModal()} className="bg-slate-700 text-white px-4 py-2.5 rounded-xl shadow-lg hover:bg-slate-800 flex items-center gap-2 font-bold transition-all hover:-translate-y-1">
                    <Plus size={18}/> เพิ่มรายการ
                  </button>
                )}
              </div>
            </div>

            {/* Sub-tabs */}
            <div className="bg-white/80 p-1.5 rounded-2xl inline-flex gap-1 shadow-sm border border-white">
              <button onClick={() => setStockSubTab('items')} className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${stockSubTab === 'items' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>รายการสต๊อก</button>
              <button onClick={() => setStockSubTab('logs')} className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${stockSubTab === 'logs' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>ประวัติ</button>
            </div>

            {stockSubTab === 'items' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {consumables.length === 0 && (
                  <div className="col-span-full text-center py-20 text-slate-400">
                    <Package size={52} className="mx-auto mb-4 opacity-25"/>
                    <p className="font-bold text-lg">ยังไม่มีรายการสต๊อก</p>
                    <p className="text-sm mt-1">กด <strong>+ เพิ่มรายการ</strong> เพื่อเริ่มต้นใช้งาน</p>
                  </div>
                )}
                {/* Category filter tabs */}
                <div className="col-span-full flex flex-wrap gap-2 mb-2">
                  <button onClick={() => setStockCategoryFilter('')} className={`px-4 py-1.5 rounded-full font-bold text-xs transition-all ${stockCategoryFilter === '' ? 'bg-slate-700 text-white shadow' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>ทั้งหมด</button>
                  {consumableCategories.map(cat => {
                    const catColor = cat.color || '#10b981';
                    const isActive = stockCategoryFilter === cat.name;
                    return (
                      <button key={cat.id} onClick={() => setStockCategoryFilter(isActive ? '' : cat.name)}
                        className={`px-4 py-1.5 rounded-full font-bold text-xs transition-all flex items-center gap-1.5 border ${isActive ? 'text-white shadow' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                        style={isActive ? {backgroundColor: catColor, borderColor: catColor} : {borderColor: catColor + '60'}}
                      >
                        <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{backgroundColor: catColor}}/>
                        {cat.name}
                      </button>
                    );
                  })}
                  <button onClick={() => openCategoryModal()} className="px-4 py-1.5 rounded-full font-bold text-xs bg-white text-slate-400 border border-dashed border-slate-300 hover:bg-slate-50 flex items-center gap-1"><Plus size={12}/> หมวดหมู่</button>
                </div>
                {[...consumables]
                  .filter(item => !stockCategoryFilter || item.category === stockCategoryFilter)
                  .sort((a,b) => (a.name||'').localeCompare(b.name||''))
                  .map(item => {
                  const mainStock = item.mainStock ?? item.stockQty ?? 0;
                  const roomStock = item.roomStock ?? 0;
                  const totalStock = mainStock + roomStock;
                  const avgCost = item.avgCostPerUnit ?? item.costPerUnit ?? 0;
                  const isOut = totalStock <= 0;
                  const isLow = !isOut && mainStock <= (item.minStock || 0);
                  const catObj = consumableCategories.find(c => c.name === item.category);
                  const catColor = catObj?.color || '#64748b';
                  return (
                    <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3 hover:shadow-md transition-shadow flex flex-col" style={catObj ? {borderTopColor: catColor, borderTopWidth: '3px'} : {}}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-slate-800 text-base leading-tight">{item.name}</h3>
                            {item.category && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold text-white" style={{backgroundColor: catColor}}>
                                {item.category}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            ต้นทุนเฉลี่ย {avgCost > 0 ? avgCost.toLocaleString(undefined,{maximumFractionDigits:2}) : '—'} ฿/{item.unit}
                            {item.packUnit && item.unitsPerPack > 0 && ` · ${item.unitsPerPack} ${item.unit}/${item.packUnit}`}
                          </p>
                        </div>
                        <button onClick={() => openConsumableItemModal(item)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors ml-2 flex-shrink-0"><Edit size={15}/></button>
                      </div>

                      {/* Stock bars */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className={`rounded-xl border px-3 py-2 ${isOut ? 'border-red-200 bg-red-50' : isLow ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">คลังหลัก</p>
                          <p className={`text-xl font-black ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-700'}`}>
                            {mainStock} <span className="text-xs font-bold">{item.unit}</span>
                            {item.packUnit && item.unitsPerPack > 0 && mainStock > 0 && (
                              <span className="text-xs font-normal text-slate-400 ml-1">≈ {(mainStock / item.unitsPerPack).toFixed(1)} {item.packUnit}</span>
                            )}
                          </p>
                          {(isOut || isLow) && <p className="text-[10px] font-bold text-current mt-0.5 flex items-center gap-1"><AlertCircle size={10}/>{isOut ? 'หมด' : 'ใกล้หมด'}</p>}
                        </div>
                        <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
                          <p className="text-[10px] font-bold text-blue-400 uppercase mb-0.5">คลังห้องพัก</p>
                          <p className="text-xl font-black text-blue-700">
                            {roomStock} <span className="text-xs font-bold">{item.unit}</span>
                            {item.packUnit && item.unitsPerPack > 0 && roomStock > 0 && (
                              <span className="text-xs font-normal text-blue-400 ml-1">≈ {(roomStock / item.unitsPerPack).toFixed(1)} {item.packUnit}</span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="grid grid-cols-3 gap-1.5 mt-auto pt-1">
                        <button onClick={() => openTransferModal(item)} className="py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1">
                          <ArrowRight size={12}/> โอน
                        </button>
                        <button onClick={() => { setUsageTargetRoomId(null); setConsumableUsageMap({}); setIsUseConsumableModalOpen(true); }} className="py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1">
                          <Minus size={12}/> ใช้
                        </button>
                        <button onClick={() => openAdjustModal(item)} className="py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1">
                          <Edit size={12}/> ปรับ
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {stockSubTab === 'logs' && (
              <div className="space-y-4">
                {consumableLogs.length > 0 && (() => {
                  const purchaseLogs = consumableLogs.filter(l => l.logType === 'purchase');
                  const usageLogs = consumableLogs.filter(l => l.logType === 'use');
                  const thisMo = reportMonth;
                  const thisMonthPurchase = purchaseLogs.filter(l => l.date?.startsWith(thisMo)).reduce((s,l)=>s+(l.cost||0),0);
                  const thisMonthUsage = usageLogs.filter(l => l.date?.startsWith(thisMo)).reduce((s,l)=>s+(l.cost||0),0);
                  return (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
                        <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">ซื้อเดือนนี้</p>
                        <p className="text-2xl font-black text-emerald-700">{thisMonthPurchase.toLocaleString()} ฿</p>
                      </div>
                      <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 text-center">
                        <p className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-1">ต้นทุนใช้เดือนนี้</p>
                        <p className="text-2xl font-black text-orange-700">{thisMonthUsage.toLocaleString()} ฿</p>
                      </div>
                    </div>
                  );
                })()}
                <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-100 overflow-x-auto">
                  <table className="w-full text-sm text-left text-slate-600 min-w-[560px]">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold tracking-wider">
                      <tr>
                        <th className="px-4 py-4">วันที่</th>
                        <th className="px-4 py-4">รายการ</th>
                        <th className="px-4 py-4">ประเภท</th>
                        <th className="px-4 py-4 text-center">จำนวน</th>
                        <th className="px-4 py-4 text-right">มูลค่า</th>
                        <th className="px-4 py-4"/>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {[...consumableLogs].sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0)).slice(0,200).map(log => {
                        const typeMap = {
                          purchase:   {label:'ซื้อ',  cls:'bg-emerald-100 text-emerald-700', sign:'+'},
                          restock:    {label:'เติม',  cls:'bg-teal-100 text-teal-700',    sign:'+'},
                          use:        {label:'ใช้',   cls:'bg-orange-100 text-orange-700', sign:'-'},
                          transfer:   {label: log.direction==='toRoom'?'โอนห้อง':'คืนคลัง', cls:'bg-blue-100 text-blue-700', sign:'→'},
                          adjustment: {label:'ปรับปรุง', cls:'bg-amber-100 text-amber-700', sign: log.adjustDir === '-' ? '-' : '+'},
                        };
                        const t = typeMap[log.logType] || {label:log.logType, cls:'bg-slate-100 text-slate-600', sign:''};
                        return (
                          <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3 text-xs text-slate-500">{formatThaiDate(log.date,'short')}</td>
                            <td className="px-4 py-3 font-medium text-slate-800">{log.consumableName}{log.note ? <span className="block text-[10px] text-slate-400">{log.note}</span> : null}</td>
                            <td className="px-4 py-3"><span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${t.cls}`}>{t.label}</span></td>
                            <td className="px-4 py-3 text-center font-bold">{t.sign}{log.qty} {log.unit}</td>
                            <td className="px-4 py-3 text-right font-medium">{log.cost > 0 ? `${(log.cost||0).toLocaleString()} ฿` : '—'}</td>
                            <td className="px-4 py-3"><button onClick={() => openEditLog(log)} className="p-1.5 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"><Edit size={13}/></button></td>
                          </tr>
                        );
                      })}
                      {consumableLogs.length === 0 && (
                        <tr><td colSpan="6" className="px-5 py-16 text-center text-slate-400">ยังไม่มีประวัติ</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {currentView === 'report' && (
           <div className="space-y-6 animate-fade-in">
               <div className="bg-white p-5 md:p-8 rounded-[2rem] shadow-sm border border-slate-100">

                  {/* Header */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-3">
                      <div className="flex items-center gap-3 flex-wrap">
                          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3"><BarChart2 className="text-emerald-500"/> ผลประกอบการ</h2>
                          <input type="month" value={reportMonth} onChange={(e) => { setReportMonth(e.target.value); setSelectedReportWeek(0); setReportDayPopup(null); }} className="border border-slate-200 rounded-lg px-3 py-2 text-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50" />
                      </div>
                      <div className="flex gap-2">
                          <button onClick={() => exportToCSV(reportData.reportBookings, `Income_${reportMonth}`)} className="flex items-center gap-2 text-xs font-bold bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg hover:bg-emerald-100 transition-colors"><Download size={14}/> รายรับ CSV</button>
                          <button onClick={() => exportToCSV(reportData.reportExpenses, `Expense_${reportMonth}`)} className="flex items-center gap-2 text-xs font-bold bg-red-50 text-red-700 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors"><Download size={14}/> รายจ่าย CSV</button>
                      </div>
                  </div>

                  {/* 3 Stat Cards — always visible */}
                  <div className="grid grid-cols-3 gap-3 mb-6">
                      <div className="bg-emerald-50/50 p-3 md:p-5 rounded-2xl border border-emerald-100">
                          <p className="text-slate-500 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-1">รายได้</p>
                          <p className="text-lg md:text-2xl font-black text-emerald-600">฿{Math.round(reportData.monthlyRevenue).toLocaleString()}</p>
                          <div className="flex flex-col gap-0.5 mt-2 pt-2 border-t border-emerald-200/50">
                              <span className="text-[10px] md:text-xs font-bold text-emerald-700 flex items-center gap-1"><Banknote size={11}/> สด: {Math.round(reportData.monthlyCash).toLocaleString()}</span>
                              <span className="text-[10px] md:text-xs font-bold text-emerald-700 flex items-center gap-1"><QrCode size={11}/> โอน: {Math.round(reportData.monthlyTransfer).toLocaleString()}</span>
                          </div>
                      </div>
                      <div className="bg-red-50/50 p-3 md:p-5 rounded-2xl border border-red-100">
                          <p className="text-slate-500 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-1">รายจ่าย</p>
                          <p className="text-lg md:text-2xl font-black text-red-600">฿{reportData.monthlyExpense.toLocaleString()}</p>
                      </div>
                      <div className={`p-3 md:p-5 rounded-2xl border ${reportData.netProfit >= 0 ? 'bg-blue-50/50 border-blue-100' : 'bg-orange-50/50 border-orange-100'}`}>
                          <p className="text-slate-500 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-1">กำไร</p>
                          <p className={`text-lg md:text-2xl font-black ${reportData.netProfit >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>฿{Math.round(reportData.netProfit).toLocaleString()}</p>
                      </div>
                  </div>

                  {/* Tab Switcher */}
                  <div className="flex gap-2 mb-5 bg-slate-100 p-1 rounded-2xl w-fit">
                      <button
                          onClick={() => { setReportViewMode('weekly'); setReportDayPopup(null); }}
                          className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${reportViewMode === 'weekly' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >รายสัปดาห์</button>
                      <button
                          onClick={() => { setReportViewMode('monthly'); setReportDayPopup(null); }}
                          className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${reportViewMode === 'monthly' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >รายเดือน</button>
                      <button
                          onClick={() => { setReportViewMode('occupancy'); setReportDayPopup(null); }}
                          className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${reportViewMode === 'occupancy' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >อัตราเข้าพัก</button>
                  </div>

                  {/* ===== WEEKLY TAB ===== */}
                  {reportViewMode === 'weekly' && (
                      <div className="space-y-4 animate-fade-in">
                          {/* Week Picker */}
                          <div className="flex gap-2 overflow-x-auto pb-1">
                              {['สัปดาห์ 1','สัปดาห์ 2','สัปดาห์ 3','สัปดาห์ 4'].map((label, idx) => {
                                  const wkData = weeklyBreakdown[idx];
                                  const hasData = wkData && wkData.length > 0;
                                  return (
                                      <button key={idx} onClick={() => { setSelectedReportWeek(idx); setReportDayPopup(null); }}
                                          className={`flex-none px-4 py-2 rounded-xl text-sm font-bold transition-all border-2 ${!hasData ? 'opacity-30 cursor-not-allowed border-transparent bg-slate-100 text-slate-400' : selectedReportWeek === idx ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-transparent bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                          disabled={!hasData}
                                      >{label}</button>
                                  );
                              })}
                          </div>

                          {/* Stacked Bar Chart */}
                          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                              <div className="flex items-center gap-3 mb-3">
                                  <span className="text-xs text-slate-400">กดแท่งเพื่อดูรายละเอียด</span>
                                  <div className="flex gap-3 ml-auto">
                                      <span className="flex items-center gap-1 text-xs text-slate-500"><span className="w-2.5 h-2.5 rounded-sm bg-blue-200 inline-block"></span>สด</span>
                                      <span className="flex items-center gap-1 text-xs text-slate-500"><span className="w-2.5 h-2.5 rounded-sm bg-teal-300 inline-block"></span>โอน</span>
                                  </div>
                              </div>
                              <ResponsiveContainer width="100%" height={180}>
                                  <BarChart
                                      data={weeklyBreakdown[selectedReportWeek]}
                                      onClick={(data) => {
                                          if (data && data.activePayload && data.activePayload.length) {
                                              setReportDayPopup(data.activePayload[0].payload);
                                          }
                                      }}
                                      style={{cursor:'pointer'}}
                                  >
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                      <XAxis dataKey="date" tick={{fontSize:13, fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
                                      <YAxis hide/>
                                      <Tooltip content={<CustomDailyTooltip />} cursor={{fill:'rgba(16,185,129,0.06)'}}/>
                                      <Bar dataKey="cash" stackId="s" fill="#B5D4F4" name="สด" radius={[0,0,0,0]}/>
                                      <Bar dataKey="transfer" stackId="s" fill="#5DCAA5" name="โอน" radius={[4,4,0,0]}/>
                                  </BarChart>
                              </ResponsiveContainer>
                          </div>

                          {/* Day Detail Popup */}
                          {reportDayPopup && (
                              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 animate-fade-in">
                                  <div className="flex justify-between items-center mb-3">
                                      <span className="text-sm font-bold text-slate-700">วันที่ {formatThaiDate(`${reportMonth}-${reportDayPopup.date}`, 'full')}</span>
                                      <button onClick={() => setReportDayPopup(null)} className="p-1 rounded-full hover:bg-slate-200 text-slate-400 transition-colors"><X size={16}/></button>
                                  </div>
                                  <div className="grid grid-cols-3 gap-3 mb-3">
                                      <div className="bg-white rounded-xl p-3 text-center border border-slate-100">
                                          <div className="text-xs text-slate-400 mb-1">เงินสด</div>
                                          <div className="text-base font-bold text-blue-600">฿{Math.round(reportDayPopup.cash).toLocaleString()}</div>
                                      </div>
                                      <div className="bg-white rounded-xl p-3 text-center border border-slate-100">
                                          <div className="text-xs text-slate-400 mb-1">เงินโอน</div>
                                          <div className="text-base font-bold text-teal-600">฿{Math.round(reportDayPopup.transfer).toLocaleString()}</div>
                                      </div>
                                      <div className="bg-white rounded-xl p-3 text-center border border-slate-100">
                                          <div className="text-xs text-slate-400 mb-1">รวม</div>
                                          <div className="text-base font-bold text-slate-800">฿{Math.round(reportDayPopup.revenue).toLocaleString()}</div>
                                      </div>
                                  </div>
                                  <button
                                      onClick={() => { setReportSelectedDay(`${reportMonth}-${reportDayPopup.date}`); setIsReportDetailOpen(true); }}
                                      className="w-full py-2 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors"
                                  >ดูรายการห้องพักวันนี้ →</button>
                              </div>
                          )}

                          {/* Week Summary Cards */}
                          {(() => {
                              const wkData = weeklyBreakdown[selectedReportWeek] || [];
                              const wkTotal = wkData.reduce((s,d) => s + (d.revenue||0), 0);
                              const wkDays = wkData.length || 1;
                              const wkCash = wkData.reduce((s,d) => s + (d.cash||0), 0);
                              const wkTransfer = wkData.reduce((s,d) => s + (d.transfer||0), 0);
                              return (
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                      <div className="bg-slate-50 rounded-2xl p-4">
                                          <div className="text-xs text-slate-400 mb-1">รวมสัปดาห์ {selectedReportWeek+1}</div>
                                          <div className="text-xl font-black text-slate-800">฿{Math.round(wkTotal).toLocaleString()}</div>
                                      </div>
                                      <div className="bg-slate-50 rounded-2xl p-4">
                                          <div className="text-xs text-slate-400 mb-1">เฉลี่ย/วัน</div>
                                          <div className="text-xl font-black text-slate-800">฿{Math.round(wkTotal/wkDays).toLocaleString()}</div>
                                      </div>
                                      <div className="bg-blue-50 rounded-2xl p-4">
                                          <div className="text-xs text-blue-400 mb-1">เงินสด</div>
                                          <div className="text-xl font-black text-blue-700">฿{Math.round(wkCash).toLocaleString()}</div>
                                      </div>
                                      <div className="bg-teal-50 rounded-2xl p-4">
                                          <div className="text-xs text-teal-400 mb-1">เงินโอน</div>
                                          <div className="text-xl font-black text-teal-700">฿{Math.round(wkTransfer).toLocaleString()}</div>
                                      </div>
                                  </div>
                              );
                          })()}
                      </div>
                  )}

                  {/* ===== MONTHLY TAB ===== */}
                  {reportViewMode === 'monthly' && (
                      <div className="space-y-6 animate-fade-in">

                          {/* Income vs Expense 6-month */}
                          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                              <div className="flex items-center justify-between mb-3">
                                  <h3 className="text-sm font-bold text-slate-600">รายได้ vs รายจ่าย (6 เดือน)</h3>
                                  <div className="flex gap-3">
                                      <span className="flex items-center gap-1 text-xs text-slate-500"><span className="w-2.5 h-2.5 rounded-sm bg-blue-200 inline-block"></span>รายได้</span>
                                      <span className="flex items-center gap-1 text-xs text-slate-500"><span className="w-2.5 h-2.5 rounded-sm bg-red-200 inline-block"></span>รายจ่าย</span>
                                  </div>
                              </div>
                              <ResponsiveContainer width="100%" height={200}>
                                  <BarChart data={monthHistorySummary} barGap={4}>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                      <XAxis dataKey="shortLabel" tick={{fontSize:11, fill:'#94a3b8'}} axisLine={false} tickLine={false} interval={0}/>
                                      <YAxis hide/>
                                      <Tooltip formatter={(v) => `฿${Math.round(v).toLocaleString()}`} contentStyle={{borderRadius:'12px',border:'none',boxShadow:'0 10px 15px -3px rgb(0 0 0/0.1)'}}/>
                                      <Bar dataKey="income" fill="#B5D4F4" radius={[4,4,0,0]} name="รายได้"/>
                                      <Bar dataKey="expense" fill="#F7C1C1" radius={[4,4,0,0]} name="รายจ่าย"/>
                                  </BarChart>
                              </ResponsiveContainer>
                          </div>

                          {/* YoY Comparison */}
                          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                              <div className="flex items-center justify-between mb-3">
                                  <h3 className="text-sm font-bold text-slate-600">เทียบปีก่อน (รายได้)</h3>
                                  <div className="flex gap-3">
                                      <span className="flex items-center gap-1 text-xs text-slate-500"><span className="w-2.5 h-2.5 rounded-sm bg-teal-300 inline-block"></span>ปีนี้</span>
                                      <span className="flex items-center gap-1 text-xs text-slate-500"><span className="w-2.5 h-2.5 rounded-sm bg-slate-300 inline-block"></span>ปีก่อน</span>
                                  </div>
                              </div>
                              <ResponsiveContainer width="100%" height={200}>
                                  <BarChart data={monthHistorySummary} barGap={4}>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                      <XAxis dataKey="shortLabel" tick={{fontSize:11, fill:'#94a3b8'}} axisLine={false} tickLine={false} interval={0}/>
                                      <YAxis hide/>
                                      <Tooltip formatter={(v) => `฿${Math.round(v).toLocaleString()}`} contentStyle={{borderRadius:'12px',border:'none',boxShadow:'0 10px 15px -3px rgb(0 0 0/0.1)'}}/>
                                      <Bar dataKey="income" fill="#5DCAA5" radius={[4,4,0,0]} name="ปีนี้"/>
                                      <Bar dataKey="prevIncome" fill="#D3D1C7" radius={[4,4,0,0]} name="ปีก่อน"/>
                                  </BarChart>
                              </ResponsiveContainer>
                          </div>

                          {/* 6-Month Summary Table */}
                          <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                              <div className="px-4 py-3 border-b border-slate-100">
                                  <h3 className="text-sm font-bold text-slate-600">สรุป 6 เดือนล่าสุด</h3>
                              </div>
                              <div className="overflow-x-auto">
                                  <table className="w-full text-sm" style={{tableLayout:'fixed'}}>
                                      <thead>
                                          <tr className="bg-slate-50">
                                              <th className="text-left px-4 py-2.5 text-xs text-slate-400 font-bold w-24">เดือน</th>
                                              <th className="text-right px-4 py-2.5 text-xs text-slate-400 font-bold">รายได้</th>
                                              <th className="text-right px-4 py-2.5 text-xs text-slate-400 font-bold">รายจ่าย</th>
                                              <th className="text-right px-4 py-2.5 text-xs text-slate-400 font-bold w-20">กำไร%</th>
                                          </tr>
                                      </thead>
                                      <tbody>
                                          {monthHistorySummary.map((row, idx) => {
                                              const profitPct = row.income > 0 ? Math.round((row.profit / row.income) * 100) : 0;
                                              const isCurrent = row.monthKey === reportMonth;
                                              return (
                                                  <tr key={idx} className={`border-t border-slate-50 ${isCurrent ? 'bg-emerald-50/60' : 'hover:bg-slate-50/50'}`}>
                                                      <td className="px-4 py-3 font-bold text-slate-700">
                                                          <div className="flex items-center gap-1.5 flex-wrap">
                                                              {row.label}
                                                              {isCurrent && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">ปัจจุบัน</span>}
                                                          </div>
                                                      </td>
                                                      <td className="px-4 py-3 text-right font-bold text-blue-600">฿{row.income.toLocaleString()}</td>
                                                      <td className="px-4 py-3 text-right text-red-500">฿{row.expense.toLocaleString()}</td>
                                                      <td className="px-4 py-3 text-right">
                                                          <span className={`text-xs font-bold px-2 py-1 rounded-lg ${row.profit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                                                              {row.profit >= 0 ? '+' : ''}{profitPct}%
                                                          </span>
                                                      </td>
                                                  </tr>
                                              );
                                          })}
                                      </tbody>
                                  </table>
                              </div>
                          </div>

                          {/* Expense Pie */}
                          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm h-72">
                              <h3 className="text-sm font-bold text-slate-500 mb-3 text-center">สัดส่วนค่าใช้จ่าย</h3>
                              <ResponsiveContainer width="100%" height="90%">
                                  <PieChart>
                                      <Pie data={reportData.expensePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={5} label={({percent}) => `${(percent * 100).toFixed(0)}%`}>
                                          {reportData.expensePieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none"/>)}
                                      </Pie>
                                      <Tooltip formatter={(v) => `฿${v.toLocaleString()}`} contentStyle={{borderRadius:'12px',border:'none',boxShadow:'0 10px 15px -3px rgb(0 0 0/0.1)'}}/>
                                      <Legend wrapperStyle={{fontSize:'11px',color:'#64748b'}} iconType="circle"/>
                                  </PieChart>
                              </ResponsiveContainer>
                          </div>

                          {/* Room Revenue Bar */}
                          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm" style={{height: Math.max(reportData.roomPieData.length * 44 + 80, 220)}}>
                              <h3 className="text-sm font-bold text-slate-500 mb-3 text-center">ยอดขายตามห้องพัก</h3>
                              <ResponsiveContainer width="100%" height="88%">
                                  <BarChart data={reportData.roomPieData} layout="vertical" margin={{top:5, right:30, left:40, bottom:5}}>
                                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9"/>
                                      <XAxis type="number" hide/>
                                      <YAxis dataKey="name" type="category" width={75} tick={{fontSize:12, fill:'#64748b', fontWeight:'bold'}} axisLine={false} tickLine={false}/>
                                      <Tooltip content={<CustomRevenueTooltip />}/>
                                      <Bar dataKey="value" radius={[0,4,4,0]} barSize={22}>
                                          {reportData.roomPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]}/>)}
                                      </Bar>
                                  </BarChart>
                              </ResponsiveContainer>
                          </div>
                      </div>
                  )}

                  {reportViewMode === 'occupancy' && (
                      <div className="space-y-3 animate-fade-in">
                          <p className="text-xs text-slate-400 mb-4">อัตราการเข้าพักแต่ละห้อง เดือน {formatThaiDate(`${reportMonth}-01`, 'monthYear')} ({occupancyData[0]?.daysInMonth || 30} วัน)</p>
                          {occupancyData.map(room => (
                              <div key={room.roomId} className="flex items-center gap-3">
                                  <div className="w-20 text-xs font-bold text-slate-600 text-right shrink-0">{room.roomName}</div>
                                  <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                                      <div
                                          className="h-full rounded-full flex items-center justify-end pr-2 transition-all"
                                          style={{
                                              width: `${room.rate}%`,
                                              minWidth: room.rate > 0 ? '28px' : '0',
                                              background: room.rate >= 70 ? '#1D9E75' : room.rate >= 40 ? '#EF9F27' : '#E24B4A'
                                          }}
                                      >
                                          {room.rate > 8 && <span className="text-[10px] font-bold text-white">{room.rate}%</span>}
                                      </div>
                                  </div>
                                  <div className="w-20 text-xs text-slate-400 shrink-0">{room.occupiedNights}/{room.daysInMonth} คืน</div>
                              </div>
                          ))}
                          <div className="mt-5 pt-4 border-t border-slate-100 flex gap-4 text-xs">
                              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{background:'#1D9E75'}}></span> 70%+ ดีมาก</span>
                              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{background:'#EF9F27'}}></span> 40–69% ปานกลาง</span>
                              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{background:'#E24B4A'}}></span> &lt;40% ต้องปรับปรุง</span>
                          </div>
                      </div>
                  )}


               </div>
           </div>
        )}
      </div>

      {/* --- Modals --- */}

      {/* Temp Guest Modal */}
      <Modal isOpen={isTempModalOpen} onClose={() => setIsTempModalOpen(false)} title={`ลูกค้าชั่วคราว — ${tempRoom?.name || ''}`}>
          <div className="space-y-5">
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-center justify-between">
                  <div>
                      <p className="text-xs text-amber-600 mb-1 font-bold">เวลาเข้าตอนนี้</p>
                      <p className="text-3xl font-black text-amber-700">{getNowTimeStr()} น.</p>
                  </div>
                  <div className="text-right">
                      <p className="text-xs text-amber-600 mb-1 font-bold">ออกโดยประมาณ</p>
                      <p className="text-2xl font-black text-amber-500">
                          {(() => { const out = new Date(Date.now() + (tempForm.durationHours||3)*3600000); return out.toTimeString().slice(0,5); })()} น.
                      </p>
                  </div>
              </div>

              <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">ระยะเวลา</label>
                  <div className="grid grid-cols-5 gap-2">
                      {TEMP_DURATIONS.map(h => (
                          <button key={h} onClick={() => setTempForm({...tempForm, durationHours: h})}
                              className={`py-3 rounded-xl font-bold text-sm border-2 transition-all ${tempForm.durationHours === h ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-100 bg-white text-slate-500 hover:bg-slate-50'}`}>
                              {h} ชม.
                          </button>
                      ))}
                  </div>
              </div>

              <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">ราคา (บาท)</label>
                  <input type="number" className="w-full p-3 bg-slate-50 border-0 rounded-xl text-2xl font-black text-center text-amber-700 focus:ring-2 focus:ring-amber-400 outline-none" value={tempForm.price} onChange={e => setTempForm({...tempForm, price: Number(e.target.value)})}/>
              </div>

              <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">ชื่อลูกค้า (ไม่บังคับ)</label>
                  <input type="text" placeholder="ลูกค้าชั่วคราว" className="w-full p-3 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none" value={tempForm.guestName} onChange={e => setTempForm({...tempForm, guestName: e.target.value})}/>
              </div>

              <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setTempForm({...tempForm, paymentMethod: 'เงินสด'})} className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${tempForm.paymentMethod === 'เงินสด' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 text-slate-400'}`}>
                      <Banknote size={20}/><span className="font-bold text-xs">เงินสด</span>
                  </button>
                  <button onClick={() => setTempForm({...tempForm, paymentMethod: 'เงินโอน'})} className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${tempForm.paymentMethod === 'เงินโอน' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-100 text-slate-400'}`}>
                      <QrCode size={20}/><span className="font-bold text-xs">โอนเงิน</span>
                  </button>
              </div>

              <div className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer select-none hover:bg-slate-50" onClick={() => setTempForm({...tempForm, keyDepositCollected: !tempForm.keyDepositCollected})}>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${tempForm.keyDepositCollected ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300'}`}>
                      {tempForm.keyDepositCollected && <CheckSquare size={14} className="text-white"/>}
                  </div>
                  <span className="font-bold text-sm text-slate-700">เก็บมัดจำกุญแจ (100 บาท)</span>
              </div>

              <button onClick={handleTempCheckIn} className="w-full py-4 bg-amber-500 text-white rounded-2xl font-bold text-lg shadow-lg shadow-amber-200 hover:bg-amber-600 active:scale-95 transition-all flex items-center justify-center gap-2">
                  <Clock size={20}/> ยืนยันเช็คอินชั่วคราว
              </button>
          </div>
      </Modal>

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
                          <div className="flex justify-between"><span>เช็คอิน:</span><span className="font-medium">{formatThaiDate(selectedBookedRoom.booking.checkInDate, 'full')}</span></div>
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
                        <div className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer select-none hover:bg-slate-50" onClick={() => setStaffCheckInForm({...staffCheckInForm, keyDepositCollected: !staffCheckInForm.keyDepositCollected})}>
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${staffCheckInForm.keyDepositCollected ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300'}`}>
                                {staffCheckInForm.keyDepositCollected && <CheckSquare size={14} className="text-white"/>}
                            </div>
                            <span className="font-bold text-sm text-slate-700">เก็บมัดจำกุญแจแล้ว (100 บาท)</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer select-none hover:bg-slate-50" onClick={() => setStaffCheckInForm({...staffCheckInForm, isReceiptNeeded: !staffCheckInForm.isReceiptNeeded})}>
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
                        <button onClick={() => setStaffCheckInForm({...staffCheckInForm, paymentMethod: 'เงินสด'})} className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${staffCheckInForm.paymentMethod === 'เงินสด' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-400'}`}>
                            <Banknote size={20}/><span className="font-bold text-xs">เงินสด</span>
                        </button>
                        <button onClick={() => setStaffCheckInForm({...staffCheckInForm, paymentMethod: 'เงินโอน'})} className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${staffCheckInForm.paymentMethod === 'เงินโอน' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-400'}`}>
                            <QrCode size={20}/><span className="font-bold text-xs">โอนเงิน</span>
                        </button>
                  </div>
                  <button onClick={() => confirmStaffCheckIn(true)} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all">
                      ยืนยันเข้าพัก
                  </button>
              </div>
          )}
      </Modal>

      <Modal isOpen={isStaffCheckInModalOpen} onClose={() => setIsStaffCheckInModalOpen(false)} title="ยืนยันการรับเงิน (Walk-in)">
          <div className="space-y-6">
              <div>
                  <label className="block text-slate-500 font-bold mb-1.5 text-xs">ชื่อลูกค้า (ไม่บังคับ)</label>
                  <input
                      type="text"
                      placeholder="ชื่อ หรือเว้นว่างเพื่อใช้ walk-in"
                      className="w-full p-3 bg-slate-50 border-0 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      value={staffCheckInForm.guestName}
                      onChange={e => setStaffCheckInForm({...staffCheckInForm, guestName: e.target.value})}
                  />
              </div>
              <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100 relative">
                  <div className="flex justify-between items-center mb-4 pb-4 border-b border-emerald-200/50">
                      <span className="font-bold text-emerald-800 flex items-center gap-2"><Moon size={18}/> จำนวนคืน</span>
                      <div className="flex items-center gap-3">
                          <button onClick={() => handleStaffNightsChange(staffCheckInForm.nights - 1)} className="w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-sm text-emerald-600 hover:bg-emerald-100 font-bold">-</button>
                          <span className="font-black text-2xl text-emerald-700 w-8 text-center">{staffCheckInForm.nights}</span>
                          <button onClick={() => handleStaffNightsChange(staffCheckInForm.nights + 1)} className="w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-sm text-emerald-600 hover:bg-emerald-100 font-bold">+</button>
                      </div>
                  </div>
                  <div className="text-center">
                      <p className="text-slate-500 text-sm font-medium mb-1">ยอดชำระรวม ({selectedStaffRooms.length} ห้อง x {staffCheckInForm.nights} คืน)</p>
                      <input type="number" className="text-4xl font-black text-emerald-600 bg-transparent text-center w-full outline-none focus:ring-0" value={staffCheckInForm.totalPrice} onChange={(e) => setStaffCheckInForm({...staffCheckInForm, totalPrice: Number(e.target.value)})}/>
                      <p className="text-slate-400 text-xs">บาท</p>
                  </div>
              </div>
              <div>
                  <label className="block text-slate-600 font-bold mb-3 text-sm">ช่องทางการชำระเงิน</label>
                  <div className="grid grid-cols-2 gap-4">
                      <button onClick={() => setStaffCheckInForm({...staffCheckInForm, paymentMethod: 'เงินสด'})} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${staffCheckInForm.paymentMethod === 'เงินสด' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 text-slate-400'}`}>
                          <Banknote size={28}/><span className="font-bold">เงินสด</span>
                      </button>
                      <button onClick={() => setStaffCheckInForm({...staffCheckInForm, paymentMethod: 'เงินโอน'})} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${staffCheckInForm.paymentMethod === 'เงินโอน' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-100 text-slate-400'}`}>
                          <QrCode size={28}/><span className="font-bold">โอนเงิน</span>
                      </button>
                  </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl cursor-pointer select-none transition-colors hover:bg-slate-100" onClick={() => setStaffCheckInForm({...staffCheckInForm, keyDepositCollected: !staffCheckInForm.keyDepositCollected})}>
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${staffCheckInForm.keyDepositCollected ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300'}`}>
                        {staffCheckInForm.keyDepositCollected && <CheckSquare size={16} className="text-white"/>}
                    </div>
                    <span className="font-bold text-slate-700 flex items-center gap-2 text-sm"><Key size={18}/> เก็บมัดจำกุญแจครบถ้วน (100 บาท/ห้อง)</span>
                </div>
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl cursor-pointer select-none transition-colors hover:bg-slate-100" onClick={() => setStaffCheckInForm({...staffCheckInForm, isReceiptNeeded: !staffCheckInForm.isReceiptNeeded})}>
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
              <button onClick={() => confirmStaffCheckIn(false)} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all">
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
            <textarea className="w-full h-48 p-4 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono text-slate-800 focus:ring-2 focus:ring-[#06C755] outline-none" value={messagePreviewText} onChange={(e) => setMessagePreviewText(e.target.value)}/>
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
              <>
                  <div className="flex gap-4 mb-4">
                      <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl flex-1 text-center border border-emerald-100">
                          <p className="text-xs font-bold flex items-center justify-center gap-1"><Banknote size={14}/> เงินสด</p>
                          <p className="text-lg font-black">{dailyDetails.filter(d => d.paymentMethod === 'เงินสด').reduce((sum, d) => sum + d.amount, 0).toLocaleString(undefined, {maximumFractionDigits:0})} ฿</p>
                      </div>
                      <div className="bg-blue-50 text-blue-700 p-3 rounded-xl flex-1 text-center border border-blue-100">
                          <p className="text-xs font-bold flex items-center justify-center gap-1"><QrCode size={14}/> เงินโอน</p>
                          <p className="text-lg font-black">{dailyDetails.filter(d => d.paymentMethod === 'เงินโอน').reduce((sum, d) => sum + d.amount, 0).toLocaleString(undefined, {maximumFractionDigits:0})} ฿</p>
                      </div>
                  </div>
                  <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-600 font-bold">
                          <tr>
                              <th className="p-3 rounded-l-lg">ห้อง</th>
                              <th className="p-3">ลูกค้า</th>
                              <th className="p-3 text-center">ชำระ</th>
                              <th className="p-3 text-right rounded-r-lg">รายได้เฉลี่ย/คืน</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {dailyDetails.map((d, idx) => (
                              <tr key={idx}>
                                  <td className="p-3 font-bold text-slate-700">{d.room}</td>
                                  <td className="p-3 text-slate-600">{d.guest}</td>
                                  <td className="p-3 text-center">
                                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${d.paymentMethod === 'เงินโอน' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                          {d.paymentMethod}
                                      </span>
                                  </td>
                                  <td className="p-3 text-right font-bold text-emerald-600">{d.amount.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                              </tr>
                          ))}
                          <tr className="bg-slate-50 font-bold">
                              <td colSpan="3" className="p-3 text-right text-slate-500">รวมทั้งสิ้น</td>
                              <td className="p-3 text-right text-emerald-700 text-lg">{dailyDetails.reduce((s, c) => s + c.amount, 0).toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                          </tr>
                      </tbody>
                  </table>
              </>
          ) : <p className="text-center text-slate-400 py-8">ไม่มีรายได้ในวันนี้</p>}
      </Modal>

      <Modal isOpen={isRoomSettingsOpen} onClose={() => setIsRoomSettingsOpen(false)} title="ตั้งค่าระบบ">
         <div className="space-y-6">
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

      <Modal isOpen={isBookingModalOpen} onClose={() => setIsBookingModalOpen(false)} title={formData.id ? `แก้ไขข้อมูล (${formData.docNo})` : `จองห้องพักใหม่`}>
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
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <div><label className="block text-xs font-bold text-slate-400 mb-1">ทะเบียนรถ</label><input type="text" placeholder="เช่น กก 1234" className="w-full p-2.5 bg-slate-50 border-0 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-emerald-400" value={formData.licensePlate} onChange={e => setFormData({...formData, licensePlate: e.target.value})} /></div>
                                <div><label className="block text-xs font-bold text-slate-400 mb-1">เลขบัตร ปชช.</label><input type="text" placeholder="13 หลัก" className="w-full p-2.5 bg-slate-50 border-0 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-emerald-400" value={formData.idCard} onChange={e => setFormData({...formData, idCard: e.target.value})} /></div>
                            </div>
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
                        {currentBookingStatus !== 'checked-out' && (
                            <button onClick={goToCheckIn} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 flex justify-center items-center gap-2 shadow-lg shadow-emerald-200 transition-all transform active:scale-95"><LogIn size={18}/> เช็คอิน / รับชำระ</button>
                        )}
                    </>
                )}
                <button onClick={handleBookingSave} className={`py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 flex justify-center items-center gap-2 shadow-lg shadow-slate-300 transition-all transform active:scale-95 ${formData.id ? 'px-8' : 'w-full'}`}><Save size={18}/> {formData.id ? 'บันทึกการแก้ไข' : 'ยืนยันการจอง'}</button>
            </div>
        </div>
      </Modal>

      <Modal isOpen={isCheckInModalOpen} onClose={() => setIsCheckInModalOpen(false)} title={`จัดการห้องพัก (${formData.docNo})`} maxWidth="max-w-4xl"
        footer={(currentBookingStatus === 'occupied') ? (
          <button onClick={handleCheckout} className="w-full py-3.5 bg-orange-500 text-white rounded-2xl font-bold shadow-lg shadow-orange-200 hover:bg-orange-600 flex items-center justify-center gap-2 transition-all active:scale-95">
            <LogOut size={20}/> เช็คเอาท์ / คืนห้อง
          </button>
        ) : null}
      >
         <div className="space-y-6 font-sans">
            <div className="flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-1/2 space-y-4">
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2 text-sm uppercase tracking-wide"><FileText className="text-blue-500" size={16}/> รายละเอียดห้องพัก</h3>
                            <button onClick={() => { setIsCheckInModalOpen(false); setIsBookingModalOpen(true); }} className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded hover:bg-slate-200 font-bold flex items-center gap-1"><Edit size={10}/> แก้ไขข้อมูลลูกค้า</button>
                        </div>
                        <div className="space-y-3 text-sm text-slate-600">
                            <div className="flex justify-between p-2 bg-slate-50 rounded-lg"><span>ห้องหลัก:</span><span className="font-black text-slate-800 text-lg">{selectedRoom?.name}</span></div>
                            <div className="flex justify-between items-center px-2"><span>ลูกค้า:</span><span className="font-bold text-slate-800">{formData.guestName}</span></div>
                            {(formData.licensePlate || formData.idCard || formData.lineId) && (
                                <div className="flex flex-wrap gap-2 px-2 text-xs text-slate-500">
                                    {formData.lineId && <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded flex items-center gap-1 font-bold"><MessageCircle size={10}/> {formData.lineId}</span>}
                                    {formData.licensePlate && <span className="bg-slate-100 px-2 py-1 rounded flex items-center gap-1"><Car size={10}/> {formData.licensePlate}</span>}
                                    {formData.idCard && <span className="bg-slate-100 px-2 py-1 rounded flex items-center gap-1"><CreditCard size={10}/> {formData.idCard}</span>}
                                </div>
                            )}
                            <div className="flex justify-between items-center px-2"><span>เข้าพัก:</span><span className="font-medium">{formatThaiDate(formData.checkInDate, 'full')} ({formData.nights} คืน)</span></div>
                            <div className="grid grid-cols-2 gap-2 px-2">
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs text-slate-400">เวลาเข้าพัก</span>
                                    <input type="time" value={formData.checkInTimeStr} onChange={e => setFormData({...formData, checkInTimeStr: e.target.value})} className="bg-blue-50 border border-blue-200 rounded-lg px-2 py-1 text-sm font-bold text-blue-700 focus:ring-2 focus:ring-blue-400 outline-none"/>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs text-slate-400">เวลาออก (จริง)</span>
                                    <input type="time" value={formData.checkOutTimeStr} onChange={e => setFormData({...formData, checkOutTimeStr: e.target.value})} className="bg-orange-50 border border-orange-200 rounded-lg px-2 py-1 text-sm font-bold text-orange-700 focus:ring-2 focus:ring-orange-400 outline-none"/>
                                </div>
                            </div>
                            <div className="flex justify-between pt-2 border-t px-2"><span>สถานะ:</span><span className={`font-bold px-3 py-0.5 rounded-full text-xs ${bookings.find(b=>b.id===formData.id)?.status === 'occupied' ? 'bg-blue-100 text-blue-600' : (bookings.find(b=>b.id===formData.id)?.status === 'checked-out' ? 'bg-slate-100 text-slate-600' : 'bg-yellow-100 text-yellow-600')}`}>{bookings.find(b=>b.id===formData.id)?.status === 'occupied' ? 'เข้าพักแล้ว' : (bookings.find(b=>b.id===formData.id)?.status === 'checked-out' ? 'คืนห้องแล้ว' : 'จองแล้ว')}</span></div>
                        </div>
                    </div>
                    {formData.billPhotoUrl && (
                        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                            <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide"><ImageIcon className="text-emerald-500" size={16}/> หลักฐานการโอน / บิล</h3>
                            <div className="rounded-xl overflow-hidden border border-slate-200">
                                <img src={formData.billPhotoUrl} alt="Bill Evidence" className="w-full h-auto object-cover max-h-64" />
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
                                    const isCheckedOut = b.status === 'checked-out';
                                    return (
                                        <div key={bid} className="flex justify-between items-center bg-white p-3 rounded-xl border border-blue-100 text-sm shadow-sm">
                                            <div>
                                                <span className="font-bold text-slate-700">{b.roomName}</span>
                                                {b.checkInTimeStr && <p className="text-[10px] text-slate-400 mt-0.5">เช็คอิน {b.checkInTimeStr}</p>}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isOccupied ? 'bg-blue-100 text-blue-600' : (isCheckedOut ? 'bg-slate-100 text-slate-600' : 'bg-yellow-100 text-yellow-600')}`}>{isOccupied ? 'กำลังพัก' : (isCheckedOut ? 'คืนห้องแล้ว' : 'รอเช็คอิน')}</span>
                                                {!isOccupied && !isCheckedOut && (<button onClick={() => handleCheckInSingle(b.id, b.roomName)} className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded border border-emerald-200 hover:bg-emerald-200 font-bold flex items-center gap-1"><LogIn size={10}/> เช็คอิน</button>)}
                                                {isOccupied && (<button onClick={() => handleCheckoutSingle(b.id, b.keyDeposit)} className="text-[10px] bg-orange-100 text-orange-600 px-2 py-1 rounded border border-orange-200 hover:bg-orange-200 font-bold flex items-center gap-1"><LogOut size={10}/> คืนห้อง</button>)}
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
                            <div className="flex justify-between items-center mb-3"><label className="text-sm font-bold text-emerald-800">{currentBookingStatus === 'checked-out' ? 'ปรับปรุงยอดเงิน' : 'รับเงินเพิ่มครั้งนี้'}</label><div className="flex gap-1"><button onClick={() => setFormData({...formData, currentPayment: fin.remainingToCollect})} className="text-[10px] bg-white border border-emerald-200 text-emerald-600 px-2 py-1 rounded hover:bg-emerald-50 font-bold">จ่ายเต็ม</button><button onClick={() => setFormData({...formData, currentPayment: 0})} className="text-[10px] bg-white border border-slate-200 text-slate-600 px-2 py-1 rounded hover:bg-slate-50">0</button></div></div>
                            <div className="flex gap-2 mb-3">
                                <button onClick={() => setFormData({...formData, paymentMethod: 'เงินสด'})} className={`flex-1 py-2.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${formData.paymentMethod === 'เงินสด' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-slate-200 text-slate-500 bg-white hover:bg-slate-50'}`}><Banknote size={16}/> เงินสด</button>
                                <button onClick={() => setFormData({...formData, paymentMethod: 'เงินโอน'})} className={`flex-1 py-2.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${formData.paymentMethod === 'เงินโอน' ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-200 text-slate-500 bg-white hover:bg-slate-50'}`}><QrCode size={16}/> เงินโอน</button>
                            </div>
                            <div className="flex flex-col gap-3">
                                <input type="number" className="w-full p-3 rounded-xl border border-emerald-200 text-right font-bold text-xl text-emerald-700 focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm mb-2 bg-white" value={formData.currentPayment} onChange={e => setFormData({...formData, currentPayment: e.target.value})} placeholder="0" />
                                <button onClick={handleCheckInSave} className="w-full bg-emerald-600 text-white px-5 py-3 rounded-xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex justify-center items-center gap-2 active:scale-95"><Coins size={20}/> {currentBookingStatus === 'checked-out' ? 'บันทึกการแก้ไข' : 'บันทึกรับเงิน'}</button>
                            </div>
                            {remainingAfterCurrentPay > 0 && <p className="text-xs text-orange-500 text-right mt-2 font-bold">* จะเหลือค้างอีก {remainingAfterCurrentPay.toLocaleString()} บาท</p>}
                        </div>
                    </div>
                </div>
            </div>
         </div>
      </Modal>

      {/* ─── Consumable Item Modal (Add / Edit) ───────────────────────────────── */}
      <Modal isOpen={isConsumableItemModalOpen} onClose={() => setIsConsumableItemModalOpen(false)} title={consumableItemFormMode === 'create' ? 'เพิ่มรายการของใช้' : 'แก้ไขรายการ'}>
        <form onSubmit={handleSaveConsumableItem} className="space-y-4 text-sm font-sans">
          <div>
            <label className="block text-slate-500 font-bold mb-1.5 text-xs">ชื่อรายการ</label>
            <input required type="text" placeholder="เช่น สบู่ก้อน, กระดาษทิชชู่" className="w-full p-3 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" value={consumableItemForm.name} onChange={e => setConsumableItemForm({...consumableItemForm, name: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-500 font-bold mb-1.5 text-xs">หน่วยนับหลัก</label>
              <input required type="text" placeholder="ก้อน / หลอด / ชิ้น" className="w-full p-3 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" value={consumableItemForm.unit} onChange={e => setConsumableItemForm({...consumableItemForm, unit: e.target.value})} />
            </div>
            <div>
              <label className="block text-slate-500 font-bold mb-1.5 text-xs">หมวดหมู่</label>
              <select className="w-full p-3 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" value={consumableItemForm.category} onChange={e => setConsumableItemForm({...consumableItemForm, category: e.target.value})}>
                <option value="">— ไม่ระบุ —</option>
                {consumableCategories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
              </select>
            </div>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl space-y-3 border border-slate-100">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">หน่วยแพ็ค (ไม่บังคับ)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-500 font-bold mb-1.5 text-xs">ชื่อหน่วยแพ็ค</label>
                <input type="text" placeholder="โหล / แพ็ค / ลัง" className="w-full p-2.5 bg-white border-0 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm" value={consumableItemForm.packUnit} onChange={e => setConsumableItemForm({...consumableItemForm, packUnit: e.target.value})} />
              </div>
              <div>
                <label className="block text-slate-500 font-bold mb-1.5 text-xs">จำนวนต่อแพ็ค</label>
                <input type="number" min="0" placeholder="12" className="w-full p-2.5 bg-white border-0 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm" value={consumableItemForm.unitsPerPack || ''} onChange={e => setConsumableItemForm({...consumableItemForm, unitsPerPack: e.target.value})} />
              </div>
            </div>
            {consumableItemForm.packUnit && consumableItemForm.unitsPerPack > 0 && (
              <p className="text-xs text-emerald-600 font-bold">
                1 {consumableItemForm.packUnit} = {consumableItemForm.unitsPerPack} {consumableItemForm.unit || 'หน่วย'} · ราคา {(consumableItemForm.costPerUnit * consumableItemForm.unitsPerPack).toLocaleString()} ฿
              </p>
            )}
          </div>
          <div>
            <label className="block text-slate-500 font-bold mb-1.5 text-xs">แจ้งเตือนเมื่อเหลือน้อยกว่า</label>
            <div className="flex items-center gap-2">
              <input type="number" min="0" className="w-28 p-3 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none font-bold" value={consumableItemForm.minStock} onChange={e => setConsumableItemForm({...consumableItemForm, minStock: e.target.value})} />
              <span className="text-sm text-slate-400 font-medium">{consumableItemForm.unit || 'หน่วย'}</span>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            {consumableItemFormMode === 'edit' && (
              <button type="button" onClick={handleDeleteConsumableItem} className="px-4 bg-red-50 text-red-500 rounded-xl font-bold hover:bg-red-100 transition-colors">ลบ</button>
            )}
            <button type="submit" className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all active:scale-95">
              {consumableItemFormMode === 'create' ? 'เพิ่มรายการ' : 'บันทึกการแก้ไข'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── Restock Modal ──────────────────────────────────────────────────────── */}
      <Modal isOpen={isRestockModalOpen} onClose={() => setIsRestockModalOpen(false)} title={`เติมสต๊อก — ${restockTarget?.name || ''}`}>
        {restockTarget && (
          <div className="space-y-5">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex justify-between items-center">
              <span className="text-sm font-bold text-emerald-700">คงเหลือปัจจุบัน</span>
              <span className="text-2xl font-black text-emerald-700">{restockTarget.stockQty || 0} {restockTarget.unit}</span>
            </div>
            {restockTarget.packUnit && restockTarget.unitsPerPack > 0 && (
              <div className="flex gap-2">
                <button onClick={() => setRestockIsPackUnit(false)} className={`flex-1 py-2.5 rounded-xl font-bold text-sm border-2 transition-all ${!restockIsPackUnit ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-400'}`}>
                  นับ{restockTarget.unit}
                </button>
                <button onClick={() => setRestockIsPackUnit(true)} className={`flex-1 py-2.5 rounded-xl font-bold text-sm border-2 transition-all ${restockIsPackUnit ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-400'}`}>
                  นับ{restockTarget.packUnit}
                </button>
              </div>
            )}
            <div>
              <label className="block text-slate-500 font-bold mb-2 text-xs">
                จำนวนที่เติม ({restockIsPackUnit ? restockTarget.packUnit : restockTarget.unit})
              </label>
              <input
                type="number" min="1" autoFocus
                className="w-full p-4 text-center text-3xl font-black bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                value={restockQty} onChange={e => setRestockQty(e.target.value)}
                placeholder="0"
              />
              {restockIsPackUnit && restockQty > 0 && (
                <p className="text-sm text-emerald-600 font-bold text-center mt-2">
                  = {Number(restockQty) * restockTarget.unitsPerPack} {restockTarget.unit}
                </p>
              )}
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-500 space-y-1">
              <div className="flex justify-between"><span>ต้นทุนต่อหน่วย</span><span className="font-bold">{restockTarget.costPerUnit?.toLocaleString()} ฿/{restockTarget.unit}</span></div>
              {restockQty > 0 && (
                <div className="flex justify-between text-emerald-600 font-bold border-t border-slate-200 pt-1 mt-1">
                  <span>มูลค่าที่เติม</span>
                  <span>
                    {((restockIsPackUnit ? Number(restockQty)*restockTarget.unitsPerPack : Number(restockQty)) * restockTarget.costPerUnit).toLocaleString()} ฿
                  </span>
                </div>
              )}
            </div>
            <button onClick={handleRestock} disabled={!restockQty || Number(restockQty) <= 0} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-40">
              ยืนยันเติมสต๊อก
            </button>
          </div>
        )}
      </Modal>

      {/* ─── Transfer Modal ──────────────────────────────────────────────────────── */}
      <Modal isOpen={isTransferModalOpen} onClose={() => setIsTransferModalOpen(false)} title={`โอน — ${transferTarget?.name || ''}`}>
        {transferTarget && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-xl p-3 text-xs font-bold text-slate-600 text-center">
              <div>คลังหลัก<br/><span className="text-2xl text-slate-800">{transferTarget.mainStock ?? transferTarget.stockQty ?? 0}</span> <span className="text-xs">{transferTarget.unit}</span></div>
              <div>คลังห้องพัก<br/><span className="text-2xl text-blue-700">{transferTarget.roomStock ?? 0}</span> <span className="text-xs">{transferTarget.unit}</span></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setTransferForm(f=>({...f, direction:'toRoom'}))} className={`flex-1 py-2.5 rounded-xl font-bold text-sm border-2 transition-all ${transferForm.direction==='toRoom' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-400'}`}>คลังหลัก → ห้องพัก</button>
              <button onClick={() => setTransferForm(f=>({...f, direction:'toMain'}))} className={`flex-1 py-2.5 rounded-xl font-bold text-sm border-2 transition-all ${transferForm.direction==='toMain' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-400'}`}>ห้องพัก → คลังหลัก</button>
            </div>
            <div>
              <label className="block text-slate-500 font-bold mb-1.5 text-xs">จำนวน ({transferTarget.unit})</label>
              <input type="number" min="1" autoFocus className="w-full p-4 text-center text-3xl font-black bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" value={transferForm.qty} onChange={e => setTransferForm(f=>({...f, qty:e.target.value}))} placeholder="0"/>
            </div>
            <button onClick={handleTransfer} disabled={!transferForm.qty || Number(transferForm.qty) <= 0} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-40">ยืนยันโอน</button>
          </div>
        )}
      </Modal>

      {/* ─── Category Modal ──────────────────────────────────────────────────────── */}
      <Modal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} title={categoryForm.id ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่'}>
        <div className="space-y-4">
          <div>
            <label className="block text-slate-500 font-bold mb-1.5 text-xs">ชื่อหมวดหมู่</label>
            <input autoFocus type="text" className="w-full p-3 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" value={categoryForm.name} onChange={e => setCategoryForm(f=>({...f, name:e.target.value}))} placeholder="เช่น ทำความสะอาด, ของใช้เติมห้อง"/>
          </div>
          {/* Color picker */}
          <div>
            <label className="block text-slate-500 font-bold mb-2 text-xs">สีหมวดหมู่</label>
            <div className="flex flex-wrap gap-2">
              {['#10b981','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316','#64748b'].map(c => (
                <button key={c} type="button" onClick={() => setCategoryForm(f=>({...f, color:c}))}
                  className={`w-8 h-8 rounded-full border-4 transition-all ${categoryForm.color === c ? 'border-slate-700 scale-110' : 'border-transparent'}`}
                  style={{backgroundColor: c}}/>
              ))}
              <input type="color" value={categoryForm.color || '#10b981'} onChange={e => setCategoryForm(f=>({...f, color:e.target.value}))}
                className="w-8 h-8 rounded-full cursor-pointer border-0 bg-transparent" title="เลือกสีเอง"/>
            </div>
          </div>
          {/* showToStaff toggle */}
          <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer select-none">
            <input type="checkbox" checked={categoryForm.showToStaff !== false} onChange={e => setCategoryForm(f=>({...f, showToStaff:e.target.checked}))} className="w-4 h-4 accent-emerald-600"/>
            <div>
              <p className="font-bold text-sm text-slate-700">แสดงให้พนักงานเห็น</p>
              <p className="text-xs text-slate-400">ปิดเพื่อซ่อนหมวดนี้จากหน้าจอพนักงาน</p>
            </div>
          </label>
          <div className="flex gap-2">
            {categoryForm.id && (
              <button type="button" onClick={handleDeleteCategory} className="px-4 py-3 bg-red-50 text-red-500 rounded-xl font-bold hover:bg-red-100">ลบ</button>
            )}
            <button type="button" onClick={handleSaveCategory} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all">บันทึก</button>
          </div>
          {consumableCategories.length > 0 && (
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-bold text-slate-400 mb-2">หมวดหมู่ปัจจุบัน</p>
              <div className="space-y-1">
                {consumableCategories.map(cat => (
                  <div key={cat.id} onClick={() => openCategoryModal(cat)} className="flex justify-between items-center px-3 py-2 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{backgroundColor: cat.color || '#10b981'}}/>
                      <span className="font-bold text-slate-700">{cat.name}</span>
                    </div>
                    {cat.showToStaff === false && <span className="text-[10px] text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full font-bold">ซ่อนพนักงาน</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ─── Purchase Session Modal (multi-item) ────────────────────────────────── */}
      <Modal isOpen={isPurchaseSessionOpen} onClose={() => setIsPurchaseSessionOpen(false)} title="ซื้อของเข้าสต๊อก" maxWidth="max-w-xl"
        footer={
          <button onClick={handleSavePurchaseSession}
            disabled={purchaseSession.items.filter(it => it.consumableId && Number(it.qty) > 0).length === 0}
            className="w-full py-3.5 bg-emerald-600 text-white rounded-2xl font-bold text-base shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
            <Receipt size={18}/>
            บันทึกการซื้อ + บันทึกรายจ่าย
            {purchaseSession.items.filter(it=>it.consumableId&&Number(it.qty)>0&&Number(it.totalCost)>0).length > 0 &&
              <span className="ml-2 font-black">({purchaseSession.items.filter(it=>it.consumableId&&Number(it.qty)>0&&Number(it.totalCost)>0).reduce((s,it)=>s+Number(it.totalCost),0).toLocaleString()} ฿)</span>
            }
          </button>
        }
      >
        <div className="space-y-4">
          {/* Store & date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-500 font-bold mb-1.5 text-xs">ร้านค้า</label>
              <input type="text" placeholder="เช่น เทสโก้, ร้านค้าส่ง" className="w-full p-3 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                value={purchaseSession.store} onChange={e => setPurchaseSession(s=>({...s, store:e.target.value}))}/>
            </div>
            <div>
              <label className="block text-slate-500 font-bold mb-1.5 text-xs">วันที่ซื้อ</label>
              <input type="date" className="w-full p-3 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                value={purchaseSession.date} onChange={e => setPurchaseSession(s=>({...s, date:e.target.value}))}/>
            </div>
          </div>

          {/* Item rows */}
          <div>
            <label className="block text-slate-500 font-bold mb-2 text-xs">รายการที่ซื้อ</label>
            <div className="space-y-2">
              {purchaseSession.items.map((it, idx) => {
                const selItem = consumables.find(c => c.id === it.consumableId);
                const convFactor = Math.max(1, Number(it.conversionFactor) || 1);
                const totalBaseUnits = Number(it.qty) * convFactor;
                const ppu = selItem && totalBaseUnits > 0 && Number(it.totalCost) > 0
                  ? (Number(it.totalCost) / totalBaseUnits).toFixed(2) : null;
                const isConverted = convFactor > 1;
                return (
                  <div key={idx} className="bg-slate-50 rounded-2xl p-3 space-y-2">
                    <div className="flex gap-2 items-start">
                      <select className="flex-1 p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={it.consumableId}
                        onChange={e => setPurchaseSession(s => {
                          const items = [...s.items];
                          items[idx] = {...items[idx], consumableId: e.target.value};
                          return {...s, items};
                        })}>
                        <option value="">-- เลือกรายการ --</option>
                        {[...consumables].sort((a,b)=>(a.name||'').localeCompare(b.name||'')).map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.unit})</option>
                        ))}
                      </select>
                      {purchaseSession.items.length > 1 && (
                        <button onClick={() => setPurchaseSession(s => ({...s, items: s.items.filter((_,i)=>i!==idx)}))}
                          className="p-2.5 text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-xl transition-colors shrink-0">
                          <X size={16}/>
                        </button>
                      )}
                    </div>
                    {/* Qty + Conversion + Price */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-1">จำนวนที่ซื้อ</label>
                        <input type="number" min="0" placeholder="0" className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-center focus:ring-2 focus:ring-emerald-500 outline-none"
                          value={it.qty}
                          onChange={e => setPurchaseSession(s => {
                            const items = [...s.items];
                            items[idx] = {...items[idx], qty: e.target.value};
                            return {...s, items};
                          })}/>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-1">
                          {selItem ? `${selItem.unit}/หน่วยซื้อ` : 'หน่วยนับ'}
                        </label>
                        <input type="number" min="1" placeholder="1" className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-center focus:ring-2 focus:ring-blue-400 outline-none"
                          value={it.conversionFactor}
                          onChange={e => setPurchaseSession(s => {
                            const items = [...s.items];
                            items[idx] = {...items[idx], conversionFactor: e.target.value};
                            return {...s, items};
                          })}/>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-1">ราคารวม (฿)</label>
                        <input type="number" min="0" placeholder="0" className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-center text-emerald-700 focus:ring-2 focus:ring-emerald-500 outline-none"
                          value={it.totalCost}
                          onChange={e => setPurchaseSession(s => {
                            const items = [...s.items];
                            items[idx] = {...items[idx], totalCost: e.target.value};
                            return {...s, items};
                          })}/>
                      </div>
                    </div>
                    {(isConverted || ppu) && (
                      <p className="text-[10px] font-bold px-1 text-slate-500">
                        {isConverted && Number(it.qty) > 0 && <span className="text-blue-600">รวม {totalBaseUnits} {selItem?.unit} </span>}
                        {ppu && <span className="text-emerald-600">· ≈ {ppu} ฿/{selItem?.unit} · ต้นทุนเฉลี่ยจะถูกอัพเดต</span>}
                      </p>
                    )}
                    <input type="text" placeholder="หมายเหตุ (ไม่บังคับ)" className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-slate-300 outline-none text-slate-500"
                      value={it.note}
                      onChange={e => setPurchaseSession(s => {
                        const items = [...s.items];
                        items[idx] = {...items[idx], note: e.target.value};
                        return {...s, items};
                      })}/>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setPurchaseSession(s => ({...s, items: [...s.items, {consumableId:'', qty:'', conversionFactor:'1', totalCost:'', note:''}]}))}
              className="mt-2 w-full py-2.5 border-2 border-dashed border-slate-200 text-slate-400 rounded-2xl font-bold text-sm hover:border-emerald-300 hover:text-emerald-600 transition-all flex items-center justify-center gap-2">
              <Plus size={16}/> เพิ่มรายการ
            </button>
          </div>

          {/* Summary */}
          {purchaseSession.items.some(it => it.consumableId && Number(it.qty) > 0 && Number(it.totalCost) > 0) && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-1 text-sm">
              <p className="font-bold text-emerald-700 text-xs uppercase tracking-wide mb-2">สรุปยอด</p>
              {purchaseSession.items.filter(it => it.consumableId && Number(it.qty) > 0 && Number(it.totalCost) > 0).map((it, idx) => {
                const item = consumables.find(c => c.id === it.consumableId);
                const cf = Math.max(1, Number(it.conversionFactor) || 1);
                const totalUnits = Number(it.qty) * cf;
                return (
                  <div key={idx} className="flex justify-between text-emerald-800">
                    <span>{item?.name} × {totalUnits} {item?.unit}</span>
                    <span className="font-bold">{Number(it.totalCost).toLocaleString()} ฿</span>
                  </div>
                );
              })}
              <div className="border-t border-emerald-300 pt-2 mt-1 flex justify-between font-black text-emerald-900">
                <span>รวมทั้งสิ้น</span>
                <span>{purchaseSession.items.filter(it=>it.consumableId&&Number(it.qty)>0&&Number(it.totalCost)>0).reduce((s,it)=>s+Number(it.totalCost),0).toLocaleString()} ฿</span>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ─── Stock Adjustment Modal ──────────────────────────────────────────────── */}
      <Modal isOpen={isAdjustModalOpen} onClose={() => setIsAdjustModalOpen(false)} title="ปรับปรุงสต๊อก"
        footer={
          <button onClick={handleSaveAdjustment}
            className="w-full py-3.5 bg-amber-500 text-white rounded-2xl font-bold text-base shadow-lg shadow-amber-200 hover:bg-amber-600 active:scale-95 transition-all flex items-center justify-center gap-2">
            <Layers size={18}/> ยืนยันปรับปรุงสต๊อก
          </button>
        }
      >
        <div className="space-y-4">
          {/* Mode tabs */}
          <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
            <button onClick={() => setAdjustForm(f=>({...f, mode:'count'}))}
              className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${adjustForm.mode==='count' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-400'}`}>
              🔢 นับยอดจริง
            </button>
            <button onClick={() => setAdjustForm(f=>({...f, mode:'delta'}))}
              className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${adjustForm.mode==='delta' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-400'}`}>
              ✏️ ปรับปรุงยอด
            </button>
          </div>

          {/* Item selector */}
          <div>
            <label className="block text-slate-500 font-bold mb-1.5 text-xs">รายการสต๊อก</label>
            <select className="w-full p-3 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none font-bold"
              value={adjustForm.consumableId}
              onChange={e => setAdjustForm(f=>({...f, consumableId:e.target.value}))}>
              <option value="">-- เลือกรายการ --</option>
              {[...consumables].sort((a,b)=>(a.name||'').localeCompare(b.name||'')).map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.unit})</option>
              ))}
            </select>
          </div>

          {/* Current stock display */}
          {adjustForm.consumableId && (() => {
            const selItem = consumables.find(c => c.id === adjustForm.consumableId);
            if (!selItem) return null;
            const currentMain = selItem.mainStock ?? selItem.stockQty ?? 0;
            const newCount = adjustForm.mode === 'count' ? Number(adjustForm.newCount || 0) : currentMain + (adjustForm.deltaDir === '+' ? Number(adjustForm.deltaQty||0) : -Number(adjustForm.deltaQty||0));
            const delta = newCount - currentMain;
            return (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <p className="text-xs font-bold text-slate-400 mb-1">ยอดปัจจุบัน</p>
                    <p className="text-2xl font-black text-slate-700">{currentMain} <span className="text-sm">{selItem.unit}</span></p>
                  </div>
                  <ArrowRight size={20} className="text-amber-400"/>
                  <div className="text-center">
                    <p className="text-xs font-bold text-slate-400 mb-1">ยอดใหม่</p>
                    <p className={`text-2xl font-black ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-500' : 'text-slate-700'}`}>
                      {Math.max(0, newCount)} <span className="text-sm">{selItem.unit}</span>
                    </p>
                  </div>
                </div>
                {delta !== 0 && (
                  <p className={`text-center text-sm font-bold mt-2 ${delta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {delta > 0 ? `+${delta}` : delta} {selItem.unit}
                  </p>
                )}
                {delta === 0 && adjustForm.mode==='count' && adjustForm.newCount !== '' && (
                  <p className="text-center text-sm font-bold mt-2 text-slate-500">ยอดตรงกัน ✓</p>
                )}
              </div>
            );
          })()}

          {/* Mode-specific inputs */}
          {adjustForm.mode === 'count' ? (
            <div>
              <label className="block text-slate-500 font-bold mb-1.5 text-xs">ยอดที่นับได้จริง</label>
              <input type="number" min="0" placeholder="0" autoFocus
                className="w-full p-3 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none font-black text-2xl text-center"
                value={adjustForm.newCount}
                onChange={e => setAdjustForm(f=>({...f, newCount:e.target.value}))}/>
            </div>
          ) : (
            <div>
              <label className="block text-slate-500 font-bold mb-1.5 text-xs">จำนวนที่ปรับ</label>
              <div className="flex gap-2">
                <div className="flex rounded-xl border border-slate-200 overflow-hidden shrink-0">
                  <button onClick={() => setAdjustForm(f=>({...f, deltaDir:'+'}))}
                    className={`px-4 py-3 font-black text-lg transition-all ${adjustForm.deltaDir==='+' ? 'bg-emerald-500 text-white' : 'bg-white text-slate-400'}`}>+</button>
                  <button onClick={() => setAdjustForm(f=>({...f, deltaDir:'-'}))}
                    className={`px-4 py-3 font-black text-lg transition-all ${adjustForm.deltaDir==='-' ? 'bg-red-500 text-white' : 'bg-white text-slate-400'}`}>−</button>
                </div>
                <input type="number" min="0" placeholder="0" autoFocus
                  className="flex-1 p-3 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none font-black text-2xl text-center"
                  value={adjustForm.deltaQty}
                  onChange={e => setAdjustForm(f=>({...f, deltaQty:e.target.value}))}/>
              </div>
            </div>
          )}

          {/* Date + Note */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-500 font-bold mb-1.5 text-xs">วันที่</label>
              <input type="date" className="w-full p-3 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none text-sm"
                value={adjustForm.date} onChange={e => setAdjustForm(f=>({...f, date:e.target.value}))}/>
            </div>
            <div>
              <label className="block text-slate-500 font-bold mb-1.5 text-xs">หมายเหตุ</label>
              <input type="text" placeholder="เหตุผล..." className="w-full p-3 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none text-sm"
                value={adjustForm.note} onChange={e => setAdjustForm(f=>({...f, note:e.target.value}))}/>
            </div>
          </div>
        </div>
      </Modal>

      {/* ─── Edit Log Modal ───────────────────────────────────────────────────────── */}
      <Modal isOpen={isEditLogModalOpen} onClose={() => setIsEditLogModalOpen(false)} title="แก้ไขประวัติ">
        {editLogTarget && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl px-4 py-3 text-sm text-slate-600">
              <p className="font-bold text-slate-800">{editLogTarget.consumableName}</p>
              <p className="text-xs text-slate-400 mt-0.5">ประเภท: {editLogTarget.logType}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-500 font-bold mb-1.5 text-xs">จำนวน ({editLogTarget.unit})</label>
                <input type="number" min="0" className="w-full p-3 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-center"
                  value={editLogForm.qty} onChange={e => setEditLogForm(f=>({...f, qty:e.target.value}))}/>
              </div>
              <div>
                <label className="block text-slate-500 font-bold mb-1.5 text-xs">มูลค่า (฿)</label>
                <input type="number" min="0" className="w-full p-3 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-center text-emerald-700"
                  value={editLogForm.cost} onChange={e => setEditLogForm(f=>({...f, cost:e.target.value}))}/>
              </div>
            </div>
            <div>
              <label className="block text-slate-500 font-bold mb-1.5 text-xs">วันที่</label>
              <input type="date" className="w-full p-3 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                value={editLogForm.date} onChange={e => setEditLogForm(f=>({...f, date:e.target.value}))}/>
            </div>
            <div>
              <label className="block text-slate-500 font-bold mb-1.5 text-xs">หมายเหตุ</label>
              <input type="text" className="w-full p-3 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                value={editLogForm.note} onChange={e => setEditLogForm(f=>({...f, note:e.target.value}))} placeholder="หมายเหตุ"/>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={handleDeleteLog} className="px-4 py-3 bg-red-50 text-red-500 rounded-xl font-bold hover:bg-red-100 transition-colors">ลบ</button>
              <button onClick={handleSaveLogEdit} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all">บันทึก</button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Use Consumable Modal ───────────────────────────────────────────────── */}
      <Modal isOpen={isUseConsumableModalOpen} onClose={() => setIsUseConsumableModalOpen(false)} title="บันทึกของใช้">
        <div className="space-y-4">
          {consumables.length === 0 ? (
            <p className="text-center text-slate-400 py-8">ยังไม่มีรายการของใช้</p>
          ) : (
            (() => {
              const staffVisibleConsumables = [...consumables]
                .filter(item => {
                  if (role !== 'staff') return true;
                  const cat = consumableCategories.find(c => c.name === item.category);
                  return !cat || cat.showToStaff !== false;
                })
                .sort((a,b) => (a.name||'').localeCompare(b.name||''));
              return (
            <>
              <div>
                <label className="block text-slate-500 font-bold mb-2 text-xs">ห้องที่บันทึก (ไม่บังคับ)</label>
                <select className="w-full p-2.5 bg-slate-50 border-0 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none" value={usageTargetRoomId || ''} onChange={e => setUsageTargetRoomId(e.target.value||null)}>
                  <option value="">-- ไม่ระบุห้อง --</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                {staffVisibleConsumables.map(item => (
                  <div key={item.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 text-sm truncate">{item.name}</p>
                      <p className="text-xs text-slate-400">{role === 'staff' ? `คลังห้อง: ${item.roomStock ?? 0}` : `คงเหลือ ${(item.mainStock ?? item.stockQty ?? 0)}`} {item.unit}{role !== 'staff' && ` · ${(item.avgCostPerUnit ?? item.costPerUnit ?? 0).toLocaleString(undefined,{maximumFractionDigits:2})} ฿/${item.unit}`}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      <button onClick={() => setConsumableUsageMap(m => ({...m, [item.id]: Math.max(0, (Number(m[item.id])||0) - 1)}))} className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 font-bold text-lg leading-none shadow-sm">−</button>
                      <input
                        type="number" min="0"
                        className="w-14 text-center font-black text-lg bg-white border border-slate-200 rounded-xl p-1 focus:ring-2 focus:ring-emerald-400 outline-none"
                        value={consumableUsageMap[item.id] || ''}
                        placeholder="0"
                        onChange={e => setConsumableUsageMap(m => ({...m, [item.id]: e.target.value}))}
                      />
                      <span className="text-xs text-slate-400 w-8">{item.unit}</span>
                      <button onClick={() => setConsumableUsageMap(m => ({...m, [item.id]: (Number(m[item.id])||0) + 1}))} className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-lg leading-none shadow-sm hover:bg-emerald-600">+</button>
                    </div>
                  </div>
                ))}
              </div>
              {role !== 'staff' && Object.values(consumableUsageMap).some(v => Number(v) > 0) && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs">
                  <p className="font-bold text-orange-700 mb-1">สรุปต้นทุน</p>
                  {Object.entries(consumableUsageMap).filter(([,v]) => Number(v)>0).map(([cId, qty]) => {
                    const item = consumables.find(c => c.id === cId);
                    if (!item) return null;
                    return <div key={cId} className="flex justify-between text-orange-600"><span>{item.name} × {qty} {item.unit}</span><span>{(Number(qty)*(item.avgCostPerUnit ?? item.costPerUnit ?? 0)).toLocaleString()} ฿</span></div>;
                  })}
                  <div className="border-t border-orange-200 mt-2 pt-2 flex justify-between font-bold text-orange-700">
                    <span>รวม</span>
                    <span>{Object.entries(consumableUsageMap).reduce((s,[cId,qty]) => { const item=consumables.find(c=>c.id===cId); return s+(Number(qty)*(item?.avgCostPerUnit ?? item?.costPerUnit ?? 0)); }, 0).toLocaleString()} ฿</span>
                  </div>
                </div>
              )}
              <button onClick={handleRecordUsage} className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold text-lg shadow-lg shadow-orange-200 hover:bg-orange-600 active:scale-95 transition-all">
                บันทึกการใช้
              </button>
            </>
              );
            })()
          )}
        </div>
      </Modal>

      {/* ─── Housekeeping Panel ─────────────────────────────────────────────────── */}
      {isHousekeepingViewOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-end sm:items-center justify-center p-4" onClick={() => setIsHousekeepingViewOpen(false)}>
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col animate-slide-up sm:animate-fade-in overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">🧹 แม่บ้าน</h2>
                <p className="text-xs text-slate-400 mt-0.5">ห้องที่รอทำความสะอาด</p>
              </div>
              <button onClick={() => setIsHousekeepingViewOpen(false)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-500"><X size={20}/></button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-2">
              {rooms.filter(r => r.cleaningStatus === 'dirty').length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-3">✨</div>
                  <p className="font-bold text-slate-600 text-lg">ห้องสะอาดครบแล้ว!</p>
                  <p className="text-sm text-slate-400 mt-1">ไม่มีห้องรอทำความสะอาด</p>
                </div>
              ) : (
                rooms.filter(r => r.cleaningStatus === 'dirty').map(room => (
                  <div key={room.id} className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-2xl px-4 py-3">
                    <div>
                      <p className="font-bold text-slate-800">{room.name}</p>
                      <p className="text-xs text-purple-600 font-bold">รอทำความสะอาด</p>
                    </div>
                    <button
                      onClick={() => { setIsHousekeepingViewOpen(false); openCleaningRecord(room.id); }}
                      className="bg-purple-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-purple-700 active:scale-95 transition-all shadow-sm shadow-purple-200"
                    >
                      เริ่มทำสะอาด
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Cleaning Record Modal ───────────────────────────────────────────────── */}
      <Modal isOpen={isCleaningRecordOpen} onClose={() => setIsCleaningRecordOpen(false)}
        title={`ทำความสะอาด — ${rooms.find(r => r.id === cleaningTargetRoomId)?.name || ''}`}
        footer={
          <button onClick={handleMarkRoomClean} className="w-full py-3.5 bg-purple-600 text-white rounded-2xl font-bold shadow-lg shadow-purple-200 hover:bg-purple-700 flex items-center justify-center gap-2 transition-all active:scale-95">
            ✅ ทำความสะอาดเสร็จแล้ว
          </button>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">บันทึกของใช้ที่นำไปใช้ในห้องนี้ (ไม่บังคับ)</p>
          {consumables.filter(item => {
            const cat = consumableCategories.find(c => c.name === item.category);
            return !cat || cat.showToStaff !== false;
          }).sort((a,b) => (a.name||'').localeCompare(b.name||'')).length === 0 ? (
            <p className="text-center text-slate-400 py-4 text-sm">ไม่มีรายการของใช้</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
              {consumables.filter(item => {
                const cat = consumableCategories.find(c => c.name === item.category);
                return !cat || cat.showToStaff !== false;
              }).sort((a,b) => (a.name||'').localeCompare(b.name||'')).map(item => (
                <div key={item.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-100">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 text-sm truncate">{item.name}</p>
                    <p className="text-xs text-slate-400">คลังห้อง: {item.roomStock ?? 0} {item.unit}</p>
                  </div>
                  <div className="flex items-center gap-1.5 ml-2 shrink-0">
                    <button onClick={() => setCleaningUsageMap(m => ({...m, [item.id]: Math.max(0, (Number(m[item.id])||0) - 1)}))} className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 font-bold text-lg leading-none shadow-sm">−</button>
                    <input type="number" min="0" className="w-12 text-center font-black text-base bg-white border border-slate-200 rounded-xl p-1 focus:ring-2 focus:ring-purple-400 outline-none"
                      value={cleaningUsageMap[item.id] || ''} placeholder="0"
                      onChange={e => setCleaningUsageMap(m => ({...m, [item.id]: e.target.value}))}/>
                    <span className="text-xs text-slate-400 w-7">{item.unit}</span>
                    <button onClick={() => setCleaningUsageMap(m => ({...m, [item.id]: (Number(m[item.id])||0) + 1}))} className="w-7 h-7 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold text-lg leading-none shadow-sm hover:bg-purple-600">+</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* ─── Reorder Recommendation Modal ───────────────────────────────────────── */}
      <Modal isOpen={isReorderModalOpen} onClose={() => setIsReorderModalOpen(false)} title="รายการแนะนำซื้อ">
        {(() => {
          const lowItems = [...consumables]
            .filter(item => {
              const s = item.mainStock ?? item.stockQty ?? 0;
              return s <= (item.minStock ?? 0);
            })
            .sort((a, b) => {
              const sA = a.mainStock ?? a.stockQty ?? 0;
              const sB = b.mainStock ?? b.stockQty ?? 0;
              if (sA === 0 && sB !== 0) return -1;
              if (sB === 0 && sA !== 0) return 1;
              return (a.name||'').localeCompare(b.name||'');
            });
          if (lowItems.length === 0) return (
            <div className="text-center py-10">
              <div className="text-4xl mb-3">🎉</div>
              <p className="font-bold text-slate-700">สต๊อกพร้อมใช้งานทุกรายการ</p>
              <p className="text-sm text-slate-400 mt-1">ไม่มีรายการที่ต้องสั่งซื้อ</p>
            </div>
          );
          return (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">{lowItems.length} รายการที่ควรสั่งซื้อ</p>
              {lowItems.map(item => {
                const stock = item.mainStock ?? item.stockQty ?? 0;
                const isOut = stock <= 0;
                const catObj = consumableCategories.find(c => c.name === item.category);
                const catColor = catObj?.color || '#64748b';
                return (
                  <div key={item.id} className={`rounded-2xl border px-4 py-3 flex items-center justify-between gap-3 ${isOut ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${isOut ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'}`}>{isOut ? 'หมด' : 'ใกล้หมด'}</span>
                        {item.category && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold text-white" style={{backgroundColor: catColor}}>{item.category}</span>}
                      </div>
                      <p className="font-bold text-slate-800 mt-1">{item.name}</p>
                      <p className="text-xs text-slate-500">คงเหลือ <span className={`font-black ${isOut ? 'text-red-600' : 'text-amber-600'}`}>{stock}</span> / ขั้นต่ำ {item.minStock ?? 0} {item.unit}</p>
                    </div>
                    <button
                      onClick={() => {
                        setIsReorderModalOpen(false);
                        const newItems = [{consumableId: item.id, qty:'', totalCost:'', note:''}];
                        setPurchaseSession({ store:'', date: formatDate(new Date()), items: newItems });
                        setIsPurchaseSessionOpen(true);
                      }}
                      className="bg-emerald-600 text-white px-3 py-2 rounded-xl font-bold text-sm hover:bg-emerald-700 active:scale-95 transition-all shrink-0 shadow-sm"
                    >
                      สั่งซื้อ
                    </button>
                  </div>
                );
              })}
              <button
                onClick={() => {
                  setIsReorderModalOpen(false);
                  const newItems = lowItems.map(item => ({consumableId: item.id, qty:'', totalCost:'', note:''}));
                  setPurchaseSession({ store:'', date: formatDate(new Date()), items: newItems });
                  setIsPurchaseSessionOpen(true);
                }}
                className="w-full py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-200"
              >
                สั่งซื้อทั้งหมด ({lowItems.length} รายการ)
              </button>
            </div>
          );
        })()}
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
