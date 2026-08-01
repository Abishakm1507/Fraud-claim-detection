import React from 'react';
import { FileText, AlertTriangle } from 'lucide-react';

const Explainability = () => {
  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in-up pb-10">
      <div className="bg-white/85 backdrop-blur-xl rounded-3xl p-8 shadow-md border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full mix-blend-multiply filter blur-[80px] opacity-10 pointer-events-none"></div>

        {/* Header */}
        <div className="flex items-center mb-8 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center mr-5 shadow-lg shadow-indigo-500/20">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">AI Explainability</h2>
            <p className="text-slate-500 font-medium">Transparent feature analysis and model attribution mapping.</p>
          </div>
        </div>

        {/* Alert/Unavailable Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 flex flex-col items-center justify-center text-center relative z-10 py-16">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-6 shadow-sm border border-amber-100">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-slate-800 mb-2">Module Offline</h3>
          <p className="text-sm font-semibold text-slate-500 max-w-md leading-relaxed">
            Explainability module is temporarily unavailable and will be enabled after backend integration is completed.
          </p>
        </div>

      </div>
    </div>
  );
};

export default Explainability;