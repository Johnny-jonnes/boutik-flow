/**
 * BoutikFlow V2 — Audio & Haptic Feedback Manager
 * Génération sonore à la volée via Web Audio API (sans téléchargement, 100% offline, 0ms latence)
 * Support du retour tactile natif via HTML5 navigator.vibrate
 */

export type VolumeLevel = 'muted' | 'discret' | 'normal';

let audioCtx: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
};

// Lecture de la préférence utilisateur stockée
export const getSoundVolumePreference = (): VolumeLevel => {
  if (typeof window === 'undefined') return 'normal';
  const val = localStorage.getItem('boutikflow_sound_volume');
  return (val as VolumeLevel) || 'normal';
};

// Écriture de la préférence utilisateur
export const setSoundVolumePreference = (pref: VolumeLevel) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('boutikflow_sound_volume', pref);
};

// Traduction du niveau de volume en gain décimal
const getVolumeGainValue = (pref: VolumeLevel): number => {
  switch (pref) {
    case 'muted': return 0;
    case 'discret': return 0.12;
    case 'normal': return 0.50;
    default: return 0.50;
  }
};

/**
 * Synthétise une note sur une onde donnée
 */
function playNote(freq: number, duration: number, type: OscillatorType = 'sine', delay = 0) {
  const ctx = getAudioContext();
  if (!ctx) return;
  
  const pref = getSoundVolumePreference();
  const gainVal = getVolumeGainValue(pref);
  if (gainVal === 0) return;

  // Reprendre le contexte si suspendu (sécurité navigateur)
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);

  gainNode.gain.setValueAtTime(gainVal, ctx.currentTime + delay);
  // Atténuation progressive de la note (exponential decay)
  gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + duration);
}

/**
 * Interface publique du gestionnaire d'effets sonores
 */
export const SoundEffects = {
  // Clic discret moderne (ajout au panier)
  playClick() {
    playNote(950, 0.08, 'sine');
  },

  // Bip professionnel haut (scan de code-barres)
  playScan() {
    playNote(2200, 0.06, 'triangle');
  },

  // Double chime montant joyeux (validation de vente)
  playSuccess() {
    playNote(523.25, 0.20, 'sine', 0); // Do5
    playNote(659.25, 0.25, 'sine', 0.08); // Mi5
  },

  // Double basse grave (erreur)
  playError() {
    playNote(220, 0.22, 'sawtooth', 0); // La3
    playNote(165, 0.25, 'sawtooth', 0.10); // Mi3
  },

  // Tonalité douce montante (notification)
  playNotification() {
    playNote(587.33, 0.15, 'sine', 0); // Ré5
    playNote(880.00, 0.20, 'sine', 0.06); // La5
  },

  // Sweep mécanique chic (impression terminée)
  playPrint() {
    playNote(1200, 0.15, 'triangle', 0);
    playNote(900, 0.18, 'triangle', 0.08);
  }
};

/**
 * API Haptique mobile (discrète et respectueuse du support navigateur)
 */
export const triggerHaptic = (pattern: number | number[]) => {
  if (typeof window === 'undefined') return;
  if (window.navigator && window.navigator.vibrate) {
    try {
      window.navigator.vibrate(pattern);
    } catch {}
  }
};
