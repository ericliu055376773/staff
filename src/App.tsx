import React, { useState } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Home,
  Heart,
  User,
  Calendar as CalendarIcon,
  Plus,
  Users,
  Briefcase,
  Clock,
  ShieldCheck,
  RefreshCw,
  CheckCircle,
  PenTool,
  AlertCircle,
  Lock,
  LogOut,
  Layers,
  Wand2,
  Settings,
  Trash2,
  Bell,
  XCircle,
} from 'lucide-react';

// ==========================================
// 1. 工具函數與核心演算法
// ==========================================

const isWeekendDay = (day) => {
  const rem = day % 7;
  return rem === 1 || rem === 0;
};

const generateRandomLeaves = () => {
  const leaves = new Map();
  let wknd = 0;
  let wkdy = 0;

  while (leaves.size < 8) {
    const day = Math.floor(Math.random() * 31) + 1;
    const dateStr = `3/${day}`;
    if (leaves.has(dateStr)) continue;

    const isWknd = isWeekendDay(day);
    if (isWknd && wknd < 1) {
      leaves.set(dateStr, { date: dateStr, status: 'approved' });
      wknd++;
    } else if (!isWknd && wkdy < 7) {
      leaves.set(dateStr, { date: dateStr, status: 'approved' });
      wkdy++;
    }
  }
  return Array.from(leaves.values());
};

const generateRandomChineseName = () => {
  const lastNames = [
    '陳',
    '林',
    '黃',
    '張',
    '李',
    '王',
    '吳',
    '劉',
    '蔡',
    '楊',
    '許',
    '鄭',
    '謝',
    '洪',
    '郭',
    '邱',
    '曾',
    '廖',
    '賴',
    '徐',
    '周',
    '葉',
    '蘇',
    '莊',
    '呂',
  ];
  const firstNames = [
    '建國',
    '佳穎',
    '志明',
    '雅婷',
    '俊宏',
    '心怡',
    '家豪',
    '欣儀',
    '宗翰',
    '婉婷',
    '哲宇',
    '佩珊',
    '柏翰',
    '靜宜',
    '承恩',
    '淑君',
    '冠宇',
    '怡君',
    '育瑋',
    '欣怡',
    '宇軒',
    '美玲',
    '子齊',
    '惠雯',
    '信宏',
    '怡婷',
    '建良',
    '秀英',
  ];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  return `${lastName}${firstName}`;
};

const getBaseType = (typeStr) => {
  if (typeStr.includes('早班')) return '早班';
  if (typeStr.includes('晚班')) return '晚班';
  return typeStr.split(' (')[0];
};

const isHourInTimeStr = (hour, timeStr) => {
  if (!timeStr || timeStr.includes('待定')) return false;
  const parts = timeStr.split('&').map((p) => p.trim());
  return parts.some((part) => {
    let [start, end] = part.split('-');
    if (!start || !end) return false;
    let sH = parseInt(start.split(':')[0], 10);
    let eH = parseInt(end.split(':')[0], 10);
    if (eH === 0) eH = 24;
    return hour >= sH && hour < eH;
  });
};

const getDemandForHour = (hour, isWeekend, demands) => {
  let blockId = '';
  if (hour >= 11 && hour < 15) blockId = 'tb1';
  else if (hour >= 15 && hour < 17) blockId = 'tb2';
  else if (hour >= 17 && hour < 22) blockId = 'tb3';
  else if (hour >= 22 && hour < 24) blockId = 'tb4';

  const block = demands.find((d) => d.id === blockId);
  if (!block) return 0;
  return isWeekend ? block.reqWeekend : block.reqWeekday;
};

const getRoleDefaultTime = (role, isWeekend) => {
  if (role === '早班正職') return '11:00 - 15:00 & 17:00 - 22:00';
  if (role === '晚班正職') return '15:00 - 00:00';
  if (role === '早班兼職')
    return isWeekend ? '11:00 - 15:00 & 17:00 - 22:00' : '11:00 - 15:00';
  if (role === '晚班兼職')
    return isWeekend ? '11:00 - 15:00 & 17:00 - 22:00' : '18:00 - 22:00';
  return '11:00 - 15:00';
};

const isDayUnderstaffed = (dateStr, isWeekend, shifts, demands) => {
  const dayShifts = shifts.filter((s) => s.date === dateStr);
  const checkHours = [11, 15, 17, 22];
  for (let hour of checkHours) {
    const demand = getDemandForHour(hour, isWeekend, demands);
    const coverage = dayShifts.filter((s) =>
      isHourInTimeStr(hour, s.time)
    ).length;
    if (coverage < demand) return true;
  }
  return false;
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const parseDate = (dStr) => {
  const [m, d] = dStr.split('/');
  return new Date(2026, parseInt(m) - 1, parseInt(d)).getTime();
};

const check7DayRule = (targetDateStr, empWorkDaysSet) => {
  const targetTime = parseDate(targetDateStr);
  const workTimes = Array.from(empWorkDaysSet).map(parseDate);
  workTimes.push(targetTime);

  for (let i = 0; i <= 6; i++) {
    const windowStart = targetTime - i * MS_PER_DAY;
    const windowEnd = windowStart + 6 * MS_PER_DAY;
    let daysInWindow = 0;
    for (const t of workTimes) {
      if (t >= windowStart && t <= windowEnd) {
        daysInWindow++;
      }
    }
    if (daysInWindow > 5) return false;
  }
  return true;
};

const generateFullScheduleForUser = (
  user,
  leavesArray,
  ruleEnabled,
  monthlyLeaveDays
) => {
  if (!user.role) return [];
  const isLeave = Array(31).fill(false);
  leavesArray.forEach((l) => {
    const day = parseInt(l.date.split('/')[1]);
    isLeave[day - 1] = true;
  });

  let extraLeaves = monthlyLeaveDays - leavesArray.length;

  for (let i = 0; i < 31; i++) {
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

  for (let i = 30; i >= 0 && extraLeaves > 0; i--) {
    if (!isLeave[i]) {
      isLeave[i] = true;
      extraLeaves--;
    }
  }

  const newShifts = [];
  for (let i = 0; i < 31; i++) {
    if (!isLeave[i]) {
      const dayNum = i + 1;
      const dateStr = `3/${dayNum}`;
      const dayOfWeek = (dayNum + 6) % 7;
      const dayStr = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'][
        dayOfWeek
      ];
      const isWknd = isWeekendDay(dayNum);
      const exactTime = getRoleDefaultTime(user.role, isWknd);

      newShifts.push({
        id: `auto_${user.id}_${dateStr}_${Math.random()}`,
        date: dateStr,
        day: dayStr,
        type: user.role,
        time: exactTime,
        assignee: user.name,
        status: 'confirmed',
      });
    }
  }
  return newShifts;
};

// ==========================================
// 2. 系統初始測試資料
// ==========================================

// 🌟 修正：平日 11:00-15:00 需求人數已精準調整為 5 人
const initialTimeBlockDemands = [
  { id: 'tb1', name: '11:00 - 15:00', reqWeekday: 5, reqWeekend: 15 },
  { id: 'tb2', name: '15:00 - 17:00', reqWeekday: 5, reqWeekend: 7 },
  { id: 'tb3', name: '17:00 - 22:00', reqWeekday: 15, reqWeekend: 19 },
  { id: 'tb4', name: '22:00 - 00:00', reqWeekday: 5, reqWeekend: 6 },
];

const initialRegisteredUsers = [
  { id: 'u1', name: '陳建國', password: '000000', role: '早班正職' },
  { id: 'u2', name: '李佳穎', password: '111111', role: '晚班兼職' },
  { id: 'u3', name: '林美玲', password: '222222', role: '早班兼職' },
  { id: 'u4', name: '王志明', password: '333333', role: '晚班正職' },
];

const initialLeavesMap = {
  陳建國: generateRandomLeaves(),
  李佳穎: generateRandomLeaves(),
  林美玲: generateRandomLeaves(),
  王志明: generateRandomLeaves(),
};

const generateInitialShifts = () => {
  let allShifts = [];
  initialRegisteredUsers.forEach((u) => {
    const leaves = initialLeavesMap[u.name] || [];
    const userShifts = generateFullScheduleForUser(u, leaves, true, 8);
    allShifts = [...allShifts, ...userShifts];
  });
  return allShifts;
};

// ==========================================
// 3. 共用與 UI 元件
// ==========================================

function ActionCard({ icon, label, active, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`flex-shrink-0 w-28 h-32 rounded-[2rem] p-4 flex flex-col justify-between cursor-pointer transition-transform hover:scale-105 ${
        active
          ? 'bg-[#18181A] text-white shadow-xl shadow-black/10'
          : 'bg-white text-gray-800 shadow-sm border border-gray-100'
      }`}
    >
      <div className={`mt-2 ${active ? 'text-white' : 'text-gray-800'}`}>
        {icon}
      </div>
      <span className="text-xs font-bold tracking-wider uppercase mb-1">
        {label}
      </span>
    </div>
  );
}

function BottomNav({ role, activeScreen, onNavigate }) {
  return (
    <nav className="absolute bottom-0 left-0 w-full bg-white/85 backdrop-blur-md border-t border-gray-100 px-8 py-5 flex justify-between items-center z-50">
      {role === 'manager' ? (
        <>
          <button
            onClick={() => onNavigate('home')}
            className={`${
              activeScreen === 'home'
                ? 'text-[#2563EB]'
                : 'text-gray-400 hover:text-gray-800'
            } transition-transform active:scale-90`}
          >
            <Home
              size={24}
              strokeWidth={2.5}
              fill={activeScreen === 'home' ? 'currentColor' : 'none'}
            />
          </button>
          <button
            onClick={() => onNavigate('schedule_editor')}
            className={`${
              activeScreen === 'schedule_editor'
                ? 'text-[#2563EB]'
                : 'text-gray-400 hover:text-gray-800'
            } transition-colors active:scale-90 relative`}
          >
            <CalendarIcon
              size={24}
              strokeWidth={activeScreen === 'schedule_editor' ? 2.5 : 2}
            />
          </button>
          <button
            onClick={() => onNavigate('employee_management')}
            className={`${
              activeScreen === 'employee_management'
                ? 'text-[#2563EB]'
                : 'text-gray-400 hover:text-gray-800'
            } transition-colors active:scale-90`}
          >
            <User
              size={24}
              strokeWidth={activeScreen === 'employee_management' ? 2.5 : 2}
            />
          </button>
          <button
            onClick={() => onNavigate('backend_settings')}
            className={`${
              activeScreen === 'backend_settings'
                ? 'text-[#2563EB]'
                : 'text-gray-400 hover:text-gray-800'
            } transition-colors active:scale-90 relative`}
          >
            <Settings
              size={24}
              strokeWidth={activeScreen === 'backend_settings' ? 2.5 : 2}
            />
          </button>
        </>
      ) : (
        <div className="w-full flex justify-around items-center">
          <button
            onClick={() => onNavigate('leave_request')}
            className={`${
              activeScreen === 'leave_request'
                ? 'text-[#2563EB]'
                : 'text-gray-400 hover:text-gray-800'
            } transition-colors active:scale-90 flex flex-col items-center gap-1`}
          >
            <Home
              size={24}
              strokeWidth={activeScreen === 'leave_request' ? 2.5 : 2}
              fill={activeScreen === 'leave_request' ? 'currentColor' : 'none'}
            />
            <span className="text-[10px] font-bold">排休</span>
          </button>
          <button
            onClick={() => onNavigate('employee_profile')}
            className={`${
              activeScreen === 'employee_profile'
                ? 'text-[#2563EB]'
                : 'text-gray-400 hover:text-gray-800'
            } transition-colors active:scale-90 flex flex-col items-center gap-1`}
          >
            <User
              size={24}
              strokeWidth={activeScreen === 'employee_profile' ? 2.5 : 2}
            />
            <span className="text-[10px] font-bold">我的</span>
          </button>
        </div>
      )}
    </nav>
  );
}

function EmployeeEditCard({ user, allUsers, userLeaves, onUpdate, onDelete }) {
  const [localName, setLocalName] = useState(user.name);
  const [localRole, setLocalRole] = useState(user.role);
  const [localPassword, setLocalPassword] = useState(user.password);
  const [pwdError, setPwdError] = useState('');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const handleBlur = () => {
    if (!/^\d{6}$/.test(localPassword)) {
      setPwdError('需為6位數字');
      setLocalPassword(user.password);
      return;
    }
    if (
      allUsers.some((u) => u.password === localPassword && u.id !== user.id)
    ) {
      setPwdError('密碼已重複');
      setLocalPassword(user.password);
      return;
    }
    setPwdError('');

    if (
      localName.trim() &&
      (localName !== user.name ||
        localRole !== user.role ||
        localPassword !== user.password)
    ) {
      onUpdate(user.id, localName.trim(), localRole, localPassword);
    } else {
      setLocalName(user.name);
    }
  };

  const handleRoleChange = (e) => {
    const newRole = e.target.value;
    setLocalRole(newRole);
    onUpdate(user.id, localName.trim(), newRole, localPassword);
  };

  return (
    <div className="bg-white rounded-[1.5rem] p-4 shadow-[0_4px_15px_rgb(0,0,0,0.03)] border border-gray-50 flex flex-col gap-3 transition-shadow hover:shadow-md relative">
      {showConfirmDelete && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-20 rounded-[1.5rem] flex flex-col items-center justify-center p-4">
          <p className="text-sm font-bold text-red-600 mb-4">
            確定刪除 {localName} 嗎？此操作不可逆。
          </p>
          <div className="flex gap-3 w-full">
            <button
              onClick={() => setShowConfirmDelete(false)}
              className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm"
            >
              取消
            </button>
            <button
              onClick={() => onDelete(user.id)}
              className="flex-1 py-2 bg-red-500 text-white rounded-xl font-bold text-sm shadow-md"
            >
              確定刪除
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${
              localRole.includes('兼職') ? 'bg-orange-500' : 'bg-[#111]'
            }`}
          >
            {localName.charAt(0)}
          </div>
          <div className="flex-1">
            <input
              type="text"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              onBlur={handleBlur}
              className="w-full font-bold text-[#111] text-[15px] bg-transparent border-b border-transparent hover:border-gray-200 focus:border-blue-500 focus:outline-none transition-colors pb-1"
              placeholder="員工名稱"
            />
          </div>
        </div>
        <button
          onClick={() => setShowConfirmDelete(true)}
          className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors shrink-0 ml-2"
          title="刪除員工"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="bg-gray-50 rounded-xl p-2.5 flex items-center justify-between border border-gray-100 mt-1">
        <span className="text-xs font-bold text-gray-500 flex items-center gap-1.5 ml-1">
          <Briefcase size={12} /> 職位身分綁定
        </span>
        <select
          value={localRole}
          onChange={handleRoleChange}
          className={`appearance-none font-bold text-xs py-1.5 pl-3 pr-8 rounded-lg border focus:outline-none focus:ring-2 cursor-pointer shadow-sm relative z-10 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%232563EB%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.4-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[length:8px_8px] bg-[right_10px_center] ${
            localRole.includes('兼職')
              ? 'bg-orange-50 text-orange-600 border-orange-100 focus:ring-orange-500'
              : 'bg-blue-50 text-blue-600 border-blue-100 focus:ring-blue-500'
          }`}
        >
          <option value="早班正職">早班正職</option>
          <option value="晚班正職">晚班正職</option>
          <option value="早班兼職">早班兼職</option>
          <option value="晚班兼職">晚班兼職</option>
        </select>
      </div>
      <div className="bg-gray-50 rounded-xl p-2.5 flex items-center justify-between border border-gray-100">
        <span className="text-xs font-bold text-gray-500 flex items-center gap-1.5 ml-1">
          <Lock size={12} /> 登入密碼
        </span>
        <div className="flex items-center gap-2">
          {pwdError && (
            <span className="text-[10px] text-red-500 font-bold animate-pulse">
              {pwdError}
            </span>
          )}
          <input
            type="text"
            maxLength={6}
            value={localPassword}
            onChange={(e) =>
              setLocalPassword(e.target.value.replace(/\D/g, ''))
            }
            onBlur={handleBlur}
            placeholder="6位數字"
            className={`w-20 font-bold text-xs py-1.5 px-2 rounded-lg border focus:outline-none focus:ring-2 text-center shadow-sm transition-colors ${
              pwdError
                ? 'bg-red-50 border-red-300 text-red-600 focus:ring-red-500'
                : 'bg-white border-blue-100 text-blue-600 focus:ring-blue-500'
            }`}
          />
        </div>
      </div>
      <div className="bg-gray-50 rounded-xl p-2.5 flex flex-col gap-2 border border-gray-100">
        <div className="flex items-center justify-between ml-1">
          <span className="text-xs font-bold text-gray-500 flex items-center gap-1.5">
            <CalendarIcon size={12} /> 排休狀況 ({userLeaves.length}/8)
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {userLeaves.length > 0 ? (
            userLeaves.map((l) => (
              <span
                key={l.date}
                className={`text-[10px] px-2 py-1 rounded-md font-bold ${
                  l.status === 'pending'
                    ? 'bg-orange-100 text-orange-600 border border-orange-200'
                    : 'bg-green-100 text-green-600 border border-green-200'
                }`}
              >
                {l.date} {l.status === 'pending' ? '(待核)' : ''}
              </span>
            ))
          ) : (
            <span className="text-[10px] text-gray-400 font-medium px-1">
              尚未排假
            </span>
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
    if (!password) {
      setError('請輸入密碼');
      return;
    }
    const user = registeredUsers.find((u) => u.password === password);
    if (!user) {
      setError('密碼錯誤或尚未註冊');
      return;
    }
    onLogin(user.name, 'employee');
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 bg-white animate-in fade-in duration-300">
      <div
        className="flex flex-col items-center mb-10 cursor-pointer hover:scale-105 transition-transform"
        onClick={() => {
          setIsManagerMode(!isManagerMode);
          setError('');
          setPassword('');
        }}
      >
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg mb-4 ${
            isManagerMode
              ? 'bg-[#111] shadow-black/20'
              : 'bg-blue-600 shadow-blue-600/30'
          }`}
        >
          {isManagerMode ? (
            <ShieldCheck size={32} className="text-white" />
          ) : (
            <CalendarIcon size={32} className="text-white" />
          )}
        </div>
        <h1 className="text-2xl font-extrabold text-[#111] tracking-tight">
          {isManagerMode ? '管理員後台' : '線上排班系統'}
        </h1>
        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">
          {isManagerMode ? 'Manager Access' : 'Employee Portal'}
        </p>
      </div>
      <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
        {error && (
          <div className="bg-red-50 text-red-500 text-sm font-bold p-3 rounded-xl flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            密碼
          </label>
          <div className="relative">
            <Lock
              className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                isManagerMode
                  ? '請輸入 4 位數管理密碼'
                  : '請輸入 6 位數員工密碼'
              }
              className="w-full bg-gray-50 text-gray-800 font-medium py-3.5 pl-11 pr-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all border border-transparent focus:border-blue-100"
            />
          </div>
        </div>
        <button
          type="submit"
          className={`w-full py-4 rounded-2xl text-white font-bold shadow-lg mt-4 active:scale-[0.98] transition-all ${
            isManagerMode
              ? 'bg-[#111] shadow-black/20 hover:bg-gray-800'
              : 'bg-blue-600 shadow-blue-600/30 hover:bg-blue-700'
          }`}
        >
          {isManagerMode ? '進入後台' : '登入系統'}
        </button>
      </form>
      {!isManagerMode && (
        <div className="mt-8 text-sm font-medium text-gray-500">
          新進員工？{' '}
          <button
            onClick={onGoRegister}
            className="text-blue-600 font-bold hover:underline"
          >
            點此註冊個人資料
          </button>
        </div>
      )}
    </div>
  );
}

function RegisterScreen({ onGoLogin, registeredUsers, setRegisteredUsers }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [empRole, setEmpRole] = useState('早班正職');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleRegister = (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('姓氏/姓名為必填欄位');
      return;
    }
    if (!/^\d{6}$/.test(password)) {
      setError('註冊密碼必須為 6 位數字');
      return;
    }
    if (password !== confirmPassword) {
      setError('兩次輸入的密碼不一致');
      return;
    }
    if (registeredUsers.some((u) => u.name === name)) {
      setError('此姓名已經註冊過囉！');
      return;
    }
    if (registeredUsers.some((u) => u.password === password)) {
      setError('此密碼已被使用，請更換一組 6 位數字');
      return;
    }

    setRegisteredUsers((prev) => [
      ...prev,
      { id: Date.now().toString(), name: name.trim(), password, role: empRole },
    ]);
    setSuccess(true);
    setTimeout(() => {
      onGoLogin();
    }, 2000);
  };

  if (success) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 bg-white animate-in fade-in duration-300">
        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center text-green-500 mb-6">
          <CheckCircle size={40} />
        </div>
        <h2 className="text-2xl font-bold text-[#111] mb-2">註冊成功！</h2>
        <p className="text-gray-500 font-medium text-center">
          正在為您跳轉至登入畫面...
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col px-8 pt-12 bg-white animate-in slide-in-from-right-8 duration-300 overflow-y-auto pb-12">
      <button
        onClick={onGoLogin}
        className="w-10 h-10 bg-gray-50 hover:bg-gray-100 rounded-full flex items-center justify-center text-gray-800 transition mb-8"
      >
        <ChevronLeft size={24} />
      </button>
      <h1 className="text-3xl font-extrabold text-[#111] tracking-tight mb-2">
        員工註冊
      </h1>
      <p className="text-sm font-medium text-gray-500 mb-8">
        請建立您的個人資料以便進行線上排班與排休。
      </p>
      <form onSubmit={handleRegister} className="w-full space-y-5">
        {error && (
          <div className="bg-red-50 text-red-500 text-sm font-bold p-3 rounded-xl flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            姓氏 / 姓名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：王小明"
            className="w-full bg-gray-50 text-gray-800 font-medium py-3.5 px-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all border border-transparent focus:border-blue-100"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            職位類型 <span className="text-red-500">*</span>
          </label>
          <select
            value={empRole}
            onChange={(e) => setEmpRole(e.target.value)}
            className="w-full bg-gray-50 text-gray-800 font-medium py-3.5 px-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all border border-transparent focus:border-blue-100 cursor-pointer"
          >
            <option value="早班正職">早班正職</option>
            <option value="晚班正職">晚班正職</option>
            <option value="早班兼職">早班兼職</option>
            <option value="晚班兼職">晚班兼職</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            設定密碼 <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="請輸入 6 位數字"
            maxLength={6}
            className="w-full bg-gray-50 text-gray-800 font-medium py-3.5 px-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all border border-transparent focus:border-blue-100"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            確認密碼 <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="請再次輸入 6 位數字密碼"
            maxLength={6}
            className="w-full bg-gray-50 text-gray-800 font-medium py-3.5 px-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all border border-transparent focus:border-blue-100"
          />
        </div>
        <button
          type="submit"
          className="w-full py-4 rounded-2xl bg-[#111] text-white font-bold shadow-lg shadow-black/10 hover:bg-gray-800 mt-6 active:scale-[0.98] transition-all"
        >
          完成註冊
        </button>
      </form>
    </div>
  );
}

function HomeScreen({
  role,
  currentUser,
  onLogout,
  shifts,
  timeBlockDemands,
  registeredUsers,
  employeeLeaves,
  onApproveLeave,
  onRejectLeave,
  onShiftSelect,
  onOpenEditor,
  onOpenLeaveRequest,
}) {
  const [selectedHomeDate, setSelectedHomeDate] = useState('3/16');
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  const getUserTypeBadge = (name) => {
    const u = registeredUsers.find((user) => user.name === name);
    if (!u) return null;
    return u.role.includes('兼職') ? (
      <span className="bg-orange-100 text-orange-600 text-[9px] px-1.5 py-0.5 rounded font-black ml-1 shrink-0">
        兼
      </span>
    ) : (
      <span className="bg-blue-100 text-blue-600 text-[9px] px-1.5 py-0.5 rounded font-black ml-1 shrink-0">
        正
      </span>
    );
  };

  const displayShifts =
    role === 'manager'
      ? shifts
      : shifts.filter((s) => s.assignee === currentUser);
  const marchDays = Array.from({ length: 31 }, (_, i) => i + 1);
  const timelineHours = Array.from({ length: 13 }, (_, i) => i + 11);

  const pendingLeaves = [];
  if (role === 'manager') {
    Object.entries(employeeLeaves).forEach(([emp, leaves]) => {
      leaves
        .filter((l) => l.status === 'pending')
        .forEach((l) => {
          pendingLeaves.push({ emp, date: l.date });
        });
    });
  }

  const leavesOnSelectedDate = Object.entries(employeeLeaves).reduce(
    (acc, [emp, leaves]) => {
      const leave = leaves.find((l) => l.date === selectedHomeDate);
      if (leave) acc.push({ emp, status: leave.status });
      return acc;
    },
    []
  );

  const getRoleCountsForDate = (dateStr) => {
    const dayShifts = displayShifts.filter((s) => s.date === dateStr);
    let counts = { morn_full: 0, night_full: 0, morn_part: 0, night_part: 0 };
    dayShifts.forEach((s) => {
      if (s.type === '早班正職') counts.morn_full++;
      else if (s.type === '晚班正職') counts.night_full++;
      else if (s.type === '早班兼職') counts.morn_part++;
      else if (s.type === '晚班兼職') counts.night_part++;
    });
    return counts;
  };

  const roleCounts = getRoleCountsForDate(selectedHomeDate);

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar pb-32 animate-in fade-in duration-300 relative">
      <header className="flex flex-col px-8 pt-12 pb-4">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm ${
                role === 'manager' ? 'bg-[#111]' : 'bg-blue-600'
              }`}
            >
              {currentUser ? currentUser.charAt(0) : '無'}
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-[#111] tracking-tight">
                {currentUser || '未登入'}
              </h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                {role === 'manager' ? '管理員' : '員工'}
              </p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-10 h-10 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full flex items-center justify-center transition"
            title="登出"
          >
            <LogOut size={18} strokeWidth={2.5} />
          </button>
        </div>
      </header>

      {role === 'manager' && pendingLeaves.length > 0 && (
        <div className="mx-8 mt-1 mb-5 bg-orange-50 border border-orange-200 p-4 rounded-2xl flex justify-between items-center shadow-sm animate-in slide-in-from-top-4">
          <div className="flex items-center gap-2">
            <Bell size={20} className="text-orange-500 animate-bounce" />
            <div>
              <h3 className="text-orange-800 font-bold text-sm">
                待審核假單 ({pendingLeaves.length})
              </h3>
              <p className="text-orange-600 text-[10px] font-bold">
                員工排休導致該日預警
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowApprovalModal(true)}
            className="bg-orange-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-md hover:bg-orange-600 transition-colors"
          >
            立即審核
          </button>
        </div>
      )}

      {role === 'manager' && (
        <section className="px-8 mt-2">
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 -mx-8 px-8">
            <ActionCard
              icon={<CalendarIcon size={28} />}
              label="排班"
              active={true}
              onClick={onOpenEditor}
            />
          </div>
        </section>
      )}

      <section
        className={`${
          role === 'manager' ? 'mt-6' : 'mt-2'
        } bg-white rounded-t-[2.5rem] pt-8 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.02)] min-h-[400px]`}
      >
        <div className="px-8 flex justify-between items-end mb-6">
          <div>
            <h2 className="text-2xl font-extrabold text-[#111] tracking-tight">
              3月份
            </h2>
            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mt-1">
              March 2026
            </p>
          </div>
          <div className="flex gap-2">
            <button className="w-8 h-8 flex items-center justify-center bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-full transition">
              <ChevronLeft size={16} strokeWidth={2.5} />
            </button>
            <button className="w-8 h-8 flex items-center justify-center bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-full transition">
              <ChevronRight size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        <div className="px-8 mb-8">
          <div className="grid grid-cols-7 gap-x-2 gap-y-3">
            {['日', '一', '二', '三', '四', '五', '六'].map((d) => (
              <div
                key={d}
                className="text-center text-[10px] font-bold text-gray-400 mb-1"
              >
                {d}
              </div>
            ))}
            {marchDays.map((day) => {
              const dateStr = `3/${day}`;
              const isWknd = isWeekendDay(day);
              const hasShift = displayShifts.some((s) => s.date === dateStr);
              const isSelected = selectedHomeDate === dateStr;
              const isUnderstaffed = isDayUnderstaffed(
                dateStr,
                isWknd,
                shifts,
                timeBlockDemands
              );

              const myLeaves =
                role !== 'manager' ? employeeLeaves[currentUser] || [] : [];
              const myLeaveToday = myLeaves.find((l) => l.date === dateStr);

              let btnClass = 'bg-transparent text-gray-600 hover:bg-gray-50';
              if (isSelected)
                btnClass =
                  'bg-[#111] text-white shadow-lg transform scale-110 z-10';
              else if (myLeaveToday)
                btnClass =
                  myLeaveToday.status === 'pending'
                    ? 'bg-orange-50 text-orange-600 border border-orange-100'
                    : 'bg-green-50 text-green-600 border border-green-100';
              else if (hasShift)
                btnClass = 'bg-blue-50/50 text-blue-700 hover:bg-blue-100';
              else if (isUnderstaffed)
                btnClass =
                  'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100';

              return (
                <button
                  key={day}
                  onClick={() => setSelectedHomeDate(dateStr)}
                  className={`relative w-full aspect-square rounded-2xl flex flex-col items-center justify-center transition-all duration-200 ${btnClass}`}
                >
                  <span
                    className={`text-[15px] font-bold ${
                      isSelected ? 'text-white' : ''
                    }`}
                  >
                    {day}
                  </span>
                  {isUnderstaffed && !myLeaveToday && (
                    <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full shadow-sm border-2 border-white z-20"></div>
                  )}
                  {!isUnderstaffed &&
                    hasShift &&
                    !isSelected &&
                    !myLeaveToday && (
                      <div className="absolute bottom-1.5 w-1 h-1 rounded-full bg-blue-500"></div>
                    )}
                  {hasShift && isSelected && !myLeaveToday && (
                    <div className="absolute bottom-1.5 w-1 h-1 rounded-full bg-white shadow-sm"></div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-8">
          <div className="flex items-center gap-2 mb-6 border-b border-gray-100 pb-2">
            <h3 className="text-sm font-bold text-[#111] tracking-wide">
              {selectedHomeDate}{' '}
              <span className="text-gray-400 font-medium">當日時段班表</span>
            </h3>
          </div>

          {role === 'manager' && (
            <div className="mb-6 grid grid-cols-2 gap-2">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-2.5 flex justify-between items-center shadow-sm">
                <span className="text-[11px] font-bold text-blue-800">
                  早班正職
                </span>
                <span className="text-sm font-black text-blue-600">
                  {roleCounts.morn_full} 人
                </span>
              </div>
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-2.5 flex justify-between items-center shadow-sm">
                <span className="text-[11px] font-bold text-indigo-800">
                  晚班正職
                </span>
                <span className="text-sm font-black text-indigo-600">
                  {roleCounts.night_full} 人
                </span>
              </div>
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-2.5 flex justify-between items-center shadow-sm">
                <span className="text-[11px] font-bold text-orange-800">
                  早班兼職
                </span>
                <span className="text-sm font-black text-orange-600">
                  {roleCounts.morn_part} 人
                </span>
              </div>
              <div className="bg-rose-50 border border-rose-100 rounded-xl p-2.5 flex justify-between items-center shadow-sm">
                <span className="text-[11px] font-bold text-rose-800">
                  晚班兼職
                </span>
                <span className="text-sm font-black text-rose-600">
                  {roleCounts.night_part} 人
                </span>
              </div>
            </div>
          )}

          {leavesOnSelectedDate.length > 0 && (
            <div className="mb-6 bg-green-50/60 border border-green-100 p-3 rounded-2xl flex flex-wrap items-center gap-2 shadow-sm">
              <Briefcase size={16} className="text-green-600 shrink-0" />
              <span className="text-green-800 text-xs font-bold mr-1">
                今日排休：
              </span>
              {leavesOnSelectedDate.map((l) => (
                <span
                  key={l.emp}
                  className={`text-[10px] px-2 py-1 rounded-lg font-bold shadow-sm ${
                    l.status === 'pending'
                      ? 'bg-orange-100 text-orange-600 border border-orange-200'
                      : 'bg-green-100 text-green-700 border border-green-200'
                  }`}
                >
                  {l.emp} {l.status === 'pending' ? '(待核)' : ''}
                </span>
              ))}
            </div>
          )}

          <div className="relative">
            <div className="absolute left-[2.8rem] top-2 bottom-2 w-px bg-gray-100"></div>
            {(() => {
              const shiftsForDate = displayShifts.filter(
                (s) => s.date === selectedHomeDate
              );
              const isWeekend = isWeekendDay(
                parseInt(selectedHomeDate.split('/')[1])
              );

              if (shiftsForDate.length === 0) {
                return (
                  <div className="text-center py-6 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <p className="text-gray-400 font-medium text-sm">
                      本日無排定班表
                    </p>
                  </div>
                );
              }

              return timelineHours.map((hour) => {
                const activeShifts = shiftsForDate.filter((s) =>
                  isHourInTimeStr(hour, s.time)
                );
                let showDeficit = 0;
                let demand = 0;
                if (role === 'manager') {
                  demand = getDemandForHour(hour, isWeekend, timeBlockDemands);
                  showDeficit = Math.max(0, demand - activeShifts.length);
                }

                return (
                  <div
                    key={hour}
                    className="flex items-start gap-5 py-3.5 relative"
                  >
                    <div className="w-10 text-right shrink-0 pt-1 relative z-10 bg-white">
                      <span className="text-xs font-black text-gray-400">
                        {hour}:00
                      </span>
                    </div>
                    <div className="absolute left-[2.8rem] top-4.5 -translate-x-1/2 w-[9px] h-[9px] rounded-full bg-gray-200 ring-4 ring-white z-10"></div>

                    <div className="flex-1 flex flex-col pl-3 pb-1">
                      {activeShifts.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {activeShifts.map((shift) => (
                            <div
                              key={shift.id}
                              className="bg-white border border-gray-100 text-[#111] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                            >
                              <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-blue-50 text-blue-600">
                                <User size={12} strokeWidth={2.5} />
                              </div>
                              <div className="flex flex-col items-start text-left">
                                <span className="text-[9px] opacity-60 leading-none mb-0.5 max-w-[140px] truncate">
                                  {shift.type}
                                </span>
                                <div className="flex items-center leading-none">
                                  <span className="truncate">
                                    {shift.assignee}
                                  </span>
                                  {getUserTypeBadge(shift.assignee)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="pt-1 mb-2">
                          <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">
                            — 該時段無人 —
                          </span>
                        </div>
                      )}

                      {/* 🌟 每個時段下方的「應到」與「缺額」統計卡片 */}
                      {role === 'manager' && (
                        <div className="flex items-center justify-between bg-gray-50 rounded-2xl px-4 py-3 mt-1 mb-3 w-full border border-gray-100 shadow-sm">
                          <div className="flex items-center gap-2 text-gray-600 font-bold text-[13px]">
                            <Users size={16} className="text-blue-500" />{' '}
                            應到總共 {demand} 人
                          </div>
                          {showDeficit > 0 ? (
                            <div className="flex items-center gap-1.5 text-red-500 font-bold text-[13px]">
                              <AlertCircle size={16} /> 缺 {showDeficit} 人
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-green-600 font-bold text-[13px]">
                              <CheckCircle size={16} /> 人手充足
                            </div>
                          )}
                        </div>
                      )}
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
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowApprovalModal(false)}
          ></div>
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm relative z-10 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-orange-500">
                <AlertCircle size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#111]">審核請假申請</h3>
                <p className="text-xs text-gray-500 font-bold mt-0.5">
                  請確認人手是否充足
                </p>
              </div>
            </div>
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
              {pendingLeaves.map((p, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl border border-gray-100"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-gray-800">
                        {p.emp}
                      </span>
                      <span className="text-[10px] text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded font-bold">
                        待審核
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 font-bold flex items-center gap-1">
                      <CalendarIcon size={12} /> {p.date} 申請休假
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onApproveLeave(p.emp, p.date)}
                      className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-100 transition shadow-sm"
                    >
                      <CheckCircle size={18} strokeWidth={2.5} />
                    </button>
                    <button
                      onClick={() => onRejectLeave(p.emp, p.date)}
                      className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition shadow-sm"
                    >
                      <XCircle size={18} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              ))}
              {pendingLeaves.length === 0 && (
                <div className="text-center py-6 text-gray-400 font-bold text-sm">
                  目前沒有待審核的假單！
                </div>
              )}
            </div>
            <button
              onClick={() => setShowApprovalModal(false)}
              className="mt-6 w-full py-3.5 rounded-2xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors"
            >
              完成並關閉
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmployeeProfileScreen({
  currentUser,
  registeredUsers,
  employeeLeaves,
}) {
  const user = registeredUsers.find((u) => u.name === currentUser);
  if (!user) return null;

  const leaves = employeeLeaves[currentUser] || [];
  const MAX_LEAVES = 8;

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar bg-[#f8f9fc] pb-32 animate-in slide-in-from-right-8 duration-300">
      <header className="sticky top-0 bg-[#f8f9fc]/90 backdrop-blur-md z-10 flex items-center px-8 pt-12 pb-6 border-b border-gray-200/50">
        <div>
          <h1 className="text-2xl font-extrabold text-[#111] tracking-tight">
            個人資料
          </h1>
          <p className="text-xs font-semibold text-gray-500 mt-0.5">
            My Profile
          </p>
        </div>
      </header>

      <div className="px-8 mt-6">
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 flex items-center gap-4 mb-6">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-inner ${
              user.role.includes('兼職') ? 'bg-orange-500' : 'bg-blue-600'
            }`}
          >
            {user.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#111]">{user.name}</h2>
            <span
              className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded font-bold ${
                user.role.includes('兼職')
                  ? 'bg-orange-100 text-orange-600'
                  : 'bg-blue-100 text-blue-600'
              }`}
            >
              {user.role}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 mb-6 space-y-5">
          <div>
            <label className="text-xs font-bold text-gray-500 flex items-center gap-1.5 mb-2">
              <Briefcase size={14} /> 系統綁定職位
            </label>
            <div className="bg-gray-50 px-4 py-3 rounded-xl font-bold text-gray-800 text-sm border border-gray-100">
              {user.role}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 flex items-center gap-1.5 mb-2">
              <Lock size={14} /> 登入密碼
            </label>
            <div className="bg-gray-50 px-4 py-3 rounded-xl font-bold text-gray-800 text-sm border border-gray-100 tracking-widest">
              {user.password}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4 border-b border-gray-50 pb-3">
            <h3 className="font-bold text-[#111] text-sm flex items-center gap-2">
              <CalendarIcon size={16} className="text-blue-500" /> 本月排休狀況
            </h3>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
              {leaves.length} / {MAX_LEAVES} 天
            </span>
          </div>

          {leaves.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {leaves.map((l) => (
                <div
                  key={l.date}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border ${
                    l.status === 'pending'
                      ? 'bg-orange-50 border-orange-100'
                      : 'bg-green-50 border-green-100'
                  }`}
                >
                  <span
                    className={`text-sm font-black ${
                      l.status === 'pending'
                        ? 'text-orange-600'
                        : 'text-green-600'
                    }`}
                  >
                    {l.date}
                  </span>
                  <span
                    className={`text-[9px] font-bold mt-1 ${
                      l.status === 'pending'
                        ? 'text-orange-400'
                        : 'text-green-500'
                    }`}
                  >
                    {l.status === 'pending' ? '待主管核准' : '已核准休假'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <p className="text-gray-400 font-bold text-sm">
                您本月尚未安排任何休假
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmployeeManagementScreen({
  onBack,
  registeredUsers,
  employeeLeaves,
  onUpdateEmployee,
  onAddTestEmployee,
  onDeleteEmployee,
}) {
  const [testRoleCombo, setTestRoleCombo] = useState('早班正職');

  const stats = [
    {
      id: 'total',
      label: '總人數',
      count: registeredUsers.length,
      bg: 'bg-[#111]',
      text: 'text-gray-300',
      shadow: 'shadow-black/10',
      icon: <Users size={48} />,
      span: 'col-span-2',
    },
    {
      id: 'morn_full',
      label: '早班正職',
      count: registeredUsers.filter((u) => u.role === '早班正職').length,
      bg: 'bg-blue-500',
      text: 'text-blue-100',
      shadow: 'shadow-blue-500/20',
      icon: <ShieldCheck size={48} />,
    },
    {
      id: 'night_full',
      label: '晚班正職',
      count: registeredUsers.filter((u) => u.role === '晚班正職').length,
      bg: 'bg-indigo-600',
      text: 'text-indigo-200',
      shadow: 'shadow-indigo-600/20',
      icon: <ShieldCheck size={48} />,
    },
    {
      id: 'morn_part',
      label: '早班兼職',
      count: registeredUsers.filter((u) => u.role === '早班兼職').length,
      bg: 'bg-orange-500',
      text: 'text-orange-100',
      shadow: 'shadow-orange-500/20',
      icon: <Clock size={48} />,
    },
    {
      id: 'night_part',
      label: '晚班兼職',
      count: registeredUsers.filter((u) => u.role === '晚班兼職').length,
      bg: 'bg-rose-500',
      text: 'text-rose-200',
      shadow: 'shadow-rose-500/20',
      icon: <Clock size={48} />,
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar bg-[#f5f6f8] pb-32 animate-in slide-in-from-bottom-8 duration-300 relative">
      <header className="sticky top-0 bg-[#f5f6f8]/90 backdrop-blur-md z-10 flex items-center px-8 pt-12 pb-4 border-b border-gray-200/50">
        <button
          onClick={onBack}
          className="p-2 -ml-2 text-gray-800 hover:bg-gray-200 rounded-full transition mr-4"
        >
          <ChevronLeft size={28} strokeWidth={2} />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-[#111] tracking-tight">
            員工管理
          </h1>
          <p className="text-xs font-semibold text-gray-500 mt-0.5">
            管理員工身分綁定與名單
          </p>
        </div>
      </header>

      <div className="px-8 mt-6 mb-2">
        <div className="grid grid-cols-2 gap-3">
          {stats.map((s) => (
            <div
              key={s.id}
              className={`${s.bg} text-white rounded-2xl p-3 shadow-lg ${
                s.shadow
              } flex flex-col justify-between relative overflow-hidden min-h-[90px] ${
                s.span || ''
              }`}
            >
              <div className="absolute -right-3 -bottom-3 opacity-15 text-white pointer-events-none transform rotate-12">
                {s.icon}
              </div>
              <p
                className={`text-xs font-extrabold tracking-wider ${s.text} truncate max-w-full relative z-10`}
              >
                {s.label}
              </p>
              <div className="flex items-end gap-1 mt-auto relative z-10 pt-2">
                <span className="text-3xl font-black leading-none">
                  {s.count}
                </span>
                <span className={`text-xs font-bold ${s.text} mb-0.5`}>人</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-8 mt-4 mb-2">
        <div className="bg-white rounded-[1.5rem] p-4 shadow-[0_8px_20px_rgb(0,0,0,0.04)] border border-blue-100 flex flex-col gap-3 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
          <h3 className="text-sm font-bold text-[#111] flex items-center gap-2">
            <Wand2 size={16} className="text-blue-500" /> 快速新增測試人員
          </h3>
          <p className="text-xs text-gray-500 mb-1">
            產生的人員會自帶合法假單 (1日7平)
          </p>
          <div className="flex items-center gap-2">
            <select
              value={testRoleCombo}
              onChange={(e) => setTestRoleCombo(e.target.value)}
              className="flex-1 appearance-none bg-gray-50 text-gray-800 font-bold text-xs py-2 pl-3 pr-8 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="早班正職">早班正職</option>
              <option value="晚班正職">晚班正職</option>
              <option value="早班兼職">早班兼職</option>
              <option value="晚班兼職">晚班兼職</option>
            </select>
            <button
              onClick={() => onAddTestEmployee(testRoleCombo)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-sm active:scale-95 transition-all whitespace-nowrap"
            >
              + 立即新增
            </button>
          </div>
        </div>
      </div>

      <div className="px-8 mt-4 space-y-4">
        {registeredUsers.map((user) => (
          <EmployeeEditCard
            key={user.id}
            user={user}
            allUsers={registeredUsers}
            userLeaves={employeeLeaves[user.name] || []}
            onUpdate={onUpdateEmployee}
            onDelete={onDeleteEmployee}
          />
        ))}
      </div>
    </div>
  );
}

function ScheduleEditorScreen({
  shifts,
  employees,
  employeeLeaves,
  timeBlockDemands,
  registeredUsers,
  onAutoSchedule,
  onBack,
  ruleEnabled,
  monthlyLeaveDays,
}) {
  const [showToast, setShowToast] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 overflow-y-auto no-scrollbar bg-[#f5f6f8] pb-24 animate-in fade-in slide-in-from-right-8 duration-300 relative">
      {showToast && (
        <div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4">
          <div className="bg-green-500 text-white px-5 py-2.5 rounded-full shadow-lg font-bold text-sm flex items-center gap-2 whitespace-nowrap">
            <CheckCircle size={18} /> 已自動將兼職人員調度至缺額時段！
          </div>
        </div>
      )}
      {errorMsg && (
        <div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 w-11/12 max-w-[320px]">
          <div className="bg-red-500 text-white px-5 py-2.5 rounded-2xl shadow-lg font-bold text-sm flex items-center justify-center gap-2 whitespace-nowrap">
            <AlertCircle size={18} /> {errorMsg}
          </div>
        </div>
      )}

      <header className="absolute top-0 left-0 w-full bg-[#f5f6f8]/90 backdrop-blur-md z-10 flex justify-between items-center px-8 pt-12 pb-4 border-b border-gray-200/50">
        <div className="flex items-center">
          <button
            onClick={onBack}
            className="p-2 -ml-2 text-gray-800 hover:bg-gray-200 rounded-full transition mr-4"
          >
            <ChevronLeft size={28} strokeWidth={2} />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold text-[#111] tracking-tight">
              智慧排班引擎
            </h1>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mt-0.5">
              Auto Scheduler
            </p>
          </div>
        </div>
      </header>

      <div className="w-full flex flex-col items-center mt-12">
        <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-6 shadow-inner">
          <Wand2 size={48} />
        </div>
        <h2 className="text-xl font-bold text-[#111] mb-2 text-center">
          補齊缺額與時段優化
        </h2>
        <p className="text-sm text-gray-500 text-center mb-8 leading-relaxed max-w-[280px]">
          系統已於背景為全體員工排定整月基礎班表。
          <br />
          點擊下方按鈕，系統將自動分析時段缺口，並優化兼職人員的彈性上下班時間。
        </p>

        <button
          onClick={handleMagicClick}
          className={`w-full py-4 rounded-2xl text-white font-bold text-lg flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all ${
            hasPendingLeaves
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
              : 'bg-[#2563EB] hover:bg-blue-700 shadow-blue-600/30'
          }`}
        >
          <RefreshCw size={22} className={showToast ? 'animate-spin' : ''} />{' '}
          執行一鍵排班
        </button>
      </div>
    </div>
  );
}

function LeaveRequestScreen({
  onBack,
  currentUser,
  employeeLeaves,
  onSaveLeaves,
}) {
  const initialLeaves = employeeLeaves[currentUser] || [];
  const [selectedLeaves, setSelectedLeaves] = useState(initialLeaves);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [warningMsg, setWarningMsg] = useState('');

  const MAX_LEAVES = 8;
  const MAX_WEEKEND_LEAVES = 1;
  const MAX_WEEKDAY_LEAVES = 7;
  const APPROVAL_THRESHOLD = 2;

  const marchDays = Array.from({ length: 31 }, (_, i) => i + 1);

  const othersLeaves = {};
  Object.entries(employeeLeaves).forEach(([emp, leaves]) => {
    if (emp !== currentUser)
      leaves.forEach((l) => {
        othersLeaves[l.date] = (othersLeaves[l.date] || 0) + 1;
      });
  });

  const handleDayClick = (day) => {
    if (isSubmitted) return;
    const dateStr = `3/${day}`;

    const existingIndex = selectedLeaves.findIndex((l) => l.date === dateStr);
    if (existingIndex >= 0) {
      setSelectedLeaves((prev) => prev.filter((l) => l.date !== dateStr));
      setWarningMsg('');
      return;
    }

    const isWknd = isWeekendDay(day);
    const currentWkndCount = selectedLeaves.filter((l) =>
      isWeekendDay(parseInt(l.date.split('/')[1]))
    ).length;
    const currentWkdyCount = selectedLeaves.filter(
      (l) => !isWeekendDay(parseInt(l.date.split('/')[1]))
    ).length;

    if (isWknd && currentWkndCount >= MAX_WEEKEND_LEAVES) {
      setWarningMsg(`您最多只能選擇 ${MAX_WEEKEND_LEAVES} 天「假日」排休`);
      setTimeout(() => setWarningMsg(''), 3000);
      return;
    }
    if (!isWknd && currentWkdyCount >= MAX_WEEKDAY_LEAVES) {
      setWarningMsg(`您最多只能選擇 ${MAX_WEEKDAY_LEAVES} 天「平日」排休`);
      setTimeout(() => setWarningMsg(''), 3000);
      return;
    }
    if (selectedLeaves.length >= MAX_LEAVES) {
      setWarningMsg(`您已達自選排休上限 (${MAX_LEAVES}天)`);
      setTimeout(() => setWarningMsg(''), 3000);
      return;
    }

    const bookedCount = othersLeaves[dateStr] || 0;
    const needsApproval = bookedCount >= APPROVAL_THRESHOLD;

    const newLeave = {
      date: dateStr,
      status: needsApproval ? 'pending' : 'approved',
    };
    setSelectedLeaves((prev) => [...prev, newLeave]);

    if (needsApproval) {
      setWarningMsg('該日休假人數較多，將送交主管審核');
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

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar bg-[#f8f9fc] pb-[150px] animate-in fade-in slide-in-from-right-8 duration-300 relative flex flex-col">
      {warningMsg && (
        <div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 w-11/12 max-w-[320px]">
          <div
            className={`text-white px-5 py-2.5 rounded-2xl shadow-lg font-bold text-sm flex items-center justify-center gap-2 text-center leading-snug ${
              warningMsg.includes('主管審核') ? 'bg-orange-500' : 'bg-red-500'
            }`}
          >
            <AlertCircle size={18} className="shrink-0" /> {warningMsg}
          </div>
        </div>
      )}
      <header className="shrink-0 sticky top-0 bg-[#f8f9fc]/90 backdrop-blur-md z-10 flex items-center px-8 pt-12 pb-4 border-b border-gray-200/50">
        <div>
          <h1 className="text-2xl font-extrabold text-[#111] tracking-tight">
            本月排休
          </h1>
          <p className="text-xs font-semibold text-gray-500 mt-0.5">
            {currentUser}{' '}
            {isSubmitted
              ? ' - 假單已鎖定'
              : ` - 已選 ${selectedLeaves.length} 天 (規定自選 ${MAX_LEAVES} 天)`}
          </p>
        </div>
      </header>

      <div className="px-8 mt-6 flex-1">
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl mb-6">
          <p className="text-xs font-bold text-blue-800 leading-relaxed">
            💡 系統排休規則：
            <br />
            為確保公平性，每人可自行劃定{' '}
            <strong className="text-red-500">{MAX_LEAVES}天</strong> 假。
            <br />
            其中包含{' '}
            <strong className="text-blue-600">
              {MAX_WEEKEND_LEAVES}天假日
            </strong>{' '}
            與{' '}
            <strong className="text-blue-600">
              {MAX_WEEKDAY_LEAVES}天平日
            </strong>
            。<br />
            （送出後，系統將會**自動依您的身分**為您排滿剩餘的工作日！）
          </p>
        </div>

        <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex flex-col gap-3 text-xs font-bold text-gray-500">
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-full bg-[#111]"></div>
              <span>確定休假</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-full bg-orange-500"></div>
              <span className="text-orange-600">待主管審核</span>
            </div>
          </div>
          <div className="flex flex-col gap-3 text-xs font-bold text-gray-500">
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-full bg-red-50 border border-red-200"></div>
              <span className="text-red-500">易生衝突</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-full bg-gray-50 border border-gray-200"></div>
              <span>尚有名額</span>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex justify-between text-sm font-bold text-[#111] mb-2">
            <span>
              自選進度 (最多{MAX_WEEKEND_LEAVES}假日, {MAX_WEEKDAY_LEAVES}平日)
            </span>
            <span
              className={
                selectedLeaves.length === MAX_LEAVES
                  ? 'text-green-600'
                  : 'text-blue-600'
              }
            >
              {selectedLeaves.length} / {MAX_LEAVES} 天
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                selectedLeaves.length === MAX_LEAVES
                  ? 'bg-green-500'
                  : 'bg-blue-600'
              }`}
              style={{
                width: `${Math.min(
                  (selectedLeaves.length / MAX_LEAVES) * 100,
                  100
                )}%`,
              }}
            ></div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-8">
          <div className="grid grid-cols-7 gap-x-2 gap-y-3">
            {['日', '一', '二', '三', '四', '五', '六'].map((d) => (
              <div
                key={d}
                className={`text-center text-[10px] font-bold mb-2 ${
                  d === '日' || d === '六' ? 'text-orange-500' : 'text-gray-400'
                }`}
              >
                {d}
              </div>
            ))}
            {marchDays.map((day) => {
              const dateStr = `3/${day}`;
              const myLeave = selectedLeaves.find((l) => l.date === dateStr);
              const bookedCount = othersLeaves[dateStr] || 0;
              const isFull = bookedCount >= APPROVAL_THRESHOLD;
              const isWknd = isWeekendDay(day);

              let btnClass =
                'bg-gray-50 text-gray-600 border border-gray-100 hover:bg-gray-100';
              if (myLeave) {
                btnClass =
                  myLeave.status === 'pending'
                    ? 'bg-orange-500 text-white shadow-md transform scale-105 z-10 font-bold border-transparent'
                    : 'bg-[#111] text-white shadow-md transform scale-105 z-10 font-bold border-transparent';
              } else if (isFull) {
                btnClass =
                  'bg-red-50 text-red-500 border border-red-100 font-bold';
              } else if (bookedCount > 0) {
                btnClass =
                  'bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 font-bold';
              }

              return (
                <button
                  key={day}
                  onClick={() => handleDayClick(day)}
                  disabled={isSubmitted}
                  className={`relative w-full aspect-square rounded-xl flex items-center justify-center transition-all duration-200 ${btnClass}`}
                >
                  <span
                    className={`text-[14px] ${
                      isWknd && !myLeave && !isFull ? 'text-orange-600' : ''
                    }`}
                  >
                    {day}
                  </span>
                  {isWknd && !myLeave && !isFull && (
                    <div className="absolute top-1 right-1 w-1 h-1 bg-orange-400 rounded-full"></div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-32 w-full shrink-0"></div>
      </div>

      <div className="fixed sm:absolute bottom-[72px] left-0 w-full px-8 pb-6 pt-12 bg-gradient-to-t from-[#f8f9fc] via-[#f8f9fc]/90 to-transparent z-40 pointer-events-none">
        <div className="pointer-events-auto">
          {isSubmitted ? (
            <div className="w-full bg-green-50 text-green-600 py-4 rounded-2xl flex items-center justify-center gap-2 font-bold shadow-sm border border-green-100">
              <CheckCircle size={20} /> 假單已送出
            </div>
          ) : (
            <button
              onClick={() => {
                if (selectedLeaves.length > 0) setShowConfirmModal(true);
              }}
              className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-bold shadow-lg transition-all active:scale-[0.98] ${
                selectedLeaves.length > 0
                  ? 'bg-[#2563EB] text-white shadow-blue-600/30 hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
              }`}
            >
              發送假單 ({selectedLeaves.length} / {MAX_LEAVES} 天)
            </button>
          )}
        </div>
      </div>

      {showConfirmModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center px-6">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowConfirmModal(false)}
          ></div>
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm relative z-10 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-4">
              <AlertCircle size={24} />
            </div>
            <h3 className="text-xl font-bold text-[#111] mb-2">
              確定送出排休假單？
            </h3>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              您目前已自選{' '}
              <strong className="text-gray-800">{selectedLeaves.length}</strong>{' '}
              天假。
              {selectedLeaves.some((l) => l.status === 'pending') && (
                <span className="text-orange-500 font-bold block mt-1">
                  ⚠️ 包含待審核的假單，須經主管同意。
                </span>
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3.5 rounded-2xl bg-gray-50 text-gray-600 font-bold hover:bg-gray-100 transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmSubmit}
                className="flex-1 py-3.5 rounded-2xl bg-[#2563EB] text-white font-bold hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-colors"
              >
                確定送出
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BackendSettingsScreen({
  onBack,
  ruleEnabled,
  setRuleEnabled,
  monthlyLeaveDays,
  setMonthlyLeaveDays,
  dailyWorkHours,
  setDailyWorkHours,
  timeBlockDemands,
  setTimeBlockDemands,
}) {
  const updateRequiredCount = (id, delta, isWeekend) => {
    setTimeBlockDemands((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          if (isWeekend)
            return { ...s, reqWeekend: Math.max(0, s.reqWeekend + delta) };
          else return { ...s, reqWeekday: Math.max(0, s.reqWeekday + delta) };
        }
        return s;
      })
    );
  };

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar bg-[#f5f6f8] pb-32 animate-in slide-in-from-right-8 duration-300 relative">
      <header className="sticky top-0 bg-[#f5f6f8]/90 backdrop-blur-md z-10 flex items-center px-8 pt-12 pb-4 border-b border-gray-200/50">
        <button
          onClick={onBack}
          className="p-2 -ml-2 text-gray-800 hover:bg-gray-200 rounded-full transition mr-4"
        >
          <ChevronLeft size={28} strokeWidth={2} />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-[#111] tracking-tight">
            後台設定
          </h1>
          <p className="text-xs font-semibold text-gray-500 mt-0.5">
            排班規則與四大時段需求
          </p>
        </div>
      </header>

      <div className="px-8 mt-6 space-y-6">
        <div
          className="bg-white rounded-[2rem] p-6 shadow-[0_8px_20px_rgb(0,0,0,0.03)] border border-gray-50 flex justify-between items-center cursor-pointer"
          onClick={() => setRuleEnabled(!ruleEnabled)}
        >
          <div>
            <h3 className="font-bold text-[#111] text-lg">啟用排班防呆規則</h3>
            <p className="text-[11px] text-gray-400 font-bold mt-1">
              開啟「七休二」與工時防呆
            </p>
          </div>
          <button
            className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ease-in-out shadow-inner ${
              ruleEnabled ? 'bg-[#5B8C66]' : 'bg-gray-300'
            }`}
          >
            <div
              className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-300 ease-in-out flex items-center justify-center ${
                ruleEnabled ? 'translate-x-6' : 'translate-x-0'
              }`}
            ></div>
          </button>
        </div>

        <div
          className={`bg-white rounded-[2rem] p-6 shadow-[0_8px_20px_rgb(0,0,0,0.03)] border border-gray-50 transition-all duration-300 ${
            ruleEnabled
              ? 'opacity-100'
              : 'opacity-40 pointer-events-none grayscale'
          }`}
        >
          <div className="flex items-center gap-3 mb-5 border-b border-gray-50 pb-4">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Settings size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="font-bold text-[#111] text-lg">防呆參數設定</h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                Rule Parameters
              </p>
            </div>
          </div>
          <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-xl mb-4 font-medium leading-relaxed">
            <strong className="text-blue-900 block mb-1">
              💡 七休二 AI 滾動檢查 & 排休邏輯
            </strong>
            開啟規則後，系統將確保每位員工在
            <strong className="text-red-500">
              任意連續 7 天內，最多只能排 5 天班
            </strong>
            （必須休 2 天）。
            <br />
            <br />
            另外，每位員工每月
            <strong className="text-red-500">只能自選 8 天假（1假+7平）</strong>
            ，若發生衝突會轉交主管審核，剩餘假額由系統在符合人力與七休二的情況下為其自動保留。
          </div>
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                每人最低月休天數
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={monthlyLeaveDays}
                  onChange={(e) => setMonthlyLeaveDays(Number(e.target.value))}
                  className="w-full bg-gray-50 text-gray-800 font-bold py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-lg"
                />
                <span className="text-sm font-bold text-gray-400 shrink-0">
                  天 / 月
                </span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                每日最高合法工時
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={dailyWorkHours}
                  onChange={(e) => setDailyWorkHours(Number(e.target.value))}
                  className="w-full bg-gray-50 text-gray-800 font-bold py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-lg"
                />
                <span className="text-sm font-bold text-gray-400 shrink-0">
                  小時 / 天
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 shadow-[0_8px_20px_rgb(0,0,0,0.03)] border border-gray-50">
          <div className="flex items-center gap-3 mb-5 border-b border-gray-50 pb-4">
            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-500">
              <RefreshCw size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="font-bold text-[#111] text-lg">
                營業時間與變形矩陣
              </h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                Business Hours & Shifts
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100 text-xs">
              <div className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>{' '}
                正職人員 (平假日一樣)
              </div>
              <div className="grid grid-cols-1 gap-2 text-gray-600">
                <div>
                  <span className="font-bold text-gray-700">早班正職：</span>{' '}
                  11:00 - 15:00 & 17:00 - 22:00
                </div>
                <div>
                  <span className="font-bold text-gray-700">晚班正職：</span>{' '}
                  15:00 - 00:00
                </div>
              </div>
            </div>
            <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100 text-xs">
              <div className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>{' '}
                兼職人員 (AI 動態變形)
              </div>
              <div className="grid grid-cols-1 gap-y-3 text-gray-600">
                <div className="border-b border-gray-200 pb-2">
                  <span className="font-bold text-gray-500 bg-gray-200 px-1 rounded mr-1 mb-1 inline-block">
                    平日
                  </span>
                  <br />
                  <span className="font-bold">早班兼職：</span>11:00-15:00 或
                  18:00-22:00
                  <br />
                  <span className="font-bold">晚班兼職：</span>18:00-22:00
                  (固定)
                </div>
                <div>
                  <span className="font-bold text-orange-500 bg-orange-100 px-1 rounded mr-1 mb-1 inline-block">
                    假日
                  </span>
                  <br />
                  <span className="font-bold">早/晚班兼職：</span>11:00-15:00 &
                  17:00-22:00
                  <br />
                  <span className="ml-16 block text-blue-600 font-bold mt-0.5">
                    或動態支援 11:00-20:00 (補 15-17 缺額)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 shadow-[0_8px_20px_rgb(0,0,0,0.03)] border border-gray-50">
          <div className="flex items-center gap-3 mb-5 border-b border-gray-50 pb-4">
            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Users size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="font-bold text-[#111] text-lg">
                四大營業時段人數需求
              </h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                Staffing Demands by Block
              </p>
            </div>
          </div>
          <div className="space-y-4">
            {timeBlockDemands.map((block) => (
              <div
                key={block.id}
                className="bg-gray-50 p-4 rounded-2xl border border-gray-100"
              >
                <p className="font-bold text-sm text-gray-800 mb-3 border-b border-gray-200 pb-2">
                  {block.name} 需求
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded w-max">
                      平日
                    </span>
                    <div className="flex items-center gap-2 bg-white px-1.5 py-1 rounded-lg border border-gray-200 shadow-sm mt-1">
                      <button
                        onClick={() => updateRequiredCount(block.id, -1, false)}
                        className="text-gray-400 hover:text-blue-600 transition-colors p-1 active:scale-90"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span className="font-extrabold text-sm text-[#111] w-4 text-center">
                        {block.reqWeekday}
                      </span>
                      <button
                        onClick={() => updateRequiredCount(block.id, 1, false)}
                        className="text-gray-400 hover:text-blue-600 transition-colors p-1 active:scale-90"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded w-max">
                      假日
                    </span>
                    <div className="flex items-center gap-2 bg-white px-1.5 py-1 rounded-lg border border-gray-200 shadow-sm mt-1">
                      <button
                        onClick={() => updateRequiredCount(block.id, -1, true)}
                        className="text-gray-400 hover:text-blue-600 transition-colors p-1 active:scale-90"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span className="font-extrabold text-sm text-[#111] w-4 text-center">
                        {block.reqWeekend}
                      </span>
                      <button
                        onClick={() => updateRequiredCount(block.id, 1, true)}
                        className="text-gray-400 hover:text-blue-600 transition-colors p-1 active:scale-90"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 4. 主應用程式入口
// ==========================================

export default function App() {
  const [activeScreen, setActiveScreen] = useState('login');
  const [selectedShift, setSelectedShift] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [role, setRole] = useState(null);

  const [registeredUsers, setRegisteredUsers] = useState(
    initialRegisteredUsers
  );
  const [timeBlockDemands, setTimeBlockDemands] = useState(
    initialTimeBlockDemands
  );
  const [employeeLeaves, setEmployeeLeaves] = useState(initialLeavesMap);

  const [ruleEnabled, setRuleEnabled] = useState(true);
  const [monthlyLeaveDays, setMonthlyLeaveDays] = useState(8);
  const [dailyWorkHours, setDailyWorkHours] = useState(9);

  const [shifts, setShifts] = useState(() => generateInitialShifts());

  const navigateTo = (screen, shift = null) => {
    if (shift) setSelectedShift(shift);
    setActiveScreen(screen);
  };

  const handleBack = () => {
    setActiveScreen(role === 'manager' ? 'home' : 'leave_request');
    setTimeout(() => setSelectedShift(null), 300);
  };

  const updateAndSyncLeaves = (userName, newLeavesArray) => {
    setEmployeeLeaves((prev) => ({ ...prev, [userName]: newLeavesArray }));
    setShifts((prevShifts) => {
      const user = registeredUsers.find((u) => u.name === userName);
      if (user && user.role) {
        const newShiftsForUser = generateFullScheduleForUser(
          user,
          newLeavesArray,
          ruleEnabled,
          monthlyLeaveDays
        );
        const filtered = prevShifts.filter((s) => s.assignee !== userName);
        return [...filtered, ...newShiftsForUser];
      }
      return prevShifts;
    });
  };

  const handleUpdateEmployee = (userId, newName, newRole, newPassword) => {
    const userIndex = registeredUsers.findIndex((u) => u.id === userId);
    if (userIndex === -1) return;

    const oldName = registeredUsers[userIndex].name;
    const updatedUser = {
      ...registeredUsers[userIndex],
      name: newName,
      role: newRole || '早班正職',
      password: newPassword || registeredUsers[userIndex].password,
    };

    const updatedUsers = [...registeredUsers];
    updatedUsers[userIndex] = updatedUser;
    setRegisteredUsers(updatedUsers);

    const userLeaves = employeeLeaves[oldName] || [];
    const newShiftsForUser = generateFullScheduleForUser(
      updatedUser,
      userLeaves,
      ruleEnabled,
      monthlyLeaveDays
    );

    setShifts((prevShifts) => {
      const filtered = prevShifts.filter((s) => s.assignee !== oldName);
      return [...filtered, ...newShiftsForUser];
    });

    if (oldName !== newName) {
      setEmployeeLeaves((prevLeaves) => {
        const newLeaves = { ...prevLeaves };
        if (newLeaves[oldName]) {
          newLeaves[newName] = newLeaves[oldName];
          delete newLeaves[oldName];
        }
        return newLeaves;
      });
      if (currentUser === oldName) setCurrentUser(newName);
    }
  };

  const handleDeleteEmployee = (userId) => {
    const userToDelete = registeredUsers.find((u) => u.id === userId);
    if (!userToDelete) return;

    const userName = userToDelete.name;

    setRegisteredUsers((prev) => prev.filter((u) => u.id !== userId));

    setEmployeeLeaves((prev) => {
      const newLeaves = { ...prev };
      delete newLeaves[userName];
      return newLeaves;
    });

    setShifts((prev) => prev.filter((s) => s.assignee !== userName));
  };

  const handleAddTestEmployee = (roleType) => {
    let newName = generateRandomChineseName();
    while (registeredUsers.some((u) => u.name === newName))
      newName = generateRandomChineseName();
    let newPassword;
    do {
      newPassword = Math.floor(100000 + Math.random() * 900000).toString();
    } while (registeredUsers.some((u) => u.password === newPassword));

    const newUser = {
      id: `u_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      name: newName,
      password: newPassword,
      role: roleType,
    };

    setRegisteredUsers((prev) => [...prev, newUser]);
    const newLeaves = generateRandomLeaves();
    setEmployeeLeaves((prev) => ({ ...prev, [newName]: newLeaves }));

    const newShiftsForUser = generateFullScheduleForUser(
      newUser,
      newLeaves,
      ruleEnabled,
      monthlyLeaveDays
    );
    setShifts((prev) => [...prev, ...newShiftsForUser]);
  };

  const handleApproveLeave = (emp, date) => {
    const updatedLeaves = employeeLeaves[emp].map((l) =>
      l.date === date ? { ...l, status: 'approved' } : l
    );
    updateAndSyncLeaves(emp, updatedLeaves);
  };

  const handleRejectLeave = (emp, date) => {
    const updatedLeaves = employeeLeaves[emp].filter((l) => l.date !== date);
    updateAndSyncLeaves(emp, updatedLeaves);
  };

  const handleSaveLeaves = (userName, leavesArray) => {
    updateAndSyncLeaves(userName, leavesArray);
  };

  const handleAutoSchedule = () => {
    setShifts((prev) => {
      let updatedShifts = [...prev];
      const uniqueDates = [...new Set(updatedShifts.map((s) => s.date))];

      uniqueDates.forEach((date) => {
        const dayNum = parseInt(date.split('/')[1]);
        const isWknd = isWeekendDay(dayNum);

        const getCoverage = (h) =>
          updatedShifts.filter(
            (s) => s.date === date && isHourInTimeStr(h, s.time)
          ).length;

        let changed = true;
        let passes = 0;

        // 🌟 智慧調度：如果某個時段人太多，自動將兼職移到缺人的時段去補洞
        while (changed && passes < 3) {
          changed = false;
          passes++;

          updatedShifts.forEach((shift) => {
            if (shift.date !== date) return;
            const uInfo = registeredUsers.find(
              (u) => u.name === shift.assignee
            );
            if (!uInfo || !uInfo.role.includes('兼職')) return;

            if (!isWknd) {
              if (uInfo.role === '早班兼職') {
                const dem11 = getDemandForHour(11, false, timeBlockDemands);
                const cov11 = getCoverage(11);
                const dem18 = getDemandForHour(18, false, timeBlockDemands);
                const cov18 = getCoverage(18);

                if (
                  shift.time === '11:00 - 15:00' &&
                  cov11 > dem11 &&
                  cov18 < dem18
                ) {
                  shift.time = '18:00 - 22:00';
                  changed = true;
                } else if (
                  shift.time === '18:00 - 22:00' &&
                  cov18 > dem18 &&
                  cov11 < dem11
                ) {
                  shift.time = '11:00 - 15:00';
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

              if (shift.time === '11:00 - 15:00 & 17:00 - 22:00') {
                if (cov17 > dem17 && cov15 < dem15) {
                  shift.time = '11:00 - 20:00';
                  changed = true;
                }
              } else if (shift.time === '11:00 - 20:00') {
                if (cov15 > dem15 && cov17 < dem17) {
                  shift.time = '11:00 - 15:00 & 17:00 - 22:00';
                  changed = true;
                }
              }
            }
          });
        }
      });
      return updatedShifts;
    });
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

  return (
    <div className="h-[100dvh] w-full sm:max-w-md sm:mx-auto sm:border-x sm:border-gray-200 sm:shadow-2xl bg-[#f5f6f8] font-sans overflow-hidden relative flex flex-col">
      <style
        dangerouslySetInnerHTML={{
          __html: `.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`,
        }}
      />

      {activeScreen === 'login' && (
        <LoginScreen
          onLogin={handleLoginSuccess}
          onGoRegister={() => setActiveScreen('register')}
          registeredUsers={registeredUsers}
        />
      )}
      {activeScreen === 'register' && (
        <RegisterScreen
          onGoLogin={() => setActiveScreen('login')}
          registeredUsers={registeredUsers}
          setRegisteredUsers={setRegisteredUsers}
        />
      )}

      {activeScreen === 'home' && (
        <HomeScreen
          role={role}
          currentUser={currentUser}
          onLogout={handleLogout}
          shifts={shifts}
          timeBlockDemands={timeBlockDemands}
          registeredUsers={registeredUsers}
          employeeLeaves={employeeLeaves}
          onApproveLeave={handleApproveLeave}
          onRejectLeave={handleRejectLeave}
          onShiftSelect={(s) => navigateTo('detail', s)}
          onOpenEditor={() => navigateTo('schedule_editor')}
          onOpenLeaveRequest={() => navigateTo('leave_request')}
        />
      )}

      {activeScreen === 'schedule_editor' && (
        <ScheduleEditorScreen
          shifts={shifts}
          employees={registeredUsers.map((u) => u.name)}
          employeeLeaves={employeeLeaves}
          timeBlockDemands={timeBlockDemands}
          registeredUsers={registeredUsers}
          onAutoSchedule={handleAutoSchedule}
          onBack={handleBack}
          ruleEnabled={ruleEnabled}
          monthlyLeaveDays={monthlyLeaveDays}
        />
      )}

      {activeScreen === 'leave_request' && (
        <LeaveRequestScreen
          onBack={handleBack}
          currentUser={currentUser}
          employeeLeaves={employeeLeaves}
          onSaveLeaves={handleSaveLeaves}
        />
      )}

      {activeScreen === 'employee_management' && (
        <EmployeeManagementScreen
          onBack={handleBack}
          registeredUsers={registeredUsers}
          employeeLeaves={employeeLeaves}
          onUpdateEmployee={handleUpdateEmployee}
          onAddTestEmployee={handleAddTestEmployee}
          onDelete={handleDeleteEmployee}
        />
      )}

      {activeScreen === 'backend_settings' && (
        <BackendSettingsScreen
          onBack={handleBack}
          ruleEnabled={ruleEnabled}
          setRuleEnabled={setRuleEnabled}
          monthlyLeaveDays={monthlyLeaveDays}
          setMonthlyLeaveDays={setMonthlyLeaveDays}
          dailyWorkHours={dailyWorkHours}
          setDailyWorkHours={setDailyWorkHours}
          timeBlockDemands={timeBlockDemands}
          setTimeBlockDemands={setTimeBlockDemands}
        />
      )}

      {activeScreen === 'employee_profile' && (
        <EmployeeProfileScreen
          currentUser={currentUser}
          registeredUsers={registeredUsers}
          employeeLeaves={employeeLeaves}
        />
      )}

      {activeScreen !== 'login' && activeScreen !== 'register' && (
        <BottomNav
          role={role}
          activeScreen={activeScreen}
          onNavigate={navigateTo}
        />
      )}
    </div>
  );
}
