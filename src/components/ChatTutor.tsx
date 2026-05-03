
import {useState, useRef, useEffect} from 'react';
import {Send, Mic, Volume2, Globe, Languages, Sparkles} from 'lucide-react';
import {motion, AnimatePresence} from 'motion/react';
import {GoogleGenAI, Modality, ThinkingLevel} from '@google/genai';

// Initialize Gemini with v1alpha for the latest Gemini 3.1 features including thinking and live audio
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  apiVersion: 'v1beta'
});

export default function ChatTutor() {
  const [messages, setMessages] = useState<{role: string, message: string}[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'thinking' | 'speaking'>('idle');
  const [language, setLanguage] = useState('Spanish');
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioContext = useRef<AudioContext | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = language === 'Spanish' ? 'es-ES' : 
                                   language === 'French' ? 'fr-FR' : 
                                   language === 'German' ? 'de-DE' : 
                                   language === 'Japanese' ? 'ja-JP' : 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, [language]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setIsListening(true);
      recognitionRef.current?.start();
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || status !== 'idle') return;
    const userMsg = input;
    setInput('');
    setStatus('thinking');
    
    setMessages(prev => [...prev, {role: 'user', message: userMsg}]);

    try {
      // Use Gemini 3.1 Pro for high-intelligence tutoring and thinking process
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview", 
        contents: [
          { 
            role: 'user', 
            parts: [{ text: `You are a friendly and expert language tutor specializing in ${language}. 
            Your goal is to help the user practice through natural conversation.
            If the user makes a mistake in ${language}, gently correct them and explain why in a few words.
            Keep responses concise (1-2 sentences).
            Conversation history: ${JSON.stringify(messages.slice(-4))}
            User message: ${userMsg}` }] 
          }
        ],
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.MEDIUM
          }
        }
      });

      const reply = response.text || "Lo siento, I couldn't understand that.";
      setMessages(prev => [...prev, {role: 'assistant', message: reply}]);
      
      // Perform TTS as a separate step for stability since pro might not support direct audio output modality
      await playAudio(reply);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {role: 'assistant', message: "Lo siento, I had trouble connecting."}]);
      setStatus('idle');
    }
  };

  const playAudio = async (text: string) => {
    try {
      setStatus('speaking');
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        handleAudioPlayback(base64Audio);
      } else {
        setStatus('idle');
      }
    } catch (err) {
      console.error("TTS failed", err);
      setStatus('idle');
    }
  };

  const handleAudioPlayback = async (base64Audio: string) => {
    try {
      setStatus('speaking');
      if (!audioContext.current) {
        audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      } else if (audioContext.current.state === 'suspended') {
        await audioContext.current.resume();
      }

      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Int16Array(len / 2);
      for (let i = 0; i < len; i += 2) {
        bytes[i / 2] = (binaryString.charCodeAt(i) | (binaryString.charCodeAt(i + 1) << 8));
      }

      const float32Data = new Float32Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) {
        float32Data[i] = bytes[i] / 32768.0;
      }

      const buffer = audioContext.current.createBuffer(1, float32Data.length, 24000);
      buffer.getChannelData(0).set(float32Data);

      const source = audioContext.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.current.destination);
      source.onended = () => setStatus('idle');
      source.start();
    } catch (err) {
      console.error("Audio playback error", err);
      setStatus('idle');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 relative">
        <header className="flex items-center justify-between mb-8 border-b border-neutral-200 pb-6">
          <div className="flex items-center gap-3">
            <div className="bg-orange-500 p-2.5 rounded-xl shadow-lg shadow-orange-200">
              <Languages className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Chat Tutor</h1>
              <p className="text-neutral-500 text-sm font-medium">Practice {language} with Text & TTS</p>
            </div>
          </div>
        </header>

        <main className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-6">
          <div className="flex flex-col h-[600px] bg-white rounded-2xl shadow-xl border border-neutral-100 overflow-hidden">
            <div className="flex-grow overflow-y-auto p-6 space-y-6">
              <AnimatePresence initial={false}>
                {messages.length === 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center h-full text-center space-y-4"
                  >
                    <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center">
                      <Sparkles className="text-neutral-300" size={32} />
                    </div>
                    <div>
                      <h2 className="font-semibold text-neutral-800">Ready to start?</h2>
                      <p className="text-sm text-neutral-500 max-w-xs mx-auto">
                        Say "Hola" or ask a question to begin.
                      </p>
                    </div>
                  </motion.div>
                )}
                {messages.map((m, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, x: m.role === 'user' ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`
                      max-w-[85%] px-4 py-3 rounded-2xl shadow-sm
                      ${m.role === 'user' 
                        ? 'bg-neutral-900 text-white rounded-tr-none' 
                        : 'bg-neutral-50 border border-neutral-100 text-neutral-800 rounded-tl-none'}
                    `}>
                      <div className="text-sm leading-relaxed">{m.message}</div>
                      {m.role === 'assistant' && (
                        <button 
                          onClick={() => playAudio(m.message)}
                          className="mt-2 p-1.5 hover:bg-neutral-200 rounded-lg transition-colors group"
                        >
                          <Volume2 size={14} className="text-neutral-400 group-hover:text-neutral-600" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
                {status === 'thinking' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                    <div className="bg-neutral-50 border border-neutral-100 px-4 py-3 rounded-2xl rounded-tl-none">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-neutral-300 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <div className="w-1.5 h-1.5 bg-neutral-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <div className="w-1.5 h-1.5 bg-neutral-300 rounded-full animate-bounce" />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-neutral-50 border-t border-neutral-100">
              <div className="relative flex items-center bg-white border border-neutral-200 rounded-xl shadow-inner-sm focus-within:ring-2 focus-within:ring-orange-500/20 focus-within:border-orange-500 transition-all">
                <input 
                  value={input} 
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  placeholder={`Type in ${language}...`}
                  className="flex-grow px-4 py-3 bg-transparent outline-none text-sm"
                />
                <div className="flex items-center gap-1 pr-2">
                  <button 
                    onClick={toggleListening}
                    className={`p-2 rounded-lg transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-neutral-400 hover:bg-neutral-100'}`}
                  >
                    <Mic size={18} />
                  </button>
                  <button 
                    onClick={sendMessage}
                    disabled={!input.trim() || status !== 'idle'}
                    className="p-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg transition-all shadow-md active:scale-95"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="bg-white p-5 rounded-2xl shadow-lg border border-neutral-100 space-y-4">
              <h3 className="font-bold text-sm tracking-tight uppercase text-neutral-400">Settings</h3>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-600 flex items-center gap-2">
                  <Globe size={14} /> Learning Language
                </label>
                <select 
                  value={language}
                  onChange={e => setLanguage(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 p-2 rounded-xl text-sm outline-none focus:border-orange-500 transition-colors"
                >
                  <option value="Spanish">Spanish</option>
                  <option value="French">French</option>
                  <option value="German">German</option>
                  <option value="Japanese">Japanese</option>
                </select>
              </div>
            </div>

            <div className="bg-neutral-900 text-white p-5 rounded-2xl shadow-xl space-y-4 overflow-hidden relative">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-500/20 rounded-full blur-2xl" />
              <h3 className="font-bold text-sm tracking-tight uppercase text-neutral-500 z-10 relative">Status</h3>
              <div className="flex items-center gap-3 z-10 relative">
                <div className={`p-2 rounded-lg ${status === 'speaking' ? 'bg-orange-500 text-white animate-pulse' : 'bg-white/10 text-white/50'}`}>
                  <Volume2 size={20} />
                </div>
                <div className="text-sm">
                  {status === 'speaking' ? 'AI is speaking...' : 'Ready to listen'}
                </div>
              </div>
            </div>
          </aside>
        </main>
      </div>
  );
}
