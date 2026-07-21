'use client';

import { useEffect, useState } from 'react';
import { Plus, Megaphone, Search, Calendar, Send, Trash2, Users, Mail, MessageSquare, AlertCircle } from 'lucide-react';
import type { Campaign, Segment } from '@/types';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { useLanguage } from '@/context/LanguageContext';

export default function CampaignsPage() {
  const { t } = useLanguage();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Add modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    segment_id: '',
    channel: 'whatsapp' as 'whatsapp' | 'sms' | 'email',
    message: '',
    status: 'brouillon' as 'brouillon' | 'programmee' | 'envoyee',
    scheduled_at: '',
  });

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = async () => {
    try {
      const [campResponse, segResponse] = await Promise.all([
        api.getCampaigns(1, 100),
        api.getSegments(1, 100),
      ]);
      setCampaigns(campResponse.items);
      setSegments(segResponse.items);
    } catch (error) {
      toast.error('Erreur lors de la récupération des données');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.message.trim()) {
      toast.error('Le message de la campagne ne peut pas être vide');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        name: addForm.name,
        segment_id: addForm.segment_id || undefined,
        channel: addForm.channel,
        message: addForm.message,
        status: addForm.status,
      };

      if (addForm.status === 'programmee') {
        if (!addForm.scheduled_at) {
          toast.error('Veuillez spécifier une date de programmation');
          setIsSubmitting(false);
          return;
        }
        payload.scheduled_at = new Date(addForm.scheduled_at).toISOString();
      }

      await api.createCampaign(payload);
      toast.success(
        addForm.status === 'envoyee' 
          ? 'Campagne envoyée avec succès' 
          : addForm.status === 'programmee'
            ? 'Campagne programmée avec succès'
            : 'Campagne enregistrée comme brouillon'
      );
      setIsAddOpen(false);
      setAddForm({
        name: '',
        segment_id: '',
        channel: 'whatsapp',
        message: '',
        status: 'brouillon',
        scheduled_at: '',
      });
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la création de la campagne');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.deleteCampaign(deleteTarget.id);
      toast.success('Campagne supprimée');
      setDeleteTarget(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression');
    } finally {
      setIsDeleting(false);
    }
  };

  const getSegmentName = (segmentId: string | null) => {
    if (!segmentId) return 'Tous les clients';
    const seg = segments.find(s => s.id === segmentId);
    return seg ? seg.name : 'Segment inconnu';
  };

  const filteredCampaigns = campaigns.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-header__info">
          <h1 className="page-header__title">{t('camp.title')}</h1>
          <p className="page-header__desc">{t('camp.subtitle')}</p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => setIsAddOpen(true)}>
            <Plus size={18} />
            <span>{t('camp.new')}</span>
          </button>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div className="search-box" style={{ position: 'relative', maxWidth: '400px', width: '100%' }}>
            <span className="search-icon" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}><Search size={18} /></span>
            <input 
              type="text" 
              className="input search-input" 
              placeholder={t('camp.search')} 
              style={{ paddingLeft: '2.5rem', width: '100%' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner"></div></div>
        ) : (
          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('camp.name')}</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('camp.channel')}</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('camp.status')}</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('camp.date')}</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }} className="text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredCampaigns.map((campaign) => (
                  <tr key={campaign.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--brand-alpha-10)', color: 'var(--color-brand-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Megaphone size={20} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{campaign.name}</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                            <Users size={12} /> {getSegmentName(campaign.segment_id)}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {campaign.channel === 'whatsapp' && <MessageSquare size={16} style={{ color: 'var(--color-brand-500)' }} />}
                        {campaign.channel === 'sms' && <AlertCircle size={16} style={{ color: '#3b82f6' }} />}
                        {campaign.channel === 'email' && <Mail size={16} style={{ color: '#ef4444' }} />}
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', textTransform: 'capitalize' }}>{campaign.channel}</span>
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ 
                        padding: '0.25rem 0.75rem', 
                        borderRadius: '999px', 
                        fontSize: '0.75rem', 
                        fontWeight: 600,
                        background: campaign.status === 'envoyee' 
                          ? 'rgba(16, 185, 129, 0.15)' 
                          : campaign.status === 'programmee' 
                            ? 'rgba(245, 158, 11, 0.15)' 
                            : campaign.status === 'echouee'
                              ? 'rgba(239, 68, 68, 0.15)'
                              : 'var(--surface-2)',
                        color: campaign.status === 'envoyee' 
                          ? '#10b981' 
                          : campaign.status === 'programmee' 
                            ? '#f59e0b' 
                            : campaign.status === 'echouee'
                              ? '#ef4444'
                              : 'var(--text-secondary)',
                      }}>
                        {campaign.status === 'envoyee' ? t('camp.sent') : campaign.status === 'programmee' ? t('camp.scheduled') : campaign.status === 'echouee' ? t('camp.failed') : t('camp.draft')}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {campaign.status === 'envoyee' && campaign.sent_at 
                        ? new Date(campaign.sent_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                        : campaign.status === 'programmee' && campaign.scheduled_at
                          ? `Planifiée le ${new Date(campaign.scheduled_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                          : `Créée le ${new Date(campaign.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
                      }
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <button className="btn btn-ghost btn-icon btn-danger-icon" onClick={() => setDeleteTarget(campaign)}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredCampaigns.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      {t('camp.no_campaign')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Ajouter */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Créer une campagne">
        <form onSubmit={handleAdd} className="modal-form">
          <div className="form-group">
            <label className="form-label">Nom de la campagne *</label>
            <input 
              type="text" 
              className="input" 
              required 
              value={addForm.name} 
              onChange={e => setAddForm({...addForm, name: e.target.value})} 
              placeholder="ex: Soldes de Tabaski" 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Segment ciblé *</label>
            <select 
              className="input" 
              value={addForm.segment_id} 
              onChange={e => setAddForm({...addForm, segment_id: e.target.value})}
            >
              <option value="">Tous les clients</option>
              {segments.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.client_count} client(s))</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Canal de diffusion *</label>
            <select 
              className="input" 
              value={addForm.channel} 
              onChange={e => setAddForm({...addForm, channel: e.target.value as any})}
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="sms">SMS</option>
              <option value="email">E-mail</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Message *</label>
            <textarea 
              className="input" 
              rows={4} 
              required 
              value={addForm.message} 
              onChange={e => setAddForm({...addForm, message: e.target.value})} 
              placeholder="Saisissez le texte du message à envoyer..." 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Planification</label>
            <select 
              className="input" 
              value={addForm.status} 
              onChange={e => setAddForm({...addForm, status: e.target.value as any})}
            >
              <option value="brouillon">Enregistrer comme brouillon</option>
              <option value="envoyee">Envoyer immédiatement</option>
              <option value="programmee">Programmer l'envoi</option>
            </select>
          </div>

          {addForm.status === 'programmee' && (
            <div className="form-group">
              <label className="form-label">Date et Heure d'envoi *</label>
              <input 
                type="datetime-local" 
                className="input" 
                required 
                value={addForm.scheduled_at} 
                onChange={e => setAddForm({...addForm, scheduled_at: e.target.value})} 
              />
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setIsAddOpen(false)}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting 
                ? 'Création...' 
                : addForm.status === 'envoyee' 
                  ? 'Créer & Envoyer' 
                  : 'Créer'
              }
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Supprimer */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirmer la suppression">
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Êtes-vous sûr de vouloir supprimer la campagne <strong>{deleteTarget?.name}</strong> ? Cette action est irréversible.
        </p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>Annuler</button>
          <button className="btn btn-danger" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? 'Suppression...' : 'Supprimer'}
          </button>
        </div>
      </Modal>

      <style jsx>{`
        .btn-icon { padding: 0.4rem; border-radius: 6px; }
        .btn-danger-icon:hover { color: var(--color-error); background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.2); }
        .modal-form { display: flex; flex-direction: column; gap: 1rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.375rem; }
        .form-label { font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); }
        .modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem; }
        .data-table tr:hover td { background: var(--surface-hover); }
      `}</style>
    </div>
  );
}
