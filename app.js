// ============================================
// RENT RECEIPT GENERATOR - APP.JS
// Direct jsPDF implementation without images
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
    // Generate PDF buttons
    const generateBtns = document.querySelectorAll('.generate-pdf-btn');
    generateBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.generatePDFs();
      });
    });

    // Signature upload
    const fileInput = document.getElementById('dropzone-file');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => this.handleSignatureUpload(e));
      this.setupDragAndDrop(fileInput);
    }

    // Auto-save listeners
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

    const radios = document.querySelectorAll('input[name="charge_type"]');
    radios.forEach(radio => {
      radio.addEventListener('change', () => this.saveToLocalStorage());
    });
  }

  // ============================================
  // SIGNATURE HANDLING
  // ============================================

  handleSignatureUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/gif'].includes(file.type)) {
      alert('Please import a PNG, JPG or GIF file');
      return;
    }

    if (file.size > 800 * 1024) {
      alert('File must be less than 800 KB');
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
  // FORM DATA RETRIEVAL
  // ============================================

  getFormData() {
    return {
      landlord: {
        name: document.getElementById('landlord-name')?.value || '',
        address: document.getElementById('landlord-address')?.value || ''
      },
      tenant: {
        name: document.getElementById('tenant-name')?.value || '',
        address: document.getElementById('tenant-address')?.value || ''
      },
      dates: {
        start: document.getElementById('date-start')?.value ? new Date(document.getElementById('date-start')?.value) : null,
        end: document.getElementById('date-end')?.value ? new Date(document.getElementById('date-end')?.value) : null,
        paymentDay: parseInt(document.getElementById('payment-day')?.value || '5')
      },
      rental: parseFloat(document.getElementById('rental-amount')?.value || 0),
      charges: parseFloat(document.getElementById('charges-amount')?.value || 0),
      chargeType: document.getElementById('charge-forfait')?.checked ? 'Forfait' : 'Provision',
      notes: document.getElementById('additional-notes')?.value || ''
    };
  }

  // ============================================
  // PRORATA CALCULATION
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
        daysToCharge,
        daysInMonth,
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
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }

  // ============================================
  // PDF GENERATION WITH JSPDF
  // ============================================

  async generatePDFs() {
    try {
      const formData = this.getFormData();

      // Validation
      if (!formData.landlord.name) {
        alert('Please fill in the landlord name');
        return;
      }

      if (!formData.tenant.name) {
        alert('Please fill in the tenant name');
        return;
      }

      if (!formData.dates.start || !formData.dates.end) {
        alert('Please set start and end dates');
        return;
      }

      if (formData.dates.start > formData.dates.end) {
        alert('End date must be after start date');
        return;
      }

      if (formData.rental <= 0) {
        alert('Please enter a valid rental amount');
        return;
      }

      // Generate monthly breakdown
      const months = this.generateMonthlyBreakdown(
        formData.dates.start,
        formData.dates.end,
        formData.rental,
        formData.charges
      );

      if (months.length === 0) {
        alert('No billing period found');
        return;
      }

      // Ensure jsPDF is loaded
      await this.ensureJsPDFLoaded();

      let successCount = 0;
      let failureCount = 0;

      // Generate one PDF per month
      for (const month of months) {
        try {
          this.generateReceiptPDF(formData, month);
          successCount++;
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error('Error generating PDF for month:', month, error);
          failureCount++;
        }
      }

      const message = failureCount > 0 
        ? `${successCount} receipt(s) generated, ${failureCount} failed.`
        : `${successCount} receipt(s) generated successfully!`;
      
      alert(message);
      this.saveToLocalStorage();

    } catch (error) {
      console.error('Error generating PDFs:', error);
      alert('An error occurred. Check the console for details.');
    }
  }

  async ensureJsPDFLoaded() {
    if (typeof jsPDF !== 'undefined') {
      return;
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  generateReceiptPDF(formData, month) {
    const { jsPDF } = window;
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let yPosition = 15;

    // Header
    pdf.setFontSize(24);
    pdf.setTextColor(19, 91, 236); // Primary blue
    pdf.text('QUITTANCE DE LOYER', pageWidth / 2, yPosition, { align: 'center' });

    yPosition += 8;
    pdf.setFontSize(10);
    pdf.setTextColor(150, 150, 150);
    pdf.text('Official Document', pageWidth / 2, yPosition, { align: 'center' });

    yPosition += 10;
    pdf.setDrawColor(19, 91, 236);
    pdf.line(15, yPosition, pageWidth - 15, yPosition);

    // Landlord Section
    yPosition += 8;
    pdf.setFontSize(11);
    pdf.setTextColor(19, 91, 236);
    pdf.setFont(undefined, 'bold');
    pdf.text('LANDLORD', 15, yPosition);

    yPosition += 6;
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Name: ${formData.landlord.name}`, 15, yPosition);

    yPosition += 6;
    const addressLines = this.wrapText(pdf, `Address: ${formData.landlord.address}`, pageWidth - 30);
    pdf.text(addressLines, 15, yPosition);
    yPosition += (addressLines.length * 4) + 2;

    // Tenant Section
    yPosition += 2;
    pdf.setFontSize(11);
    pdf.setTextColor(19, 91, 236);
    pdf.setFont(undefined, 'bold');
    pdf.text('TENANT', 15, yPosition);

    yPosition += 6;
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Name: ${formData.tenant.name}`, 15, yPosition);

    yPosition += 6;
    const tenantAddressLines = this.wrapText(pdf, `Address: ${formData.tenant.address}`, pageWidth - 30);
    pdf.text(tenantAddressLines, 15, yPosition);
    yPosition += (tenantAddressLines.length * 4) + 2;

    // Rental Period Section
    yPosition += 2;
    pdf.setFontSize(11);
    pdf.setTextColor(19, 91, 236);
    pdf.setFont(undefined, 'bold');
    pdf.text('RENTAL PERIOD', 15, yPosition);

    yPosition += 6;
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont(undefined, 'normal');
    pdf.text(`From: ${this.formatDate(month.start, 'DD/MM/YYYY')}`, 15, yPosition);

    yPosition += 6;
    pdf.text(`To: ${this.formatDate(month.end, 'DD/MM/YYYY')}`, 15, yPosition);

    if (month.daysToCharge < month.daysInMonth) {
      yPosition += 6;
      pdf.text(`Days charged: ${month.daysToCharge} out of ${month.daysInMonth}`, 15, yPosition);
    }

    // Amount Section
    yPosition += 10;
    pdf.setDrawColor(230, 230, 230);
    pdf.rect(15, yPosition - 2, pageWidth - 30, 30);

    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);

    yPosition += 4;
    pdf.text('Rent (ex. charges):', 20, yPosition);
    pdf.text(`${month.rental.toFixed(2)} €`, pageWidth - 25, yPosition, { align: 'right' });

    yPosition += 6;
    const chargeLabel = formData.chargeType === 'Forfait' ? 'Charges (flat rate):' : 'Charges (provision):';
    pdf.text(chargeLabel, 20, yPosition);
    pdf.text(`${month.charges.toFixed(2)} €`, pageWidth - 25, yPosition, { align: 'right' });

    yPosition += 8;
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(19, 91, 236);
    pdf.line(15, yPosition - 1, pageWidth - 15, yPosition - 1);
    pdf.text('TOTAL DUE:', 20, yPosition);
    pdf.text(`${month.total.toFixed(2)} €`, pageWidth - 25, yPosition, { align: 'right' });

    // Payment Section
    yPosition += 12;
    pdf.setFontSize(11);
    pdf.setTextColor(19, 91, 236);
    pdf.setFont(undefined, 'bold');
    pdf.text('PAYMENT', 15, yPosition);

    const paymentDate = new Date(month.start.getFullYear(), month.start.getMonth(), formData.dates.paymentDay);
    yPosition += 6;
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Payment date: ${this.formatDate(paymentDate, 'DD/MM/YYYY')}`, 15, yPosition);

    // Signature Section
    yPosition += 15;
    pdf.setLineWidth(0.5);
    pdf.line(15, yPosition, 50, yPosition);
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text('Landlord Signature', 32.5, yPosition + 5, { align: 'center' });

    pdf.line(120, yPosition, 185, yPosition);
    pdf.text('Tenant Signature', 152.5, yPosition + 5, { align: 'center' });

    // Notes Section
    if (formData.notes) {
      yPosition += 15;
      pdf.setFontSize(9);
      pdf.setTextColor(100, 100, 100);
      pdf.text('Notes:', 15, yPosition);
      
      yPosition += 4;
      const notesLines = this.wrapText(pdf, formData.notes, pageWidth - 30);
      pdf.text(notesLines, 15, yPosition);
    }

    // Footer
    const currentDate = this.formatDate(new Date(), 'DD/MM/YYYY');
    pdf.setFontSize(8);
    pdf.setTextColor(180, 180, 180);
    pdf.text(`Generated: ${currentDate}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

    // Save PDF
    const fileName = `Receipt_${formData.tenant.name.replace(/[^a-zA-Z0-9]/g, '_')}_${this.formatDate(month.start, 'MM_YYYY')}.pdf`;
    pdf.save(fileName);
  }

  wrapText(pdf, text, maxWidth) {
    return pdf.splitTextToSize(text, maxWidth);
  }

  // ============================================
  // UTILITIES
  // ============================================

  formatDate(date, format = 'DD/MM/YYYY') {
    if (!date || isNaN(date.getTime())) return '';
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    if (format === 'DD/MM/YYYY') return `${day}/${month}/${year}`;
    if (format === 'MM_YYYY') return `${month}_${year}`;
    return date.toLocaleDateString('en-US');
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
      console.warn('Cannot save to localStorage:', error);
    }
  }

  loadFromLocalStorage() {
    try {
      const data = localStorage.getItem('rentReceiptData');
      if (!data) return;

      const parsed = JSON.parse(data);

      // Restore all fields
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
      
      // Restore charge type
      if (parsed.chargeType === 'provision') {
        document.getElementById('charge-provision').checked = true;
      } else {
        document.getElementById('charge-forfait').checked = true;
      }

      // Restore signature
      if (parsed.signatureImage) {
        this.signatureImage = parsed.signatureImage;
        this.updateSignaturePreview();
      }
    } catch (error) {
      console.warn('Error loading from localStorage:', error);
    }
  }
}

// Initialize app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.receiptGenerator = new RentReceiptGenerator();
  });
} else {
  window.receiptGenerator = new RentReceiptGenerator();
}
