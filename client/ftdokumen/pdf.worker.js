// pdf.worker.js (Versi Vanilla JS)

// 1. Import library jsPDF dari CDN (gunakan importScripts untuk Web Worker klasik)
importScripts("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");

self.onmessage = async (e) => {
    try {
        const { formData, capturedPhotos, allPhotoPoints } = e.data;
        
        // Akses jsPDF dari global object (karena importScripts)
        const { jsPDF } = self.jspdf; 
        const doc = new jsPDF();
        
        // --- SETUP HALAMAN & FONT ---
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        let yPos = 20;

        // Helper: Header Halaman
        const addHeader = (title) => {
            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            doc.text(title || "DOKUMENTASI TOKO BARU", pageWidth / 2, 15, { align: "center" });
            
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text(`Toko: ${formData.namaToko} (${formData.kodeToko})`, pageWidth / 2, 22, { align: "center" });
            
            doc.setLineWidth(0.5);
            doc.line(margin, 25, pageWidth - margin, 25);
            yPos = 35;
        };

        // --- HALAMAN 1: INFO DATA ---
        addHeader("DATA PROYEK");

        const addRow = (label, value) => {
            doc.setFont("helvetica", "bold");
            doc.text(label, margin, yPos);
            doc.setFont("helvetica", "normal");
            doc.text(": " + (value || "-"), margin + 50, yPos);
            yPos += 8;
        };

        addRow("Cabang", formData.cabang);
        addRow("Kode Toko", formData.kodeToko);
        addRow("Nama Toko", formData.namaToko);
        addRow("Kontraktor Sipil", formData.kontraktorSipil);
        addRow("Kontraktor ME", formData.kontraktorMe);
        yPos += 5;
        addRow("SPK Awal", formData.spkAwal);
        addRow("SPK Akhir", formData.spkAkhir);
        addRow("Tanggal GO", formData.tanggalGo);
        addRow("Tanggal ST", formData.tanggalSt);
        addRow("Tgl Ambil Foto", formData.tanggalAmbilFoto);

        // --- HALAMAN FOTO ---
        // Urutkan foto berdasarkan ID
        const sortedIds = Object.keys(capturedPhotos).map(Number).sort((a, b) => a - b);
        
        // Config Grid Foto (2 Kolom x 2 Baris per halaman = 4 Foto)
        const photoWidth = 80;
        const photoHeight = 60; // Rasio 4:3
        const gapX = 10;
        const gapY = 25;
        
        let count = 0;
        
        // Mulai halaman foto
        if (sortedIds.length > 0) {
            doc.addPage();
            addHeader("DOKUMENTASI FOTO");
        }

        for (let i = 0; i < sortedIds.length; i++) {
            const id = sortedIds[i];
            const photo = capturedPhotos[id];
            
            // Cek apakah perlu halaman baru (setiap 4 foto)
            if (count > 0 && count % 4 === 0) {
                doc.addPage();
                addHeader("DOKUMENTASI FOTO");
                yPos = 35; // Reset yPos untuk halaman baru
            }

            // Tentukan posisi X dan Y
            const col = count % 2; // 0 (kiri) atau 1 (kanan)
            const row = Math.floor((count % 4) / 2); // 0 (atas) atau 1 (bawah)

            const x = margin + (col * (photoWidth + gapX));
            const y = yPos + (row * (photoHeight + gapY));

            // Judul Foto
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            const label = allPhotoPoints.find(p => p.id === id)?.label || `Foto #${id}`;
            
            // Text wrapping agar tidak nabrak
            const splitTitle = doc.splitTextToSize(`${id}. ${label}`, photoWidth);
            doc.text(splitTitle, x, y - 2);

            // Render Gambar
            try {
                if (photo.url && photo.url.startsWith("data:image")) {
                    doc.addImage(photo.url, "JPEG", x, y, photoWidth, photoHeight);
                } else if (photo.url && photo.url.includes("fototidakbisadiambil")) {
                     // Handle kasus khusus jika foto default (opsional: bisa draw rect atau text)
                     doc.setDrawColor(200);
                     doc.setFillColor(240);
                     doc.rect(x, y, photoWidth, photoHeight, "FD");
                     doc.text("TIDAK BISA DIFOTO", x + photoWidth/2, y + photoHeight/2, {align:"center"});
                }
            } catch (err) {
                console.error("Error add image PDF", err);
            }

            // Note (jika ada)
            if (photo.note) {
                doc.setFontSize(8);
                doc.setTextColor(220, 38, 38); // Merah
                doc.text(`Note: ${photo.note}`, x, y + photoHeight + 5);
                doc.setTextColor(0); // Reset hitam
            }

            count++;
        }

        // --- OUTPUT ---
        const pdfBase64 = doc.output('datauristring'); // Format: "data:application/pdf;base64,..."
        const pdfBlob = doc.output('blob');

        // Kirim balik ke main thread
        self.postMessage({ ok: true, pdfBase64, pdfBlob });

    } catch (error) {
        self.postMessage({ ok: false, error: error.message });
    }
};