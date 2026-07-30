// ============================================================================
//  SIGEXPC - Module d'envoi WhatsApp (API officielle Meta Cloud)
//  Envoie des reçus et rappels d'abonnement via WhatsApp Business API.
//
//  PRÉREQUIS :
//  1. Créer un compte Meta Business + une application WhatsApp Business
//     (https://business.facebook.com)
//  2. Obtenir un numéro de téléphone WhatsApp Business dédié
//  3. Récupérer le token d'accès (Access Token) et le Phone Number ID
//  4. Configurer dans .env :
//     WHATSAPP_TOKEN=EAAx...votre_token...
//     WHATSAPP_PHONE_NUMBER_ID=123456789
//     WHATSAPP_VERSION=v18.0
//
//  Note : Pour les messages sortants (templates), ils doivent être
//  pré-approuvés par Meta. On peut aussi utiliser les messages de session
//  (dans les 24h après un message reçu du client).
// ============================================================================
const https = require('https');

// Vérifie si WhatsApp est configuré
function isWhatsAppConfigured() {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  return !!(token && phoneId && !String(token).includes('votre'));
}

// Normalise un numéro de téléphone au format international (sans +, espaces, etc.)
// Ex: "07 01 02 03 04" → "2250701020304" (Côte d'Ivoire = 225)
function normalizePhone(phone) {
  if (!phone) return null;
  let p = String(phone).replace(/[\s\-().+]/g, '');
  // Si ça commence par 00, remplacer par rien (format international déjà)
  if (p.startsWith('00')) p = p.substring(2);
  // Si ça commence par 0 (numéro local CI), préfixer avec 225
  if (p.startsWith('0') && p.length <= 10) p = '225' + p;
  // Si ça commence par 7 ou 5 et fait 10 chiffres (numéro CI sans le 0)
  if (/^[57]\d{9}$/.test(p)) p = '225' + p;
  return p;
}

// Envoie un message WhatsApp via l'API Cloud Meta
async function sendWhatsAppMessage(toPhone, templateName, languageCode, components) {
  if (!isWhatsAppConfigured()) {
    console.log(`📱 [WhatsApp DEMO] À: ${toPhone} | Template: ${templateName}`);
    console.log('   (Configurez WHATSAPP_TOKEN et WHATSAPP_PHONE_NUMBER_ID dans .env)');
    return { demo: true, to: toPhone };
  }

  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_VERSION || 'v18.0';

  const payload = {
    messaging_product: 'whatsapp',
    to: toPhone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode || 'fr' },
      components: components || []
    }
  };

  const body = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const req = https.request(
      `https://graph.facebook.com/${version}/${phoneId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      },
      resp => {
        let d = '';
        resp.on('data', c => d += c);
        resp.on('end', () => {
          if (resp.statusCode === 200 || resp.statusCode === 201) {
            console.log(`✅ WhatsApp envoyé à ${toPhone}`);
            try { resolve(JSON.parse(d)); } catch { resolve({ success: true }); }
          } else {
            console.error(`❌ Erreur WhatsApp (${resp.statusCode}):`, d.slice(0, 200));
            resolve({ success: false, error: d });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ============================================================================
//  REÇU DE PAIEMENT par WhatsApp
// ============================================================================
async function sendRecuWhatsApp({ phone, aeNom, montant, dateFin, numRecu }) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return { skipped: true, reason: 'Numéro invalide' };

  // Template Meta à créer dans le Business Manager :
  // Nom: recu_paiement
  // Langue: fr
  // Corps: "✅ Paiement confirmé ! Votre abonnement SIGEXPC a été réactivé.
  //         Auto-école: {{1}} | Montant: {{2}} FCFA | Valide jusqu'au: {{3}} | Reçu N° {{4}}"
  return sendWhatsAppMessage(normalizedPhone, 'recu_paiement', 'fr', [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: aeNom },
        { type: 'text', text: String(montant) },
        { type: 'text', text: dateFin },
        { type: 'text', text: numRecu }
      ]
    }
  ]);
}

// ============================================================================
//  RAPPEL D'EXPIRATION par WhatsApp (J-3)
// ============================================================================
async function sendRappelWhatsApp({ phone, aeNom, joursRestants, dateFin }) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return { skipped: true, reason: 'Numéro invalide' };

  // Template Meta à créer dans le Business Manager :
  // Nom: rappel_expiration
  // Langue: fr
  // Corps: "⚠️ Rappel SIGEXPC : Il vous reste {{1}} jour(s) d'abonnement.
  //         Auto-école: {{2}} | Expiration: {{3}}.
  //         Renouvelez dès maintenant pour garder l'accès à la plateforme."
  return sendWhatsAppMessage(normalizedPhone, 'rappel_expiration', 'fr', [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: String(joursRestants) },
        { type: 'text', text: aeNom },
        { type: 'text', text: dateFin }
      ]
    }
  ]);
}

module.exports = {
  sendWhatsAppMessage,
  sendRecuWhatsApp,
  sendRappelWhatsApp,
  normalizePhone,
  isWhatsAppConfigured
};
