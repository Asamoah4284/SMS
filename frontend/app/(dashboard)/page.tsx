import { Users, GraduationCap, Banknote, CalendarCheck, Megaphone, Plus, ArrowRight } from "lucide-react";

export const metadata = { title: 'Overview — EduTrack SMS' };

export default function DashboardPage() {
  return (
    <div className="p-8 max-w-[1600px] w-full mx-auto animate-in fade-in duration-500 h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-gray-900">Dashboard Overview</h2>
          <p className="text-gray-500 mt-1 font-medium">Welcome back, Admin. Here's what's happening today.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-lg font-semibold hover:bg-gray-50 transition-colors shadow-sm focus:ring-2 focus:ring-gray-200 outline-none">
            <Megaphone className="w-4 h-4 text-gray-500" />
            Announcement
          </button>
          <button className="flex items-center gap-2 bg-black text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-gray-800 transition-colors shadow-sm focus:ring-2 focus:ring-black outline-none">
            <Plus className="w-4 h-4 text-gray-300" />
            Add Student
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 w-full">
        <StatCard label="Total Students" value="1,245" icon={Users} color="text-blue-600" bg="bg-blue-50 border-blue-100" />
        <StatCard label="Attendance Today" value="94%" icon={CalendarCheck} color="text-green-600" bg="bg-green-50 border-green-100" />
        <StatCard label="Fees Collected" value="$42,500" icon={Banknote} color="text-amber-600" bg="bg-amber-50 border-amber-100" />
        <StatCard label="Teachers" value="112" icon={GraduationCap} color="text-purple-600" bg="bg-purple-50 border-purple-100" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full pb-8 h-full">
        {/* Recent Announcements */}
        <div className="bg-white border text-gray-900 border-gray-200 shadow-sm shadow-gray-200/50 rounded-2xl p-6 lg:col-span-2 flex flex-col w-full h-full relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 pb-5 mb-1 shrink-0">
            <h3 className="text-lg font-bold tracking-tight text-gray-900">Recent Activity</h3>
            <span className="text-sm font-semibold text-blue-600 hover:text-blue-700 cursor-pointer transition-colors flex items-center gap-1">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
          
          <div className="space-y-1 pt-2 flex-grow overflow-y-auto custom-scrollbar w-full relative z-10 w-full">
            {[
              { title: "Mid-Term Exam Results Published", time: "2 hours ago", desc: "Results for Grade 10 Science are now available for students and parents.", iconColor: "text-blue-600", bg: "bg-blue-50" },
              { title: "Fee Payment Deadline Reminder", time: "5 hours ago", desc: "Sent an automated reminder to 45 parents regarding outstanding Q2 fees.", iconColor: "text-amber-600", bg: "bg-amber-50" },
              { title: "New Teacher Onboarded", time: "Yesterday", desc: "Mr. Davis was added to the Mathematics department by Super Admin.", iconColor: "text-green-600", bg: "bg-green-50" },
              { title: "School Holiday Announcement for Friday", time: "Yesterday", desc: "Declared a school holiday for the upcoming regional festival.", iconColor: "text-purple-600", bg: "bg-purple-50" },
            ].map((activity, i) => (
               <div key={i} className="flex gap-4 items-start p-3 w-full hover:bg-gray-50 rounded-xl transition-all cursor-pointer group">
                 <div className={`w-11 h-11 rounded-full ${activity.bg} flex items-center justify-center flex-shrink-0 group-hover:bg-white group-hover:shadow-sm transition-all border border-transparent group-hover:border-gray-200`}>
                    <Megaphone className={`w-5 h-5 ${activity.iconColor} transition-colors`} />
                 </div>
                 <div className="flex-1 w-full min-w-0 pr-4">
                   <div className="flex items-center justify-between w-full h-full">
                     <h4 className="font-bold text-gray-900 tracking-tight leading-snug w-full truncate pr-4">{activity.title}</h4>
                     <p className="text-xs font-bold text-gray-400 uppercase tracking-widest shrink-0">{activity.time}</p>
                   </div>
                   <p className="text-sm text-gray-500 font-medium mt-1 truncate max-w-lg">{activity.desc}</p>
                 </div>
               </div>
            ))}
          </div>
        </div>

        {/* Pending Actions */}
        <div className="bg-white border text-gray-900 border-gray-200 shadow-sm shadow-gray-200/50 rounded-2xl p-6 w-full flex flex-col h-full overflow-hidden">
           <div className="flex flex-col border-b border-gray-100 pb-5 mb-1 w-full shrink-0">
             <div className="flex items-center justify-between">
               <h3 className="text-lg font-bold tracking-tight text-gray-900">Pending Approvals</h3>
               <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full inline-block shrink-0 shadow-sm">3 new</span>
             </div>
           </div>
             
           <div className="space-y-4 pt-3 w-full flex-grow overflow-y-auto custom-scrollbar">
               
               <div className="flex items-stretch justify-between bg-yellow-50 border border-yellow-200 p-4 rounded-xl w-full shadow-sm hover:shadow transition-shadow group">
                 <div className="flex flex-col gap-1 w-[70%] min-w-0 pr-2 overflow-hidden justify-center text-left">
                   <span className="font-bold text-yellow-900 text-sm tracking-tight leading-snug truncate shadow-transparent drop-shadow-sm">Field Trip Permission</span>
                   <span className="text-xs font-semibold text-yellow-700 truncate w-full flex-wrap">Grade 8 • Submitted by Mr. Smith</span>
                 </div>
                 <button className="bg-white text-yellow-900 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-yellow-100 focus:bg-yellow-200 border border-yellow-200 hover:border-yellow-300 transition-colors shrink-0 shadow-sm ring-yellow-400 outline-none h-fit self-center">Review</button>
               </div>
               
               <div className="flex items-stretch justify-between bg-purple-50 border border-purple-200 p-4 rounded-xl w-full shadow-sm hover:shadow transition-shadow group">
                 <div className="flex flex-col gap-1 w-[70%] min-w-0 pr-2 overflow-hidden justify-center text-left">
                   <span className="font-bold text-purple-900 text-sm tracking-tight leading-snug truncate shadow-transparent drop-shadow-sm">Result Modification</span>
                   <span className="text-xs font-semibold text-purple-700 truncate w-full flex-wrap">Math Final • Submitted by Ms. Davis</span>
                 </div>
                 <button className="bg-white text-purple-900 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-purple-100 focus:bg-purple-200 border border-purple-200 hover:border-purple-300 transition-colors shrink-0 shadow-sm outline-none h-fit self-center">Review</button>
               </div>
               
               <div className="flex items-stretch justify-between bg-red-50 border border-red-200 p-4 rounded-xl w-full shadow-sm hover:shadow transition-shadow group">
                 <div className="flex flex-col gap-1 w-[70%] min-w-0 pr-2 overflow-hidden justify-center text-left">
                   <span className="font-bold text-red-900 text-sm tracking-tight leading-snug truncate shadow-transparent drop-shadow-sm">Staff Leave Request</span>
                   <span className="text-xs font-semibold text-red-700 truncate w-full flex-wrap">Miss Johnson • Sick Leave Request</span>
                 </div>
                 <button className="bg-white text-red-900 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-red-100 focus:bg-red-200 border border-red-200 hover:border-red-300 transition-colors shrink-0 shadow-sm outline-none h-fit self-center">Review</button>
               </div>

           </div>
           
           <button className="w-full mt-4 p-3 border border-dashed border-gray-300 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors shrink-0">
             Load More Approvals
           </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, bg }: { label: string; value: string; icon: any; color: string; bg: string }) {
  return (
    <div className="bg-white border text-left border-gray-200 rounded-2xl shadow-sm shadow-gray-200/50 p-6 flex flex-col gap-5 w-full group cursor-pointer hover:shadow-lg hover:shadow-gray-200 transition-all hover:-translate-y-1 overflow-hidden relative isolate">
      <div className="flex items-center justify-between w-full h-full relative z-10 shrink-0">
        <div className={`p-3 rounded-xl border ${bg} ${color} group-hover:scale-105 transition-transform duration-300 shadow-sm`}>
          <Icon className="w-6 h-6 stroke-[2.5]" />
        </div>
        <span className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-gray-900 group-hover:text-white transition-colors duration-300 border border-gray-100 group-hover:border-gray-900">
          <ArrowRight className="w-4 h-4" />
        </span>
      </div>
      <div className="relative z-10 flex flex-col justify-end w-full h-full pb-1 pt-2 shrink-0">
        <p className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 drop-shadow-sm">{value}</p>
        <p className="text-sm font-bold tracking-widest uppercase text-gray-500 mt-2 w-full truncate">{label}</p>
      </div>
    </div>
  );
}
