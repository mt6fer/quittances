// ============================================
// GÉNÉRATEUR DE QUITTANCES DE LOYER - APP.JS (v2)
// ============================================

class RentReceiptGenerator {
  constructor() {
    this.tenants = [];
    this.signatureImage = null;
    this.preFillNextPeriod = false;
    this.tenantCounter = 1;
    this.initializeApp();
  }

  // ============================================
  // INITIALISATION
  // ============================================

  initializeApp() {
    document.addEventListener('DOMContentLoaded', () => {
      this.loadFromLocalStorage();
      this.setupEventListeners();
    });

    // Fallback si DOM est déjà chargé
    if (document.readyState === 'loading') {
      return;
    }
    this.loadFromLocalStorage();
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Bouton ajouter locataire
    const addTenantBtn = document.getElementById('add-tenant-btn');
    if (addTenantBtn) {
      addTenantBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.addTenant();
      });
    }

    // Boutons générer PDF
    const generateBtns = document.querySelectorAll('.generate-pdf-btn');
    generateBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.generatePDFs();
      });
    });

    // Upload signature
    const fileInput = document.getElementById('dropzone-file');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => this.handleSignatureUpload(e));
      this.setupDragAndDrop(fileInput);
    }

    // Checkbox pré-remplissage
    const prefillCheckbox = document.getElementById('prefill-checkbox');
    if (prefillCheckbox) {
      prefillCheckbox.addEventListener('change', (e) => {
        this.preFillNextPeriod = e.target.checked;
        this.saveToLocalStorage();
      });
    }

    // Écouteurs pour sauvegarde automatique
    this.setupAutoSave();
  }

  setupDragAndDrop(fileInput) {
    const dropZone = fileInput.parentElement;
    if (!dropZone) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.add('bg-gray-200', 'dark:bg-gray-500');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.remove('bg-gray-200', 'dark:bg-gray-500');
      }, false);
    });

    dropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      fileInput.files = files;
      this.handleSignatureUpload({ target: fileInput });
    }, false);
  }

  setupAutoSave() {
    // Inputs du bailleur
    const landlordNameInput = document.getElementById('landlord-name');
    const landlordAddressInput = document.getElementById('landlord-address');

    if (landlordNameInput) {
      landlordNameInput.addEventListener('change', () => this.saveToLocalStorage());
    }
    if (landlordAddressInput) {
      landlordAddressInput.addEventListener('change', () => this.saveToLocalStorage());
    }

    // Inputs des dates et montants
    ['date-start', 'date-end', 'date-payment', 'rental-amount', 'charges-amount'].forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('change', () => this.saveToLocalStorage());
      }
    });
  }

  // ============================================
  // GESTION DES LOCATAIRES
  // ============================================

  addTenant() {
    const tenantIndex = this.tenantCounter;
    this.tenantCounter++;

    this.tenants.push({
      index: tenantIndex,
      name: '',
      address: ''
    });

    const container = document.getElementById('tenants-container');
    if (!container) return;

    const tenantHTML = `
      <div class="tenant-form-${tenantIndex} flex flex-col gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
        <div class="flex items-center justify-between">
          <h4 class="text-[#111318] dark:text-gray-200 text-base font-semibold">Locataire ${tenantIndex}</h4>
          <button type="button" class="remove-tenant-btn-${tenantIndex} text-red-500 hover:text-red-700 text-sm font-medium flex items-center gap-1">
            <span class="material-symbols-outlined text-lg">delete</span>
          </button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <label class="flex flex-col w-full">
            <p class="text-[#111318] dark:text-gray-200 text-base font-medium leading-normal pb-2">Nom complet du locataire ${tenantIndex}</p>
            <input id="tenant-name-${tenantIndex}" type="text" class="tenant-input form-input w-full min-w-0 resize-none overflow-hidden rounded-lg text-[#111318] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-600 bg-white dark:bg-background-dark h-14 placeholder:text-[#616f89] dark:placeholder:text-gray-500 p-[15px] text-base font-normal leading-normal" placeholder="Ex: Marie Martin" />
          </label>
          <label class="flex flex-col w-full md:col-span-2">
            <p class="text-[#111318] dark:text-gray-200 text-base font-medium leading-normal pb-2">Adresse du bien loué - Locataire ${tenantIndex}</p>
            <textarea id="tenant-address-${tenantIndex}" class="tenant-input form-input w-full min-w-0 resize-y overflow-hidden rounded-lg text-[#111318] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-600 bg-white dark:bg-background-dark min-h-24 placeholder:text-[#616f89] dark:placeholder:text-gray-500 p-[15px] text-base font-normal leading-normal" placeholder="Ex: 456 Avenue des Champs-Élysées, 75008 Paris"></textarea>
          </label>
        </div>
      </div>
    `;

    // Insérer avant le bouton "Ajouter"
    const addBtn = document.getElementById('add-tenant-btn');
    if (addBtn) {
      addBtn.parentElement.insertAdjacentHTML('beforeend', tenantHTML);
    } else {
      container.insertAdjacentHTML('beforeend', tenantHTML);
    }

    // Ajouter les écouteurs d'événements
    this.attachTenantListeners(tenantIndex);
    this.saveToLocalStorage();
  }

  attachTenantListeners(index) {
    const nameInput = document.getElementById(`tenant-name-${index}`);
    const addressInput = document.getElementById(`tenant-address-${index}`);
    const removeBtn = document.querySelector(`.remove-tenant-btn-${index}`);

    if (nameInput) {
      nameInput.addEventListener('change', () => {
        const tenant = this.tenants.find(t => t.index === index);
        if (tenant) {
          tenant.name = nameInput.value;
          this.saveToLocalStorage();
        }
      });
    }

    if (addressInput) {
      addressInput.addEventListener('change', () => {
        const tenant = this.tenants.find(t => t.index === index);
        if (tenant) {
          tenant.address = addressInput.value;
          this.saveToLocalStorage();
        }
      });
    }

    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.removeTenant(index);
      });
    }
  }

  removeTenant(index) {
    this.tenants = this.tenants.filter(t => t.index !== index);
    const form = document.querySelector(`.tenant-form-${index}`);
    if (form) {
      form.remove();
    }
    this.saveToLocalStorage();
  }

  // ============================================
  // GESTION DE LA SIGNATURE
  // ============================================

  handleSignatureUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validation
    if (!['image/png', 'image/jpeg', 'image/gif'].includes(file.type)) {
      alert('Veuillez importer un fichier PNG, JPG ou GIF');
      return;
    }

    if (file.size > 800 * 1024) {
      alert('Le fichier doit peser moins de 800 KB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      this.signatureImage = e.target.result;
      this.updateSignaturePreview();
      this.saveToLocalStorage();
    };
    reader.readAsDataURL(file);
  }

  updateSignaturePreview() {
    const preview = document.getElementById('signature-preview');
    if (preview && this.signatureImage) {
      preview.innerHTML = `<img src="${this.signatureImage}" class="h-full object-contain" alt="Signature" />`;
    }
  }

  // ============================================
  // RÉCUPÉRATION DES DONNÉES
  // ============================================

  getFormData() {
    const landlordName = document.getElementById('landlord-name')?.value || '';
    const landlordAddress = document.getElementById('landlord-address')?.value || '';
    const startDate = document.getElementById('date-start')?.value || '';
    const endDate = document.getElementById('date-end')?.value || '';
    const paymentDate = document.getElementById('date-payment')?.value || '';
    const rentalAmount = parseFloat(document.getElementById('rental-amount')?.value || 0);
    const chargesAmount = parseFloat(document.getElementById('charges-amount')?.value || 0);
    const chargeType = document.getElementById('charge-forfait')?.checked ? 'Forfait' : 'Provision';
    const additionalNotes = document.getElementById('additional-notes')?.value || '';

    // Récupérer les locataires du formulaire
    const tenantsFinal = [];
    this.tenants.forEach(tenant => {
      const nameInput = document.getElementById(`tenant-name-${tenant.index}`);
      const addressInput = document.getElementById(`tenant-address-${tenant.index}`);
      if (nameInput?.value || addressInput?.value) {
        tenantsFinal.push({
          name: nameInput?.value || '',
          address: addressInput?.value || ''
        });
      }
    });

    return {
      landlord: {
        name: landlordName,
        address: landlordAddress
      },
      tenants: tenantsFinal,
      dates: {
        start: startDate ? new Date(startDate) : null,
        end: endDate ? new Date(endDate) : null,
        payment: paymentDate ? new Date(paymentDate) : null
      },
      rental: rentalAmount,
      charges: chargesAmount,
      chargeType: chargeType,
      notes: additionalNotes
    };
  }

  // ============================================
  // CALCUL AU PRORATA
  // ============================================

  generateMonthlyBreakdown(startDate, endDate, rentalAmount, chargesAmount) {
    const months = [];
    let currentDate = new Date(startDate);
    currentDate.setDate(1);

    while (currentDate <= endDate) {
      const monthStart = new Date(currentDate);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const billStart = currentDate > startDate ? monthStart : startDate;
      const billEnd = monthEnd < endDate ? monthEnd : endDate;

      const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
      const daysToCharge = this.getDaysBetween(billStart, billEnd);

      const prorataRental = (rentalAmount / daysInMonth) * daysToCharge;
      const prorataCharges = (chargesAmount / daysInMonth) * daysToCharge;

      months.push({
        start: new Date(billStart),
        end: new Date(billEnd),
        daysToCharge: daysToCharge,
        daysInMonth: daysInMonth,
        rental: Math.round(prorataRental * 100) / 100,
        charges: Math.round(prorataCharges * 100) / 100,
        total: Math.round((prorataRental + prorataCharges) * 100) / 100
      });

      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return months;
  }

  getDaysBetween(startDate, endDate) {
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  }

  // ============================================
  // GÉNÉRATION DES PDF
  // ============================================

  async generatePDFs() {
    try {
      const formData = this.getFormData();

      // Validation
      if (!formData.landlord.name) {
        alert('Veuillez remplir le nom du bailleur');
        return;
      }

      if (formData.tenants.length === 0 || !formData.tenants.some(t => t.name)) {
        alert('Veuillez ajouter au moins un locataire avec un nom');
        return;
      }

      if (!formData.dates.start || !formData.dates.end) {
        alert('Veuillez définir les dates de début et fin');
        return;
      }

      if (formData.dates.start > formData.dates.end) {
        alert('La date de fin doit être après la date de début');
        return;
      }

      if (formData.rental <= 0) {
        alert('Veuillez entrer un montant de loyer valide');
        return;
      }

      // Générer les mois
      const months = this.generateMonthlyBreakdown(
        formData.dates.start,
        formData.dates.end,
        formData.rental,
        formData.charges
      );

      if (months.length === 0) {
        alert('Aucune période à facturer trouvée');
        return;
      }

      // Charger html2pdf si nécessaire
      if (typeof html2pdf === 'undefined') {
        await this.loadHtml2PDF();
      }

      let pdfCount = 0;
      const totalPDFs = months.length * formData.tenants.length;

      // Générer un PDF par mois et par locataire
      for (const tenant of formData.tenants) {
        if (!tenant.name) continue;

        for (const month of months) {
          const receiptHTML = this.generateReceiptHTML(formData, tenant, month);
          const fileName = `Quittance_${tenant.name.replace(/[^a-zA-Z0-9]/g, '_')}_${this.formatDate(month.start, 'MM_YYYY')}.pdf`;

          const options = {
            margin: 10,
            filename: fileName,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
          };

          html2pdf().set(options).from(receiptHTML).save();
          pdfCount++;

          // Délai entre les téléchargements
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      alert(`✅ ${pdfCount} quittance(s) générée(s) avec succès !`);
      this.saveToLocalStorage();

    } catch (error) {
      console.error('Erreur lors de la génération des PDF:', error);
      alert('❌ Une erreur est survenue. Vérifiez la console pour plus de détails.');
    }
  }

  loadHtml2PDF() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  generateReceiptHTML(formData, tenant, month) {
    const formattedStart = this.formatDate(month.start, 'DD/MM/YYYY');
    const formattedEnd = this.formatDate(month.end, 'DD/MM/YYYY');
    const receiptDate = this.formatDate(new Date(), 'DD/MM/YYYY');
    const isPartialMonth = month.daysToCharge < month.daysInMonth;

    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Calibri', 'Arial', sans-serif;
            color: #333;
            line-height: 1.5;
          }
          .container {
            max-width: 210mm;
            margin: 0 auto;
            padding: 15mm;
            background: white;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #135bec;
            padding-bottom: 20px;
          }
          .header h1 {
            color: #135bec;
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .header p {
            color: #999;
            font-size: 11px;
          }
          .section {
            margin-bottom: 20px;
          }
          .section-title {
            font-weight: bold;
            font-size: 12px;
            color: #135bec;
            text-transform: uppercase;
            margin-bottom: 8px;
            border-bottom: 1px solid #ddd;
            padding-bottom: 5px;
          }
          .info-row {
            display: flex;
            margin-bottom: 6px;
            font-size: 12px;
          }
          .info-label {
            font-weight: bold;
            width: 140px;
            min-width: 140px;
          }
          .info-value {
            flex: 1;
            word-break: break-word;
          }
          .amount-section {
            background-color: #f8f8f8;
            padding: 12px;
            border-radius: 3px;
            margin: 20px 0;
            border: 1px solid #e0e0e0;
          }
          .amount-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 6px;
            font-size: 12px;
          }
          .amount-row.total {
            font-weight: bold;
            font-size: 14px;
            border-top: 2px solid #135bec;
            padding-top: 8px;
            margin-top: 8px;
            color: #135bec;
          }
          .signature-area {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
          }
          .signature-box {
            width: 45%;
            text-align: center;
            border-top: 1px solid #333;
            padding-top: 8px;
            font-size: 11px;
          }
          .signature-image {
            max-width: 80px;
            max-height: 50px;
            margin-bottom: 8px;
          }
          .notes {
            font-size: 10px;
            color: #666;
            margin-top: 20px;
            padding: 10px;
            background-color: #fafafa;
            border-left: 3px solid #135bec;
          }
          .footer {
            margin-top: 20px;
            font-size: 10px;
            color: #999;
            border-top: 1px solid #ddd;
            padding-top: 10px;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>QUITTANCE DE LOYER</h1>
            <p>Document officiel</p>
          </div>

          <div class="section">
            <div class="section-title">Bailleur</div>
            <div class="info-row">
              <span class="info-label">Nom :</span>
              <span class="info-value">${this.escapeHtml(formData.landlord.name)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Adresse :</span>
              <span class="info-value">${this.escapeHtml(formData.landlord.address).replace(/\n/g, '<br>')}</span>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Locataire</div>
            <div class="info-row">
              <span class="info-label">Nom :</span>
              <span class="info-value">${this.escapeHtml(tenant.name)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Adresse du bien :</span>
              <span class="info-value">${this.escapeHtml(tenant.address).replace(/\n/g, '<br>')}</span>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Période de Location</div>
            <div class="info-row">
              <span class="info-label">Du :</span>
              <span class="info-value">${formattedStart}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Au :</span>
              <span class="info-value">${formattedEnd}</span>
            </div>
            ${isPartialMonth ? `
            <div class="info-row">
              <span class="info-label">Jours facturés :</span>
              <span class="info-value">${month.daysToCharge} jour(s) sur ${month.daysInMonth}</span>
            </div>
            ` : ''}
          </div>

          <div class="amount-section">
            <div class="amount-row">
              <span>Loyer HC :</span>
              <span>${month.rental.toFixed(2)} €</span>
            </div>
            <div class="amount-row">
              <span>${formData.chargeType === 'Forfait' ? 'Charges (forfait) :' : 'Charges (provision) :'}</span>
              <span>${month.charges.toFixed(2)} €</span>
            </div>
            <div class="amount-row total">
              <span>Total dû :</span>
              <span>${month.total.toFixed(2)} €</span>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Paiement</div>
            <div class="info-row">
              <span class="info-label">Date de paiement :</span>
              <span class="info-value">${this.formatDate(formData.dates.payment, 'DD/MM/YYYY')}</span>
            </div>
          </div>

          ${this.signatureImage ? `
          <div class="signature-area">
            <div class="signature-box">
              <img src="${this.signatureImage}" class="signature-image" alt="Signature" />
              <div>Signature du bailleur</div>
            </div>
            <div class="signature-box">
              <div style="height: 60px;"></div>
              <div>Acceptation du locataire</div>
            </div>
          </div>
          ` : `
          <div class="signature-area">
            <div class="signature-box">
              <div style="height: 60px;"></div>
              <div>Signature du bailleur</div>
            </div>
            <div class="signature-box">
              <div style="height: 60px;"></div>
              <div>Acceptation du locataire</div>
            </div>
          </div>
          `}

          ${formData.notes ? `
          <div class="notes">
            <strong>Notes :</strong><br>
            ${this.escapeHtml(formData.notes).replace(/\n/g, '<br>')}
          </div>
          ` : ''}

          <div class="footer">
            Généré le ${receiptDate}
          </div>
        </div>
      </body>
      </html>
    `;

    return receiptHTML;
  }

  // ============================================
  // UTILITAIRES
  // ============================================

  formatDate(date, format = 'DD/MM/YYYY') {
    if (!date) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    if (format === 'DD/MM/YYYY') return `${day}/${month}/${year}`;
    if (format === 'MM_YYYY') return `${month}_${year}`;
    return date.toLocaleDateString('fr-FR');
  }

  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  saveToLocalStorage() {
    try {
      const data = {
        landlordName: document.getElementById('landlord-name')?.value || '',
        landlordAddress: document.getElementById('landlord-address')?.value || '',
        tenants: this.tenants.map(t => ({
          index: t.index,
          name: document.getElementById(`tenant-name-${t.index}`)?.value || '',
          address: document.getElementById(`tenant-address-${t.index}`)?.value || ''
        })),
        signatureImage: this.signatureImage,
        preFillNextPeriod: this.preFillNextPeriod,
        tenantCounter: this.tenantCounter,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('rentReceiptData', JSON.stringify(data));
    } catch (error) {
      console.warn('Impossible de sauvegarder dans localStorage:', error);
    }
  }

  loadFromLocalStorage() {
    try {
      const data = localStorage.getItem('rentReceiptData');
      if (!data) return;

      const parsed = JSON.parse(data);

      // Restaurer les données du bailleur
      if (parsed.landlordName) {
        const input = document.getElementById('landlord-name');
        if (input) input.value = parsed.landlordName;
      }

      if (parsed.landlordAddress) {
        const input = document.getElementById('landlord-address');
        if (input) input.value = parsed.landlordAddress;
      }

      // Restaurer la signature
      if (parsed.signatureImage) {
        this.signatureImage = parsed.signatureImage;
        this.updateSignaturePreview();
      }

      // Restaurer les locataires
      this.preFillNextPeriod = parsed.preFillNextPeriod || false;
      this.tenantCounter = parsed.tenantCounter || 1;

      if (parsed.tenants && Array.isArray(parsed.tenants)) {
        parsed.tenants.forEach((tenant, index) => {
          if (index === 0) {
            // Premier locataire déjà dans le DOM
            const nameInput = document.getElementById('tenant-name-0');
            const addressInput = document.getElementById('tenant-address-0');
            if (nameInput) nameInput.value = tenant.name || '';
            if (addressInput) addressInput.value = tenant.address || '';
          } else {
            // Ajouter les autres locataires
            this.tenants.push({
              index: tenant.index,
              name: tenant.name,
              address: tenant.address
            });
            this.addTenant();
            const nameInput = document.getElementById(`tenant-name-${tenant.index}`);
            const addressInput = document.getElementById(`tenant-address-${tenant.index}`);
            if (nameInput) nameInput.value = tenant.name || '';
            if (addressInput) addressInput.value = tenant.address || '';
          }
        });
      }

      // Restaurer la case pré-remplissage
      const prefillCheckbox = document.getElementById('prefill-checkbox');
      if (prefillCheckbox) {
        prefillCheckbox.checked = this.preFillNextPeriod;
      }
    } catch (error) {
      console.warn('Erreur lors du chargement du localStorage:', error);
    }
  }
}

// Initialiser l'application
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.receiptGenerator = new RentReceiptGenerator();
  });
} else {
  window.receiptGenerator = new RentReceiptGenerator();
}
