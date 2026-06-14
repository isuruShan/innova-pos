const PDFDocument = require('pdfkit');

/**
 * Generates a professional Purchase Order PDF buffer using pdfkit.
 * @param {Object} order - The Purchase Order document
 * @param {Object} supplier - The Supplier document
 * @param {Object} store - The Store document
 * @param {string} merchantName - The Merchant (Tenant) name
 * @returns {Promise<Buffer>}
 */
function generatePurchaseOrderPDF(order, supplier, store, merchantName) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Header block
      doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(20).text('PURCHASE ORDER', { align: 'right' });
      doc.font('Helvetica').fontSize(10).fillColor('#64748b').text(`PO Number: ${order.orderNumber}`, { align: 'right' });
      doc.text(`Date: ${new Date(order.createdAt || new Date()).toLocaleDateString()}`, { align: 'right' });
      if (order.expectedDate) {
        doc.text(`Expected Delivery: ${new Date(order.expectedDate).toLocaleDateString()}`, { align: 'right' });
      }
      doc.moveDown(2);

      // Store / Merchant Details (Sender)
      const topY = doc.y;
      doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(12).text('FROM (Merchant):', 40, topY);
      doc.font('Helvetica').fontSize(10).fillColor('#334155');
      doc.text(merchantName || store.name || 'Merchant');
      if (store.phone) doc.text(`Phone: ${store.phone}`);
      if (store.address) {
        const addr = store.address;
        const line1 = addr.street1 || '';
        const line2 = addr.street2 || '';
        const cityInfo = `${addr.city || ''} ${addr.state || ''} ${addr.postalCode || ''}`.trim();
        const country = addr.country || '';
        if (line1) doc.text(line1);
        if (line2) doc.text(line2);
        if (cityInfo) doc.text(cityInfo);
        if (country) doc.text(country);
      }

      // Supplier Details (Recipient)
      doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(12).text('TO (Supplier):', 300, topY);
      doc.font('Helvetica').fontSize(10).fillColor('#334155');
      doc.text(supplier.name);
      if (supplier.contactPerson) doc.text(`Contact: ${supplier.contactPerson}`);
      if (supplier.phone) doc.text(`Phone: ${supplier.phone}`);
      if (supplier.email) doc.text(`Email: ${supplier.email}`);
      if (supplier.address) doc.text(supplier.address);

      doc.moveDown(3);

      // Draw table header
      const tableTop = doc.y;
      doc.rect(40, tableTop, 515, 20).fill('#f1f5f9');
      doc.fillColor('#475569').font('Helvetica-Bold').fontSize(9);
      doc.text('Item Name', 50, tableTop + 5, { width: 300 });
      doc.text('Unit', 370, tableTop + 5, { width: 80, align: 'center' });
      doc.text('Qty', 470, tableTop + 5, { width: 60, align: 'right' });
      
      let currentY = tableTop + 20;

      // Table rows
      doc.font('Helvetica').fillColor('#334155');
      (order.items || []).forEach((item) => {
        // Draw row border
        doc.moveTo(40, currentY).lineTo(555, currentY).strokeColor('#e2e8f0').lineWidth(0.5).stroke();

        doc.text(item.itemName || '—', 50, currentY + 6, { width: 300 });
        doc.text(item.unit || '—', 370, currentY + 6, { width: 80, align: 'center' });
        doc.text(String(item.orderedQty || 0), 470, currentY + 6, { width: 60, align: 'right' });

        currentY += 25;
      });

      // Draw table bottom border
      doc.moveTo(40, currentY).lineTo(555, currentY).strokeColor('#cbd5e1').lineWidth(1).stroke();
      currentY += 20;

      // Notes
      if (order.notes) {
        doc.fontSize(10).fillColor('#1e293b').font('Helvetica-Bold').text('Notes / Instructions:', 40, currentY);
        doc.fontSize(9).font('Helvetica').fillColor('#475569').text(order.notes, 40, currentY + 15, { width: 515 });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generatePurchaseOrderPDF };
