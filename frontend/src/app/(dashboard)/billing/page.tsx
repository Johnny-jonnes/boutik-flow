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
  const { t } = useLanguage();

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
                <li key={idx}>{feat.fr}</li>
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
            <h3 className={styles.modalTitle}>{t('bill.orange_money')}</h3>
            <form onSubmit={handleCheckout}>
              <div className={styles.inputGroup}>
                <label>{t('bill.phone')}</label>
                <input 
                  type="tel" 
                  placeholder="Ex: 620 00 00 00" 
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className={styles.payButton} disabled={loading}>
                {loading ? '...' : t('bill.pay')}
              </button>
              <button type="button" className={styles.cancelButton} onClick={() => setSelectedPlan(null)}>
                {t('bill.cancel')}
              </button>
              {message && <div className={styles.message}>{message}</div>}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
