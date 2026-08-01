import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Search, MessageSquare, LogOut, ShieldAlert } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import Dashboard from './pages/Dashboard';
import ProviderInvestigation from './pages/ProviderInvestigation';
import Chatbot from './pages/Chatbot';
import Login from './pages/Login';
import Signup from './pages/Signup';

function MainLayout({ children }) {
  const { logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/investigate', label: 'Provider Investigation', icon: Search },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Premium Glassmorphism Sidebar */}
      <aside className="w-64 lg:w-72 bg-gradient-to-b from-indigo-950 to-slate-900 text-white flex flex-col shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>
        <div className="p-6 lg:p-8 border-b border-indigo-800/50 relative z-10 flex items-center">
          <ShieldAlert className="w-8 h-8 text-indigo-400 mr-3 animate-pulse shrink-0" />
          <h1 className="text-lg lg:text-xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-white leading-tight">
            Intelligent Healthcare Fraud Detection & Investigation Platform
          </h1>
        </div>
        <nav className="flex-1 p-4 lg:p-6 space-y-3 relative z-10">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center p-4 rounded-xl transition-all duration-300 group ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-300 shadow-[inset_0_0_15px_rgba(79,70,229,0.2)] border border-indigo-500/30'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <Icon className={`w-5 h-5 mr-4 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                <span className="font-semibold tracking-wide">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 lg:p-6 relative z-10 border-t border-indigo-800/50">
          <button
            onClick={logout}
            className="flex items-center justify-center w-full p-4 rounded-xl text-slate-300 bg-slate-800/50 hover:bg-red-500/20 hover:text-red-400 transition-all duration-300 border border-transparent hover:border-red-500/30 group"
          >
            <LogOut className="w-5 h-5 mr-3 group-hover:-translate-x-1 transition-transform" />
            <span className="font-semibold">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50/50 relative">
        <header className="bg-white/80 backdrop-blur-md shadow-sm h-20 flex items-center px-6 lg:px-10 border-b border-slate-200 z-10">
          <h2 className="text-lg lg:text-xl font-extrabold text-slate-800 tracking-tight">Intelligent Healthcare Fraud Detection & Investigation Platform</h2>
        </header>
        <div className="flex-1 overflow-y-auto p-6 lg:p-10 relative">
          <div className="absolute top-[-100px] right-[-100px] w-96 h-96 bg-indigo-400 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 pointer-events-none"></div>
          <div className="absolute bottom-[-100px] left-[-100px] w-96 h-96 bg-teal-400 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 pointer-events-none"></div>

          <div className="relative z-10 h-full">
            {children}
          </div>
        </div>

        {/* Floating Chatbot button - appears on every page EXCEPT the `/chat` route */}
        {location.pathname !== '/chat' && (
          <Link
            to="/chat"
            className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white rounded-full shadow-lg shadow-indigo-500/30 flex items-center justify-center hover:from-indigo-500 hover:to-indigo-400 hover:scale-110 hover:-translate-y-0.5 transition-all z-50 duration-300"
            title="AI Chatbot Assistant"
          >
            <MessageSquare className="w-6 h-6 animate-pulse" />
          </Link>
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected Application Routes */}
          <Route path="/*" element={
            <ProtectedRoute>
              <MainLayout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/investigate" element={<ProviderInvestigation />} />
                  <Route path="/chat" element={<Chatbot />} />
                </Routes>
              </MainLayout>
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;