
import {useState, useRef, useEffect} from 'react';
import {Mic, Square, Volume2, Globe, Sparkles, Languages, Radio} from 'lucide-react';
import {motion, AnimatePresence} from 'motion/react';
import {GoogleGenAI, Modality, ThinkingLevel} from '@google/genai';

// Initialize Gemini with v1alpha for the latest Gemini 3.1 features including thinking and live audio
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  apiVersion: 'v1beta'
});

export default function VoiceTutor() {
  const [status, setStatus] = useState<'idle' | 'recording' | 'processing' | 'speaking'>('idle');
  const [language, setLanguage] = useState('Spanish');
  const [aiText, setAiText] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContext = useRef<AudioContext | null>(null);

  const startRecording = async () => {
    setAiText('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        processAudio(audioBlob);
        // Stop stream
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setStatus('recording');
    } catch (err) {
      console.error("Mic access denied", err);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  const processAudio = async (blob: Blob) => {
    setStatus('processing');
    try {
      // Convert Blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        
        // Use Gemini 3.1 Pro for reasoning
        const result = await ai.models.generateContent({
          model: "gemini-3.1-pro-preview",
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: 'audio/webm',
                    data: base64Data
                  }
                },
                {
                  text: `You are a friendly language tutor in ${language}. 
                  Listen to my audio and reply in ${language}. 
                  If I made a mistake, explain it briefly. 
                  Keep your reply very short and conversational (1-2 sentences max).`
                }
              ]
            }
          ],
          config: {
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.MEDIUM
            }
          }
        });

        const replyText = result.text || "";
        setAiText(replyText);
        
        if (replyText) {
          const ttsResult = await ai.models.generateContent({
            model: "gemini-3.1-flash-tts-preview",
            contents: [{ parts: [{ text: replyText }] }],
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Puck' }
                }
              }
            }
          });

          const replyAudio = ttsResult.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
          if (replyAudio) {
            playAudio(replyAudio);
          } else {
            setStatus('idle');
          }
        } else {
          setStatus('idle');
        }
      };
    } catch (err) {
      console.error("Processing error", err);
      setStatus('idle');
    }
  };

  const playAudio = async (base64Audio: string) => {
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
      console.error("Playback error", err);
      setStatus('idle');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 relative">
      <header className="flex items-center justify-between mb-12 border-b border-neutral-200 pb-6">
        <div className="flex items-center gap-3">
          <div className="bg-blue-500 p-2.5 rounded-xl shadow-lg shadow-blue-200">
            <Radio className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Voice Tutor</h1>
            <p className="text-neutral-500 text-sm font-medium">Real-time Multimodal Learning</p>
          </div>
        </div>
      </header>

      <div className="flex flex-col items-center justify-center space-y-12 py-10">
        {/* Visualizer / Status Orb */}
        <div className="relative">
          <motion.div 
            animate={{
              scale: status === 'recording' ? [1, 1.2, 1] : 1,
              opacity: status === 'processing' ? [0.5, 1, 0.5] : 1,
            }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className={`w-48 h-48 rounded-full flex items-center justify-center shadow-2xl transition-colors duration-500 ${
              status === 'recording' ? 'bg-red-500 shadow-red-200' :
              status === 'processing' ? 'bg-orange-500 shadow-orange-200' :
              status === 'speaking' ? 'bg-blue-500 shadow-blue-200' :
              'bg-neutral-900 shadow-neutral-200'
            }`}
          >
            {status === 'idle' && <Mic className="text-white" size={48} />}
            {status === 'recording' && <Square className="text-white" size={48} />}
            {status === 'processing' && <Sparkles className="text-white animate-spin" size={48} />}
            {status === 'speaking' && <Volume2 className="text-white animate-pulse" size={48} />}
          </motion.div>
          
          {/* Waves */}
          {status === 'recording' && (
             <div className="absolute inset-0 flex items-center justify-center -z-10">
                <div className="w-full h-full bg-red-100 rounded-full animate-ping opacity-20" />
             </div>
          )}
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-neutral-800">
            {status === 'idle' && 'Tap the mic to speak'}
            {status === 'recording' && 'Listening to you...'}
            {status === 'processing' && 'AI is thinking...'}
            {status === 'speaking' && 'AI is responding...'}
          </h2>
          <p className="text-neutral-500 text-sm max-w-sm mx-auto">
            Experience near-instant conversation with Gemini 3.1 Flash.
          </p>
        </div>

        <div className="flex gap-4">
          {status === 'idle' ? (
            <button 
              onClick={startRecording}
              className="px-8 py-4 bg-neutral-900 text-white rounded-2xl font-bold shadow-xl hover:bg-neutral-800 active:scale-95 transition-all flex items-center gap-3"
            >
              <Mic size={20} /> Start Speaking
            </button>
          ) : status === 'recording' ? (
            <button 
              onClick={stopRecording}
              className="px-8 py-4 bg-red-600 text-white rounded-2xl font-bold shadow-xl hover:bg-red-700 active:scale-95 transition-all flex items-center gap-3"
            >
              <Square size={20} /> Stop & Send
            </button>
          ) : (
            <button disabled className="px-8 py-4 bg-neutral-200 text-neutral-400 rounded-2xl font-bold transition-all cursor-not-allowed">
              Waiting for AI...
            </button>
          )}
        </div>

        {/* AI Text Output Display */}
        <AnimatePresence>
          {aiText && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md w-full bg-white p-6 rounded-2xl shadow-lg border border-neutral-100 mt-8"
            >
              <p className="text-sm font-medium text-neutral-400 uppercase tracking-widest mb-2">AI Transcript</p>
              <p className="text-neutral-800 leading-relaxed italic">"{aiText}"</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <aside className="mt-12 flex justify-center">
        <div className="bg-white px-6 py-4 rounded-2xl shadow-lg border border-neutral-100 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-neutral-400" />
            <select 
              value={language}
              onChange={e => setLanguage(e.target.value)}
              className="bg-transparent text-sm font-semibold outline-none text-neutral-700"
            >
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
              <option value="German">German</option>
              <option value="Japanese">Japanese</option>
            </select>
          </div>
          <div className="h-4 w-[1px] bg-neutral-200" />
          <div className="flex items-center gap-2">
            <Languages size={16} className="text-neutral-400" />
            <span className="text-sm font-semibold text-neutral-700">Gemini 3.1 Flash</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
