/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import ChatTutor from './components/ChatTutor';
import VoiceTutor from './components/VoiceTutor';
import { MessageSquare, Mic } from 'lucide-react';

function Navigation() {
  const location = useLocation();
  const isVoice = location.pathname === '/voice';

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-md border border-neutral-200 px-2 py-2 rounded-2xl shadow-2xl z-50 flex gap-1">
      <Link 
        to="/" 
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${!isVoice ? 'bg-neutral-900 text-white shadow-lg' : 'text-neutral-500 hover:bg-neutral-100'}`}
      >
        <MessageSquare size={18} /> Chat
      </Link>
      <Link 
        to="/voice" 
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${isVoice ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-neutral-500 hover:bg-neutral-100'}`}
      >
        <Mic size={18} /> Voice
      </Link>
    </nav>
  );
}

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-[#FDFCFB] text-neutral-900 font-sans selection:bg-orange-100 pb-24">
        {/* Background Decor */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-orange-200 rounded-full blur-3xl" />
          <div className="absolute top-1/2 -right-24 w-64 h-64 bg-blue-200 rounded-full blur-3xl" />
        </div>

        <Routes>
          <Route path="/" element={<ChatTutor />} />
          <Route path="/voice" element={<VoiceTutor />} />
        </Routes>

        <Navigation />
        
        <footer className="text-center pb-8">
          <p className="text-xs text-neutral-400 font-medium tracking-widest uppercase">Powered by Gemini 3.1 Flash</p>
        </footer>
      </div>
    </Router>
  );
}

