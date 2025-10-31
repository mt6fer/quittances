// ============================================
// GÉNÉRATEUR DE QUITTANCES DE LOYER - APP.JS (v3)
// Corrections: PDF blanc, ajout locataires supprimé, date de paiement par jour du mois
// ============================================

class RentReceiptGenerator {
  constructor() {
    this.signatureImage = null;
    this.initializeApp();
  }

  initializeApp() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.setupEventListeners();
        this.loadFromLocalStorage();
      });
    } else {
      this.setupEventListeners();
      this.loadFromLocalStorage();
    }
  }

  setupEventListeners() {
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

    // Écouteurs pour sauvegarde automatique
    this.setupAutoSave();
  }

  setupDragAndDrop(fileInput) {
    const dropZone = fileInput.parentElement;
    if (!dropZone) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.add('bg-gray-200', 'dark:bg-gray-500');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.remove('bg-gray-200', 'dark:bg-gray-500');
      });
    });

    dropZone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      fileInput.files = files;
      this.handleSignatureUpload({ target: fileInput });
    });
  }

  setupAutoSave() {
    const inputs = ['landlord-name', 'landlord-address', 'tenant-name', 'tenant-address', 
                     'date-start', 'date-end', 'payment-day', 'rental-amount', 
                     'charges-amount', 'additional-notes'];
    
    inputs.forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('change', () => this.saveToLocalStorage());
      }
    });

    // Aussi sauvegarder au changement du radio pour le type de charges
    const radios = document.querySelectorAll('input[name="charge_type"]');
    radios.forEach(radio => {
      radio.addEventListener('change', () => this.saveToLocalStorage());
    });
  }

  // ============================================
  // GESTION DE LA SIGNATURE
  // ============================================

  handleSignatureUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

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
    const tenantName = document.getElementById('tenant-name')?.value || '';
    const tenantAddress = document.getElementById('tenant-address')?.value || '';
    const startDate = document.getElementById('date-start')?.value || '';
    const endDate = document.getElementById('date-end')?.value || '';
    const paymentDay = parseInt(document.getElementById('payment-day')?.value || '5');
    const rentalAmount = parseFloat(document.getElementById('rental-amount')?.value || 0);
    const chargesAmount = parseFloat(document.getElementById('charges-amount')?.value || 0);
    const chargeType = document.getElementById('charge-forfait')?.checked ? 'Forfait' : 'Provision';
    const additionalNotes = document.getElementById('additional-notes')?.value || '';

    return {
      landlord: {
        name: landlordName,
        address: landlordAddress
      },
      tenant: {
        name: tenantName,
        address: tenantAddress
      },
      dates: {
        start: startDate ? new Date(startDate) : null,
        end: endDate ? new Date(endDate) : null,
        paymentDay: paymentDay
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

      if (!formData.tenant.name) {
        alert('Veuillez remplir le nom du locataire');
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
        alert('Chargement de la bibliothèque PDF en cours...');
        await this.loadHtml2PDF();
      }

      let pdfCount = 0;

      // Générer un PDF par mois
      for (const month of months) {
        const receiptHTML = this.generateReceiptHTML(formData, month);
        const fileName = `Quittance_${formData.tenant.name.replace(/[^a-zA-Z0-9]/g, '_')}_${this.formatDate(month.start, 'MM_YYYY')}.pdf`;

        const opt = {
          margin: 10,
          filename: fileName,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, logging: false },
          jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
        };

        // Créer l'élément temporaire
        const element = document.createElement('div');
        element.innerHTML = receiptHTML;
        element.style.display = 'none';
        document.body.appendChild(element);

        try {
          await html2pdf().set(opt).from(element).save();
          pdfCount++;
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error('Erreur pour le PDF du mois:', month, error);
        } finally {
          document.body.removeChild(element);
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
      script.type = 'text/javascript';
      document.head.appendChild(script);
    });
  }

  generateReceiptHTML(formData, month) {
    const formattedStart = this.formatDate(month.start, 'DD/MM/YYYY');
    const formattedEnd = this.formatDate(month.end, 'DD/MM/YYYY');
    const receiptDate = this.formatDate(new Date(), 'DD/MM/YYYY');
    const isPartialMonth = month.daysToCharge < month.daysInMonth;
    
    // Calculer la date de paiement pour ce mois
    const paymentDate = new Date(month.start.getFullYear(), month.start.getMonth(), formData.dates.paymentDay);
    const formattedPaymentDate = this.formatDate(paymentDate, 'DD/MM/YYYY');

    return `
      <div style="background: white; padding: 20mm; font-family: Arial, sans-serif; color: #333;">
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #135bec; padding-bottom: 20px;">
          <h1 style="color: #135bec; font-size: 32px; margin: 0; font-weight: bold;">QUITTANCE DE LOYER</h1>
          <p style="color: #999; font-size: 12px; margin: 5px 0;">Document officiel</p>
        </div>

        <div style="margin-bottom: 20px;">
          <div style="font-weight: bold; font-size: 13px; color: #135bec; text-transform: uppercase; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">
            Bailleur
          </div>
          <div style="margin-bottom: 6px;">
            <span style="font-weight: bold; display: inline-block; width: 140px;">Nom :</span>
            <span>${this.escapeHtml(formData.landlord.name)}</span>
          </div>
          <div style="margin-bottom: 6px;">
            <span style="font-weight: bold; display: inline-block; width: 140px; vertical-align: top;">Adresse :</span>
            <span>${this.escapeHtml(formData.landlord.address).replace(/\n/g, '<br>')}</span>
          </div>
        </div>

        <div style="margin-bottom: 20px;">
          <div style="font-weight: bold; font-size: 13px; color: #135bec; text-transform: uppercase; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">
            Locataire
          </div>
          <div style="margin-bottom: 6px;">
            <span style="font-weight: bold; display: inline-block; width: 140px;">Nom :</span>
            <span>${this.escapeHtml(formData.tenant.name)}</span>
          </div>
          <div style="margin-bottom: 6px;">
            <span style="font-weight: bold; display: inline-block; width: 140px; vertical-align: top;">Adresse du bien :</span>
            <span>${this.escapeHtml(formData.tenant.address).replace(/\n/g, '<br>')}</span>
          </div>
        </div>

        <div style="margin-bottom: 20px;">
          <div style="font-weight: bold; font-size: 13px; color: #135bec; text-transform: uppercase; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">
            Période de Location
          </div>
          <div style="margin-bottom: 6px;">
            <span style="font-weight: bold; display: inline-block; width: 140px;">Du :</span>
            <span>${formattedStart}</span>
          </div>
          <div style="margin-bottom: 6px;">
            <span style="font-weight: bold; display: inline-block; width: 140px;">Au :</span>
            <span>${formattedEnd}</span>
          </div>
          ${isPartialMonth ? `
          <div style="margin-bottom: 6px;">
            <span style="font-weight: bold; display: inline-block; width: 140px;">Jours facturés :</span>
            <span>${month.daysToCharge} jour(s) sur ${month.daysInMonth}</span>
          </div>
          ` : ''}
        </div>

        <div style="background-color: #f8f8f8; padding: 12px; border-radius: 3px; margin: 20px 0; border: 1px solid #e0e0e0;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px;">
            <span>Loyer HC :</span>
            <span>${month.rental.toFixed(2)} €</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px;">
            <span>${formData.chargeType === 'Forfait' ? 'Charges (forfait) :' : 'Charges (provision) :'}</span>
            <span>${month.charges.toFixed(2)} €</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 15px; border-top: 2px solid #135bec; padding-top: 8px; margin-top: 8px; color: #135bec;">
            <span>Total dû :</span>
            <span>${month.total.toFixed(2)} €</span>
          </div>
        </div>

        <div style="margin-bottom: 20px;">
          <div style="font-weight: bold; font-size: 13px; color: #135bec; text-transform: uppercase; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">
            Paiement
          </div>
          <div style="margin-bottom: 6px;">
            <span style="font-weight: bold; display: inline-block; width: 140px;">Date de paiement :</span>
            <span>${formattedPaymentDate}</span>
          </div>
        </div>

        ${this.signatureImage ? `
        <div style="margin-top: 40px; display: flex; justify-content: space-between;">
          <div style="width: 45%; text-align: center; border-top: 1px solid #333; padding-top: 8px; font-size: 12px;">
            <img src="${this.signatureImage}" style="max-width: 80px; max-height: 50px; margin-bottom: 8px;" alt="Signature" />
            <div>Signature du bailleur</div>
          </div>
          <div style="width: 45%; text-align: center; border-top: 1px solid #333; padding-top: 8px; font-size: 12px;">
            <div style="height: 60px;"></div>
            <div>Acceptation du locataire</div>
          </div>
        </div>
        ` : `
        <div style="margin-top: 40px; display: flex; justify-content: space-between;">
          <div style="width: 45%; text-align: center; border-top: 1px solid #333; padding-top: 8px; font-size: 12px;">
            <div style="height: 60px;"></div>
            <div>Signature du bailleur</div>
          </div>
          <div style="width: 45%; text-align: center; border-top: 1px solid #333; padding-top: 8px; font-size: 12px;">
            <div style="height: 60px;"></div>
            <div>Acceptation du locataire</div>
          </div>
        </div>
        `}

        ${formData.notes ? `
        <div style="font-size: 11px; color: #666; margin-top: 20px; padding: 10px; background-color: #fafafa; border-left: 3px solid #135bec;">
          <strong>Notes :</strong><br>
          ${this.escapeHtml(formData.notes).replace(/\n/g, '<br>')}
        </div>
        ` : ''}

        <div style="margin-top: 20px; font-size: 11px; color: #999; border-top: 1px solid #ddd; padding-top: 10px; text-align: center;">
          Généré le ${receiptDate}
        </div>
      </div>
    `;
  }

  // ============================================
  // UTILITAIRES
  // ============================================

  formatDate(date, format = 'DD/MM/YYYY') {
    if (!date || isNaN(date.getTime())) return '';
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    if (format === 'DD/MM/YYYY') return `${day}/${month}/${year}`;
    if (format === 'MM_YYYY') return `${month}_${year}`;
    return date.toLocaleDateString('fr-FR');
  }

  escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
  }

  saveToLocalStorage() {
    try {
      const data = {
        landlordName: document.getElementById('landlord-name')?.value || '',
        landlordAddress: document.getElementById('landlord-address')?.value || '',
        tenantName: document.getElementById('tenant-name')?.value || '',
        tenantAddress: document.getElementById('tenant-address')?.value || '',
        dateStart: document.getElementById('date-start')?.value || '',
        dateEnd: document.getElementById('date-end')?.value || '',
        paymentDay: document.getElementById('payment-day')?.value || '5',
        rentalAmount: document.getElementById('rental-amount')?.value || '',
        chargesAmount: document.getElementById('charges-amount')?.value || '',
        chargeType: document.getElementById('charge-forfait')?.checked ? 'forfait' : 'provision',
        additionalNotes: document.getElementById('additional-notes')?.value || '',
        signatureImage: this.signatureImage,
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

      // Restaurer tous les champs
      if (parsed.landlordName) document.getElementById('landlord-name').value = parsed.landlordName;
      if (parsed.landlordAddress) document.getElementById('landlord-address').value = parsed.landlordAddress;
      if (parsed.tenantName) document.getElementById('tenant-name').value = parsed.tenantName;
      if (parsed.tenantAddress) document.getElementById('tenant-address').value = parsed.tenantAddress;
      if (parsed.dateStart) document.getElementById('date-start').value = parsed.dateStart;
      if (parsed.dateEnd) document.getElementById('date-end').value = parsed.dateEnd;
      if (parsed.paymentDay) document.getElementById('payment-day').value = parsed.paymentDay;
      if (parsed.rentalAmount) document.getElementById('rental-amount').value = parsed.rentalAmount;
      if (parsed.chargesAmount) document.getElementById('charges-amount').value = parsed.chargesAmount;
      if (parsed.additionalNotes) document.getElementById('additional-notes').value = parsed.additionalNotes;
      
      // Restaurer le type de charges
      if (parsed.chargeType === 'provision') {
        document.getElementById('charge-provision').checked = true;
      } else {
        document.getElementById('charge-forfait').checked = true;
      }

      // Restaurer la signature
      if (parsed.signatureImage) {
        this.signatureImage = parsed.signatureImage;
        this.updateSignaturePreview();
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
