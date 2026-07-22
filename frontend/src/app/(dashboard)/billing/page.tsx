'use client';

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import { api } from '@/lib/api/client';
import { useLanguage } from '@/context/LanguageContext';

export default function BillingPage() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [currentPlan, setCurrentPlan] = useState('freemium');
  const { t, language } = useLanguage();

  useEffect(() => {
    api.getSubscription().then(data => {
      if (data && data.plan) {
        setCurrentPlan(data.plan);
      }
    }).catch(console.error);
  }, []);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan || !phoneNumber) return;

    setLoading(true);
    setMessage('');
    try {
      const res = await api.checkout({ plan_id: selectedPlan, phone_number: phoneNumber });
      setMessage(res.message);
      setTimeout(() => {
        setSelectedPlan(null);
        setMessage('');
        setPhoneNumber('');
      }, 4000);
    } catch (error: any) {
      setMessage(error.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  const plans = [
    {
      id: 'starter',
      name: t('bill.monthly'),
      description: t('bill.monthly_desc'),
      features: [
        { fr: 'Clients illimités', en: 'Unlimited customers' },
        { fr: 'Gestion complète des commandes', en: 'Full order management' },
        { fr: 'Analyses détaillées', en: 'Detailed analytics' },
        { fr: 'Support email 24/7', en: 'Email support 24/7' },
        { fr: 'Campagnes WhatsApp', en: 'WhatsApp campaigns' },
      ],
      isPro: false,
    },
    {
      id: 'pro',
      name: t('bill.lifetime'),
      description: t('bill.lifetime_desc'),
      features: [
        { fr: 'Toutes les fonctionnalités Mensuel', en: 'All Monthly features' },
        { fr: 'Campagnes SMS & Email', en: 'SMS & Email campaigns' },
        { fr: 'Gestion Multi-Boutiques', en: 'Multi-Shop management' },
        { fr: 'Priorité Orange Money', en: 'Orange Money priority' },
        { fr: 'Support prioritaire', en: 'Priority support' },
        { fr: 'Mises à jour à vie', en: 'Lifetime updates' },
      ],
      isPro: true,
    }
  ];

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{t('bill.title')}</h1>
      <p className={styles.subtitle}>{t('bill.subtitle')}</p>
      
      <div className={styles.plansGrid}>
        {plans.map(plan => (
          <div key={plan.id} className={`${styles.planCard} ${plan.isPro ? styles.proCard : ''}`}>
            <h2 className={styles.planName}>{plan.name}</h2>
            <p className={styles.planDescription}>{plan.description}</p>
            <div className={styles.planFeaturesTitle}>{t('bill.features')}</div>
            <ul className={styles.planFeatures}>
              {plan.features.map((feat, idx) => (
                <li key={idx}>{language === 'fr' ? feat.fr : feat.en}</li>
              ))}
            </ul>
            <button 
              className={`${styles.selectButton} ${plan.isPro ? styles.selectButtonPro : ''}`}
              onClick={() => plan.id !== currentPlan && setSelectedPlan(plan.id)}
              disabled={plan.id === currentPlan}
            >
              {plan.id === currentPlan ? t('bill.current') : t('bill.choose')}
            </button>
          </div>
        ))}
      </div>

      {selectedPlan && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            {message ? (
              <>
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem', color: 'var(--color-brand-500)' }}>✓</div>
                  <h3 className={styles.modalTitle} style={{ marginBottom: '0.5rem' }}>{t('bill.request_sent')}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>{message}</p>
                </div>
                <button type="button" className={styles.cancelButton} onClick={() => { setSelectedPlan(null); setMessage(''); }}>
                  {t('common.close')}
                </button>
              </>
            ) : (
              <>
                <h3 className={styles.modalTitle}>{t('bill.request_pro')}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.6', marginBottom: '1rem' }}>
                  {t('bill.request_desc')}
                </p>
                <form onSubmit={handleCheckout}>
                  <div className={styles.inputGroup}>
                    <label>{t('bill.phone_label')}</label>
                    <input 
                      type="tel" 
                      placeholder="Ex: 627 17 13 97" 
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value)}
                      required
                    />
                  </div>
                  <button type="submit" className={styles.payButton} disabled={loading}>
                    {loading ? t('bill.sending') : t('bill.send_request')}
                  </button>
                  <button type="button" className={styles.cancelButton} onClick={() => setSelectedPlan(null)}>
                    {t('common.cancel')}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
