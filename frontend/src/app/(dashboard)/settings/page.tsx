'use client';

import { useEffect, useState } from 'react';
import { Store, User, KeyRound, Eye, EyeOff, Save } from 'lucide-react';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';

interface Me {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: string;
}

interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

export default function SettingsPage() {
  const { language } = useLanguage();
  const fr = language === 'fr';

  const [isLoading, setIsLoading] = useState(true);
  const [me, setMe] = useState<Me | null>(null);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);

  // Boutique (owner uniquement)
  const [shopName, setShopName] = useState('');
  const [isSavingShop, setIsSavingShop] = useState(false);

  // Profil personnel
  const [profileForm, setProfileForm] = useState({ full_name: '', email: '', phone: '' });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Mot de passe
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [meRes, tenantRes] = await Promise.all([api.getMe(), api.getTenant()]);
        setMe(meRes);
        setTenant(tenantRes);
        setProfileForm({
          full_name: meRes.full_name || '',
          email: meRes.email || '',
          phone: meRes.phone || '',
        });
        setShopName(tenantRes.name || '');
      } catch {
        toast.error(fr ? 'Erreur lors du chargement des informations' : 'Error loading information');
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isOwner = me?.role?.toLowerCase() === 'owner';

  const handleSaveShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingShop) return;
    if (!shopName.trim()) {
      toast.error(fr ? 'Le nom de la boutique est requis' : 'Shop name is required');
      return;
    }
    setIsSavingShop(true);
    try {
      const updated = await api.updateTenant({ name: shopName.trim() });
      setTenant(updated);
      toast.success(fr ? 'Boutique mise à jour' : 'Shop updated');
    } catch (err: any) {
      toast.error(err.message || (fr ? 'Erreur lors de la mise à jour' : 'Error updating'));
    } finally {
      setIsSavingShop(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingProfile) return;
    if (!profileForm.full_name.trim() || !profileForm.email.trim()) {
      toast.error(fr ? 'Nom et email sont requis' : 'Name and email are required');
      return;
    }
    setIsSavingProfile(true);
    try {
      const updated = await api.updateMe({
        full_name: profileForm.full_name.trim(),
        email: profileForm.email.trim(),
        phone: profileForm.phone.trim() || undefined,
      });
      setMe(updated);
      toast.success(fr ? 'Profil mis à jour' : 'Profile updated');
    } catch (err: any) {
      toast.error(err.message || (fr ? 'Erreur lors de la mise à jour' : 'Error updating'));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingPassword) return;
    if (pwForm.new_password.length < 8) {
      toast.error(fr ? 'Le nouveau mot de passe doit contenir au moins 8 caractères' : 'New password must be at least 8 characters');
      return;
    }
    if (pwForm.new_password !== pwForm.confirm) {
      toast.error(fr ? 'Les mots de passe ne correspondent pas' : 'Passwords do not match');
      return;
    }
    setIsSavingPassword(true);
    try {
      await api.changeMyPassword({
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      });
      toast.success(fr ? 'Mot de passe modifié' : 'Password changed');
      setPwForm({ current_password: '', new_password: '', confirm: '' });
    } catch (err: any) {
      toast.error(err.message || (fr ? 'Erreur lors du changement de mot de passe' : 'Error changing password'));
    } finally {
      setIsSavingPassword(false);
    }
  };

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner" /></div>;
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{fr ? 'Paramètres' : 'Settings'}</h1>
          <p className="page-subtitle">{fr ? 'Gérez votre boutique et votre compte' : 'Manage your shop and your account'}</p>
        </div>
      </div>

      {isOwner && (
        <div className="card settings-card">
          <div className="settings-card-head">
            <Store size={18} />
            <h2>{fr ? 'Boutique' : 'Shop'}</h2>
          </div>
          <form onSubmit={handleSaveShop} className="settings-form">
            <div className="input-group">
              <label className="form-label">{fr ? 'Nom de la boutique' : 'Shop name'}</label>
              <input className="input" value={shopName} onChange={e => setShopName(e.target.value)} required minLength={2} />
            </div>
            <div className="input-group">
              <label className="form-label">{fr ? 'Identifiant (lien)' : 'ID (link)'}</label>
              <input className="input" value={`boutikflow.app/${tenant?.slug || ''}`} disabled />
            </div>
            <button type="submit" className="btn btn-primary" disabled={isSavingShop}>
              <Save size={16} /> {isSavingShop ? (fr ? 'Enregistrement…' : 'Saving…') : (fr ? 'Enregistrer' : 'Save')}
            </button>
          </form>
        </div>
      )}

      <div className="card settings-card">
        <div className="settings-card-head">
          <User size={18} />
          <h2>{fr ? 'Mon profil' : 'My profile'}</h2>
        </div>
        <form onSubmit={handleSaveProfile} className="settings-form">
          <div className="input-group">
            <label className="form-label">{fr ? 'Nom complet' : 'Full name'}</label>
            <input className="input" value={profileForm.full_name} onChange={e => setProfileForm(f => ({ ...f, full_name: e.target.value }))} required minLength={2} />
          </div>
          <div className="input-group">
            <label className="form-label">Email</label>
            <input className="input" type="email" value={profileForm.email} onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          <div className="input-group">
            <label className="form-label">{fr ? 'Téléphone' : 'Phone'}</label>
            <input className="input" value={profileForm.phone} onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} placeholder="+224 ..." />
          </div>
          <button type="submit" className="btn btn-primary" disabled={isSavingProfile}>
            <Save size={16} /> {isSavingProfile ? (fr ? 'Enregistrement…' : 'Saving…') : (fr ? 'Enregistrer' : 'Save')}
          </button>
        </form>
      </div>

      <div className="card settings-card">
        <div className="settings-card-head">
          <KeyRound size={18} />
          <h2>{fr ? 'Mot de passe' : 'Password'}</h2>
        </div>
        <form onSubmit={handleSavePassword} className="settings-form">
          <div className="input-group">
            <label className="form-label">{fr ? 'Mot de passe actuel' : 'Current password'}</label>
            <div className="pw-field">
              <input
                className="input" type={showCurrentPw ? 'text' : 'password'}
                value={pwForm.current_password}
                onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))}
                required
              />
              <button type="button" className="pw-toggle" onClick={() => setShowCurrentPw(v => !v)}>
                {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="input-group">
            <label className="form-label">{fr ? 'Nouveau mot de passe' : 'New password'}</label>
            <div className="pw-field">
              <input
                className="input" type={showNewPw ? 'text' : 'password'}
                value={pwForm.new_password}
                onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))}
                required minLength={8}
              />
              <button type="button" className="pw-toggle" onClick={() => setShowNewPw(v => !v)}>
                {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="input-group">
            <label className="form-label">{fr ? 'Confirmer le nouveau mot de passe' : 'Confirm new password'}</label>
            <input
              className="input" type={showNewPw ? 'text' : 'password'}
              value={pwForm.confirm}
              onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
              required minLength={8}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={isSavingPassword}>
            <KeyRound size={16} /> {isSavingPassword ? (fr ? 'Modification…' : 'Changing…') : (fr ? 'Changer le mot de passe' : 'Change password')}
          </button>
        </form>
      </div>

      <style jsx>{`
        .settings-page { display: flex; flex-direction: column; gap: 1.25rem; max-width: 560px; }
        .page-header { margin-bottom: 0.25rem; }
        .page-title { font-size: 1.75rem; margin-bottom: 0.25rem; }
        .page-subtitle { color: var(--text-muted); font-size: 0.9rem; }
        .settings-card { padding: 1.5rem; }
        .settings-card-head {
          display: flex; align-items: center; gap: 0.6rem;
          margin-bottom: 1.25rem; color: var(--text-primary);
        }
        .settings-card-head h2 { font-size: 1.05rem; font-weight: 700; margin: 0; }
        .settings-form { display: flex; flex-direction: column; gap: 1rem; }
        .settings-form .btn { align-self: flex-start; display: flex; align-items: center; gap: 0.5rem; }
        .pw-field { position: relative; display: flex; align-items: center; }
        .pw-toggle {
          position: absolute; right: 0.6rem; background: none; border: none;
          color: var(--text-muted); cursor: pointer; display: flex;
          align-items: center; justify-content: center; padding: 0.3rem;
        }

        @media (max-width: 640px) {
          .settings-page { max-width: 100%; }
          .settings-card { padding: 1.1rem; }
          .settings-form .btn { align-self: stretch; justify-content: center; }
        }
      `}</style>
    </div>
  );
}
