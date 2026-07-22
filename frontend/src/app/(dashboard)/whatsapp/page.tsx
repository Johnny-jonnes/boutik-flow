'use client';

import { useState, useEffect } from 'react';
import { Sparkles, MessageSquare, Users, Send, Copy, ExternalLink, Plus, Trash2, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';

const QUICK_TEMPLATES = [
  {
    id: 't1',
    name: 'Accueil Client',
    text: 'Bonjour {nom}, toute l\'équipe de {boutique} vous remercie de votre intérêt. Nous sommes à votre entière disposition pour vous accompagner et répondre à vos questions.',
  },
  {
    id: 't2',
    name: 'Commande Disponibilité',
    text: 'Bonjour {nom}, nous avons le plaisir de vous informer que votre commande auprès de {boutique} est finalisée et prête. Vous pouvez la récupérer à votre convenance ou nous solliciter pour organiser la livraison.',
  },
  {
    id: 't3',
    name: 'Offre Privilège',
    text: 'Bonjour {nom}, en tant que client privilégié de {boutique}, nous vous invitons à découvrir nos dernières nouveautés. Restant à votre écoute pour toute réservation.',
  },
  {
    id: 't4',
    name: 'Suivi de Commande',
    text: 'Bonjour {nom}, nous faisons suite à votre visite et à votre sélection d\'articles chez {boutique}. Notre service client reste disponible si vous désirez finaliser votre achat.',
  },
  {
    id: 't5',
    name: 'Remerciement & Fidélité',
    text: 'Bonjour {nom}, nous vous remercions sincèrement pour votre confiance envers {boutique}. Votre satisfaction étant notre priorité, n\'hésitez pas à nous faire part de vos retours.',
  },
];

export default function WhatsAppPage() {
  const { t } = useLanguage();
  const [clients, setClients] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<any[]>([]);
  const [manualNumber, setManualNumber] = useState('');
  const [message, setMessage] = useState('');
  const [boutiqueName, setBoutiqueName] = useState('Ma Boutique');
  const [activeTab, setActiveTab] = useState<'compose' | 'templates' | 'bulk'>('compose');
  const [searchClients, setSearchClients] = useState('');
  const [sentCount, setSentCount] = useState(0);

  useEffect(() => {
    api.getClients(1, 200).then(res => setClients(res.items)).catch(() => {});
    api.getSegments(1, 100).then(res => setSegments(res.items)).catch(() => {});
    // Récupérer le nom de la boutique depuis le token
    try {
      const token = localStorage.getItem('boutikflow_access_token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.tenant_name) setBoutiqueName(payload.tenant_name);
      }
    } catch {}
  }, []);

  const buildWaUrl = (phoneNumber: string, text: string) => {
    // Nettoyer le numéro : enlever les espaces, tirets, parenthèses
    let cleaned = phoneNumber.replace(/[\s\-().]/g, '');
    // Si pas de +, ajouter le code pays Guinée par défaut
    if (!cleaned.startsWith('+') && !cleaned.startsWith('224')) {
      cleaned = '224' + cleaned;
    }
    if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);
    const encodedText = encodeURIComponent(text);
    return `https://wa.me/${cleaned}?text=${encodedText}`;
  };

  const applyTemplate = (template: typeof QUICK_TEMPLATES[0]) => {
    const filled = template.text
      .replace(/{nom}/g, selectedContacts[0]?.name || 'Client')
      .replace(/{boutique}/g, boutiqueName);
    setMessage(filled);
    toast.success('Modèle appliqué !');
  };

  const openWhatsApp = (phone: string, text: string) => {
    const url = buildWaUrl(phone, text);
    window.open(url, '_blank');
    setSentCount(c => c + 1);
    toast.success('WhatsApp ouvert ! Message prêt à envoyer.');
  };

  const handleSendToContact = (contact: any) => {
    if (!message.trim()) {
      toast.error('Veuillez rédiger un message avant d\'envoyer.');
      return;
    }
    const phone = contact.phone || contact.telephone || '';
    if (!phone) {
      toast.error(`Pas de numéro de téléphone pour ${contact.name}.`);
      return;
    }
    const personalizedMsg = message
      .replace(/{nom}/g, contact.name || 'Client')
      .replace(/{boutique}/g, boutiqueName);
    openWhatsApp(phone, personalizedMsg);
  };

  const handleSendManual = () => {
    if (!manualNumber.trim()) {
      toast.error('Entrez un numéro de téléphone.');
      return;
    }
    if (!message.trim()) {
      toast.error('Rédigez un message.');
      return;
    }
    openWhatsApp(manualNumber, message);
  };

  const handleCopyLink = () => {
    if (!manualNumber.trim() || !message.trim()) {
      toast.error('Numéro et message requis.');
      return;
    }
    const url = buildWaUrl(manualNumber, message);
    navigator.clipboard.writeText(url);
    toast.success('Lien WhatsApp copié !');
  };

  const toggleContact = (client: any) => {
    setSelectedContacts(prev =>
      prev.find(c => c.id === client.id)
        ? prev.filter(c => c.id !== client.id)
        : [...prev, client]
    );
  };

  const applySegment = (segmentId: string) => {
    if (!segmentId) {
      setSelectedContacts([]);
      return;
    }
    const seg = segments.find(s => s.id === segmentId);
    if (!seg) return;
    
    const filters = seg.filters || {};
    
    const matched = clients.filter(c => {
      // Filter by status
      if (filters.status && c.status !== filters.status) return false;
      // Filter by tags
      if (filters.tags && Array.isArray(filters.tags)) {
        const hasAllTags = filters.tags.every((t: string) => c.tags?.includes(t));
        if (!hasAllTags) return false;
      }
      return true;
    });
    
    setSelectedContacts(matched.filter(c => c.phone || c.telephone));
    toast.success(`${matched.filter(c => c.phone || c.telephone).length} client(s) ciblés par le segment "${seg.name}" !`);
  };


  const filteredClients = clients.filter(c =>
    c.name?.toLowerCase().includes(searchClients.toLowerCase()) ||
    (c.phone || c.telephone || '').includes(searchClients)
  );

  return (
    <div className="page fade-in">
      {/* Header */}
      <div className="page-header">
        <div className="page-header__info">
          <h1 className="page-header__title">
            {t('wa.title')}
          </h1>
          <p className="page-header__desc">
            {t('wa.subtitle')}
          </p>
        </div>
        {sentCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '12px', padding: '0.5rem 1rem' }}>
            <CheckCircle size={16} style={{ color: '#10b981' }} />
            <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.9rem' }}>{sentCount} message{sentCount > 1 ? 's' : ''} envoyé{sentCount > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {[
          { id: 'compose', label: t('wa.tab_compose'), icon: MessageSquare },
          { id: 'templates', label: t('wa.tab_templates'), icon: Sparkles },
          { id: 'bulk', label: t('wa.tab_bulk'), icon: Users },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.6rem 1.2rem',
                borderRadius: '10px',
                border: activeTab === tab.id ? '1px solid rgba(16,185,129,0.4)' : '1px solid var(--border-subtle)',
                background: activeTab === tab.id ? 'rgba(16,185,129,0.12)' : 'var(--surface-1)',
                color: activeTab === tab.id ? '#10b981' : 'var(--text-secondary)',
                fontWeight: activeTab === tab.id ? 700 : 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB : Composer */}
      {activeTab === 'compose' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* Panneau gauche : Rédaction */}
          <div className="card">
            <h3 style={{ marginBottom: '1.25rem', fontSize: '1rem', fontWeight: 700 }}>{t('wa.write_message')}</h3>

            <div className="form-group">
              <label className="form-label">{t('wa.phone')}</label>
              <input
                type="tel"
                className="input"
                placeholder="Ex: 620 00 00 00 ou +224620000000"
                value={manualNumber}
                onChange={e => setManualNumber(e.target.value)}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                Le code pays Guinée (+224) est ajouté automatiquement si absent.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">{t('wa.message')}</label>
              <textarea
                className="input"
                placeholder="Bonjour {nom}, nous avons une offre spéciale pour vous..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={6}
                style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                Utilisez <code style={{ background: 'var(--surface-2)', padding: '0 4px', borderRadius: '4px' }}>{'{nom}'}</code> et <code style={{ background: 'var(--surface-2)', padding: '0 4px', borderRadius: '4px' }}>{'{boutique}'}</code> pour personnaliser.
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                className="btn btn-primary"
                onClick={handleSendManual}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem' }}
              >
                <ExternalLink size={16} />
                {t('wa.open_whatsapp')}
              </button>
              <button
                className="btn btn-ghost"
                onClick={handleCopyLink}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem' }}
                title="Copier le lien wa.me"
              >
                <Copy size={16} />
              </button>
            </div>

            {/* Aperçu du message */}
            {message.trim() && (
              <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--surface-0)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('wa.preview')}</p>
                <div style={{ background: '#dcf8c6', color: '#1a1a1a', borderRadius: '12px', borderTopRightRadius: '4px', padding: '0.75rem 1rem', fontSize: '0.9rem', lineHeight: 1.6, maxWidth: '85%', marginLeft: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  {message.replace(/{nom}/g, 'Client').replace(/{boutique}/g, boutiqueName)}
                  <div style={{ fontSize: '0.7rem', color: '#5f6368', textAlign: 'right', marginTop: '4px' }}>
                    {new Date().toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })} ✓✓
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Panneau droit : Clients récents */}
          <div className="card">
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: 700 }}>{t('wa.send_to_client')}</h3>
            <input
              type="text"
              className="input"
              placeholder={t('wa.search_client')}
              value={searchClients}
              onChange={e => setSearchClients(e.target.value)}
              style={{ marginBottom: '1rem' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '380px', overflowY: 'auto' }}>
              {filteredClients.slice(0, 20).map(client => (
                <div
                  key={client.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.75rem', borderRadius: '10px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--surface-0)',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #047857)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
                    {client.name?.charAt(0) || '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{client.phone || client.telephone || t('wa.no_phone')}</div>
                  </div>
                  <button
                    onClick={() => handleSendToContact(client)}
                    disabled={!(client.phone || client.telephone)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.35rem',
                      padding: '0.4rem 0.8rem', borderRadius: '8px',
                      background: 'var(--color-brand-500)', color: 'white', border: 'none',
                      fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                      opacity: (client.phone || client.telephone) ? 1 : 0.4,
                      whiteSpace: 'nowrap', flexShrink: 0,
                    }}
                  >
                    <Send size={13} /> {t('wa.send')}
                  </button>
                </div>
              ))}
              {filteredClients.length === 0 && (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0', fontSize: '0.875rem' }}>
                  {t('wa.no_client')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB : Modèles rapides */}
      {activeTab === 'templates' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {QUICK_TEMPLATES.map(template => (
            <div key={template.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{template.name}</h3>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, background: 'var(--surface-0)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                {template.text}
              </p>
              <button
                className="btn btn-primary"
                onClick={() => { applyTemplate(template); setActiveTab('compose'); }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                <Copy size={15} /> {t('wa.use_template')}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* TAB : Envoi groupé */}
      {activeTab === 'bulk' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1.5rem' }}>
          {/* Sélection contacts */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{t('wa.select_contacts')}</h3>
              <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>
                {selectedContacts.length} sélectionné{selectedContacts.length > 1 ? 's' : ''}
              </span>
            </div>
            <input
              type="text"
              className="input"
              placeholder="Rechercher..."
              value={searchClients}
              onChange={e => setSearchClients(e.target.value)}
              style={{ marginBottom: '0.75rem' }}
            />
            <select
              className="input"
              onChange={e => applySegment(e.target.value)}
              style={{ marginBottom: '0.75rem', fontSize: '0.85rem' }}
              defaultValue=""
            >
              <option value="">-- Cibler via un Segment CRM --</option>
              {segments.map(seg => (
                <option key={seg.id} value={seg.id}>
                  Segment: {seg.name} ({seg.client_count || 0} client(s))
                </option>
              ))}
            </select>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '400px', overflowY: 'auto' }}>
              {filteredClients.slice(0, 50).map(client => {
                const isSelected = selectedContacts.find(c => c.id === client.id);
                const hasPhone = !!(client.phone || client.telephone);
                return (
                  <div
                    key={client.id}
                    onClick={() => hasPhone && toggleContact(client)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.6rem 0.75rem', borderRadius: '8px',
                      border: isSelected ? '1px solid rgba(16,185,129,0.4)' : '1px solid var(--border-subtle)',
                      background: isSelected ? 'rgba(16,185,129,0.08)' : 'var(--surface-0)',
                      cursor: hasPhone ? 'pointer' : 'not-allowed',
                      opacity: hasPhone ? 1 : 0.5,
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', border: '2px solid', borderColor: isSelected ? '#10b981' : 'var(--border-default)', background: isSelected ? '#10b981' : 'transparent', flexShrink: 0, transition: 'all 0.15s' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{client.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{client.phone || client.telephone || t('wa.no_phone')}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rédaction et envoi groupé */}
          <div className="card">
            <h3 style={{ marginBottom: '1.25rem', fontSize: '1rem', fontWeight: 700 }}>Message de la campagne</h3>
            <div className="form-group">
              <textarea
                className="input"
                placeholder="Bonjour {nom}, nous avons une offre spéciale..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={5}
                style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
              />
            </div>

            {selectedContacts.length > 0 && message.trim() && (
              <div style={{ marginTop: '0.5rem' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  ⚠️ Un onglet WhatsApp s'ouvrira pour chaque contact. WhatsApp peut bloquer si vous ouvrez trop d'onglets à la fois.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto', marginBottom: '1rem' }}>
                  {selectedContacts.map(contact => (
                    <div key={contact.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'var(--surface-0)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{contact.name}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginLeft: '0.5rem' }}>{contact.phone || contact.telephone}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          onClick={() => handleSendToContact(contact)}
                          style={{ padding: '0.3rem 0.6rem', background: 'var(--color-brand-500)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          <ExternalLink size={12} /> {t('wa.send')}
                        </button>
                        <button
                          onClick={() => toggleContact(contact)}
                          style={{ padding: '0.3rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  className="btn btn-primary"
                  onClick={() => {
                    selectedContacts.forEach((contact, i) => {
                      setTimeout(() => handleSendToContact(contact), i * 800);
                    });
                  }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.85rem', fontWeight: 700 }}
                >
                  <Send size={16} />
                  Envoyer à tous ({selectedContacts.length} contact{selectedContacts.length > 1 ? 's' : ''})
                </button>
              </div>
            )}

            {(selectedContacts.length === 0 || !message.trim()) && (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem', border: '1px dashed var(--border-subtle)', borderRadius: '12px', marginTop: '1rem' }}>
                <Users size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                Sélectionnez au moins un contact et rédigez votre message pour continuer.
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .form-group { margin-bottom: 1rem; }
      `}</style>
    </div>
  );
}
