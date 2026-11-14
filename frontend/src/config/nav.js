import {
  LayoutDashboard, QrCode, TrendingUp, GraduationCap, Users, CalendarDays, Award, FileText,
  CreditCard, Megaphone, BookOpen, Briefcase, Trophy, ShieldCheck, MessagesSquare, Flag,
} from 'lucide-react';

/**
 * Single source of truth for every module: sidebar, command palette,
 * breadcrumbs and the route permission guard all read from here.
 */
export const NAV = [
  {
    group: 'Overview',
    items: [
      { id: 'dashboard', swatch: 'var(--signal)', label: 'Dashboard', title: 'Dashboard', icon: LayoutDashboard, module: null, keywords: 'home overview summary' },
    ],
  },
  {
    group: 'Flagship',
    items: [
      { id: 'attendance', swatch: 'var(--teal)', label: 'Smart Attendance', title: 'Smart Attendance', icon: QrCode, module: 'attendance', tag: 'CORE', keywords: 'qr check-in roll call present absent detention' },
      { id: 'cgpa-simulator', swatch: 'var(--cobalt)', label: 'CGPA Probability', title: 'CGPA Probability', icon: TrendingUp, module: 'cgpa_probability', tag: 'CORE', keywords: 'predict sgpa what-if simulator grade risk' },
    ],
  },
  {
    group: 'Academics',
    items: [
      { id: 'students', swatch: 'var(--ochre)', label: 'Students', title: 'Student Directory', icon: GraduationCap, module: 'students', keywords: 'dossier profile roll enrollment section' },
      { id: 'faculty', swatch: 'var(--plum)', label: 'Faculty', title: 'Faculty Directory', icon: Users, module: 'faculty', keywords: 'professor teacher workload employee' },
      { id: 'academics', swatch: 'var(--sky)', label: 'Courses & Timetable', title: 'Courses & Timetable', icon: CalendarDays, module: 'academics', keywords: 'subjects schedule timetable lecture lab' },
      { id: 'exams', swatch: 'var(--signal)', label: 'Exams & Results', title: 'Exams & Results', icon: Award, module: 'exams', keywords: 'marksheet marks grade report card result' },
      { id: 'assignments', swatch: 'var(--teal)', label: 'Assignments', title: 'Assignments & Notes', icon: FileText, module: 'assignments', keywords: 'homework submission notes study material' },
    ],
  },
  {
    group: 'Campus',
    items: [
      { id: 'societies', swatch: 'var(--plum)', label: 'Societies', title: 'Societies & Duty Leave', icon: Flag, module: 'societies', keywords: 'clubs gdsc membership duty attendance' },
      { id: 'forum', swatch: 'var(--cobalt)', label: 'Forum', title: 'Campus Forum', icon: MessagesSquare, module: 'forum', keywords: 'doubts questions discussion threads' },
      { id: 'library-hostel', swatch: 'var(--ochre)', label: 'Library & Hostel', title: 'Library & Hostel', icon: BookOpen, module: 'library', keywords: 'books issue return room hostel' },
      { id: 'placements', swatch: 'var(--teal)', label: 'Placements', title: 'Placements', icon: Briefcase, module: 'placements', keywords: 'jobs internships drives tnp company' },
      { id: 'engagement', swatch: 'var(--signal)', label: 'Merit & Guide', title: 'Merit & AI Guide', icon: Trophy, module: 'engagement', keywords: 'leaderboard xp rank study plan career' },
    ],
  },
  {
    group: 'Administration',
    items: [
      { id: 'fees', swatch: 'var(--ochre)', label: 'Fees', title: 'Fees & Payments', icon: CreditCard, module: 'fees', keywords: 'payment receipt dues tuition' },
      { id: 'notices', swatch: 'var(--sky)', label: 'Notices', title: 'Notice Board', icon: Megaphone, module: 'notices', keywords: 'circular bulletin announcement' },
      { id: 'settings', swatch: 'var(--plum)', label: 'Governance', title: 'Governance & Audit', icon: ShieldCheck, module: 'settings', keywords: 'settings policy audit logs threshold' },
    ],
  },
];

/** The five modules each role reaches most — pinned to the floating dock */
export const DOCK = {
  student: ['dashboard', 'attendance', 'cgpa-simulator', 'exams', 'assignments'],
  faculty: ['dashboard', 'attendance', 'students', 'assignments', 'exams'],
  admin: ['dashboard', 'attendance', 'cgpa-simulator', 'students', 'fees'],
  parent: ['dashboard', 'attendance', 'exams', 'fees', 'notices'],
};

export const NAV_ITEMS = NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.group })));
export const NAV_BY_ID = Object.fromEntries(NAV_ITEMS.map((i) => [i.id, i]));
