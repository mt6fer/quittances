// ============================================
// GÉNÉRATEUR DE QUITTANCES DE LOYER - APP.JS (v5)
// CORRECTION: Utilisation de jsPDF pour la génération
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
      if (files.length > 0) {
        fileInput.files = files;
        const changeEvent = new Event('change', { bubbles: true });
        fileInput.dispatchEvent(changeEvent);
      }
    });
  }

  handleSignatureUpload(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.signatureImage = e.target.result;
        this.updateSignaturePreview();
        this.saveToLocalStorage();
      };
      reader.readAsDataURL(file);
    }
  }

  updateSignaturePreview() {
    const preview = document.getElementById('signature-preview');
    if (this.signatureImage) {
      preview.innerHTML = `<img src="${this.signatureImage}" alt="Signature Preview" class="object-contain w-full h-full rounded-md">`;
    } else {
      preview.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">Aucune image</p>';
    }
  }

  setupAutoSave() {
    const form = document.getElementById('receipt-form');
    form.addEventListener('input', () => this.saveToLocalStorage());
  }

  saveToLocalStorage() {
    const formData = {
      landlordName: this.getFieldValue('landlord-name'),
      landlordAddress: this.getFieldValue('landlord-address'),
      tenantName: this.getFieldValue('tenant-name'),
      tenantAddress: this.getFieldValue('tenant-address'),
      dateStart: this.getFieldValue('date-start'),
      dateEnd: this.getFieldValue('date-end'),
      paymentDay: this.getFieldValue('payment-day'),
      rentalAmount: this.getFieldValue('rental-amount'),
      chargesAmount: this.getFieldValue('charges-amount'),
      chargeType: document.querySelector('input[name="charge_type"]:checked')?.id,
      additionalNotes: this.getFieldValue('additional-notes'),
      signatureImage: this.signatureImage,
    };
    localStorage.setItem('receiptFormData', JSON.stringify(formData));
  }

  loadFromLocalStorage() {
    const savedData = localStorage.getItem('receiptFormData');
    if (savedData) {
      const formData = JSON.parse(savedData);
      this.setFieldValue('landlord-name', formData.landlordName);
      this.setFieldValue('landlord-address', formData.landlordAddress);
      this.setFieldValue('tenant-name', formData.tenantName);
      this.setFieldValue('tenant-address', formData.tenantAddress);
      this.setFieldValue('date-start', formData.dateStart);
      this.setFieldValue('date-end', formData.dateEnd);
      this.setFieldValue('payment-day', formData.paymentDay);
      this.setFieldValue('rental-amount', formData.rentalAmount);
      this.setFieldValue('charges-amount', formData.chargesAmount);
      if (formData.chargeType) {
        const chargeTypeRadio = document.getElementById(formData.chargeType);
        if (chargeTypeRadio) chargeTypeRadio.checked = true;
      }
      this.setFieldValue('additional-notes', formData.additionalNotes);
      if (formData.signatureImage) {
        this.signatureImage = formData.signatureImage;
        this.updateSignaturePreview();
      }
    }
  }

  getFieldValue(id) {
    const element = document.getElementById(id);
    return element ? element.value : '';
  }

  setFieldValue(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.value = value || '';
    }
  }

  generatePDFs() {
    const { jsPDF } = window.jspdf;
    const formData = this.getFormData();
    if (!this.validateForm(formData)) return;
    
    const receipts = this.calculateReceipts(formData);

    receipts.forEach((receiptData, index) => {
      const doc = new jsPDF();
      this.addPDFContent(doc, formData, receiptData);
      doc.save(`quittance-loyer-${receiptData.period.replace(' ', '-')}.pdf`);
    });
  }

  getFormData() {
    const chargeTypeEl = document.querySelector('input[name="charge_type"]:checked');
    
    return {
      landlordName: this.getFieldValue('landlord-name'),
      landlordAddress: this.getFieldValue('landlord-address'),
      tenantName: this.getFieldValue('tenant-name'),
      tenantAddress: this.getFieldValue('tenant-address'),
      dateStart: this.getFieldValue('date-start'),
      dateEnd: this.getFieldValue('date-end'),
      paymentDay: this.getFieldValue('payment-day'),
      rentalAmount: parseFloat(this.getFieldValue('rental-amount') || 0),
      chargesAmount: parseFloat(this.getFieldValue('charges-amount') || 0),
      chargeType: chargeTypeEl ? chargeTypeEl.nextElementSibling.textContent.trim() : 'Forfait',
      additionalNotes: this.getFieldValue('additional-notes'),
      signatureImage: this.signatureImage
    };
  }

  validateForm(data) {
    if (!data.landlordName || !data.landlordAddress || !data.tenantName || !data.tenantAddress || !data.dateStart || !data.dateEnd) {
      alert("Veuillez remplir tous les champs obligatoires.");
      return false;
    }
    return true;
  }

  calculateReceipts(data) {
    let receipts = [];
    let startDate = new Date(data.dateStart);
    let endDate = new Date(data.dateEnd);
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      let monthStartDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      let monthEndDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      let daysInMonth = monthEndDate.getDate();

      let periodStart = (currentDate.getTime() === startDate.getTime()) ? startDate : monthStartDate;
      let periodEnd = (monthEndDate > endDate) ? endDate : monthEndDate;

      let daysToPay = (periodEnd.getTime() - periodStart.getTime()) / (1000 * 3600 * 24) + 1;
      let prorata = daysToPay / daysInMonth;

      let rent = data.rentalAmount * prorata;
      let charges = data.chargesAmount * prorata;
      
      receipts.push({
        period: this.formatPeriod(currentDate),
        paymentDate: this.formatPaymentDate(currentDate, data.paymentDay),
        rent: rent.toFixed(2),
        charges: charges.toFixed(2),
        total: (rent + charges).toFixed(2)
      });

      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    return receipts;
  }
  
  formatPeriod(date) {
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

  formatPaymentDate(date, day) {
    return new Date(date.getFullYear(), date.getMonth(), day).toLocaleDateString('fr-FR');
  }

  addPDFContent(doc, formData, receiptData) {
    // Styles
    const titleFontSize = 18;
    const headerFontSize = 12;
    const regularFontSize = 10;
    const smallFontSize = 8;
    const leftMargin = 15;
    const rightMargin = 195;
    const contentWidth = rightMargin - leftMargin;
    let y = 20;

    // Titre
    doc.setFontSize(titleFontSize);
    doc.setFont('helvetica', 'bold');
    doc.text("QUITTANCE DE LOYER", doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });
    y += 10;
    
    // Informations du bailleur
    doc.setFontSize(headerFontSize);
    doc.text("BAILLEUR", leftMargin, y);
    doc.setFontSize(regularFontSize);
    doc.setFont('helvetica', 'normal');
    y += 6;
    doc.text(formData.landlordName, leftMargin, y);
    y += 5;
    const landlordAddress = doc.splitTextToSize(formData.landlordAddress, contentWidth / 2 - 5);
    doc.text(landlordAddress, leftMargin, y);
    y += landlordAddress.length * 5;

    // Informations du locataire (à droite)
    const tenantY = 50;
    doc.setFontSize(headerFontSize);
    doc.setFont('helvetica', 'bold');
    doc.text("LOCATAIRE", rightMargin, tenantY, { align: 'right' });
    doc.setFontSize(regularFontSize);
    doc.setFont('helvetica', 'normal');
    doc.text(formData.tenantName, rightMargin, tenantY + 6, { align: 'right' });
    const tenantAddress = doc.splitTextToSize(formData.tenantAddress, contentWidth / 2 - 5);
    doc.text(tenantAddress, rightMargin, tenantY + 11, { align: 'right' });

    y = Math.max(y, tenantY + 11 + tenantAddress.length * 5);
    y += 15;
    
    // Contenu de la quittance
    doc.text(`Date du paiement : ${receiptData.paymentDate}`, leftMargin, y);
    y += 7;
    doc.text(`Période de location : ${receiptData.period}`, leftMargin, y);
    y += 15;

    // Tableau des détails
    const tableHeaderY = y;
    doc.setFont('helvetica', 'bold');
    doc.text("Désignation", leftMargin, tableHeaderY);
    doc.text("Montant", rightMargin, tableHeaderY, { align: 'right' });
    y += 2;
    doc.line(leftMargin, y, rightMargin, y); // Ligne sous l'en-tête
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.text("Loyer principal", leftMargin, y);
    doc.text(`${receiptData.rent} €`, rightMargin, y, { align: 'right' });
    y += 7;
    doc.text(`Charges (${formData.chargeType})`, leftMargin, y);
    doc.text(`${receiptData.charges} €`, rightMargin, y, { align: 'right' });
    y += 5;
    doc.line(leftMargin, y, rightMargin, y); // Ligne de séparation
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.text("Total", leftMargin, y);
    doc.text(`${receiptData.total} €`, rightMargin, y, { align: 'right' });
    y += 15;

    // Phrase de confirmation
    doc.setFont('helvetica', 'normal');
    doc.text(`Je soussigné(e) ${formData.landlordName}, bailleur, reconnais avoir reçu de ${formData.tenantName}, locataire, la somme de ${receiptData.total} euros, au titre du paiement du loyer et des charges pour la période susmentionnée et lui en donne quittance, sous réserve de tous mes droits.`, leftMargin, y, { maxWidth: contentWidth });
    y += 20;

    // Mentions complémentaires
    if (formData.additionalNotes) {
      doc.setFont('helvetica', 'bold');
      doc.text("Mentions complémentaires :", leftMargin, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(smallFontSize);
      const notes = doc.splitTextToSize(formData.additionalNotes, contentWidth);
      doc.text(notes, leftMargin, y);
      y += notes.length * 4;
      doc.setFontSize(regularFontSize);
    }
    
    // Signature
    y = Math.max(y, 230);
    doc.text(`Fait à __________________________, le ____/____/________`, leftMargin, y);
    y += 10;
    doc.text("Signature du bailleur :", leftMargin, y);
    if (formData.signatureImage) {
      try {
        const imgProps = doc.getImageProperties(formData.signatureImage);
        const ratio = imgProps.width / imgProps.height;
        const imgWidth = 40;
        const imgHeight = imgWidth / ratio;
        doc.addImage(formData.signatureImage, 'PNG', leftMargin, y + 2, imgWidth, imgHeight);
      } catch (e) {
        console.error("Erreur d'ajout de l'image de signature:", e);
        doc.text("[Erreur signature]", leftMargin, y + 10);
      }
    }
  }
}

// Initialiser l'application
new RentReceiptGenerator();
