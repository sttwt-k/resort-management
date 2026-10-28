import React, { useState } from 'react';
import { Lock, X } from 'lucide-react';

export const LoginScreen = ({ onLogin, onClose }) => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleLogin = async (event) => {
        event.preventDefault();
        if (isSubmitting) return;
        if (!/^\d{6}$/.test(pin)) {
            setError('กรุณาใส่ PIN 6 หลัก');
            return;
        }
        setIsSubmitting(true);
        setError('');
        try {
            const signedIn = await onLogin('owner', pin);
            setPin('');
            if (!signedIn) setError('PIN ไม่ถูกต้อง หรือเชื่อมต่อไม่ได้');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[80] bg-slate-900/60 flex items-center justify-center p-4">
            <section role="dialog" aria-modal="true" aria-labelledby="admin-login-title" className="bg-white p-6 rounded-3xl shadow-2xl w-full max-w-sm">
                <div className="flex justify-between items-center gap-3 mb-5">
                    <h2 id="admin-login-title" className="font-bold text-slate-800 flex items-center gap-2"><Lock size={18}/> เข้าสู่ระบบ Admin</h2>
                    <button disabled={isSubmitting} onClick={onClose} aria-label="กลับหน้าพนักงาน" className="p-2 rounded-full bg-slate-100 text-slate-500"><X size={18}/></button>
                </div>
                <form onSubmit={handleLogin} className="space-y-4">
                    <label className="block text-sm text-slate-600" htmlFor="admin-pin">รหัส PIN 6 หลัก</label>
                    <input id="admin-pin" type="password" maxLength={6} autoComplete="off" inputMode="numeric" autoFocus disabled={isSubmitting}
                        className="w-full p-3 bg-slate-50 rounded-xl text-center text-lg tracking-widest focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={pin} onChange={event => { setPin(event.target.value.replace(/\D/g, '')); setError(''); }} />
                    {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
                    <button type="submit" disabled={isSubmitting} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold disabled:opacity-60">
                        {isSubmitting ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
                    </button>
                </form>
            </section>
        </div>
    );
};
