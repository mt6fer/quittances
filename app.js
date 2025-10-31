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
      fileI
