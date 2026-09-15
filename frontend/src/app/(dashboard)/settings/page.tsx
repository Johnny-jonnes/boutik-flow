'use client';

import { useEffect, useState } from 'react';
import { Store, User, KeyRound, Eye, EyeOff, Save, Landmark, Copy, ExternalLink, Download, Printer } from 'lucide-react';
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
  hidden_financial_roles?: string[];
}

const MASKABLE_ROLES = ['manager', 'cashier', 'stock_manager', 'seller_stock_manager', 'staff'] as const;
const ROLE_LABELS_FR: Record<string, string> = {
  manager: 'Gérant', cashier: 'Caissier', stock_manager: 'Gestionnaire de stock',
  seller_stock_manager: 'Vendeur / Gestionnaire de stock', staff: 'Employé',
};
const ROLE_LABELS_EN: Record<string, string> = {
  manager: 'Manager', cashier: 'Cashier', stock_manager: 'Stock Manager',
  seller_stock_manager: 'Seller / Stock Manager', staff: 'Staff',
};

export default function SettingsPage() {
  const { language } = useLanguage();
  const fr = language === 'fr';

  const [isLoading, setIsLoading] = useState(true);
  const [me, setMe] = useState<Me | null>(null);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);

  // Boutique (owner uniquement)
  const [shopName, setShopName] = useState('');
  const [isSavingShop, setIsSavingShop] = useState(false);

  // Masquage des chiffres financiers par rôle (owner uniquement)
  const [hiddenFinancialRoles, setHiddenFinancialRoles] = useState<string[]>([]);
  const [isSavingVisibility, setIsSavingVisibility] = useState(false);

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
        setHiddenFinancialRoles(tenantRes.hidden_financial_roles || []);
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

  // Lien public de la boutique — même domaine que le partage produit
  // (Phase 3, chantier vitrine publique) : le jour d'un domaine personnalisé,
  // seule NEXT_PUBLIC_SITE_URL change, rien ici.
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://boutik-flow.vercel.app';
  const storeUrl = `${SITE_URL}/boutique/${tenant?.slug || ''}`;

  const handleCopyStoreLink = async () => {
    try {
      await navigator.clipboard.writeText(storeUrl);
      toast.success(fr ? 'Lien copié' : 'Link copied');
    } catch {
      toast.error(fr ? 'Impossible de copier le lien' : 'Could not copy link');
    }
  };

  // QR code généré localement (même lib/pattern que le QR SKU produit) :
  // le boutiquier peut l'imprimer/partager sans jamais avoir à taper ou
  // coller ce long lien lui-même.
  const downloadStoreQRCode = async () => {
    try {
      const { default: QRCode } = await import('qrcode');
      const dataUrl = await QRCode.toDataURL(storeUrl, { width: 300, margin: 1 });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `QRCode-Boutique-${tenant?.slug || 'boutique'}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      toast.error(fr ? 'Erreur lors de la génération du QR code' : 'Error generating QR code');
    }
  };

  const printStoreQRCode = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<html><body style="font-family:sans-serif;text-align:center;padding:2rem;">${fr ? 'Génération du QR code…' : 'Generating QR code…'}</body></html>`);

    import('qrcode').then(({ default: QRCode }) => QRCode.toDataURL(storeUrl, { width: 260, margin: 1 })).then((dataUrl) => {
      printWindow.document.open();
      printWindow.document.write(`
        <html>
          <head>
            <title>${fr ? 'Imprimer QR Code' : 'Print QR Code'} - ${tenant?.name || ''}</title>
            <style>
              body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; font-family: sans-serif; text-align: center; }
              h2 { margin-bottom: 5px; }
              p { margin-top: 5px; color: #555; word-break: break-all; max-width: 320px; }
              img { border: 1px solid #eee; padding: 10px; }
              @media print { img { max-width: 100%; } }
            </style>
          </head>
          <body onload="window.print(); window.close();">
            <h2>${tenant?.name || ''}</h2>
            <img src="${dataUrl}" alt="QR code boutique" />
            <p>${storeUrl}</p>
          </body>
        </html>
      `);
      printWindow.document.close();
    }).catch(() => {
      printWindow.close();
      toast.error(fr ? 'Erreur lors de la génération du QR code' : 'Error generating QR code');
    });
  };

  const toggleHiddenRole = (role: string) => {
    setHiddenFinancialRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const handleSaveVisibility = async () => {
    if (isSavingVisibility) return;
    setIsSavingVisibility(true);
    try {
      const updated = await api.updateFinancialVisibility(hiddenFinancialRoles);
      setTenant(updated);
      setHiddenFinancialRoles(updated.hidden_financial_roles || []);
      toast.success(fr ? 'Réglage de confidentialité enregistré' : 'Visibility setting saved');
    } catch (err: any) {
      toast.error(err.message || (fr ? 'Erreur lors de la mise à jour' : 'Error updating'));
    } finally {
      setIsSavingVisibility(false);
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
            <button type="submit" className="btn btn-primary" disabled={isSavingShop}>
              <Save size={16} /> {isSavingShop ? (fr ? 'Enregistrement…' : 'Saving…') : (fr ? 'Enregistrer' : 'Save')}
            </button>
          </form>
        </div>
      )}

      {isOwner && (
        <div className="card settings-card">
          <div className="settings-card-head">
            <Store size={18} />
            <h2>{fr ? 'Ma boutique en ligne' : 'My online shop'}</h2>
          </div>
          <p className="settings-hint">
            {fr
              ? 'Ce lien affiche automatiquement tous vos produits marqués "visibles sur la vitrine publique". Partagez-le une fois : il n\'a jamais besoin d\'être recopié à chaque nouveau produit.'
              : 'This link automatically shows every product you mark "visible on the public shop". Share it once — no need to retype it for every new product.'}
          </p>
          <div className="settings-form">
            <div className="input-group">
              <label className="form-label">{fr ? 'Lien de ma boutique' : 'My shop link'}</label>
              <div className="store-link-row">
                <input className="input" value={storeUrl} disabled />
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleCopyStoreLink}>
                  <Copy size={14} /> {fr ? 'Copier' : 'Copy'}
                </button>
              </div>
              <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="store-link-preview">
                <ExternalLink size={13} /> {fr ? 'Voir ma boutique' : 'View my shop'}
              </a>
            </div>
            <div className="store-qr-actions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={downloadStoreQRCode}>
                <Download size={14} /> {fr ? 'Télécharger le QR code' : 'Download QR code'}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={printStoreQRCode}>
                <Printer size={14} /> {fr ? 'Imprimer le QR code' : 'Print QR code'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isOwner && (
        <div className="card settings-card">
          <div className="settings-card-head">
            <Landmark size={18} />
            <h2>{fr ? 'Confidentialité financière' : 'Financial privacy'}</h2>
          </div>
          <p className="settings-hint">
            {fr
              ? 'Choisissez les rôles qui ne doivent voir ni la marge, ni le prix d\'achat, ni le chiffre d\'affaires, ni le module Finance. Masquage appliqué côté serveur : ces chiffres ne sont jamais envoyés au navigateur pour ces rôles.'
              : 'Choose which roles should never see margin, purchase price, revenue, or the Finance module. Enforced server-side: these figures are never sent to the browser for these roles.'}
          </p>
          <div className="settings-form">
            <div className="role-visibility-list">
              {MASKABLE_ROLES.map(role => (
                <label key={role} className="role-visibility-item">
                  <input
                    type="checkbox"
                    checked={hiddenFinancialRoles.includes(role)}
                    onChange={() => toggleHiddenRole(role)}
                  />
                  <span>{fr ? ROLE_LABELS_FR[role] : ROLE_LABELS_EN[role]}</span>
                </label>
              ))}
            </div>
            <button type="button" className="btn btn-primary" onClick={handleSaveVisibility} disabled={isSavingVisibility}>
              <Save size={16} /> {isSavingVisibility ? (fr ? 'Enregistrement…' : 'Saving…') : (fr ? 'Enregistrer' : 'Save')}
            </button>
          </div>
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
        .settings-hint { color: var(--text-muted); font-size: 0.85rem; margin: -0.5rem 0 1rem; line-height: 1.5; }
        .settings-form { display: flex; flex-direction: column; gap: 1rem; }
        .settings-form .btn { align-self: flex-start; display: flex; align-items: center; gap: 0.5rem; }
        .role-visibility-list { display: flex; flex-direction: column; gap: 0.6rem; }
        .role-visibility-item {
          display: flex; align-items: center; gap: 0.6rem;
          font-size: 0.9rem; color: var(--text-primary); cursor: pointer;
        }
        .role-visibility-item input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; }
        .store-link-row { display: flex; gap: 0.5rem; }
        .store-link-row .input { flex: 1; min-width: 0; }
        .store-link-row .btn { flex-shrink: 0; display: flex; align-items: center; gap: 0.4rem; }
        .store-link-preview {
          display: flex; align-items: center; gap: 0.4rem; width: fit-content;
          margin-top: 0.5rem; font-size: 0.85rem; color: var(--primary, #10b981);
          text-decoration: none; font-weight: 600;
        }
        .store-link-preview:hover { text-decoration: underline; }
        .store-qr-actions { display: flex; gap: 0.6rem; }
        .store-qr-actions .btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.4rem; }
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
          .store-link-row { flex-direction: column; }
          .store-qr-actions { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}
