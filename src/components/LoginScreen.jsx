import React, { useState } from 'react';
import { Shield, User, Lock, ArrowRight, X } from 'lucide-react';

export const LoginScreen = ({ onLogin }) => {
    const [pass, setPass] = useState('');
    const [error, setError] = useState('');
    const [showOwnerInput, setShowOwnerInput] = useState(false);

    const handleOwnerLogin = (e) => {
        e.preventDefault();
        if (pass === import.meta.env.VITE_OWNER_PIN) onLogin('owner');
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
