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
XCircle
} from 'lucide-react';

// 判斷 2026 年 3 月是否為假日 (3/1 是週日)
const isWeekendDay = (day) => {
const rem = day % 7;
return rem === 1 || rem === 0; // 1 是週日, 0 是週六
};

// 隨機產生 4 天假期的工具函數 (用於測試人員：1 天假日，3 天平日)
const generateRandomLeaves = () => {
const leaves = new Map();
let wknd = 0;
let wkdy = 0;
while (leaves.size < 4) {
const day = Math.floor(Math.random() \* 31) + 1;
const dateStr = `3/${day}`;

    // 避免抽到重複的日子
    if (leaves.has(dateStr)) continue;

    const isWknd = isWeekendDay(day);
    if (isWknd && wknd < 1) {
      leaves.set(dateStr, { date: dateStr, status: 'approved' });
      wknd++;
    } else if (!isWknd && wkdy < 3) {
      leaves.set(dateStr, { date: dateStr, status: 'approved' });
      wkdy++;
    }

}
return Array.from(leaves.values());
};

// --- 初始排班資料 ---
const INITIAL_SHIFTS = [
{
id: 's1',
date: '3/16',
day: '週一',
type: '早班 (正職)',
time: '11:00 - 15:00 & 17:00 - 22:00',
assignee: '測試正職',
role: '門市人員',
status: 'confirmed',
},
{
id: 's2',
date: '3/16',
day: '週一',
type: '晚班 (平日兼職)',
time: '18:00 - 22:00',
assignee: '救援兼職',
role: '值班經理',
status: 'confirmed',
},
];

// 判斷原始班別的小工具
const getBaseType = (typeStr) => {
if (typeStr.includes('早班')) return '早班';
if (typeStr.includes('晚班')) return '晚班';
return typeStr.split(' (')[0];
};

// 🌟 核心引擎：智慧動態班表矩陣 (嚴格對應您的最新時段規則)
const resolveShiftDetails = (baseType, empType, dayStr) => {
const isWeekend = dayStr === '週六' || dayStr === '週日';

if (baseType === '早班') {
if (empType === '正職') {
// 早班正職：平假日一樣
return { time: '11:00 - 15:00 & 17:00 - 22:00', label: '早班 (正職)' };
}
if (empType === '兼職') {
// 早班兼職：平日 11-15 或 18-22 / 假日 11-15 & 17-22 或者 11-20
return {
time: isWeekend ? '11:00 - 15:00 & 17:00 - 22:00 或 11:00 - 20:00' : '11:00 - 15:00 或 18:00 - 22:00',
label: isWeekend ? '早班 (假日兼職)' : '早班 (平日兼職)',
};
}
}

if (baseType === '晚班') {
if (empType === '正職') {
// 晚班正職：平假日一樣 15:00-00:00
return { time: '15:00 - 00:00', label: '晚班 (正職)' };
}
if (empType === '兼職') {
// 晚班兼職：平日 18-22 / 假日 11-15 & 17-22 或者 11-20
return {
time: isWeekend ? '11:00 - 15:00 & 17:00 - 22:00 或 11:00 - 20:00' : '18:00 - 22:00',
label: isWeekend ? '晚班 (假日兼職)' : '晚班 (平日兼職)',
};
}
}

return { time: null, label: null };
};

// 精準計算「是否缺人」函數
const isDayUnderstaffed = (dateStr, dayStr, shifts, customShifts) => {
const dayShifts = shifts.filter((s) => s.date === dateStr);
const isWeekend = dayStr === '週六' || dayStr === '週日';

if (customShifts && customShifts.length > 0) {
for (const cs of customShifts) {
const req = isWeekend ? cs.reqWeekend : cs.reqWeekday;
const assignedCount = dayShifts.filter(
(s) =>
getBaseType(s.type) === cs.name &&
s.assignee &&
s.assignee.trim() !== ''
).length;
if (req > assignedCount) {
return true;
}
}
return false;
} else {
return dayShifts.some((s) => !s.assignee || s.assignee.trim() === '');
}
};

// 7 休 2 演算法
const parseDate = (dStr) => {
const [m, d] = dStr.split('/');
return new Date(2026, parseInt(m) - 1, parseInt(d)).getTime();
};
const MS_PER_DAY = 1000 _ 60 _ 60 \* 24;

const check7DayRule = (targetDateStr, empWorkDaysSet) => {
const targetTime = parseDate(targetDateStr);
const workTimes = Array.from(empWorkDaysSet).map(parseDate);
workTimes.push(targetTime);

for (let i = 0; i <= 6; i++) {
const windowStart = targetTime - i _ MS_PER_DAY;
const windowEnd = windowStart + 6 _ MS_PER_DAY;

    let daysInWindow = 0;
    for (const t of workTimes) {
      if (t >= windowStart && t <= windowEnd) {
        daysInWindow++;
      }
    }
    if (daysInWindow > 5) {
      return false;
    }

}
return true;
};

export default function App() {
const [activeScreen, setActiveScreen] = useState('login');
const [selectedShift, setSelectedShift] = useState(null);
const [currentUser, setCurrentUser] = useState(null);
const [role, setRole] = useState(null);

const [registeredUsers, setRegisteredUsers] = useState([
{
id: 'u1',
name: '測試正職',
password: '000000',
assignedShift: 'c1',
empType: '正職',
},
{
id: 'u2',
name: '救援兼職',
password: '111111',
assignedShift: 'c1',
empType: '兼職',
},
]);

// 預設各班別與平假日需求設定
// 依據提示：平日最高並行需求約 15 人(早晚班各配)，假日最高 19 人
const [customShifts, setCustomShifts] = useState([
{ id: 'c1', name: '早班', reqWeekday: 7, reqWeekend: 12 },
{ id: 'c2', name: '晚班', reqWeekday: 8, reqWeekend: 7 },
]);

const [shifts, setShifts] = useState(INITIAL_SHIFTS);

// 紀錄員工假單，結構改為 Array of { date, status: 'approved' | 'pending' }
const [employeeLeaves, setEmployeeLeaves] = useState(() => ({
測試正職: generateRandomLeaves(),
救援兼職: generateRandomLeaves(),
}));

const [ruleEnabled, setRuleEnabled] = useState(true);
const [monthlyLeaveDays, setMonthlyLeaveDays] = useState(8);
const [dailyWorkHours, setDailyWorkHours] = useState(9);

const navigateTo = (screen, shift = null) => {
if (shift) setSelectedShift(shift);
setActiveScreen(screen);
};

const handleBack = () => {
setActiveScreen('home');
setTimeout(() => setSelectedShift(null), 300);
};

const handleAssigneeChange = (shiftId, newAssignee) => {
setShifts((prev) =>
prev.map((s) => {
if (s.id === shiftId) {
const baseType = getBaseType(s.type);
if (!newAssignee) {
return {
...s,
assignee: '',
type: baseType,
time: '待定 (依據身分切換)',
};
}
const uInfo = registeredUsers.find((u) => u.name === newAssignee);
const details = resolveShiftDetails(
baseType,
uInfo?.empType || '正職',
s.day
);
return {
...s,
assignee: newAssignee,
time: details.time || s.time,
type: details.label || baseType,
};
}
return s;
})
);
};

const handleUpdateEmployee = (
userId,
newName,
newShiftId,
newEmpType,
newPassword
) => {
const userIndex = registeredUsers.findIndex((u) => u.id === userId);
if (userIndex === -1) return;

    const oldName = registeredUsers[userIndex].name;
    const updatedUsers = [...registeredUsers];
    updatedUsers[userIndex] = {
      ...updatedUsers[userIndex],
      name: newName,
      assignedShift: newShiftId,
      empType: newEmpType || '正職',
      password: newPassword || updatedUsers[userIndex].password,
    };
    setRegisteredUsers(updatedUsers);

    if (oldName !== newName) {
      setShifts((prev) =>
        prev.map((s) =>
          s.assignee === oldName ? { ...s, assignee: newName } : s
        )
      );
      setEmployeeLeaves((prev) => {
        const newLeaves = { ...prev };
        if (newLeaves[oldName]) {
          newLeaves[newName] = newLeaves[oldName];
          delete newLeaves[oldName];
        }
        return newLeaves;
      });
      if (currentUser === oldName) setCurrentUser(newName);
    }

};

const handleAddTestEmployee = (roleCombo) => {
const [shiftName, empType] = roleCombo.split('\_');
const shiftId = customShifts.find((cs) => cs.name === shiftName)?.id || '';

    const shortShiftName = shiftName.substring(0, 1);
    const shortEmpType = empType.substring(0, 1);
    const randomLetter = String.fromCharCode(
      65 + Math.floor(Math.random() * 26)
    );
    const randomNum = Math.floor(10 + Math.random() * 90);

    const newName = `${shortShiftName}${shortEmpType}_${randomLetter}${randomNum}`;

    let newPassword;
    do {
      newPassword = Math.floor(100000 + Math.random() * 900000).toString();
    } while (registeredUsers.some((u) => u.password === newPassword));

    setRegisteredUsers((prev) => [
      ...prev,
      {
        id: `u_${Date.now()}_${randomNum}`,
        name: newName,
        password: newPassword,
        assignedShift: shiftId,
        empType: empType,
      },
    ]);

    setEmployeeLeaves((prev) => ({
      ...prev,
      [newName]: generateRandomLeaves(),
    }));

};

const handleAddCustomShift = (shiftObj) => {
const newShift = {
id: Date.now().toString(),
...shiftObj,
reqWeekday: 1,
reqWeekend: 1,
};
setCustomShifts((prev) => [...prev, newShift]);
};

const handleRemoveCustomShift = (id) => {
setCustomShifts((prev) => prev.filter((shift) => shift.id !== id));
};

// 🌟 主管核准假單
const handleApproveLeave = (emp, date) => {
setEmployeeLeaves(prev => ({
...prev,
[emp]: prev[emp].map(l => l.date === date ? { ...l, status: 'approved' } : l)
}));
};

// 🌟 主管退回假單
const handleRejectLeave = (emp, date) => {
setEmployeeLeaves(prev => ({
...prev,
[emp]: prev[emp].filter(l => l.date !== date)
}));
};

// 進階一鍵排班邏輯
const handleAutoSchedule = () => {
setShifts((prev) => {
const fullTimeEmps = registeredUsers
.filter((u) => u.empType === '正職' || !u.empType)
.map((u) => u.name);
const partTimeEmps = registeredUsers
.filter((u) => u.empType === '兼職')
.map((u) => u.name);

      let updatedShifts = [...prev];
      const uniqueDates = [...new Set(updatedShifts.map((s) => s.date))];
      const dateToDayMap = {};
      updatedShifts.forEach((s) => {
        dateToDayMap[s.date] = s.day;
      });

      uniqueDates.forEach((date) => {
        const dayStr = dateToDayMap[date];
        const isWeekend = dayStr === '週六' || dayStr === '週日';

        customShifts.forEach((cShift) => {
          const existingSlots = updatedShifts.filter(
            (s) => s.date === date && getBaseType(s.type) === cShift.name
          );
          const assignedSlots = existingSlots.filter((s) => s.assignee !== '');
          const required = isWeekend ? cShift.reqWeekend : cShift.reqWeekday;

          if (existingSlots.length < required) {
            const shortage = required - existingSlots.length;
            for (let i = 0; i < shortage; i++) {
              updatedShifts.push({
                id: `auto_${Date.now()}_${Math.random()}`,
                date: date,
                day: dayStr,
                type: cShift.name,
                time: '待定 (依據身分切換)',
                assignee: '',
                role: '門市人員',
                status: 'pending',
              });
            }
          } else if (existingSlots.length > required) {
            let excess =
              existingSlots.length - Math.max(required, assignedSlots.length);
            updatedShifts = updatedShifts.filter((s) => {
              if (
                s.date === date &&
                getBaseType(s.type) === cShift.name &&
                s.assignee === '' &&
                excess > 0
              ) {
                excess--;
                return false;
              }
              return true;
            });
          }
        });
      });

      const dayAssignments = {};
      const empWorkDays = {};
      registeredUsers.forEach((u) => (empWorkDays[u.name] = new Set()));

      updatedShifts.forEach((s) => {
        if (s.assignee) {
          if (!dayAssignments[s.date]) dayAssignments[s.date] = [];
          dayAssignments[s.date].push(s.assignee);
          empWorkDays[s.assignee].add(s.date);
        }
      });

      updatedShifts = updatedShifts.map((shift) => {
        if (shift.assignee) return shift;
        if (!dayAssignments[shift.date]) dayAssignments[shift.date] = [];

        const baseType = getBaseType(shift.type);

        const getBestEmp = (empPool, isPartTimePool) => {
          let available = empPool.filter((emp) => {
            // 💡 排班時只將「已核准」的假單視為無法排班的休假
            const leaves = employeeLeaves[emp] || [];
            if (leaves.some(l => l.date === shift.date && l.status === 'approved')) return false;
            if (dayAssignments[shift.date].includes(emp)) return false;

            if (ruleEnabled) {
              if (!check7DayRule(shift.date, empWorkDays[emp])) return false;
              // 確保大家都能滿足月休 (剩餘由系統自動安排不排班)
              const maxWorkDays = 31 - monthlyLeaveDays;
              if (
                !empWorkDays[emp].has(shift.date) &&
                empWorkDays[emp].size >= maxWorkDays
              )
                return false;
            }
            return true;
          });

          if (available.length > 0) {
            available.sort((a, b) => empWorkDays[a].size - empWorkDays[b].size);
            const minShiftsCount = empWorkDays[available[0]].size;
            const candidates = available.filter(
              (e) => empWorkDays[e].size === minShiftsCount
            );
            const chosen =
              candidates[Math.floor(Math.random() * candidates.length)];

            const finalDetails = resolveShiftDetails(
              baseType,
              isPartTimePool ? '兼職' : '正職',
              shift.day
            );
            return {
              emp: chosen,
              time: finalDetails.time || shift.time,
              type: finalDetails.label || shift.type,
            };
          }
          return null;
        };

        // 💡 核心補缺：先派正職，不夠再派兼職
        let match = getBestEmp(fullTimeEmps, false);
        if (!match) match = getBestEmp(partTimeEmps, true);

        if (match) {
          dayAssignments[shift.date].push(match.emp);
          empWorkDays[match.emp].add(shift.date);
          return {
            ...shift,
            assignee: match.emp,
            time: match.time,
            type: match.type,
          };
        }

        return shift;
      });

      return updatedShifts;
    });

};

const handleSaveLeaves = (userName, leavesArray) => {
setEmployeeLeaves((prev) => ({ ...prev, [userName]: leavesArray }));
};

const handleLoginSuccess = (userName, userRole) => {
setCurrentUser(userName);
setRole(userRole);
setActiveScreen('home');
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
          __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `,
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
          customShifts={customShifts}
          registeredUsers={registeredUsers}
          employeeLeaves={employeeLeaves}
          onApproveLeave={handleApproveLeave}
          onRejectLeave={handleRejectLeave}
          onShiftSelect={(s) => navigateTo('detail', s)}
          onOpenEditor={() => navigateTo('schedule_editor')}
          onOpenLeaveRequest={() => navigateTo('leave_request')}
        />
      )}
      {activeScreen === 'detail' && (
        <DetailScreen shift={selectedShift} role={role} onBack={handleBack} />
      )}
      {activeScreen === 'schedule_editor' && (
        <ScheduleEditorScreen
          shifts={shifts}
          employees={registeredUsers.map((u) => u.name)}
          employeeLeaves={employeeLeaves}
          customShifts={customShifts}
          registeredUsers={registeredUsers}
          onAssigneeChange={handleAssigneeChange}
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
      {activeScreen === 'shift_settings' && (
        <ShiftSettingsScreen
          onBack={handleBack}
          onAddShift={handleAddCustomShift}
          customShifts={customShifts}
          onRemoveShift={handleRemoveCustomShift}
        />
      )}
      {activeScreen === 'employee_management' && (
        <EmployeeManagementScreen
          onBack={handleBack}
          registeredUsers={registeredUsers}
          customShifts={customShifts}
          onUpdateEmployee={handleUpdateEmployee}
          onAddTestEmployee={handleAddTestEmployee}
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
          customShifts={customShifts}
          setCustomShifts={setCustomShifts}
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

// ==========================================
// 畫面 A & B: 登入與註冊畫面
// ==========================================
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
title="點擊切換主管登入" >
<div
className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg mb-4 ${
            isManagerMode
              ? 'bg-[#111] shadow-black/20'
              : 'bg-blue-600 shadow-blue-600/30'
          }`} >
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
const [empType, setEmpType] = useState('正職');
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
      {
        id: Date.now().toString(),
        name: name.trim(),
        password,
        assignedShift: '',
        empType,
      },
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
姓氏 / 姓名 <span className="text-red-500">\*</span>
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
          <div className="flex bg-gray-50 rounded-2xl p-1.5">
            <button
              type="button"
              onClick={() => setEmpType('正職')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                empType === '正職'
                  ? 'bg-white text-blue-600 shadow-sm border border-gray-100'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              正職 (Full-time)
            </button>
            <button
              type="button"
              onClick={() => setEmpType('兼職')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                empType === '兼職'
                  ? 'bg-white text-blue-600 shadow-sm border border-gray-100'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              兼職 (Part-time)
            </button>
          </div>
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

// ==========================================
// 畫面 1: 主畫面
// ==========================================
function HomeScreen({
role,
currentUser,
onLogout,
shifts,
customShifts,
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
return u.empType === '兼職' ? (
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
const timelineHours = Array.from({ length: 14 }, (_, i) => i + 11); // 11:00 到 24:00

// 整理待審核名單
const pendingLeaves = [];
if (role === 'manager') {
Object.entries(employeeLeaves).forEach(([emp, leaves]) => {
leaves.filter(l => l.status === 'pending').forEach(l => {
pendingLeaves.push({ emp, date: l.date });
});
});
}

return (
<div className="flex-1 overflow-y-auto no-scrollbar pb-24 animate-in fade-in duration-300 relative">
<header className="flex flex-col px-8 pt-12 pb-4">
<div className="flex justify-between items-center mb-6">
<div className="flex items-center gap-3">
<div
className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm ${
                role === 'manager' ? 'bg-[#111]' : 'bg-blue-600'
              }`} >
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

      {/* 🌟 待審核通知橫幅 */}
      {role === 'manager' && pendingLeaves.length > 0 && (
        <div className="mx-8 mt-1 mb-5 bg-orange-50 border border-orange-200 p-4 rounded-2xl flex justify-between items-center shadow-sm animate-in slide-in-from-top-4">
          <div className="flex items-center gap-2">
            <Bell size={20} className="text-orange-500 animate-bounce" />
            <div>
              <h3 className="text-orange-800 font-bold text-sm">待審核假單 ({pendingLeaves.length})</h3>
              <p className="text-orange-600 text-[10px] font-bold">員工排休導致該日預警</p>
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

      <section className="px-8 mt-2">
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 -mx-8 px-8">
          {role === 'manager' ? (
            <ActionCard
              icon={<CalendarIcon size={28} />}
              label="排班"
              active={true}
              onClick={onOpenEditor}
            />
          ) : (
            <ActionCard
              icon={<Briefcase size={28} />}
              label="排假"
              active={true}
              onClick={onOpenLeaveRequest}
            />
          )}
        </div>
      </section>

      <section className="mt-6 bg-white rounded-t-[2.5rem] pt-8 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.02)] min-h-[400px]">
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
              const dayOfWeek = (day + 6) % 7;
              const dayStr = [
                '週日',
                '週一',
                '週二',
                '週三',
                '週四',
                '週五',
                '週六',
              ][dayOfWeek];

              const hasShift = displayShifts.some((s) => s.date === dateStr);
              const isSelected = selectedHomeDate === dateStr;

              // 判斷是否缺人
              const isUnderstaffed = isDayUnderstaffed(
                dateStr,
                dayStr,
                shifts,
                customShifts
              );

              let btnClass = 'bg-transparent text-gray-600 hover:bg-gray-50';
              if (isSelected) {
                btnClass =
                  'bg-[#111] text-white shadow-lg transform scale-110 z-10';
              } else if (hasShift) {
                btnClass = 'bg-blue-50/50 text-blue-700 hover:bg-blue-100';
              } else if (isUnderstaffed) {
                btnClass =
                  'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100';
              }

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

                  {isUnderstaffed && (
                    <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full shadow-sm border-2 border-white z-20"></div>
                  )}

                  {!isUnderstaffed && hasShift && !isSelected && (
                    <div className="absolute bottom-1.5 w-1 h-1 rounded-full bg-blue-500"></div>
                  )}
                  {!isUnderstaffed && hasShift && isSelected && (
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

          <div className="relative">
            <div className="absolute left-[2.8rem] top-2 bottom-2 w-px bg-gray-100"></div>

            {(() => {
              const shiftsForDate = displayShifts.filter(
                (s) => s.date === selectedHomeDate
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
                const activeShifts = shiftsForDate.filter((s) => {
                  if (!s.time) return false;
                  // 處理字串中包含 "或" 或 "&" 的多重時段
                  const allParts = s.time.split(/&|或/).map((p) => p.trim());

                  return allParts.some((part) => {
                    let [startStr, endStr] = part.split('-');
                    if (!startStr || !endStr) return false;
                    let startH = parseInt(startStr.split(':')[0], 10);
                    let endH = parseInt(endStr.split(':')[0], 10);
                    if (endH === 0) endH = 24;
                    if (startH > endH) return hour >= startH || hour < endH; // 跨夜情況
                    return hour >= startH && hour < endH;
                  });
                });

                return (
                  <div
                    key={hour}
                    className="flex items-start gap-5 py-3.5 relative"
                  >
                    <div className="w-10 text-right shrink-0 pt-1 relative z-10 bg-white">
                      <span className="text-xs font-black text-gray-400">
                        {hour === 24 ? '00' : hour}:00
                      </span>
                    </div>
                    <div className="absolute left-[2.8rem] top-4.5 -translate-x-1/2 w-[9px] h-[9px] rounded-full bg-gray-200 ring-4 ring-white z-10"></div>

                    <div className="flex-1 flex flex-wrap gap-2 pl-3">
                      {activeShifts.length > 0 ? (
                        activeShifts.map((shift) => (
                          <button
                            key={shift.id}
                            onClick={() => onShiftSelect(shift)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:scale-95 transition-transform ${
                              shift.assignee
                                ? 'bg-white border border-gray-100 text-[#111]'
                                : 'bg-red-50 border border-red-100 text-red-500 border-dashed'
                            }`}
                          >
                            <div
                              className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                                shift.assignee
                                  ? 'bg-blue-50 text-blue-600'
                                  : 'bg-red-100 text-red-500'
                              }`}
                            >
                              <User size={12} strokeWidth={2.5} />
                            </div>
                            <div className="flex flex-col items-start text-left">
                              <span className="text-[9px] opacity-60 leading-none mb-0.5 max-w-[140px] truncate">
                                {shift.type}
                              </span>
                              <div className="flex items-center leading-none">
                                <span className="truncate">
                                  {shift.assignee || '缺人/未指派'}
                                </span>
                                {shift.assignee &&
                                  getUserTypeBadge(shift.assignee)}
                              </div>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="pt-2">
                          <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">
                            — 該時段無人 —
                          </span>
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

      {/* 🌟 假單審核 Modal */}
      {showApprovalModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowApprovalModal(false)}></div>
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm relative z-10 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-orange-500">
                <AlertCircle size={24} />
              </div>
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
                    <span className="text-xs text-gray-500 font-bold flex items-center gap-1">
                      <CalendarIcon size={12} /> {p.date} 申請休假
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onApproveLeave(p.emp, p.date)}
                      className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-100 transition active:scale-95 shadow-sm"
                      title="核准"
                    >
                      <CheckCircle size={18} strokeWidth={2.5} />
                    </button>
                    <button
                      onClick={() => onRejectLeave(p.emp, p.date)}
                      className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition active:scale-95 shadow-sm"
                      title="退回"
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

// ==========================================
// 畫面 2: 詳細資訊
// ==========================================
function DetailScreen({ shift, role, onBack }) {
if (!shift) return null;

return (
<div className="flex-1 overflow-y-auto no-scrollbar bg-[#f8f9fc] pb-24 animate-in fade-in slide-in-from-right-8 duration-300">
<header className="flex justify-between items-center px-8 pt-12 pb-6">
<button
          onClick={onBack}
          className="p-2 -ml-2 text-gray-800 hover:bg-gray-100 rounded-full transition"
        >
<ChevronLeft size={28} strokeWidth={2} />
</button>
<button className="p-2 -mr-2 text-gray-800">
<MoreVertical size={24} strokeWidth={2} />
</button>
</header>

      <div className="px-8 mt-4 flex justify-center relative">
        <button className="absolute left-8 top-0 p-2 text-gray-400 hover:text-red-500 transition-colors">
          <Heart size={24} strokeWidth={2} />
        </button>
        <div className="w-64 h-56 mt-4 relative flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-br from-white to-blue-50 rounded-[3rem] shadow-[0_20px_40px_rgba(0,0,0,0.05)] border border-white transform rotate-3"></div>
          <div className="absolute w-3/4 h-3/4 bg-white rounded-[2rem] shadow-sm flex flex-col items-center justify-center transform -rotate-3 z-10">
            <span className="text-blue-600 font-extrabold text-5xl tracking-tighter">
              {shift.date.split('/')[1]}
            </span>
            <span className="text-gray-400 font-medium text-sm mt-1 uppercase tracking-widest">
              {shift.date.split('/')[0]} 月份
            </span>
          </div>
        </div>
      </div>

      <div className="px-8 mt-16">
        <p className="text-gray-400 text-sm font-medium mb-1 tracking-wide">
          排班詳細資訊
        </p>
        <h2 className="text-3xl font-bold text-[#111] leading-tight">
          {shift.type}{' '}
          <span className="font-light text-gray-500">{shift.day}</span>
        </h2>

        <div className="flex justify-between items-end mt-6">
          <div className="flex flex-col gap-1 w-2/3">
            <span className="text-gray-400 font-medium uppercase text-xs">
              上班時段
            </span>
            <span className="text-[14px] font-bold text-[#111] leading-snug break-words">
              {shift.time}
            </span>
          </div>
          <button className="w-12 h-12 shrink-0 bg-[#2563EB] text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition active:scale-95">
            {role === 'manager' ? (
              <PenTool size={22} strokeWidth={2} />
            ) : (
              <RefreshCw size={22} strokeWidth={2} />
            )}
          </button>
        </div>

        <div className="flex gap-4 mt-8">
          <div className="flex-1 bg-white p-5 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-gray-100">
            <div className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center mb-4">
              <User size={14} className="text-gray-700" />
            </div>
            <p className="text-[#111] font-semibold text-sm leading-snug">
              負責人
              <br />
              <span
                className={shift.assignee ? 'text-blue-600' : 'text-red-500'}
              >
                {shift.assignee || '未指派'}
              </span>
            </p>
          </div>
          <div className="flex-1 bg-white p-5 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-gray-100">
            <div className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center mb-4 relative">
              <ShieldCheck size={14} className="text-gray-700" />
            </div>
            <p className="text-[#111] font-semibold text-sm leading-snug">
              職位需求
              <br />
              {shift.role || '門市人員'}
            </p>
          </div>
        </div>
      </div>
    </div>

);
}

// ==========================================
// 畫面 3: 主管排班編輯器 (含一鍵排班)
// ==========================================
function ScheduleEditorScreen({
shifts,
employees,
employeeLeaves,
customShifts,
registeredUsers,
onAssigneeChange,
onAutoSchedule,
onBack,
ruleEnabled,
monthlyLeaveDays,
}) {
const [selectedDate, setSelectedDate] = useState('3/16');
const [showToast, setShowToast] = useState(false);
const [errorMsg, setErrorMsg] = useState('');

const CALENDAR_DATES = [
{ date: '3/16', num: '16', day: '週一' },
{ date: '3/17', num: '17', day: '週二' },
{ date: '3/18', num: '18', day: '週三' },
{ date: '3/19', num: '19', day: '週四' },
{ date: '3/20', num: '20', day: '週五' },
{ date: '3/21', num: '21', day: '週六' },
{ date: '3/22', num: '22', day: '週日' },
];

const checkIsAlert = (dateStr) => {
const dayShifts = shifts.filter((s) => s.date === dateStr);
if (dayShifts.length === 0) return false;
const assignees = dayShifts
.filter((s) => s.assignee)
.map((s) => s.assignee);
const hasOverworked = new Set(assignees).size < assignees.length;
return hasOverworked;
};

const selectedShifts = shifts.filter((s) => s.date === selectedDate);

// 在排班編輯器中，將「已核准」或「待審核」的假都視為休假(避免選入)
const employeesOnLeave = Object.entries(employeeLeaves || {})
.filter(([emp, leaves]) => leaves.some(l => l.date === selectedDate))
.map(([emp]) => emp);

const hasPendingLeaves = Object.values(employeeLeaves).some(leaves => leaves.some(l => l.status === 'pending'));

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

// 🌟 新增：計算本月總體人力缺口與招募建議
const marchDays = Array.from({ length: 31 }, (\_, i) => i + 1);
let totalReqShifts = 0;
marchDays.forEach((day) => {
const dayOfWeek = (day + 6) % 7;
const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
customShifts.forEach((cs) => {
totalReqShifts += isWeekend ? cs.reqWeekend || 0 : cs.reqWeekday || 0;
});
});
const maxShiftsPerPerson = 31 - monthlyLeaveDays;
const currentCapacity = employees.length \* maxShiftsPerPerson;
const shiftDeficit = Math.max(0, totalReqShifts - currentCapacity);
const suggestedHires = Math.ceil(shiftDeficit / maxShiftsPerPerson);

return (
<div className="flex-1 overflow-y-auto no-scrollbar bg-[#f5f6f8] pb-24 animate-in fade-in slide-in-from-right-8 duration-300 relative">
{showToast && (
<div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4">
<div className="bg-green-500 text-white px-5 py-2.5 rounded-full shadow-lg font-bold text-sm flex items-center gap-2 whitespace-nowrap">
<CheckCircle size={18} />
{ruleEnabled
? `已依七休二規則與變形矩陣填補！`
: '已依據設定人數自動填補空缺！'}
</div>
</div>
)}
{errorMsg && (
<div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 w-11/12 max-w-[320px]">
<div className="bg-red-500 text-white px-5 py-2.5 rounded-2xl shadow-lg font-bold text-sm flex items-center justify-center gap-2 whitespace-nowrap">
<AlertCircle size={18} />
{errorMsg}
</div>
</div>
)}

      <header className="sticky top-0 bg-[#f5f6f8]/90 backdrop-blur-md z-10 flex justify-between items-center px-8 pt-12 pb-4 border-b border-gray-200/50">
        <div className="flex items-center">
          <button
            onClick={onBack}
            className="p-2 -ml-2 text-gray-800 hover:bg-gray-200 rounded-full transition mr-4"
          >
            <ChevronLeft size={28} strokeWidth={2} />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold text-[#111] tracking-tight">
              排班行事曆
            </h1>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mt-0.5">
              2026年 3月
            </p>
          </div>
        </div>
        <button
          onClick={handleMagicClick}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all ${
            hasPendingLeaves
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
              : 'bg-[#2563EB] hover:bg-blue-700 text-white shadow-blue-600/20'
          }`}
        >
          <Wand2 size={16} /> 一鍵排班
        </button>
      </header>

      {/* 🌟 人手不足嚴重警告看板 */}
      {suggestedHires > 0 && (
        <div className="px-8 mt-4 animate-in fade-in slide-in-from-top-4">
          <div className="bg-red-50 border border-red-200 rounded-[1.5rem] p-4 flex flex-col gap-2 relative overflow-hidden shadow-sm">
            <div className="absolute -right-4 -bottom-4 opacity-10 text-red-500 pointer-events-none">
              <AlertCircle size={80} />
            </div>
            <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
              <AlertCircle size={18} />
              <span>系統預警：總體人手嚴重不足！</span>
            </div>
            <p className="text-[11px] text-red-600/90 font-medium leading-relaxed z-10">
              本月總共需要{' '}
              <strong className="text-red-700">{totalReqShifts}</strong>{' '}
              個班次，但目前 {employees.length} 位員工扣除月休後，極限只能提供{' '}
              <strong className="text-red-700">{currentCapacity}</strong>{' '}
              個班次。
              <br />
              系統已盡力排班，但因受限於「七休二」與「月休天數」，仍會有缺額。
              <br />
              💡 建議需再招募至少{' '}
              <strong className="text-red-700 text-lg bg-red-100 px-1.5 py-0.5 rounded mx-0.5">
                {suggestedHires}
              </strong>{' '}
              位員工。
            </p>
          </div>
        </div>
      )}

      <div className="px-8 mt-6">
        <div className="grid grid-cols-7 gap-x-2 gap-y-3">
          {CALENDAR_DATES.map((cal, i) => {
            const isAlert = checkIsAlert(cal.date);
            const isSelected = selectedDate === cal.date;

            const isUnderstaffed = isDayUnderstaffed(
              cal.date,
              cal.day,
              shifts,
              customShifts
            );

            let buttonStyle =
              'bg-white text-gray-800 shadow-sm border border-transparent';
            if (isSelected)
              buttonStyle =
                'bg-[#111] text-white shadow-md transform scale-105 z-10';
            else if (isUnderstaffed)
              buttonStyle = 'bg-red-50 text-red-600 border border-red-200';
            else if (isAlert)
              buttonStyle =
                'bg-orange-50 text-orange-600 border border-orange-200';

            return (
              <button
                key={i}
                onClick={() => setSelectedDate(cal.date)}
                className={`h-12 w-full rounded-2xl flex flex-col items-center justify-center transition-all relative ${buttonStyle}`}
              >
                <span
                  className={`text-[15px] font-bold ${
                    isSelected ? 'text-white' : ''
                  }`}
                >
                  {cal.num}
                </span>

                {isUnderstaffed && (
                  <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full shadow-sm border-2 border-white z-20"></div>
                )}

                {!isUnderstaffed && isAlert && !isSelected && (
                  <div className="w-1 h-1 rounded-full bg-orange-500 mt-0.5"></div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-8 mt-8">
        <h3 className="text-sm font-bold text-gray-400 tracking-wider mb-4 border-b border-gray-200/60 pb-2">
          {selectedDate} 排班明細
        </h3>
        {employeesOnLeave.length > 0 && (
          <div className="mb-4 bg-orange-50 p-3 rounded-2xl border border-orange-100 flex items-center gap-2">
            <Briefcase size={18} className="text-orange-500" />
            <span className="text-orange-700 font-bold text-sm">
              今日休假/待審核：{employeesOnLeave.join(', ')}
            </span>
          </div>
        )}
        <div className="space-y-4">
          {selectedShifts.map((shift) => (
            <div
              key={shift.id}
              className="bg-white rounded-[1.5rem] p-5 shadow-[0_8px_20px_rgb(0,0,0,0.03)] border border-gray-50 flex flex-col"
            >
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <Clock
                    size={18}
                    className={
                      shift.assignee ? 'text-blue-500' : 'text-red-500'
                    }
                  />
                  <span className="font-bold text-[#111] max-w-[140px] truncate">
                    {shift.type}
                  </span>
                  {!shift.assignee && (
                    <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold ml-1 shrink-0">
                      缺人
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-semibold text-gray-400 bg-gray-50 px-2 py-1 rounded-lg max-w-[140px] leading-tight break-words text-right">
                  {shift.time}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-gray-50 pt-4">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-inner shrink-0 ${
                      shift.assignee
                        ? registeredUsers.find((u) => u.name === shift.assignee)
                            ?.empType === '兼職'
                          ? 'bg-orange-500'
                          : 'bg-blue-600'
                        : 'bg-red-400'
                    }`}
                  >
                    {shift.assignee ? shift.assignee.charAt(0) : '?'}
                  </div>
                  <span
                    className={`text-sm font-bold truncate max-w-[80px] ${
                      shift.assignee ? 'text-gray-800' : 'text-red-500'
                    }`}
                  >
                    {shift.assignee || '尚未指派'}
                  </span>
                </div>
                <div className="relative">
                  <select
                    value={shift.assignee}
                    onChange={(e) => onAssigneeChange(shift.id, e.target.value)}
                    className={`appearance-none font-bold text-[13px] py-2 pl-3 pr-8 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 text-right cursor-pointer transition-colors w-full max-w-[130px] truncate
                      ${
                        shift.assignee
                          ? 'bg-gray-50 text-gray-700 border-gray-200'
                          : 'bg-red-50 text-red-600 border-red-200 animate-pulse'
                      }`}
                  >
                    <option value="">-- 選擇員工 --</option>
                    {employees.map((emp) => {
                      const isResting = employeesOnLeave.includes(emp);
                      const uInfo = registeredUsers.find((u) => u.name === emp);
                      const typeLabel =
                        uInfo?.empType === '兼職' ? '(兼職)' : '(正職)';
                      return (
                        <option key={emp} value={emp} disabled={isResting}>
                          {emp} {typeLabel} {isResting ? '- 休假/待核' : ''}
                        </option>
                      );
                    })}
                  </select>
                  <div
                    className={`pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 ${
                      shift.assignee ? 'text-gray-400' : 'text-red-500'
                    }`}
                  >
                    <ChevronLeft size={14} className="transform -rotate-90" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>

);
}

// ==========================================
// 畫面 4: 員工請假申請
// ==========================================
function LeaveRequestScreen({
onBack,
currentUser,
employeeLeaves,
onSaveLeaves,
}) {
const initialLeaves = employeeLeaves[currentUser] || [];
const [selectedLeaves, setSelectedLeaves] = useState(initialLeaves);
// 我們先不強制鎖死，讓員工可以彈性修改
const [isSubmitted, setIsSubmitted] = useState(false);
const [showConfirmModal, setShowConfirmModal] = useState(false);
const [warningMsg, setWarningMsg] = useState('');

// 根據要求：正/兼職只能自行選 4 天假，其中 1 天是假日，其他 3 天平日
const MAX_LEAVES = 4;
const MAX_WEEKEND_LEAVES = 1;
const MAX_WEEKDAY_LEAVES = 3;

// 假定當日超過 N 人休假就屬於「重複排假人手不足」(觸發主管審核)
const APPROVAL_THRESHOLD = 2;

const marchDays = Array.from({ length: 31 }, (\_, i) => i + 1);

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

    // 若已經選取，則取消選取
    const existingIndex = selectedLeaves.findIndex(l => l.date === dateStr);
    if (existingIndex >= 0) {
      setSelectedLeaves((prev) => prev.filter((l) => l.date !== dateStr));
      setWarningMsg('');
      return;
    }

    const isWknd = isWeekendDay(day);
    const currentWkndCount = selectedLeaves.filter((l) => isWeekendDay(parseInt(l.date.split('/')[1]))).length;
    const currentWkdyCount = selectedLeaves.filter((l) => !isWeekendDay(parseInt(l.date.split('/')[1]))).length;

    // 檢查自選天數比例限制 (1天假日，3天平日)
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

    // 判斷該日人數是否已達預警門檻 (將標記為 pending)
    const bookedCount = othersLeaves[dateStr] || 0;
    const needsApproval = bookedCount >= APPROVAL_THRESHOLD;

    const newLeave = { date: dateStr, status: needsApproval ? 'pending' : 'approved' };
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
<div className="flex-1 overflow-y-auto no-scrollbar bg-[#f8f9fc] pb-32 animate-in fade-in slide-in-from-right-8 duration-300 relative">
{warningMsg && (
<div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 w-11/12 max-w-[320px]">
<div className={`text-white px-5 py-2.5 rounded-2xl shadow-lg font-bold text-sm flex items-center justify-center gap-2 text-center leading-snug ${warningMsg.includes('主管審核') ? 'bg-orange-500' : 'bg-red-500'}`}>
<AlertCircle size={18} className="shrink-0" />
{warningMsg}
</div>
</div>
)}
<header className="sticky top-0 bg-[#f8f9fc]/90 backdrop-blur-md z-10 flex items-center px-8 pt-12 pb-4 border-b border-gray-200/50">
<button
          onClick={onBack}
          className="p-2 -ml-2 text-gray-800 hover:bg-gray-200 rounded-full transition mr-4"
        >
<ChevronLeft size={28} strokeWidth={2} />
</button>
<div>
<h1 className="text-2xl font-extrabold text-[#111] tracking-tight">
本月排休
</h1>
<p className="text-xs font-semibold text-gray-500 mt-0.5">
{currentUser}{' '}
{isSubmitted
? ' - 假單已鎖定'
: ` - 已選 ${selectedLeaves.length} 天 (規定自選 4 天)`}
</p>
</div>
</header>

      <div className="px-8 mt-6">
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl mb-6">
          <p className="text-xs font-bold text-blue-800 leading-relaxed">
            💡 系統排休規則：<br />
            為確保公平性，每人可自行劃定 <strong className="text-red-500">4天</strong> 假。<br />
            其中包含 <strong className="text-blue-600">1天假日</strong> 與 <strong className="text-blue-600">3天平日</strong>。<br />
            （若選擇人數過多將須經主管審核，其餘排休將由系統自動分配）
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
            <span>自選進度 (最多1假日, 3平日)</span>
            <span
              className={
                selectedLeaves.length === MAX_LEAVES ? 'text-green-600' : 'text-blue-600'
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

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <div className="grid grid-cols-7 gap-x-2 gap-y-3">
            {['日', '一', '二', '三', '四', '五', '六'].map((d) => (
              <div
                key={d}
                className={`text-center text-[10px] font-bold mb-2 ${d === '日' || d === '六' ? 'text-orange-500' : 'text-gray-400'}`}
              >
                {d}
              </div>
            ))}
            {marchDays.map((day) => {
              const dateStr = `3/${day}`;
              const myLeave = selectedLeaves.find((l) => l.date === dateStr);
              const bookedCount = othersLeaves[dateStr] || 0;
              const isFull = bookedCount >= APPROVAL_THRESHOLD; // 紅色警告線
              const isWknd = isWeekendDay(day);

              let btnClass = 'bg-gray-50 text-gray-600 border border-gray-100 hover:bg-gray-100';

              if (myLeave) {
                if (myLeave.status === 'pending') {
                  btnClass = 'bg-orange-500 text-white shadow-md transform scale-105 z-10 font-bold border-transparent';
                } else {
                  btnClass = 'bg-[#111] text-white shadow-md transform scale-105 z-10 font-bold border-transparent';
                }
              } else if (isFull) {
                btnClass = 'bg-red-50 text-red-500 border border-red-100 font-bold';
              } else if (bookedCount > 0) {
                btnClass = 'bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 font-bold';
              }

              return (
                <button
                  key={day}
                  onClick={() => handleDayClick(day)}
                  disabled={isSubmitted}
                  className={`relative w-full aspect-square rounded-xl flex items-center justify-center transition-all duration-200 ${btnClass}`}
                >
                  <span className={`text-[14px] ${isWknd && !myLeave && !isFull ? 'text-orange-600' : ''}`}>{day}</span>
                  {isWknd && !myLeave && !isFull && <div className="absolute top-1 right-1 w-1 h-1 bg-orange-400 rounded-full"></div>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 w-full p-8 bg-gradient-to-t from-[#f8f9fc] via-[#f8f9fc] to-transparent">
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
            發送假單 ({selectedLeaves.length} / 4 天)
          </button>
        )}
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
              {selectedLeaves.some(l => l.status === 'pending') && (
                <span className="text-orange-500 font-bold block mt-1">⚠️ 包含待審核的假單，須經主管同意。</span>
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

// ==========================================
// 共用元件
// ==========================================
function ActionCard({ icon, label, active, onClick }) {
return (
<div
onClick={onClick}
className={`flex-shrink-0 w-28 h-32 rounded-[2rem] p-4 flex flex-col justify-between cursor-pointer transition-transform hover:scale-105 ${
        active
          ? 'bg-[#18181A] text-white shadow-xl shadow-black/10'
          : 'bg-white text-gray-800 shadow-sm border border-gray-100'
      }`} >
<div className={`mt-2 ${active ? 'text-white' : 'text-gray-800'}`}>
{icon}
</div>
<span className="text-xs font-bold tracking-wider uppercase mb-1">
{label}
</span>
</div>
);
}

// ==========================================
// 畫面 5: 班別時間設定
// ==========================================
function ShiftSettingsScreen({
onBack,
onAddShift,
customShifts,
onRemoveShift,
}) {
const [continuousName, setContinuousName] = useState('');
const [showToast, setShowToast] = useState(false);

const handleAddContinuous = () => {
if (!continuousName.trim()) return;
onAddShift({ name: continuousName });
setContinuousName('');
showSuccessToast();
};

const showSuccessToast = () => {
setShowToast(true);
setTimeout(() => setShowToast(false), 2000);
};

return (
<div className="flex-1 overflow-y-auto no-scrollbar bg-[#f5f6f8] pb-32 animate-in slide-in-from-bottom-8 duration-300 relative">
{showToast && (
<div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4">
<div className="bg-green-500 text-white px-5 py-2.5 rounded-full shadow-lg font-bold text-sm flex items-center gap-2 whitespace-nowrap">
<CheckCircle size={18} /> 已成功建立班別！
</div>
</div>
)}
<header className="sticky top-0 bg-[#f5f6f8]/90 backdrop-blur-md z-10 flex items-center px-8 pt-12 pb-4 border-b border-gray-200/50">
<button
          onClick={onBack}
          className="p-2 -ml-2 text-gray-800 hover:bg-gray-200 rounded-full transition mr-4"
        >
<ChevronLeft size={28} strokeWidth={2} />
</button>
<div>
<h1 className="text-2xl font-extrabold text-[#111] tracking-tight">
自訂班別
</h1>
<p className="text-xs font-semibold text-gray-500 mt-0.5">
自訂您的排班名稱
</p>
</div>
</header>

      <div className="px-8 mt-6 space-y-6">
        <div className="bg-white rounded-[2rem] p-6 shadow-[0_8px_20px_rgb(0,0,0,0.03)] border border-gray-50">
          <div className="flex items-center gap-3 mb-5 border-b border-gray-50 pb-4">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Layers size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="font-bold text-[#111] text-lg">新增班別類別</h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                Add Shift Category
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                班別名稱
              </label>
              <input
                type="text"
                value={continuousName}
                onChange={(e) => setContinuousName(e.target.value)}
                placeholder="例如：大夜班"
                className="w-full bg-gray-50 text-gray-800 font-bold py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all border border-transparent focus:border-blue-100"
              />
            </div>
            <button
              onClick={handleAddContinuous}
              className="w-full py-3.5 mt-2 rounded-xl bg-[#111] text-white font-bold hover:bg-gray-800 active:scale-[0.98] transition-all shadow-md"
            >
              新增班別
            </button>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200/60 pb-8">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-lg font-extrabold text-[#111]">
              已建立的班別清單
            </h3>
            <span className="bg-gray-200 text-gray-600 text-[10px] px-2 py-0.5 rounded-full font-bold">
              {customShifts.length}
            </span>
          </div>
          <div className="space-y-3">
            {customShifts.length === 0 ? (
              <div className="text-center py-6 bg-white rounded-2xl border border-dashed border-gray-200 shadow-sm">
                <p className="text-gray-400 font-medium text-sm">
                  尚未建立任何班別
                </p>
              </div>
            ) : (
              customShifts.map((shift) => (
                <div
                  key={shift.id}
                  className="bg-white rounded-[1.2rem] p-4 shadow-[0_4px_15px_rgb(0,0,0,0.03)] border border-gray-100 flex items-center justify-between transition-transform hover:scale-[1.02]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                      <Clock size={18} strokeWidth={2.5} />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-gray-800">
                        {shift.name}
                      </p>
                      <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                        系統自動變換時間
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveShift(shift.id)}
                    className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors active:scale-90"
                    title="刪除此班別"
                  >
                    <Trash2 size={14} strokeWidth={2.5} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>

);
}

// ==========================================
// 畫面 6: 後台系統設定
// ==========================================
function BackendSettingsScreen({
onBack,
ruleEnabled,
setRuleEnabled,
monthlyLeaveDays,
setMonthlyLeaveDays,
dailyWorkHours,
setDailyWorkHours,
customShifts,
setCustomShifts,
}) {
const updateRequiredCount = (id, delta, isWeekend) => {
setCustomShifts((prev) =>
prev.map((s) => {
if (s.id === id) {
if (isWeekend) {
const newCount = Math.max(
0,
(s.reqWeekend !== undefined ? s.reqWeekend : 1) + delta
);
return { ...s, reqWeekend: newCount };
} else {
const newCount = Math.max(
0,
(s.reqWeekday !== undefined ? s.reqWeekday : 1) + delta
);
return { ...s, reqWeekday: newCount };
}
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
系統排班規則與限制
</p>
</div>
</header>

      <div className="px-8 mt-6 space-y-6">
        {/* 基本規則開關 */}
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
            （必須休 2 天）。<br /><br />
            另外，每位員工每月<strong className="text-red-500">只能自選 4 天假（1假+3平）</strong>，若發生衝突會轉交主管審核，剩餘假額由系統在符合人力與七休二的情況下為其自動保留。
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

        {/* 🌟 智慧時段對應矩陣說明 */}
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
          <p className="text-xs font-medium text-gray-500 mb-4 leading-relaxed">
            平日/假日營業時間：<strong className="text-[#111]">11:00 - 00:00</strong><br />
            指派班別時，系統會自動套用以下上下班時間：
          </p>
          <div className="space-y-3">
            <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100 text-xs">
              <div className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div> 正職人員 (平假日一樣)
              </div>
              <div className="grid grid-cols-1 gap-2 text-gray-600">
                <div>
                  <span className="font-bold text-gray-700">早班正職：</span> 11:00 - 15:00 & 17:00 - 22:00
                </div>
                <div>
                  <span className="font-bold text-gray-700">晚班正職：</span> 15:00 - 00:00
                </div>
              </div>
            </div>
            <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100 text-xs">
              <div className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div> 兼職人員 (彈性變形)
              </div>
              <div className="grid grid-cols-1 gap-y-3 text-gray-600">
                <div className="border-b border-gray-200 pb-2">
                  <span className="font-bold text-gray-500 bg-gray-200 px-1 rounded mr-1 mb-1 inline-block">
                    平日
                  </span><br />
                  <span className="font-bold">早班：</span>11:00 - 15:00 或 18:00 - 22:00<br />
                  <span className="font-bold">晚班：</span>18:00 - 22:00
                </div>
                <div>
                  <span className="font-bold text-orange-500 bg-orange-100 px-1 rounded mr-1 mb-1 inline-block">
                    假日
                  </span><br />
                  <span className="font-bold">早/晚班：</span>11:00 - 15:00 & 17:00 - 22:00<br />
                  <span className="ml-12">或者 11:00 - 20:00</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 平假日分離需求設定 */}
        <div className="bg-white rounded-[2rem] p-6 shadow-[0_8px_20px_rgb(0,0,0,0.03)] border border-gray-50">
          <div className="flex items-center gap-3 mb-5 border-b border-gray-50 pb-4">
            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Users size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="font-bold text-[#111] text-lg">
                各班別需求人數設定
              </h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                Staffing Demands
              </p>
            </div>
          </div>
          <p className="text-xs font-medium text-gray-500 mb-4 leading-relaxed">
            系統會依據您設定的各班別指派人數（用以對應各時段的尖峰需求人數），自動於一鍵排班時安插缺額。
          </p>
          <div className="space-y-4">
            {customShifts.map((shift) => (
              <div
                key={shift.id}
                className="bg-gray-50 p-4 rounded-2xl border border-gray-100"
              >
                <p className="font-bold text-sm text-gray-800 mb-3 border-b border-gray-200 pb-2">
                  {shift.name} 需求
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded w-max">
                      平日
                    </span>
                    <div className="flex items-center gap-2 bg-white px-1.5 py-1 rounded-lg border border-gray-200 shadow-sm mt-1">
                      <button
                        onClick={() => updateRequiredCount(shift.id, -1, false)}
                        className="text-gray-400 hover:text-blue-600 transition-colors p-1 active:scale-90"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span className="font-extrabold text-sm text-[#111] w-4 text-center">
                        {shift.reqWeekday !== undefined ? shift.reqWeekday : 1}
                      </span>
                      <button
                        onClick={() => updateRequiredCount(shift.id, 1, false)}
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
                        onClick={() => updateRequiredCount(shift.id, -1, true)}
                        className="text-gray-400 hover:text-blue-600 transition-colors p-1 active:scale-90"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span className="font-extrabold text-sm text-[#111] w-4 text-center">
                        {shift.reqWeekend !== undefined ? shift.reqWeekend : 1}
                      </span>
                      <button
                        onClick={() => updateRequiredCount(shift.id, 1, true)}
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
// 畫面 7: 員工管理頁面
// ==========================================
function EmployeeManagementScreen({
onBack,
registeredUsers,
customShifts,
onUpdateEmployee,
onAddTestEmployee,
}) {
const [testRoleCombo, setTestRoleCombo] = useState('早班\_正職');

// 🌟 動態計算各班別與身分的精細人數
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
];

customShifts.forEach((shift) => {
['正職', '兼職'].forEach((type) => {
const count = registeredUsers.filter(
(u) => u.empType === type && u.assignedShift === shift.id
).length;

      if (count === 0 && !['早班', '晚班'].includes(shift.name)) return;

      let bg = 'bg-gray-600';
      let text = 'text-gray-200';
      let shadow = 'shadow-gray-600/20';
      if (shift.name === '早班' && type === '正職') {
        bg = 'bg-blue-500';
        text = 'text-blue-100';
        shadow = 'shadow-blue-500/20';
      } else if (shift.name === '晚班' && type === '正職') {
        bg = 'bg-indigo-600';
        text = 'text-indigo-200';
        shadow = 'shadow-indigo-600/20';
      } else if (shift.name === '早班' && type === '兼職') {
        bg = 'bg-orange-500';
        text = 'text-orange-100';
        shadow = 'shadow-orange-500/20';
      } else if (shift.name === '晚班' && type === '兼職') {
        bg = 'bg-rose-500';
        text = 'text-rose-200';
        shadow = 'shadow-rose-500/20';
      }

      stats.push({
        id: `${shift.id}_${type}`,
        label: `${shift.name}${type}`,
        count: count,
        bg: bg,
        text: text,
        shadow: shadow,
        icon: type === '正職' ? <ShieldCheck size={48} /> : <Clock size={48} />,
      });
    });

});

const unassignedCount = registeredUsers.filter(
(u) => !u.assignedShift
).length;
if (unassignedCount > 0) {
stats.push({
id: 'unassigned',
label: '未指派班別',
count: unassignedCount,
bg: 'bg-red-500',
text: 'text-red-100',
shadow: 'shadow-red-500/20',
icon: <AlertCircle size={48} />,
span: 'col-span-2',
});
}

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
編輯員工名稱、密碼與班別
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
            產生的人員會自帶合法假單 (1日3平)
          </p>
          <div className="flex items-center gap-2">
            <select
              value={testRoleCombo}
              onChange={(e) => setTestRoleCombo(e.target.value)}
              className="flex-1 appearance-none bg-gray-50 text-gray-800 font-bold text-xs py-2 pl-3 pr-8 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%232563EB%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.4-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[length:8px_8px] bg-[right_10px_center]"
            >
              <option value="早班_正職">早班正職</option>
              <option value="晚班_正職">晚班正職</option>
              <option value="早班_兼職">早班兼職</option>
              <option value="晚班_兼職">晚班兼職</option>
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
            customShifts={customShifts}
            onUpdate={onUpdateEmployee}
          />
        ))}
      </div>
    </div>

);
}

function EmployeeEditCard({ user, allUsers, customShifts, onUpdate }) {
const [localName, setLocalName] = useState(user.name);
const [localType, setLocalType] = useState(user.empType || '正職');
const [localPassword, setLocalPassword] = useState(user.password);
const [pwdError, setPwdError] = useState('');

const handleBlur = () => {
if (!/^\d{6}$/.test(localPassword)) {
setPwdError('需為 6 位數字');
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
        localType !== user.empType ||
        localPassword !== user.password)
    ) {
      onUpdate(
        user.id,
        localName.trim(),
        user.assignedShift,
        localType,
        localPassword
      );
    } else {
      setLocalName(user.name);
    }

};

const handleTypeChange = (e) => {
const newType = e.target.value;
setLocalType(newType);
onUpdate(
user.id,
localName.trim(),
user.assignedShift,
newType,
localPassword
);
};

const handleShiftChange = (e) => {
onUpdate(user.id, user.name, e.target.value, localType, localPassword);
};

return (
<div className="bg-white rounded-[1.5rem] p-4 shadow-[0_4px_15px_rgb(0,0,0,0.03)] border border-gray-50 flex flex-col gap-3 transition-shadow hover:shadow-md">
<div className="flex items-center gap-3">
<div
className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${
            localType === '兼職' ? 'bg-orange-500' : 'bg-[#111]'
          }`} >
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
<select
value={localType}
onChange={handleTypeChange}
className={`text-xs font-bold px-2 py-1.5 rounded-lg border-none focus:ring-0 cursor-pointer outline-none appearance-none text-center ${
            localType === '兼職'
              ? 'bg-orange-50 text-orange-600'
              : 'bg-blue-50 text-blue-600'
          }`} >
<option value="正職">正職</option>
<option value="兼職">兼職</option>
</select>
</div>

      <div className="bg-gray-50 rounded-xl p-2.5 flex items-center justify-between border border-gray-100 mt-1">
        <span className="text-xs font-bold text-gray-500 flex items-center gap-1.5 ml-1">
          <Briefcase size={12} /> 預設班別
        </span>
        <select
          value={user.assignedShift || ''}
          onChange={handleShiftChange}
          className="appearance-none bg-white text-blue-600 font-bold text-xs py-1.5 pl-3 pr-8 rounded-lg border border-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm relative z-10 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%232563EB%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.4-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[length:8px_8px] bg-[right_10px_center]"
        >
          <option value="" className="text-gray-500">
            -- 尚未指派 --
          </option>
          {customShifts.map((shift) => (
            <option key={shift.id} value={shift.id}>
              {shift.name}
            </option>
          ))}
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
            } // 限制只能輸入數字
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
    </div>

);
}

function BottomNav({ role, activeScreen, onNavigate }) {
return (
<nav className="absolute bottom-0 left-0 w-full bg-white/85 backdrop-blur-md border-t border-gray-100 px-8 py-5 flex justify-between items-center z-50">
<button
onClick={() => onNavigate('home')}
className={`${
          activeScreen === 'home'
            ? 'text-[#2563EB]'
            : 'text-gray-400 hover:text-gray-800'
        } transition-transform active:scale-90`} >
<Home
size={24}
strokeWidth={2.5}
fill={activeScreen === 'home' ? 'currentColor' : 'none'}
/>
</button>
{role === 'manager' ? (
<button
onClick={() => onNavigate('shift_settings')}
className={`${
            activeScreen === 'shift_settings'
              ? 'text-[#2563EB]'
              : 'text-gray-400 hover:text-gray-800'
          } transition-colors active:scale-90 relative`} >
<CheckCircle
size={24}
strokeWidth={activeScreen === 'shift_settings' ? 2.5 : 2}
/>
</button>
) : (
<button className="text-gray-400 hover:text-gray-800 transition-colors active:scale-90">
<Heart size={24} strokeWidth={2} />
</button>
)}
<button
onClick={() => onNavigate('employee_management')}
className={`${
          activeScreen === 'employee_management'
            ? 'text-[#2563EB]'
            : 'text-gray-400 hover:text-gray-800'
        } transition-colors active:scale-90`} >
<User
size={24}
strokeWidth={activeScreen === 'employee_management' ? 2.5 : 2}
/>
</button>
{role === 'manager' ? (
<button
onClick={() => onNavigate('backend_settings')}
className={`${
            activeScreen === 'backend_settings'
              ? 'text-[#2563EB]'
              : 'text-gray-400 hover:text-gray-800'
          } transition-colors active:scale-90 relative`} >
<Settings
size={24}
strokeWidth={activeScreen === 'backend_settings' ? 2.5 : 2}
/>
</button>
) : (
<button className="text-gray-400 hover:text-gray-800 transition-colors active:scale-90 relative">
<Briefcase size={24} strokeWidth={2} />
</button>
)}
</nav>
);
}
