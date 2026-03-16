// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
  Search, ChevronLeft, ChevronRight, Home, User, Calendar as CalendarIcon,
  CalendarCheck, Plus, Users, Briefcase, Clock, ShieldCheck, RefreshCw,
  CheckCircle, AlertCircle, Lock, LogOut, Wand2, Settings, Trash2, Bell, XCircle, Filter, AlignLeft, Coffee, X, Store
} from 'lucide-react';

// === Firebase 雲端資料庫連線核心 ===
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

// ==========================================
// 🚨 步驟一：請將下方替換成你 Firebase 專案的金鑰 🚨
// ==========================================
let firebaseConfig = {
  // 👇👇👇 你的金鑰貼在這邊 👇👇👇
  apiKey: "AIzaSyDC1cBttnZIRWEfYNve5S8NZItx311uM2c",
  authDomain: "staff-scheduling-system-e877c.firebaseapp.com",
  projectId: "staff-scheduling-system-e877c",
  storageBucket: "staff-scheduling-system-e877c.firebasestorage.app",
  messagingSenderId: "694900041074",
  appId: "1:694900041074:web:b2e51efded21ae0953a9eb"
  // 👆👆👆 你的金鑰貼在這邊 👆👆👆
};

// 為了相容預覽環境，加入防呆機制
try {
  if (typeof window !== 'undefined' && window.__firebase_config) firebaseConfig = JSON.parse(window.__firebase_config);
  else if (typeof __firebase_config !== 'undefined') firebaseConfig = JSON.parse(__firebase_config);
} catch (e) { /* 使用本地 Config */ }

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = (typeof window !== 'undefined' && window.__app_id) ? window.__app_id : (typeof __app_id !== 'undefined' ? __app_id : 'staff-scheduling-system');

// 雲端同步輔助函數
const syncStateToCloud = async (firebaseUser, updates) => {
  if (!firebaseUser) return;
  const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'schedule_data', 'main_state');
  try {
    await setDoc(docRef, updates, { merge: true });
  } catch (e) {
    console.error("雲端同步失敗: ", e);
  }
};

// ==========================================
// 1. 工具函數與核心演算法 (加入行政院假日支援)
// ==========================================

const taiwanHolidays = {
  '2026/1/1': '元旦',
  '2026/2/16': '春節', '2026/2/17': '春節', '2026/2/18': '春節', '2026/2/19': '春節', '2026/2/20': '春節', '2026/2/23': '春節', '2026/2/24': '春節',
  '2026/2/28': '228紀念', '2026/3/2': '228補假',
  '2026/4/3': '兒童節', '2026/4/4': '清明節', '2026/4/6': '清明補假',
  '2026/5/1': '勞動節',
  '2026/6/19': '端午連假', '2026/6/20': '端午節', '2026/6/21': '端午連假',
  '2026/9/25': '中秋連假', '2026/9/26': '中秋節', '2026/9/27': '中秋連假',
  '2026/10/9': '國慶連假', '2026/10/10': '國慶日', '2026/10/11': '國慶連假'
};

const getDayInfo = (year, month, day) => {
  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const dateKey = `${year}/${month}/${day}`;
  const holidayName = taiwanHolidays[dateKey] || null;

  return {
    isWeekend,
    isHoliday: !!holidayName,
    holidayName,
    isOffDay: isWeekend || !!holidayName // 例假日、連假、國定假日皆視為休假日
  };
};

const isHourInTimeStr = (hour, timeStr) => {
  if (!timeStr || timeStr.includes('待定')) return false;
  const parts = timeStr.split('&').map(p => p.trim());
  return parts.some(part => {
    let [start, end] = part.split('-');
    if (!start || !end) return false;
    let sH = parseInt(start.split(':')[0], 10);
    let eH = parseInt(end.split(':')[0], 10);
    if (eH === 0) eH = 24;
    return hour >= sH && hour < eH;
  });
};

const getDemandForHour = (hour, isWeekend, demands) => {
  const block = demands.find(d => {
    if (!d.name || !d.name.includes('-')) return false;
    let [start, end] = d.name.split('-').map(t => parseInt(t.trim().split(':')[0], 10));
    if (isNaN(start) || isNaN(end)) return false;
    if (end === 0) end = 24;
    return hour >= start && hour < end;
  });
  if (!block) return 0;
  return isWeekend ? block.reqWeekend : block.reqWeekday;
};

// 升級版：支援陣列格式以應付動態新增與刪除
const initialShiftTimes = [
  { id: 'base_morning', name: '早班(基本預設)', time: '11:00 - 15:00 & 17:00 - 22:00', isSystem: true },
  { id: 'base_night', name: '晚班(基本預設)', time: '15:00 - 00:00', isSystem: true },
  { id: 'base_stay', name: '留守(基本預設)', time: '11:00 - 22:00', isSystem: true },
  { id: 'full_morning', name: '早班正職', time: '11:00 - 15:00 & 17:00 - 22:00', isSystem: true },
  { id: 'full_night', name: '晚班正職', time: '15:00 - 00:00', isSystem: true },
  { id: 'part_morning_weekday', name: '早班兼職(平日)', time: '11:00 - 15:00', isSystem: true },
  { id: 'part_night_weekday', name: '晚班兼職(平日)', time: '18:00 - 22:00', isSystem: true },
  { id: 'part_morning_weekend', name: '兼職(假日)', time: '11:00 - 15:00 & 17:00 - 22:00', isSystem: true },
  { id: 'part_morning_weekend_alt', name: '兼職(假日替代調度)', time: '11:00 - 20:00', isSystem: true },
  { id: 'part_night_weekend', name: '晚班兼職(假日)', time: '11:00 - 15:00 & 17:00 - 22:00', isSystem: true },
];

const normalizeShiftTimes = (st) => {
  if (Array.isArray(st)) return st;
  // 向後相容舊資料結構
  return [
    { id: 'base_morning', name: '早班(基本預設)', time: st.base_morning || '11:00 - 15:00 & 17:00 - 22:00', isSystem: true },
    { id: 'base_night', name: '晚班(基本預設)', time: st.base_night || '15:00 - 00:00', isSystem: true },
    { id: 'base_stay', name: '留守(基本預設)', time: st.base_stay || '11:00 - 22:00', isSystem: true },
    { id: 'full_morning', name: '早班正職', time: st.full_morning || '11:00 - 15:00 & 17:00 - 22:00', isSystem: true },
    { id: 'full_night', name: '晚班正職', time: st.full_night || '15:00 - 00:00', isSystem: true },
    { id: 'part_morning_weekday', name: '早班兼職(平日)', time: st.part_morning_weekday || '11:00 - 15:00', isSystem: true },
    { id: 'part_night_weekday', name: '晚班兼職(平日)', time: st.part_night_weekday || '18:00 - 22:00', isSystem: true },
    { id: 'part_morning_weekend', name: '兼職(假日)', time: st.part_morning_weekend || '11:00 - 15:00 & 17:00 - 22:00', isSystem: true },
    { id: 'part_morning_weekend_alt', name: '兼職(假日替代調度)', time: st.part_morning_weekend_alt || '11:00 - 20:00', isSystem: true },
    { id: 'part_night_weekend', name: '晚班兼職(假日)', time: st.part_night_weekend || '11:00 - 15:00 & 17:00 - 22:00', isSystem: true },
  ];
};

const getRoleDefaultTime = (role, isWeekend, shiftCategory, shiftTimesObj = initialShiftTimes) => {
  const shiftArr = normalizeShiftTimes(shiftTimesObj);
  const getTime = (id) => shiftArr.find(x => x.id === id)?.time || '';
  
  // 優先檢查是否有完全符合的自訂職位時間
  const customRole = shiftArr.find(x => !x.isSystem && x.name === role);
  if (customRole) return customRole.time;

  if (shiftCategory === '早班') return getTime('base_morning');
  if (shiftCategory === '晚班') return getTime('base_night');
  if (shiftCategory === '留守') return getTime('base_stay');

  const isPartTime = role.includes('兼職');
  const isMorning = role.includes('早班');
  if (isPartTime) {
    return isMorning 
      ? (isWeekend ? getTime('part_morning_weekend') : getTime('part_morning_weekday'))
      : (isWeekend ? getTime('part_night_weekend') : getTime('part_night_weekday'));
  } else {
    return isMorning ? getTime('full_morning') : getTime('full_night');
  }
};

const isDayUnderstaffed = (dateStr, isWeekend, shifts, demands) => {
  const dayShifts = shifts.filter((s) => s.date === dateStr);
  const checkHours = demands.map(d => {
    if (!d.name || !d.name.includes('-')) return null;
    return parseInt(d.name.split('-')[0].split(':')[0], 10);
  }).filter(h => h !== null && !isNaN(h));

  for (let hour of checkHours) {
    const demand = getDemandForHour(hour, isWeekend, demands);
    const coverage = dayShifts.filter(s => isHourInTimeStr(hour, s.time)).length;
    if (coverage < demand) return true;
  }
  return false;
};

const generateFullScheduleForUser = (user, leavesArray, ruleEnabled, totalLeaveDays, targetYear, targetMonth, shiftTimes = initialShiftTimes) => {
  if (!user.role) return [];
  const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
  const isLeave = Array(daysInMonth).fill(false);
  
  leavesArray.forEach((l) => {
    const [y, m, d] = l.date.split('/').map(Number);
    if (y === targetYear && m === targetMonth) {
      isLeave[d - 1] = true;
    }
  });

  let extraLeaves = totalLeaveDays - isLeave.filter(Boolean).length;

  for (let i = 0; i < daysInMonth; i++) {
    if (!isLeave[i] && ruleEnabled) {
      let windowStart = Math.max(0, i - 6);
      let workDaysInWindow = 0;
      for (let j = windowStart; j <= i; j++) {
        if (!isLeave[j]) workDaysInWindow++;
      }
      if (workDaysInWindow > 5) {
        isLeave[i] = true;
        extraLeaves--;
      }
    }
  }

  for (let i = daysInMonth - 1; i >= 0 && extraLeaves > 0; i--) {
    if (!isLeave[i]) {
      isLeave[i] = true;
      extraLeaves--;
    }
  }

  const newShifts = [];
  for (let i = 0; i < daysInMonth; i++) {
    if (!isLeave[i]) {
      const dayNum = i + 1;
      const dateStr = `${targetYear}/${targetMonth}/${dayNum}`;
      const dayOfWeek = new Date(targetYear, targetMonth - 1, dayNum).getDay();
      const dayStr = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'][dayOfWeek];
      
      const info = getDayInfo(targetYear, targetMonth, dayNum);
      const exactTime = getRoleDefaultTime(user.role, info.isOffDay, null, shiftTimes);
      const shiftCat = user.role.includes('晚班') ? '晚班' : '早班';

      newShifts.push({
        id: `auto_${user.id}_${dateStr}_${Math.random().toString(36).substring(2,7)}`,
        date: dateStr,
        day: dayStr,
        type: user.role,
        shiftCategory: shiftCat,
        time: exactTime,
        assignee: user.name,
        status: 'confirmed',
      });
    }
  }
  return newShifts;
};

// 系統初始設定 (更新為圖片需求的數量)
const initialTimeBlockDemands = [
  { id: 'tb1', name: '11:00 - 15:00', reqWeekday: 7, reqWeekend: 15 },
  { id: 'tb2', name: '15:00 - 17:00', reqWeekday: 5, reqWeekend: 7 },
  { id: 'tb3', name: '17:00 - 22:00', reqWeekday: 15, reqWeekend: 19 },
  { id: 'tb4', name: '22:00 - 00:00', reqWeekday: 5, reqWeekend: 6 },
];

const initialBusinessHours = "11:00 - 00:00";
const initialRegisteredUsers = []; 
const initialLeavesMap = {}; 
const generateInitialShifts = () => { return []; };
const initialLeaveSettings = { year: 2026, month: 3, total: 8, weekend: 1, weekday: 7 };

const DEFAULT_ANNOUNCEMENT = `系統排休規則：\n為確保公平性，請依據系統當前設定之額度自行劃定排休。\n（假單送出後，系統將會自動依您的身分為您排滿剩餘的工作日！）`;

// ==========================================
// 3. 共用與 UI 元件
// ==========================================

function BottomNav({ role, activeScreen, onNavigate, pendingCount }) {
  return (
    <nav className="absolute bottom-0 left-0 w-full bg-white/85 backdrop-blur-md border-t border-gray-100 px-8 py-5 flex justify-between items-center z-50">
      {role === 'manager' ? (
        <>
          <button onClick={() => onNavigate('home')} className={`${activeScreen === 'home' ? 'text-[#2563EB]' : 'text-gray-400 hover:text-gray-800'} transition-transform active:scale-90`}>
            <Home size={24} strokeWidth={2.5} fill={activeScreen === 'home' ? 'currentColor' : 'none'} />
          </button>
          <button onClick={() => onNavigate('leave_approval')} className={`${activeScreen === 'leave_approval' ? 'text-[#2563EB]' : 'text-gray-400 hover:text-gray-800'} transition-colors active:scale-90 relative`}>
            <CalendarCheck size={24} strokeWidth={activeScreen === 'leave_approval' ? 2.5 : 2} />
            {pendingCount > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white shadow-sm"></span>}
          </button>
          <button onClick={() => onNavigate('schedule_editor')} className={`${activeScreen === 'schedule_editor' ? 'text-[#2563EB]' : 'text-gray-400 hover:text-gray-800'} transition-colors active:scale-90 relative`}>
            <CalendarIcon size={24} strokeWidth={activeScreen === 'schedule_editor' ? 2.5 : 2} />
          </button>
          <button onClick={() => onNavigate('employee_management')} className={`${activeScreen === 'employee_management' ? 'text-[#2563EB]' : 'text-gray-400 hover:text-gray-800'} transition-colors active:scale-90`}>
            <User size={24} strokeWidth={activeScreen === 'employee_management' ? 2.5 : 2} />
          </button>
          <button onClick={() => onNavigate('backend_settings')} className={`${activeScreen === 'backend_settings' ? 'text-[#2563EB]' : 'text-gray-400 hover:text-gray-800'} transition-colors active:scale-90 relative`}>
            <Settings size={24} strokeWidth={activeScreen === 'backend_settings' ? 2.5 : 2} />
          </button>
        </>
      ) : (
        <div className="w-full flex justify-around items-center">
           <button onClick={() => onNavigate('leave_request')} className={`${activeScreen === 'leave_request' ? 'text-[#2563EB]' : 'text-gray-400 hover:text-gray-800'} transition-colors active:scale-90 flex flex-col items-center gap-1`}>
              <Home size={24} strokeWidth={activeScreen === 'leave_request' ? 2.5 : 2} fill={activeScreen === 'leave_request' ? 'currentColor' : 'none'} />
              <span className="text-[10px] font-bold">排休</span>
           </button>
           <button onClick={() => onNavigate('employee_profile')} className={`${activeScreen === 'employee_profile' ? 'text-[#2563EB]' : 'text-gray-400 hover:text-gray-800'} transition-colors active:scale-90 flex flex-col items-center gap-1`}>
              <User size={24} strokeWidth={activeScreen === 'employee_profile' ? 2.5 : 2} />
              <span className="text-[10px] font-bold">我的</span>
           </button>
        </div>
      )}
    </nav>
  );
}

function EmployeeEditCard({ user, allUsers, userLeaves, leaveSettings, onUpdate, onDelete, onAddLeave, onRemoveLeave }) {
  const [localName, setLocalName] = useState(user.name);
  const [localShift, setLocalShift] = useState(user.role ? user.role.substring(0, 2) : '早班');
  const [localPosition, setLocalPosition] = useState(user.role ? user.role.substring(2) : '正職');
  const [localPassword, setLocalPassword] = useState(user.password);
  const [pwdError, setPwdError] = useState('');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  
  const [newLeaveMonth, setNewLeaveMonth] = useState('');
  const [newLeaveDay, setNewLeaveDay] = useState('');
  const [leaveToDelete, setLeaveToDelete] = useState(null); // 防呆刪除假單

  const localRole = `${localShift}${localPosition}`;
  const maxTotalLeaves = leaveSettings?.total || 8;
  const defaultYear = leaveSettings?.year || 2026;

  const handleBlur = () => {
    if (!/^\d{6}$/.test(localPassword)) {
      setPwdError('需為6位數字');
      setLocalPassword(user.password);
      return;
    }
    if (allUsers.some((u) => u.password === localPassword && u.id !== user.id)) {
      setPwdError('密碼已重複');
      setLocalPassword(user.password);
      return;
    }
    setPwdError('');

    if (localName.trim() && (localName !== user.name || localRole !== user.role || localPassword !== user.password)) {
      onUpdate(user.id, localName.trim(), localRole, localPassword);
    } else {
      setLocalName(user.name);
    }
  };

  const handleShiftChange = (e) => {
    const newShift = e.target.value;
    setLocalShift(newShift);
    onUpdate(user.id, localName.trim(), `${newShift}${localPosition}`, localPassword);
  };

  const handlePositionChange = (e) => {
    const newPos = e.target.value;
    setLocalPosition(newPos);
    onUpdate(user.id, localName.trim(), `${localShift}${newPos}`, localPassword);
  };

  return (
    <div className="bg-white rounded-[1.5rem] p-4 shadow-[0_4px_15px_rgb(0,0,0,0.03)] border border-gray-50 flex flex-col gap-3 transition-shadow hover:shadow-md relative overflow-hidden">
      {/* 刪除員工防呆 */}
      {showConfirmDelete && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-20 rounded-[1.5rem] flex flex-col items-center justify-center p-4">
           <p className="text-sm font-bold text-red-600 mb-4">確定刪除 {localName} 嗎？此操作不可逆。</p>
           <div className="flex gap-3 w-full">
             <button onClick={() => setShowConfirmDelete(false)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm">取消</button>
             <button onClick={() => onDelete(user.id)} className="flex-1 py-2 bg-red-50 text-white rounded-xl font-bold text-sm shadow-md">確定刪除</button>
           </div>
        </div>
      )}

      {/* 刪除假單防呆 */}
      {leaveToDelete && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-30 rounded-[1.5rem] flex flex-col items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
           <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 mb-2 shadow-inner"><AlertCircle size={24} /></div>
           <p className="text-sm font-bold text-gray-800 mb-1">確定移除此假單？</p>
           <p className="text-xs font-black text-orange-600 mb-4 bg-orange-100 border border-orange-200 px-3 py-1 rounded-lg">{leaveToDelete}</p>
           <div className="flex gap-3 w-full">
             <button onClick={() => setLeaveToDelete(null)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors">取消</button>
             <button onClick={() => { onRemoveLeave(user.name, leaveToDelete); setLeaveToDelete(null); }} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-bold text-sm shadow-md hover:bg-red-600 transition-colors active:scale-95">確定移除</button>
           </div>
        </div>
      )}

      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3 flex-1">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${localRole.includes('兼職') ? 'bg-orange-500' : 'bg-[#111]'}`}>
            {localName.charAt(0)}
          </div>
          <div className="flex-1">
            <input type="text" value={localName} onChange={(e) => setLocalName(e.target.value)} onBlur={handleBlur} className="w-full font-bold text-[#111] text-[15px] bg-transparent border-b border-transparent hover:border-gray-200 focus:border-blue-500 focus:outline-none transition-colors pb-1" placeholder="員工名稱" />
          </div>
        </div>
        <button onClick={() => setShowConfirmDelete(true)} className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors shrink-0 ml-2" title="刪除員工">
           <Trash2 size={14} />
        </button>
      </div>

      <div className="bg-gray-50 rounded-xl p-2.5 flex items-center justify-between border border-gray-100 mt-1 relative z-10">
        <span className="text-xs font-bold text-gray-500 flex items-center gap-1.5 ml-1"><Briefcase size={12} /> 身分綁定</span>
        <div className="flex gap-1.5">
          <select value={localShift} onChange={handleShiftChange} className={`appearance-none font-bold text-xs py-1.5 pl-2 pr-6 rounded-lg border focus:outline-none focus:ring-2 cursor-pointer shadow-sm relative z-10 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%232563EB%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.4-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[length:8px_8px] bg-[right_8px_center] ${localRole.includes('兼職') ? 'bg-orange-50 text-orange-600 border-orange-100 focus:ring-orange-500' : 'bg-blue-50 text-blue-600 border-blue-100 focus:ring-blue-500'}`}>
            <option value="早班">早班</option>
            <option value="晚班">晚班</option>
          </select>
          <select value={localPosition} onChange={handlePositionChange} className={`appearance-none font-bold text-xs py-1.5 pl-2 pr-6 rounded-lg border focus:outline-none focus:ring-2 cursor-pointer shadow-sm relative z-10 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%232563EB%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.4-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[length:8px_8px] bg-[right_8px_center] ${localRole.includes('兼職') ? 'bg-orange-50 text-orange-600 border-orange-100 focus:ring-orange-500' : 'bg-blue-50 text-blue-600 border-blue-100 focus:ring-blue-500'}`}>
            <option value="兼職">兼職</option>
            <option value="正職">正職</option>
            <option value="儲備幹部">儲備幹部</option>
            <option value="組長">組長</option>
            <option value="副店長">副店長</option>
            <option value="店長">店長</option>
          </select>
        </div>
      </div>
      <div className="bg-gray-50 rounded-xl p-2.5 flex items-center justify-between border border-gray-100 relative z-10">
        <span className="text-xs font-bold text-gray-500 flex items-center gap-1.5 ml-1"><Lock size={12} /> 登入密碼</span>
        <div className="flex items-center gap-2">
          {pwdError && <span className="text-[10px] text-red-500 font-bold animate-pulse">{pwdError}</span>}
          <input type="text" maxLength={6} value={localPassword} onChange={(e) => setLocalPassword(e.target.value.replace(/\D/g, ''))} onBlur={handleBlur} placeholder="6位數字" className={`w-20 font-bold text-xs py-1.5 px-2 rounded-lg border focus:outline-none focus:ring-2 text-center shadow-sm transition-colors ${pwdError ? 'bg-red-50 border-red-300 text-red-600 focus:ring-red-500' : 'bg-white border-blue-100 text-blue-600 focus:ring-blue-500'}`} />
        </div>
      </div>
      
      <div className="bg-gray-50 rounded-xl p-3 flex flex-col gap-3 border border-gray-100 relative z-10">
        <div className="flex items-center justify-between ml-1">
          <span className="text-xs font-bold text-gray-500 flex items-center gap-1.5">
            <CalendarIcon size={12} /> 排休狀況 ({userLeaves.length}/{maxTotalLeaves})
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-400 font-bold">補假</span>
            <input type="text" maxLength={2} value={newLeaveMonth} onChange={e => setNewLeaveMonth(e.target.value.replace(/\D/g, ''))} className="w-7 bg-white border border-gray-200 rounded px-1 py-0.5 text-xs outline-none focus:border-blue-500 text-center font-bold shadow-sm" placeholder="月" />
            <span className="text-[10px] text-gray-400 font-bold">/</span>
            <input type="text" maxLength={2} value={newLeaveDay} onChange={e => setNewLeaveDay(e.target.value.replace(/\D/g, ''))} className="w-7 bg-white border border-gray-200 rounded px-1 py-0.5 text-xs outline-none focus:border-blue-500 text-center font-bold shadow-sm" placeholder="日" />
            <button onClick={() => { if(newLeaveMonth && newLeaveDay) { onAddLeave(user.name, `${defaultYear}/${newLeaveMonth}/${newLeaveDay}`); setNewLeaveMonth(''); setNewLeaveDay(''); } }} className="bg-[#111] text-white rounded p-0.5 shadow-sm active:scale-90 transition-transform"><Plus size={12}/></button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {userLeaves.length > 0 ? (
            userLeaves.map((l) => {
              const [y, m, d] = l.date.split('/');
              const displayDate = `${m}/${d}`;
              return (
                <span key={l.date} className={`relative group flex items-center gap-1 text-[10px] pl-2 pr-1.5 py-1 rounded-md font-bold shadow-[0_1px_2px_rgba(0,0,0,0.05)] ${l.status === 'pending' ? 'bg-orange-100 text-orange-600 border border-orange-200' : 'bg-green-100 text-green-600 border border-green-200'}`}>
                  {displayDate} {l.status === 'pending' ? '(待核)' : ''}
                  <button onClick={() => setLeaveToDelete(l.date)} className="bg-white/50 hover:bg-red-500 hover:text-white text-gray-400 rounded-full p-0.5 transition-colors" title="移除此假單">
                    <X size={10} strokeWidth={3} />
                  </button>
                </span>
              );
            })
          ) : (
            <span className="text-[10px] text-gray-400 font-medium px-1">尚未排假</span>
          )}
        </div>
      </div>
    </div>
  );
}

function LoginScreen({ onLogin, onGoRegister, registeredUsers }) {
  const [isManagerMode, setIsManagerMode] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');
    if (isManagerMode) {
      if (password === '0204') onLogin('主管', 'manager');
      else setError('主管密碼錯誤');
      return;
    }
    if (!password) { setError('請輸入密碼'); return; }
    const user = registeredUsers.find((u) => u.password === password);
    if (!user) { setError('密碼錯誤或尚未註冊'); return; }
    onLogin(user.name, 'employee');
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 bg-white animate-in fade-in duration-300">
      <div className="flex flex-col items-center mb-10 cursor-pointer hover:scale-105 transition-transform" onClick={() => { setIsManagerMode(!isManagerMode); setError(''); setPassword(''); }}>
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg mb-4 ${isManagerMode ? 'bg-[#111] shadow-black/20' : 'bg-blue-600 shadow-blue-600/30'}`}>
          {isManagerMode ? <ShieldCheck size={32} className="text-white" /> : <CalendarIcon size={32} className="text-white" />}
        </div>
        <h1 className="text-2xl font-extrabold text-[#111] tracking-tight">{isManagerMode ? '管理員後台' : '線上排班系統'}</h1>
        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">{isManagerMode ? 'Manager Access' : 'Employee Portal'}</p>
      </div>
      <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
        {error && <div className="bg-red-50 text-red-500 text-sm font-bold p-3 rounded-xl flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">密碼</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isManagerMode ? '請輸入 4 位數管理密碼' : '請輸入 6 位數員工密碼'} className="w-full bg-gray-50 text-gray-800 font-medium py-3.5 pl-11 pr-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all border border-transparent focus:border-blue-100" />
          </div>
        </div>
        <button type="submit" className={`w-full py-4 rounded-2xl text-white font-bold shadow-lg mt-4 active:scale-[0.98] transition-all ${isManagerMode ? 'bg-[#111] shadow-black/20 hover:bg-gray-800' : 'bg-blue-600 shadow-blue-600/30 hover:bg-blue-700'}`}>
          {isManagerMode ? '進入後台' : '登入系統'}
        </button>
      </form>
      {!isManagerMode && (
        <div className="mt-8 text-sm font-medium text-gray-500">新進員工？ <button onClick={onGoRegister} className="text-blue-600 font-bold hover:underline">點此註冊個人資料</button></div>
      )}
    </div>
  );
}

function RegisterScreen({ onGoLogin, onRegister }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [shift, setShift] = useState('早班');
  const [position, setPosition] = useState('兼職');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleRegister = (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('姓氏/姓名為必填欄位'); return; }
    if (!/^\d{6}$/.test(password)) { setError('註冊密碼必須為 6 位數字'); return; }
    if (password !== confirmPassword) { setError('兩次輸入的密碼不一致'); return; }
    
    const finalRole = `${shift}${position}`;
    const result = onRegister(name.trim(), password, finalRole);
    if (!result.success) {
      setError(result.message);
      return;
    }

    setSuccess(true);
    setTimeout(() => { onGoLogin(); }, 2000);
  };

  if (success) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 bg-white animate-in fade-in duration-300">
        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center text-green-500 mb-6"><CheckCircle size={40} /></div>
        <h2 className="text-2xl font-bold text-[#111] mb-2">註冊成功！</h2>
        <p className="text-gray-500 font-medium text-center">正在為您跳轉至登入畫面...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col px-8 pt-12 bg-white animate-in slide-in-from-right-8 duration-300 overflow-y-auto pb-12">
      <button onClick={onGoLogin} className="w-10 h-10 bg-gray-50 hover:bg-gray-100 rounded-full flex items-center justify-center text-gray-800 transition mb-8"><ChevronLeft size={24} /></button>
      <h1 className="text-3xl font-extrabold text-[#111] tracking-tight mb-2">員工註冊</h1>
      <p className="text-sm font-medium text-gray-500 mb-8">請建立您的個人資料以便進行線上排班與排休。</p>
      <form onSubmit={handleRegister} className="w-full space-y-5">
        {error && <div className="bg-red-50 text-red-500 text-sm font-bold p-3 rounded-xl flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">姓氏 / 姓名 <span className="text-red-500">*</span></label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：王小明" className="w-full bg-gray-50 text-gray-800 font-medium py-3.5 px-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all border border-transparent focus:border-blue-100" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">班別 <span className="text-red-500">*</span></label>
            <select value={shift} onChange={(e) => setShift(e.target.value)} className="w-full bg-gray-50 text-gray-800 font-medium py-3.5 px-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all border border-transparent focus:border-blue-100 cursor-pointer">
              <option value="早班">早班</option>
              <option value="晚班">晚班</option>
            </select>
          </div>
          <div>
             <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">職位 <span className="text-red-500">*</span></label>
            <select value={position} onChange={(e) => setPosition(e.target.value)} className="w-full bg-gray-50 text-gray-800 font-medium py-3.5 px-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all border border-transparent focus:border-blue-100 cursor-pointer">
              <option value="兼職">兼職</option>
              <option value="正職">正職</option>
              <option value="儲備幹部">儲備幹部</option>
              <option value="組長">組長</option>
              <option value="副店長">副店長</option>
              <option value="店長">店長</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">設定密碼 <span className="text-red-500">*</span></label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="請輸入 6 位數字" maxLength={6} className="w-full bg-gray-50 text-gray-800 font-medium py-3.5 px-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all border border-transparent focus:border-blue-100" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">確認密碼 <span className="text-red-500">*</span></label>
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="請再次輸入 6 位數字密碼" maxLength={6} className="w-full bg-gray-50 text-gray-800 font-medium py-3.5 px-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all border border-transparent focus:border-blue-100" />
         </div>
        <button type="submit" className="w-full py-4 rounded-2xl bg-[#111] text-white font-bold shadow-lg shadow-black/10 hover:bg-gray-800 mt-6 active:scale-[0.98] transition-all">完成註冊</button>
      </form>
    </div>
  );
}

function HomeScreen({ role, currentUser, onLogout, shifts, timeBlockDemands, registeredUsers, employeeLeaves, leaveSettings, onApproveLeave, onRejectLeave, onOpenEditor, onOpenLeaveApproval }) {
  const [viewYear, setViewYear] = useState(leaveSettings?.year || 2026);
  const [viewMonth, setViewMonth] = useState(leaveSettings?.month || 3);
  
  useEffect(() => {
    setViewYear(leaveSettings?.year || 2026);
    setViewMonth(leaveSettings?.month || 3);
  }, [leaveSettings?.year, leaveSettings?.month]);

  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const viewDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const [selectedHomeDate, setSelectedHomeDate] = useState(`${leaveSettings?.year || 2026}/${leaveSettings?.month || 3}/1`);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  useEffect(() => {
    setSelectedHomeDate(`${viewYear}/${viewMonth}/1`);
  }, [viewYear, viewMonth]);

  const handlePrevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(v => v - 1); }
    else setViewMonth(v => v - 1);
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(v => v + 1); }
    else setViewMonth(v => v + 1);
  };

  const getUserTypeBadge = (name) => {
    const u = registeredUsers.find((user) => user.name === name);
    if (!u) return null;
    return u.role.includes('兼職') ? (
      <span className="bg-orange-100 text-orange-600 text-[9px] px-1.5 py-0.5 rounded font-black ml-1 shrink-0">兼</span>
    ) : (
      <span className="bg-blue-100 text-blue-600 text-[9px] px-1.5 py-0.5 rounded font-black ml-1 shrink-0">正</span>
    );
  };

  const displayShifts = role === 'manager' ? shifts : shifts.filter((s) => s.assignee === currentUser);

  const pendingLeaves = [];
  if (role === 'manager') {
    Object.entries(employeeLeaves).forEach(([emp, leaves]) => {
      leaves.filter(l => l.status === 'pending').forEach(l => {
        pendingLeaves.push({ emp, date: l.date });
      });
    });
  }

  const leavesOnSelectedDate = Object.entries(employeeLeaves).reduce((acc, [emp, leaves]) => {
    const leave = leaves.find(l => l.date === selectedHomeDate);
    if (leave) acc.push({ emp, status: leave.status });
    return acc;
  }, []);

  const getShiftCategoryCountsForDate = (dateStr) => {
    const dayShifts = displayShifts.filter((s) => s.date === dateStr);
    let counts = { morning: 0, night: 0, stay: 0 };
    dayShifts.forEach((s) => {
      const cat = s.shiftCategory || (s.type.includes('晚') ? '晚班' : (s.type.includes('留守') ? '留守' : '早班'));
      if (cat === '早班') counts.morning++;
      else if (cat === '晚班') counts.night++;
      else if (cat === '留守') counts.stay++;
    });
    return counts;
  };

  const catCounts = getShiftCategoryCountsForDate(selectedHomeDate);

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar pb-32 animate-in fade-in duration-300 relative">
      <header className="flex flex-col px-8 pt-12 pb-4">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm ${role === 'manager' ? 'bg-[#111]' : 'bg-blue-600'}`}>{currentUser ? currentUser.charAt(0) : '無'}</div>
            <div>
              <h2 className="text-sm font-extrabold text-[#111] tracking-tight">{currentUser || '未登入'}</h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{role === 'manager' ? '管理員' : '員工'}</p>
            </div>
          </div>
          <button onClick={onLogout} className="w-10 h-10 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full flex items-center justify-center transition" title="登出"><LogOut size={18} strokeWidth={2.5} /></button>
        </div>
      </header>

      {role === 'manager' && pendingLeaves.length > 0 && (
        <div className="mx-8 mt-1 mb-5 bg-orange-50 border border-orange-200 p-4 rounded-2xl flex justify-between items-center shadow-sm animate-in slide-in-from-top-4">
          <div className="flex items-center gap-2">
            <Bell size={20} className="text-orange-500 animate-bounce" />
            <div>
              <h3 className="text-orange-800 font-bold text-sm">待審核假單 ({pendingLeaves.length})</h3>
              <p className="text-orange-600 text-[10px] font-bold">員工排休衝突預警</p>
            </div>
          </div>
          <button onClick={() => setShowApprovalModal(true)} className="bg-orange-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-md hover:bg-orange-600 transition-colors">立即審核</button>
        </div>
      )}

      <section className={`${role === 'manager' ? 'mt-6' : 'mt-2'} bg-white rounded-t-[2.5rem] pt-8 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.02)] min-h-[400px]`}>
        <div className="px-8 flex justify-between items-end mb-6">
          <div>
            <h2 className="text-2xl font-extrabold text-[#111] tracking-tight">{viewMonth}月份</h2>
            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mt-1">{viewYear}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handlePrevMonth} className="w-8 h-8 flex items-center justify-center bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-full transition"><ChevronLeft size={16} strokeWidth={2.5} /></button>
            <button onClick={handleNextMonth} className="w-8 h-8 flex items-center justify-center bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-full transition"><ChevronRight size={16} strokeWidth={2.5} /></button>
          </div>
        </div>

        <div className="px-8 mb-8">
          <div className="grid grid-cols-7 gap-x-2 gap-y-3">
            {['日', '一', '二', '三', '四', '五', '六'].map((d) => (
              <div key={d} className="text-center text-[10px] font-bold text-gray-400 mb-1">{d}</div>
            ))}
            {viewDays.map((day) => {
              const dateStr = `${viewYear}/${viewMonth}/${day}`;
              const info = getDayInfo(viewYear, viewMonth, day);
              const hasShift = displayShifts.some((s) => s.date === dateStr);
              const isSelected = selectedHomeDate === dateStr;
              const isUnderstaffed = role === 'manager' ? isDayUnderstaffed(dateStr, info.isOffDay, shifts, timeBlockDemands) : false;

              const myLeaves = role !== 'manager' ? employeeLeaves[currentUser] || [] : [];
              const myLeaveToday = myLeaves.find(l => l.date === dateStr);

              let btnClass = 'bg-transparent text-gray-600 hover:bg-gray-50';
              if (isSelected) btnClass = 'bg-[#111] text-white shadow-lg transform scale-110 z-10';
              else if (myLeaveToday) btnClass = myLeaveToday.status === 'pending' ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-green-50 text-green-600 border border-green-100';
              else if (hasShift) btnClass = 'bg-blue-50/50 text-blue-700 hover:bg-blue-100 font-bold';
              else if (isUnderstaffed) btnClass = 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100';
              else if (info.isOffDay) btnClass = 'bg-red-50/30 text-red-500';

              return (
                <button key={day} onClick={() => setSelectedHomeDate(dateStr)} className={`relative w-full aspect-square rounded-2xl flex flex-col items-center justify-center transition-all duration-200 ${btnClass}`}>
                  <span className={`text-[15px] font-bold ${isSelected ? 'text-white' : (info.isHoliday ? 'text-red-600' : (info.isWeekend ? 'text-orange-500' : 'text-gray-700'))}`}>{day}</span>
                  {info.isHoliday && <span className="absolute top-1 right-1 text-[8px] text-red-500 font-black tracking-tighter leading-none">{info.holidayName.substring(0,2)}</span>}
                  {isUnderstaffed && !myLeaveToday && <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full shadow-sm border-2 border-white z-20"></div>}
                  {!isUnderstaffed && hasShift && !isSelected && !myLeaveToday && <div className="absolute bottom-1.5 w-1 h-1 rounded-full bg-blue-500"></div>}
                  {hasShift && isSelected && !myLeaveToday && <div className="absolute bottom-1.5 w-1 h-1 rounded-full bg-white shadow-sm"></div>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-8">
          <div className="flex items-center gap-2 mb-6 border-b border-gray-100 pb-2">
            <h3 className="text-sm font-bold text-[#111] tracking-wide">{selectedHomeDate.split('/')[1]}/{selectedHomeDate.split('/')[2]} <span className="text-gray-400 font-medium">當日時段班表</span></h3>
            {getDayInfo(viewYear, viewMonth, parseInt(selectedHomeDate.split('/')[2])).isHoliday && (
               <span className="text-[10px] font-black text-red-500 bg-red-50 px-2 py-0.5 rounded-md border border-red-100 ml-2">
                 {getDayInfo(viewYear, viewMonth, parseInt(selectedHomeDate.split('/')[2])).holidayName}
               </span>
            )}
          </div>

          {role === 'manager' && (
            <div className="mb-6 grid grid-cols-3 gap-3">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex flex-col items-center justify-center shadow-sm transition-transform hover:scale-105">
                <span className="text-xs font-bold text-blue-800 mb-1">早班</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-blue-600 leading-none">{catCounts.morning}</span>
                  <span className="text-xs font-bold text-blue-500">人</span>
                </div>
              </div>
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex flex-col items-center justify-center shadow-sm transition-transform hover:scale-105">
                <span className="text-xs font-bold text-indigo-800 mb-1">晚班</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-indigo-600 leading-none">{catCounts.night}</span>
                  <span className="text-xs font-bold text-indigo-500">人</span>
                </div>
              </div>
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 flex flex-col items-center justify-center shadow-sm transition-transform hover:scale-105">
                <span className="text-xs font-bold text-orange-800 mb-1">留守</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-orange-600 leading-none">{catCounts.stay}</span>
                  <span className="text-xs font-bold text-orange-500">人</span>
                </div>
              </div>
            </div>
          )}

          {leavesOnSelectedDate.length > 0 && (
            <div className="mb-6 bg-green-50/60 border border-green-100 p-3 rounded-2xl flex flex-wrap items-center gap-2 shadow-sm">
              <Briefcase size={16} className="text-green-600 shrink-0" />
              <span className="text-green-800 text-xs font-bold mr-1">今日排休：</span>
              {leavesOnSelectedDate.map((l) => (
                <span key={l.emp} className={`text-[10px] px-2 py-1 rounded-lg font-bold shadow-sm ${l.status === 'pending' ? 'bg-orange-100 text-orange-600 border border-orange-200' : 'bg-green-100 text-green-700 border border-green-200'}`}>
                  {l.emp} {l.status === 'pending' ? '(待核)' : ''}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-4">
            {(() => {
              const shiftsForDate = displayShifts.filter((s) => s.date === selectedHomeDate);

              if (shiftsForDate.length === 0) {
                return (
                  <div className="text-center py-10 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                    <Coffee size={32} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-400 font-bold text-sm">本日無排定班表</p>
                  </div>
                );
              }

              const categories = [
                { id: '早班', title: '早班時段', icon: <Clock size={18} strokeWidth={2.5} />, bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-800', badgeBg: 'bg-blue-200/50', badgeText: 'text-blue-800' },
                { id: '晚班', title: '晚班時段', icon: <Clock size={18} strokeWidth={2.5} />, bg: 'bg-indigo-50', border: 'border-indigo-100', text: 'text-indigo-800', badgeBg: 'bg-indigo-200/50', badgeText: 'text-indigo-800' },
                { id: '留守', title: '留守時段', icon: <ShieldCheck size={18} strokeWidth={2.5} />, bg: 'bg-orange-50', border: 'border-orange-100', text: 'text-orange-800', badgeBg: 'bg-orange-200/50', badgeText: 'text-orange-800' }
              ];

              return categories.map(cat => {
                const catShifts = shiftsForDate.filter(s => {
                  const sCat = s.shiftCategory || (s.type.includes('晚') ? '晚班' : (s.type.includes('留守') ? '留守' : '早班'));
                  return sCat === cat.id;
                });

                const roles = {};
                catShifts.forEach(s => {
                  if (!roles[s.type]) roles[s.type] = [];
                  roles[s.type].push(s);
                });

                if (catShifts.length === 0) return null;

                return (
                  <div key={cat.id} className={`${cat.bg} border ${cat.border} rounded-[1.5rem] p-4 shadow-[0_4px_15px_rgba(0,0,0,0.02)] transition-transform`}>
                    <div className={`flex items-center gap-2 mb-3 ${cat.text}`}>
                      {cat.icon}
                      <h4 className="font-extrabold text-[15px] tracking-wide">{cat.title}</h4>
                      <span className={`ml-auto text-[11px] font-bold px-2.5 py-0.5 rounded-lg ${cat.badgeBg} ${cat.badgeText}`}>
                        共 {catShifts.length} 人
                      </span>
                    </div>

                    <div className="flex flex-col gap-2.5">
                      {Object.keys(roles).map(roleName => (
                        <div key={roleName} className="bg-white rounded-xl p-3 border border-white shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                          <span className="text-[11px] font-bold text-gray-400 mb-2 block border-b border-gray-50 pb-1.5 flex items-center gap-1.5">
                            <Briefcase size={12}/> {roleName}
                          </span>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {roles[roleName].map(shift => (
                              <div key={shift.id} className="flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 transition-colors px-3 py-1.5 rounded-xl border border-gray-100">
                                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-white text-gray-500 shadow-sm">
                                  <User size={12} strokeWidth={2.5} />
                                </div>
                                <span className="text-sm font-extrabold text-gray-800">{shift.assignee}</span>
                                {getUserTypeBadge(shift.assignee)}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </section>

      {showApprovalModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowApprovalModal(false)}></div>
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm relative z-10 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-orange-500"><AlertCircle size={24} /></div>
              <div>
                <h3 className="text-xl font-bold text-[#111]">審核請假申請</h3>
                <p className="text-xs text-gray-500 font-bold mt-0.5">請確認人手是否充足</p>
              </div>
             </div>
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
              {pendingLeaves.map((p, idx) => (
                <div key={idx} className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-gray-800">{p.emp}</span>
                      <span className="text-[10px] text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded font-bold">待審核</span>
                    </div>
                   <span className="text-xs text-gray-500 font-bold flex items-center gap-1"><CalendarIcon size={12} /> {p.date.split('/')[1]}/{p.date.split('/')[2]} 申請休假</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => onApproveLeave(p.emp, p.date)} className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-100 transition shadow-sm"><CheckCircle size={18} strokeWidth={2.5} /></button>
                     <button onClick={() => onRejectLeave(p.emp, p.date)} className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition shadow-sm"><XCircle size={18} strokeWidth={2.5} /></button>
                  </div>
                </div>
              ))}
              {pendingLeaves.length === 0 && <div className="text-center py-6 text-gray-400 font-bold text-sm">目前沒有待審核的假單！</div>}
             </div>
            <button onClick={() => setShowApprovalModal(false)} className="mt-6 w-full py-3.5 rounded-2xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors">完成並關閉</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ScheduleEditorScreen({ shifts, registeredUsers, employeeLeaves, timeBlockDemands, onAddShift, onRemoveShift, onAutoSchedule, onBack, ruleEnabled, leaveSettings, announcement, onNavigate }) {
  const [viewYear, setViewYear] = useState(leaveSettings?.year || 2026);
  const [viewMonth, setViewMonth] = useState(leaveSettings?.month || 3);
  
  useEffect(() => {
    setViewYear(leaveSettings?.year || 2026);
    setViewMonth(leaveSettings?.month || 3);
  }, [leaveSettings?.year, leaveSettings?.month]);

  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const viewDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const [selectedDate, setSelectedDate] = useState(`${leaveSettings?.year || 2026}/${leaveSettings?.month || 3}/1`);
  const [activeTab, setActiveTab] = useState('早班'); 
  const [showToast, setShowToast] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setSelectedDate(`${viewYear}/${viewMonth}/1`);
  }, [viewYear, viewMonth]);

  const handlePrevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(v => v - 1); }
    else setViewMonth(v => v - 1);
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(v => v + 1); }
    else setViewMonth(v => v + 1);
  };

  const dayShifts = shifts.filter((s) => s.date === selectedDate);

  const getTabCount = (tabName) => {
    return dayShifts.filter((s) => {
      if (s.shiftCategory) return s.shiftCategory === tabName;
      if (tabName === '早班') return s.type.includes('早班');
      if (tabName === '晚班') return s.type.includes('晚班');
      if (tabName === '留守') return s.type.includes('留守');
      return false;
    }).length;
  };

  const assignedShifts = dayShifts.filter((s) => {
    if (s.shiftCategory) return s.shiftCategory === activeTab;
    if (activeTab === '早班') return s.type.includes('早班');
    if (activeTab === '晚班') return s.type.includes('晚班');
    if (activeTab === '留守') return s.type.includes('留守');
    return false;
  });

  const usersOnLeave = registeredUsers.filter(u => {
    return (employeeLeaves[u.name] || []).some(l => l.date === selectedDate);
  });
  const usersOnLeaveNames = usersOnLeave.map(u => u.name);

  const availableUsers = registeredUsers.filter((u) => {
    if (dayShifts.some((s) => s.assignee === u.name)) return false;
    if (usersOnLeaveNames.includes(u.name)) return false;
    if (activeTab === '早班') return u.role.includes('早班');
    if (activeTab === '晚班') return u.role.includes('晚班');
    return true; 
  });

  const hasPendingLeaves = Object.values(employeeLeaves).some((leaves) =>
    leaves.some((l) => l.status === 'pending')
  );

  const handleMagicClick = () => {
    if (hasPendingLeaves) {
      setErrorMsg('請先至首頁審核所有待處理的假單！');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }
    onAutoSchedule();
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3500);
  };

  const groupedAssignedShifts = {};
  assignedShifts.forEach(s => {
    if (!groupedAssignedShifts[s.type]) groupedAssignedShifts[s.type] = [];
    groupedAssignedShifts[s.type].push(s);
  });

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar bg-[#f5f6f8] pb-32 animate-in slide-in-from-right-8 duration-300 relative">
      <header className="sticky top-0 bg-[#f5f6f8]/90 backdrop-blur-md z-10 flex items-center px-8 pt-12 pb-4 border-b border-gray-200/50">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-800 hover:bg-gray-200 rounded-full transition mr-4"><ChevronLeft size={28} strokeWidth={2} /></button>
        <div>
          <h1 className="text-2xl font-extrabold text-[#111] tracking-tight">自動與手動排班</h1>
          <p className="text-xs font-semibold text-gray-500 mt-0.5">執行一鍵優化或手動分配人員</p>
        </div>
      </header>

      <div className="px-8 mt-6">
        <button onClick={handleMagicClick} className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-95 transition-all">
          <Wand2 size={20} className={showToast ? 'animate-spin' : ''} /> 執行一鍵排班與時段優化
        </button>
        {errorMsg && <p className="text-red-500 text-xs text-center mt-2 font-bold animate-pulse">{errorMsg}</p>}
        {showToast && <p className="text-green-600 text-xs text-center mt-2 font-bold">已自動產生全月班表並將人員調度至缺額時段！</p>}
      </div>

      <div className="bg-white mx-8 mt-6 rounded-[2rem] p-6 shadow-[0_8px_20px_rgb(0,0,0,0.03)] border border-gray-50">
        <div className="flex justify-between items-end mb-4">
          <div>
            <h2 className="text-lg font-extrabold text-[#111] tracking-tight">{viewMonth}月份班表</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{viewYear}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handlePrevMonth} className="w-7 h-7 flex items-center justify-center bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-full transition"><ChevronLeft size={14} strokeWidth={2.5} /></button>
            <button onClick={handleNextMonth} className="w-7 h-7 flex items-center justify-center bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-full transition"><ChevronRight size={14} strokeWidth={2.5} /></button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-x-2 gap-y-3">
          {['日', '一', '二', '三', '四', '五', '六'].map((d) => (
            <div key={d} className={`text-center text-[10px] font-bold mb-1 ${d === '日' || d === '六' ? 'text-orange-500' : 'text-gray-400'}`}>{d}</div>
          ))}
          {viewDays.map((day) => {
            const dateStr = `${viewYear}/${viewMonth}/${day}`;
            const info = getDayInfo(viewYear, viewMonth, day);
            const isSelected = selectedDate === dateStr;
            const hasShift = shifts.some((s) => s.date === dateStr);

            let btnClass = 'bg-gray-50 text-gray-600 hover:bg-gray-100';
            if (isSelected) btnClass = 'bg-[#111] text-white shadow-lg transform scale-110 z-10';
            else if (info.isOffDay) btnClass = 'bg-red-50/30 text-red-500';

            return (
              <button key={day} onClick={() => setSelectedDate(dateStr)} className={`relative w-full aspect-square rounded-xl flex items-center justify-center transition-all duration-200 font-bold text-sm ${btnClass}`}>
                <span className={`${isSelected ? 'text-white' : (info.isHoliday ? 'text-red-600' : (info.isWeekend ? 'text-orange-500' : 'text-gray-700'))}`}>{day}</span>
                {info.isHoliday && <span className="absolute top-1 right-1 text-[8px] text-red-500 font-black tracking-tighter leading-none">{info.holidayName.substring(0,2)}</span>}
                {hasShift && !isSelected && <div className="absolute bottom-1.5 w-1 h-1 rounded-full bg-blue-500"></div>}
                {hasShift && isSelected && <div className="absolute bottom-1.5 w-1 h-1 rounded-full bg-white shadow-sm"></div>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-8 mt-6">
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl shadow-sm relative group">
           <button onClick={() => onNavigate('backend_settings')} className="absolute top-2 right-2 p-1.5 text-blue-400 hover:bg-blue-100 hover:text-blue-600 rounded-full transition-colors" title="前往後台設定編輯">
             <Settings size={16} />
           </button>
           <p className="text-xs font-bold text-blue-800 leading-relaxed text-center px-4">
             {announcement.split('\n').map((line, i) => (
                <span key={i}>{line}<br /></span>
              ))}
           </p>
        </div>
      </div>

      <div className="px-8 mt-6">
        <div className="flex bg-gray-200/50 p-1.5 rounded-2xl">
          {['早班', '晚班', '留守'].map(tab => {
            const count = getTabCount(tab);
            return (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-1.5 ${activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}>
                {tab}
                <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${activeTab === tab ? 'bg-blue-50 text-blue-600' : 'bg-gray-300 text-gray-500'}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-8 mt-6 flex flex-col gap-4">
        <div className="bg-white p-5 rounded-[1.5rem] shadow-[0_4px_15px_rgb(0,0,0,0.03)] border border-gray-50">
          <div className="flex items-center justify-between border-b border-gray-50 pb-2 mb-4">
            <h3 className="text-xs font-bold text-gray-500 flex items-center gap-1.5">
              <CheckCircle size={14} className="text-blue-500"/> {activeTab} - 已排班人員
            </h3>
            {getDayInfo(viewYear, viewMonth, parseInt(selectedDate.split('/')[2])).isHoliday && (
               <span className="text-[10px] font-black text-red-500 bg-red-50 px-2 py-0.5 rounded-md border border-red-100">
                 {getDayInfo(viewYear, viewMonth, parseInt(selectedDate.split('/')[2])).holidayName}
               </span>
            )}
          </div>
          
          {Object.keys(groupedAssignedShifts).length > 0 ? (
            <div className="flex flex-col gap-4">
              {Object.keys(groupedAssignedShifts).map((roleName) => (
                <div key={roleName} className="flex flex-col gap-2.5">
                   <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400">
                     <Briefcase size={12}/> {roleName}
                     <div className="h-px bg-gray-100 flex-1 ml-2"></div>
                   </div>
                   <div className="flex flex-wrap gap-2.5">
                    {groupedAssignedShifts[roleName].map(s => {
                      const isPartTime = s.type.includes('兼職');
                      return (
                        <div key={s.id} className={`border px-3 py-2 rounded-xl flex items-center gap-2.5 shadow-sm animate-in zoom-in duration-200 transition-colors ${isPartTime ? 'bg-orange-50 border-orange-100 text-orange-800 hover:bg-orange-100' : 'bg-blue-50 border-blue-100 text-blue-800 hover:bg-blue-100'}`}>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-white shadow-sm border ${isPartTime ? 'text-orange-400 border-orange-100' : 'text-blue-400 border-blue-100'}`}>
                            <User size={14} strokeWidth={2.5} />
                          </div>
                          <div className="flex flex-col">
                            <span className={`text-[9px] font-bold leading-none mb-0.5 ${isPartTime ? 'text-orange-500' : 'text-blue-500'}`}>{s.type}</span>
                            <span className="text-sm font-black tracking-wide leading-none">{s.assignee}</span>
                          </div>
                          <button onClick={() => onRemoveShift(s.id)} className={`hover:scale-110 rounded-full p-1 transition-all ml-1 ${isPartTime ? 'text-orange-400 hover:text-orange-600 hover:bg-orange-200/50' : 'text-blue-400 hover:text-blue-600 hover:bg-blue-200/50'}`} title="移除人員">
                            <XCircle size={16} />
                          </button>
                        </div>
                      );
                    })}
                   </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="min-h-[80px] flex flex-col items-center justify-center gap-2">
               <Coffee size={24} className="text-gray-300" />
               <p className="text-sm text-gray-400 font-bold">目前無人安排在 {activeTab}</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 px-8">
        <h3 className="text-xs font-bold text-gray-400 mb-3 ml-1 flex items-center gap-1.5"><Plus size={14} className="text-gray-500"/> 點擊新增至 {activeTab}</h3>
        {availableUsers.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {availableUsers.map(u => (
              <button key={u.id} onClick={() => onAddShift(selectedDate, activeTab, u.name)} className="bg-white border border-gray-200 text-gray-700 hover:border-blue-500 hover:text-blue-600 px-3 py-2 rounded-xl flex items-center gap-2 shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all active:scale-95 group">
                <span className="font-bold text-sm">{u.name}</span>
                <span className="text-[10px] text-gray-500 group-hover:bg-blue-50 group-hover:text-blue-600 bg-gray-100 px-1.5 py-0.5 rounded font-bold transition-colors">{u.role}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 font-bold ml-1 bg-gray-100 px-4 py-3 rounded-xl border border-dashed border-gray-300 inline-block">無符合班別或可排班之人員</p>
        )}
      </div>
        
      {usersOnLeave.length > 0 && (
        <div className="px-8 mt-8 bg-orange-50/50 border border-orange-100 p-4 rounded-2xl mx-8">
          <h3 className="text-xs font-bold text-orange-600 mb-3 flex items-center gap-1.5"><AlertCircle size={14}/> 今日休假人員 (不可排班)</h3>
          <div className="flex flex-wrap gap-1.5">
            {usersOnLeave.map(u => (
              <span key={u.id} className="text-xs font-bold text-orange-800 bg-orange-100 px-2 py-1 rounded-lg border border-orange-200">{u.name}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LeaveApprovalScreen({ onBack, employeeLeaves, onApproveLeave, onRejectLeave, onApproveAll, onRejectAll }) {
  const pendingByDate = {};
  Object.entries(employeeLeaves).forEach(([emp, leaves]) => {
    leaves.filter(l => l.status === 'pending').forEach(l => {
      if (!pendingByDate[l.date]) pendingByDate[l.date] = [];
      pendingByDate[l.date].push(emp);
    });
  });

  const sortedDates = Object.keys(pendingByDate).sort((a, b) => {
    const [y1, m1, d1] = a.split('/').map(Number);
    const [y2, m2, d2] = b.split('/').map(Number);
    return new Date(y1, m1 - 1, d1) - new Date(y2, m2 - 1, d2);
  });

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar bg-[#f5f6f8] pb-32 animate-in slide-in-from-right-8 duration-300 relative">
      <header className="sticky top-0 bg-[#f5f6f8]/90 backdrop-blur-md z-10 flex items-center px-8 pt-12 pb-4 border-b border-gray-200/50">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-800 hover:bg-gray-200 rounded-full transition mr-4"><ChevronLeft size={28} strokeWidth={2} /></button>
        <div>
          <h1 className="text-2xl font-extrabold text-[#111] tracking-tight">假單審核</h1>
          <p className="text-xs font-semibold text-gray-500 mt-0.5">處理衝突與待核准的休假申請</p>
        </div>
      </header>

      <div className="px-8 mt-6">
        {sortedDates.length > 0 ? (
          <div className="space-y-5">
            {sortedDates.map((date) => {
              const emps = pendingByDate[date];
              const [y, m, d] = date.split('/');
              return (
                <div key={date} className="bg-white p-5 rounded-[1.5rem] shadow-[0_4px_15px_rgb(0,0,0,0.03)] border border-gray-100 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-200 overflow-hidden relative">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-400 rounded-l-[1.5rem]"></div>
                  
                  <div className="flex items-center justify-between border-b border-gray-50 pb-3 ml-2">
                    <div className="flex items-center gap-2">
                      <CalendarIcon size={18} className="text-orange-500" />
                      <span className="font-extrabold text-lg text-[#111]">{m}/{d}</span>
                      <span className="text-[10px] text-orange-700 bg-orange-50 px-2.5 py-1 rounded-lg font-bold border border-orange-100 ml-1">
                        共 {emps.length} 人申請
                      </span>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => onRejectAll(date)} className="text-[11px] font-bold text-red-500 bg-red-50 px-2.5 py-1.5 rounded-lg hover:bg-red-100 transition-colors active:scale-95 shadow-sm">全駁回</button>
                       <button onClick={() => onApproveAll(date)} className="text-[11px] font-bold text-white bg-[#111] px-2.5 py-1.5 rounded-lg hover:bg-gray-800 transition-colors active:scale-95 shadow-sm">全核准</button>
                    </div>
                  </div>

                  <div className="flex gap-3 overflow-x-auto no-scrollbar pt-1 pb-2 ml-2 -mr-5 pr-5">
                    {emps.map((emp) => (
                      <div key={emp} className="shrink-0 w-36 bg-gray-50 rounded-[1rem] p-3 border border-gray-100 flex flex-col gap-3 shadow-sm">
                        <span className="font-extrabold text-[14px] text-gray-800 text-center tracking-wide">{emp}</span>
                        <div className="flex gap-2">
                          <button onClick={() => onRejectLeave(emp, date)} className="flex-1 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center justify-center shadow-sm active:scale-95" title="駁回">
                            <XCircle size={16} />
                          </button>
                          <button onClick={() => onApproveLeave(emp, date)} className="flex-1 py-2 rounded-lg bg-[#111] text-white hover:bg-gray-800 transition-colors flex items-center justify-center shadow-sm active:scale-95" title="核准">
                            <CheckCircle size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[2rem] border border-gray-100 shadow-sm mt-4">
             <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center text-green-500 mb-4"><CheckCircle size={32} /></div>
             <p className="text-gray-500 font-bold text-sm">太棒了！目前沒有待審核的假單。</p>
          </div>
        )}
      </div>
    </div>
  );
}

function EmployeeManagementScreen({ onBack, registeredUsers, employeeLeaves, leaveSettings, onUpdateEmployee, onDeleteEmployee, onAddLeave, onRemoveLeave }) {
  const [filterShift, setFilterShift] = useState('全部');
  const [filterPosition, setFilterPosition] = useState('全部');

  const stats = [
    { id: 'total', label: '總人數', count: registeredUsers.length, bg: 'bg-[#111]', text: 'text-gray-300', shadow: 'shadow-black/10', icon: <Users size={48} />, span: 'col-span-2' },
    { id: 'morn_full', label: '早班正職', count: registeredUsers.filter(u => u.role === '早班正職').length, bg: 'bg-blue-500', text: 'text-blue-100', shadow: 'shadow-blue-500/20', icon: <ShieldCheck size={48} /> },
    { id: 'night_full', label: '晚班正職', count: registeredUsers.filter(u => u.role === '晚班正職').length, bg: 'bg-indigo-600', text: 'text-indigo-200', shadow: 'shadow-indigo-600/20', icon: <ShieldCheck size={48} /> },
    { id: 'morn_part', label: '早班兼職', count: registeredUsers.filter(u => u.role === '早班兼職').length, bg: 'bg-orange-500', text: 'text-orange-100', shadow: 'shadow-orange-500/20', icon: <Clock size={48} /> },
    { id: 'night_part', label: '晚班兼職', count: registeredUsers.filter(u => u.role === '晚班兼職').length, bg: 'bg-rose-500', text: 'text-rose-200', shadow: 'shadow-rose-500/20', icon: <Clock size={48} /> }
  ];

  const filteredUsers = registeredUsers.filter(user => {
    const matchShift = filterShift === '全部' || user.role.includes(filterShift);
    const matchPosition = filterPosition === '全部' || user.role.includes(filterPosition);
    return matchShift && matchPosition;
  });

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar bg-[#f5f6f8] pb-32 animate-in slide-in-from-bottom-8 duration-300 relative">
      <header className="sticky top-0 bg-[#f5f6f8]/90 backdrop-blur-md z-10 flex items-center px-8 pt-12 pb-4 border-b border-gray-200/50">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-800 hover:bg-gray-200 rounded-full transition mr-4"><ChevronLeft size={28} strokeWidth={2} /></button>
        <div>
          <h1 className="text-2xl font-extrabold text-[#111] tracking-tight">員工管理</h1>
          <p className="text-xs font-semibold text-gray-500 mt-0.5">管理員工身分綁定與名單</p>
        </div>
      </header>

      <div className="px-8 mt-6 mb-2">
        <div className="grid grid-cols-2 gap-3">
          {stats.map((s) => (
            <div key={s.id} className={`${s.bg} text-white rounded-2xl p-3 shadow-lg ${s.shadow} flex flex-col justify-between relative overflow-hidden min-h-[90px] ${s.span || ''}`}>
              <div className="absolute -right-3 -bottom-3 opacity-15 text-white pointer-events-none transform rotate-12">{s.icon}</div>
              <p className={`text-xs font-extrabold tracking-wider ${s.text} truncate max-w-full relative z-10`}>{s.label}</p>
              <div className="flex items-end gap-1 mt-auto relative z-10 pt-2">
                <span className="text-3xl font-black leading-none">{s.count}</span>
                <span className={`text-xs font-bold ${s.text} mb-0.5`}>人</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-8 mt-5 mb-2">
        <div className="bg-white rounded-[1.5rem] p-3.5 shadow-[0_4px_15px_rgb(0,0,0,0.03)] border border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-gray-600 font-extrabold text-sm pl-1 shrink-0">
            <Search size={18} className="text-blue-500" />
            <span>篩選名單</span>
          </div>
          <div className="flex items-center gap-2">
            <select value={filterShift} onChange={(e) => setFilterShift(e.target.value)} className="appearance-none bg-gray-50 text-gray-700 font-bold text-xs py-2 pl-3 pr-7 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%239CA3AF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.4-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[length:8px_8px] bg-[right_8px_center]">
              <option value="全部">所有班別</option>
              <option value="早班">早班</option>
              <option value="晚班">晚班</option>
            </select>
            <select value={filterPosition} onChange={(e) => setFilterPosition(e.target.value)} className="appearance-none bg-gray-50 text-gray-700 font-bold text-xs py-2 pl-3 pr-7 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%239CA3AF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.4-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[length:8px_8px] bg-[right_8px_center]">
              <option value="全部">所有職位</option>
              <option value="兼職">兼職</option>
              <option value="正職">正職</option>
              <option value="儲備幹部">儲備幹部</option>
              <option value="組長">組長</option>
              <option value="副店長">副店長</option>
              <option value="店長">店長</option>
            </select>
          </div>
        </div>
      </div>

      <div className="px-8 mt-4 space-y-4">
        {filteredUsers.length > 0 ? (
          filteredUsers.map((user) => (
            <EmployeeEditCard 
              key={user.id} user={user} allUsers={registeredUsers} 
              userLeaves={employeeLeaves[user.name] || []} leaveSettings={leaveSettings}
              onUpdate={onUpdateEmployee} onDelete={onDeleteEmployee} 
              onAddLeave={onAddLeave} onRemoveLeave={onRemoveLeave}
            />
          ))
        ) : (
          <div className="text-center py-10 bg-white rounded-[1.5rem] border border-dashed border-gray-200">
            <Search size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-gray-400 font-bold text-sm">找不到符合篩選條件的員工</p>
          </div>
        )}
      </div>
    </div>
  );
}

function LeaveRequestScreen({ onBack, currentUser, employeeLeaves, leaveSettings, onSaveLeaves, announcement, onLogout }) {
  const initialLeaves = employeeLeaves[currentUser] || [];
  const [selectedLeaves, setSelectedLeaves] = useState(initialLeaves);
  const [isSubmitted, setIsSubmitted] = useState(false); 
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [warningMsg, setWarningMsg] = useState('');

  const targetYear = leaveSettings?.year || 2026;
  const targetMonth = leaveSettings?.month || 3;
  const MAX_LEAVES = leaveSettings?.total || 8;
  const MAX_WEEKEND_LEAVES = leaveSettings?.weekend || 1;
  const MAX_WEEKDAY_LEAVES = leaveSettings?.weekday || 7;
  const APPROVAL_THRESHOLD = 1; 

  const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
  const marchDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const othersLeaves = {};
  Object.entries(employeeLeaves).forEach(([emp, leaves]) => {
    if (emp !== currentUser) leaves.forEach((l) => { othersLeaves[l.date] = (othersLeaves[l.date] || 0) + 1; });
  });

  const handleDayClick = (day) => {
    if (isSubmitted) return;
    const dateStr = `${targetYear}/${targetMonth}/${day}`;

    const existingIndex = selectedLeaves.findIndex(l => l.date === dateStr);
    if (existingIndex >= 0) {
      setSelectedLeaves((prev) => prev.filter((l) => l.date !== dateStr));
      setWarningMsg('');
      return;
    }

    const info = getDayInfo(targetYear, targetMonth, day);
    
    // 計算目前已選的天數 (針對當前的 targetMonth)
    const currentOffDayCount = selectedLeaves.filter(l => {
      const [y, m, d] = l.date.split('/').map(Number);
      return y === targetYear && m === targetMonth && getDayInfo(y, m, d).isOffDay;
    }).length;
    
    const currentWorkDayCount = selectedLeaves.filter(l => {
      const [y, m, d] = l.date.split('/').map(Number);
      return y === targetYear && m === targetMonth && !getDayInfo(y, m, d).isOffDay;
    }).length;

    const currentTotalForMonth = selectedLeaves.filter(l => {
      const [y, m] = l.date.split('/').map(Number);
      return y === targetYear && m === targetMonth;
    }).length;

    if (info.isOffDay && currentOffDayCount >= MAX_WEEKEND_LEAVES) {
      setWarningMsg(`本月最多只能選擇 ${MAX_WEEKEND_LEAVES} 天「假日/連假」排休`);
      setTimeout(() => setWarningMsg(''), 3000);
      return;
    }
    if (!info.isOffDay && currentWorkDayCount >= MAX_WEEKDAY_LEAVES) {
      setWarningMsg(`本月最多只能選擇 ${MAX_WEEKDAY_LEAVES} 天「平日」排休`);
      setTimeout(() => setWarningMsg(''), 3000);
      return;
    }
    if (currentTotalForMonth >= MAX_LEAVES) {
      setWarningMsg(`您已達本月自選排休上限 (${MAX_LEAVES}天)`);
      setTimeout(() => setWarningMsg(''), 3000);
      return;
    }

    const bookedCount = othersLeaves[dateStr] || 0;
    const needsApproval = bookedCount >= APPROVAL_THRESHOLD;

    const newLeave = { date: dateStr, status: needsApproval ? 'pending' : 'approved' };
    setSelectedLeaves((prev) => [...prev, newLeave]);
    
    if (needsApproval) {
      setWarningMsg('該日已有其他同事排休，將送交主管審核');
      setTimeout(() => setWarningMsg(''), 3500);
    } else {
      setWarningMsg('');
    }
  };

  const confirmSubmit = () => {
    setIsSubmitted(true);
    onSaveLeaves(currentUser, selectedLeaves);
    setShowConfirmModal(false);
  };

  const monthLeavesCount = selectedLeaves.filter(l => {
    const [y, m] = l.date.split('/').map(Number);
    return y === targetYear && m === targetMonth;
  }).length;

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar bg-[#f8f9fc] pb-[150px] animate-in fade-in slide-in-from-right-8 duration-300 relative flex flex-col">
      {warningMsg && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-4 w-11/12 max-w-[320px]">
          <div className={`text-white px-5 py-3 rounded-2xl shadow-2xl font-bold text-sm flex items-center justify-center gap-2 text-center leading-snug ${warningMsg.includes('主管審核') ? 'bg-orange-500' : 'bg-red-500'}`}>
            <AlertCircle size={20} className="shrink-0" /> {warningMsg}
          </div>
        </div>
      )}
      
      <header className="shrink-0 sticky top-0 bg-[#f8f9fc]/90 backdrop-blur-md z-10 flex items-center justify-between px-8 pt-12 pb-4 border-b border-gray-200/50">
        <div>
          <h1 className="text-2xl font-extrabold text-[#111] tracking-tight">{targetMonth}月份排休</h1>
          <p className="text-xs font-semibold text-gray-500 mt-0.5">{currentUser} {isSubmitted ? ' - 假單已鎖定' : ` - 已選 ${monthLeavesCount} 天 (上限 ${MAX_LEAVES} 天)`}</p>
        </div>
        <button onClick={onLogout} className="w-10 h-10 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-full flex items-center justify-center transition shadow-sm active:scale-95" title="安全登出">
          <LogOut size={16} strokeWidth={2.5} />
        </button>
      </header>

      <div className="px-8 mt-6 flex-1 pb-[120px]">
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl mb-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <p className="text-xs font-bold text-blue-800 leading-relaxed text-center">
             {announcement.split('\n').map((line, i) => (
                <span key={i}>
                  {line}
                  <br />
                </span>
             ))}
          </p>
        </div>

        <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex flex-col gap-3 text-xs font-bold text-gray-500">
            <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded-full bg-[#111]"></div><span>確定休假</span></div>
            <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded-full bg-orange-500"></div><span className="text-orange-600">待主管審核</span></div>
          </div>
          <div className="flex flex-col gap-3 text-xs font-bold text-gray-500">
            <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded-full bg-red-50 border border-red-200"></div><span className="text-red-500">易生衝突</span></div>
            <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded-full bg-gray-50 border border-gray-200"></div><span>尚有名額</span></div>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex justify-between text-sm font-bold text-[#111] mb-2">
            <span>本月自選 (最多 {MAX_WEEKEND_LEAVES} 假日, {MAX_WEEKDAY_LEAVES} 平日)</span>
            <span className={monthLeavesCount === MAX_LEAVES ? 'text-green-600' : 'text-blue-600'}>{monthLeavesCount} / {MAX_LEAVES} 天</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className={`h-2 rounded-full transition-all duration-300 ${monthLeavesCount === MAX_LEAVES ? 'bg-green-500' : 'bg-blue-600'}`} style={{ width: `${Math.min((monthLeavesCount / MAX_LEAVES) * 100, 100)}%` }}></div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-8">
          <div className="grid grid-cols-7 gap-x-2 gap-y-3">
            {['日', '一', '二', '三', '四', '五', '六'].map((d) => (
              <div key={d} className={`text-center text-[10px] font-bold mb-2 ${d === '日' || d === '六' ? 'text-orange-500' : 'text-gray-400'}`}>{d}</div>
            ))}
            {marchDays.map((day) => {
              const dateStr = `${targetYear}/${targetMonth}/${day}`;
              const myLeave = selectedLeaves.find((l) => l.date === dateStr);
              const bookedCount = othersLeaves[dateStr] || 0;
              const isFull = bookedCount >= APPROVAL_THRESHOLD;
              
              const info = getDayInfo(targetYear, targetMonth, day);

              let btnClass = 'bg-gray-50 text-gray-600 border border-gray-100 hover:bg-gray-100';
              if (myLeave) {
                btnClass = myLeave.status === 'pending' ? 'bg-orange-500 text-white shadow-md transform scale-105 z-10 font-bold border-transparent' : 'bg-[#111] text-white shadow-md transform scale-105 z-10 font-bold border-transparent';
              } else if (isFull) {
                btnClass = 'bg-red-50 text-red-500 border border-red-100 font-bold';
              } else if (bookedCount > 0) {
                btnClass = 'bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 font-bold';
              } else if (info.isOffDay) {
                btnClass = 'bg-red-50/30 text-red-500 hover:bg-red-100 border-transparent';
              }

              return (
                <button key={day} onClick={() => handleDayClick(day)} disabled={isSubmitted} className={`relative w-full aspect-square rounded-xl flex items-center justify-center transition-all duration-200 ${btnClass}`}>
                  <span className={`text-[14px] font-bold ${(!myLeave && !isFull) ? (info.isHoliday ? 'text-red-600' : (info.isWeekend ? 'text-orange-500' : 'text-gray-700')) : ''}`}>{day}</span>
                  {info.isHoliday && !myLeave && !isFull && <span className="absolute top-1 right-1 text-[8px] text-red-500 font-black tracking-tighter leading-none">{info.holidayName.substring(0,2)}</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="w-full">
          {isSubmitted ? (
            <div className="w-full bg-green-50 text-green-600 py-4 rounded-2xl flex items-center justify-center gap-2 font-bold shadow-sm border border-green-100">
              <CheckCircle size={20} /> 假單已送出
            </div>
          ) : (
            <button
              onClick={() => { if (selectedLeaves.length > 0) setShowConfirmModal(true); }}
              className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-bold shadow-lg transition-all active:scale-[0.98] ${
                selectedLeaves.length > 0 ? 'bg-[#2563EB] text-white shadow-blue-600/30 hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
              }`}
            >
              發送假單 ({monthLeavesCount} / {MAX_LEAVES} 天)
            </button>
          )}
        </div>

      </div>

      {showConfirmModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowConfirmModal(false)}></div>
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm relative z-10 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-4"><AlertCircle size={24} /></div>
            <h3 className="text-xl font-bold text-[#111] mb-2">確定送出排休假單？</h3>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              您本月已自選 <strong className="text-gray-800">{monthLeavesCount}</strong> 天假。
              {selectedLeaves.some(l => l.status === 'pending') && <span className="text-orange-500 font-bold block mt-1"> 包含待審核的假單，須經主管同意。</span>}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirmModal(false)} className="flex-1 py-3.5 rounded-2xl bg-gray-50 text-gray-600 font-bold hover:bg-gray-100 transition-colors">取消</button>
              <button onClick={confirmSubmit} className="flex-1 py-3.5 rounded-2xl bg-[#2563EB] text-white font-bold hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-colors">確定送出</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BackendSettingsScreen({ onBack, ruleEnabled, setRuleEnabled, leaveSettings, onUpdateLeaveSettings, announcement, onUpdateAnnouncement, shiftTimes, onUpdateShiftTimes, timeBlockDemands, onUpdateTimeBlockDemands, businessHours, onUpdateBusinessHours }) {
  const [localAnnouncement, setLocalAnnouncement] = useState(announcement);
  const [localLeaveSettings, setLocalLeaveSettings] = useState(leaveSettings || { year: 2026, month: 3, total: 8, weekend: 1, weekday: 7 });
  const [localShiftTimes, setLocalShiftTimes] = useState(normalizeShiftTimes(shiftTimes));
  const [localDemands, setLocalDemands] = useState(timeBlockDemands || initialTimeBlockDemands);
  const [localBusinessHours, setLocalBusinessHours] = useState(businessHours || '11:00 - 00:00');
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  
  // 防呆機制 Modal
  const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'demand' | 'role', id: string, name: string }
  const [saveTarget, setSaveTarget] = useState(null); // 'demands' | 'roles'

  useEffect(() => {
    if (leaveSettings) setLocalLeaveSettings(leaveSettings);
  }, [leaveSettings]);

  useEffect(() => {
    if (shiftTimes) setLocalShiftTimes(normalizeShiftTimes(shiftTimes));
  }, [shiftTimes]);

  useEffect(() => {
    if (timeBlockDemands) setLocalDemands(timeBlockDemands);
  }, [timeBlockDemands]);

  const handleSyncGov = () => {
    setIsSyncing(true);
    setTimeout(() => {
      const y = localLeaveSettings.year;
      const m = localLeaveSettings.month;
      let offDaysCount = 0;
      const daysInM = new Date(y, m, 0).getDate();
      for(let d=1; d<=daysInM; d++) {
        if (getDayInfo(y, m, d).isOffDay) offDaysCount++;
      }
      
      setLocalLeaveSettings(prev => ({
        ...prev,
        total: offDaysCount,
        weekend: Math.min(offDaysCount, 4), // 預設安全配額
        weekday: Math.max(offDaysCount - Math.min(offDaysCount, 4), 0)
      }));
      setIsSyncing(false);
      setToastMsg(`已載入 ${m}月 國定額度 (${offDaysCount}天)`);
      setTimeout(() => setToastMsg(''), 3000);
    }, 800);
  };

  const handleSaveAll = () => {
    onUpdateAnnouncement(localAnnouncement);
    onUpdateLeaveSettings(localLeaveSettings);
    if (onUpdateShiftTimes) onUpdateShiftTimes(localShiftTimes);
    if (onUpdateTimeBlockDemands) onUpdateTimeBlockDemands(localDemands);
    if (onUpdateBusinessHours) onUpdateBusinessHours(localBusinessHours);
    setToastMsg('設定已全面儲存並發佈');
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleAddDemand = () => {
    const newId = `tb_${Date.now()}`;
    setLocalDemands([...localDemands, { id: newId, name: 'HH:MM - HH:MM', reqWeekday: 0, reqWeekend: 0 }]);
  };

  const handleUpdateDemand = (id, field, value) => {
    setLocalDemands(localDemands.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const handleAddRole = () => {
    const newId = `custom_${Date.now()}`;
    setLocalShiftTimes([...localShiftTimes, { id: newId, name: '自訂職位名稱', time: '11:00 - 15:00', isSystem: false }]);
  };

  const handleUpdateRole = (id, field, value) => {
    setLocalShiftTimes(localShiftTimes.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'demand') {
      setLocalDemands(localDemands.filter(d => d.id !== deleteTarget.id));
    } else if (deleteTarget.type === 'role') {
      setLocalShiftTimes(localShiftTimes.filter(r => r.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
  };

  const confirmSave = () => {
    if (saveTarget === 'demands') {
      if (onUpdateTimeBlockDemands) onUpdateTimeBlockDemands(localDemands);
      setToastMsg('時段人數需求規則已儲存並同步');
    } else if (saveTarget === 'roles') {
      if (onUpdateShiftTimes) onUpdateShiftTimes(localShiftTimes);
      setToastMsg('職位上班時段規則已儲存並同步');
    }
    setSaveTarget(null);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const renderRoleGroup = (prefix, title) => {
    const items = localShiftTimes.filter(r => r.id.startsWith(prefix));
    if (items.length === 0) return null;
    return (
      <div className="mb-4">
         <h4 className="text-xs font-bold text-gray-500 mb-2 border-b border-gray-100 pb-1">{title}</h4>
         <div className="grid grid-cols-1 gap-2">
             {items.map(role => (
               <div key={role.id} className="flex items-center justify-between bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                  <span className="text-xs font-bold text-gray-700 w-24 truncate">{role.name}</span>
                  <input type="text" value={role.time} onChange={e => handleUpdateRole(role.id, 'time', e.target.value)} className="flex-1 bg-white border border-gray-200 rounded-lg p-1.5 text-xs font-bold outline-none focus:border-blue-500 shadow-sm" />
               </div>
             ))}
         </div>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar bg-[#f5f6f8] pb-32 animate-in slide-in-from-right-8 duration-300 relative">
      {/* 防呆刪除確認 Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteTarget(null)}></div>
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm relative z-10 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-4"><AlertCircle size={24} /></div>
            <h3 className="text-xl font-bold text-[#111] mb-2">確認刪除？</h3>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              確定要刪除「<strong className="text-red-500">{deleteTarget.name}</strong>」嗎？此操作不可逆，可能會影響未來的自動排班規則。
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3.5 rounded-2xl bg-gray-50 text-gray-600 font-bold hover:bg-gray-100 transition-colors">取消</button>
              <button onClick={confirmDelete} className="flex-1 py-3.5 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-600 shadow-md shadow-red-600/20 transition-colors">確定刪除</button>
            </div>
          </div>
        </div>
      )}

      {/* 防呆儲存確認 Modal */}
      {saveTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSaveTarget(null)}></div>
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm relative z-10 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-4"><CheckCircle size={24} /></div>
            <h3 className="text-xl font-bold text-[#111] mb-2">確認儲存設定？</h3>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              確定要儲存您編輯的「<strong className="text-blue-600">{saveTarget === 'demands' ? '時段人數需求規則' : '各職位上班時段規則'}</strong>」嗎？儲存後將直接影響後續的「一鍵自動排班」與「手動排班」設定。
            </p>
            <div className="flex gap-3">
              <button onClick={() => setSaveTarget(null)} className="flex-1 py-3.5 rounded-2xl bg-gray-50 text-gray-600 font-bold hover:bg-gray-100 transition-colors">取消</button>
              <button onClick={confirmSave} className="flex-1 py-3.5 rounded-2xl bg-[#2563EB] text-white font-bold hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-colors">確認儲存</button>
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 bg-[#f5f6f8]/90 backdrop-blur-md z-10 flex items-center px-8 pt-12 pb-4 border-b border-gray-200/50">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-800 hover:bg-gray-200 rounded-full transition mr-4"><ChevronLeft size={28} strokeWidth={2} /></button>
        <div>
          <h1 className="text-2xl font-extrabold text-[#111] tracking-tight">後台設定</h1>
          <p className="text-xs font-semibold text-gray-500 mt-0.5">排班規則與系統公告</p>
        </div>
      </header>

      <div className="px-8 mt-6 space-y-6">
        
        {/* 新增：營業時間卡片 */}
        <div className="bg-white rounded-[2rem] p-6 shadow-[0_8px_20px_rgb(0,0,0,0.03)] border border-gray-50">
          <div className="flex items-center gap-3 mb-4 border-b border-gray-50 pb-4">
             <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600"><Store size={20} strokeWidth={2.5} /></div>
             <div>
                <h3 className="font-bold text-[#111] text-lg">營業時間</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Business Hours</p>
             </div>
          </div>
          <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100">
             <span className="text-xs font-bold text-gray-700 w-24">門市營業時間</span>
             <input type="text" value={localBusinessHours} onChange={e => setLocalBusinessHours(e.target.value)} placeholder="例如 11:00 - 00:00" className="flex-1 bg-white border border-gray-200 rounded-lg p-2 text-sm font-bold outline-none focus:border-blue-500 shadow-sm" />
          </div>
        </div>

        {/* 新增：平日與假日時間安排人數規則卡片 */}
        <div className="bg-white rounded-[2rem] p-6 shadow-[0_8px_20px_rgb(0,0,0,0.03)] border border-gray-50">
          <div className="flex items-center justify-between mb-4 border-b border-gray-50 pb-4">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600"><Users size={20} strokeWidth={2.5} /></div>
                <div>
                   <h3 className="font-bold text-[#111] text-lg">時段人數需求規則</h3>
                   <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Headcount Rule Config</p>
                </div>
             </div>
             <button onClick={handleAddDemand} className="w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center hover:bg-purple-100 transition-colors shadow-sm">
                <Plus size={16} strokeWidth={3} />
             </button>
          </div>

          <div className="space-y-3">
             <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-gray-400 pl-1">
                <div className="col-span-5">需求時段區間</div>
                <div className="col-span-3 text-center">平日人數</div>
                <div className="col-span-3 text-center">假日人數</div>
                <div className="col-span-1"></div>
             </div>
             {localDemands.map(demand => (
                <div key={demand.id} className="grid grid-cols-12 gap-2 items-center bg-gray-50 p-2 rounded-xl border border-gray-100">
                   <div className="col-span-5">
                      <input type="text" value={demand.name} onChange={e => handleUpdateDemand(demand.id, 'name', e.target.value)} className="w-full bg-white border border-gray-200 rounded-lg p-1.5 text-xs font-bold outline-none focus:border-purple-500 shadow-sm" placeholder="HH:MM - HH:MM" />
                   </div>
                   <div className="col-span-3 flex justify-center">
                      <input type="number" value={demand.reqWeekday} onChange={e => handleUpdateDemand(demand.id, 'reqWeekday', parseInt(e.target.value)||0)} className="w-12 bg-white border border-gray-200 rounded-lg p-1.5 text-xs font-bold text-center outline-none focus:border-purple-500 shadow-sm" />
                   </div>
                   <div className="col-span-3 flex justify-center">
                      <input type="number" value={demand.reqWeekend} onChange={e => handleUpdateDemand(demand.id, 'reqWeekend', parseInt(e.target.value)||0)} className="w-12 bg-white border border-gray-200 rounded-lg p-1.5 text-xs font-bold text-center outline-none focus:border-purple-500 shadow-sm" />
                   </div>
                   <div className="col-span-1 flex justify-center">
                      <button onClick={() => setDeleteTarget({ type: 'demand', id: demand.id, name: demand.name })} className="text-gray-400 hover:text-red-500 transition-colors p-1" title="刪除此時段">
                        <Trash2 size={14} />
                      </button>
                   </div>
                </div>
             ))}
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-50 flex justify-end">
             <button onClick={() => setSaveTarget('demands')} className="bg-purple-600 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-md shadow-purple-600/20 hover:bg-purple-700 transition-colors active:scale-95 flex items-center gap-1.5">
               <CheckCircle size={16} /> 儲存人數規則
             </button>
          </div>
        </div>

        {/* 各個職位的上班時段時間卡片 */}
        <div className="bg-white rounded-[2rem] p-6 shadow-[0_8px_20px_rgb(0,0,0,0.03)] border border-gray-50">
          <div className="flex items-center justify-between mb-5 border-b border-gray-50 pb-4">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600"><Clock size={20} strokeWidth={2.5} /></div>
                <div>
                   <h3 className="font-bold text-[#111] text-lg">各職位上班時段規則</h3>
                   <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Shift & Role Time Rules</p>
                </div>
             </div>
             <button onClick={handleAddRole} className="flex items-center gap-1 text-[10px] font-bold bg-orange-50 text-orange-600 px-3 py-2 rounded-xl hover:bg-orange-100 transition-colors active:scale-95 shadow-sm">
                <Plus size={14} /> 新增職位
             </button>
          </div>

          <div className="space-y-2">
            {renderRoleGroup('base_', '📌 基本班別 (手動加班預設)')}
            {renderRoleGroup('full_', '📌 正職預設工時 (自動排班預設)')}
            {renderRoleGroup('part_', '📌 兼職預設工時 (自動排班預設)')}

            {/* 自訂職位區塊 */}
            {localShiftTimes.filter(r => !r.isSystem).length > 0 && (
              <div className="mb-4 pt-2">
                <h4 className="text-xs font-bold text-gray-500 mb-2 border-b border-gray-100 pb-1">📌 自訂新增職位</h4>
                <div className="grid grid-cols-1 gap-2">
                    {localShiftTimes.filter(r => !r.isSystem).map(role => (
                      <div key={role.id} className="flex items-center gap-2 bg-orange-50/50 p-2.5 rounded-xl border border-orange-100">
                          <input type="text" value={role.name} onChange={e => handleUpdateRole(role.id, 'name', e.target.value)} className="w-28 bg-white border border-gray-200 rounded-lg p-1.5 text-xs font-bold outline-none focus:border-orange-500 shadow-sm" placeholder="職位名稱" />
                          <input type="text" value={role.time} onChange={e => handleUpdateRole(role.id, 'time', e.target.value)} className="flex-1 bg-white border border-gray-200 rounded-lg p-1.5 text-xs font-bold outline-none focus:border-orange-500 shadow-sm" placeholder="時段" />
                          <button onClick={() => setDeleteTarget({ type: 'role', id: role.id, name: role.name })} className="text-gray-400 hover:text-red-500 transition-colors p-1" title="刪除此職位">
                             <Trash2 size={14} />
                          </button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-50 flex justify-end">
             <button onClick={() => setSaveTarget('roles')} className="bg-orange-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-md shadow-orange-500/20 hover:bg-orange-600 transition-colors active:scale-95 flex items-center gap-1.5">
               <CheckCircle size={16} /> 儲存職位時段
             </button>
          </div>
        </div>

        {/* 排班目標與限制 (連動行政院行事曆) */}
        <div className="bg-white rounded-[2rem] p-6 shadow-[0_8px_20px_rgb(0,0,0,0.03)] border border-gray-50">
          <div className="flex items-center justify-between mb-6 border-b border-gray-50 pb-4">
             <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600"><CalendarIcon size={24} strokeWidth={2} /></div>
                <div>
                   <h3 className="font-extrabold text-[#111] text-xl tracking-wide">排班目標與限制</h3>
                   <p className="text-[11px] text-gray-400 font-bold uppercase mt-0.5 tracking-wider">Schedule Target</p>
                </div>
             </div>
             <button onClick={handleSyncGov} disabled={isSyncing} className="flex items-center gap-2 text-xs font-bold bg-indigo-50/50 text-indigo-600 px-4 py-2.5 rounded-xl hover:bg-indigo-100 transition-colors active:scale-95 shadow-sm border border-indigo-100/50">
                <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
                {isSyncing ? '同步中...' : '同步行政院'}
             </button>
          </div>

          <div className="flex items-center gap-4 mb-6">
             <div className="relative flex-1">
                 <select value={localLeaveSettings.year} onChange={e => setLocalLeaveSettings({...localLeaveSettings, year: parseInt(e.target.value)})} className="w-full appearance-none bg-white font-extrabold text-gray-700 text-base py-3 pl-5 pr-10 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm cursor-pointer hover:border-indigo-300 transition-colors bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%234F46E5%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.4-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[length:10px_10px] bg-[right_16px_center]">
                   {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y} 年</option>)}
                 </select>
             </div>
             <div className="relative flex-1">
                 <select value={localLeaveSettings.month} onChange={e => setLocalLeaveSettings({...localLeaveSettings, month: parseInt(e.target.value)})} className="w-full appearance-none bg-white font-extrabold text-gray-700 text-base py-3 pl-5 pr-10 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm cursor-pointer hover:border-indigo-300 transition-colors bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%234F46E5%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.4-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[length:10px_10px] bg-[right_16px_center]">
                   {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{m} 月份</option>)}
                 </select>
             </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
             <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 flex flex-col items-center justify-center shadow-sm">
                <label className="block text-[11px] font-extrabold text-gray-500 mb-3 tracking-wide">總休假數</label>
                <div className="flex items-center gap-2">
                   <select value={localLeaveSettings.total} onChange={e => setLocalLeaveSettings({...localLeaveSettings, total: parseInt(e.target.value)||0})} className="appearance-none bg-white border border-gray-200 rounded-xl px-3 py-2 text-lg font-black text-gray-700 outline-none focus:border-indigo-500 shadow-sm text-center min-w-[60px] cursor-pointer hover:border-indigo-300 transition-colors">
                      {Array.from({length: 32}, (_, i) => <option key={i} value={i}>{i}</option>)}
                   </select>
                   <span className="text-sm font-bold text-gray-500">天</span>
                </div>
             </div>
             <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 flex flex-col items-center justify-center shadow-sm">
                <label className="block text-[11px] font-extrabold text-gray-500 mb-3 tracking-wide">假日上限</label>
                <div className="flex items-center gap-2">
                   <select value={localLeaveSettings.weekend} onChange={e => setLocalLeaveSettings({...localLeaveSettings, weekend: parseInt(e.target.value)||0})} className="appearance-none bg-white border border-gray-200 rounded-xl px-3 py-2 text-lg font-black text-gray-700 outline-none focus:border-indigo-500 shadow-sm text-center min-w-[60px] cursor-pointer hover:border-indigo-300 transition-colors">
                      {Array.from({length: 16}, (_, i) => <option key={i} value={i}>{i}</option>)}
                   </select>
                   <span className="text-sm font-bold text-gray-500">天</span>
                </div>
             </div>
             <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 flex flex-col items-center justify-center shadow-sm">
                <label className="block text-[11px] font-extrabold text-gray-500 mb-3 tracking-wide">平日上限</label>
                <div className="flex items-center gap-2">
                   <select value={localLeaveSettings.weekday} onChange={e => setLocalLeaveSettings({...localLeaveSettings, weekday: parseInt(e.target.value)||0})} className="appearance-none bg-white border border-gray-200 rounded-xl px-3 py-2 text-lg font-black text-gray-700 outline-none focus:border-indigo-500 shadow-sm text-center min-w-[60px] cursor-pointer hover:border-indigo-300 transition-colors">
                      {Array.from({length: 32}, (_, i) => <option key={i} value={i}>{i}</option>)}
                   </select>
                   <span className="text-sm font-bold text-gray-500">天</span>
                </div>
             </div>
          </div>

          <div className="flex items-center gap-3 mb-4 border-b border-gray-50 pb-4 pt-2">
             <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600"><AlignLeft size={20} strokeWidth={2.5} /></div>
             <div>
                <h3 className="font-bold text-[#111] text-lg">排休系統公告</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Announcement</p>
             </div>
          </div>
          <textarea
            value={localAnnouncement}
            onChange={(e) => setLocalAnnouncement(e.target.value)}
            className="w-full bg-gray-50 p-4 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-green-500 outline-none leading-relaxed transition-all resize-none shadow-sm"
            rows={4}
            placeholder="請輸入要在員工排休畫面上方顯示的公告..."
          />

          <button 
            onClick={handleSaveAll} 
            className="mt-5 w-full py-4 bg-[#111] text-white rounded-2xl font-bold shadow-lg shadow-black/10 hover:bg-gray-800 transition-all flex justify-center items-center gap-2 active:scale-95"
          >
             {toastMsg ? <><CheckCircle size={18} className="text-green-400" /> {toastMsg}</> : '儲存所有設定並發佈'}
          </button>
        </div>

        <div className="bg-white rounded-[2rem] p-6 shadow-[0_8px_20px_rgb(0,0,0,0.03)] border border-gray-50 flex justify-between items-center cursor-pointer" onClick={() => setRuleEnabled(!ruleEnabled)}>
          <div>
            <h3 className="font-bold text-[#111] text-lg">啟用排班防呆規則</h3>
            <p className="text-[11px] text-gray-400 font-bold mt-1">開啟「七休二」與工時防呆</p>
          </div>
          <button className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ease-in-out shadow-inner ${ruleEnabled ? 'bg-[#5B8C66]' : 'bg-gray-300'}`}>
            <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-300 ease-in-out flex items-center justify-center ${ruleEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
          </button>
        </div>

        <div className={`bg-white rounded-[2rem] p-6 shadow-[0_8px_20px_rgb(0,0,0,0.03)] border border-gray-50 transition-all duration-300 ${ruleEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none grayscale'}`}>
          <div className="flex items-center gap-3 mb-5 border-b border-gray-50 pb-4">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600"><Settings size={20} strokeWidth={2.5} /></div>
            <div>
              <h3 className="font-bold text-[#111] text-lg">防呆參數設定</h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Rule Parameters</p>
            </div>
          </div>
          <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-xl mb-4 font-medium leading-relaxed">
            <strong className="text-blue-900 block mb-1"> 七休二 AI 滾動檢查 & 排休邏輯</strong>
            開啟規則後，系統將確保每位員工在<strong className="text-red-500">任意連續 7 天內，最多只能排 5 天班</strong>（必須休 2 天）。<br /><br />
            另外，每位員工每月<strong className="text-red-500">只能自選設定額度的假</strong>，若發生衝突會轉交主管審核，剩餘假額由系統在符合人力與七休二的情況下為其自動保留。
          </div>
        </div>
      </div>
    </div>
  );
}

function EmployeeProfileScreen({ currentUser, registeredUsers, employeeLeaves, shifts, leaveSettings }) {
  const user = registeredUsers.find(u => u.name === currentUser);
  if (!user) return null;

  const [viewYear, setViewYear] = useState(leaveSettings?.year || 2026);
  const [viewMonth, setViewMonth] = useState(leaveSettings?.month || 3);
  
  useEffect(() => {
    setViewYear(leaveSettings?.year || 2026);
    setViewMonth(leaveSettings?.month || 3);
  }, [leaveSettings?.year, leaveSettings?.month]);

  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const viewDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const myLeaves = employeeLeaves[currentUser] || [];
  const myShifts = shifts.filter(s => s.assignee === currentUser);
  
  const [selectedDate, setSelectedDate] = useState(`${leaveSettings?.year || 2026}/${leaveSettings?.month || 3}/1`);

  useEffect(() => {
    setSelectedDate(`${viewYear}/${viewMonth}/1`);
  }, [viewYear, viewMonth]);

  const handlePrevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(v => v - 1); }
    else setViewMonth(v => v - 1);
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(v => v + 1); }
    else setViewMonth(v => v + 1);
  };

  const selectedShift = myShifts.find(s => s.date === selectedDate);
  const selectedLeave = myLeaves.find(l => l.date === selectedDate);

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar bg-[#f8f9fc] pb-32 animate-in slide-in-from-right-8 duration-300">
      <header className="sticky top-0 bg-[#f8f9fc]/90 backdrop-blur-md z-10 flex items-center px-8 pt-12 pb-6 border-b border-gray-200/50">
        <div>
          <h1 className="text-2xl font-extrabold text-[#111] tracking-tight">我的專屬行事曆</h1>
          <p className="text-xs font-semibold text-gray-500 mt-0.5">My Schedule</p>
        </div>
      </header>

      <div className="px-8 mt-6 flex flex-col gap-6">
        {/* 個人資訊卡片 */}
        <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-inner shrink-0 ${user.role.includes('兼職') ? 'bg-orange-500' : 'bg-blue-600'}`}>
              {user.name.charAt(0)}
            </div>
            <div className="flex flex-col gap-0.5">
              <h2 className="text-xl font-bold text-[#111]">{user.name}</h2>
              <div className="flex items-center gap-2">
                 <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${user.role.includes('兼職') ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                   {user.role}
                 </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 text-right">
             <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1"><Lock size={10}/> 登入密碼</span>
             <span className="text-sm font-bold text-gray-800 tracking-widest">{user.password}</span>
          </div>
        </div>

        {/* 我的行事曆 */}
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100">
           <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-2">
               <h3 className="font-bold text-[#111] text-md">{viewMonth}月 班表</h3>
               <div className="flex gap-1.5 ml-2">
                 <button onClick={handlePrevMonth} className="w-6 h-6 flex items-center justify-center bg-gray-50 text-gray-600 hover:bg-gray-200 rounded-full transition"><ChevronLeft size={12} strokeWidth={2.5} /></button>
                 <button onClick={handleNextMonth} className="w-6 h-6 flex items-center justify-center bg-gray-50 text-gray-600 hover:bg-gray-200 rounded-full transition"><ChevronRight size={12} strokeWidth={2.5} /></button>
               </div>
             </div>
             <div className="flex gap-2">
               <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div><span className="text-[10px] font-bold text-gray-500">上班</span></div>
               <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-green-500"></div><span className="text-[10px] font-bold text-gray-500">休假</span></div>
             </div>
           </div>

           <div className="grid grid-cols-7 gap-x-2 gap-y-3">
            {['日', '一', '二', '三', '四', '五', '六'].map((d) => (
              <div key={d} className={`text-center text-[10px] font-bold mb-1 ${d === '日' || d === '六' ? 'text-orange-500' : 'text-gray-400'}`}>{d}</div>
            ))}
            {viewDays.map((day) => {
              const dateStr = `${viewYear}/${viewMonth}/${day}`;
              const isShift = myShifts.some(s => s.date === dateStr);
              const leaveInfo = myLeaves.find(l => l.date === dateStr);
              const isSelected = selectedDate === dateStr;
              const info = getDayInfo(viewYear, viewMonth, day);

              let btnClass = 'bg-gray-50 text-gray-600 hover:bg-gray-100';
              if (leaveInfo) {
                 btnClass = leaveInfo.status === 'pending' ? 'bg-orange-50 text-orange-600 border border-orange-200' : 'bg-green-50 text-green-600 border border-green-200';
              } else if (isShift) {
                 btnClass = 'bg-blue-50 text-blue-600 border border-blue-200 font-bold';
              } else if (info.isOffDay) {
                 btnClass = 'bg-red-50/30 text-red-500 hover:bg-red-100';
              }

              return (
                <button key={day} onClick={() => setSelectedDate(dateStr)} className={`relative w-full aspect-square rounded-xl flex items-center justify-center transition-all duration-200 ${btnClass} ${isSelected ? 'ring-2 ring-[#111] ring-offset-2 transform scale-105 z-10 shadow-md' : ''}`}>
                  <span className={`text-[14px] font-bold ${(!leaveInfo && !isShift) ? (info.isHoliday ? 'text-red-600' : (info.isWeekend ? 'text-orange-500' : 'text-gray-700')) : ''}`}>{day}</span>
                  {info.isHoliday && !leaveInfo && !isShift && <span className="absolute top-1 right-1 text-[8px] text-red-500 font-black tracking-tighter leading-none">{info.holidayName.substring(0,2)}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* 單日詳細資訊 */}
        <div className="bg-[#111] text-white rounded-[2rem] p-6 shadow-lg shadow-black/10 relative overflow-hidden mb-4">
           <div className="absolute -right-4 -top-4 opacity-10 pointer-events-none">
             <CalendarIcon size={100} />
           </div>
           <div className="flex items-center gap-2 mb-4 relative z-10">
             <h3 className="text-sm font-bold text-gray-400 flex items-center gap-2">
               <CalendarCheck size={16} /> {selectedDate.split('/')[1]}/{selectedDate.split('/')[2]} 詳細資訊
             </h3>
             {getDayInfo(viewYear, viewMonth, parseInt(selectedDate.split('/')[2])).isHoliday && (
               <span className="text-[10px] font-black text-red-500 bg-red-500/20 px-2 py-0.5 rounded-md border border-red-500/30">
                 {getDayInfo(viewYear, viewMonth, parseInt(selectedDate.split('/')[2])).holidayName}
               </span>
             )}
           </div>

           {selectedShift ? (
             <div className="flex flex-col gap-4 relative z-10">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400"><Briefcase size={20} /></div>
                 <div>
                   <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">排定班別</span>
                   <span className="block text-sm font-bold text-white">{selectedShift.shiftCategory || (selectedShift.type.includes('晚') ? '晚班' : '早班')} ({selectedShift.type})</span>
                 </div>
               </div>
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400"><Clock size={20} /></div>
                 <div>
                   <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">工作時間</span>
                   <span className="block text-sm font-bold text-white leading-relaxed">{selectedShift.time.replace(/&/g, ' 與 ')}</span>
                 </div>
               </div>
             </div>
           ) : selectedLeave ? (
             <div className="flex items-center gap-4 relative z-10 py-2">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${selectedLeave.status === 'pending' ? 'bg-orange-500/20 text-orange-400' : 'bg-green-500/20 text-green-400'}`}>
                  {selectedLeave.status === 'pending' ? <Clock size={24} /> : <CheckCircle size={24} />}
                </div>
                <div>
                   <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">休假狀態</span>
                   <span className={`block text-lg font-bold ${selectedLeave.status === 'pending' ? 'text-orange-400' : 'text-green-400'}`}>
                     {selectedLeave.status === 'pending' ? '待主管審核中' : '已核准休假'}
                   </span>
                </div>
             </div>
           ) : (
             <div className="py-6 text-center relative z-10 text-gray-400 bg-white/5 rounded-2xl border border-white/10">
               <span className="text-sm font-bold flex items-center justify-center gap-2"><Coffee size={16} /> 本日無排班與排休</span>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [activeScreen, setActiveScreen] = useState('login');
  const [selectedShift, setSelectedShift] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [role, setRole] = useState(null);
  const [firebaseUser, setFirebaseUser] = useState(null);

  const [registeredUsers, setRegisteredUsers] = useState(initialRegisteredUsers);
  const [timeBlockDemands, setTimeBlockDemands] = useState(initialTimeBlockDemands);
  const [employeeLeaves, setEmployeeLeaves] = useState(initialLeavesMap);
  const [ruleEnabled, setRuleEnabled] = useState(true); 
  const [leaveSettings, setLeaveSettings] = useState(initialLeaveSettings);
  const [shifts, setShifts] = useState(() => generateInitialShifts());
  const [announcement, setAnnouncement] = useState(DEFAULT_ANNOUNCEMENT);
  const [shiftTimes, setShiftTimes] = useState(initialShiftTimes);
  const [businessHours, setBusinessHours] = useState(initialBusinessHours);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof window !== 'undefined' && window.__initial_auth_token) {
          await signInWithCustomToken(auth, window.__initial_auth_token);
        } else if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) { console.error("Firebase Auth Error", error); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setFirebaseUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'schedule_data', 'main_state');
    
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.users) setRegisteredUsers(data.users);
        if (data.shifts) setShifts(data.shifts);
        if (data.leaves) setEmployeeLeaves(data.leaves);
        if (data.demands) setTimeBlockDemands(data.demands);
        if (data.announcement !== undefined) setAnnouncement(data.announcement);
        if (data.leaveSettings !== undefined) setLeaveSettings(data.leaveSettings);
        if (data.shiftTimes !== undefined) setShiftTimes(normalizeShiftTimes(data.shiftTimes));
        if (data.businessHours !== undefined) setBusinessHours(data.businessHours);
      } else {
        setDoc(docRef, {
          users: initialRegisteredUsers,
          shifts: generateInitialShifts(),
          leaves: initialLeavesMap,
          demands: initialTimeBlockDemands,
          announcement: DEFAULT_ANNOUNCEMENT,
          leaveSettings: initialLeaveSettings,
          shiftTimes: initialShiftTimes,
          businessHours: initialBusinessHours
        }, { merge: true });
      }
    }, (err) => console.error("Snapshot error", err));
    
    return () => unsub();
  }, [firebaseUser]);

  const pendingLeavesCount = role === 'manager' 
    ? Object.values(employeeLeaves).flat().filter(l => l.status === 'pending').length 
    : 0;

  const navigateTo = (screen, shift = null) => {
    if (shift) setSelectedShift(shift);
    setActiveScreen(screen);
  };

  const handleBack = () => {
    setActiveScreen(role === 'manager' ? 'home' : 'leave_request');
    setTimeout(() => setSelectedShift(null), 300);
  };

  const updateAndSyncLeaves = (userName, newLeavesArray) => {
    const newMap = { ...employeeLeaves, [userName]: newLeavesArray };
    setEmployeeLeaves(newMap);
    syncStateToCloud(firebaseUser, { leaves: newMap });
  };

  const handleUpdateEmployee = (userId, newName, newRole, newPassword) => {
    const userIndex = registeredUsers.findIndex((u) => u.id === userId);
    if (userIndex === -1) return;

    const oldName = registeredUsers[userIndex].name;
    const updatedUser = { ...registeredUsers[userIndex], name: newName, role: newRole || '早班正職', password: newPassword || registeredUsers[userIndex].password };
    const updatedUsers = [...registeredUsers];
    updatedUsers[userIndex] = updatedUser;
    
    setRegisteredUsers(updatedUsers);

    if (oldName !== newName) {
      const newLeaves = { ...employeeLeaves };
      if (newLeaves[oldName]) {
        newLeaves[newName] = newLeaves[oldName];
        delete newLeaves[oldName];
      }
      setEmployeeLeaves(newLeaves);
      const newShifts = shifts.map(s => s.assignee === oldName ? { ...s, assignee: newName, type: newRole } : s);
      setShifts(newShifts);
      syncStateToCloud(firebaseUser, { users: updatedUsers, leaves: newLeaves, shifts: newShifts });
      if (currentUser === oldName) setCurrentUser(newName);
    } else {
      const newShifts = shifts.map(s => s.assignee === oldName ? { ...s, type: newRole } : s);
      setShifts(newShifts);
      syncStateToCloud(firebaseUser, { users: updatedUsers, shifts: newShifts });
    }
  };

  const handleDeleteEmployee = (userId) => {
    const userToDelete = registeredUsers.find((u) => u.id === userId);
    if (!userToDelete) return;
    const userName = userToDelete.name;

    const newUsers = registeredUsers.filter((u) => u.id !== userId);
    const newLeaves = { ...employeeLeaves };
    delete newLeaves[userName];
    const newShifts = shifts.filter((s) => s.assignee !== userName);

    setRegisteredUsers(newUsers);
    setEmployeeLeaves(newLeaves);
    setShifts(newShifts);
    
    syncStateToCloud(firebaseUser, { users: newUsers, leaves: newLeaves, shifts: newShifts });
  };

  const handleAddEmployeeLeave = (empName, dateStr) => {
    const currentLeaves = employeeLeaves[empName] || [];
    if (currentLeaves.some(l => l.date === dateStr)) return;
    const newLeavesArray = [...currentLeaves, { date: dateStr, status: 'approved', managerHandled: true }];
    handleSaveLeaves(empName, newLeavesArray);
  };

  const handleRemoveEmployeeLeave = (empName, dateStr) => {
    const currentLeaves = employeeLeaves[empName] || [];
    const newLeavesArray = currentLeaves.filter(l => l.date !== dateStr);
    handleSaveLeaves(empName, newLeavesArray);
  };

  const handleUpdateLeaveSettings = (newSettings) => {
    setLeaveSettings(newSettings);
    syncStateToCloud(firebaseUser, { leaveSettings: newSettings });
  };

  const handleUpdateShiftTimes = (newSettings) => {
    setShiftTimes(newSettings);
    syncStateToCloud(firebaseUser, { shiftTimes: newSettings });
  };

  const handleUpdateTimeBlockDemands = (newDemands) => {
    setTimeBlockDemands(newDemands);
    syncStateToCloud(firebaseUser, { demands: newDemands });
  };

  const handleUpdateBusinessHours = (newHours) => {
    setBusinessHours(newHours);
    syncStateToCloud(firebaseUser, { businessHours: newHours });
  };

  const handleApproveLeave = (emp, date) => {
    const updatedLeaves = employeeLeaves[emp].map(l => l.date === date ? { ...l, status: 'approved', managerHandled: true } : l);
    updateAndSyncLeaves(emp, updatedLeaves);
  };

  const handleRejectLeave = (emp, date) => {
    const updatedLeaves = employeeLeaves[emp].filter(l => l.date !== date);
    updateAndSyncLeaves(emp, updatedLeaves);
  };

  const handleApproveAllLeavesForDate = (date) => {
    let updatedLeavesMap = { ...employeeLeaves };
    let changed = false;
    Object.keys(updatedLeavesMap).forEach(emp => {
      let empChanged = false;
      const newEmpLeaves = updatedLeavesMap[emp].map(l => {
        if (l.date === date && l.status === 'pending') {
          empChanged = true;
          changed = true;
          return { ...l, status: 'approved', managerHandled: true };
        }
        return l;
      });
      if (empChanged) updatedLeavesMap[emp] = newEmpLeaves;
    });
    if (changed) {
      setEmployeeLeaves(updatedLeavesMap);
      syncStateToCloud(firebaseUser, { leaves: updatedLeavesMap });
    }
  };

  const handleRejectAllLeavesForDate = (date) => {
    let updatedLeavesMap = { ...employeeLeaves };
    let changed = false;
    Object.keys(updatedLeavesMap).forEach(emp => {
      const oldLen = updatedLeavesMap[emp].length;
      updatedLeavesMap[emp] = updatedLeavesMap[emp].filter(l => !(l.date === date && l.status === 'pending'));
      if (updatedLeavesMap[emp].length !== oldLen) changed = true;
    });
    if (changed) {
      setEmployeeLeaves(updatedLeavesMap);
      syncStateToCloud(firebaseUser, { leaves: updatedLeavesMap });
    }
  };

  const handleSaveLeaves = (userName, leavesArray) => {
    let newLeavesMap = { ...employeeLeaves, [userName]: leavesArray };

    const dateCounts = {};
    Object.values(newLeavesMap).forEach(leaves => {
      leaves.forEach(l => {
        dateCounts[l.date] = (dateCounts[l.date] || 0) + 1;
      });
    });

    Object.keys(newLeavesMap).forEach(emp => {
      newLeavesMap[emp] = newLeavesMap[emp].map(l => {
        if (dateCounts[l.date] > 1 && l.status === 'approved' && !l.managerHandled) {
          return { ...l, status: 'pending' };
        } 
        else if (dateCounts[l.date] <= 1 && l.status === 'pending' && !l.managerHandled) {
          return { ...l, status: 'approved' };
        }
        return l;
      });
    });

    setEmployeeLeaves(newLeavesMap);
    syncStateToCloud(firebaseUser, { leaves: newLeavesMap });
  };

  const handleAddManualShift = (dateStr, shiftCategory, userName) => {
    const user = registeredUsers.find(u => u.name === userName);
    if (!user) return;

    const [y, m, d] = dateStr.split('/').map(Number);
    const info = getDayInfo(y, m, d);
    const dayOfWeek = new Date(y, m - 1, d).getDay();
    const dayStr = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'][dayOfWeek];
    
    const newShift = {
      id: `manual_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,
      date: dateStr, day: dayStr, type: user.role, shiftCategory: shiftCategory, 
      time: getRoleDefaultTime(user.role, info.isOffDay, shiftCategory, shiftTimes), assignee: userName, status: 'confirmed'
    };
    
    const newShifts = [...shifts, newShift];
    setShifts(newShifts);
    syncStateToCloud(firebaseUser, { shifts: newShifts });
  };

  const handleRemoveManualShift = (shiftId) => {
    const newShifts = shifts.filter(s => s.id !== shiftId);
    setShifts(newShifts);
    syncStateToCloud(firebaseUser, { shifts: newShifts });
  };

  const handleAutoSchedule = () => {
    let allShifts = [];
    const autoScheduleDaysLimit = leaveSettings?.total || 8;
    const targetY = leaveSettings?.year || 2026;
    const targetM = leaveSettings?.month || 3;
    const shiftArr = normalizeShiftTimes(shiftTimes);
    const getTime = (id) => shiftArr.find(x => x.id === id)?.time || '';
    
    registeredUsers.forEach(u => {
        const leaves = employeeLeaves[u.name] || [];
        const userShifts = generateFullScheduleForUser(u, leaves, ruleEnabled, autoScheduleDaysLimit, targetY, targetM, shiftTimes);
        allShifts = [...allShifts, ...userShifts];
    });

    let updatedShifts = [...allShifts];
    const uniqueDates = [...new Set(updatedShifts.map((s) => s.date))];

    uniqueDates.forEach((date) => {
        const [y, m, d] = date.split('/').map(Number);
        const info = getDayInfo(y, m, d);

        const getCoverage = (h) =>
        updatedShifts.filter((s) => s.date === date && isHourInTimeStr(h, s.time)).length;

        let changed = true;
        let passes = 0;

        while (changed && passes < 3) {
        changed = false;
        passes++;

        updatedShifts.forEach((shift) => {
            if (shift.date !== date) return;
            const uInfo = registeredUsers.find((u) => u.name === shift.assignee);
            if (!uInfo || !uInfo.role.includes('兼職')) return;

            if (!info.isOffDay) {
            if (uInfo.role.includes('早班兼職')) {
                const dem11 = getDemandForHour(11, false, timeBlockDemands);
                const cov11 = getCoverage(11);
                const dem18 = getDemandForHour(18, false, timeBlockDemands);
                const cov18 = getCoverage(18);

                if (shift.time === getTime('part_morning_weekday') && cov11 > dem11 && cov18 < dem18) {
                shift.time = getTime('part_night_weekday');
                shift.shiftCategory = '晚班';
                changed = true;
                } else if (shift.time === getTime('part_night_weekday') && cov18 > dem18 && cov11 < dem11) {
                shift.time = getTime('part_morning_weekday');
                shift.shiftCategory = '早班';
                changed = true;
                }
            }
            } else {
            const dem11 = getDemandForHour(11, true, timeBlockDemands);
            const cov11 = getCoverage(11);
            const dem15 = getDemandForHour(15, true, timeBlockDemands);
            const cov15 = getCoverage(15);
            const dem17 = getDemandForHour(17, true, timeBlockDemands);
            const cov17 = getCoverage(17);

            if (shift.time === getTime('part_morning_weekend')) {
                if (cov17 > dem17 && cov15 < dem15) {
                shift.time = getTime('part_morning_weekend_alt');
                shift.shiftCategory = '早班';
                changed = true;
                }
            } else if (shift.time === getTime('part_morning_weekend_alt')) {
                if (cov15 > dem15 && cov17 < dem17) {
                shift.time = getTime('part_morning_weekend');
                shift.shiftCategory = '早班';
                changed = true;
                }
            }
            }
        });
        }
    });

    setShifts(updatedShifts);
    if (firebaseUser) syncStateToCloud(firebaseUser, { shifts: updatedShifts });
  };

  const handleUpdateAnnouncement = (newText) => {
    setAnnouncement(newText);
    syncStateToCloud(firebaseUser, { announcement: newText });
  };

  const handleLoginSuccess = (userName, userRole) => {
    setCurrentUser(userName);
    setRole(userRole);
    setActiveScreen(userRole === 'manager' ? 'home' : 'leave_request');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setRole(null);
    setActiveScreen('login');
  };

  const onRegisterNew = (name, password, role) => {
    const newUser = { id: Date.now().toString(), name, password, role };
    const newUsers = [...registeredUsers, newUser];
    setRegisteredUsers(newUsers);
    syncStateToCloud(firebaseUser, { users: newUsers });
    return { success: true };
  }

  return (
    <div className="h-[100dvh] w-full sm:max-w-md sm:mx-auto sm:border-x sm:border-gray-200 sm:shadow-2xl bg-[#f5f6f8] font-sans overflow-hidden relative flex flex-col">
      <style dangerouslySetInnerHTML={{ __html: `.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }` }} />
      
      {activeScreen === 'login' && <LoginScreen onLogin={handleLoginSuccess} onGoRegister={() => setActiveScreen('register')} registeredUsers={registeredUsers} />}
      {activeScreen === 'register' && <RegisterScreen onGoLogin={() => setActiveScreen('login')} registeredUsers={registeredUsers} onRegister={onRegisterNew} />}
      
      {activeScreen === 'home' && <HomeScreen role={role} currentUser={currentUser} onLogout={handleLogout} shifts={shifts} timeBlockDemands={timeBlockDemands} registeredUsers={registeredUsers} employeeLeaves={employeeLeaves} leaveSettings={leaveSettings} onApproveLeave={handleApproveLeave} onRejectLeave={handleRejectLeave} onOpenEditor={() => navigateTo('schedule_editor')} onOpenLeaveApproval={() => navigateTo('leave_approval')} />}
      
      {activeScreen === 'leave_approval' && <LeaveApprovalScreen onBack={handleBack} employeeLeaves={employeeLeaves} onApproveLeave={handleApproveLeave} onRejectLeave={handleRejectLeave} onApproveAll={handleApproveAllLeavesForDate} onRejectAll={handleRejectAllLeavesForDate} />}

      {activeScreen === 'schedule_editor' && <ScheduleEditorScreen shifts={shifts} registeredUsers={registeredUsers} employeeLeaves={employeeLeaves} timeBlockDemands={timeBlockDemands} onAddShift={handleAddManualShift} onRemoveShift={handleRemoveManualShift} onAutoSchedule={handleAutoSchedule} onBack={handleBack} ruleEnabled={ruleEnabled} leaveSettings={leaveSettings} announcement={announcement} onNavigate={navigateTo} />}
      
      {activeScreen === 'leave_request' && <LeaveRequestScreen onBack={handleBack} currentUser={currentUser} employeeLeaves={employeeLeaves} leaveSettings={leaveSettings} onSaveLeaves={handleSaveLeaves} announcement={announcement} onLogout={handleLogout} />}
      
      {activeScreen === 'employee_management' && <EmployeeManagementScreen onBack={handleBack} registeredUsers={registeredUsers} employeeLeaves={employeeLeaves} leaveSettings={leaveSettings} onUpdateEmployee={handleUpdateEmployee} onDelete={handleDeleteEmployee} onAddLeave={handleAddEmployeeLeave} onRemoveLeave={handleRemoveEmployeeLeave} />}
      
      {activeScreen === 'backend_settings' && <BackendSettingsScreen onBack={handleBack} ruleEnabled={ruleEnabled} setRuleEnabled={setRuleEnabled} leaveSettings={leaveSettings} onUpdateLeaveSettings={handleUpdateLeaveSettings} announcement={announcement} onUpdateAnnouncement={handleUpdateAnnouncement} shiftTimes={shiftTimes} onUpdateShiftTimes={handleUpdateShiftTimes} timeBlockDemands={timeBlockDemands} onUpdateTimeBlockDemands={handleUpdateTimeBlockDemands} businessHours={businessHours} onUpdateBusinessHours={handleUpdateBusinessHours} />}
      
      {activeScreen === 'employee_profile' && <EmployeeProfileScreen currentUser={currentUser} registeredUsers={registeredUsers} employeeLeaves={employeeLeaves} shifts={shifts} leaveSettings={leaveSettings} />}
      
      {activeScreen !== 'login' && activeScreen !== 'register' && <BottomNav role={role} activeScreen={activeScreen} onNavigate={navigateTo} pendingCount={pendingLeavesCount} />}
    </div>
  );
}
