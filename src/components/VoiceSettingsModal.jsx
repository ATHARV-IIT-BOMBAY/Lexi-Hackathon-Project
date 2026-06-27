import React, { useState, useEffect } from 'react';
import { X, Play, Save } from 'lucide-react';
import { getAvailableVoices, getVoiceSettings, updateVoiceSettings, speakText } from '../services/audioService';

const VoiceSettingsModal = ({ onClose }) => {
  const [voices, setVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('');
  const [pitch, setPitch] = useState(1.05);
  const [rate, setRate] = useState(0.95);

  useEffect(() => {
    // Small delay to ensure voices are loaded from the browser API
    setTimeout(() => {
      const available = getAvailableVoices();
      setVoices(available);
      
      const settings = getVoiceSettings();
      setPitch(settings.pitch);
      setRate(settings.rate);
      
      if (settings.voiceURI) {
        setSelectedVoiceURI(settings.voiceURI);
      } else if (available.length > 0) {
        // Find default
        const fallback = available.find(v => v.name.includes('Google US English') || v.name.includes('Samantha') || v.name.includes('Female')) || available[0];
        if (fallback) setSelectedVoiceURI(fallback.voiceURI);
      }
    }, 500);
  }, []);

  const handleTest = () => {
    updateVoiceSettings(selectedVoiceURI, pitch, rate);
    speakText("Hi, I'm Lexi! This is how I sound.");
  };

  const handleSave = () => {
    updateVoiceSettings(selectedVoiceURI, pitch, rate);
    onClose();
  };

  const playPreview = (newVoice, newPitch, newRate) => {
    updateVoiceSettings(newVoice, newPitch, newRate);
    speakText("Hi there!");
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000
    }}>
      <div style={{
        background: 'white', borderRadius: '24px', padding: '2rem', width: '90%', maxWidth: '400px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)', position: 'relative'
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: '15px', right: '15px', background: '#f1f5f9',
          border: 'none', borderRadius: '50%', width: '36px', height: '36px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
        }}>
          <X size={20} color="#64748b" />
        </button>

        <h2 style={{ margin: '0 0 1.5rem 0', color: '#1e293b', fontSize: '1.5rem' }}>Voice Settings</h2>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: 'bold' }}>Choose Voice</label>
          <select 
            value={selectedVoiceURI} 
            onChange={(e) => {
              setSelectedVoiceURI(e.target.value);
              playPreview(e.target.value, pitch, rate);
            }}
            style={{
              width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid #cbd5e1',
              fontSize: '1rem', background: '#f8fafc', color: '#1e293b'
            }}
          >
            {voices.map(v => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#475569', fontWeight: 'bold' }}>
            <span>Pitch</span>
            <span>{pitch.toFixed(2)}</span>
          </label>
          <input 
            type="range" min="0.5" max="2.0" step="0.05" 
            value={pitch} 
            onChange={(e) => setPitch(parseFloat(e.target.value))}
            onMouseUp={(e) => playPreview(selectedVoiceURI, parseFloat(e.target.value), rate)}
            onTouchEnd={(e) => playPreview(selectedVoiceURI, parseFloat(e.target.value), rate)}
            style={{ width: '100%', accentColor: '#0ea5e9' }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#475569', fontWeight: 'bold' }}>
            <span>Speed (Rate)</span>
            <span>{rate.toFixed(2)}</span>
          </label>
          <input 
            type="range" min="0.5" max="1.5" step="0.05" 
            value={rate} 
            onChange={(e) => setRate(parseFloat(e.target.value))}
            onMouseUp={(e) => playPreview(selectedVoiceURI, pitch, parseFloat(e.target.value))}
            onTouchEnd={(e) => playPreview(selectedVoiceURI, pitch, parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#0ea5e9' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
          <button onClick={handleTest} style={{
            flex: 1, padding: '0.75rem', borderRadius: '12px', background: '#f1f5f9', color: '#3b82f6',
            border: 'none', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
          }}>
            <Play size={18} /> Test
          </button>
          
          <button onClick={handleSave} style={{
            flex: 1, padding: '0.75rem', borderRadius: '12px', background: '#3b82f6', color: 'white',
            border: 'none', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
          }}>
            <Save size={18} /> Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceSettingsModal;
