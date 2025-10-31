// ============================================
// GÉNÉRATEUR DE QUITTANCES DE LOYER - APP.JS (v4)
// CORRECTION: Utilisation jsPDF + html2canvas directement
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
  // GÉNÉRATION DES PDF - VERSION JSPDF
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

      // Attendre le chargement des dépendances
      await this.ensureLibrariesLoaded();

      let pdfCount = 0;

      // Générer un PDF par mois
      for (const month of months) {
        await this.generatePdfForMonth(formData, month);
        pdfCount++;
        
        // Délai pour éviter les blocages
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      alert(`✅ ${pdfCount} quittance(s) générée(s) avec succès !`);
      this.saveToLocalStorage();

    } catch (error) {
      console.error('Erreur lors de la génération des PDF:', error);
      alert('❌ Une erreur est survenue. Consultez la console pour plus de détails.');
    }
  }

  async ensureLibrariesLoaded() {
    // Vérifier si jsPDF et html2canvas sont chargés
    if (typeof jsPDF !== 'undefined' && typeof html2canvas !== 'undefined') {
      return;
    }

    // Charger jsPDF si nécessaire
    if (typeof jsPDF === 'undefined') {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    // Charger html2canvas si nécessaire
    if (typeof html2canvas === 'undefined') {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }
  }

  async generatePdfForMonth(formData, month) {
    return new Promise((resolve) => {
      const receiptHTML = this.createReceiptElement(formData, month);
      
      html2canvas(receiptHTML, {
        scale: 2,
        logging: false,
        useCORS: true,
        backgroundColor: '#ffffff'
      }).then(canvas => {
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const imgWidth = 210; // A4 width in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
        
        const fileName = `Quittance_${formData.tenant.name.replace(/[^a-zA-Z0-9]/g, '_')}_${this.formatDate(month.start, 'MM_YYYY')}.pdf`;
        pdf.save(fileName);
        
        resolve();
      }).catch(error => {
        console.error('Erreur html2canvas:', error);
        resolve();
      });
    });
  }

  createReceiptElement(formData, month) {
    const formattedStart = this.formatDate(month.start, 'DD/MM/YYYY');
    const formattedEnd = this.formatDate(month.end, 'DD/MM/YYYY');
    const receiptDate = this.formatDate(new Date(), 'DD/MM/YYYY');
    const isPartialMonth = month.daysToCharge < month.daysInMonth;
    
    // Calculer la date de paiement pour ce mois
    const paymentDate = new Date(month.start.getFullYear(), month.start.getMonth(), formData.dates.paymentDay);
    const formattedPaymentDate = this.formatDate(paymentDate, 'DD/MM/YYYY');

    const element = document.createElement('div');
    element.style.width = '210mm';
    element.style.height = '297mm';
    element.style.padding = '20mm';
    element.style.boxSizing = 'border-box';
    element.style.fontFamily = 'Arial, sans-serif';
    element.style.color = '#333';
    element.style.backgroundColor = 'white';
    element.style.margin = '0';
    element.style.lineHeight = '1.5';

    element.innerHTML = `
      <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #135bec; padding-bottom: 20px;">
        <h1 style="color: #135bec; font-size: 32px; margin: 0; font-weight: bold;">QUITTANCE DE LOYER</h1>
        <p style="color: #999; font-size: 12px; margin: 5px 0;">Document officiel</p>
      </div>

      <div style="margin-bottom: 20px;">
        <div style="font-weight: bold; font-size: 13px; color: #135bec; text-transform: uppercase; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">
          Bailleur
        </div>
        <div style="margin-bottom: 6px; font-size: 13px;">
          <span style="font-weight: bold; display: inline-block; width: 140px;">Nom :</span>
          <span>${this.escapeHtml(formData.landlord.name)}</span>
        </div>
        <div style="margin-bottom: 6px; font-size: 13px;">
          <span style="font-weight: bold; display: inline-block; width: 140px; vertical-align: top;">Adresse :</span>
          <span>${this.escapeHtml(formData.landlord.address).split('\n').join('<br>')}</span>
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <div style="font-weight: bold; font-size: 13px; color: #135bec; text-transform: uppercase; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">
          Locataire
        </div>
        <div style="margin-bottom: 6px; font-size: 13px;">
          <span style="font-weight: bold; display: inline-block; width: 140px;">Nom :</span>
          <span>${this.escapeHtml(formData.tenant.name)}</span>
        </div>
        <div style="margin-bottom: 6px; font-size: 13px;">
          <span style="font-weight: bold; display: inline-block; width: 140px; vertical-align: top;">Adresse du bien :</span>
          <span>${this.escapeHtml(formData.tenant.address).split('\n').join('<br>')}</span>
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <div style="font-weight: bold; font-size: 13px; color: #135bec; text-transform: uppercase; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">
          Période de Location
        </div>
        <div style="margin-bottom: 6px; font-size: 13px;">
          <span style="font-weight: bold; display: inline-block; width: 140px;">Du :</span>
          <span>${formattedStart}</span>
        </div>
        <div style="margin-bottom: 6px; font-size: 13px;">
          <span style="font-weight: bold; display: inline-block; width: 140px;">Au :</span>
          <span>${formattedEnd}</span>
        </div>
        ${isPartialMonth ? `
        <div style="margin-bottom: 6px; font-size: 13px;">
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
        <div style="margin-bottom: 6px; font-size: 13px;">
          <span style="font-weight: bold; display: inline-block; width: 140px;">Date de paiement :</span>
          <span>${formattedPaymentDate}</span>
        </div>
      </div>

      ${this.signatureImage ? `
      <div style="margin-top: 40px; display: flex; justify-content: space-between;">
        <div style="width: 45%; text-align: center; border-top: 1px solid #333; padding-top: 8px; font-size: 12px;">
          <img src="${this.signatureImage}" style="max-width: 80px; max-height: 50px; margin-bottom: 8px; display: block; margin-left: auto; margin-right: auto;" alt="Signature" />
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
        ${this.escapeHtml(formData.notes).split('\n').join('<br>')}
      </div>
      ` : ''}

      <div style="margin-top: 20px; font-size: 11px; color: #999; border-top: 1px solid #ddd; padding-top: 10px; text-align: center;">
        Généré le ${receiptDate}
      </div>
    `;

    // Ajouter temporairement au body pour que html2canvas puisse le capturer
    document.body.appendChild(element);

    return element;
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
