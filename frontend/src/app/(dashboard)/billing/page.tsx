'use client';

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import { api } from '@/lib/api/client';

export default function BillingPage() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [currentPlan, setCurrentPlan] = useState('Freemium');

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
      id: 'freemium',
      name: 'Freemium',
      price: '50 000',
      features: ['Jusqu\'à 50 clients', 'Gestion des commandes basique', 'Support communautaire'],
      buttonText: 'Plan actuel',
      isPro: false,
    },
    {
      id: 'starter',
      name: 'Starter',
      price: '49,000',
      features: ['Clients illimités', 'Analyses détaillées', 'Support email 24/7'],
      buttonText: 'Choisir Starter',
      isPro: false,
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '99,000',
      features: ['Fonctionnalités Starter', 'Campagnes SMS/Email', 'Priorité Orange Money', 'Gestion Multi-Boutiques'],
      buttonText: 'Passer en Pro',
      isPro: true,
    }
  ];

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Abonnements & Facturation</h1>
      <p className={styles.subtitle}>Choisissez le forfait qui correspond à la taille de votre boutique.</p>
      
      <div className={styles.plansGrid}>
        {plans.map(plan => (
          <div key={plan.id} className={`${styles.planCard} ${plan.isPro ? styles.proCard : ''}`}>
            <h2 className={styles.planName}>{plan.name}</h2>
            <div className={styles.planPrice}>
              {plan.price} <span className={styles.planCurrency}>GNF / mois</span>
            </div>
            <ul className={styles.planFeatures}>
              {plan.features.map((feat, idx) => (
                <li key={idx}>{feat}</li>
              ))}
            </ul>
            <button 
              className={`${styles.selectButton} ${plan.isPro ? styles.selectButtonPro : ''}`}
              onClick={() => plan.id !== 'freemium' && setSelectedPlan(plan.id)}
              disabled={plan.name === currentPlan}
            >
              {plan.name === currentPlan ? 'Plan Actuel' : plan.buttonText}
            </button>
          </div>
        ))}
      </div>

      {selectedPlan && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>Paiement Orange Money</h3>
            <form onSubmit={handleCheckout}>
              <div className={styles.inputGroup}>
                <label>Numéro de téléphone (Orange)</label>
                <input 
                  type="tel" 
                  placeholder="Ex: 620 00 00 00" 
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className={styles.payButton} disabled={loading}>
                {loading ? 'Traitement...' : 'Payer maintenant'}
              </button>
              <button type="button" className={styles.cancelButton} onClick={() => setSelectedPlan(null)}>
                Annuler
              </button>
              {message && <div className={styles.message}>{message}</div>}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
