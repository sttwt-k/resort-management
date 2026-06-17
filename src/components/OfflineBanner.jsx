import React from 'react';
import { WifiOff } from 'lucide-react';

export const OfflineBanner = ({ useMockData }) => {
    if (!useMockData) return null;
    return (
        <div className="w-full bg-amber-500 text-white text-sm font-bold px-4 py-2 flex items-center justify-center gap-2 z-50 sticky top-0">
            <WifiOff size={16} />
            <span>⚠ ไม่ได้เชื่อมต่อ Firebase — ข้อมูลจะไม่ถูกบันทึก</span>
        </div>
    );
};
