// pdf.worker.js
importScripts("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");

self.onmessage = async (e) => {
    try {
        // Ambil data, berikan default object jika undefined
        const { formData = {}, capturedPhotos = {}, allPhotoPoints = [] } = e.data;

        // Validasi jspdf
        if (!self.jspdf || !self.jspdf.jsPDF) {
            throw new Error("Library jsPDF gagal dimuat. Periksa koneksi internet.");
        }

        const { jsPDF } = self.jspdf;
        const doc = new jsPDF();
        
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        let yPos = 20;

        // Helper Header
        const addHeader = (title) => {
            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            doc.text(title || "DOKUMENTASI TOKO BARU", pageWidth / 2, 15, { align: "center" });

            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            const namaToko = formData.namaToko || "-";
            const kodeToko = formData.kodeToko || "-";
            doc.text(`Toko: ${namaToko} (${kodeToko})`, pageWidth / 2, 22, { align: "center" });

            doc.setLineWidth(0.5);
            doc.line(margin, 25, pageWidth - margin, 25);
            yPos = 35;
        };

        // Halaman 1: Info
        addHeader("DATA TOKO");
        doc.setFontSize(11);
        const info = [
            `Nomor ULOK: ${formData.nomorUlok || "-"}`,
            `Nama Toko: ${formData.namaToko || "-"}`,
            `Kode Toko: ${formData.kodeToko || "-"}`,
            `Tgl Ambil Foto: ${formData.tanggalAmbilFoto || "-"}`,
            `Alamat: ${formData.alamatToko || "-"}`
        ];
        
        let infoY = yPos;
        info.forEach(line => {
            doc.text(line, margin, infoY);
            infoY += 7;
        });

        // Loop Foto
        let count = 0;
        const sortedPoints = allPhotoPoints.sort((a, b) => a.id - b.id);

        for (const p of sortedPoints) {
            if (count > 0 && count % 2 === 0) {
                doc.addPage();
                addHeader(`FOTO DOKUMENTASI (Hal. ${Math.floor(count/2) + 2})`);
            }

            const isTop = count % 2 === 0;
            const currentY = isTop ? 35 : 150; 
            
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.text(`${p.id}. ${p.label}`, margin, currentY);

            const photoHeight = 90;
            const photoWidth = 120;
            const photoData = capturedPhotos[p.id];

            // Render Gambar
            if (photoData && photoData.url) {
                try {
                    // Cek apakah Base64 (Data URI)
                    if (photoData.url.startsWith("data:image")) {
                        doc.addImage(photoData.url, "JPEG", margin, currentY + 5, photoWidth, photoHeight);
                    } else {
                        // Jika URL biasa (http/https), jsPDF di worker SULIT merender karena CORS.
                        // Kita tampilkan placeholder agar tidak error.
                        doc.setDrawColor(150);
                        doc.setFillColor(240);
                        doc.rect(margin, currentY + 5, photoWidth, photoHeight, "FD");
                        doc.setFontSize(9);
                        doc.setTextColor(100);
                        doc.text("Gambar tersimpan di server", margin + 10, currentY + 45);
                        doc.text("(Tidak tampil di PDF Preview)", margin + 10, currentY + 50);
                        doc.setTextColor(0);
                    }
                } catch (err) {
                    console.error(`Gagal render foto ${p.id}:`, err);
                    doc.rect(margin, currentY + 5, photoWidth, photoHeight);
                    doc.text("Error Render Gambar", margin + 10, currentY + 45);
                }

                if (photoData.note) {
                    doc.setFont("helvetica", "italic");
                    doc.setFontSize(9);
                    doc.setTextColor(100);
                    const splitNote = doc.splitTextToSize(`Note: ${photoData.note}`, pageWidth - (margin * 2));
                    doc.text(splitNote, margin, currentY + photoHeight + 10);
                    doc.setTextColor(0);
                }
            } else {
                // Foto Belum Ada
                doc.setDrawColor(200);
                doc.setFillColor(250);
                doc.rect(margin, currentY + 5, photoWidth, photoHeight, "FD");
                doc.setTextColor(150);
                doc.text("FOTO BELUM DIAMBIL", margin + 30, currentY + 45);
                doc.setTextColor(0);
            }
            count++;
        }

        const pdfBase64 = doc.output("datauristring").split(",")[1];
        const pdfBlob = doc.output("blob");

        self.postMessage({ ok: true, pdfBase64, pdfBlob });

    } catch (error) {
        self.postMessage({ ok: false, error: error.message });
    }
};