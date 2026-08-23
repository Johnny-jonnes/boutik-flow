import { SharedArray } from 'k6/data';

// SharedArray charge le JSON une seule fois et le partage (lecture seule)
// entre tous les VUs d'un même processus k6, au lieu d'une copie par VU —
// indispensable dès qu'on simule des milliers de VUs avec ce volume de
// données (voir generate_synthetic_data.py).
const raw = JSON.parse(open('../data/tenants.json'));

export const tenants = new SharedArray('tenants', function () {
  return raw.tenants;
});

export const loginTestAccounts = raw.login_test_accounts;
export const runId = raw.run_id;
export const generatedAt = raw.generated_at;
